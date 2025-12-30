"""
CLI Simulator Pydantic models (legacy shape used by crawler and frontend).
"""
from typing import Dict, Any, Optional
from pydantic import BaseModel


class CLISimulatorRequest(BaseModel):
    """Request to simulate an AWS CLI command"""
    command: str
    session_id: Optional[str] = None
    challenge_context: Optional[Dict[str, Any]] = None  # title, description, aws_services, success_criteria
    user_level: str
    cert_code: str
    company_name: str = "Acme Corp"
    industry: str = "Technology"
    business_context: str = ""
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class CLIHelpRequest(BaseModel):
    """Request for CLI help on a topic"""
    topic: str
    challenge_context: Optional[Dict[str, Any]] = None
    user_level: str = "intermediate"
    cert_code: str = "solutions-architect-associate"  # Required for tailored help
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class CLIValidateRequest(BaseModel):
    """Request to validate CLI session against challenge"""
    session_id: str
    challenge_context: Dict[str, Any]
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None
