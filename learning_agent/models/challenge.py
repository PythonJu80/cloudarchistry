"""
Challenge-related Pydantic models.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class ChallengeQuestionsRequest(BaseModel):
    """Request to generate challenge questions"""
    scenario_id: str
    challenge_id: str
    challenge_title: str
    challenge_description: str
    aws_services: List[str] = []
    difficulty: str = "intermediate"
    num_questions: int = 5
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class GradeChallengeAnswerRequest(BaseModel):
    """Request to grade a challenge answer"""
    session_id: str
    scenario_id: str
    challenge_id: str
    question_id: str
    question_text: str
    user_answer: str
    correct_answer: Optional[str] = None
    aws_services: List[str] = []
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None
