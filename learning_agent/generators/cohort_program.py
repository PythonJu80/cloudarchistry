"""
Cohort Program Generator
========================
Generates structured cohort TEACHING programs for tutors/instructors.
Creates week-by-week delivery plans with session outlines, teaching methods,
demonstrations, activities, and assessments.

This is a DELIVERY PLAN for the tutor - what to teach and how to teach it,
NOT a study guide for learners.
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


# Teaching methods available for cohort sessions
TEACHING_METHODS = {
    "lecture": "Direct instruction with slides or whiteboard",
    "demo": "Live demonstration (AWS Console, CLI, or platform features)",
    "guided_lab": "Walk learners through hands-on exercise step-by-step",
    "group_discussion": "Facilitate discussion on concepts or scenarios",
    "game": "Play a CloudArchistry game together as a group",
    "quiz_review": "Run quiz and review answers together",
    "pair_exercise": "Learners work in pairs on a problem",
    "whiteboard": "Collaborative diagramming and problem-solving",
}

# Platform features available for demonstrations and homework
PLATFORM_FEATURES = {
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


COHORT_PROGRAM_SYSTEM_PROMPT = """You are an expert AWS training curriculum designer creating a TEACHING DELIVERY PLAN for tutors/instructors using the CloudArchistry learning platform.

This is NOT a study guide for learners. This is a detailed plan for the TUTOR on:
- What to teach each session
- How to deliver it (teaching methods)
- Which CloudArchistry platform features to DEMO during sessions
- What activities to run together as a group
- What to assign as homework

## Teaching Methods Available
Use these method IDs in your session agenda:
- lecture: Direct instruction with slides/whiteboard
- demo: Live demonstration (AWS Console, CLI, or CloudArchistry platform features)
- guided_lab: Walk learners through hands-on exercise step-by-step
- group_discussion: Facilitate discussion on concepts or scenarios
- game: Play a CloudArchistry game together as a group
- quiz_review: Run quiz and review answers together
- pair_exercise: Learners work in pairs on a problem
- whiteboard: Collaborative diagramming and problem-solving

## CloudArchistry Platform Features
The tutor demos these features and assigns them as homework:

GAMES (in Game Zone - great for group demos):
- Service Slots: Match AWS services that work together
- Hot Streak: Build streaks with multipliers - good for warm-ups
- Ticking Bomb: Hot potato game - PERFECT for group sessions
- Quiz Battle: 1v1 competitive quiz
- Cloud Tycoon: Build infrastructure simulation

LEARNING TOOLS:
- Flashcards: Spaced repetition cards - great for warm-ups or review
- Topic Quizzes: Quick knowledge checks on specific topics
- Practice Exams: Full certification practice tests
- CLI Simulator: Safe sandbox to practice AWS CLI commands

CHALLENGES:
- World Map Challenge: Place services on world map - teaches global infrastructure
- Architecture Drawing: Draw AWS diagrams to solve scenarios

## Output Format
Return a JSON object with this exact structure:
{
  "title": "string - program title",
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
      "learningObjectives": ["string array of 2-4 specific objectives for this week"],
      "sessions": [
        {
          "sessionNumber": number,
          "title": "string - session title",
          "duration": "string - e.g., '120 minutes'",
          "overview": "string - brief description of what this session covers",
          "agenda": [
            {
              "time": "string - e.g., '0-15 min'",
              "activity": "string - what to do",
              "method": "lecture|demo|guided_lab|group_discussion|game|quiz_review|pair_exercise|whiteboard",
              "notes": "string - tutor notes/tips for this segment"
            }
          ],
          "keyPoints": ["string array of 3-5 key points to emphasize during this session"],
          "demonstrations": [
            {
              "title": "string - what to demo",
              "platformFeature": "string - which CloudArchistry feature to use (optional)",
              "steps": ["string array of demo steps"]
            }
          ],
          "discussionQuestions": ["string array of 2-3 questions to ask the group"],
          "commonMistakes": ["string array of 2-3 common learner mistakes to watch for"]
        }
      ],
      "homework": {
        "description": "string - what learners should do independently",
        "platformFeature": "string - which CloudArchistry feature to use",
        "estimatedMinutes": number
      },
      "assessmentCriteria": ["string array of 2-4 criteria to assess learner progress"]
    }
  ],
  "milestones": [
    {
      "label": "string - milestone name",
      "weekNumber": number,
      "successIndicators": ["string array of 1-3 success indicators"]
    }
  ],
  "capstone": {
    "title": "string - capstone project title",
    "description": "string - what learners will build/present",
    "presentationFormat": "string - how they'll present (e.g., 'Team presentation with Q&A')",
    "evaluationCriteria": ["string array of 3-5 evaluation criteria"]
  },
  "tutorResources": {
    "prerequisiteKnowledge": ["string array of what tutor should know"],
    "suggestedPrep": ["string array of prep tasks for tutor"],
    "commonChallenges": ["string array of common learner struggles and how to address them"]
  }
}

## Guidelines
1. Create the specified number of weeks with the specified sessions per week
2. Each session should have a detailed agenda with 4-6 timed segments
3. Include at least one platform demo per session
4. Assign homework using CloudArchistry platform features
5. Include discussion questions to engage the group
6. Add tutor notes with tips for delivery
7. Progress from fundamentals to advanced topics
8. Capstone should tie together all learned skills
9. Include tutor resources section with prep guidance

For skill levels:
- beginner: More lecture/demo, guided labs, lots of flashcards, slower pace
- intermediate: Mix of methods, architecture challenges, practice exams
- advanced: More discussion, complex scenarios, learner-led activities"""


def enrich_program_with_metadata(program: Dict[str, Any]) -> Dict[str, Any]:
    """
    Post-process the AI-generated program to add IDs and completion tracking.
    """
    # Process weeks
    for week_idx, week in enumerate(program.get("weeks", [])):
        # Ensure week has ID
        if not week.get("id"):
            week["id"] = f"week-{week_idx + 1}-{uuid.uuid4().hex[:8]}"
        week["completed"] = False
        
        # Process sessions
        for session_idx, session in enumerate(week.get("sessions", [])):
            if not session.get("id"):
                session["id"] = f"session-{week_idx + 1}-{session_idx + 1}-{uuid.uuid4().hex[:8]}"
            session["completed"] = False
            
            # Process agenda items
            for agenda_idx, agenda in enumerate(session.get("agenda", [])):
                if not agenda.get("id"):
                    agenda["id"] = f"agenda-{session['id']}-{agenda_idx}"
            
            # Process demonstrations
            for demo_idx, demo in enumerate(session.get("demonstrations", [])):
                if not demo.get("id"):
                    demo["id"] = f"demo-{session['id']}-{demo_idx}"
        
        # Ensure homework has ID
        homework = week.get("homework")
        if homework and not homework.get("id"):
            homework["id"] = f"homework-{week_idx + 1}-{uuid.uuid4().hex[:8]}"
            homework["completed"] = False
    
    # Ensure milestones have IDs
    for milestone_idx, milestone in enumerate(program.get("milestones", [])):
        if not milestone.get("id"):
            milestone["id"] = f"milestone-{milestone_idx + 1}-{uuid.uuid4().hex[:8]}"
        milestone["completed"] = False
    
    # Ensure capstone has ID
    capstone = program.get("capstone", {})
    if not capstone.get("id"):
        capstone["id"] = f"capstone-{uuid.uuid4().hex[:8]}"
    capstone["completed"] = False
    
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
    
    user_prompt += "\nCreate a complete week-by-week TEACHING DELIVERY PLAN with session agendas, demonstrations, discussion questions, homework assignments, milestones, and a capstone project. Remember: this is for the TUTOR, not the learner."
    
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
        
        # Strip markdown code fences if present
        content = content.strip()
        if content.startswith("```"):
            # Remove opening fence (```json or ```)
            first_newline = content.find("\n")
            if first_newline != -1:
                content = content[first_newline + 1:]
            # Remove closing fence
            if content.endswith("```"):
                content = content[:-3].strip()
        
        program = json.loads(content)
        
        # Validate required fields
        if not program.get("title") or not program.get("weeks") or not program.get("capstone"):
            raise ValueError("Invalid program structure - missing required fields")
        
        # Ensure level and cert are set
        program["level"] = skill_level
        if target_certification:
            program["targetCertification"] = target_certification
        
        # Enrich with metadata and ensure IDs
        program = enrich_program_with_metadata(program)
        
        logger.info(f"Generated {duration_weeks}-week cohort program for {team_name}")
        
        return program
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse cohort program JSON: {e}")
        raise ValueError(f"Failed to parse AI response: {e}")
    except Exception as e:
        logger.error(f"Cohort program generation failed: {e}")
        raise
