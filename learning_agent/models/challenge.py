"""
Challenge-related Pydantic models.
"""
from typing import Dict, Any, Optional
from pydantic import BaseModel


class ChallengeQuestionsRequest(BaseModel):
    """
    Request to generate challenge questions (legacy shape expected by frontend and crawler).
    """
    # Challenge context
    challenge: Dict[str, Any]  # id, title, description, hints, success_criteria, aws_services_relevant
    # Business context
    company_name: str
    industry: Optional[str] = None
    business_context: str
    # User context
    user_level: str = "intermediate"
    cert_code: Optional[str] = None
    # Options
    question_count: int = 5
    # BYOK
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class GradeChallengeAnswerRequest(BaseModel):
    """
    Request to grade a challenge question answer (legacy shape used in crawler).
    """
    question: Dict[str, Any]
    user_answer: str
    company_context: str
    user_level: str = "intermediate"
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None
