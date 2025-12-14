"""
Speed Deploy API Routes
========================
Endpoints for the Speed Deploy game mode.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict

from generators.speed_deploy import (
    generate_deploy_brief,
    validate_deployment,
    DeployBrief,
    ClientRequirement,
)
from utils import ApiKeyRequiredError

router = APIRouter()


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class GenerateBriefRequest(BaseModel):
    """Request to generate a deployment brief"""
    user_level: str = "intermediate"
    cert_code: Optional[str] = None
    difficulty: Optional[str] = None  # easy, medium, hard - random if not provided
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class ValidateDeploymentRequest(BaseModel):
    """Request to validate a player's deployment"""
    brief_id: str
    client_name: str
    industry: str
    requirements: List[Dict]
    available_services: List[str]
    optimal_solution: List[str]
    acceptable_solutions: List[List[str]]
    time_limit: int
    difficulty: str
    max_score: int
    submitted_services: List[str]
    time_remaining: int


class RequirementResponse(BaseModel):
    """A requirement in the response"""
    category: str
    description: str
    priority: str


class BriefResponse(BaseModel):
    """Response for a generated brief"""
    id: str
    client_name: str
    industry: str
    icon: str
    requirements: List[RequirementResponse]
    available_services: List[str]
    optimal_solution: List[str]
    acceptable_solutions: List[List[str]]
    time_limit: int
    difficulty: str
    max_score: int


class ValidateResponse(BaseModel):
    """Response for deployment validation"""
    met_requirements: bool
    is_optimal: bool
    is_acceptable: bool
    score: int
    max_score: int
    speed_bonus: int
    overengineering_penalty: int
    missing_services: List[str]
    extra_services: List[str]
    feedback: str
    optimal_solution: List[str]
    requirement_analysis: List[Dict]


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/brief/generate", response_model=BriefResponse)
async def generate_brief(request: GenerateBriefRequest):
    """
    Generate a Speed Deploy challenge brief.
    
    Returns a client brief with requirements and a palette of services to choose from.
    """
    try:
        brief = await generate_deploy_brief(
            user_level=request.user_level,
            cert_code=request.cert_code,
            difficulty=request.difficulty,
            api_key=request.openai_api_key,
            model=request.preferred_model,
        )
        
        return BriefResponse(
            id=brief.id,
            client_name=brief.client_name,
            industry=brief.industry,
            icon=brief.icon,
            requirements=[
                RequirementResponse(
                    category=req.category,
                    description=req.description,
                    priority=req.priority,
                )
                for req in brief.requirements
            ],
            available_services=brief.available_services,
            optimal_solution=brief.optimal_solution,
            acceptable_solutions=brief.acceptable_solutions,
            time_limit=brief.time_limit,
            difficulty=brief.difficulty,
            max_score=brief.max_score,
        )
    except ApiKeyRequiredError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate brief: {str(e)}")


@router.post("/validate", response_model=ValidateResponse)
async def validate_deploy(request: ValidateDeploymentRequest):
    """
    Validate the player's deployment against the brief requirements.
    
    Returns score, feedback, and analysis of which requirements were met.
    """
    try:
        # Reconstruct brief from request
        requirements = [
            ClientRequirement(
                category=req.get("category", "general"),
                description=req.get("description", ""),
                priority=req.get("priority", "important"),
            )
            for req in request.requirements
        ]
        
        brief = DeployBrief(
            id=request.brief_id,
            client_name=request.client_name,
            industry=request.industry,
            icon="",
            requirements=requirements,
            available_services=request.available_services,
            optimal_solution=request.optimal_solution,
            acceptable_solutions=request.acceptable_solutions,
            time_limit=request.time_limit,
            difficulty=request.difficulty,
            max_score=request.max_score,
        )
        
        result = validate_deployment(
            brief=brief,
            submitted_services=request.submitted_services,
            time_remaining=request.time_remaining,
        )
        
        return ValidateResponse(
            met_requirements=result.met_requirements,
            is_optimal=result.is_optimal,
            is_acceptable=result.is_acceptable,
            score=result.score,
            max_score=result.max_score,
            speed_bonus=result.speed_bonus,
            overengineering_penalty=result.overengineering_penalty,
            missing_services=result.missing_services,
            extra_services=result.extra_services,
            feedback=result.feedback,
            optimal_solution=result.optimal_solution,
            requirement_analysis=result.requirement_analysis,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")
