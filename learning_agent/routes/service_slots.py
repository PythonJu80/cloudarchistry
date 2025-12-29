"""
Service Slots API Routes
=========================
Endpoints for the Service Slots game mode.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict

from generators.service_slots import (
    generate_slot_challenge,
    generate_slot_batch,
    validate_slot_answer,
    SlotChallenge,
    SlotService,
    AnswerOption,
)
from utils import ApiKeyRequiredError

router = APIRouter()


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class GenerateChallengeRequest(BaseModel):
    """Request to generate a slot challenge"""
    user_level: str = "intermediate"
    cert_code: Optional[str] = None
    difficulty: Optional[str] = None  # easy, medium, hard - random if not provided
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class GenerateBatchRequest(BaseModel):
    """Request to generate multiple challenges"""
    count: int = 5
    user_level: str = "intermediate"
    cert_code: Optional[str] = None
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class ValidateAnswerRequest(BaseModel):
    """Request to validate a player's answer"""
    challenge_id: str
    services: List[Dict]  # The 3 services
    pattern_name: str
    options: List[Dict]  # The 4 options
    user_level: str
    base_payout: float
    selected_option_id: str
    bet_amount: int


class SlotServiceResponse(BaseModel):
    """A service in the response"""
    service_id: str
    service_name: str
    category: str


class AnswerOptionResponse(BaseModel):
    """An answer option in the response"""
    id: str
    text: str
    is_correct: bool
    explanation: str


class ChallengeResponse(BaseModel):
    """Response for a generated challenge"""
    id: str
    services: List[SlotServiceResponse]
    pattern_name: str
    pattern_description: str
    options: List[AnswerOptionResponse]
    user_level: str
    base_payout: float


class ValidateResponse(BaseModel):
    """Response for answer validation"""
    correct: bool
    winnings: int
    correct_answer: str
    explanation: str
    pattern_name: str
    pattern_description: str


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/challenge/generate", response_model=ChallengeResponse)
async def generate_challenge(request: GenerateChallengeRequest):
    """
    Generate a single slot machine challenge.
    
    Returns 3 AWS services and 4 multiple choice options.
    Player must identify what architecture pattern the services represent.
    """
    try:
        challenge = await generate_slot_challenge(
            user_level=request.user_level,
            cert_code=request.cert_code,
            api_key=request.openai_api_key,
            model=request.preferred_model,
        )
        
        return ChallengeResponse(
            id=challenge.id,
            services=[
                SlotServiceResponse(
                    service_id=svc.service_id,
                    service_name=svc.service_name,
                    category=svc.category,
                )
                for svc in challenge.services
            ],
            pattern_name=challenge.pattern_name,
            pattern_description=challenge.pattern_description,
            options=[
                AnswerOptionResponse(
                    id=opt.id,
                    text=opt.text,
                    is_correct=opt.is_correct,
                    explanation=opt.explanation,
                )
                for opt in challenge.options
            ],
            user_level=challenge.user_level,
            base_payout=challenge.base_payout,
        )
    except ApiKeyRequiredError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate challenge: {str(e)}")


@router.post("/challenge/batch", response_model=List[ChallengeResponse])
async def generate_challenges_batch(request: GenerateBatchRequest):
    """
    Generate multiple challenges at once for smoother UX.
    Useful for preloading the next few spins.
    """
    try:
        challenges = await generate_slot_batch(
            count=request.count,
            user_level=request.user_level,
            cert_code=request.cert_code,
            api_key=request.openai_api_key,
            model=request.preferred_model,
        )
        
        return [
            ChallengeResponse(
                id=challenge.id,
                services=[
                    SlotServiceResponse(
                        service_id=svc.service_id,
                        service_name=svc.service_name,
                        category=svc.category,
                    )
                    for svc in challenge.services
                ],
                pattern_name=challenge.pattern_name,
                pattern_description=challenge.pattern_description,
                options=[
                    AnswerOptionResponse(
                        id=opt.id,
                        text=opt.text,
                        is_correct=opt.is_correct,
                        explanation=opt.explanation,
                    )
                    for opt in challenge.options
                ],
                user_level=challenge.user_level,
                base_payout=challenge.base_payout,
            )
            for challenge in challenges
        ]
    except ApiKeyRequiredError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate challenges: {str(e)}")


@router.post("/validate", response_model=ValidateResponse)
async def validate_answer(request: ValidateAnswerRequest):
    """
    Validate the player's answer and calculate winnings.
    
    If correct: winnings = bet_amount * base_payout
    If wrong: winnings = -bet_amount (they lose their bet)
    """
    try:
        # Reconstruct challenge from request
        challenge = SlotChallenge(
            id=request.challenge_id,
            services=[
                SlotService(
                    service_id=svc.get("service_id", ""),
                    service_name=svc.get("service_name", ""),
                    category=svc.get("category", ""),
                )
                for svc in request.services
            ],
            pattern_name=request.pattern_name,
            pattern_description="",
            options=[
                AnswerOption(
                    id=opt.get("id", ""),
                    text=opt.get("text", ""),
                    is_correct=opt.get("is_correct", False),
                    explanation=opt.get("explanation", ""),
                )
                for opt in request.options
            ],
            user_level=request.user_level,
            base_payout=request.base_payout,
        )
        
        result = validate_slot_answer(
            challenge=challenge,
            selected_option_id=request.selected_option_id,
            bet_amount=request.bet_amount,
        )
        
        return ValidateResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")
