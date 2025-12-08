"""
Learning Journey Pydantic models.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class LearningJourneyRequest(BaseModel):
    """Base request for learning journey tracking"""
    profile_id: str
    tenant_id: str


class TrackScenarioRequest(LearningJourneyRequest):
    """Request to track scenario start"""
    scenario_id: str
    scenario_title: str
    company_name: str
    difficulty: str
    aws_services: List[str] = []


class TrackChallengeRequest(LearningJourneyRequest):
    """Request to track challenge completion"""
    scenario_id: str
    challenge_id: str
    challenge_title: str
    score: int
    passed: bool
    aws_services: List[str] = []


class TrackFlashcardRequest(LearningJourneyRequest):
    """Request to track flashcard study"""
    topic: str
    cards_studied: int
    cards_correct: int
    aws_services: List[str] = []


class TrackQuizRequest(LearningJourneyRequest):
    """Request to track quiz attempt"""
    quiz_id: str
    topic: str
    score: int
    total_questions: int
    passed: bool
    aws_services: List[str] = []


class GenerateReportRequest(BaseModel):
    """Request to generate a learning journey report"""
    tenant_id: str
    report_type: str = "progress"  # progress, strengths, recommendations, full
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None
