"""
CloudMigrate Learning Agent
============================
Unified AI agent combining:
- Web crawling and RAG (Crawl4AI)
- AWS services knowledge graph (Neo4j)
- Learning scenario generation (Sophia persona)
- Flashcards, notes, quizzes generation
- Interactive coaching chat

REFACTORED: Core logic moved to modules, this file contains FastAPI endpoints only.
"""
import asyncio
import json
import os
import uuid
import concurrent.futures
from typing import Dict, List, Any, Optional

from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI

from crawl4ai import CrawlerRunConfig, CacheMode

# ============================================
# IMPORTS FROM MODULES
# ============================================

# Config
from config.settings import (
    AVAILABLE_MODELS,
    DEFAULT_MODEL,
    AWS_SERVICES,
    AWS_RELATIONSHIP_PATTERNS,
    DEFAULT_TENANT_ID,
    logger,
)
from config.openai_config import (
    get_tenant_openai_config,
    get_openai_client_for_tenant,
    get_async_openai,
    _tenant_clients,
)

# AWS/Neo4j
from aws.neo4j_graph import (
    validate_neo4j_connection,
    format_neo4j_error,
    extract_aws_services_to_neo4j,
)
from aws.journey_graph import (
    track_learner_scenario_start,
    track_challenge_completion,
    track_flashcard_study,
    track_quiz_attempt,
    get_learner_journey,
    get_recommended_next_steps,
)

# Crawl
from crawl.context import Crawl4AIContext, get_context
from crawl.jobs import create_crawl_job, update_crawl_job, get_crawl_job
from crawl.utils import (
    rerank_results,
    is_sitemap,
    is_txt,
    parse_sitemap,
    smart_chunk_markdown,
    extract_section_info,
)

# Models
from models.learning import (
    CompanyInfo,
    ScenarioChallenge,
    CloudScenario,
    LocationRequest,
    ResearchResult,
    ScenarioResponse,
    GenerateContentRequest,
    LearningChatRequestWithSession,
)
from models.diagram import (
    DiagramNode,
    DiagramConnection,
    AuditDiagramRequest,
    AuditDiagramResponse,
)
from models.challenge import (
    ChallengeQuestionsRequest,
    GradeChallengeAnswerRequest,
)
from models.cli import (
    CLISimulatorRequest,
    CLIHelpRequest,
    CLIValidateRequest,
)
from models.journey import (
    LearningJourneyRequest,
    TrackScenarioRequest,
    TrackChallengeRequest,
    TrackFlashcardRequest,
    TrackQuizRequest,
    GenerateReportRequest,
)
from models.config import (
    UpdateAIConfigRequest,
    SetPersonaRequest,
)
from models.chat import ChatRequest

# Services
from services.deps import AgentDeps, get_agent_deps
from services.openai_service import (
    async_chat_completion,
    async_chat_completion_json,
    detect_skill_level,
)
from services.web_search import search_web
from services.research import research_company

# Utils
from utils import (
    add_documents_to_supabase as add_documents_to_db,
    search_documents,
    extract_code_blocks,
    generate_code_example_summary,
    add_code_examples_to_supabase as add_code_examples_to_db,
    update_source_info,
    extract_source_summary,
    search_code_examples,
    ApiKeyRequiredError,
)

# Redis jobs
from redis_jobs import (
    check_tenant_rate_limit,
    get_tenant_crawl_stats,
    list_tenant_jobs,
)

# Prompts
from agent_prompt import SYSTEM_PROMPT, TOOL_DESCRIPTIONS
from prompts import (
    SOPHIA_PERSONA,
    SKILL_DETECTOR_PROMPT,
    SCENARIO_GENERATOR_PROMPT,
    COACH_CHAT_PROMPT,
    SOLUTION_EVALUATOR_PROMPT,
    RAG_CONTEXT_PROMPT,
    AWS_PERSONAS,
    DEFAULT_PERSONA,
    get_persona_prompt,
    get_persona_info,
    get_persona_context,
    PERSONA_SCENARIO_PROMPT,
    PERSONA_FLASHCARD_PROMPT,
    PERSONA_QUIZ_PROMPT,
    PERSONA_NOTES_PROMPT,
    PERSONA_COACH_PROMPT,
    CERTIFICATION_PERSONAS,
)

# Generators
from generators import (
    generate_scenario,
    generate_flashcards,
    generate_notes,
    generate_quiz,
    generate_challenge_questions,
    grade_challenge_answer,
    simulate_cli_command,
    get_cli_help,
    create_session as create_cli_session,
    validate_cli_challenge,
    get_session_stats as get_cli_session_stats,
)
from generators.scenario import CompanyInfo as GenCompanyInfo

# Database
import db

# ============================================
# FASTAPI APP SETUP
# ============================================

app = FastAPI(title="CloudMigrate Learning Agent", description="AI-powered learning agent for AWS cloud architecture")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(ApiKeyRequiredError)
async def api_key_required_handler(request: Request, exc: ApiKeyRequiredError):
    """Return 402 Payment Required when API key is not configured."""
    return JSONResponse(
        status_code=402,
        content={
            "error": "OpenAI API key required",
            "message": str(exc),
            "action": "configure_api_key",
            "settingsUrl": "/dashboard/settings"
        }
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "crawl4ai-rag"}


# ============================================
# CRAWL ENDPOINTS
# ============================================

def process_code_example(args):
    """Process a single code example to generate its summary."""
    code, context_before, context_after = args
    return generate_code_example_summary(code, context_before, context_after)


@app.post("/api/crawl/single")
async def crawl_single_page(url: str) -> str:
    """Crawl a single web page and store its content."""
    try:
        ctx = await get_context()
        crawler = ctx.crawler
        
        run_config = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, stream=False)
        result = await crawler.arun(url=url, config=run_config)
        
        if not result.success:
            return json.dumps({"success": False, "url": url, "error": result.error_message or "Failed to crawl page"}, indent=2)
        
        markdown = result.markdown
        if not markdown:
            return json.dumps({"success": False, "url": url, "error": "No content extracted from page"}, indent=2)
        
        chunks = smart_chunk_markdown(markdown)
        
        documents = []
        for i, chunk in enumerate(chunks):
            section_info = extract_section_info(chunk)
            documents.append({
                "url": url,
                "chunk_number": i,
                "content": chunk,
                "metadata": {
                    "title": result.metadata.get("title", ""),
                    "headers": section_info["headers"],
                    "char_count": section_info["char_count"],
                    "word_count": section_info["word_count"],
                }
            })
        
        await add_documents_to_db(documents)
        
        neo4j_result = {"extracted": 0, "relationships": 0}
        if ctx.neo4j_driver:
            neo4j_result = await extract_aws_services_to_neo4j(
                content=markdown,
                source_url=url,
                neo4j_driver=ctx.neo4j_driver
            )
        
        return json.dumps({"success": True, "url": url, "chunks_stored": len(documents), "aws_services": neo4j_result}, indent=2)
        
    except Exception as e:
        logger.error(f"Crawl single page error: {e}")
        return json.dumps({"success": False, "url": url, "error": str(e)}, indent=2)


async def _execute_crawl_job(job_id: str, url: str, max_depth: int, max_concurrent: int, chunk_size: int, tenant_id: str = None):
    """Execute a crawl job in the background."""
    try:
        await update_crawl_job(job_id, "running")
        ctx = await get_context()
        crawler = ctx.crawler
        
        all_documents = []
        all_code_examples = []
        crawled_urls = set()
        
        # Determine crawl strategy based on URL type
        if is_sitemap(url):
            urls_to_crawl = parse_sitemap(url)
            logger.info(f"Sitemap found with {len(urls_to_crawl)} URLs")
        elif is_txt(url):
            # Assume it's a list of URLs
            import requests
            resp = requests.get(url)
            urls_to_crawl = [u.strip() for u in resp.text.split('\n') if u.strip()]
        else:
            urls_to_crawl = [url]
        
        # Crawl URLs
        run_config = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, stream=False)
        
        for crawl_url in urls_to_crawl[:100]:  # Limit to 100 URLs
            if crawl_url in crawled_urls:
                continue
            
            try:
                result = await crawler.arun(url=crawl_url, config=run_config)
                if result.success and result.markdown:
                    crawled_urls.add(crawl_url)
                    
                    chunks = smart_chunk_markdown(result.markdown, chunk_size)
                    for i, chunk in enumerate(chunks):
                        section_info = extract_section_info(chunk)
                        all_documents.append({
                            "url": crawl_url,
                            "chunk_number": i,
                            "content": chunk,
                            "metadata": {
                                "title": result.metadata.get("title", ""),
                                "headers": section_info["headers"],
                            }
                        })
                    
                    # Extract code examples
                    code_blocks = extract_code_blocks(result.markdown)
                    for code in code_blocks:
                        all_code_examples.append({
                            "url": crawl_url,
                            "code": code["code"],
                            "language": code.get("language", ""),
                        })
                    
                    # Extract AWS services to Neo4j
                    if ctx.neo4j_driver:
                        await extract_aws_services_to_neo4j(
                            content=result.markdown,
                            source_url=crawl_url,
                            neo4j_driver=ctx.neo4j_driver,
                            tenant_id=tenant_id
                        )
            except Exception as e:
                logger.warning(f"Failed to crawl {crawl_url}: {e}")
        
        # Store documents
        if all_documents:
            await add_documents_to_db(all_documents)
        
        # Generate code summaries and store
        if all_code_examples:
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
                args_list = [(ex["code"], "", "") for ex in all_code_examples]
                summaries = list(executor.map(process_code_example, args_list))
                for i, summary in enumerate(summaries):
                    all_code_examples[i]["summary"] = summary
            await add_code_examples_to_db(all_code_examples)
        
        await update_crawl_job(job_id, "completed", result={
            "urls_crawled": len(crawled_urls),
            "documents_stored": len(all_documents),
            "code_examples": len(all_code_examples),
        })
        
    except Exception as e:
        logger.error(f"Crawl job {job_id} failed: {e}")
        await update_crawl_job(job_id, "failed", error=str(e))


@app.post("/api/crawl/smart")
async def smart_crawl_url(
    background_tasks: BackgroundTasks,
    url: str,
    tenant_id: str = None,
    max_depth: int = 2,
    max_concurrent: int = 5,
    chunk_size: int = 5000,
):
    """Smart crawl that handles sitemaps, URL lists, and recursive crawling."""
    tenant_id = tenant_id or DEFAULT_TENANT_ID
    
    # Check rate limit
    allowed, message = await check_tenant_rate_limit(tenant_id)
    if not allowed:
        return {"success": False, "error": message}
    
    # Create job
    job = await create_crawl_job(url, tenant_id, {
        "max_depth": max_depth,
        "max_concurrent": max_concurrent,
        "chunk_size": chunk_size,
    })
    
    if not job.get("success", True):
        return job
    
    job_id = job["job_id"]
    
    # Start background task
    background_tasks.add_task(_execute_crawl_job, job_id, url, max_depth, max_concurrent, chunk_size, tenant_id)
    
    return {
        "success": True,
        "job_id": job_id,
        "status": "queued",
        "message": f"Crawl job started for {url}",
    }


@app.get("/api/crawl/status/{job_id}")
async def get_crawl_status(job_id: str):
    """Get the status of a crawl job."""
    job = await get_crawl_job(job_id)
    if not job:
        return {"success": False, "error": "Job not found"}
    return {"success": True, **job}


@app.get("/api/crawl/jobs")
async def list_crawl_jobs_endpoint(tenant_id: str = None):
    """List all crawl jobs for a tenant."""
    tenant_id = tenant_id or DEFAULT_TENANT_ID
    jobs = await list_tenant_jobs(tenant_id)
    return {"success": True, "tenant_id": tenant_id, "jobs": jobs, "count": len(jobs)}


@app.get("/api/crawl/stats")
async def get_crawl_stats(tenant_id: str = None):
    """Get crawl statistics for a tenant."""
    tenant_id = tenant_id or DEFAULT_TENANT_ID
    stats = await get_tenant_crawl_stats(tenant_id)
    return {"success": True, "tenant_id": tenant_id, **stats}


# ============================================
# RAG/SEARCH ENDPOINTS
# ============================================

@app.get("/api/sources")
async def get_available_sources(tenant_id: str = None) -> str:
    """Get list of available sources for RAG queries."""
    try:
        sources = await db.get_available_sources(tenant_id)
        return json.dumps({"success": True, "sources": sources}, indent=2)
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)}, indent=2)


@app.post("/api/search")
async def perform_rag_query(query: str, source: str = None, match_count: int = 5) -> str:
    """Perform RAG query against stored documents."""
    try:
        ctx = await get_context()
        
        # Search documents
        results = await search_documents(query, source=source, match_count=match_count * 2)
        
        # Rerank if model available
        if ctx.reranking_model and results:
            results = rerank_results(ctx.reranking_model, query, results)
        
        # Limit to requested count
        results = results[:match_count]
        
        return json.dumps({
            "success": True,
            "query": query,
            "results": results,
            "count": len(results),
        }, indent=2)
        
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)}, indent=2)


# ============================================
# CHAT/RAG AGENT ENDPOINT
# ============================================

async def execute_tool(tool_name: str, tool_args: dict) -> str:
    """Execute a tool and return the result."""
    try:
        if tool_name == "search_knowledge_base":
            return await perform_rag_query(
                query=tool_args.get("query", ""),
                source=tool_args.get("source"),
                match_count=tool_args.get("match_count", 5)
            )
        elif tool_name == "search_code_examples":
            results = await search_code_examples(
                query=tool_args.get("query", ""),
                language=tool_args.get("language"),
                match_count=tool_args.get("match_count", 5)
            )
            return json.dumps({"success": True, "results": results}, indent=2)
        elif tool_name == "list_aws_services":
            return await list_aws_services(
                category=tool_args.get("category"),
                tenant_id=tool_args.get("tenant_id")
            )
        elif tool_name == "get_aws_service":
            return await get_aws_service(
                service_name=tool_args.get("service_name", ""),
                tenant_id=tool_args.get("tenant_id")
            )
        elif tool_name == "get_aws_architecture":
            return await get_aws_architecture(
                use_case=tool_args.get("use_case", ""),
                tenant_id=tool_args.get("tenant_id")
            )
        else:
            return json.dumps({"error": f"Unknown tool: {tool_name}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Chat with the RAG agent."""
    from utils import get_request_api_key, get_request_model
    
    try:
        api_key = get_request_api_key()
        if not api_key:
            raise ApiKeyRequiredError("OpenAI API key required")
        
        client = AsyncOpenAI(api_key=api_key)
        model = get_request_model() or DEFAULT_MODEL
        
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        if request.conversation_history:
            messages.extend(request.conversation_history)
        
        messages.append({"role": "user", "content": request.message})
        
        # First call - may request tools
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            tools=TOOL_DESCRIPTIONS,
            tool_choice="auto",
        )
        
        assistant_message = response.choices[0].message
        
        # Handle tool calls
        if assistant_message.tool_calls:
            messages.append(assistant_message)
            
            for tool_call in assistant_message.tool_calls:
                tool_name = tool_call.function.name
                tool_args = json.loads(tool_call.function.arguments)
                
                tool_result = await execute_tool(tool_name, tool_args)
                
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_result,
                })
            
            # Second call with tool results
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
            )
            assistant_message = response.choices[0].message
        
        return {
            "response": assistant_message.content,
            "model": model,
        }
        
    except ApiKeyRequiredError:
        raise
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# AWS KNOWLEDGE GRAPH ENDPOINTS
# ============================================

@app.get("/api/aws/services")
async def list_aws_services(category: str = None, tenant_id: str = None) -> str:
    """List all AWS services in the knowledge graph."""
    try:
        ctx = await get_context()
        tenant_id = tenant_id or DEFAULT_TENANT_ID
        
        if not ctx.neo4j_driver:
            return json.dumps({"success": False, "error": "AWS Services graph not available"}, indent=2)
        
        async with ctx.neo4j_driver.session() as session:
            if category:
                query = """
                MATCH (s:AWSService {category: $category, tenant_id: $tenant_id})
                RETURN s.name as name, s.category as category, s.description as description
                ORDER BY s.name
                """
                result = await session.run(query, category=category, tenant_id=tenant_id)
            else:
                query = """
                MATCH (s:AWSService {tenant_id: $tenant_id})
                RETURN s.name as name, s.category as category, s.description as description
                ORDER BY s.category, s.name
                """
                result = await session.run(query, tenant_id=tenant_id)
            
            services = [{"name": r["name"], "category": r["category"], "description": r["description"]} async for r in result]
            
            cat_result = await session.run(
                "MATCH (s:AWSService {tenant_id: $tenant_id}) RETURN DISTINCT s.category as category ORDER BY category",
                tenant_id=tenant_id
            )
            categories = [r["category"] async for r in cat_result]
            
            return json.dumps({"success": True, "services": services, "count": len(services), "categories": categories}, indent=2)
            
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)}, indent=2)


@app.get("/api/aws/service/{service_name}")
async def get_aws_service(service_name: str, tenant_id: str = None) -> str:
    """Get details for a specific AWS service."""
    try:
        ctx = await get_context()
        tenant_id = tenant_id or DEFAULT_TENANT_ID
        
        if not ctx.neo4j_driver:
            return json.dumps({"success": False, "error": "AWS Services graph not available"}, indent=2)
        
        async with ctx.neo4j_driver.session() as session:
            query = """
            MATCH (s:AWSService {tenant_id: $tenant_id})
            WHERE toLower(s.name) = toLower($name)
            RETURN s.name as name, s.category as category, s.description as description
            """
            result = await session.run(query, name=service_name, tenant_id=tenant_id)
            record = await result.single()
            
            if not record:
                return json.dumps({"success": False, "error": f"Service '{service_name}' not found"}, indent=2)
            
            service = {"name": record["name"], "category": record["category"], "description": record["description"]}
            
            # Get relationships
            rel_query = """
            MATCH (s:AWSService {tenant_id: $tenant_id})-[r]-(other:AWSService {tenant_id: $tenant_id})
            WHERE toLower(s.name) = toLower($name)
            RETURN type(r) as relationship, other.name as service
            """
            rel_result = await session.run(rel_query, name=service_name, tenant_id=tenant_id)
            relationships = [{"type": r["relationship"], "service": r["service"]} async for r in rel_result]
            
            return json.dumps({"success": True, "service": service, "relationships": relationships}, indent=2)
            
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)}, indent=2)


@app.post("/api/aws/architecture")
async def get_aws_architecture(use_case: str, tenant_id: str = None) -> str:
    """Get recommended AWS architecture for a use case."""
    try:
        ctx = await get_context()
        tenant_id = tenant_id or DEFAULT_TENANT_ID
        
        if not ctx.neo4j_driver:
            return json.dumps({"success": False, "error": "AWS Services graph not available"}, indent=2)
        
        async with ctx.neo4j_driver.session() as session:
            query = """
            MATCH (s:AWSService {tenant_id: $tenant_id})
            WHERE toLower(s.description) CONTAINS toLower($use_case)
               OR toLower(s.name) CONTAINS toLower($use_case)
            RETURN s.name as name, s.category as category, s.description as description
            ORDER BY s.category
            """
            result = await session.run(query, use_case=use_case, tenant_id=tenant_id)
            services = [{"name": r["name"], "category": r["category"], "description": r["description"]} async for r in result]
            
            return json.dumps({"success": True, "use_case": use_case, "recommended_services": services}, indent=2)
            
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)}, indent=2)


@app.post("/api/aws/query")
async def query_aws_graph(cypher: str, tenant_id: str = None) -> str:
    """Execute a custom Cypher query."""
    try:
        ctx = await get_context()
        tenant_id = tenant_id or DEFAULT_TENANT_ID
        
        if not ctx.neo4j_driver:
            return json.dumps({"success": False, "error": "AWS Services graph not available"}, indent=2)
        
        async with ctx.neo4j_driver.session() as session:
            result = await session.run(cypher, tenant_id=tenant_id)
            records = [dict(r) async for r in result][:50]
            
            return json.dumps({"success": True, "results": records, "count": len(records)}, indent=2)
            
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)}, indent=2)


# ============================================
# LEARNING ENDPOINTS
# ============================================

@app.get("/api/learning/certifications")
async def list_certifications():
    """List available AWS certifications."""
    certs = []
    for code, persona in CERTIFICATION_PERSONAS.items():
        certs.append({
            "code": code,
            "name": persona["cert"],
            "level": persona["level"],
            "focus": persona["focus"],
        })
    
    level_order = {"foundational": 0, "associate": 1, "professional": 2, "specialty": 3}
    certs.sort(key=lambda x: (level_order.get(x["level"], 99), x["name"]))
    
    return {"certifications": certs}


@app.post("/api/learning/research", response_model=ResearchResult)
async def research_endpoint(request: LocationRequest):
    """Research a company."""
    try:
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        result = await research_company(request.company_name, request.industry)
        return result
    except Exception as e:
        logger.error(f"Research error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@app.post("/api/learning/generate-scenario-stream")
async def generate_scenario_stream_endpoint(request: LocationRequest):
    """Generate scenario with SSE streaming for real-time progress updates"""

    async def event_stream():
        from utils import set_request_api_key, set_request_model, get_request_api_key
        from generators.scenario import generate_scenario as gen_scenario, CompanyInfo as GenCompanyInfo
        from prompts import CERTIFICATION_PERSONAS

        try:
            # Set request-scoped API key
            if request.openai_api_key:
                set_request_api_key(request.openai_api_key)
            if request.preferred_model:
                set_request_model(request.preferred_model)

            # Step 1: Starting
            yield f"data: {json.dumps({'type': 'status', 'message': '🚀 Starting scenario generation...', 'step': 1, 'total_steps': 5})}\n\n"
            await asyncio.sleep(0.1)

            # Step 2: Research
            yield f"data: {json.dumps({'type': 'status', 'message': f'🔍 Researching {request.company_name}...', 'step': 2, 'total_steps': 5})}\n\n"

            # Perform web search
            queries = [
                f"{request.company_name} company overview business",
                f"{request.company_name} technology infrastructure cloud",
            ]
            if request.industry:
                queries.append(f"{request.company_name} {request.industry} industry")

            all_sources = []
            for query in queries:
                yield f"data: {json.dumps({'type': 'search', 'message': f'🌐 Searching: {query}'})}\n\n"
                results = await search_web(query, max_results=3)
                for r in results:
                    if r.get("url"):
                        all_sources.append(r["url"])
                        yield f"data: {json.dumps({'type': 'source', 'url': r['url'], 'title': r.get('title', 'Source')})}\n\n"
                await asyncio.sleep(0.1)

            # Step 3: Analyzing
            yield f"data: {json.dumps({'type': 'status', 'message': '🧠 Analyzing company information...', 'step': 3, 'total_steps': 5})}\n\n"

            research = await research_company(
                company_name=request.company_name,
                industry=request.industry
            )

            yield f"data: {json.dumps({'type': 'research', 'company': research.company_info.model_dump(), 'sources': list(set(all_sources))[:5]})}\n\n"

            # Step 3.5: Search AWS knowledge base for relevant content
            yield f"data: {json.dumps({'type': 'status', 'message': '📚 Searching AWS knowledge base...', 'step': 3, 'total_steps': 6})}\n\n"

            knowledge_context = ""
            knowledge_topics = []
            try:
                import random as kb_random
                from openai import AsyncOpenAI

                skill_keywords = {
                    "beginner": "basics fundamentals getting started",
                    "intermediate": "best practices configuration",
                    "advanced": "optimization multi-region high availability",
                    "expert": "enterprise scale architecture patterns",
                }
                skill_context = skill_keywords.get(request.user_level, "best practices")

                if request.cert_code and request.cert_code in CERTIFICATION_PERSONAS:
                    cert_focus = CERTIFICATION_PERSONAS[request.cert_code]["focus"]
                    selected_focus = kb_random.sample(cert_focus, min(3, len(cert_focus)))
                    kb_query = f"{' '.join(selected_focus)} {skill_context} AWS {research.company_info.industry}"
                    focus_str = ", ".join(selected_focus)
                    yield f"data: {json.dumps({'type': 'status', 'message': f'🎲 Focus: {focus_str} ({request.user_level})'})}\n\n"
                else:
                    kb_query = f"{research.company_info.industry} {skill_context} AWS architecture"

                client = AsyncOpenAI(api_key=get_request_api_key())
                embed_response = await client.embeddings.create(
                    model="text-embedding-3-small",
                    input=kb_query
                )
                query_embedding = embed_response.data[0].embedding

                kb_results = await db.search_knowledge_chunks(
                    query_embedding=query_embedding,
                    limit=5
                )

                if kb_results:
                    yield f"data: {json.dumps({'type': 'status', 'message': f'📖 Found {len(kb_results)} relevant AWS knowledge chunks'})}\n\n"
                    for chunk in kb_results:
                        yield f"data: {json.dumps({'type': 'knowledge', 'url': chunk['url'], 'similarity': round(chunk['similarity'], 2)})}\n\n"
                        knowledge_context += f"\n\nAWS Knowledge ({chunk['url']}):\n{chunk['content'][:500]}"
                        chunk_content = chunk['content'].lower()
                        for svc in ['s3', 'ec2', 'lambda', 'rds', 'dynamodb', 'cloudwatch', 'iam', 'vpc', 'cloudfront', 'sns', 'sqs', 'kms', 'cloudtrail', 'config']:
                            if svc in chunk_content and svc.upper() not in knowledge_topics:
                                knowledge_topics.append(svc.upper())

                    if knowledge_topics:
                        knowledge_context += f"\n\n⚡ IMPORTANT: Base your challenge titles on these specific AWS topics found: {', '.join(knowledge_topics[:5])}. Create action-oriented titles like 'Secure the S3 Buckets' or 'Configure CloudWatch Alarms' - NOT generic titles like 'Understanding X'."
                else:
                    yield f"data: {json.dumps({'type': 'status', 'message': '📖 No specific knowledge chunks found, using general AWS knowledge'})}\n\n"
            except Exception as kb_err:
                logger.warning(f"Knowledge base search failed: {kb_err}")
                yield f"data: {json.dumps({'type': 'status', 'message': '⚠️ Knowledge base search skipped'})}\n\n"

            # Step 4: Building persona
            persona_context = None
            if request.cert_code and request.cert_code in CERTIFICATION_PERSONAS:
                persona = CERTIFICATION_PERSONAS[request.cert_code]
                persona_context = {
                    "cert_code": request.cert_code,
                    "cert_name": persona["cert"],
                    "level": persona["level"],
                    "focus_areas": ", ".join(persona["focus"]),
                    "style": persona["style"],
                }
                cert_name = persona["cert"]
                yield f"data: {json.dumps({'type': 'status', 'message': f'🎯 Applying {cert_name} certification focus...', 'step': 4, 'total_steps': 5})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'status', 'message': '🎯 Building general cloud scenario...', 'step': 4, 'total_steps': 5})}\n\n"

            await asyncio.sleep(0.1)

            # Step 5: Generating scenario
            yield f"data: {json.dumps({'type': 'status', 'message': '⚡ Generating challenges and learning objectives...', 'step': 5, 'total_steps': 5})}\n\n"

            company_info = GenCompanyInfo(
                name=research.company_info.name,
                industry=research.company_info.industry,
                description=research.company_info.description,
                key_services=research.company_info.key_services,
                technology_stack=research.company_info.technology_stack,
                compliance_requirements=research.company_info.compliance_requirements,
                data_types=research.company_info.data_types,
                employee_count=research.company_info.employee_count,
            )

            scenario = await gen_scenario(
                company_info=company_info,
                user_level=request.user_level,
                persona_context=persona_context,
                knowledge_context=knowledge_context if knowledge_context else None,
            )

            # Save to database if place_id provided
            if request.place_id:
                try:
                    await db.save_scenario(
                        location_id=request.place_id,
                        scenario_data=scenario.model_dump(),
                        company_info=research.company_info.model_dump(),
                    )
                except Exception as db_err:
                    logger.warning(f"Failed to save scenario to DB: {db_err}")

            # Final result
            yield f"data: {json.dumps({'type': 'complete', 'scenario': scenario.model_dump(), 'company_info': research.company_info.model_dump(), 'cert_code': request.cert_code, 'cert_name': persona_context['cert_name'] if persona_context else None})}\n\n"

        except Exception as e:
            logger.error(f"Stream generation error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            set_request_api_key(None)
            set_request_model(None)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@app.post("/api/learning/generate-scenario", response_model=ScenarioResponse)
async def generate_scenario_endpoint(request: LocationRequest):
    """Generate a training scenario."""
    try:
        from utils import set_request_api_key, set_request_model
        
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        research = await research_company(request.company_name, request.industry)
        
        company_info = GenCompanyInfo(
            name=research.company_info.name,
            industry=research.company_info.industry,
            description=research.company_info.description,
            key_services=research.company_info.key_services,
            technology_stack=research.company_info.technology_stack,
            compliance_requirements=research.company_info.compliance_requirements,
            data_types=research.company_info.data_types,
            employee_count=research.company_info.employee_count,
        )
        
        persona_context = None
        if request.cert_code and request.cert_code in CERTIFICATION_PERSONAS:
            persona = CERTIFICATION_PERSONAS[request.cert_code]
            persona_context = {
                "cert_code": request.cert_code,
                "cert_name": persona["cert"],
                "level": persona["level"],
                "focus_areas": ", ".join(persona["focus"]),
                "style": persona["style"],
            }
        
        scenario = await generate_scenario(
            company_info=company_info,
            user_level=request.user_level,
            persona_context=persona_context,
        )
        
        if request.place_id:
            try:
                await db.save_scenario(
                    location_id=request.place_id,
                    scenario_data=scenario.model_dump(),
                    company_info=research.company_info.model_dump(),
                )
            except Exception as db_err:
                logger.warning(f"Failed to save scenario: {db_err}")
        
        return ScenarioResponse(
            success=True,
            scenario=scenario,
            company_info=research.company_info,
            cert_code=request.cert_code,
            cert_name=persona_context["cert_name"] if persona_context else None,
        )
    except Exception as e:
        logger.error(f"Scenario generation error: {e}")
        return ScenarioResponse(success=False, error=str(e))
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


# Continue in next part due to size...
# The remaining endpoints follow the same pattern - import from modules, thin endpoint handlers

# ============================================
# CHAT TOOLS FOR FUNCTION CALLING
# ============================================

CHAT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_documentation",
            "description": TOOL_DESCRIPTIONS["search_documentation"],
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query"},
                    "source": {"type": "string", "description": "Optional: filter by source domain"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_sources",
            "description": TOOL_DESCRIPTIONS["get_sources"],
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_aws_services",
            "description": TOOL_DESCRIPTIONS["get_aws_services"],
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "description": "Optional: filter by category"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_aws_service_details",
            "description": TOOL_DESCRIPTIONS["get_aws_service_details"],
            "parameters": {
                "type": "object",
                "properties": {
                    "service_name": {"type": "string", "description": "The AWS service name"}
                },
                "required": ["service_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_aws_architecture",
            "description": TOOL_DESCRIPTIONS["get_aws_architecture"],
            "parameters": {
                "type": "object",
                "properties": {
                    "use_case": {"type": "string", "description": "Description of what you want to build"}
                },
                "required": ["use_case"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_flashcards",
            "description": TOOL_DESCRIPTIONS["generate_flashcards"],
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string", "description": "Topic for flashcards"},
                    "card_count": {"type": "integer", "description": "Number of flashcards"}
                },
                "required": ["topic"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_quiz",
            "description": TOOL_DESCRIPTIONS["generate_quiz"],
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string", "description": "Topic for the quiz"},
                    "question_count": {"type": "integer", "description": "Number of questions"},
                    "difficulty": {"type": "string", "description": "Difficulty level"}
                },
                "required": ["topic"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_study_notes",
            "description": "Generate comprehensive study notes on an AWS topic.",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string", "description": "Topic for study notes"}
                },
                "required": ["topic"]
            }
        }
    },
]


# ============================================
# COACHING RESPONSE (BIG FUNCTION)
# ============================================

from openai import OpenAI

async def get_coaching_response(
    message: str,
    scenario: Optional[CloudScenario] = None,
    challenge_id: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None
) -> dict:
    """Get a coaching response with dynamic persona switching."""
    from agent_prompt import SYSTEM_PROMPT as BASE_AGENT_PROMPT
    
    CERT_TO_PERSONA = {
        "CLF": "cloud-practitioner", "SAA": "solutions-architect-associate",
        "DVA": "developer-associate", "SOA": "sysops-associate",
        "SAP": "solutions-architect-professional", "DOP": "devops-professional",
        "ANS": "networking-specialty", "DAS": "data-analytics-specialty",
        "SCS": "security-specialty", "MLS": "machine-learning-specialty",
        "DBS": "database-specialty", "PAS": "sap-specialty",
    }
    
    target_cert = context.get("target_certification") if context else None
    persona_id = CERT_TO_PERSONA.get(target_cert, "solutions-architect-associate")
    persona_prompt = get_persona_prompt(persona_id)
    persona_info = get_persona_info(persona_id)
    persona_name = persona_info['name']
    
    # Build learner context
    context_parts = []
    if context:
        learner_parts = []
        if context.get("user_name"):
            learner_parts.append(f"Name: {context['user_name']}")
        if context.get("skill_level"):
            learner_parts.append(f"Skill Level: {context['skill_level']}")
        if context.get("target_certification"):
            learner_parts.append(f"Studying for: {context['target_certification']}")
        
        stats = context.get("stats", {})
        if stats:
            learner_parts.append(f"Level {stats.get('level', 1)} | {stats.get('total_points', 0)} points")
        
        practiced = context.get("practiced_services", [])
        if practiced:
            learner_parts.append(f"AWS services practiced: {', '.join(practiced[:10])}")
        
        if learner_parts:
            context_parts.append("LEARNER PROFILE:\n" + "\n".join(learner_parts))
    
    if scenario:
        context_parts.append(f"\nCURRENT SCENARIO: {scenario.scenario_title}")
        context_parts.append(f"Company: {scenario.company_name}")
        context_parts.append(f"Business Context: {scenario.business_context}")
        
        if challenge_id:
            challenge = next((c for c in scenario.challenges if c.id == challenge_id), None)
            if challenge:
                context_parts.append(f"\nCurrent Challenge: {challenge.title}")
                context_parts.append(f"Success Criteria: {', '.join(challenge.success_criteria)}")
    
    learner_context = "\n".join(context_parts) if context_parts else ""
    
    system_prompt = f"""## YOUR PERSONA FOR THIS SESSION
You are {persona_name}, an AWS learning coach specializing in the {persona_info['cert']}.

YOUR IDENTITY:
- Your name is {persona_name}
- You specialize in: {', '.join(persona_info['focus'])}
- Your coaching style: {persona_info['style']}

{persona_prompt}

## BASE AGENT CAPABILITIES & TOOLS
{BASE_AGENT_PROMPT}

## CURRENT LEARNER CONTEXT
{learner_context}

## INSTRUCTIONS
- Use your tools when they would help the learner
- Adapt your responses to the learner's skill level
- Be {persona_name} - stay in character"""

    try:
        from utils import get_request_model, get_request_api_key
        model = get_request_model()
        api_key = get_request_api_key()
        
        if not api_key:
            return {"response": "API key not configured. Please add your OpenAI API key in Settings.", "key_terms": []}
        
        client = OpenAI(api_key=api_key)
        messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": message}]
        
        response = client.chat.completions.create(
            model=model, messages=messages, tools=CHAT_TOOLS, tool_choice="auto",
            temperature=0.7, max_tokens=2000
        )
        
        assistant_message = response.choices[0].message
        tools_used = []
        
        while assistant_message.tool_calls:
            tool_results = []
            for tool_call in assistant_message.tool_calls:
                tool_name = tool_call.function.name
                tool_args = json.loads(tool_call.function.arguments)
                result = await execute_tool(tool_name, tool_args)
                tools_used.append({"tool": tool_name, "args": tool_args})
                tool_results.append({"tool_call_id": tool_call.id, "role": "tool", "content": result})
            
            messages.append({
                "role": "assistant", "content": assistant_message.content,
                "tool_calls": [{"id": tc.id, "type": "function", "function": {"name": tc.function.name, "arguments": tc.function.arguments}} for tc in assistant_message.tool_calls]
            })
            messages.extend(tool_results)
            
            response = client.chat.completions.create(
                model=model, messages=messages, tools=CHAT_TOOLS, tool_choice="auto",
                temperature=0.7, max_tokens=2000
            )
            assistant_message = response.choices[0].message
        
        final_content = assistant_message.content or "I apologize, but I couldn't generate a response."
        
        # Extract key terms
        key_terms = []
        try:
            extraction_response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "Extract 3-8 key AWS services or technical concepts. Return JSON array: [{\"term\": \"name\", \"category\": \"category\"}]."},
                    {"role": "user", "content": final_content[:1500]}
                ],
                temperature=0.3, max_tokens=500
            )
            key_terms = json.loads(extraction_response.choices[0].message.content)
        except:
            pass
        
        return {"response": final_content, "key_terms": key_terms, "tools_used": tools_used}
            
    except Exception as e:
        logger.error(f"Coach response failed: {e}")
        return {"response": "I'm having trouble processing that. Could you rephrase?", "key_terms": [], "tools_used": []}


# ============================================
# LEARNING CHAT ENDPOINT
# ============================================

@app.post("/api/learning/chat")
async def learning_chat_endpoint(request: LearningChatRequestWithSession):
    """Interactive coaching chat with Sophia"""
    try:
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        session_id = request.session_id
        if not session_id:
            session_id = str(uuid.uuid4())
            try:
                await db.create_coaching_session(session_id=session_id, scenario_id=request.scenario_id, user_id=request.user_id)
            except Exception as db_err:
                logger.warning(f"Failed to create session: {db_err}")
        
        scenario = None
        if request.scenario_id:
            scenario_data = await db.get_scenario(request.scenario_id)
            if scenario_data:
                scenario = CloudScenario(**scenario_data)
        
        try:
            await db.save_coaching_message(session_id=session_id, role="user", content=request.message,
                metadata={"challenge_id": request.challenge_id} if request.challenge_id else None)
        except:
            pass
        
        result = await get_coaching_response(
            message=request.message, scenario=scenario,
            challenge_id=request.challenge_id, context=request.context
        )
        
        response_text = result.get("response", "") if isinstance(result, dict) else result
        key_terms = result.get("key_terms", []) if isinstance(result, dict) else []
        tools_used = result.get("tools_used", []) if isinstance(result, dict) else []
        
        try:
            await db.save_coaching_message(session_id=session_id, role="assistant", content=response_text,
                metadata={"tools_used": tools_used} if tools_used else None)
        except:
            pass
        
        return {
            "response": response_text, "key_terms": key_terms, "tools_used": tools_used,
            "session_id": session_id, "scenario_id": request.scenario_id, "challenge_id": request.challenge_id
        }
    except Exception as e:
        logger.error(f"Learning chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@app.get("/api/learning/chat/history/{session_id}")
async def get_chat_history(session_id: str, limit: int = 50):
    """Get chat history for a session"""
    try:
        messages = await db.get_session_history(session_id, limit=limit)
        return {"session_id": session_id, "messages": messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/learning/evaluate-solution")
async def evaluate_solution_endpoint(scenario_id: str, challenge_id: str, solution: Dict[str, Any]):
    """Evaluate a user's solution"""
    from utils import get_request_model
    scenario = await db.get_scenario(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    challenge = next((c for c in scenario.get("challenges", []) if c["id"] == challenge_id), None)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    system_prompt = f"""{SOLUTION_EVALUATOR_PROMPT.format(
        challenge_title=challenge["title"], challenge_description=challenge["description"],
        success_criteria=", ".join(challenge.get("success_criteria", [])),
        aws_services=", ".join(challenge.get("aws_services_relevant", [])),
        solution=json.dumps(solution),
    )}
Return JSON with: score (0-100), passed (boolean), strengths (list), improvements (list), feedback (string)"""
    
    result = await async_chat_completion_json(
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": "Evaluate this solution."}],
        model=get_request_model(),
    )
    
    return {"score": result.get("score", 0), "feedback": result.get("feedback", ""), "passed": result.get("passed", False),
            "strengths": result.get("strengths", []), "improvements": result.get("improvements", [])}


# ============================================
# DIAGRAM AUDIT
# ============================================

DIAGRAM_AUDIT_PROMPT = """You are Sophia, an expert AWS Solutions Architect coaching a learner on their architecture diagram.

## Challenge Context
Title: {challenge_title}
Brief: {challenge_brief}
Expected AWS Services: {expected_services}

## User's Architecture Diagram
```json
{diagram_json}
```

## ⚠️ ABSOLUTE RULE: NEVER GIVE AWAY THE ANSWER ⚠️
You are a COACH helping someone LEARN, not a cheat sheet giving answers.

**REQUIRED - Always use these coaching patterns:**
- ✅ Ask "What happens if...?" questions
- ✅ Describe the PROBLEM or RISK, never the solution
- ✅ Hint at concepts: "Think about high availability..." not "Add redundancy"

## Response Format
Return ONLY valid JSON:
{{"score": <0-100>, "correct": ["what they got right"], "missing": ["describe RISK not solution"], "suggestions": ["discovery questions"], "feedback": "encouraging message"}}"""


@app.post("/api/learning/audit-diagram", response_model=AuditDiagramResponse)
async def audit_diagram_endpoint(request: AuditDiagramRequest):
    """Audit a user's AWS architecture diagram"""
    try:
        from utils import set_request_api_key, set_request_model, get_request_api_key, get_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        nodes_by_id = {n.id: n for n in request.nodes}
        
        def build_node_data(node):
            data = {"id": node.id, "type": node.type, "label": node.label}
            if node.config:
                data["config"] = node.config
            if node.parent_id:
                data["inside"] = node.parent_id
            return data
        
        hierarchy = {}
        for node in request.nodes:
            if not node.parent_id:
                if node.id not in hierarchy:
                    hierarchy[node.id] = {"node": build_node_data(node), "children": []}
            else:
                if node.parent_id not in hierarchy:
                    parent = nodes_by_id.get(node.parent_id)
                    if parent:
                        hierarchy[node.parent_id] = {"node": build_node_data(parent), "children": []}
                if node.parent_id in hierarchy:
                    hierarchy[node.parent_id]["children"].append(build_node_data(node))
        
        diagram_data = {
            "architecture_hierarchy": [{**h["node"], "contains": h["children"] if h["children"] else None} for h in hierarchy.values()],
            "all_nodes": [build_node_data(n) for n in request.nodes],
            "connections": [{"from": c.from_node, "to": c.to_node} for c in request.connections]
        }
        
        system_prompt = DIAGRAM_AUDIT_PROMPT.format(
            challenge_title=request.challenge_title or "AWS Architecture Challenge",
            challenge_brief=request.challenge_brief or "Design a secure, scalable AWS architecture.",
            expected_services=", ".join(request.expected_services) if request.expected_services else "Not specified",
            diagram_json=json.dumps(diagram_data, indent=2),
        )
        
        api_key = get_request_api_key()
        if not api_key:
            raise HTTPException(status_code=402, detail="OpenAI API key required")
        
        client = AsyncOpenAI(api_key=api_key)
        response = await client.chat.completions.create(
            model=get_request_model() or "gpt-4o",
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": "Audit this diagram."}],
            response_format={"type": "json_object"}, temperature=0.3,
        )
        
        result = json.loads(response.choices[0].message.content)
        return AuditDiagramResponse(
            score=result.get("score", 50), correct=result.get("correct", []),
            missing=result.get("missing", []), suggestions=result.get("suggestions", []),
            feedback=result.get("feedback", ""), session_id=request.session_id,
        )
    except Exception as e:
        logger.error(f"Diagram audit error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


# ============================================
# CHALLENGE QUESTIONS ENDPOINTS
# ============================================

@app.post("/api/learning/challenge-questions")
async def generate_challenge_questions_endpoint(request: ChallengeQuestionsRequest):
    """Generate questions for a challenge"""
    try:
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        result = await generate_challenge_questions(
            challenge=request.challenge, company_name=request.company_name,
            industry=request.industry, business_context=request.business_context,
            user_level=request.user_level, cert_code=request.cert_code,
            question_count=request.question_count,
        )
        
        return {
            "success": True, "challenge_id": result.challenge_id, "challenge_title": result.challenge_title,
            "brief": result.brief, "questions": [q.model_dump() for q in result.questions],
            "total_points": result.total_points, "estimated_time_minutes": result.estimated_time_minutes,
        }
    except Exception as e:
        logger.error(f"Challenge questions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@app.post("/api/learning/grade-challenge-answer")
async def grade_challenge_answer_endpoint(request: GradeChallengeAnswerRequest):
    """Grade a challenge answer"""
    from generators.challenge_questions import ChallengeQuestion, QuestionOption
    
    try:
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        q = request.question
        options = [QuestionOption(**o) for o in q["options"]] if q.get("options") else None
        
        question = ChallengeQuestion(
            id=q.get("id", ""), question=q.get("question", ""),
            question_type=q.get("question_type", "multiple_choice"), options=options,
            correct_answer=q.get("correct_answer", ""), explanation=q.get("explanation", ""),
            hint=q.get("hint"), points=q.get("points", 20),
            aws_services=q.get("aws_services", []), difficulty=q.get("difficulty", "intermediate"),
        )
        
        result = await grade_challenge_answer(
            question=question, user_answer=request.user_answer,
            company_context=request.company_context, user_level=request.user_level,
        )
        
        return {"success": True, **result}
    except Exception as e:
        logger.error(f"Grade answer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


# ============================================
# CLI SIMULATOR ENDPOINTS
# ============================================

_cli_sessions: Dict[str, Any] = {}


@app.post("/api/learning/cli-simulate")
async def cli_simulate_endpoint(request: CLISimulatorRequest):
    """
    Simulate an AWS CLI command in a sandboxed environment.
    Returns realistic AWS CLI output with teaching content.
    """
    from generators.cli_simulator import simulate_cli_command, create_cli_session, CLISession
    
    try:
        # Set request-scoped API key and model if provided (BYOK)
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        # Get or create session
        session_id = request.session_id
        if session_id and session_id in _cli_sessions:
            session_data = _cli_sessions[session_id]
            session = CLISession(**session_data)
        else:
            session = create_cli_session(
                challenge_id=request.challenge_context.get("id") if request.challenge_context else None
            )
            session_id = session.session_id
        
        # Simulate the command
        result = await simulate_cli_command(
            command=request.command,
            session=session,
            challenge_context=request.challenge_context,
            company_name=request.company_name,
            industry=request.industry,
            business_context=request.business_context,
            api_key=request.openai_api_key,
            model=request.preferred_model,
        )
        
        # Save session state
        _cli_sessions[session_id] = session.model_dump()
        
        return {
            "success": True,
            "session_id": session_id,
            "command": result.command,
            "output": result.output,
            "exit_code": result.exit_code,
            "explanation": result.explanation,
            "next_steps": result.next_steps,
            "is_dangerous": result.is_dangerous,
            "warning": result.warning,
            # Validation and progress fields
            "is_correct_for_challenge": result.is_correct_for_challenge,
            "objective_completed": result.objective_completed,
            "points_earned": result.points_earned,
            "aws_service": result.aws_service,
            "command_type": result.command_type,
            # Session progress
            "session_progress": {
                "total_commands": session.total_commands,
                "correct_commands": session.correct_commands,
                "current_streak": session.current_streak,
                "best_streak": session.best_streak,
                "objectives_completed": session.objectives_completed,
                "total_points": session.points_earned,
            }
        }
    except Exception as e:
        logger.error(f"CLI simulate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@app.post("/api/learning/cli-help")
async def cli_help_endpoint(request: CLIHelpRequest):
    """Get contextual CLI help for a topic."""
    from generators.cli_simulator import get_cli_help
    
    try:
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        result = await get_cli_help(
            topic=request.topic,
            challenge_context=request.challenge_context,
            user_level=request.user_level,
            api_key=request.openai_api_key,
            model=request.preferred_model,
        )
        
        return {"success": True, **result}
    except Exception as e:
        logger.error(f"CLI help error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@app.delete("/api/learning/cli-session/{session_id}")
async def cli_session_delete(session_id: str):
    """Delete CLI session"""
    if session_id in _cli_sessions:
        del _cli_sessions[session_id]
        return {"success": True}
    return {"success": False, "message": "Session not found"}


@app.get("/api/learning/cli-session/{session_id}/stats")
async def cli_session_stats(session_id: str):
    """Get CLI session stats"""
    from generators.cli_simulator import CLISession
    if session_id not in _cli_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    session = CLISession(**_cli_sessions[session_id])
    stats = get_cli_session_stats(session)
    return {"success": True, **stats}


@app.post("/api/learning/cli-validate")
async def cli_validate_endpoint(request: CLIValidateRequest):
    """Validate CLI challenge"""
    from generators.cli_simulator import CLISession
    
    if request.session_id not in _cli_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        session = CLISession(**_cli_sessions[request.session_id])
        result = await validate_cli_challenge(session=session, challenge_context=request.challenge_context)
        
        return {
            "success": True, "is_complete": result.is_complete, "score": result.score,
            "objectives_met": result.objectives_met, "objectives_missing": result.objectives_missing,
            "feedback": result.feedback, "suggestions": result.suggestions,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


# ============================================
# CONTENT GENERATION ENDPOINTS
# ============================================

@app.post("/api/learning/generate-flashcards")
async def generate_flashcards_endpoint(request: GenerateContentRequest):
    """Generate flashcards"""
    try:
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        scenario = await db.get_scenario(request.scenario_id)
        if not scenario:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        persona_id = request.persona_id
        if not persona_id and request.user_id:
            persona_id = await db.get_user_persona(request.user_id)
        if not persona_id:
            persona_id = DEFAULT_PERSONA
        
        persona_ctx = get_persona_context(persona_id)
        aws_services = set()
        for c in scenario.get("challenges", []):
            aws_services.update(c.get("aws_services_relevant", []))
        
        deck = await generate_flashcards(
            scenario_title=scenario["scenario_title"], business_context=scenario["business_context"],
            aws_services=list(aws_services), user_level=request.user_level,
            card_count=request.options.get("card_count", 20) if request.options else 20,
            challenges=scenario.get("challenges"), persona_context=persona_ctx,
        )
        
        deck_id = await db.save_flashcard_deck(scenario_id=request.scenario_id, deck_data=deck.model_dump())
        return {"success": True, "deck_id": deck_id, "deck": deck.model_dump(), "persona": persona_id}
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@app.post("/api/learning/generate-notes")
async def generate_notes_endpoint(request: GenerateContentRequest):
    """Generate study notes"""
    try:
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        scenario = await db.get_scenario(request.scenario_id)
        if not scenario:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        persona_id = request.persona_id or await db.get_user_persona(request.user_id) if request.user_id else None
        if not persona_id:
            persona_id = DEFAULT_PERSONA
        
        persona_ctx = get_persona_context(persona_id)
        aws_services = set()
        for c in scenario.get("challenges", []):
            aws_services.update(c.get("aws_services_relevant", []))
        
        notes = await generate_notes(
            scenario_title=scenario["scenario_title"], business_context=scenario["business_context"],
            technical_requirements=scenario.get("technical_requirements", []),
            compliance_requirements=scenario.get("compliance_requirements", []),
            aws_services=list(aws_services), user_level=request.user_level,
            challenges=scenario.get("challenges"), persona_context=persona_ctx,
        )
        
        notes_id = await db.save_study_notes(scenario_id=request.scenario_id, notes_data=notes.model_dump())
        return {"success": True, "notes_id": notes_id, "notes": notes.model_dump(), "persona": persona_id}
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@app.post("/api/learning/generate-quiz")
async def generate_quiz_endpoint(request: GenerateContentRequest):
    """Generate quiz"""
    try:
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        scenario = await db.get_scenario(request.scenario_id)
        if not scenario:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        persona_id = request.persona_id or await db.get_user_persona(request.user_id) if request.user_id else None
        if not persona_id:
            persona_id = DEFAULT_PERSONA
        
        persona_ctx = get_persona_context(persona_id)
        aws_services = set()
        for c in scenario.get("challenges", []):
            aws_services.update(c.get("aws_services_relevant", []))
        
        quiz = await generate_quiz(
            scenario_title=scenario["scenario_title"], business_context=scenario["business_context"],
            aws_services=list(aws_services), learning_objectives=scenario.get("learning_objectives", []),
            user_level=request.user_level,
            question_count=request.options.get("question_count", 10) if request.options else 10,
            challenges=scenario.get("challenges"), persona_context=persona_ctx,
        )
        
        quiz_id = await db.save_quiz(scenario_id=request.scenario_id, quiz_data=quiz.model_dump())
        return {"success": True, "quiz_id": quiz_id, "quiz": quiz.model_dump(), "persona": persona_id}
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@app.post("/api/learning/detect-skill")
async def detect_skill_endpoint(message: str):
    """Detect skill level"""
    level = await detect_skill_level(message)
    return {"skill_level": level}


@app.post("/api/learning/format-study-guide")
async def format_study_guide_endpoint(request: dict):
    """FORMAT a study guide from pre-selected content.
    
    The tool has already decided what content goes in the plan.
    The AI just formats it nicely with themes, descriptions, and accountability tips.
    """
    try:
        from utils import set_request_api_key, set_request_model
        from generators.study_plan import format_study_guide

        if request.get("openai_api_key"):
            set_request_api_key(request["openai_api_key"])
        if request.get("preferred_model"):
            set_request_model(request["preferred_model"])

        plan = await format_study_guide(
            target_certification=request.get("target_certification", ""),
            skill_level=request.get("skill_level", "intermediate"),
            time_horizon_weeks=request.get("time_horizon_weeks", 6),
            hours_per_week=request.get("hours_per_week", 6),
            learning_styles=request.get("learning_styles", ["hands_on"]),
            coach_notes=request.get("coach_notes"),
            structured_content=request.get("structured_content", {}),
        )
        return {"success": True, "plan": plan}
    except ApiKeyRequiredError as key_err:
        raise HTTPException(status_code=402, detail=str(key_err)) from key_err
    except Exception as exc:
        logger.error("Study guide formatting failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Study guide formatting failed: {str(exc)}") from exc
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


# ============================================
# LEARNING JOURNEY ENDPOINTS
# ============================================

@app.post("/api/learning/journey/track-scenario")
async def track_scenario_start_endpoint(request: TrackScenarioRequest):
    """Track scenario start"""
    ctx = await get_context()
    return await track_learner_scenario_start(
        neo4j_driver=ctx.neo4j_driver, profile_id=request.profile_id, tenant_id=request.tenant_id,
        scenario_id=request.scenario_id, scenario_title=request.scenario_title,
        company_name=request.company_name, difficulty=request.difficulty, aws_services=request.aws_services
    )


@app.post("/api/learning/journey/track-challenge")
async def track_challenge_endpoint(request: TrackChallengeRequest):
    """Track challenge completion"""
    ctx = await get_context()
    return await track_challenge_completion(
        neo4j_driver=ctx.neo4j_driver, profile_id=request.profile_id, tenant_id=request.tenant_id,
        scenario_id=request.scenario_id, challenge_id=request.challenge_id,
        challenge_title=request.challenge_title, score=request.score, passed=request.passed,
        aws_services=request.aws_services
    )


@app.post("/api/learning/journey/track-flashcards")
async def track_flashcard_endpoint(request: TrackFlashcardRequest):
    """Track flashcard study"""
    ctx = await get_context()
    return await track_flashcard_study(
        neo4j_driver=ctx.neo4j_driver, profile_id=request.profile_id, tenant_id=request.tenant_id,
        deck_id=request.deck_id, deck_title=request.deck_title,
        cards_studied=request.cards_studied, aws_services=request.aws_services
    )


@app.post("/api/learning/journey/track-quiz")
async def track_quiz_endpoint(request: TrackQuizRequest):
    """Track quiz attempt"""
    ctx = await get_context()
    return await track_quiz_attempt(
        neo4j_driver=ctx.neo4j_driver, profile_id=request.profile_id, tenant_id=request.tenant_id,
        quiz_id=request.quiz_id, quiz_title=request.quiz_title,
        score=request.score, passed=request.passed, aws_services=request.aws_services
    )


@app.get("/api/learning/journey/{profile_id}")
async def get_journey_endpoint(profile_id: str, tenant_id: str):
    """Get learner journey"""
    ctx = await get_context()
    return await get_learner_journey(neo4j_driver=ctx.neo4j_driver, profile_id=profile_id, tenant_id=tenant_id)


@app.get("/api/learning/journey/{profile_id}/recommendations")
async def get_recommendations_endpoint(profile_id: str, tenant_id: str, limit: int = 5):
    """Get recommendations"""
    ctx = await get_context()
    return await get_recommended_next_steps(neo4j_driver=ctx.neo4j_driver, profile_id=profile_id, tenant_id=tenant_id, limit=limit)


@app.post("/api/learning/journey/{profile_id}/report")
async def generate_journey_report(profile_id: str, request: GenerateReportRequest):
    """Generate journey report"""
    from utils import get_request_model
    
    journey_data = await db.get_learner_journey_data(profile_id)
    if not journey_data:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    analysis = await db.get_learner_strengths_weaknesses(profile_id)
    persona_id = await db.get_user_persona(profile_id)
    persona = get_persona_info(persona_id or DEFAULT_PERSONA)
    
    system_prompt = f"""Generate a {request.report_type} learning journey report.
Learner: {journey_data['profile'].get('displayName', 'Learner')}
Level: {journey_data['profile'].get('currentLevel', 1)}
Points: {journey_data['profile'].get('totalPoints', 0)}
Cert Track: {persona['cert']}
Strengths: {json.dumps(analysis.get('strong_areas', []))}
Weaknesses: {json.dumps(analysis.get('weak_areas', []))}

Format in clean Markdown. Be specific and actionable."""

    report_content = await async_chat_completion(
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": f"Generate {request.report_type} report."}],
        model=get_request_model(),
    )
    
    report_id = await db.save_journey_report(
        profile_id=profile_id, report_type=request.report_type, content=report_content,
        summary=f"{request.report_type.title()} Report", metadata={"persona": persona_id}
    )
    
    return {"success": True, "report_id": report_id, "report_type": request.report_type, "content": report_content}


@app.get("/api/learning/journey/{profile_id}/reports")
async def get_journey_reports_endpoint(profile_id: str, limit: int = 10):
    """Get journey reports"""
    reports = await db.get_journey_reports(profile_id, limit)
    return {"success": True, "reports": reports, "count": len(reports)}


@app.get("/api/learning/journey/{profile_id}/data")
async def get_journey_data_endpoint(profile_id: str):
    """Get journey data"""
    data = await db.get_learner_journey_data(profile_id)
    if not data:
        raise HTTPException(status_code=404, detail="Profile not found")
    analysis = await db.get_learner_strengths_weaknesses(profile_id)
    return {"success": True, "journey": data, "analysis": analysis}


# ============================================
# AI CONFIG ENDPOINTS
# ============================================

@app.get("/api/models")
async def list_available_models():
    """List available models"""
    return {"models": list(AVAILABLE_MODELS.values()), "default": DEFAULT_MODEL}


@app.get("/api/tenant/{tenant_id}/ai-config")
async def get_tenant_ai_config_endpoint(tenant_id: str):
    """Get tenant AI config"""
    config = await db.get_tenant_ai_config(tenant_id)
    if not config:
        return {"success": False, "error": "Tenant not found"}
    
    if config.get("openai_api_key"):
        key = config["openai_api_key"]
        config["openai_api_key_masked"] = f"sk-...{key[-4:]}" if len(key) > 4 else "***"
        config["has_custom_key"] = True
        del config["openai_api_key"]
    else:
        config["has_custom_key"] = False
    
    return {"success": True, **config}


@app.put("/api/tenant/{tenant_id}/ai-config")
async def update_tenant_ai_config_endpoint(tenant_id: str, request: UpdateAIConfigRequest):
    """Update tenant AI config"""
    if request.preferred_model and request.preferred_model not in AVAILABLE_MODELS:
        return {"success": False, "error": f"Invalid model. Available: {list(AVAILABLE_MODELS.keys())}"}
    
    if request.openai_api_key and not request.openai_api_key.startswith("sk-"):
        return {"success": False, "error": "Invalid API key format"}
    
    success = await db.update_tenant_ai_config(tenant_id=tenant_id, openai_api_key=request.openai_api_key, preferred_model=request.preferred_model)
    
    if success:
        keys_to_remove = [k for k in _tenant_clients.keys() if k.startswith(f"{tenant_id}:")]
        for k in keys_to_remove:
            del _tenant_clients[k]
        return {"success": True, "message": "AI configuration updated"}
    
    return {"success": False, "error": "Failed to update configuration"}


@app.delete("/api/tenant/{tenant_id}/ai-config/key")
async def remove_tenant_api_key(tenant_id: str):
    """Remove tenant API key"""
    success = await db.update_tenant_ai_config(tenant_id=tenant_id, openai_api_key="")
    if success:
        keys_to_remove = [k for k in _tenant_clients.keys() if k.startswith(f"{tenant_id}:")]
        for k in keys_to_remove:
            del _tenant_clients[k]
        return {"success": True}
    return {"success": False, "error": "Failed to remove API key"}


@app.get("/api/user/{user_id}/ai-config")
async def get_user_ai_config_endpoint(user_id: str):
    """Get user AI config"""
    config = await db.get_user_ai_config(user_id)
    if not config:
        return {"success": False, "error": "User not found"}
    
    if config.get("openai_api_key"):
        key = config["openai_api_key"]
        config["openai_api_key_masked"] = f"sk-...{key[-4:]}" if len(key) > 4 else "***"
        config["has_custom_key"] = True
        del config["openai_api_key"]
    else:
        config["has_custom_key"] = False
    
    return {"success": True, **config}


@app.put("/api/user/{user_id}/ai-config")
async def update_user_ai_config_endpoint(user_id: str, request: UpdateAIConfigRequest):
    """Update user AI config"""
    if request.preferred_model and request.preferred_model not in AVAILABLE_MODELS:
        return {"success": False, "error": f"Invalid model"}
    
    if request.openai_api_key and not request.openai_api_key.startswith("sk-"):
        return {"success": False, "error": "Invalid API key format"}
    
    success = await db.update_user_ai_config(user_id=user_id, openai_api_key=request.openai_api_key, preferred_model=request.preferred_model)
    
    if success:
        keys_to_remove = [k for k in _tenant_clients.keys() if f":{user_id}:" in k]
        for k in keys_to_remove:
            del _tenant_clients[k]
        return {"success": True}
    
    return {"success": False, "error": "Failed to update"}


# ============================================
# PERSONA ENDPOINTS
# ============================================

@app.get("/api/personas")
async def list_personas():
    """List personas"""
    personas = [{"id": p["id"], "name": p["name"], "cert": p["cert"], "level": p["level"], "focus": p["focus"], "style": p["style"]} for p in AWS_PERSONAS.values()]
    grouped = {
        "foundational": [p for p in personas if p["level"] == "foundational"],
        "associate": [p for p in personas if p["level"] == "associate"],
        "professional": [p for p in personas if p["level"] == "professional"],
        "specialty": [p for p in personas if p["level"] == "specialty"],
    }
    return {"personas": personas, "grouped": grouped, "default": DEFAULT_PERSONA, "count": len(personas)}


@app.get("/api/personas/{persona_id}")
async def get_persona(persona_id: str):
    """Get persona"""
    if persona_id not in AWS_PERSONAS:
        return {"success": False, "error": f"Persona '{persona_id}' not found"}
    return {"success": True, **get_persona_info(persona_id)}


@app.put("/api/user/{user_id}/persona")
async def set_user_persona(user_id: str, request: SetPersonaRequest):
    """Set user persona"""
    if request.persona_id not in AWS_PERSONAS:
        return {"success": False, "error": f"Invalid persona"}
    
    success = await db.update_user_persona(user_id, request.persona_id)
    if success:
        persona = get_persona_info(request.persona_id)
        return {"success": True, "message": f"Persona set to {persona['name']}", "persona": persona}
    return {"success": False, "error": "Failed to update persona"}


@app.get("/api/user/{user_id}/persona")
async def get_user_persona(user_id: str):
    """Get user persona"""
    persona_id = await db.get_user_persona(user_id)
    if not persona_id:
        persona_id = DEFAULT_PERSONA
    return {"success": True, "persona_id": persona_id, **get_persona_info(persona_id)}


# ============================================
# CLOUD TYCOON GAME ENDPOINTS
# ============================================

from pydantic import BaseModel as PydanticBaseModel
from generators.cloud_tycoon import (
    generate_tycoon_journey,
    validate_service_match,
    TycoonJourney,
    BusinessUseCase,
    RequiredService,
    JOURNEY_THEMES,
)

class TycoonJourneyRequest(PydanticBaseModel):
    user_level: str = "intermediate"
    cert_code: Optional[str] = None
    theme: Optional[str] = None
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None

class TycoonValidateRequest(PydanticBaseModel):
    use_case_id: str
    business_name: str
    use_case_title: str
    use_case_description: str
    required_services: List[Dict[str, Any]]
    contract_value: int
    difficulty: str
    submitted_services: List[str]


@app.post("/api/tycoon/journey/generate")
async def generate_tycoon_journey_endpoint(request: TycoonJourneyRequest):
    """Generate a Cloud Tycoon journey with 10 business use cases."""
    try:
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        journey = await generate_tycoon_journey(
            user_level=request.user_level,
            cert_code=request.cert_code,
            theme=request.theme,
            api_key=request.openai_api_key,
        )
        
        return {
            "id": journey.id,
            "journey_name": journey.journey_name,
            "theme": journey.theme,
            "businesses": [
                {
                    "id": biz.id,
                    "business_name": biz.business_name,
                    "industry": biz.industry,
                    "icon": biz.icon,
                    "use_case_title": biz.use_case_title,
                    "use_case_description": biz.use_case_description,
                    "required_services": [
                        {
                            "service_id": svc.service_id,
                            "service_name": svc.service_name,
                            "category": svc.category,
                            "reason": svc.reason,
                        }
                        for svc in biz.required_services
                    ],
                    "contract_value": biz.contract_value,
                    "difficulty": biz.difficulty,
                    "hints": biz.hints,
                    "compliance_requirements": biz.compliance_requirements,
                }
                for biz in journey.businesses
            ],
            "total_contract_value": journey.total_contract_value,
            "difficulty_distribution": journey.difficulty_distribution,
        }
    except ApiKeyRequiredError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Tycoon journey generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate journey: {str(e)}")


@app.post("/api/tycoon/validate")
async def validate_tycoon_services(request: TycoonValidateRequest):
    """Validate if submitted services match the use case requirements."""
    try:
        use_case = BusinessUseCase(
            id=request.use_case_id,
            business_name=request.business_name,
            industry="",
            icon="",
            use_case_title=request.use_case_title,
            use_case_description=request.use_case_description,
            required_services=[
                RequiredService(
                    service_id=svc.get("service_id", ""),
                    service_name=svc.get("service_name", ""),
                    category=svc.get("category", ""),
                    reason=svc.get("reason", ""),
                )
                for svc in request.required_services
            ],
            contract_value=request.contract_value,
            difficulty=request.difficulty,
            hints=[],
        )
        
        result = await validate_service_match(
            use_case=use_case,
            submitted_services=request.submitted_services,
        )
        
        return result
    except Exception as e:
        logger.error(f"Tycoon validation error: {e}")
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@app.get("/api/tycoon/themes")
async def get_tycoon_themes():
    """Get available journey themes."""
    return {"themes": JOURNEY_THEMES}


# ============================================
# MAIN
# ============================================

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "1027"))
    print(f"Starting CloudMigrate Learning Agent on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
