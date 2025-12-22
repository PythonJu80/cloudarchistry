"""
Study Guide Generator
=====================
Generates personalized study plans with platform-specific actions.
Knows about the Cloud Academy platform features: games, exams, quizzes, challenges, flashcards.
"""

from __future__ import annotations

import json
import uuid
from typing import List, Optional, Dict, Any

from openai import AsyncOpenAI
from pydantic import BaseModel

from config.settings import logger
from prompts import CERTIFICATION_PERSONAS
from utils import (
    ApiKeyRequiredError,
    get_request_api_key,
    get_request_model,
)

DEFAULT_MODEL = "gpt-4o-mini"


# Valid user levels
VALID_USER_LEVELS = ["beginner", "intermediate", "advanced", "expert"]
VALID_CERT_CODES = list(CERTIFICATION_PERSONAS.keys())


class StudyPlanValidationError(Exception):
    """Raised when study plan generation parameters are invalid"""
    pass


def validate_study_plan_params(user_level: str, cert_code: str) -> None:
    """
    Validate that user_level and cert_code are provided and valid.
    
    Args:
        user_level: User skill level ('beginner', 'intermediate', 'advanced', 'expert')
        cert_code: AWS certification persona ID (e.g., 'solutions-architect-associate')
    
    Raises:
        StudyPlanValidationError: If parameters are missing or invalid
    """
    if not user_level:
        raise StudyPlanValidationError(
            "user_level is required. Study plans must be user-level specific. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if not cert_code:
        raise StudyPlanValidationError(
            "cert_code is required. Study plans must be certification-specific. "
            f"Valid cert codes: {', '.join(VALID_CERT_CODES)}"
        )
    
    if user_level not in VALID_USER_LEVELS:
        raise StudyPlanValidationError(
            f"Invalid user_level '{user_level}'. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if cert_code not in VALID_CERT_CODES:
        raise StudyPlanValidationError(
            f"Invalid cert_code '{cert_code}'. "
            f"Valid cert codes: {', '.join(VALID_CERT_CODES)}"
        )

# Platform features that can be recommended
PLATFORM_ACTIONS = {
    "game": {
        "sniper_quiz": {
            "title": "Sniper Quiz",
            "description": "High-stakes single-shot questions - one wrong and you're out",
            "link": "/game/modes/sniper-quiz",
        },
        "lightning_round": {
            "title": "Lightning Round",
            "description": "60 seconds to answer as many questions as possible",
            "link": "/game",
        },
        "hot_streak": {
            "title": "Hot Streak",
            "description": "Build multiplier streaks with consecutive correct answers",
            "link": "/game",
        },
        "quiz_battle": {
            "title": "Quiz Battle",
            "description": "1v1 head-to-head knowledge showdown",
            "link": "/game",
        },
        "cloud_tycoon": {
            "title": "Cloud Tycoon",
            "description": "Build infrastructure and earn virtual money",
            "link": "/game/modes/cloud-tycoon",
        },
    },
    "exam": {
        "practice_exam": {
            "title": "Practice Exam",
            "description": "Full-length certification practice exam",
            "link": "/learn/exams",
        },
    },
    "quiz": {
        "topic_quiz": {
            "title": "Topic Quiz",
            "description": "Focused quiz on specific AWS topics",
            "link": "/learn/quiz",
        },
    },
    "challenge": {
        "architecture_challenge": {
            "title": "Architecture Challenge",
            "description": "Real-world scenario-based architecture challenge",
            "link": "/challenges",
        },
    },
    "flashcard": {
        "flashcard_deck": {
            "title": "Flashcard Review",
            "description": "Spaced repetition flashcard study",
            "link": "/learn/flashcards",
        },
    },
}


class StudyGuideContext(BaseModel):
    """Inputs for generating a personalized study guide."""
    cert_code: str  # REQUIRED: certification persona ID
    skill_level: str  # REQUIRED: user skill level
    time_horizon_weeks: int
    hours_per_week: int
    learning_style: str  # visual, auditory, reading, hands_on
    coach_notes: Optional[str] = None
    telemetry_summary: Optional[str] = None


# Legacy StudyPlanContext - kept for backward compatibility with existing endpoints
class StudyPlanContext(BaseModel):
    """Legacy context for study plan generation."""
    target_exam: Optional[str] = None
    time_horizon: str = "6 weeks"
    study_hours_per_week: int = 6
    confidence_level: str = "intermediate"
    weak_areas: List[str] = []
    focus_domains: List[str] = []
    preferred_formats: List[str] = []
    learner_notes: Optional[str] = None
    telemetry_summary: Optional[str] = None


STUDY_GUIDE_PROMPT = """You are an expert AWS certification coach creating a personalized study plan.

## Learner Profile
- Target Certification: {target_certification}
- Current Skill Level: {skill_level}
- Time Available: {time_horizon_weeks} weeks, {hours_per_week} hours/week
- Learning Style: {learning_style}
- Additional Notes: {coach_notes}
- Progress Summary: {telemetry_summary}

## Platform Features Available
You MUST recommend actions from these specific platform features:

**Games (type: "game")**
- sniper_quiz: High-stakes single-shot questions (good for testing knowledge under pressure)
- lightning_round: 60-second speed challenges (good for quick recall practice)
- hot_streak: Build multiplier streaks (good for building confidence)
- quiz_battle: 1v1 battles (good for competitive learners)
- cloud_tycoon: Build infrastructure simulation (good for hands-on learners)

**Practice Exams (type: "exam")**
- practice_exam: Full certification practice exams (essential for exam readiness)

**Quizzes (type: "quiz")**
- topic_quiz: Focused topic quizzes (good for targeting weak areas)

**Challenges (type: "challenge")**
- architecture_challenge: Real-world scenario challenges (essential for hands-on learning)

**Flashcards (type: "flashcard")**
- flashcard_deck: Spaced repetition review (good for memorization)

## Learning Style Recommendations
- visual: Prioritize architecture challenges, diagrams, Cloud Tycoon
- auditory: Prioritize quiz battles, discussions
- reading: Prioritize flashcards, study notes
- hands_on: Prioritize challenges, Cloud Tycoon, architecture exercises

## Output Format
Return a JSON object with this exact structure:
{{
  "summary": "Brief 1-2 sentence personalized summary of the plan",
  "total_weeks": {time_horizon_weeks},
  "weeks": [
    {{
      "week_number": 1,
      "theme": "Week theme (e.g., 'Compute Foundations')",
      "focus": "What to focus on this week",
      "actions": [
        {{
          "id": "unique-id-1",
          "type": "game|exam|quiz|challenge|flashcard",
          "title": "Action title",
          "description": "What to do",
          "target": "Specific target (e.g., 'Score 80%' or 'Complete 3 rounds')",
          "link": "/path/to/feature",
          "completed": false
        }}
      ]
    }}
  ],
  "milestones": [
    {{
      "label": "Milestone name",
      "week_number": 2,
      "metric": "How to measure success",
      "completed": false
    }}
  ],
  "accountability": [
    "Daily reminder or accountability tip"
  ],
  "resources": [
    {{
      "title": "Resource name",
      "url": "https://...",
      "type": "video|whitepaper|documentation|course"
    }}
  ]
}}

## Guidelines
1. Create {time_horizon_weeks} weeks of content
2. Each week should have 3-5 specific actions
3. Balance different action types based on learning style
4. Include at least one practice exam in the final weeks
5. Add 2-3 meaningful milestones
6. Include 2-3 accountability reminders
7. Recommend 2-4 external resources based on learning style (YouTube for visual, AWS docs for reading, etc.)
8. Make targets specific and measurable
9. Progress from fundamentals to advanced topics
10. For {target_certification}, focus on the key exam domains

Generate the study plan JSON now. Output ONLY valid JSON, no prose."""


async def generate_study_plan(
    context: StudyPlanContext,
    *,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Legacy study plan generator - kept for backward compatibility.
    Uses the old endpoint that other code depends on.
    """
    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required for study plan generation.")

    model_name = model or get_request_model() or DEFAULT_MODEL

    prompt = f"""You are an expert AWS certification coach. Create a personalized study plan.

Target Exam: {context.target_exam or "AWS Certification"}
Time Horizon: {context.time_horizon}
Study Hours/Week: {context.study_hours_per_week}
Confidence Level: {context.confidence_level}
Weak Areas: {', '.join(context.weak_areas) if context.weak_areas else 'None specified'}
Focus Domains: {', '.join(context.focus_domains) if context.focus_domains else 'All domains'}
Preferred Formats: {', '.join(context.preferred_formats) if context.preferred_formats else 'Mixed'}
Learner Notes: {context.learner_notes or 'None'}
Progress Summary: {context.telemetry_summary}

Create a structured study plan with weekly goals, milestones, and accountability reminders.
Return as JSON with: summary, weeks (array with week_number, theme, focus, actions), milestones, accountability.
"""

    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Generate my study plan now."},
    ]

    client = AsyncOpenAI(api_key=key)
    response = await client.chat.completions.create(
        model=model_name,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.7,
    )

    content = response.choices[0].message.content
    try:
        plan = json.loads(content)
    except json.JSONDecodeError as err:
        logger.error("Study plan JSON parse failure: %s", err)
        raise ValueError("Agent returned invalid study plan JSON") from err

    return plan


async def generate_study_guide(
    context: StudyGuideContext,
    *,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate a personalized study guide with platform-specific actions.
    
    IMPORTANT: context.cert_code and context.skill_level are REQUIRED.
    Each study guide must be certification-specific and user-level specific.
    
    Args:
        context: StudyGuideContext with cert_code and skill_level (both REQUIRED)
        model: Optional model override
        api_key: Optional OpenAI API key
    
    Returns:
        JSON-serializable dict ready to persist in StudyPlan.planOutput
    
    Raises:
        StudyPlanValidationError: If cert_code or skill_level are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_study_plan_params(context.skill_level, context.cert_code)
    
    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required for study guide generation.")
    
    # Fetch current AWS knowledge from database
    from utils import fetch_knowledge_for_generation
    knowledge_context = await fetch_knowledge_for_generation(
        cert_code=context.cert_code,
        topic=f"{context.target_certification} study guide",
        limit=5,
        api_key=api_key
    )
    
    model_name = model or get_request_model() or DEFAULT_MODEL
    
    # Get certification context (cert_code is now required and validated)
    if context.cert_code not in CERTIFICATION_PERSONAS:
        raise StudyPlanValidationError(f"Unknown certification persona: {context.cert_code}")
    
    persona = CERTIFICATION_PERSONAS[context.cert_code]
    target_certification = persona["cert"]

    # Build the prompt
    prompt = STUDY_GUIDE_PROMPT.format(
        target_certification=target_certification,
        skill_level=context.skill_level,
        time_horizon_weeks=context.time_horizon_weeks,
        hours_per_week=context.hours_per_week,
        learning_style=context.learning_style,
        coach_notes=context.coach_notes or "None provided",
        telemetry_summary=context.telemetry_summary or "New learner, no activity yet",
    )

    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": f"Generate my personalized study plan now.\n\n{knowledge_context}"},
    ]

    client = AsyncOpenAI(api_key=key)

    response = await client.chat.completions.create(
        model=model_name,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.7,
    )

    content = response.choices[0].message.content

    try:
        plan = json.loads(content)
    except json.JSONDecodeError as err:
        logger.error("Study guide JSON parse failure: %s", err)
        raise ValueError("Agent returned invalid study guide JSON") from err

    # Ensure all actions have unique IDs and correct links
    plan = enrich_plan_with_platform_data(plan)

    return plan


def enrich_plan_with_platform_data(plan: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure all actions have proper IDs and links from platform data."""
    
    for week in plan.get("weeks", []):
        for action in week.get("actions", []):
            # Ensure unique ID
            if not action.get("id"):
                action["id"] = str(uuid.uuid4())[:8]
            
            # Ensure completed is boolean
            action["completed"] = bool(action.get("completed", False))
            
            # Get correct link from platform data
            action_type = action.get("type", "")
            if action_type in PLATFORM_ACTIONS:
                # Find the first matching action in this type
                type_actions = PLATFORM_ACTIONS[action_type]
                if type_actions:
                    first_action = list(type_actions.values())[0]
                    if not action.get("link"):
                        action["link"] = first_action["link"]
    
    # Ensure milestones have completed field
    for milestone in plan.get("milestones", []):
        milestone["completed"] = bool(milestone.get("completed", False))
    
    return plan


# ============================================
# FORMAT STUDY GUIDE - AI is just a formatter
# ============================================

FORMAT_STUDY_GUIDE_PROMPT = """You are formatting a study guide for an AWS certification learner.

## Learner Context
- Target Certification: {target_certification}
- Skill Level: {skill_level}
- Study Duration: {time_horizon_weeks} weeks, {hours_per_week} hours/week
- Learning Styles: {learning_styles}
- Coach Notes: {coach_notes}

## IMPORTANT: Your Role
You are a FORMATTER, not a decision maker. The content below has already been selected from the database.
Your job is to:
1. Add a motivating summary
2. Add weekly themes based on the content
3. Add focus descriptions for each week
4. Add specific, measurable targets for each action
5. Add accountability reminders
6. Suggest 2-3 external resources (YouTube, AWS docs) based on learning style

DO NOT add, remove, or change the actions. They are pre-selected from real database content.

## Pre-Selected Content
{structured_content_json}

## Output Format
Return a JSON object with this structure:
{{
  "summary": "Motivating 1-2 sentence summary of the plan",
  "total_weeks": {time_horizon_weeks},
  "weeks": [
    {{
      "week_number": 1,
      "theme": "Add a theme based on the actions (e.g., 'Compute Foundations')",
      "focus": "What to focus on this week based on the actions",
      "actions": [
        // COPY THE ACTIONS EXACTLY from the input, but add a "target" field
        // e.g., if action is a challenge, target might be "Complete with 80%+ score"
        // if action is flashcards, target might be "Master 20 cards"
        // if action is a game, target might be "Score 500+ points"
      ]
    }}
  ],
  "milestones": [
    // COPY FROM INPUT, keep as-is
  ],
  "accountability": [
    "Daily reminder based on learning style",
    "Weekly check-in suggestion",
    "Motivation tip"
  ],
  "resources": [
    {{
      "title": "Resource name",
      "url": "https://...",
      "type": "video|documentation|course"
    }}
  ]
}}

Output ONLY valid JSON."""


async def format_study_guide(
    cert_code: str,
    skill_level: str,
    time_horizon_weeks: int,
    hours_per_week: int,
    learning_styles: List[str],
    coach_notes: Optional[str],
    structured_content: Dict[str, Any],
    *,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    FORMAT a study guide from pre-selected content.
    
    IMPORTANT: cert_code and skill_level are REQUIRED.
    
    Args:
        cert_code: Certification persona ID (REQUIRED, e.g., 'solutions-architect-associate')
        skill_level: User's skill level (REQUIRED: 'beginner', 'intermediate', 'advanced', 'expert')
        time_horizon_weeks: Study duration in weeks
        hours_per_week: Hours available per week
        learning_styles: List of learning style preferences
        coach_notes: Optional coach notes
        structured_content: Pre-selected content to format
        model: Optional model override
        api_key: Optional OpenAI API key
    
    Returns:
        Formatted study guide JSON
    
    Raises:
        StudyPlanValidationError: If cert_code or skill_level are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_study_plan_params(skill_level, cert_code)
    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required for study guide formatting.")

    model_name = model or get_request_model() or DEFAULT_MODEL
    
    # Get certification context (cert_code is now required and validated)
    if cert_code not in CERTIFICATION_PERSONAS:
        raise StudyPlanValidationError(f"Unknown certification persona: {cert_code}")
    
    persona = CERTIFICATION_PERSONAS[cert_code]
    target_certification = persona["cert"]

    # Build the prompt with the pre-selected content
    prompt = FORMAT_STUDY_GUIDE_PROMPT.format(
        target_certification=target_certification,
        skill_level=skill_level,
        time_horizon_weeks=time_horizon_weeks,
        hours_per_week=hours_per_week,
        learning_styles=", ".join(learning_styles),
        coach_notes=coach_notes or "None provided",
        structured_content_json=json.dumps(structured_content, indent=2),
    )

    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Format my study guide now. Remember: DO NOT change the actions, just add themes, targets, and formatting."},
    ]

    client = AsyncOpenAI(api_key=key)

    response = await client.chat.completions.create(
        model=model_name,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.5,  # Lower temperature for more consistent formatting
    )

    content = response.choices[0].message.content

    try:
        plan = json.loads(content)
    except json.JSONDecodeError as err:
        logger.error("Study guide format JSON parse failure: %s", err)
        raise ValueError("Agent returned invalid study guide JSON") from err

    # Validate that actions weren't changed (safety check)
    plan = validate_and_fix_actions(plan, structured_content)

    # Fetch real resources using Crawl4AI (YouTube + AWS docs)
    try:
        from generators.resource_fetcher import fetch_study_resources
        real_resources = await fetch_study_resources(
            cert_code=cert_code,
            learning_styles=learning_styles,
            max_youtube=2,
            max_docs=2
        )
        if real_resources:
            plan["resources"] = real_resources
            logger.info(f"Fetched {len(real_resources)} real resources for study guide")
    except Exception as e:
        logger.warning(f"Failed to fetch real resources, using AI-generated: {e}")
        # Keep AI-generated resources as fallback

    return plan


def validate_and_fix_actions(
    formatted_plan: Dict[str, Any],
    original_content: Dict[str, Any]
) -> Dict[str, Any]:
    """Ensure the AI didn't hallucinate or remove actions."""
    
    original_weeks = original_content.get("weeks", [])
    formatted_weeks = formatted_plan.get("weeks", [])
    
    # If AI messed up the weeks, use original structure
    if len(formatted_weeks) != len(original_weeks):
        logger.warning("AI changed week count, using original structure")
        formatted_plan["weeks"] = original_weeks
        return formatted_plan
    
    # For each week, ensure actions match
    for i, (orig_week, fmt_week) in enumerate(zip(original_weeks, formatted_weeks)):
        orig_actions = orig_week.get("actions", [])
        fmt_actions = fmt_week.get("actions", [])
        
        # If action count doesn't match, use original
        if len(fmt_actions) != len(orig_actions):
            logger.warning(f"Week {i+1}: AI changed action count, using original")
            fmt_week["actions"] = orig_actions
            continue
        
        # Ensure each action has the original ID and link
        for j, (orig_action, fmt_action) in enumerate(zip(orig_actions, fmt_actions)):
            # Preserve original fields, allow AI to add target
            fmt_action["id"] = orig_action.get("id", str(uuid.uuid4())[:8])
            fmt_action["type"] = orig_action.get("type")
            fmt_action["title"] = orig_action.get("title")
            fmt_action["link"] = orig_action.get("link")
            fmt_action["completed"] = False
            
            # Keep description from original if AI removed it
            if not fmt_action.get("description"):
                fmt_action["description"] = orig_action.get("description", "")
    
    # Preserve original milestones
    formatted_plan["milestones"] = original_content.get("milestones", [])
    for m in formatted_plan["milestones"]:
        m["completed"] = False
    
    return formatted_plan
