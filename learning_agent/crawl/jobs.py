"""
Crawl job management using Redis.
"""
from typing import Dict, Any, Optional

from redis_jobs import (
    create_crawl_job as redis_create_job,
    get_crawl_job as redis_get_job,
    update_crawl_job as redis_update_job,
)


async def create_crawl_job(url: str, tenant_id: str, params: Dict = None) -> Dict[str, Any]:
    """Create a new crawl job with rate limiting. Returns job data or error."""
    return await redis_create_job(url, tenant_id, params)


async def update_crawl_job(job_id: str, status: str, result: Dict = None, error: str = None):
    """Update a crawl job's status."""
    updates = {"status": status}
    if result:
        updates["result"] = result
    if error:
        updates["error"] = error
    await redis_update_job(job_id, **updates)


async def get_crawl_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Get a crawl job by ID."""
    return await redis_get_job(job_id)
