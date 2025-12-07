"""
Quiz Generator Module
=====================
Generates quizzes with multiple question types.
"""

import json
import os
from typing import List, Optional, Dict
from pydantic import BaseModel
from openai import AsyncOpenAI

from prompts import QUIZ_GENERATOR_PROMPT, PERSONA_QUIZ_PROMPT
from utils import get_request_api_key, ApiKeyRequiredError


class QuizOption(BaseModel):
    """Option for multiple choice questions"""
    id: str
    text: str
    is_correct: bool


class QuizQuestion(BaseModel):
    """Single quiz question"""
    id: str
    question: str
    question_type: str  # multiple_choice, multi_select, true_false, free_text
    options: List[QuizOption] = []  # For choice questions
    correct_answer: Optional[str] = None  # For free text
    explanation: str
    difficulty: str  # easy, medium, hard
    points: int
    aws_services: List[str] = []
    tags: List[str] = []


class Quiz(BaseModel):
    """Generated quiz"""
    title: str
    description: str
    questions: List[QuizQuestion]
    total_questions: int
    total_points: int
    passing_score: int  # Percentage
    estimated_time_minutes: int
    difficulty_distribution: dict


async def _chat_json(messages: List[Dict], model: str = "gpt-4o", api_key: Optional[str] = None) -> Dict:
    """Simple JSON chat completion."""
    # Priority: explicit param > request context (no environment fallback)
    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Please configure your API key in Settings."
        )
    client = AsyncOpenAI(api_key=key)
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.7,
    )
    return json.loads(response.choices[0].message.content)


async def generate_quiz(
    scenario_title: str,
    business_context: str,
    aws_services: List[str],
    learning_objectives: List[str],
    user_level: str = "intermediate",
    question_count: int = 10,
    challenges: Optional[List[dict]] = None,
    persona_context: Optional[Dict] = None,
) -> Quiz:
    """Generate a quiz for a scenario - persona-aware."""
    
    # Use persona-specific prompt if provided
    if persona_context:
        base_prompt = PERSONA_QUIZ_PROMPT.format(
            scenario_title=scenario_title,
            business_context=business_context,
            cert_name=persona_context.get("cert_name", "AWS Certification"),
            focus_areas=persona_context.get("focus_areas", ""),
            level=persona_context.get("level", "associate"),
            question_count=question_count,
        )
    else:
        base_prompt = QUIZ_GENERATOR_PROMPT.format(
            scenario_title=scenario_title,
            business_context=business_context,
            aws_services=", ".join(aws_services),
            learning_objectives="\n".join(f"- {obj}" for obj in learning_objectives),
            user_level=user_level,
            question_count=question_count,
        )
    
    system_prompt = f"""You create educational quizzes for cloud architecture.
Return JSON with: title, description, questions (array of: id, question, question_type, options (array of: id, text, is_correct), explanation, difficulty, points, aws_services, tags)

{base_prompt}"""
    
    user_prompt = f"Generate {question_count} questions for: {scenario_title}"
    if persona_context:
        user_prompt += f"\nStyle questions like {persona_context.get('cert_name', 'AWS')} certification exam."
    if challenges:
        user_prompt += "\n\nChallenges:\n"
        for c in challenges:
            user_prompt += f"- {c.get('title', '')}\n"
    
    result = await _chat_json([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ])
    
    questions = []
    for q in result.get("questions", []):
        options = [QuizOption(**o) for o in q.get("options", [])]
        questions.append(QuizQuestion(
            id=q.get("id", ""),
            question=q.get("question", ""),
            question_type=q.get("question_type", "multiple_choice"),
            options=options,
            explanation=q.get("explanation", ""),
            difficulty=q.get("difficulty", "medium"),
            points=q.get("points", 10),
            aws_services=q.get("aws_services", []),
            tags=q.get("tags", []),
        ))
    
    return Quiz(
        title=result.get("title", f"Quiz: {scenario_title}"),
        description=result.get("description", ""),
        questions=questions,
        total_questions=len(questions),
        total_points=sum(q.points for q in questions),
        passing_score=70,
        estimated_time_minutes=int(len(questions) * 1.5),
        difficulty_distribution={
            "easy": len([q for q in questions if q.difficulty == "easy"]),
            "medium": len([q for q in questions if q.difficulty == "medium"]),
            "hard": len([q for q in questions if q.difficulty == "hard"]),
        },
    )


async def generate_quiz_for_topic(
    topic: str,
    question_count: int = 10,
    user_level: str = "intermediate",
) -> Quiz:
    """Generate a quiz on any AWS topic (alias for generate_service_quiz)."""
    return await generate_service_quiz(
        service_name=topic,
        user_level=user_level,
        question_count=question_count,
    )


async def generate_service_quiz(
    service_name: str,
    user_level: str = "intermediate",
    question_count: int = 10,
    focus_areas: Optional[List[str]] = None,
) -> Quiz:
    """Generate a quiz focused on a specific AWS service."""
    
    system_prompt = f"""Generate a {question_count}-question quiz about AWS {service_name}.
User Level: {user_level}
{"Focus Areas: " + ", ".join(focus_areas) if focus_areas else ""}

Return JSON with: title, description, questions (array of: id, question, question_type, options, explanation, difficulty, points, aws_services, tags)"""

    result = await _chat_json([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Generate quiz for AWS {service_name}"},
    ])
    
    questions = []
    for q in result.get("questions", []):
        options = [QuizOption(**o) for o in q.get("options", [])]
        questions.append(QuizQuestion(
            id=q.get("id", ""),
            question=q.get("question", ""),
            question_type=q.get("question_type", "multiple_choice"),
            options=options,
            explanation=q.get("explanation", ""),
            difficulty=q.get("difficulty", "medium"),
            points=q.get("points", 10),
            aws_services=q.get("aws_services", [service_name]),
            tags=q.get("tags", []),
        ))
    
    return Quiz(
        title=result.get("title", f"AWS {service_name} Quiz"),
        description=result.get("description", ""),
        questions=questions,
        total_questions=len(questions),
        total_points=sum(q.points for q in questions),
        passing_score=70,
        estimated_time_minutes=int(len(questions) * 1.5),
        difficulty_distribution={
            "easy": len([q for q in questions if q.difficulty == "easy"]),
            "medium": len([q for q in questions if q.difficulty == "medium"]),
            "hard": len([q for q in questions if q.difficulty == "hard"]),
        },
    )


async def grade_free_text_answer(
    question: str,
    expected_answer: str,
    user_answer: str,
    user_level: str = "intermediate",
) -> dict:
    """Grade a free-text answer using AI."""
    from utils import get_request_model
    
    system_prompt = f"""Grade this cloud architecture answer.
Return JSON with: score (0-100), is_correct (boolean), strengths (list), weaknesses (list), feedback (string)

Question: {question}
Expected: {expected_answer}
User Level: {user_level}

Be fair - partial credit for partial understanding."""

    result = await _chat_json(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"User's answer: {user_answer}"},
        ],
        model=get_request_model(),
    )
    
    return {
        "score": result.get("score", 0),
        "is_correct": result.get("is_correct", False),
        "feedback": result.get("feedback", ""),
        "strengths": result.get("strengths", []),
        "weaknesses": result.get("weaknesses", []),
    }
