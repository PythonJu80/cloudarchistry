"""
Simplified utility functions for the Crawl4AI MCP server.
Uses local PostgreSQL instead of Supabase. Supports BYOK (Bring Your Own Key).
"""
import os
import sys
import concurrent.futures
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urlparse
from pathlib import Path
import openai
import time
import contextvars

# Use db.py for database operations
import db

# Default model (fallback only - prefer user's preferredModel)
DEFAULT_MODEL = "gpt-4o-mini"

# Context variables to store per-request API key and model
_request_api_key: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "request_api_key", default=None
)
_request_model: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "request_model", default=None
)


def set_request_api_key(api_key: Optional[str]) -> None:
    """Set the API key for the current request context."""
    _request_api_key.set(api_key)


def get_request_api_key() -> Optional[str]:
    """Get the API key for the current request context."""
    return _request_api_key.get()


def set_request_model(model: Optional[str]) -> None:
    """Set the preferred model for the current request context."""
    _request_model.set(model)


def get_request_model() -> str:
    """Get the preferred model for the current request context, or default."""
    return _request_model.get() or DEFAULT_MODEL


class ApiKeyRequiredError(Exception):
    """Raised when no API key is available and one is required."""
    pass


def get_openai_client(api_key: Optional[str] = None) -> openai.OpenAI:
    """Get OpenAI client with .env only."""
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Set OPENAI_API_KEY in .env file."
        )
    return openai.OpenAI(api_key=key)


def create_embeddings_batch(texts: List[str]) -> Tuple[List[List[float]], int]:
    """
    Create embeddings for multiple texts in a single API call.
    
    Args:
        texts: List of texts to create embeddings for
        
    Returns:
        Tuple of (List of embeddings, total tokens used)
    """
    if not texts:
        return [], 0
    
    max_retries = 3
    retry_delay = 1.0
    total_tokens = 0
    
    client = get_openai_client()
    
    for retry in range(max_retries):
        try:
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=texts
            )
            total_tokens = response.usage.total_tokens if hasattr(response, 'usage') else sum(len(t.split()) for t in texts)
            return [item.embedding for item in response.data], total_tokens
        except Exception as e:
            if retry < max_retries - 1:
                print(f"Error creating batch embeddings (attempt {retry + 1}/{max_retries}): {e}")
                time.sleep(retry_delay)
                retry_delay *= 2
            else:
                print(f"Failed to create batch embeddings after {max_retries} attempts: {e}")
                # Fallback: create embeddings one by one
                embeddings = []
                for i, text in enumerate(texts):
                    try:
                        truncated_text = text[:30000] if len(text) > 30000 else text
                        individual_response = client.embeddings.create(
                            model="text-embedding-3-small",
                            input=[truncated_text]
                        )
                        embeddings.append(individual_response.data[0].embedding)
                        if hasattr(individual_response, 'usage'):
                            total_tokens += individual_response.usage.total_tokens
                    except Exception as individual_error:
                        print(f"Failed to create embedding for text {i}: {individual_error}")
                        embeddings.append([0.0] * 1536)
                
                return embeddings, total_tokens
    
    return [], 0


def create_embedding(text: str) -> Tuple[List[float], int]:
    """Create an embedding for a single text."""
    try:
        embeddings, tokens = create_embeddings_batch([text])
        return (embeddings[0] if embeddings else [0.0] * 1536), tokens
    except Exception as e:
        print(f"Error creating embedding: {e}")
        return [0.0] * 1536, 0


def generate_contextual_embedding(full_document: str, chunk: str) -> Tuple[str, bool, int]:
    """
    Generate contextual information for a chunk within a document.
    """
    try:
        prompt = f"""<document> 
{full_document[:25000]} 
</document>
Here is the chunk we want to situate within the whole document 
<chunk> 
{chunk}
</chunk> 
Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else."""

        client = get_openai_client()
        response = client.chat.completions.create(
            model=get_request_model(),
            messages=[
                {"role": "system", "content": "You are a helpful assistant that provides concise contextual information."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=200
        )
        
        context = response.choices[0].message.content.strip()
        tokens_used = response.usage.total_tokens if hasattr(response, 'usage') else 0
        contextual_text = f"{context}\n---\n{chunk}"
        
        return contextual_text, True, tokens_used
    
    except Exception as e:
        print(f"Error generating contextual embedding: {e}. Using original chunk instead.")
        return chunk, False, 0


async def _process_batch(
    batch_idx: int,
    batch_urls: List[str],
    batch_chunk_numbers: List[int],
    batch_contents: List[str],
    batch_metadatas: List[Dict[str, Any]],
    url_to_full_document: Dict[str, str],
    tenant_id: str,
    use_contextual_embeddings: bool
) -> int:
    """Process a single batch - can be run in parallel."""
    # Apply contextual embedding if enabled
    if use_contextual_embeddings:
        contextual_contents = []
        for j, content in enumerate(batch_contents):
            url = batch_urls[j]
            full_document = url_to_full_document.get(url, "")
            result, success, _ = generate_contextual_embedding(full_document, content)
            contextual_contents.append(result)
            if success:
                batch_metadatas[j]["contextual_embedding"] = True
    else:
        contextual_contents = batch_contents
    
    # Create embeddings
    batch_embeddings, _ = create_embeddings_batch(contextual_contents)
    
    # Save to database
    saved = 0
    for j in range(len(contextual_contents)):
        parsed_url = urlparse(batch_urls[j])
        source_id = parsed_url.netloc or parsed_url.path
        
        try:
            await db.save_crawled_page(
                url=batch_urls[j],
                chunk_number=batch_chunk_numbers[j],
                content=contextual_contents[j],
                source_id=source_id,
                metadata={
                    "chunk_size": len(contextual_contents[j]),
                    **batch_metadatas[j]
                },
                embedding=batch_embeddings[j] if j < len(batch_embeddings) else None,
                tenant_id=tenant_id
            )
            saved += 1
        except Exception as e:
            print(f"Error saving crawled page: {e}")
    
    print(f"Saved batch {batch_idx + 1}: {saved} documents")
    return saved


async def add_documents_to_db(
    urls: List[str], 
    chunk_numbers: List[int],
    contents: List[str], 
    metadatas: List[Dict[str, Any]],
    url_to_full_document: Dict[str, str],
    tenant_id: str = None,
    batch_size: int = 20,
    max_parallel_batches: int = None
) -> None:
    """
    Add documents to the local PostgreSQL crawled_pages table.
    
    Uses parallel batch processing for better throughput.
    
    Args:
        tenant_id: Tenant ID for multi-tenant isolation
        max_parallel_batches: Number of batches to process in parallel (env: MAX_PARALLEL_BATCHES, default 4)
    """
    import asyncio
    
    if max_parallel_batches is None:
        max_parallel_batches = int(os.getenv("MAX_PARALLEL_BATCHES", "4"))
    
    use_contextual_embeddings = os.getenv("USE_CONTEXTUAL_EMBEDDINGS", "false") == "true"
    print(f"Use contextual embeddings: {use_contextual_embeddings}, parallel batches: {max_parallel_batches}")
    
    # Prepare all batches
    batches = []
    for i in range(0, len(contents), batch_size):
        batch_end = min(i + batch_size, len(contents))
        batches.append({
            "idx": i // batch_size,
            "urls": urls[i:batch_end],
            "chunk_numbers": chunk_numbers[i:batch_end],
            "contents": contents[i:batch_end],
            "metadatas": metadatas[i:batch_end].copy()  # Copy to avoid mutation issues
        })
    
    # Process batches in parallel groups
    for group_start in range(0, len(batches), max_parallel_batches):
        group_end = min(group_start + max_parallel_batches, len(batches))
        group = batches[group_start:group_end]
        
        # Create tasks for parallel execution
        tasks = [
            _process_batch(
                batch["idx"],
                batch["urls"],
                batch["chunk_numbers"],
                batch["contents"],
                batch["metadatas"],
                url_to_full_document,
                tenant_id,
                use_contextual_embeddings
            )
            for batch in group
        ]
        
        # Run batch group in parallel
        await asyncio.gather(*tasks)
    
    print(f"Completed all {len(batches)} batches")


async def search_documents(
    query: str,
    source_id: str = None,
    match_count: int = 10,
    metadata_filter: Dict[str, Any] = None
) -> List[Dict[str, Any]]:
    """
    Search documents by semantic similarity.
    """
    embedding, _ = create_embedding(query)
    return await db.search_crawled_pages(
        embedding=embedding,
        limit=match_count,
        source_id=source_id,
        metadata_filter=metadata_filter
    )


def extract_code_blocks(content: str) -> List[Dict[str, Any]]:
    """Extract code blocks from markdown content."""
    import re
    code_blocks = []
    pattern = r'```(\w+)?\n(.*?)```'
    matches = re.findall(pattern, content, re.DOTALL)
    
    for i, (language, code) in enumerate(matches):
        code_blocks.append({
            "language": language or "unknown",
            "code": code.strip(),
            "index": i
        })
    
    return code_blocks


def generate_code_example_summary(code: str, language: str) -> str:
    """Generate a summary for a code example."""
    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model=get_request_model(),
            messages=[
                {"role": "system", "content": "You are a helpful assistant that summarizes code examples concisely."},
                {"role": "user", "content": f"Summarize this {language} code in one sentence:\n\n{code[:2000]}"}
            ],
            temperature=0.3,
            max_tokens=100
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error generating code summary: {e}")
        return f"{language} code example"


async def add_code_examples_to_db(
    url: str,
    code_blocks: List[Dict[str, Any]],
    source_id: str,
    tenant_id: str = None
) -> None:
    """Add code examples to the database.
    
    Args:
        tenant_id: Tenant ID for multi-tenant isolation
    """
    for i, block in enumerate(code_blocks):
        summary = generate_code_example_summary(block["code"], block["language"])
        embedding, _ = create_embedding(f"{summary}\n{block['code']}")
        
        try:
            await db.save_code_example(
                url=url,
                chunk_number=i,
                content=block["code"],
                summary=summary,
                source_id=source_id,
                metadata={"language": block["language"]},
                embedding=embedding,
                tenant_id=tenant_id
            )
        except Exception as e:
            print(f"Error saving code example: {e}")


async def search_code_examples(
    query: str,
    source_id: str = None,
    match_count: int = 10
) -> List[Dict[str, Any]]:
    """Search code examples by semantic similarity."""
    embedding, _ = create_embedding(query)
    return await db.search_code_examples(
        embedding=embedding,
        limit=match_count,
        source_id=source_id
    )


async def update_source_info(source_id: str, summary: str = None, word_count: int = 0, tenant_id: str = None) -> None:
    """Update source information.
    
    Args:
        tenant_id: Tenant ID for multi-tenant isolation
    """
    await db.ensure_source(source_id, summary, word_count, tenant_id)


def extract_source_summary(content: str) -> str:
    """Extract a summary from content."""
    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model=get_request_model(),
            messages=[
                {"role": "system", "content": "You are a helpful assistant that creates concise summaries."},
                {"role": "user", "content": f"Summarize this content in 2-3 sentences:\n\n{content[:5000]}"}
            ],
            temperature=0.3,
            max_tokens=150
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error extracting summary: {e}")
        return ""


async def save_report(
    report_id: str,
    source_id: str,
    title: str,
    content: str,
    summary: str = None,
    focus_query: str = None,
    chunks_analyzed: int = None,
    model_used: str = None,
    metadata: Dict[str, Any] = None
) -> Dict[str, Any]:
    """Save a report to the database."""
    embedding, _ = create_embedding(content[:8000])  # Limit for embedding
    
    return await db.save_report(
        report_id=report_id,
        source_id=source_id,
        title=title,
        report_content=content,
        report_summary=summary,
        focus_query=focus_query,
        chunks_analyzed=chunks_analyzed,
        model_used=model_used,
        metadata=metadata,
        embedding=embedding
    )


async def search_reports(
    query: str,
    source_id: str = None,
    match_count: int = 5,
    threshold: float = 0.7
) -> List[Dict[str, Any]]:
    """Search reports by semantic similarity."""
    embedding, _ = create_embedding(query)
    return await db.search_reports(
        embedding=embedding,
        limit=match_count,
        threshold=threshold,
        source_id=source_id
    )


# === Compatibility stubs for old Supabase functions ===

def get_supabase_client():
    """Stub - no longer uses Supabase."""
    return None


async def get_supabase_user_id(user_id: str) -> str:
    """Stub - returns same user_id (no Supabase mapping)."""
    return user_id


async def check_usage_limits_and_get_key(user_id: str) -> Dict[str, Any]:
    """Returns .env API key only."""
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Set OPENAI_API_KEY in .env file."
        )
    return {
        "api_key": key,
        "supabase_user_id": user_id
    }


async def log_tool_usage(user_id: str, tool_name: str, total_tokens: int, cost_usd: float):
    """Stub - no-op (usage logging disabled)."""
    pass


async def fetch_knowledge_for_generation(
    cert_code: str,
    topic: str,
    limit: int = 5,
    api_key: Optional[str] = None
) -> str:
    """
    Fetch relevant AWS knowledge from AcademyKnowledgeChunks database.
    
    This ensures all generated content uses up-to-date AWS documentation (December 2025)
    instead of relying on outdated model training data.
    
    Args:
        cert_code: Certification persona ID (e.g., 'solutions-architect-associate')
        topic: Topic/context to search for (e.g., 'S3 security', 'Lambda performance')
        limit: Number of knowledge chunks to retrieve (default: 5)
        api_key: Optional OpenAI API key for embedding generation
    
    Returns:
        Formatted knowledge context string to inject into prompts
    """
    try:
        from openai import AsyncOpenAI
        from prompts import CERTIFICATION_PERSONAS
        
        # Build search query based on cert focus areas + topic
        query_parts = [topic]
        if cert_code in CERTIFICATION_PERSONAS:
            persona = CERTIFICATION_PERSONAS[cert_code]
            # Add cert focus areas to query for better relevance
            focus_areas = persona.get("focus", [])
            if focus_areas:
                query_parts.extend(focus_areas[:2])  # Add top 2 focus areas
        
        search_query = " ".join(query_parts) + " AWS"
        
        # Get API key from .env only
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            return ""  # Gracefully degrade if no key available
        
        # Generate embedding for search
        client = AsyncOpenAI(api_key=key)
        embed_response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=search_query
        )
        query_embedding = embed_response.data[0].embedding
        
        # Search knowledge base
        kb_results = await db.search_knowledge_chunks(
            query_embedding=query_embedding,
            limit=limit
        )
        
        if not kb_results:
            return ""
        
        # Format knowledge context
        knowledge_context = "\n\n=== CURRENT AWS KNOWLEDGE (December 2025) ===\n"
        knowledge_context += "Use this up-to-date AWS documentation to ensure accuracy:\n\n"
        
        for idx, chunk in enumerate(kb_results, 1):
            knowledge_context += f"[Source {idx}] {chunk['url']}\n"
            knowledge_context += f"{chunk['content'][:800]}\n\n"  # First 800 chars per chunk
        
        return knowledge_context
        
    except Exception as e:
        # Log error but don't fail generation
        print(f"Warning: Failed to fetch knowledge base: {e}")
        return ""


# Aliases for old function names
async def add_documents_to_supabase(
    urls: List[str],
    chunk_numbers: List[int],
    contents: List[str],
    metadatas: List[Dict[str, Any]],
    url_to_full_document: Dict[str, str],
    batch_size: int = 20
) -> None:
    """Alias for add_documents_to_db."""
    return await add_documents_to_db(urls, chunk_numbers, contents, metadatas, url_to_full_document, batch_size)


async def add_code_examples_to_supabase(
    url: str,
    code_blocks: List[Dict[str, Any]],
    source_id: str
) -> None:
    """Alias for add_code_examples_to_db."""
    return await add_code_examples_to_db(url, code_blocks, source_id)
