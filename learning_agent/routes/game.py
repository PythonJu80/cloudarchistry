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
    generate_hot_streak_questions,
    GameQuestion,
    HotStreakQuestions,
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
    openai_api_key: Optional[str] = None  # User's API key (BYOK)
    preferred_model: Optional[str] = None  # User's preferred model


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
            api_key=request.openai_api_key,
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


class HotStreakRequest(BaseModel):
    """Request body for Hot Streak questions"""
    user_level: str = "intermediate"
    cert_code: Optional[str] = None
    question_count: int = 25
    exclude_ids: Optional[List[str]] = None
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class HotStreakQuestionResponse(BaseModel):
    """Single Hot Streak question"""
    id: str
    question: str
    options: List[str]
    correct_index: int
    topic: str
    difficulty: str
    explanation: Optional[str] = None
    points: int = 10


class HotStreakResponse(BaseModel):
    """Response for Hot Streak questions"""
    questions: List[HotStreakQuestionResponse]
    topics_covered: List[str]


@router.post("/hot-streak/generate", response_model=HotStreakResponse)
async def generate_hot_streak(request: HotStreakRequest):
    """
    Generate Hot Streak questions - quick-fire questions for 60-second timed gameplay.
    Uses dedicated Hot Streak generator with user's API key.
    """
    try:
        result = await generate_hot_streak_questions(
            user_level=request.user_level,
            cert_code=request.cert_code,
            question_count=request.question_count,
            exclude_ids=request.exclude_ids,
            api_key=request.openai_api_key,
        )
        
        questions = [
            HotStreakQuestionResponse(
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
        ]
        
        return HotStreakResponse(
            questions=questions,
            topics_covered=result.topics_covered,
        )
    except ApiKeyRequiredError as e:
        raise HTTPException(status_code=402, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")
