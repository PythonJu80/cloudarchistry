"""
Study Guide Generator
=====================
Generates personalized study plans with platform-specific actions.
Knows about the Cloud Academy platform features: games, exams, quizzes, challenges, flashcards.
"""

from __future__ import annotations

import json
import os
import uuid
from typing import List, Optional, Dict, Any

from openai import AsyncOpenAI
from pydantic import BaseModel

from config.settings import logger
from prompts import CERTIFICATION_PERSONAS
from utils import (
    ApiKeyRequiredError,
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
# COMPREHENSIVE list of ALL platform features available to learners
PLATFORM_ACTIONS = {
    # SERIOUS STUDY FEATURES (prioritize these)
    "practice_exam": {
        "practice_exam": {
            "title": "Practice Exam",
            "description": "Full-length certification practice exam with real exam conditions",
            "link": "/learn/exams",
        },
    },
    "world_challenge": {
        "world_map_challenge": {
            "title": "World Map Challenge",
            "description": "Real-world scenario challenges from the world map",
            "link": "/world",
        },
    },
    "drawing_challenge": {
        "architecture_drawing": {
            "title": "Architecture Drawing Challenge",
            "description": "Design and draw AWS architectures to solve real problems",
            "link": "/challenges",
        },
    },
    "cli_practice": {
        "cli_simulator": {
            "title": "CLI Simulator",
            "description": "Practice AWS CLI commands in a safe sandbox environment",
            "link": "/learn/cli",
        },
    },
    "flashcard": {
        "flashcard_deck": {
            "title": "Flashcard Review",
            "description": "Spaced repetition flashcard study for key concepts",
            "link": "/learn/flashcards",
        },
    },
    "quiz": {
        "topic_quiz": {
            "title": "Topic Quiz",
            "description": "Focused quiz on specific AWS topics and services",
            "link": "/learn/quiz",
        },
    },
    "notes": {
        "study_notes": {
            "title": "Study Notes",
            "description": "AI-generated comprehensive study notes on AWS topics",
            "link": "/learn/notes",
        },
    },
    "learning_center": {
        "learning_hub": {
            "title": "Learning Center",
            "description": "Comprehensive learning resources and guided paths",
            "link": "/learn",
        },
    },
    "ai_chat": {
        "chat_with_agent": {
            "title": "Chat with AI Tutor",
            "description": "Ask questions and get personalized explanations from the AI tutor",
            "link": "/learn/chat",
        },
    },
    "resources": {
        "external_resources": {
            "title": "Curated Resources",
            "description": "Handpicked AWS documentation, videos, and learning materials",
            "link": "/learn/resources",
        },
    },
    
    # GAMES (use sparingly as reinforcement, not primary learning)
    "game": {
        "sniper_quiz": {
            "title": "Sniper Quiz",
            "description": "High-stakes single-shot questions - one wrong and you're out",
            "link": "/game/modes/sniper-quiz",
        },
        "lightning_round": {
            "title": "Lightning Round",
            "description": "60 seconds to answer as many questions as possible",
            "link": "/game/modes/lightning-round",
        },
        "hot_streak": {
            "title": "Hot Streak",
            "description": "Build multiplier streaks with consecutive correct answers",
            "link": "/game/modes/hot-streak",
        },
        "quiz_battle": {
            "title": "Quiz Battle",
            "description": "1v1 head-to-head knowledge showdown",
            "link": "/game/modes/quiz-battle",
        },
        "cloud_tycoon": {
            "title": "Cloud Tycoon",
            "description": "Build infrastructure and earn virtual money",
            "link": "/game/modes/cloud-tycoon",
        },
        "survival_mode": {
            "title": "Survival Mode",
            "description": "Answer questions under pressure - how long can you survive?",
            "link": "/game/modes/survival",
        },
        "time_attack": {
            "title": "Time Attack",
            "description": "Race against the clock to answer as many questions as possible",
            "link": "/game/modes/time-attack",
        },
        "perfect_run": {
            "title": "Perfect Run",
            "description": "Aim for a perfect score - no mistakes allowed",
            "link": "/game/modes/perfect-run",
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
You MUST recommend actions from these specific platform features.

**PRIORITY: SERIOUS STUDY FEATURES (Use these as primary learning methods)**

**Practice Exams (type: "practice_exam")**
- practice_exam: Full certification practice exams (ESSENTIAL for exam readiness)

**World Map Challenges (type: "world_challenge")**
- world_map_challenge: Real-world scenario challenges (excellent for applied learning)

**Architecture Drawing (type: "drawing_challenge")**
- architecture_drawing: Design and draw AWS architectures (critical for visual/hands-on learners)

**CLI Practice (type: "cli_practice")**
- cli_simulator: Practice AWS CLI commands safely (essential for practical skills)

**Flashcards (type: "flashcard")**
- flashcard_deck: Spaced repetition review (excellent for memorization and retention)

**Quizzes (type: "quiz")**
- topic_quiz: Focused topic quizzes (good for targeting weak areas)

**Study Notes (type: "notes")**
- study_notes: AI-generated comprehensive study notes (great for reading/writing learners)

**Learning Center (type: "learning_center")**
- learning_hub: Comprehensive learning resources and guided paths (good for structured learning)

**AI Chat (type: "ai_chat")**
- chat_with_agent: Ask questions and get personalized explanations (excellent for clarifying concepts)

**Resources (type: "resources")**
- external_resources: Curated AWS docs, videos, materials (supplement your learning)

**SECONDARY: GAMES (Use sparingly as reinforcement/breaks, NOT primary learning)**

**Game Zone (type: "game")** - Limit to 1-2 per week maximum
- sniper_quiz: High-stakes single-shot questions
- lightning_round: 60-second speed challenges
- hot_streak: Build multiplier streaks
- quiz_battle: 1v1 battles
- cloud_tycoon: Build infrastructure simulation
- survival_mode: Answer under pressure
- time_attack: Race against the clock
- perfect_run: Aim for perfect score

## Learning Style Recommendations
- visual: Prioritize architecture_drawing, world_map_challenge, study_notes with diagrams
- auditory: Prioritize ai_chat (discussion), external_resources (videos)
- reading: Prioritize study_notes, flashcard_deck, external_resources (documentation)
- hands_on: Prioritize world_map_challenge, architecture_drawing, cli_simulator, practice_exam

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
2. Each week should have 4-6 specific actions
3. **CRITICAL**: 70-80% of actions should be SERIOUS STUDY features (practice exams, world challenges, drawing, CLI, flashcards, quizzes, notes, learning center, AI chat)
4. **CRITICAL**: Maximum 1-2 games per week, positioned as breaks/reinforcement only
5. Include at least one practice exam in the final 2 weeks
6. For hands-on/visual learners: Heavy emphasis on world_map_challenge, architecture_drawing, cli_simulator
7. For reading learners: Heavy emphasis on study_notes, flashcard_deck, external_resources
8. Add 3-4 meaningful milestones tied to exam domains
9. Include 2-3 accountability reminders
10. Recommend 2-4 external resources based on learning style (YouTube for visual, AWS docs for reading, etc.)
11. Make targets specific and measurable
12. Progress from fundamentals to advanced topics
13. For {target_certification}, focus on the key exam domains
14. Utilize the full breadth of platform features - don't just repeat the same actions

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
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required. Set OPENAI_API_KEY in .env file.")

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
    
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required. Set OPENAI_API_KEY in .env file.")
    
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

FORMAT_STUDY_GUIDE_PROMPT = """You are an expert AWS certification coach formatting a personalized study guide.

## Learner Context
- Target Certification: {target_certification}
- Skill Level: {skill_level}
- Study Duration: {time_horizon_weeks} weeks, {hours_per_week} hours/week
- Learning Styles: {learning_styles}
- Exam Date: {exam_date_info}
- Coach Notes: {coach_notes}
- Current Progress: {progress_summary}

## IMPORTANT: Your Role
You are a FORMATTER, not a decision maker. The content below has already been selected from the database.
Your job is to:
1. Add a motivating, personalized summary that acknowledges their exam timeline and learning preferences
2. Add weekly themes based on the content
3. Add focus descriptions for each week
4. Add specific, measurable targets for each action
5. Add 6-8 deeply personalized accountability reminders with encouragement
6. Suggest 2-3 external resources (YouTube, AWS docs) based on learning style

DO NOT add, remove, or change the actions. They are pre-selected from real database content.

## Pre-Selected Content
{structured_content_json}

## Platform Features Reference
The pre-selected content uses these platform feature types:

**SERIOUS STUDY FEATURES** (prioritize in targets):
- practice_exam: Practice exams → Target: "Score 75%+" or "Complete under exam conditions"
- world_challenge: World map challenges → Target: "Complete 3 scenarios" or "Build working solution"
- drawing_challenge: Architecture drawing → Target: "Design solution with 80%+ accuracy"
- cli_practice: CLI simulator → Target: "Complete 10 commands" or "Master service CLI"
- flashcard: Flashcard review → Target: "Master 30 cards" or "90%+ accuracy"
- quiz: Topic quizzes → Target: "Score 80%+" or "Complete 2 quizzes"
- notes: Study notes → Target: "Review and annotate notes" or "Create summary"
- learning_center: Learning hub → Target: "Complete learning path" or "Review resources"
- ai_chat: AI tutor chat → Target: "Clarify 3 concepts" or "Ask 5 questions"
- resources: External resources → Target: "Watch video" or "Read documentation"

**GAMES** (use sparingly as breaks):
- game: Game zone → Target: "10-minute break" or "Quick reinforcement"

## Output Format
Return a JSON object with this structure:
{{
  "summary": "Personalized 2-3 sentence summary that mentions their exam timeline, skill level, and learning preferences. Be encouraging and specific.",
  "total_weeks": {time_horizon_weeks},
  "weeks": [
    {{
      "week_number": 1,
      "theme": "Add a theme based on the actions (e.g., 'Compute Foundations')",
      "focus": "What to focus on this week based on the actions",
      "actions": [
        // COPY THE ACTIONS EXACTLY from the input, but add a "target" field
        // Use the Platform Features Reference above for appropriate targets
        // Match the target to the action type and user's skill level
      ]
    }}
  ],
  "milestones": [
    // COPY FROM INPUT, keep as-is
  ],
  "accountability": [
    "6-8 personalized accountability reminders that:",
    "- Reference their exam timeline (e.g., 'With X weeks until your exam...')",
    "- Acknowledge their skill level and learning style",
    "- Provide specific daily/weekly habits",
    "- Include encouragement and growth mindset tips",
    "- Suggest progress tracking methods",
    "- Offer recovery strategies for when falling behind",
    "- Celebrate effort, not just results",
    "- Build confidence for exam day"
  ],
  "resources": [
    {{
      "title": "Resource name",
      "url": "https://...",
      "type": "video|documentation|course|whitepaper"
    }}
  ]
}}

## Accountability Examples (adapt to user's context):
- "With X weeks until your exam, dedicate 30 minutes each morning to review yesterday's concepts. Consistency beats cramming!"
- "As a {skill_level} learner, you're building on solid foundations. Track your progress weekly and celebrate small wins."
- "Your learning preferences ({learning_styles}) mean hands-on practice sticks best. Use the world map challenges and architecture drawing to build real solutions."
- "Feeling overwhelmed? That's normal. Break each study session into 25-minute focused blocks with 5-minute breaks."
- "Join an AWS study group or find an accountability partner. Use the AI chat feature when you're stuck - teaching others reinforces understanding."
- "Keep a 'wins journal' - write down one thing you mastered each day, no matter how small. Review your study notes weekly."
- "The exam tests applied knowledge, not memorization. Focus on understanding WHY through CLI practice and drawing challenges."
- "You've got this! Every expert was once a beginner. Trust the process, stay consistent, and use the full platform."
- "Games are fun, but serious study builds real skills. Prioritize practice exams, world challenges, and hands-on work."
- "Track your streak! Even 15 minutes daily with flashcards or CLI practice compounds over time."

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
    exam_date: Optional[str] = None,
    progress_summary: Optional[str] = None,
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
        exam_date: Optional exam date for countdown awareness
        progress_summary: Optional user progress summary
        model: Optional model override
        api_key: Optional OpenAI API key
    
    Returns:
        Formatted study guide JSON
    
    Raises:
        StudyPlanValidationError: If cert_code or skill_level are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_study_plan_params(skill_level, cert_code)
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required. Set OPENAI_API_KEY in .env file.")

    model_name = model or get_request_model() or DEFAULT_MODEL
    
    # Get certification context (cert_code is now required and validated)
    if cert_code not in CERTIFICATION_PERSONAS:
        raise StudyPlanValidationError(f"Unknown certification persona: {cert_code}")
    
    persona = CERTIFICATION_PERSONAS[cert_code]
    target_certification = persona["cert"]

    # Calculate exam date info for personalized messaging
    exam_date_info = "Not specified"
    if exam_date:
        try:
            from datetime import datetime
            exam_dt = datetime.fromisoformat(exam_date.replace('Z', '+00:00'))
            days_until = (exam_dt - datetime.now()).days
            if days_until > 0:
                exam_date_info = f"{exam_date} ({days_until} days away)"
            else:
                exam_date_info = f"{exam_date} (exam has passed)"
        except:
            exam_date_info = exam_date

    # Build the prompt with the pre-selected content
    prompt = FORMAT_STUDY_GUIDE_PROMPT.format(
        target_certification=target_certification,
        skill_level=skill_level,
        time_horizon_weeks=time_horizon_weeks,
        hours_per_week=hours_per_week,
        learning_styles=", ".join(learning_styles),
        exam_date_info=exam_date_info,
        coach_notes=coach_notes or "None provided",
        progress_summary=progress_summary or "New learner starting their journey",
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

    # Fetch real resources using Brave Search (validated YouTube + AWS docs)
    try:
        from generators.resource_fetcher import fetch_study_resources
        real_resources = await fetch_study_resources(
            certification=cert_code,
            skill_level=skill_level,
            learning_styles=learning_styles,
            max_youtube=3,
            max_docs=2
        )
        if real_resources:
            plan["resources"] = real_resources
            logger.info(f"Fetched {len(real_resources)} validated resources for {cert_code} ({skill_level} level)")
    except Exception as e:
        logger.warning(f"Failed to fetch validated resources, using AI-generated: {e}")
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
