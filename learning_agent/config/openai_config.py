"""
OpenAI client configuration and tenant/user API key management.
"""
from typing import Dict, Any, Optional
from openai import AsyncOpenAI
import os

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
    
    Priority (NEW - Monthly subscription model with BYOK fallback):
    1. Environment variable API key (OPENAI_API_KEY) - Default for all users
    2. User's own API key (BYOK fallback if they hit rate limits)
    3. Tenant's API key (BYOK fallback at tenant level)
    
    This allows:
    - All users use platform API key by default (monthly fee covers this)
    - Users can bring their own key if they hit rate limits
    - Keeps BYOK logic for future flexibility
    
    Returns: (client, model_id)
    """
    api_key = None
    model = DEFAULT_MODEL
    key_source = "none"
    
    # Priority 1: Environment variable (platform's API key)
    env_api_key = os.getenv("OPENAI_API_KEY")
    if env_api_key:
        api_key = env_api_key
        key_source = "platform"
        logger.debug("Using platform OpenAI API key from environment")
    
    # Priority 2: User's own API key (BYOK fallback for rate-limited users)
    if user_id:
        try:
            user_config = await db.get_user_ai_config(user_id)
            if user_config and user_config.get("openai_api_key"):
                api_key = user_config["openai_api_key"]
                model = user_config.get("preferred_model", DEFAULT_MODEL)
                key_source = "user_byok"
                logger.info(f"Using user's BYOK API key for {user_id} (rate limit fallback)")
        except Exception as e:
            logger.debug(f"No user AI config: {e}")
    
    # Priority 3: Tenant's API key (BYOK fallback at tenant level)
    if not api_key and tenant_id:
        try:
            tenant_config = await db.get_tenant_ai_config(tenant_id)
            if tenant_config and tenant_config.get("openai_api_key"):
                api_key = tenant_config["openai_api_key"]
                model = tenant_config.get("preferred_model", DEFAULT_MODEL)
                key_source = "tenant_byok"
                logger.info(f"Using tenant's BYOK API key for {tenant_id} (rate limit fallback)")
        except Exception as e:
            logger.debug(f"No tenant AI config: {e}")
    
    # If still no API key, raise error
    if not api_key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Platform key not configured. Please contact support or configure your own API key in Settings."
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
    """
    Get AsyncOpenAI client.
    
    Priority:
    1. Explicit api_key parameter (for BYOK)
    2. Request context API key (for BYOK)
    3. Environment variable (platform's API key)
    
    Returns: AsyncOpenAI client
    """
    from utils import get_request_api_key
    
    # Try explicit parameter first (BYOK)
    key = api_key
    
    # Try request context (BYOK)
    if not key:
        key = get_request_api_key()
    
    # Fallback to environment variable (platform key)
    if not key:
        key = os.getenv("OPENAI_API_KEY")
    
    if not key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Platform key not configured. Please contact support or configure your own API key in Settings."
        )
    
    return AsyncOpenAI(api_key=key)
