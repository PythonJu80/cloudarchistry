"""
OpenAI client configuration and tenant/user API key management.
"""
from typing import Dict, Any, Optional
from openai import AsyncOpenAI

from .settings import AVAILABLE_MODELS, DEFAULT_MODEL, logger
from utils import ApiKeyRequiredError
import db


# Cache for tenant OpenAI clients (tenant_id -> AsyncOpenAI)
_tenant_clients: Dict[str, AsyncOpenAI] = {}


async def get_tenant_openai_config(tenant_id: str) -> Optional[Dict[str, Any]]:
    """Get tenant's OpenAI configuration from database."""
    try:
        config = await db.get_tenant_ai_config(tenant_id)
        return config
    except Exception as e:
        logger.warning(f"Failed to get tenant AI config: {e}")
        return None


async def get_openai_client_for_tenant(
    tenant_id: Optional[str] = None,
    user_id: Optional[str] = None
) -> tuple[AsyncOpenAI, str]:
    """
    Get OpenAI client and model for a tenant/user.
    
    Priority:
    1. User's own API key (if set in AcademyUserProfile)
    2. Tenant's API key (if set in Tenant)
    
    No fallback to environment variable - user must configure their own key.
    
    Returns: (client, model_id)
    """
    api_key = None
    model = DEFAULT_MODEL
    
    # Try user-level config first
    if user_id:
        try:
            user_config = await db.get_user_ai_config(user_id)
            if user_config and user_config.get("openai_api_key"):
                api_key = user_config["openai_api_key"]
                model = user_config.get("preferred_model", DEFAULT_MODEL)
                logger.debug(f"Using user's own OpenAI key for {user_id}")
        except Exception as e:
            logger.debug(f"No user AI config: {e}")
    
    # Try tenant-level config
    if not api_key and tenant_id:
        try:
            tenant_config = await db.get_tenant_ai_config(tenant_id)
            if tenant_config and tenant_config.get("openai_api_key"):
                api_key = tenant_config["openai_api_key"]
                model = tenant_config.get("preferred_model", DEFAULT_MODEL)
                logger.debug(f"Using tenant's OpenAI key for {tenant_id}")
        except Exception as e:
            logger.debug(f"No tenant AI config: {e}")
    
    # No fallback - require user/tenant to configure their own key
    if not api_key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Please configure your API key in Settings."
        )
    
    # Validate model exists
    if model not in AVAILABLE_MODELS:
        model = DEFAULT_MODEL
    
    # Create or get cached client
    cache_key = f"{tenant_id or 'system'}:{user_id or 'default'}:{api_key[:8]}"
    if cache_key not in _tenant_clients:
        _tenant_clients[cache_key] = AsyncOpenAI(api_key=api_key)
    
    return _tenant_clients[cache_key], model


def get_async_openai(api_key: Optional[str] = None) -> AsyncOpenAI:
    """Get AsyncOpenAI client. Requires API key from request context or explicit param."""
    from utils import get_request_api_key
    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Please configure your API key in Settings."
        )
    return AsyncOpenAI(api_key=key)
