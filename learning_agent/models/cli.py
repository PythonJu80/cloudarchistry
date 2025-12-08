"""
CLI Simulator Pydantic models.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class CLISimulatorRequest(BaseModel):
    """Request to simulate a CLI command"""
    session_id: str
    command: str
    scenario_id: Optional[str] = None
    challenge_id: Optional[str] = None
    aws_services: List[str] = []
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class CLIHelpRequest(BaseModel):
    """Request for CLI help"""
    session_id: str
    command: Optional[str] = None
    topic: Optional[str] = None
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class CLIValidateRequest(BaseModel):
    """Request to validate CLI commands against challenge requirements"""
    session_id: str
    challenge_id: str
    challenge_requirements: List[str]
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None
