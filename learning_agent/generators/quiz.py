"""
Quiz Generator Module
=====================
Generates quizzes with multiple question types.

PATTERN: "Tool uses AI" - The tool pre-gathers all data, AI just formats.
- Tool fetches knowledge from DB (no AI needed)
- Tool structures content by certification/difficulty (deterministic)
- AI only formats into quiz questions (cheap, no hallucination)
"""

import json
import os
import uuid
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from openai import AsyncOpenAI

from config.settings import logger
from prompts import QUIZ_GENERATOR_PROMPT, PERSONA_QUIZ_PROMPT, CERTIFICATION_PERSONAS
from utils import get_request_model, ApiKeyRequiredError, DEFAULT_MODEL


# Map cert codes (e.g., "SAA-C03" from DB) to persona IDs
CERT_CODE_TO_PERSONA = {
    # Foundational
    "CLF": "cloud-practitioner",
    "CLF-C02": "cloud-practitioner",
    "AIF": "ai-practitioner",
    "AIF-C01": "ai-practitioner",
    # Associate
    "SAA": "solutions-architect-associate",
    "SAA-C03": "solutions-architect-associate",
    "DVA": "developer-associate",
    "DVA-C02": "developer-associate",
    "SOA": "sysops-associate",
    "SOA-C02": "sysops-associate",
    "DEA": "data-engineer-associate",
    "DEA-C01": "data-engineer-associate",
    "MLA": "machine-learning-engineer-associate",
    "MLA-C01": "machine-learning-engineer-associate",
    # Professional
    "SAP": "solutions-architect-professional",
    "SAP-C02": "solutions-architect-professional",
    "DOP": "devops-professional",
    "DOP-C02": "devops-professional",
    # Specialty
    "ANS": "networking-specialty",
    "ANS-C01": "networking-specialty",
    "SCS": "security-specialty",
    "SCS-C02": "security-specialty",
    "MLS": "machine-learning-specialty",
    "MLS-C01": "machine-learning-specialty",
    "PAS": "sap-specialty",
    "PAS-C01": "sap-specialty",
    # Legacy (retired but kept for backward compatibility)
    "DBS": "database-specialty",
    "DBS-C01": "database-specialty",
}

# Valid user levels
VALID_USER_LEVELS = ["beginner", "intermediate", "advanced", "expert"]
VALID_CERT_CODES = list(CERTIFICATION_PERSONAS.keys())


class QuizValidationError(Exception):
    """Raised when quiz generation parameters are invalid"""
    pass


def validate_quiz_params(user_level: str, cert_code: str) -> None:
    """
    Validate that user_level and cert_code are provided and valid.
    
    Args:
        user_level: User skill level ('beginner', 'intermediate', 'advanced', 'expert')
        cert_code: AWS certification persona ID (e.g., 'solutions-architect-associate')
    
    Raises:
        QuizValidationError: If parameters are missing or invalid
    """
    if not user_level:
        raise QuizValidationError(
            "user_level is required. Quizzes must be user-level specific. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if not cert_code:
        raise QuizValidationError(
            "cert_code is required. Quizzes must be certification-specific. "
            f"Valid cert codes: {', '.join(VALID_CERT_CODES)}"
        )
    
    if user_level not in VALID_USER_LEVELS:
        raise QuizValidationError(
            f"Invalid user_level '{user_level}'. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if cert_code not in VALID_CERT_CODES:
        raise QuizValidationError(
            f"Invalid cert_code '{cert_code}'. "
            f"Valid cert codes: {', '.join(VALID_CERT_CODES)}"
        )


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


# ============================================
# STRUCTURED CONTENT FOR "TOOL USES AI" PATTERN
# ============================================

class QuizStructuredContent(BaseModel):
    """Pre-gathered content - tool decides, AI just formats."""
    scenario_title: str
    business_context: str
    certification: str
    cert_level: str  # foundational, associate, professional, specialty
    skill_level: str  # beginner, intermediate, advanced
    aws_services: List[str]
    knowledge_facts: List[Dict[str, str]]  # [{"topic": "S3", "fact": "...", "source": "..."}]
    question_count: int
    difficulty_distribution: Dict[str, int]  # {"easy": 3, "medium": 5, "hard": 2}
    question_types: Dict[str, int]  # {"multiple_choice": 7, "true_false": 2, "multi_select": 1}


async def _chat_json(messages: List[Dict], model: Optional[str] = None, api_key: Optional[str] = None) -> Dict:
    """Simple JSON chat completion."""
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Set OPENAI_API_KEY in .env file."
        )
    model = model or get_request_model() or DEFAULT_MODEL
    client = AsyncOpenAI(api_key=key)
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.5,  # Quiz questions need factual accuracy
    )
    return json.loads(response.choices[0].message.content)


async def generate_quiz(
    scenario_title: str,
    business_context: str,
    aws_services: List[str],
    learning_objectives: List[str],
    user_level: str,
    cert_code: str,
    question_count: int = 10,
    challenges: Optional[List[dict]] = None,
) -> Quiz:
    """
    Generate a quiz for a scenario.
    
    IMPORTANT: Both user_level and cert_code are REQUIRED.
    Each quiz must be certification-specific and user-level specific.
    
    Args:
        scenario_title: Title of the scenario
        business_context: Business context description
        aws_services: List of AWS services covered
        learning_objectives: List of learning objectives
        user_level: User's skill level (REQUIRED: 'beginner', 'intermediate', 'advanced', 'expert')
        cert_code: Certification persona ID (REQUIRED, e.g., 'solutions-architect-associate')
        question_count: Number of questions (default 10)
        challenges: Optional list of challenges to cover
    
    Returns:
        Quiz tailored to cert and level
    
    Raises:
        QuizValidationError: If user_level or cert_code are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_quiz_params(user_level, cert_code)
    
    # Fetch current AWS knowledge from database
    from utils import fetch_knowledge_for_generation
    topic = f"{scenario_title} {' '.join(aws_services[:3])}"
    knowledge_context = await fetch_knowledge_for_generation(
        cert_code=cert_code,
        topic=topic,
        limit=5
    )
    
    # Get certification context (cert_code is now required and validated)
    if cert_code not in CERTIFICATION_PERSONAS:
        raise QuizValidationError(f"Unknown certification persona: {cert_code}")
    
    persona = CERTIFICATION_PERSONAS[cert_code]
    persona_context = {
        "cert_name": persona["cert"],
        "focus_areas": ", ".join(persona["focus"]),
        "level": persona["level"],
    }
    
    # Use persona-specific prompt (always, since cert_code is required)
    base_prompt = PERSONA_QUIZ_PROMPT.format(
        scenario_title=scenario_title,
        business_context=business_context,
        cert_name=persona_context["cert_name"],
        focus_areas=persona_context["focus_areas"],
        level=persona_context["level"],
        question_count=question_count,
    )
    
    system_prompt = f"""You create educational quizzes for cloud architecture.
Return JSON with: title, description, questions (array of: id, question, question_type, options (array of: id, text, is_correct), explanation, difficulty, points, aws_services, tags)

{base_prompt}"""
    
    user_prompt = f"Generate {question_count} questions for: {scenario_title}"
    user_prompt += f"\nStyle questions like {persona_context['cert_name']} certification exam."
    user_prompt += f"\n\n{knowledge_context}"
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
    user_level: str,
    cert_code: str,
    question_count: int = 10,
) -> Quiz:
    """
    Generate a quiz on any AWS topic.
    
    IMPORTANT: Both user_level and cert_code are REQUIRED.
    
    Args:
        topic: AWS topic/service name
        user_level: User's skill level (REQUIRED)
        cert_code: Certification persona ID (REQUIRED)
        question_count: Number of questions (default 10)
    
    Returns:
        Quiz tailored to cert and level
    
    Raises:
        QuizValidationError: If user_level or cert_code are missing/invalid
    """
    return await generate_service_quiz(
        service_name=topic,
        user_level=user_level,
        cert_code=cert_code,
        question_count=question_count,
    )


async def generate_service_quiz(
    service_name: str,
    user_level: str,
    cert_code: str,
    question_count: int = 10,
    focus_areas: Optional[List[str]] = None,
) -> Quiz:
    """
    Generate a quiz focused on a specific AWS service.
    
    IMPORTANT: Both user_level and cert_code are REQUIRED.
    
    Args:
        service_name: AWS service name
        user_level: User's skill level (REQUIRED: 'beginner', 'intermediate', 'advanced', 'expert')
        cert_code: Certification persona ID (REQUIRED)
        question_count: Number of questions (default 10)
        focus_areas: Optional specific focus areas
    
    Returns:
        Quiz tailored to cert and level
    
    Raises:
        QuizValidationError: If user_level or cert_code are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_quiz_params(user_level, cert_code)
    
    # Get certification context
    if cert_code not in CERTIFICATION_PERSONAS:
        raise QuizValidationError(f"Unknown certification persona: {cert_code}")
    
    persona = CERTIFICATION_PERSONAS[cert_code]
    cert_name = persona["cert"]
    focus_areas_str = ", ".join(persona["focus"])
    
    system_prompt = f"""Generate a {question_count}-question quiz about AWS {service_name}.

User Profile:
- Skill Level: {user_level}
- Target Certification: {cert_name}
- Focus Areas: {focus_areas_str}
{"Additional Focus: " + ", ".join(focus_areas) if focus_areas else ""}

Style questions like {cert_name} certification exam.

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


async def generate_quiz_for_certification(
    cert_code: str,
    user_level: str,
    question_count: int = 10,
    telemetry: Optional[Dict] = None,
    existing_questions: Optional[List[str]] = None,
) -> Dict:
    """
    Generate quiz from certification + telemetry + skill level.
    
    IMPORTANT: Both cert_code and user_level are REQUIRED.
    
    Args:
        cert_code: Certification persona ID (REQUIRED, e.g., 'solutions-architect-associate')
        user_level: User's skill level (REQUIRED: 'beginner', 'intermediate', 'advanced', 'expert')
        question_count: Number of questions (default 10)
        telemetry: Optional user progress telemetry
        existing_questions: Optional list of questions to avoid
    
    Returns:
        Dict with quiz data
    
    Raises:
        QuizValidationError: If user_level or cert_code are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_quiz_params(user_level, cert_code)
    import random
    
    # Get certification context (cert_code is now required and validated)
    if cert_code not in CERTIFICATION_PERSONAS:
        raise QuizValidationError(f"Unknown certification persona: {cert_code}")
    
    persona = CERTIFICATION_PERSONAS[cert_code]
    cert_name = persona["cert"]
    focus_areas = persona["focus"]
    
    # Build avoid list for prompt
    avoid_context = ""
    if existing_questions:
        avoid_context = f"\n\nAVOID these questions (already asked in previous quizzes):\n" + "\n".join(f"- {q[:80]}" for q in existing_questions[:20])
    
    # Difficulty distribution based on skill level
    if user_level == "beginner":
        difficulty_dist = {"easy": 0.5, "medium": 0.4, "hard": 0.1}
    elif user_level == "advanced":
        difficulty_dist = {"easy": 0.1, "medium": 0.4, "hard": 0.5}
    else:
        difficulty_dist = {"easy": 0.25, "medium": 0.5, "hard": 0.25}
    
    # Build telemetry context
    telemetry_context = ""
    if telemetry:
        telemetry_context = f"""
User Progress:
- Skill Level: {telemetry.get('skillLevel', 'intermediate')}
- Challenges Completed: {telemetry.get('challengesCompleted', 0)}
- Scenarios Completed: {telemetry.get('scenariosCompleted', 0)}
- Total Points: {telemetry.get('totalPoints', 0)}
- Level: {telemetry.get('level', 1)}
"""
    
    selected_focus = random.sample(focus_areas, min(3, len(focus_areas)))
    
    # Use the existing PERSONA_QUIZ_PROMPT
    base_prompt = PERSONA_QUIZ_PROMPT.format(
        cert_name=cert_name,
        scenario_title=f"{cert_name} Practice",
        business_context="Certification exam preparation",
        focus_areas=', '.join(selected_focus),
        level=user_level,
        question_count=question_count,
    )
    
    system_prompt = f"""{base_prompt}
{avoid_context}
{telemetry_context}

Return JSON: {{"title": "...", "description": "...", "questions": [{{"id": "q1", "question": "...", "question_type": "multiple_choice", "options": [{{"id": "a", "text": "...", "is_correct": true/false}}], "explanation": "...", "difficulty": "easy|medium|hard", "points": 10, "aws_services": [...], "tags": [...]}}]}}"""

    result = await _chat_json([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Generate {question_count} questions for {cert_name}"},
    ])
    
    if not result.get("title"):
        result["title"] = f"{cert_name} Practice Quiz"
    if not result.get("description"):
        result["description"] = f"AI-generated quiz for {cert_name} certification"
    
    # Calculate aggregate fields
    questions = result.get("questions", [])
    total_points = sum(q.get("points", 10) for q in questions)
    
    # Calculate difficulty distribution
    difficulty_counts = {"easy": 0, "medium": 0, "hard": 0}
    for q in questions:
        diff = q.get("difficulty", "medium")
        if diff in difficulty_counts:
            difficulty_counts[diff] += 1
    
    # Add aggregate fields
    result["total_questions"] = len(questions)
    result["total_points"] = total_points
    result["passing_score"] = 70  # 70% passing score
    result["estimated_time_minutes"] = int(len(questions) * 1.5)  # 1.5 min per question
    result["difficulty_distribution"] = difficulty_counts
    
    return result


async def grade_free_text_answer(
    question: str,
    expected_answer: str,
    user_answer: str,
    user_level: str,
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


# ============================================
# "TOOL USES AI" PATTERN - AI is just a formatter
# ============================================

FORMAT_QUIZ_PROMPT = """You are formatting quiz questions from pre-gathered AWS knowledge.

## IMPORTANT: Your Role
You are a FORMATTER, not a content creator. The knowledge facts below were extracted from real AWS documentation.
Your job is to:
1. Convert each knowledge fact into a clear quiz question
2. Create plausible wrong answers (distractors) based on common misconceptions
3. Match the difficulty to the learner's level
4. Write clear explanations referencing the source fact

DO NOT invent facts. Use ONLY the knowledge provided below.

## Learner Context
- Target Certification: {certification}
- Certification Level: {cert_level}
- Skill Level: {skill_level}
- Scenario: {scenario_title}

## Pre-Gathered Knowledge Facts
{knowledge_facts_json}

## AWS Services to Focus On
{aws_services}

## Required Output
Create exactly {question_count} questions with this distribution:

Difficulty:
- Easy: {easy_count} questions (recall/definition)
- Medium: {medium_count} questions (application/comparison)
- Hard: {hard_count} questions (analysis/scenario)

Question Types:
- Multiple Choice: {mc_count} questions (4 options, 1 correct)
- True/False: {tf_count} questions
- Multi-Select: {ms_count} questions (4-5 options, 2-3 correct)

## Question Styles by Difficulty
EASY ({cert_level} foundational):
- "What is the primary purpose of [service]?"
- "Which service is used for [function]?"
- True/False: "[Service] supports [feature]"

MEDIUM ({cert_level} practical):
- "When would you choose X over Y?"
- "What happens when you configure X with Y?"
- Select all that apply: "Which features does [service] support?"

HARD ({cert_level} advanced):
- "A company needs to [complex requirement]. Which solution meets these needs?"
- "An architect is troubleshooting [issue]. What should they check FIRST?"

## Output Format
Return JSON:
{{
  "title": "Quiz title based on scenario",
  "description": "Brief description mentioning certification",
  "questions": [
    {{
      "id": "q1",
      "question": "Question text derived from knowledge fact",
      "question_type": "multiple_choice|true_false|multi_select",
      "options": [
        {{"id": "a", "text": "Option text", "is_correct": true}},
        {{"id": "b", "text": "Plausible wrong answer", "is_correct": false}},
        {{"id": "c", "text": "Another wrong answer", "is_correct": false}},
        {{"id": "d", "text": "Another wrong answer", "is_correct": false}}
      ],
      "explanation": "Why the answer is correct, referencing the knowledge fact",
      "difficulty": "easy|medium|hard",
      "points": 10,
      "aws_services": ["S3", "IAM"],
      "tags": ["storage", "security"]
    }}
  ]
}}

Output ONLY valid JSON."""


async def format_quiz(
    structured_content: QuizStructuredContent,
    *,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Quiz:
    """
    FORMAT quiz from pre-gathered knowledge.
    
    The tool has already:
    - Fetched relevant knowledge from the database
    - Determined difficulty distribution by skill level
    - Selected AWS services to focus on
    - Decided question type distribution
    
    AI just formats the knowledge into quiz questions.
    """
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required. Set OPENAI_API_KEY in .env file.")
    
    model_name = model or get_request_model() or DEFAULT_MODEL
    
    # Build the prompt with pre-gathered content
    prompt = FORMAT_QUIZ_PROMPT.format(
        certification=structured_content.certification,
        cert_level=structured_content.cert_level,
        skill_level=structured_content.skill_level,
        scenario_title=structured_content.scenario_title,
        knowledge_facts_json=json.dumps(structured_content.knowledge_facts, indent=2),
        aws_services=", ".join(structured_content.aws_services),
        question_count=structured_content.question_count,
        easy_count=structured_content.difficulty_distribution.get("easy", 3),
        medium_count=structured_content.difficulty_distribution.get("medium", 5),
        hard_count=structured_content.difficulty_distribution.get("hard", 2),
        mc_count=structured_content.question_types.get("multiple_choice", 7),
        tf_count=structured_content.question_types.get("true_false", 2),
        ms_count=structured_content.question_types.get("multi_select", 1),
    )
    
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Format the quiz questions now. Use ONLY the provided knowledge facts."},
    ]
    
    client = AsyncOpenAI(api_key=key)
    response = await client.chat.completions.create(
        model=model_name,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.3,  # Lower temperature for consistent formatting
    )
    
    content = response.choices[0].message.content
    
    try:
        result = json.loads(content)
    except json.JSONDecodeError as err:
        logger.error("Quiz format JSON parse failure: %s", err)
        raise ValueError("AI returned invalid quiz JSON") from err
    
    # Validate questions
    questions = validate_and_fix_questions(
        result.get("questions", []),
        structured_content
    )
    
    return Quiz(
        title=result.get("title", f"Quiz: {structured_content.scenario_title}"),
        description=result.get("description", f"Practice quiz for {structured_content.certification}"),
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


def validate_and_fix_questions(
    ai_questions: List[Dict],
    content: QuizStructuredContent
) -> List[QuizQuestion]:
    """Ensure AI didn't hallucinate or create invalid questions."""
    
    questions = []
    
    for idx, q_data in enumerate(ai_questions):
        try:
            # Parse options
            options = []
            for opt in q_data.get("options", []):
                options.append(QuizOption(
                    id=opt.get("id", str(uuid.uuid4())[:4]),
                    text=opt.get("text", ""),
                    is_correct=opt.get("is_correct", False),
                ))
            
            # Ensure at least one correct answer for multiple choice
            question_type = q_data.get("question_type", "multiple_choice")
            if question_type in ["multiple_choice", "multi_select"] and options:
                has_correct = any(o.is_correct for o in options)
                if not has_correct and options:
                    options[0].is_correct = True
                    logger.warning(f"Question {idx+1} had no correct answer, fixed")
            
            # Validate difficulty
            difficulty = q_data.get("difficulty", "medium")
            if difficulty not in ["easy", "medium", "hard"]:
                difficulty = "medium"
            
            # Create question
            question = QuizQuestion(
                id=q_data.get("id", f"q{idx+1}"),
                question=q_data.get("question", ""),
                question_type=question_type,
                options=options,
                correct_answer=q_data.get("correct_answer"),
                explanation=q_data.get("explanation", ""),
                difficulty=difficulty,
                points=q_data.get("points", 10),
                aws_services=q_data.get("aws_services", []),
                tags=q_data.get("tags", []),
            )
            
            # Ensure aws_services are from our list
            question.aws_services = [
                s for s in question.aws_services 
                if s in content.aws_services or s.upper() in [svc.upper() for svc in content.aws_services]
            ]
            
            questions.append(question)
        except Exception as e:
            logger.warning(f"Invalid question data, skipping: {e}")
            continue
    
    # Log if count doesn't match
    if len(questions) != content.question_count:
        logger.warning(
            f"Question count mismatch: expected {content.question_count}, got {len(questions)}"
        )
    
    return questions


def calculate_quiz_difficulty_distribution(
    skill_level: str,
    cert_level: str,
    question_count: int
) -> Dict[str, int]:
    """
    Calculate question difficulty distribution based on skill level.
    Tool decides this - no AI needed.
    """
    # Skill level affects overall difficulty
    skill_weights = {
        "beginner": {"easy": 0.5, "medium": 0.35, "hard": 0.15},
        "intermediate": {"easy": 0.25, "medium": 0.5, "hard": 0.25},
        "advanced": {"easy": 0.15, "medium": 0.35, "hard": 0.5},
        "expert": {"easy": 0.1, "medium": 0.3, "hard": 0.6},
    }
    
    # Cert level can shift slightly
    cert_adjustments = {
        "foundational": {"easy": 0.1, "medium": 0, "hard": -0.1},
        "associate": {"easy": 0, "medium": 0, "hard": 0},
        "professional": {"easy": -0.1, "medium": 0, "hard": 0.1},
        "specialty": {"easy": -0.1, "medium": -0.05, "hard": 0.15},
    }
    
    weights = skill_weights.get(skill_level, skill_weights["intermediate"])
    adjustments = cert_adjustments.get(cert_level, cert_adjustments["associate"])
    
    # Apply adjustments
    final_weights = {
        k: max(0.05, min(0.7, weights[k] + adjustments.get(k, 0)))
        for k in weights
    }
    
    # Normalize
    total = sum(final_weights.values())
    final_weights = {k: v / total for k, v in final_weights.items()}
    
    # Calculate counts
    distribution = {
        "easy": round(question_count * final_weights["easy"]),
        "medium": round(question_count * final_weights["medium"]),
        "hard": round(question_count * final_weights["hard"]),
    }
    
    # Ensure we hit exact count
    diff = question_count - sum(distribution.values())
    distribution["medium"] += diff
    
    return distribution


def calculate_question_type_distribution(
    question_count: int,
    cert_level: str
) -> Dict[str, int]:
    """
    Calculate question type distribution.
    Tool decides this - no AI needed.
    """
    # Higher level certs have more multi-select
    if cert_level in ["professional", "specialty"]:
        mc_pct, tf_pct, ms_pct = 0.6, 0.15, 0.25
    elif cert_level == "associate":
        mc_pct, tf_pct, ms_pct = 0.7, 0.15, 0.15
    else:  # foundational
        mc_pct, tf_pct, ms_pct = 0.75, 0.2, 0.05
    
    distribution = {
        "multiple_choice": round(question_count * mc_pct),
        "true_false": round(question_count * tf_pct),
        "multi_select": round(question_count * ms_pct),
    }
    
    # Ensure we hit exact count
    diff = question_count - sum(distribution.values())
    distribution["multiple_choice"] += diff
    
    # Ensure at least 1 of each type if possible
    if question_count >= 5:
        for qtype in distribution:
            if distribution[qtype] == 0:
                distribution[qtype] = 1
                distribution["multiple_choice"] -= 1
    
    return distribution


def extract_quiz_facts_from_knowledge(
    knowledge_chunks: List[Dict],
    aws_services: List[str],
    max_facts: int = 15
) -> List[Dict[str, str]]:
    """
    Extract key facts from knowledge chunks suitable for quiz questions.
    Tool does this deterministically - no AI needed.
    """
    facts = []
    
    for chunk in knowledge_chunks:
        content = chunk.get("content", "")
        url = chunk.get("url", "")
        
        # Split into sentences/facts
        sentences = content.replace("\n", " ").split(". ")
        
        for sentence in sentences:
            sentence = sentence.strip()
            # Quiz facts should be more substantial
            if len(sentence) < 40 or len(sentence) > 400:
                continue
            
            # Check if it mentions any of our target services
            mentioned_services = [
                svc for svc in aws_services
                if svc.lower() in sentence.lower() or svc.upper() in sentence
            ]
            
            # Look for facts that make good quiz questions
            quiz_indicators = [
                "can", "should", "must", "allows", "enables", "supports",
                "provides", "uses", "requires", "default", "maximum", "minimum",
                "best practice", "recommended", "automatically", "by default"
            ]
            
            has_quiz_potential = any(ind in sentence.lower() for ind in quiz_indicators)
            
            if mentioned_services and has_quiz_potential:
                facts.append({
                    "topic": mentioned_services[0] if mentioned_services else "AWS",
                    "fact": sentence,
                    "source": url,
                    "services": mentioned_services,
                })
                
                if len(facts) >= max_facts:
                    break
        
        if len(facts) >= max_facts:
            break
    
    return facts
