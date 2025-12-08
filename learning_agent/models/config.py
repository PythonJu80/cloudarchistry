"""
Configuration-related Pydantic models.
"""
from typing import Optional
from pydantic import BaseModel


class UpdateAIConfigRequest(BaseModel):
    """Request to update AI configuration"""
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class SetPersonaRequest(BaseModel):
    """Request to set user's persona"""
    persona_id: str
