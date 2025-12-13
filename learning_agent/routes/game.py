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


class HotStreakRequest(BaseModel):
    """Request body for Hot Streak questions - mixed types"""
    user_level: str = "intermediate"
    cert_code: Optional[str] = None
    weak_topics: Optional[List[str]] = None
    recent_topics: Optional[List[str]] = None
    question_count: int = 30
    question_types: Optional[List[str]] = None  # Types to include


class HotStreakQuestionResponse(BaseModel):
    """Single Hot Streak question with type"""
    id: str
    type: str  # identify_service, best_for, inside_vpc, category_match, connection, service_purpose
    question: str
    options: List[str]
    correct_index: int
    topic: str
    difficulty: str
    explanation: Optional[str] = None


class HotStreakResponse(BaseModel):
    """Response for Hot Streak questions"""
    questions: List[HotStreakQuestionResponse]
    topics_covered: List[str]


@router.post("/hot-streak/generate", response_model=HotStreakResponse)
async def generate_hot_streak(request: HotStreakRequest):
    """
    Generate Hot Streak questions - mixed question types for streak-based gameplay.
    
    Question types include:
    - identify_service: Name the AWS service
    - best_for: Which service is best for X?
    - inside_vpc: True/False about VPC requirements
    - category_match: Match service to category
    - connection: Architecture/networking questions
    - service_purpose: What does this service do?
    """
    try:
        # Reuse sniper quiz generator but request mixed types
        result = await generate_sniper_quiz_questions(
            user_level=request.user_level,
            cert_code=request.cert_code,
            weak_topics=request.weak_topics,
            recent_topics=request.recent_topics,
            question_count=request.question_count,
        )
        
        # Assign question types based on content
        question_types = request.question_types or [
            "identify_service", "best_for", "inside_vpc", 
            "category_match", "connection", "service_purpose"
        ]
        
        questions = []
        for idx, q in enumerate(result.questions):
            # Rotate through question types
            q_type = question_types[idx % len(question_types)]
            
            questions.append(HotStreakQuestionResponse(
                id=q.id,
                type=q_type,
                question=q.question,
                options=q.options,
                correct_index=q.correct_index,
                topic=q.topic,
                difficulty=q.difficulty,
                explanation=q.explanation,
            ))
        
        return HotStreakResponse(
            questions=questions,
            topics_covered=result.topics_covered,
        )
    except ApiKeyRequiredError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")
