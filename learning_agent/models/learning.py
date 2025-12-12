"""
Learning-related Pydantic models.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class CompanyInfo(BaseModel):
    """Information about a company gathered from research"""
    name: str
    industry: str
    description: str
    headquarters: Optional[str] = None
    employee_count: Optional[str] = None
    revenue: Optional[str] = None
    key_services: List[str] = []
    technology_stack: List[str] = []
    compliance_requirements: List[str] = []
    business_challenges: List[str] = []
    data_types: List[str] = []
    traffic_patterns: Optional[str] = None
    global_presence: Optional[str] = None


class ScenarioChallenge(BaseModel):
    """A single challenge within a scenario"""
    id: str
    title: str
    description: str
    difficulty: str
    points: int
    hints: List[str] = []
    success_criteria: List[str] = []
    aws_services_relevant: List[str] = []
    estimated_time_minutes: int = 30


class CloudScenario(BaseModel):
    """A complete cloud architecture scenario"""
    id: str
    company_name: str
    scenario_title: str
    scenario_description: str
    business_context: str
    technical_requirements: List[str]
    compliance_requirements: List[str]
    constraints: List[str]
    challenges: List[ScenarioChallenge]
    learning_objectives: List[str]
    difficulty: str
    estimated_total_time_minutes: int
    tags: List[str]


class LocationRequest(BaseModel):
    """Request to generate scenario/challenge for a location"""
    place_id: Optional[str] = None
    company_name: str
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    industry: Optional[str] = None
    user_level: str = "intermediate"
    cert_code: Optional[str] = None  # e.g. "SAA", "DVA", "SOA" - triggers persona
    openai_api_key: Optional[str] = None  # BYOK - user's own API key
    preferred_model: Optional[str] = None  # User's preferred model


class ResearchResult(BaseModel):
    """Result from researching a company"""
    company_info: CompanyInfo
    sources: List[str] = []
    confidence: float = 0.0


class ScenarioResponse(BaseModel):
    """Response containing generated scenario/challenge"""
    success: bool
    scenario: Optional[CloudScenario] = None
    company_info: Optional[CompanyInfo] = None
    cert_code: Optional[str] = None  # Which cert persona was used
    cert_name: Optional[str] = None  # Full cert name
    error: Optional[str] = None


class GenerateContentRequest(BaseModel):
    """Request to generate learning content"""
    scenario_id: Optional[str] = None  # Optional - can generate from certification instead
    content_type: str = "flashcards"
    user_level: str = "intermediate"
    user_id: Optional[str] = None  # To fetch user's persona
    persona_id: Optional[str] = None  # Override persona
    certification_code: Optional[str] = None  # e.g. SAA, DVA - used when no scenario_id
    card_count: int = 20
    telemetry: Optional[Dict[str, Any]] = None  # User stats for personalization
    options: Optional[Dict[str, Any]] = None
    openai_api_key: Optional[str] = None  # BYOK - user's own API key
    preferred_model: Optional[str] = None  # User's preferred model


class StudyPlanRequest(BaseModel):
    """Request to generate a personalized study plan"""
    target_exam: Optional[str] = None
    time_horizon_weeks: int = 6
    study_hours_per_week: int = 6
    confidence_level: str = "intermediate"
    weak_areas: List[str] = []
    focus_domains: List[str] = []
    preferred_formats: List[str] = []
    learner_notes: Optional[str] = None
    telemetry_summary: Optional[str] = None
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class StudyGuideRequest(BaseModel):
    """Request to generate a personalized study guide with platform-specific actions"""
    target_certification: str
    skill_level: str = "intermediate"
    time_horizon_weeks: int = 6
    hours_per_week: int = 6
    learning_style: str = "hands_on"  # visual, auditory, reading, hands_on
    coach_notes: Optional[str] = None
    telemetry_summary: Optional[str] = None
    platform_features: Optional[Dict[str, Any]] = None
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class FormatStudyGuideRequest(BaseModel):
    """Request to FORMAT a study guide from pre-selected content.
    The tool has already decided what content goes in - AI just formats it nicely.
    """
    target_certification: str
    skill_level: str = "intermediate"
    time_horizon_weeks: int = 6
    hours_per_week: int = 6
    learning_styles: List[str] = ["hands_on"]  # Now supports multiple
    coach_notes: Optional[str] = None
    # PRE-SELECTED content from the database - AI does NOT decide this
    structured_content: Dict[str, Any]
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class LearningChatRequestWithSession(BaseModel):
    """Request for learning chat with session tracking"""
    message: str
    session_id: Optional[str] = None  # For continuing conversations
    scenario_id: Optional[str] = None
    challenge_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None  # For personalization
    openai_api_key: Optional[str] = None  # BYOK - user's own API key
    preferred_model: Optional[str] = None  # User's preferred model


class GenerateFlashcardsFromCertRequest(BaseModel):
    """Request to generate flashcards from user's certification + telemetry (no scenario required)"""
    profile_id: str
    certification_code: str  # SAA, DVA, SOA, etc.
    skill_level: str = "intermediate"
    card_count: int = 20
    telemetry: Optional[Dict[str, Any]] = None  # User stats: challenges completed, points, etc.
    scenario_id: Optional[str] = None  # Optional: still support scenario-based if provided
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None
