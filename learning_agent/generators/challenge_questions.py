"""
Challenge Questions Generator Module
=====================================
Generates questions for individual challenges within a scenario.
Each challenge gets tailored questions based on the business case,
user skill level, and certification focus.
"""

import json
import os
import uuid
from typing import List, Optional, Dict
from pydantic import BaseModel
from openai import AsyncOpenAI

from prompts import CERTIFICATION_PERSONAS
from utils import get_request_model, ApiKeyRequiredError


# Valid user levels
VALID_USER_LEVELS = ["beginner", "intermediate", "advanced", "expert"]
VALID_CERT_CODES = list(CERTIFICATION_PERSONAS.keys())


class QuestionValidationError(Exception):
    """Raised when question generation parameters are invalid"""
    pass


def validate_question_params(user_level: str, cert_code: str) -> None:
    """
    Validate that user_level and cert_code are provided and valid.
    
    Args:
        user_level: User skill level ('beginner', 'intermediate', 'advanced', 'expert')
        cert_code: AWS certification persona ID (e.g., 'solutions-architect-associate')
    
    Raises:
        QuestionValidationError: If parameters are missing or invalid
    """
    if not user_level:
        raise QuestionValidationError(
            "user_level is required. Each question set must be user-level specific. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if not cert_code:
        raise QuestionValidationError(
            "cert_code is required. Each question set must be certification-specific. "
            f"Valid cert codes: {', '.join(VALID_CERT_CODES)}"
        )
    
    if user_level not in VALID_USER_LEVELS:
        raise QuestionValidationError(
            f"Invalid user_level '{user_level}'. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if cert_code not in VALID_CERT_CODES:
        raise QuestionValidationError(
            f"Invalid cert_code '{cert_code}'. "
            f"Valid cert codes: {', '.join(VALID_CERT_CODES)}"
        )


class QuestionOption(BaseModel):
    """Option for multiple choice questions"""
    id: str
    text: str
    is_correct: bool


class ChallengeQuestion(BaseModel):
    """A question within a challenge workspace"""
    id: str
    question: str
    question_type: str  # "multiple_choice" | "scenario" | "troubleshooting" | "architecture" | "best_practice"
    options: Optional[List[QuestionOption]] = None
    correct_answer: str
    explanation: str
    hint: Optional[str] = None
    points: int = 20
    aws_services: List[str] = []
    difficulty: str  # matches user's skill level


class ChallengeQuestions(BaseModel):
    """Questions for a single challenge"""
    challenge_id: str
    challenge_title: str
    brief: str  # Detailed challenge context/story for the workspace
    questions: List[ChallengeQuestion]
    total_points: int
    estimated_time_minutes: int


async def _chat_json(
    messages: List[Dict],
    model: Optional[str] = None,
    api_key: Optional[str] = None
) -> Dict:
    """JSON chat completion with .env only."""
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Set OPENAI_API_KEY in .env file."
        )
    
    model = model or get_request_model() or "gpt-4o"
    client = AsyncOpenAI(api_key=key)
    
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.9,
    )
    return json.loads(response.choices[0].message.content)


CHALLENGE_QUESTIONS_PROMPT = """You are creating questions for a hands-on cloud architecture challenge.

CHALLENGE: {challenge_title}
CHALLENGE DESCRIPTION: {challenge_description}
SUCCESS CRITERIA: {success_criteria}
RELEVANT AWS SERVICES: {aws_services}
HINTS AVAILABLE: {hints}

BUSINESS CONTEXT:
- Company: {company_name}
- Industry: {industry}
- Scenario: {business_context}

USER SKILL LEVEL: {user_level}
{cert_context}

Create {question_count} questions that:
1. Are SPECIFIC to this challenge and business case - not generic AWS questions
2. Test practical understanding needed to complete this challenge
3. Reference the company/industry context where relevant
4. Match the user's skill level:
   - beginner: Focus on "what" and "why", more guidance, clear correct answers
   - intermediate: Focus on "how" and trade-offs, some ambiguity
   - advanced: Focus on optimization, edge cases, multi-service integration
   - expert: Focus on architecture decisions, failure modes, cost optimization

Question types to include:
- scenario: "Given that {{company_name}} needs X, which approach..."
- troubleshooting: "If the service fails to..., what should you check?"
- best_practice: "What's the recommended way to..."
- architecture: "How should you design the..."
- multiple_choice: Standard knowledge check

Also create a BRIEF - a detailed 2-3 paragraph story that sets up this challenge.
The brief should:
- Explain WHY this challenge matters for {company_name}
- Set the scene (you're a consultant, the CTO asked you, etc.)
- Include specific details that make it feel real
- Reference the industry-specific concerns

Return JSON with:
- challenge_id: the challenge ID
- challenge_title: the challenge title
- brief: the detailed challenge story (2-3 paragraphs)
- questions: array of question objects
- estimated_time_minutes: REALISTIC time to complete based on:
  * User skill level: beginner=slower (3-4 min/question), intermediate=moderate (2-3 min/question), advanced/expert=faster (1-2 min/question)
  * Question complexity: scenario/architecture questions take longer than multiple_choice
  * Reading the brief: add 2-3 minutes
  * Example: 5 intermediate questions + brief = ~15-18 minutes

Each question object:
- id: unique ID
- question: the question text
- question_type: scenario/troubleshooting/best_practice/architecture/multiple_choice
- options: array of {{id, text, is_correct}} - 4 options, exactly 1 correct
- correct_answer: the correct option text
- explanation: why this is correct (educational)
- hint: optional hint if they're stuck
- points: 10-30 based on difficulty
- aws_services: services tested
- difficulty: {user_level}
"""


async def generate_challenge_questions(
    # Challenge context
    challenge: Dict,  # id, title, description, hints, success_criteria, aws_services_relevant
    
    # Business context
    company_name: str,
    industry: str,
    business_context: str,
    
    # User context (REQUIRED)
    user_level: str,
    cert_code: str,
    
    # Options
    question_count: int = 5,
) -> ChallengeQuestions:
    """
    Generate questions for a specific challenge, tailored to the business case.
    
    IMPORTANT: Both user_level and cert_code are REQUIRED.
    Each question set must be certification-specific and user-level specific.
    
    Args:
        challenge: Challenge dict with id, title, description, hints, success_criteria, aws_services_relevant
        company_name: The business name
        industry: Business industry
        business_context: Scenario description
        user_level: User's skill level (REQUIRED: 'beginner', 'intermediate', 'advanced', 'expert')
        cert_code: Certification persona ID (REQUIRED, e.g., 'solutions-architect-associate')
        question_count: Number of questions to generate (default 5)
    
    Returns:
        ChallengeQuestions with brief and questions tailored to cert and level
    
    Raises:
        QuestionValidationError: If user_level or cert_code are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_question_params(user_level, cert_code)
    
    # Get certification context (cert_code is now required and validated)
    if cert_code not in CERTIFICATION_PERSONAS:
        raise QuestionValidationError(f"Unknown certification persona: {cert_code}")
    
    persona = CERTIFICATION_PERSONAS[cert_code]
    cert_context = f"""
CERTIFICATION FOCUS: {persona['cert']}
Focus Areas: {', '.join(persona['focus'])}
Style: {persona['style']}
Frame questions as if preparing for this certification exam."""
    
    # Fetch current AWS knowledge from database
    from utils import fetch_knowledge_for_generation
    aws_services_list = challenge.get("aws_services_relevant", [])
    topic = f"{challenge.get('title', '')} {' '.join(aws_services_list[:3])}"
    knowledge_context = await fetch_knowledge_for_generation(
        cert_code=cert_code,
        topic=topic,
        limit=5
    )
    
    # Extract challenge fields
    challenge_id = challenge.get("id", str(uuid.uuid4()))
    challenge_title = challenge.get("title", "Challenge")
    challenge_description = challenge.get("description", "")
    success_criteria = ", ".join(challenge.get("success_criteria", []))
    aws_services = ", ".join(challenge.get("aws_services_relevant", []))
    hints = ", ".join(challenge.get("hints", []))
    
    # Build the prompt
    system_prompt = CHALLENGE_QUESTIONS_PROMPT.format(
        challenge_title=challenge_title,
        challenge_description=challenge_description,
        success_criteria=success_criteria,
        aws_services=aws_services,
        hints=hints,
        company_name=company_name,
        industry=industry,
        business_context=business_context,
        user_level=user_level,
        cert_context=cert_context,
        question_count=question_count,
    )
    
    user_prompt = f"""Generate {question_count} questions and a detailed brief for:

Challenge: {challenge_title}
Company: {company_name} ({industry})
User Level: {user_level}

{knowledge_context}

Make the questions specific to this business case, not generic AWS questions."""

    result = await _chat_json([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ])
    
    # Parse questions
    questions = []
    for q in result.get("questions", []):
        options = None
        if q.get("options"):
            options = [
                QuestionOption(
                    id=o.get("id", str(uuid.uuid4())[:8]),
                    text=o.get("text", ""),
                    is_correct=o.get("is_correct", False)
                )
                for o in q["options"]
            ]
        
        questions.append(ChallengeQuestion(
            id=q.get("id", str(uuid.uuid4())),
            question=q.get("question", ""),
            question_type=q.get("question_type", "multiple_choice"),
            options=options,
            correct_answer=q.get("correct_answer", ""),
            explanation=q.get("explanation", ""),
            hint=q.get("hint"),
            points=q.get("points", 20),
            aws_services=q.get("aws_services", []),
            difficulty=q.get("difficulty", user_level),
        ))
    
    # Calculate total points
    total_points = sum(q.points for q in questions)
    
    # Calculate realistic time estimate if not provided or seems off
    llm_time = result.get("estimated_time_minutes", 0)
    
    # Fallback calculation based on skill level and question count
    time_per_question = {
        "beginner": 3.5,      # 3-4 min per question
        "intermediate": 2.5,  # 2-3 min per question
        "advanced": 1.5,      # 1-2 min per question
        "expert": 1.5,        # 1-2 min per question
    }.get(user_level, 2.5)
    
    calculated_time = int(len(questions) * time_per_question + 3)  # +3 for reading brief
    
    # Use LLM time if reasonable (between 5 and 45 min), otherwise use calculated
    if 5 <= llm_time <= 45:
        estimated_time = llm_time
    else:
        estimated_time = calculated_time
    
    return ChallengeQuestions(
        challenge_id=challenge_id,
        challenge_title=challenge_title,
        brief=result.get("brief", f"Complete the {challenge_title} challenge for {company_name}."),
        questions=questions,
        total_points=total_points,
        estimated_time_minutes=estimated_time,
    )


async def grade_challenge_answer(
    question: ChallengeQuestion,
    user_answer: str,
    company_context: str,
    user_level: str,
) -> Dict:
    """
    Grade a user's answer to a challenge question.
    For multiple choice, this is straightforward.
    For free-text/architecture questions, uses AI grading.
    """
    from utils import get_request_model
    
    # Multiple choice - simple check
    if question.options:
        correct_option = next((o for o in question.options if o.is_correct), None)
        if correct_option:
            is_correct = user_answer.strip().lower() == correct_option.text.strip().lower() or \
                         user_answer.strip().lower() == correct_option.id.strip().lower()
            return {
                "is_correct": is_correct,
                "score": question.points if is_correct else 0,
                "correct_answer": correct_option.text,
                "explanation": question.explanation,
                "feedback": "Correct!" if is_correct else f"The correct answer is: {correct_option.text}",
            }
    
    # Free-text - AI grading
    system_prompt = f"""Grade this cloud architecture answer.
Question: {question.question}
Expected concepts: {question.correct_answer}
User Level: {user_level}
Context: {company_context}

Return JSON with:
- is_correct: boolean (true if substantially correct)
- score: 0 to {question.points}
- feedback: constructive feedback
- strengths: list of what they got right
- improvements: list of what could be better

Be fair - partial credit for partial understanding."""

    result = await _chat_json(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"User's answer: {user_answer}"},
        ],
        model=get_request_model(),
    )
    
    return {
        "is_correct": result.get("is_correct", False),
        "score": result.get("score", 0),
        "correct_answer": question.correct_answer,
        "explanation": question.explanation,
        "feedback": result.get("feedback", ""),
        "strengths": result.get("strengths", []),
        "improvements": result.get("improvements", []),
    }
