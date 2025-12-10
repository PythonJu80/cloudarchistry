"""
Cloud Tycoon API Routes
========================
Endpoints for the Cloud Tycoon game mode.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict

from generators.cloud_tycoon import (
    generate_tycoon_journey,
    validate_service_match,
    TycoonJourney,
    BusinessUseCase,
    RequiredService,
)
from utils import ApiKeyRequiredError

router = APIRouter()


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class GenerateJourneyRequest(BaseModel):
    """Request to generate a new Cloud Tycoon journey"""
    user_level: str = "intermediate"
    cert_code: Optional[str] = None
    theme: Optional[str] = None  # Random if not provided


class ServiceMatchRequest(BaseModel):
    """Request to validate service matches for a use case"""
    use_case_id: str
    business_name: str
    use_case_title: str
    use_case_description: str
    required_services: List[Dict]  # [{service_id, service_name, category, reason}]
    contract_value: int
    difficulty: str
    submitted_services: List[str]  # List of service_ids the player dropped


class ServiceMatchResponse(BaseModel):
    """Response for service match validation"""
    correct: bool
    score: float
    matched: List[str]
    missing: List[str]
    extra: List[str]
    contract_earned: int
    feedback: str
    required_services: List[Dict]


class RequiredServiceResponse(BaseModel):
    """A required service in the response"""
    service_id: str
    service_name: str
    category: str
    reason: str


class BusinessUseCaseResponse(BaseModel):
    """A business use case in the journey response"""
    id: str
    business_name: str
    industry: str
    icon: str
    use_case_title: str
    use_case_description: str
    required_services: List[RequiredServiceResponse]
    contract_value: int
    difficulty: str
    hints: List[str]
    compliance_requirements: Optional[List[str]] = None


class JourneyResponse(BaseModel):
    """Response for a generated journey"""
    id: str
    journey_name: str
    theme: str
    businesses: List[BusinessUseCaseResponse]
    total_contract_value: int
    difficulty_distribution: Dict[str, int]


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/journey/generate", response_model=JourneyResponse)
async def generate_journey(request: GenerateJourneyRequest):
    """
    Generate a new Cloud Tycoon journey with 10 business use cases.
    
    Each business has a use case requiring 2-5 AWS services.
    Player must match the correct services to earn contract money.
    """
    try:
        journey = await generate_tycoon_journey(
            user_level=request.user_level,
            cert_code=request.cert_code,
            theme=request.theme,
        )
        
        return JourneyResponse(
            id=journey.id,
            journey_name=journey.journey_name,
            theme=journey.theme,
            businesses=[
                BusinessUseCaseResponse(
                    id=biz.id,
                    business_name=biz.business_name,
                    industry=biz.industry,
                    icon=biz.icon,
                    use_case_title=biz.use_case_title,
                    use_case_description=biz.use_case_description,
                    required_services=[
                        RequiredServiceResponse(
                            service_id=svc.service_id,
                            service_name=svc.service_name,
                            category=svc.category,
                            reason=svc.reason,
                        )
                        for svc in biz.required_services
                    ],
                    contract_value=biz.contract_value,
                    difficulty=biz.difficulty,
                    hints=biz.hints,
                    compliance_requirements=biz.compliance_requirements,
                )
                for biz in journey.businesses
            ],
            total_contract_value=journey.total_contract_value,
            difficulty_distribution=journey.difficulty_distribution,
        )
    except ApiKeyRequiredError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate journey: {str(e)}")


@router.post("/validate", response_model=ServiceMatchResponse)
async def validate_services(request: ServiceMatchRequest):
    """
    Validate if the player's submitted services match the use case requirements.
    
    Returns score, matched/missing/extra services, and contract earned.
    """
    try:
        # Reconstruct the use case from request data
        use_case = BusinessUseCase(
            id=request.use_case_id,
            business_name=request.business_name,
            industry="",  # Not needed for validation
            icon="",
            use_case_title=request.use_case_title,
            use_case_description=request.use_case_description,
            required_services=[
                RequiredService(
                    service_id=svc.get("service_id", ""),
                    service_name=svc.get("service_name", ""),
                    category=svc.get("category", ""),
                    reason=svc.get("reason", ""),
                )
                for svc in request.required_services
            ],
            contract_value=request.contract_value,
            difficulty=request.difficulty,
            hints=[],
        )
        
        result = await validate_service_match(
            use_case=use_case,
            submitted_services=request.submitted_services,
        )
        
        return ServiceMatchResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@router.get("/themes")
async def get_journey_themes():
    """Get available journey themes for Cloud Tycoon."""
    from generators.cloud_tycoon import JOURNEY_THEMES
    return {"themes": JOURNEY_THEMES}
