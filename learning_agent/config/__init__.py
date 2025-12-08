"""
Configuration module for the Learning Agent.
"""
from .settings import (
    AVAILABLE_MODELS,
    DEFAULT_MODEL,
    AWS_SERVICES,
    AWS_RELATIONSHIP_PATTERNS,
    DEFAULT_TENANT_ID,
    logger,
    project_root,
)
from .openai_config import (
    get_tenant_openai_config,
    get_openai_client_for_tenant,
    get_async_openai,
)
