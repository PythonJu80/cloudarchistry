"""
Redis-based session storage for CLI simulator
Replaces in-memory dict to support multi-worker deployment

Follows the same pattern as redis_jobs.py for consistency.
"""
import json
import os
from typing import Optional, Dict, Any
import redis.asyncio as redis
from config.settings import logger

# Redis configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:4379")
SESSION_TTL = 3600  # 1 hour session expiry
SESSION_PREFIX = "cli:session:"


class RedisSessionManager:
    """Manages CLI sessions using Redis for multi-worker persistence."""
    
    def __init__(self):
        self._redis: Optional[redis.Redis] = None
    
    async def get_redis(self) -> redis.Redis:
        """Get or create Redis connection."""
        if self._redis is None:
            self._redis = redis.from_url(REDIS_URL, decode_responses=True)
            logger.info(f"Redis session manager initialized: {REDIS_URL}")
        return self._redis
    
    async def close(self):
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._redis = None
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get CLI session from Redis."""
        try:
            r = await self.get_redis()
            session_key = f"{SESSION_PREFIX}{session_id}"
            data = await r.get(session_key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Failed to get CLI session {session_id}: {e}")
            return None
    
    async def save_session(self, session_id: str, session_data: Dict[str, Any]) -> bool:
        """Save CLI session to Redis with TTL."""
        try:
            r = await self.get_redis()
            session_key = f"{SESSION_PREFIX}{session_id}"
            await r.setex(session_key, SESSION_TTL, json.dumps(session_data))
            return True
        except Exception as e:
            logger.error(f"Failed to save CLI session {session_id}: {e}")
            return False
    
    async def delete_session(self, session_id: str) -> bool:
        """Delete CLI session from Redis."""
        try:
            r = await self.get_redis()
            session_key = f"{SESSION_PREFIX}{session_id}"
            result = await r.delete(session_key)
            return result > 0
        except Exception as e:
            logger.error(f"Failed to delete CLI session {session_id}: {e}")
            return False
    
    async def exists(self, session_id: str) -> bool:
        """Check if CLI session exists in Redis."""
        try:
            r = await self.get_redis()
            session_key = f"{SESSION_PREFIX}{session_id}"
            return await r.exists(session_key) > 0
        except Exception as e:
            logger.error(f"Failed to check CLI session {session_id}: {e}")
            return False


# Global instance
_session_manager: Optional[RedisSessionManager] = None


async def get_session_manager() -> RedisSessionManager:
    """Get or create the global session manager."""
    global _session_manager
    if _session_manager is None:
        _session_manager = RedisSessionManager()
    return _session_manager


# Convenience functions
async def get_cli_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Get CLI session from Redis."""
    manager = await get_session_manager()
    return await manager.get_session(session_id)


async def save_cli_session(session_id: str, session_data: Dict[str, Any]) -> bool:
    """Save CLI session to Redis with TTL."""
    manager = await get_session_manager()
    return await manager.save_session(session_id, session_data)


async def delete_cli_session(session_id: str) -> bool:
    """Delete CLI session from Redis."""
    manager = await get_session_manager()
    return await manager.delete_session(session_id)


async def session_exists(session_id: str) -> bool:
    """Check if CLI session exists in Redis."""
    manager = await get_session_manager()
    return await manager.exists(session_id)
