"""
Redis-based Job Queue for Crawl4AI

Provides:
- Persistent job storage (survives restarts)
- Per-tenant rate limiting
- Concurrent crawl limits
- Job expiration (auto-cleanup)
"""

import os
import json
import redis.asyncio as redis
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import uuid

# Redis configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:4379")

# Rate limiting settings
MAX_CONCURRENT_CRAWLS_PER_TENANT = int(os.getenv("MAX_CONCURRENT_CRAWLS_PER_TENANT", "20"))
MAX_CRAWLS_PER_HOUR_PER_TENANT = int(os.getenv("MAX_CRAWLS_PER_HOUR_PER_TENANT", "100"))
JOB_EXPIRY_HOURS = int(os.getenv("JOB_EXPIRY_HOURS", "24"))

# Redis key prefixes
JOB_PREFIX = "crawl:job:"
TENANT_ACTIVE_PREFIX = "crawl:active:"
TENANT_HOURLY_PREFIX = "crawl:hourly:"


class RedisJobManager:
    """Manages crawl jobs using Redis for persistence and rate limiting."""
    
    def __init__(self):
        self._redis: Optional[redis.Redis] = None
    
    async def get_redis(self) -> redis.Redis:
        """Get or create Redis connection."""
        if self._redis is None:
            self._redis = redis.from_url(REDIS_URL, decode_responses=True)
        return self._redis
    
    async def close(self):
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._redis = None
    
    # ============================================
    # RATE LIMITING
    # ============================================
    
    async def check_rate_limit(self, tenant_id: str) -> Dict[str, Any]:
        """
        Check if tenant can start a new crawl.
        
        Returns:
            {
                "allowed": bool,
                "reason": str (if not allowed),
                "active_crawls": int,
                "hourly_crawls": int,
                "limits": {"concurrent": int, "hourly": int}
            }
        """
        r = await self.get_redis()
        
        # Check concurrent crawls
        active_key = f"{TENANT_ACTIVE_PREFIX}{tenant_id}"
        active_count = await r.scard(active_key)
        
        # Check hourly limit
        hourly_key = f"{TENANT_HOURLY_PREFIX}{tenant_id}"
        hourly_count = await r.get(hourly_key)
        hourly_count = int(hourly_count) if hourly_count else 0
        
        result = {
            "active_crawls": active_count,
            "hourly_crawls": hourly_count,
            "limits": {
                "concurrent": MAX_CONCURRENT_CRAWLS_PER_TENANT,
                "hourly": MAX_CRAWLS_PER_HOUR_PER_TENANT
            }
        }
        
        if active_count >= MAX_CONCURRENT_CRAWLS_PER_TENANT:
            result["allowed"] = False
            result["reason"] = f"Maximum concurrent crawls ({MAX_CONCURRENT_CRAWLS_PER_TENANT}) reached. Please wait for current crawls to complete."
            return result
        
        if hourly_count >= MAX_CRAWLS_PER_HOUR_PER_TENANT:
            result["allowed"] = False
            result["reason"] = f"Hourly crawl limit ({MAX_CRAWLS_PER_HOUR_PER_TENANT}) reached. Please try again later."
            return result
        
        result["allowed"] = True
        return result
    
    async def increment_rate_counters(self, tenant_id: str, job_id: str):
        """Increment rate limit counters when starting a crawl."""
        r = await self.get_redis()
        
        # Add to active set
        active_key = f"{TENANT_ACTIVE_PREFIX}{tenant_id}"
        await r.sadd(active_key, job_id)
        await r.expire(active_key, 3600 * 2)  # 2 hour expiry for safety
        
        # Increment hourly counter
        hourly_key = f"{TENANT_HOURLY_PREFIX}{tenant_id}"
        await r.incr(hourly_key)
        # Set expiry if new key
        ttl = await r.ttl(hourly_key)
        if ttl == -1:  # No expiry set
            await r.expire(hourly_key, 3600)  # 1 hour
    
    async def decrement_active_crawls(self, tenant_id: str, job_id: str):
        """Remove job from active set when completed."""
        r = await self.get_redis()
        active_key = f"{TENANT_ACTIVE_PREFIX}{tenant_id}"
        await r.srem(active_key, job_id)
    
    # ============================================
    # JOB MANAGEMENT
    # ============================================
    
    async def create_job(self, url: str, tenant_id: str, params: Dict = None) -> Dict[str, Any]:
        """
        Create a new crawl job.
        
        Returns job data or error if rate limited.
        """
        # Check rate limits first
        rate_check = await self.check_rate_limit(tenant_id)
        if not rate_check["allowed"]:
            return {
                "success": False,
                "error": rate_check["reason"],
                "rate_limit": rate_check
            }
        
        r = await self.get_redis()
        
        job_id = str(uuid.uuid4())[:8]
        job_data = {
            "id": job_id,
            "url": url,
            "tenant_id": tenant_id,
            "status": "queued",
            "params": params or {},
            "created_at": datetime.utcnow().isoformat(),
            "started_at": None,
            "completed_at": None,
            "result": None,
            "error": None
        }
        
        # Store job
        job_key = f"{JOB_PREFIX}{job_id}"
        await r.set(job_key, json.dumps(job_data), ex=3600 * JOB_EXPIRY_HOURS)
        
        # Update rate counters
        await self.increment_rate_counters(tenant_id, job_id)
        
        return {
            "success": True,
            "job": job_data
        }
    
    async def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get a job by ID."""
        r = await self.get_redis()
        job_key = f"{JOB_PREFIX}{job_id}"
        data = await r.get(job_key)
        return json.loads(data) if data else None
    
    async def update_job(self, job_id: str, **updates) -> bool:
        """Update job fields."""
        r = await self.get_redis()
        job_key = f"{JOB_PREFIX}{job_id}"
        
        data = await r.get(job_key)
        if not data:
            return False
        
        job = json.loads(data)
        job.update(updates)
        
        # If completing, update timestamps and remove from active
        if updates.get("status") in ("completed", "failed"):
            job["completed_at"] = datetime.utcnow().isoformat()
            await self.decrement_active_crawls(job["tenant_id"], job_id)
        
        if updates.get("status") == "running" and not job.get("started_at"):
            job["started_at"] = datetime.utcnow().isoformat()
        
        await r.set(job_key, json.dumps(job), ex=3600 * JOB_EXPIRY_HOURS)
        return True
    
    async def list_jobs(self, tenant_id: str = None, limit: int = 20) -> List[Dict[str, Any]]:
        """List recent jobs, optionally filtered by tenant."""
        r = await self.get_redis()
        
        # Get all job keys
        keys = await r.keys(f"{JOB_PREFIX}*")
        
        jobs = []
        for key in keys:
            data = await r.get(key)
            if data:
                job = json.loads(data)
                if tenant_id is None or job.get("tenant_id") == tenant_id:
                    jobs.append(job)
        
        # Sort by created_at descending
        jobs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return jobs[:limit]
    
    async def get_tenant_stats(self, tenant_id: str) -> Dict[str, Any]:
        """Get crawl statistics for a tenant."""
        r = await self.get_redis()
        
        active_key = f"{TENANT_ACTIVE_PREFIX}{tenant_id}"
        hourly_key = f"{TENANT_HOURLY_PREFIX}{tenant_id}"
        
        active_count = await r.scard(active_key)
        hourly_count = await r.get(hourly_key)
        hourly_ttl = await r.ttl(hourly_key)
        
        return {
            "tenant_id": tenant_id,
            "active_crawls": active_count,
            "hourly_crawls": int(hourly_count) if hourly_count else 0,
            "hourly_reset_seconds": max(0, hourly_ttl),
            "limits": {
                "max_concurrent": MAX_CONCURRENT_CRAWLS_PER_TENANT,
                "max_hourly": MAX_CRAWLS_PER_HOUR_PER_TENANT
            }
        }


# Global instance
_job_manager: Optional[RedisJobManager] = None


async def get_job_manager() -> RedisJobManager:
    """Get or create the global job manager."""
    global _job_manager
    if _job_manager is None:
        _job_manager = RedisJobManager()
    return _job_manager


# Convenience functions
async def create_crawl_job(url: str, tenant_id: str, params: Dict = None) -> Dict[str, Any]:
    """Create a new crawl job with rate limiting."""
    manager = await get_job_manager()
    return await manager.create_job(url, tenant_id, params)


async def get_crawl_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Get a crawl job by ID."""
    manager = await get_job_manager()
    return await manager.get_job(job_id)


async def update_crawl_job(job_id: str, **updates) -> bool:
    """Update a crawl job."""
    manager = await get_job_manager()
    return await manager.update_job(job_id, **updates)


async def check_tenant_rate_limit(tenant_id: str) -> Dict[str, Any]:
    """Check if tenant can start a new crawl."""
    manager = await get_job_manager()
    return await manager.check_rate_limit(tenant_id)


async def get_tenant_crawl_stats(tenant_id: str) -> Dict[str, Any]:
    """Get crawl statistics for a tenant."""
    manager = await get_job_manager()
    return await manager.get_tenant_stats(tenant_id)


async def list_tenant_jobs(tenant_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    """List recent jobs for a tenant."""
    manager = await get_job_manager()
    return await manager.list_jobs(tenant_id, limit)
