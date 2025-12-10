"""
Game Modes API Routes
======================
Endpoints for generating personalized game mode questions.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from generators.game_modes import (
    generate_sniper_quiz_questions,
    generate_speed_round_questions,
    GameQuestion,
)
from utils import ApiKeyRequiredError

router = APIRouter()


class SniperQuizRequest(BaseModel):
    """Request body for Sniper Quiz questions"""
    user_level: str = "intermediate"  # beginner, intermediate, advanced, expert
    cert_code: Optional[str] = None   # e.g., "SAA-C03", "DVA-C02"
    weak_topics: Optional[List[str]] = None  # Topics to prioritize
    recent_topics: Optional[List[str]] = None  # Recently studied topics
    question_count: int = 10


class SpeedRoundRequest(BaseModel):
    """Request body for Speed Round questions"""
    user_level: str = "intermediate"
    cert_code: Optional[str] = None
    topic_focus: Optional[str] = None  # Single topic to focus on
    question_count: int = 20


class GameQuestionResponse(BaseModel):
    """Single question response"""
    id: str
    question: str
    options: List[str]
    correct_index: int
    topic: str
    difficulty: str
    explanation: str
    points: int


class SniperQuizResponse(BaseModel):
    """Response for Sniper Quiz questions"""
    questions: List[GameQuestionResponse]
    total_points: int
    topics_covered: List[str]


@router.post("/sniper-quiz/generate", response_model=SniperQuizResponse)
async def generate_sniper_quiz(request: SniperQuizRequest):
    """
    Generate personalized Sniper Quiz questions.
    
    Uses AI to create questions tailored to:
    - User's skill level
    - Target certification
    - Weak topics (prioritized)
    - Recent study topics
    """
    try:
        result = await generate_sniper_quiz_questions(
            user_level=request.user_level,
            cert_code=request.cert_code,
            weak_topics=request.weak_topics,
            recent_topics=request.recent_topics,
            question_count=request.question_count,
        )
        
        return SniperQuizResponse(
            questions=[
                GameQuestionResponse(
                    id=q.id,
                    question=q.question,
                    options=q.options,
                    correct_index=q.correct_index,
                    topic=q.topic,
                    difficulty=q.difficulty,
                    explanation=q.explanation,
                    points=q.points,
                )
                for q in result.questions
            ],
            total_points=result.total_points,
            topics_covered=result.topics_covered,
        )
    except ApiKeyRequiredError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")


@router.post("/speed-round/generate", response_model=SniperQuizResponse)
async def generate_speed_round(request: SpeedRoundRequest):
    """
    Generate Speed Round questions - rapid-fire, shorter questions.
    """
    try:
        result = await generate_speed_round_questions(
            user_level=request.user_level,
            cert_code=request.cert_code,
            topic_focus=request.topic_focus,
            question_count=request.question_count,
        )
        
        return SniperQuizResponse(
            questions=[
                GameQuestionResponse(
                    id=q.id,
                    question=q.question,
                    options=q.options,
                    correct_index=q.correct_index,
                    topic=q.topic,
                    difficulty=q.difficulty,
                    explanation=q.explanation,
                    points=q.points,
                )
                for q in result.questions
            ],
            total_points=result.total_points,
            topics_covered=result.topics_covered,
        )
    except ApiKeyRequiredError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")
