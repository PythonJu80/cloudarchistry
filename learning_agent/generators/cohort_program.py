"""
Cohort Program Generator
========================
Generates structured cohort learning programs for tutors.
Creates week-by-week curriculum with platform-aware actions, checkpoints, and capstone projects.
Includes links to specific platform features (games, challenges, flashcards, etc.)
"""

from __future__ import annotations

import json
import uuid
from typing import Optional, Dict, Any, List

from openai import AsyncOpenAI
from pydantic import BaseModel

from config.settings import logger
from prompts import CERTIFICATION_PERSONAS
from utils import (
    get_request_model,
    DEFAULT_MODEL,
)


# Platform features available for cohort programs
# Maps to actual platform routes
PLATFORM_ACTIONS = {
    # Core learning features
    "world_challenge": {
        "title": "World Map Challenge",
        "description": "Real-world scenario challenges from the world map",
        "link": "/world",
        "type": "challenge",
    },
    "architecture_drawing": {
        "title": "Architecture Drawing",
        "description": "Design and draw AWS architectures",
        "link": "/challenges",
        "type": "challenge",
    },
    "cli_simulator": {
        "title": "CLI Simulator",
        "description": "Practice AWS CLI commands in a sandbox",
        "link": "/learn/cli",
        "type": "challenge",
    },
    "practice_exam": {
        "title": "Practice Exam",
        "description": "Full-length certification practice exam",
        "link": "/learn/exams",
        "type": "exam",
    },
    "flashcards": {
        "title": "Flashcard Review",
        "description": "Spaced repetition flashcard study",
        "link": "/learn/flashcards",
        "type": "flashcard",
    },
    "quiz": {
        "title": "Topic Quiz",
        "description": "Focused quiz on specific AWS topics",
        "link": "/learn/quiz",
        "type": "quiz",
    },
    "study_notes": {
        "title": "Study Notes",
        "description": "AI-generated comprehensive study notes",
        "link": "/learn/notes",
        "type": "resource",
    },
    "learning_center": {
        "title": "Learning Center",
        "description": "Comprehensive learning resources",
        "link": "/learn",
        "type": "resource",
    },
    "ai_chat": {
        "title": "AI Tutor Chat",
        "description": "Ask questions and get explanations",
        "link": "/learn/chat",
        "type": "resource",
    },
    # Games (use sparingly)
    "sniper_quiz": {
        "title": "Sniper Quiz",
        "description": "High-stakes single-shot questions",
        "link": "/game/modes/sniper-quiz",
        "type": "game",
    },
    "hot_streak": {
        "title": "Hot Streak",
        "description": "Build multiplier streaks",
        "link": "/game/modes/hot-streak",
        "type": "game",
    },
    "lightning_round": {
        "title": "Lightning Round",
        "description": "60-second speed challenges",
        "link": "/game/modes/lightning-round",
        "type": "game",
    },
    "cloud_tycoon": {
        "title": "Cloud Tycoon",
        "description": "Build infrastructure simulation",
        "link": "/game/modes/cloud-tycoon",
        "type": "game",
    },
}


COHORT_PROGRAM_SYSTEM_PROMPT = """You are an expert AWS training curriculum designer creating a cohort learning program.

## Platform Features Available
You MUST recommend actions from these specific platform features with their exact IDs:

**CORE LEARNING (prioritize these - 70-80% of actions)**
- world_challenge: Real-world scenario challenges from the world map
- architecture_drawing: Design and draw AWS architectures
- cli_simulator: Practice AWS CLI commands in a sandbox
- practice_exam: Full-length certification practice exams
- flashcards: Spaced repetition flashcard study
- quiz: Focused quizzes on specific AWS topics
- study_notes: AI-generated comprehensive study notes
- learning_center: Comprehensive learning resources
- ai_chat: Ask questions and get AI explanations

**GAMES (use sparingly - max 1-2 per week as reinforcement)**
- sniper_quiz: High-stakes single-shot questions
- hot_streak: Build multiplier streaks
- lightning_round: 60-second speed challenges
- cloud_tycoon: Build infrastructure simulation

## Output Format
Return a JSON object with this exact structure:
{
  "title": "string - catchy program title",
  "outcome": "string - the main learning outcome",
  "duration": number,
  "level": "string",
  "sessionsPerWeek": number,
  "weeklyHours": number,
  "targetCertification": "string or null",
  "weeks": [
    {
      "week": number,
      "title": "string - week theme",
      "focus": "string - what to focus on this week",
      "topics": ["string array of 3-5 topics covered"],
      "actions": [
        {
          "id": "unique-action-id",
          "actionType": "world_challenge|architecture_drawing|cli_simulator|practice_exam|flashcards|quiz|study_notes|learning_center|ai_chat|sniper_quiz|hot_streak|lightning_round|cloud_tycoon",
          "title": "string - specific action title",
          "description": "string - what to do",
          "target": "string - specific measurable target (e.g., 'Complete 2 scenarios', 'Score 80%')",
          "estimatedMinutes": number
        }
      ],
      "checkpoint": {
        "id": "checkpoint-id",
        "title": "string - checkpoint name",
        "type": "quiz|practical",
        "criteria": ["string array of 2-3 success criteria"]
      }
    }
  ],
  "milestones": [
    {
      "id": "milestone-id",
      "label": "string - milestone name",
      "weekNumber": number,
      "metric": "string - how to measure success"
    }
  ],
  "capstone": {
    "id": "capstone-id",
    "title": "string - capstone project title",
    "description": "string - what they'll build",
    "deliverables": [
      {
        "id": "deliverable-id",
        "title": "string - deliverable name",
        "description": "string - what to submit"
      }
    ]
  }
}

## Guidelines
1. Create the specified number of weeks
2. Each week should have 4-6 specific actions
3. **CRITICAL**: 70-80% of actions should be CORE LEARNING features
4. **CRITICAL**: Maximum 1-2 games per week, positioned as breaks/reinforcement
5. Include checkpoints at weeks 2, 4, and the final week
6. Add 3-4 meaningful milestones tied to learning objectives
7. Each action must have a specific, measurable target
8. Progress from fundamentals to advanced topics
9. Capstone should tie together all learned skills
10. Tailor difficulty to the specified skill level

For skill levels:
- beginner: Focus on fundamentals, console-first, lots of guidance, more flashcards/notes
- intermediate: Mix of console and CLI, architecture challenges, practice exams
- advanced: CLI/IaC focus, complex architectures, production considerations"""


def enrich_program_with_links(program: Dict[str, Any]) -> Dict[str, Any]:
    """
    Post-process the AI-generated program to add platform links and ensure IDs.
    """
    # Process weeks
    for week in program.get("weeks", []):
        for action in week.get("actions", []):
            # Ensure action has an ID
            if not action.get("id"):
                action["id"] = f"action-{uuid.uuid4().hex[:8]}"
            
            # Add link and type from platform actions
            action_type = action.get("actionType", "")
            if action_type in PLATFORM_ACTIONS:
                platform_action = PLATFORM_ACTIONS[action_type]
                action["link"] = platform_action["link"]
                action["type"] = platform_action["type"]
            else:
                # Default to learning center
                action["link"] = "/learn"
                action["type"] = "resource"
            
            # Ensure completed flag
            action["completed"] = False
        
        # Ensure checkpoint has ID
        checkpoint = week.get("checkpoint")
        if checkpoint and not checkpoint.get("id"):
            checkpoint["id"] = f"checkpoint-{week.get('week', 0)}-{uuid.uuid4().hex[:8]}"
            checkpoint["completed"] = False
    
    # Ensure milestones have IDs
    for milestone in program.get("milestones", []):
        if not milestone.get("id"):
            milestone["id"] = f"milestone-{uuid.uuid4().hex[:8]}"
        milestone["completed"] = False
    
    # Ensure capstone has ID
    capstone = program.get("capstone", {})
    if not capstone.get("id"):
        capstone["id"] = f"capstone-{uuid.uuid4().hex[:8]}"
    capstone["completed"] = False
    
    # Ensure deliverables have IDs
    for deliverable in capstone.get("deliverables", []):
        if not deliverable.get("id"):
            deliverable["id"] = f"deliverable-{uuid.uuid4().hex[:8]}"
        deliverable["completed"] = False
    
    return program


async def generate_cohort_program(
    team_name: str,
    outcome: str,
    duration_weeks: int = 6,
    sessions_per_week: int = 2,
    weekly_hours: int = 4,
    focus_areas: Optional[str] = None,
    skill_level: str = "intermediate",
    target_certification: Optional[str] = None,
    openai_api_key: Optional[str] = None,
    knowledge_context: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate a cohort learning program with platform-aware actions.
    
    Args:
        team_name: Name of the cohort/team
        outcome: What learners should achieve
        duration_weeks: Program length in weeks
        sessions_per_week: Live sessions per week
        weekly_hours: Expected study hours per week
        focus_areas: Optional comma-separated focus areas
        skill_level: beginner, intermediate, or advanced
        target_certification: Optional AWS certification code
        openai_api_key: Optional API key override
    
    Returns:
        Generated cohort program as dict with platform links and completion tracking
    """
    # Get cert info if specified
    cert_info = None
    if target_certification and target_certification in CERTIFICATION_PERSONAS:
        cert_info = CERTIFICATION_PERSONAS[target_certification]
    
    # Build the user prompt
    user_prompt = f"""Generate a {duration_weeks}-week AWS cohort program for "{team_name}" with these requirements:

**Outcome:** {outcome}
**Skill Level:** {skill_level}
**Sessions per Week:** {sessions_per_week}
**Expected Weekly Hours:** {weekly_hours}
"""
    
    if focus_areas:
        user_prompt += f"**Focus Areas:** {focus_areas}\n"
    
    if cert_info:
        user_prompt += f"""
**Target Certification:** {cert_info['cert']}
**Certification Level:** {cert_info['level']}
**Certification Focus:** {cert_info['focus']}
"""
    elif target_certification:
        user_prompt += f"**Target Certification:** {target_certification}\n"
    
    # Add knowledge context if available
    if knowledge_context:
        user_prompt += f"""

**Relevant AWS Knowledge (use this to inform specific topics and actions):**
{knowledge_context}
"""
    
    user_prompt += "\nCreate a complete week-by-week curriculum with platform actions, checkpoints, milestones, and a capstone project."
    
    # Get model
    model = get_request_model() or DEFAULT_MODEL
    
    # Create client
    import os
    api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OpenAI API key is required")
    
    client = AsyncOpenAI(api_key=api_key)
    
    try:
        completion = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": COHORT_PROGRAM_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
        )
        
        content = completion.choices[0].message.content
        if not content:
            raise ValueError("No response from AI")
        
        program = json.loads(content)
        
        # Validate required fields
        if not program.get("title") or not program.get("weeks") or not program.get("capstone"):
            raise ValueError("Invalid program structure - missing required fields")
        
        # Ensure level and cert are set
        program["level"] = skill_level
        if target_certification:
            program["targetCertification"] = target_certification
        
        # Enrich with platform links and ensure IDs
        program = enrich_program_with_links(program)
        
        logger.info(f"Generated {duration_weeks}-week cohort program for {team_name}")
        
        return program
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse cohort program JSON: {e}")
        raise ValueError(f"Failed to parse AI response: {e}")
    except Exception as e:
        logger.error(f"Cohort program generation failed: {e}")
        raise
