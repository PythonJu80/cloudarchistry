"""
Crawl API routes.
"""
import json
from typing import Dict, List, Any
from fastapi import APIRouter, BackgroundTasks

from crawl.context import get_context
from crawl.jobs import create_crawl_job, get_crawl_job
from crawl.utils import is_sitemap, is_txt, parse_sitemap, smart_chunk_markdown, extract_section_info
from aws.neo4j_graph import extract_aws_services_to_neo4j
from config.settings import DEFAULT_TENANT_ID, logger

from utils import (
    add_documents_to_supabase as add_documents_to_db,
    search_documents,
    extract_code_blocks,
    generate_code_example_summary,
    add_code_examples_to_supabase as add_code_examples_to_db,
    update_source_info,
    extract_source_summary,
)

from redis_jobs import (
    get_tenant_crawl_stats,
    list_tenant_jobs,
)

from crawl4ai import CrawlerRunConfig, CacheMode

router = APIRouter()


@router.post("/single")
async def crawl_single_page(url: str) -> str:
    """Crawl a single web page and store its content."""
    try:
        ctx = await get_context()
        crawler = ctx.crawler
        
        # Configure the crawl
        run_config = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, stream=False)
        
        # Crawl the page
        result = await crawler.arun(url=url, config=run_config)
        
        if not result.success:
            return json.dumps({
                "success": False,
                "url": url,
                "error": result.error_message or "Failed to crawl page"
            }, indent=2)
        
        # Get the markdown content
        markdown = result.markdown
        if not markdown:
            return json.dumps({
                "success": False,
                "url": url,
                "error": "No content extracted from page"
            }, indent=2)
        
        # Chunk the content
        chunks = smart_chunk_markdown(markdown)
        
        # Add to database
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
        
        # Extract AWS services to Neo4j if enabled
        neo4j_result = {"extracted": 0, "relationships": 0}
        if ctx.neo4j_driver:
            neo4j_result = await extract_aws_services_to_neo4j(
                content=markdown,
                source_url=url,
                neo4j_driver=ctx.neo4j_driver
            )
        
        return json.dumps({
            "success": True,
            "url": url,
            "chunks_stored": len(documents),
            "aws_services": neo4j_result
        }, indent=2)
        
    except Exception as e:
        logger.error(f"Crawl single page error: {e}")
        return json.dumps({
            "success": False,
            "url": url,
            "error": str(e)
        }, indent=2)


@router.get("/status/{job_id}")
async def get_crawl_status(job_id: str) -> Dict[str, Any]:
    """Get the status of a crawl job."""
    job = await get_crawl_job(job_id)
    if not job:
        return {"success": False, "error": "Job not found"}
    
    return {
        "success": True,
        "job_id": job_id,
        "status": job.get("status"),
        "url": job.get("url"),
        "result": job.get("result"),
        "error": job.get("error"),
        "created_at": job.get("created_at"),
        "updated_at": job.get("updated_at"),
    }


@router.get("/jobs")
async def list_crawl_jobs_endpoint(tenant_id: str = None) -> Dict[str, Any]:
    """List all crawl jobs for a tenant."""
    tenant_id = tenant_id or DEFAULT_TENANT_ID
    jobs = await list_tenant_jobs(tenant_id)
    return {
        "success": True,
        "tenant_id": tenant_id,
        "jobs": jobs,
        "count": len(jobs),
    }


@router.get("/stats")
async def get_crawl_stats(tenant_id: str = None) -> Dict[str, Any]:
    """Get crawl statistics for a tenant."""
    tenant_id = tenant_id or DEFAULT_TENANT_ID
    stats = await get_tenant_crawl_stats(tenant_id)
    return {
        "success": True,
        "tenant_id": tenant_id,
        **stats,
    }
