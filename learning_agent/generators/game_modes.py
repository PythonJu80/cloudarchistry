"""
Game Modes Question Generator
==============================
Generates personalized questions for game modes (Sniper Quiz, etc.)
based on user's target certification, skill level, and study needs.
"""

import json
import uuid
from typing import List, Optional, Dict
from pydantic import BaseModel
from openai import AsyncOpenAI

from prompts import CERTIFICATION_PERSONAS
from utils import get_request_api_key, get_request_model, ApiKeyRequiredError


class GameQuestion(BaseModel):
    """A question for game modes"""
    id: str
    question: str
    options: List[str]  # 4 options for MCQ
    correct_index: int  # 0-3
    topic: str  # AWS service/topic area
    difficulty: str  # easy, medium, hard
    explanation: str  # Why the answer is correct
    points: int = 10


class SniperQuizQuestions(BaseModel):
    """Questions for Sniper Quiz game mode"""
    questions: List[GameQuestion]
    total_points: int
    topics_covered: List[str]


async def _chat_json(
    messages: List[Dict],
    model: Optional[str] = None,
    api_key: Optional[str] = None
) -> Dict:
    """JSON chat completion with request-scoped key support."""
    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Please configure your API key in Settings."
        )
    
    model = model or get_request_model() or "gpt-4o"
    client = AsyncOpenAI(api_key=key)
    
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.8,  # Slightly higher for variety
    )
    return json.loads(response.choices[0].message.content)


SNIPER_QUIZ_PROMPT = """You are generating rapid-fire quiz questions for a "Sniper Quiz" game mode.
The user is studying for an AWS certification and needs quick, focused practice questions.

USER PROFILE:
- Skill Level: {user_level}
- Target Certification: {cert_name}
- Focus Areas: {focus_areas}
- Weak Topics (prioritize these): {weak_topics}
- Recently Studied: {recent_topics}

CERTIFICATION CONTEXT:
{cert_context}

Generate {question_count} multiple-choice questions that:

1. MATCH THE CERTIFICATION EXAM STYLE:
   - Use the same question patterns as the real {cert_name} exam
   - Include scenario-based questions where appropriate
   - Test practical understanding, not just memorization

2. PRIORITIZE WEAK AREAS:
   - At least 40% of questions should cover the user's weak topics
   - Mix in other certification topics for variety

3. SCALE DIFFICULTY TO SKILL LEVEL:
   - beginner: Focus on core concepts, clear correct answers, avoid edge cases
   - intermediate: Include trade-offs, "best" practices, some scenario questions
   - advanced: Complex scenarios, optimization, multi-service integration
   - expert: Edge cases, failure modes, cost optimization, architecture decisions

4. MAKE EACH QUESTION UNIQUE:
   - Don't repeat similar questions
   - Vary the AWS services covered
   - Mix question types (what/why/how/when/which)

5. ENSURE QUALITY:
   - All 4 options should be plausible (no obviously wrong answers)
   - Exactly 1 correct answer per question
   - Explanations should be educational

DIFFICULTY DISTRIBUTION for {question_count} questions:
- beginner level: 70% easy, 30% medium
- intermediate level: 30% easy, 50% medium, 20% hard
- advanced level: 20% easy, 40% medium, 40% hard
- expert level: 10% easy, 30% medium, 60% hard

Return JSON with:
{{
  "questions": [
    {{
      "id": "unique_id",
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0-3,
      "topic": "AWS Service/Topic",
      "difficulty": "easy|medium|hard",
      "explanation": "Why this is correct and others are wrong"
    }}
  ],
  "topics_covered": ["list", "of", "topics"]
}}
"""


async def generate_sniper_quiz_questions(
    # User context
    user_level: str = "intermediate",
    cert_code: Optional[str] = None,
    weak_topics: Optional[List[str]] = None,
    recent_topics: Optional[List[str]] = None,
    
    # Options
    question_count: int = 10,
    
    # API config
    api_key: Optional[str] = None,
) -> SniperQuizQuestions:
    """
    Generate personalized Sniper Quiz questions based on user profile.
    
    Args:
        user_level: User's skill level (beginner/intermediate/advanced/expert)
        cert_code: Target certification code (e.g., "SAA-C03", "DVA-C02")
        weak_topics: Topics the user struggles with (prioritized)
        recent_topics: Topics recently studied (for reinforcement)
        question_count: Number of questions to generate (default 10)
        api_key: Optional OpenAI API key
    
    Returns:
        SniperQuizQuestions with personalized questions
    """
    
    # Build cert context
    cert_name = "AWS Cloud Practitioner"  # Default
    cert_context = ""
    focus_areas = ["Core AWS Services", "Cloud Concepts", "Security", "Pricing"]
    
    if cert_code and cert_code in CERTIFICATION_PERSONAS:
        persona = CERTIFICATION_PERSONAS[cert_code]
        cert_name = persona.get("cert", cert_name)
        focus_areas = persona.get("focus", focus_areas)
        cert_context = f"""
This is for the {cert_name} certification.
Exam Style: {persona.get('style', 'Standard AWS exam format')}
Key Focus Areas: {', '.join(focus_areas)}
Question patterns should match the real exam."""
    
    # Handle optional lists
    weak_topics_str = ", ".join(weak_topics) if weak_topics else "None specified - cover all areas"
    recent_topics_str = ", ".join(recent_topics) if recent_topics else "General AWS topics"
    
    # Build the prompt
    system_prompt = SNIPER_QUIZ_PROMPT.format(
        user_level=user_level,
        cert_name=cert_name,
        focus_areas=", ".join(focus_areas),
        weak_topics=weak_topics_str,
        recent_topics=recent_topics_str,
        cert_context=cert_context,
        question_count=question_count,
    )
    
    user_prompt = f"""Generate {question_count} unique Sniper Quiz questions for:
- Certification: {cert_name}
- Skill Level: {user_level}
- Weak Areas to Focus: {weak_topics_str}

Make them challenging but fair, matching the real exam style."""

    result = await _chat_json(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        api_key=api_key,
    )
    
    # Parse questions
    questions = []
    for idx, q in enumerate(result.get("questions", [])):
        # Assign points based on difficulty and position
        base_points = {"easy": 10, "medium": 15, "hard": 20}.get(q.get("difficulty", "medium"), 10)
        position_bonus = (idx + 1)  # Later questions worth more
        points = base_points + position_bonus
        
        questions.append(GameQuestion(
            id=q.get("id", f"sniper_{uuid.uuid4().hex[:8]}"),
            question=q.get("question", ""),
            options=q.get("options", ["A", "B", "C", "D"]),
            correct_index=q.get("correct_index", 0),
            topic=q.get("topic", "AWS"),
            difficulty=q.get("difficulty", "medium"),
            explanation=q.get("explanation", ""),
            points=points,
        ))
    
    # Calculate totals
    total_points = sum(q.points for q in questions)
    topics_covered = result.get("topics_covered", list(set(q.topic for q in questions)))
    
    return SniperQuizQuestions(
        questions=questions,
        total_points=total_points,
        topics_covered=topics_covered,
    )


async def generate_speed_round_questions(
    user_level: str = "intermediate",
    cert_code: Optional[str] = None,
    topic_focus: Optional[str] = None,
    question_count: int = 20,
    api_key: Optional[str] = None,
) -> SniperQuizQuestions:
    """
    Generate rapid-fire questions for Speed Round mode.
    These are shorter, more direct questions for quick answers.
    """
    
    # Similar to sniper quiz but with shorter questions
    cert_name = "AWS"
    if cert_code and cert_code in CERTIFICATION_PERSONAS:
        cert_name = CERTIFICATION_PERSONAS[cert_code].get("cert", "AWS")
    
    system_prompt = f"""Generate {question_count} RAPID-FIRE quiz questions for AWS certification practice.

User Level: {user_level}
Certification: {cert_name}
Topic Focus: {topic_focus or "All AWS topics"}

These are SPEED ROUND questions - they should be:
1. SHORT and DIRECT - no long scenarios
2. Test quick recall of key facts
3. Clear, unambiguous correct answers
4. 4 options each, 1 correct

Examples of good speed round questions:
- "What is the maximum size of an S3 object?"
- "Which service provides managed Kubernetes?"
- "What does RDS stand for?"

Return JSON with questions array, each having:
id, question, options (4), correct_index (0-3), topic, difficulty, explanation"""

    result = await _chat_json(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Generate {question_count} speed round questions."},
        ],
        api_key=api_key,
    )
    
    questions = []
    for idx, q in enumerate(result.get("questions", [])):
        questions.append(GameQuestion(
            id=q.get("id", f"speed_{uuid.uuid4().hex[:8]}"),
            question=q.get("question", ""),
            options=q.get("options", ["A", "B", "C", "D"]),
            correct_index=q.get("correct_index", 0),
            topic=q.get("topic", "AWS"),
            difficulty=q.get("difficulty", "medium"),
            explanation=q.get("explanation", ""),
            points=5 + idx,  # Speed round = fewer points per question
        ))
    
    return SniperQuizQuestions(
        questions=questions,
        total_points=sum(q.points for q in questions),
        topics_covered=list(set(q.topic for q in questions)),
    )


# Quick test
if __name__ == "__main__":
    import asyncio
    
    async def test():
        result = await generate_sniper_quiz_questions(
            user_level="intermediate",
            cert_code="SAA-C03",
            weak_topics=["VPC", "IAM"],
            question_count=5,
        )
        print(f"Generated {len(result.questions)} questions")
        for q in result.questions:
            print(f"  - [{q.topic}] {q.question[:50]}...")
    
    asyncio.run(test())
