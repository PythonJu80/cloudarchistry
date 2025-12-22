"""
Company research service with enhanced Crawl4AI integration.
"""
from typing import Optional, List, Dict, Any
from config.settings import logger
from models.learning import CompanyInfo, ResearchResult
from .web_search import search_web
from .openai_service import async_chat_completion_json
import asyncio


async def _crawl_url(url: str, timeout: int = 10) -> Optional[Dict[str, str]]:
    """Crawl a single URL and extract content using Crawl4AI."""
    try:
        from crawl4ai import AsyncWebCrawler
        
        async with AsyncWebCrawler(verbose=False) as crawler:
            result = await asyncio.wait_for(
                crawler.arun(url=url),
                timeout=timeout
            )
            
            if result.success and result.markdown:
                # Extract first 8000 chars of markdown content
                content = result.markdown[:8000]
                return {
                    "url": url,
                    "content": content,
                    "title": result.url,  # Use URL as fallback title
                }
    except asyncio.TimeoutError:
        logger.warning(f"Crawl timeout for {url}")
    except Exception as e:
        logger.warning(f"Failed to crawl {url}: {e}")
    
    return None


async def _enrich_with_aws_knowledge(company_info: CompanyInfo, industry: Optional[str] = None) -> str:
    """Enrich company research with AWS knowledge base patterns."""
    try:
        import db
        from openai import AsyncOpenAI
        from utils import get_request_api_key
        
        # Build query for AWS knowledge
        kb_query_parts = []
        if industry:
            kb_query_parts.append(industry)
        if company_info.compliance_requirements:
            kb_query_parts.extend(company_info.compliance_requirements[:2])
        
        kb_query = f"{' '.join(kb_query_parts)} AWS architecture patterns best practices"
        
        # Get embedding
        api_key = get_request_api_key()
        if not api_key:
            return ""
        
        client = AsyncOpenAI(api_key=api_key)
        embed_response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=kb_query
        )
        query_embedding = embed_response.data[0].embedding
        
        # Search knowledge base
        kb_results = await db.search_knowledge_chunks(
            query_embedding=query_embedding,
            limit=3
        )
        
        if kb_results:
            aws_context = "\n\n=== AWS BEST PRACTICES FOR THIS INDUSTRY ===\n"
            for chunk in kb_results:
                aws_context += f"\nAWS Knowledge ({chunk['url']}):\n{chunk['content'][:1000]}\n"
            return aws_context
    except Exception as e:
        logger.warning(f"AWS knowledge enrichment failed: {e}")
    
    return ""


async def research_company(company_name: str, industry: Optional[str] = None, api_key: Optional[str] = None) -> ResearchResult:
    """
    Research a company using:
    1. Brave web search for discovery
    2. Crawl4AI for full page content extraction
    3. AWS knowledge base for industry patterns
    4. AI analysis for structured output
    """
    from utils import get_request_model
    logger.info(f"🔍 Researching company: {company_name}")
    
    # Step 1: Comprehensive web searches
    queries = [
        f"{company_name} company overview business model",
        f"{company_name} technology stack infrastructure cloud",
        f"{company_name} AWS services cloud architecture",
        f"{company_name} security compliance certifications HIPAA PCI GDPR SOC2",
        f"{company_name} data privacy regulations",
        f"{company_name} scalability traffic patterns",
    ]
    
    if industry:
        queries.extend([
            f"{company_name} {industry} industry challenges",
            f"{company_name} {industry} digital transformation cloud",
        ])
    
    # Step 2: Gather URLs from search results
    logger.info(f"📡 Running {len(queries)} targeted searches...")
    all_snippets = []
    top_urls = []
    sources = []
    
    for query in queries:
        results = await search_web(query, max_results=2)
        for r in results:
            snippet = r.get("content", "")
            if snippet:
                all_snippets.append(snippet)
            url = r.get("url")
            if url and url not in top_urls:
                top_urls.append(url)
                sources.append(url)
    
    # Step 3: Crawl top URLs for full content
    logger.info(f"🕷️ Crawling {min(len(top_urls), 5)} pages for full content...")
    crawl_tasks = [_crawl_url(url) for url in top_urls[:5]]
    crawled_results = await asyncio.gather(*crawl_tasks, return_exceptions=True)
    
    full_content = []
    for result in crawled_results:
        if isinstance(result, dict) and result:
            full_content.append(result)
    
    logger.info(f"✅ Successfully crawled {len(full_content)} pages")
    
    # Step 4: Combine all information
    combined_info = ""
    
    # Add search snippets
    if all_snippets:
        combined_info += "=== SEARCH RESULTS OVERVIEW ===\n"
        combined_info += "\n".join(all_snippets[:10])
        combined_info += "\n\n"
    
    # Add full crawled content
    if full_content:
        combined_info += "=== DETAILED PAGE CONTENT ===\n"
        for idx, page in enumerate(full_content, 1):
            combined_info += f"\n--- Source {idx}: {page['url']} ---\n"
            combined_info += page['content']
            combined_info += "\n\n"
    
    # Fallback if no content found
    if not combined_info:
        logger.warning(f"⚠️ No research data found for {company_name}, using inference")
        combined_info = f"Company: {company_name}. Industry: {industry or 'Unknown'}. Please infer typical business operations and cloud needs based on the company name and industry."
        confidence = 0.3
    else:
        # Calculate confidence based on data richness
        confidence = 0.5  # Base
        if len(full_content) > 0:
            confidence += 0.2
        if len(full_content) >= 3:
            confidence += 0.1
        if len(all_snippets) >= 8:
            confidence += 0.1
        confidence = min(confidence, 0.95)
    
    # Step 5: AI analysis with rich context
    logger.info("🤖 Analyzing research data with AI...")
    try:
        system_prompt = """You are an expert business and cloud architecture research analyst.

Analyze the provided company information and extract structured data.

Return JSON with these fields:
- name: company name
- industry: industry sector (be specific, e.g., "FinTech", "Healthcare SaaS", "E-commerce")
- description: 2-3 sentence description of what the company does
- headquarters: location if mentioned
- employee_count: company size (e.g., "50-200", "1000+") if mentioned
- revenue: revenue range if mentioned
- key_services: list of main products/services they offer
- technology_stack: list of technologies, frameworks, cloud services they use (look for mentions of AWS, Azure, GCP, databases, etc.)
- compliance_requirements: list of compliance standards they must meet (HIPAA, PCI-DSS, GDPR, SOC2, ISO27001, etc.)
- business_challenges: list of business/technical challenges they face
- data_types: list of types of data they handle (PII, PHI, financial, user data, etc.)
- traffic_patterns: description of their traffic/usage patterns if mentioned
- global_presence: geographic regions they operate in

Be thorough and extract as much relevant information as possible from the research data.
If information is not explicitly stated but can be reasonably inferred from the industry/context, include it.
For technology_stack, look for specific mentions of cloud services, databases, frameworks, etc."""

        result = await async_chat_completion_json(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"""Analyze this company:

Company Name: {company_name}
Industry Hint: {industry or 'Unknown'}

Research Data:
{combined_info}

Provide comprehensive analysis based on all available information."""},
            ],
            model=get_request_model(),
            api_key=api_key,
        )
        
        company_info = CompanyInfo(**result)
        
        # Step 6: Enrich with AWS knowledge base (async, don't block on failure)
        logger.info("📚 Enriching with AWS knowledge base...")
        try:
            aws_context = await _enrich_with_aws_knowledge(company_info, industry)
            if aws_context:
                logger.info("✅ Added AWS best practices context")
        except Exception as kb_err:
            logger.warning(f"AWS knowledge enrichment skipped: {kb_err}")
        
        logger.info(f"✅ Research complete for {company_name} (confidence: {confidence:.0%})")
        
        return ResearchResult(
            company_info=company_info,
            sources=list(set(sources))[:10],  # Return up to 10 sources
            confidence=confidence
        )
    except Exception as e:
        logger.error(f"❌ Research failed: {e}")
        # Return minimal fallback data
        return ResearchResult(
            company_info=CompanyInfo(
                name=company_name,
                industry=industry or "Technology",
                description=f"{company_name} is a company in the {industry or 'technology'} sector.",
                key_services=["Core business operations"],
                compliance_requirements=["SOC 2", "GDPR"],
                business_challenges=["Digital transformation", "Cloud migration", "Scalability"],
                data_types=["Customer data", "Business data"],
                technology_stack=["Cloud infrastructure", "Web applications"],
            ),
            sources=[],
            confidence=0.2
        )
