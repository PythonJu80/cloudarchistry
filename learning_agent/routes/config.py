"""
Configuration API routes - AI config, personas, models.
"""
from fastapi import APIRouter

from models.config import UpdateAIConfigRequest, SetPersonaRequest
from config.settings import AVAILABLE_MODELS

router = APIRouter()


@router.get("/models")
async def list_available_models():
    """List available AI models"""
    return {"models": list(AVAILABLE_MODELS.values())}


@router.get("/tenant/{tenant_id}/ai-config")
async def get_tenant_ai_config_endpoint(tenant_id: str):
    """Get tenant AI config"""
    from crawl4ai_mcp import get_tenant_ai_config_endpoint as original_endpoint
    return await original_endpoint(tenant_id)


@router.put("/tenant/{tenant_id}/ai-config")
async def update_tenant_ai_config_endpoint(tenant_id: str, request: UpdateAIConfigRequest):
    """Update tenant AI config"""
    from crawl4ai_mcp import update_tenant_ai_config_endpoint as original_endpoint
    return await original_endpoint(tenant_id, request)


@router.delete("/tenant/{tenant_id}/ai-config/key")
async def remove_tenant_api_key(tenant_id: str):
    """Remove tenant API key"""
    from crawl4ai_mcp import remove_tenant_api_key as original_endpoint
    return await original_endpoint(tenant_id)


@router.get("/user/{user_id}/ai-config")
async def get_user_ai_config_endpoint(user_id: str):
    """Get user AI config"""
    from crawl4ai_mcp import get_user_ai_config_endpoint as original_endpoint
    return await original_endpoint(user_id)


@router.put("/user/{user_id}/ai-config")
async def update_user_ai_config_endpoint(user_id: str, request: UpdateAIConfigRequest):
    """Update user AI config"""
    from crawl4ai_mcp import update_user_ai_config_endpoint as original_endpoint
    return await original_endpoint(user_id, request)


@router.get("/personas")
async def list_personas():
    """List available personas"""
    from crawl4ai_mcp import list_personas as original_endpoint
    return await original_endpoint()


@router.get("/personas/{persona_id}")
async def get_persona(persona_id: str):
    """Get persona details"""
    from crawl4ai_mcp import get_persona as original_endpoint
    return await original_endpoint(persona_id)


@router.put("/user/{user_id}/persona")
async def set_user_persona(user_id: str, request: SetPersonaRequest):
    """Set user persona"""
    from crawl4ai_mcp import set_user_persona as original_endpoint
    return await original_endpoint(user_id, request)


@router.get("/user/{user_id}/persona")
async def get_user_persona(user_id: str):
    """Get user persona"""
    from crawl4ai_mcp import get_user_persona as original_endpoint
    return await original_endpoint(user_id)
