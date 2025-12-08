"""
Chat-related Pydantic models.
"""
from typing import List, Dict, Optional
from pydantic import BaseModel


class ChatRequest(BaseModel):
    """Request for chat completion"""
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = None
