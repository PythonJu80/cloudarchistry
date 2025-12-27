"""
Learner Diagnostics Generator
==============================
Analyzes user's learning data to identify strengths, weaknesses, and provide
personalized recommendations based on their entire platform activity.
"""

from __future__ import annotations

import json
import os
from typing import List, Optional, Dict, Any

from openai import AsyncOpenAI
from pydantic import BaseModel

from config.settings import logger
from prompts import CERTIFICATION_PERSONAS
from utils import (
    ApiKeyRequiredError,
    get_request_model,
    DEFAULT_MODEL,
    fetch_knowledge_for_generation,
)


class StrengthWeakness(BaseModel):
    """A single strength or weakness identified"""
    area: str  # e.g., "S3 Security", "VPC Networking"
    confidence: str  # high, medium, low
    evidence: str  # What data supports this
    aws_services: List[str] = []


class Recommendation(BaseModel):
    """A personalized recommendation"""
    priority: int  # 1 = highest
    title: str
    description: str
    action_type: str  # practice_exam, world_challenge, flashcard, quiz, etc.
    action_link: str
    estimated_time: str
    rationale: str  # Why this is recommended


class LearningPattern(BaseModel):
    """Identified learning pattern"""
    pattern: str
    insight: str
    suggestion: str


class DiagnosticsResult(BaseModel):
    """Complete diagnostics analysis result"""
    summary: str  # 2-3 sentence executive summary
    overall_readiness: int  # 0-100 exam readiness score
    readiness_label: str  # "Not Ready", "Getting There", "Almost Ready", "Exam Ready"
    
    # Strengths and weaknesses
    strengths: List[StrengthWeakness]
    weaknesses: List[StrengthWeakness]
    
    # Skill gaps by exam domain
    domain_scores: Dict[str, int]  # e.g., {"Compute": 75, "Storage": 60, "Networking": 45}
    
    # Learning patterns
    patterns: List[LearningPattern]
    
    # Personalized recommendations
    recommendations: List[Recommendation]
    
    # Motivational message
    encouragement: str
    
    # Next milestone
    next_milestone: str
    days_to_milestone: Optional[int] = None


class DiagnosticsContext(BaseModel):
    """Input context for diagnostics generation"""
    # User profile
    profile_id: str
    display_name: Optional[str] = None
    skill_level: str = "intermediate"
    target_certification: Optional[str] = None
    subscription_tier: str = "free"
    
    # Gamification stats
    total_points: int = 0
    level: int = 1
    xp: int = 0
    current_streak: int = 0
    longest_streak: int = 0
    achievements_count: int = 0
    
    # Challenge analytics
    challenges_total: int = 0
    challenges_completed: int = 0
    challenges_completion_rate: int = 0
    challenges_avg_score: int = 0
    challenges_hints_used: int = 0
    challenges_avg_hints: float = 0.0
    difficulty_breakdown: Dict[str, Dict[str, Any]] = {}
    
    # Scenario analytics
    scenarios_total: int = 0
    scenarios_completed: int = 0
    scenarios_completion_rate: int = 0
    
    # Skills
    top_services: List[Dict[str, Any]] = []
    industry_breakdown: List[Dict[str, Any]] = []
    
    # Learning insights
    chat_sessions: int = 0
    questions_asked: int = 0
    top_keywords: List[Dict[str, Any]] = []
    
    # Time analytics
    total_time_minutes: int = 0
    avg_time_per_scenario: int = 0
    
    # Activity timeline
    activity_timeline: List[Dict[str, Any]] = []
    
    # Recent activities
    recent_scenarios: List[Dict[str, Any]] = []
    
    # Previous diagnostics for progress tracking
    previous_diagnostics: List[Dict[str, Any]] = []
    
    # Flashcard stats
    flashcards_studied: int = 0
    flashcards_mastered: int = 0
    flashcard_reviews: int = 0
    flashcard_time_minutes: int = 0
    flashcard_mastery_rate: int = 0
    
    # Quiz stats
    quizzes_attempted: int = 0
    quizzes_completed: int = 0
    quizzes_passed: int = 0
    quiz_pass_rate: int = 0
    quiz_avg_score: int = 0
    quiz_accuracy: int = 0


DIAGNOSTICS_PROMPT = """You are an expert AWS certification coach performing a comprehensive diagnostic analysis of a learner's progress.

## Learner Profile
- Name: {display_name}
- Target Certification: {target_certification}
- Current Skill Level: {skill_level}
- Subscription: {subscription_tier}
- Member Level: {level} ({xp} XP)
- Total Points: {total_points}

## Activity Summary
- Current Streak: {current_streak} days (Best: {longest_streak} days)
- Achievements Earned: {achievements_count}
- Total Study Time: {total_time_minutes} minutes

## Challenge Performance
- Challenges Attempted: {challenges_total}
- Challenges Completed: {challenges_completed} ({challenges_completion_rate}% completion rate)
- Average Score: {challenges_avg_score}%
- Hints Used: {challenges_hints_used} total ({challenges_avg_hints} per challenge)
- Difficulty Breakdown: {difficulty_breakdown}

## Scenario Performance
- Scenarios Attempted: {scenarios_total}
- Scenarios Completed: {scenarios_completed} ({scenarios_completion_rate}% completion rate)

## AWS Services Practiced
{top_services}

## Industry Exposure
{industry_breakdown}

## Learning Behavior
- AI Chat Sessions: {chat_sessions}
- Questions Asked: {questions_asked}
- Topics Explored: {top_keywords}

## Flashcard Performance
- Cards Studied: {flashcards_studied}
- Cards Mastered: {flashcards_mastered}
- Total Reviews: {flashcard_reviews}
- Time Spent: {flashcard_time_minutes} minutes
- Mastery Rate: {flashcard_mastery_rate}%

## Quiz Performance
- Quizzes Attempted: {quizzes_attempted}
- Quizzes Completed: {quizzes_completed}
- Quizzes Passed: {quizzes_passed}
- Pass Rate: {quiz_pass_rate}%
- Average Score: {quiz_avg_score}%
- Question Accuracy: {quiz_accuracy}%

## Recent Activity
{recent_scenarios}

## Activity Timeline (Last 30 Days)
{activity_timeline}

## Previous Diagnostics (Progress History)
{previous_diagnostics}

## Your Task
Analyze this learner's data comprehensively and provide:

1. **Overall Readiness Score (0-100)**: Based on their progress toward {target_certification}
2. **Strengths**: 3-5 areas where they're performing well (with evidence)
3. **Weaknesses**: 3-5 areas needing improvement (with evidence)
4. **Domain Scores**: Estimate their readiness in each exam domain based on services practiced
5. **Learning Patterns**: 2-3 patterns you notice in their behavior
6. **Recommendations**: 5-7 specific, actionable recommendations prioritized by impact

## Exam Domains for {target_certification}
{exam_domains}

## Platform Actions Available for Recommendations
- practice_exam: Full practice exams (/learn/exams)
- world_challenge: Real-world scenario challenges (/world)
- drawing_challenge: Architecture drawing (/challenges)
- cli_practice: CLI simulator (/learn/cli)
- flashcard: Flashcard review (/learn/flashcards)
- quiz: Topic quizzes (/learn/quiz)
- notes: Study notes (/learn/notes)
- ai_chat: AI tutor chat (/learn/chat)
- resources: External resources (/learn/sources)
- game: Game modes for reinforcement (/game)

## Output Format
Return a JSON object with this exact structure:
{{
  "summary": "2-3 sentence executive summary of their current state and most important next step",
  "overall_readiness": 0-100,
  "readiness_label": "Not Ready|Getting There|Almost Ready|Exam Ready",
  "strengths": [
    {{
      "area": "Area name",
      "confidence": "high|medium|low",
      "evidence": "What data supports this",
      "aws_services": ["S3", "IAM"]
    }}
  ],
  "weaknesses": [
    {{
      "area": "Area name",
      "confidence": "high|medium|low", 
      "evidence": "What data supports this",
      "aws_services": ["VPC", "CloudWatch"]
    }}
  ],
  "domain_scores": {{
    "Domain 1: Name": 75,
    "Domain 2: Name": 60
  }},
  "patterns": [
    {{
      "pattern": "Pattern name",
      "insight": "What this tells us",
      "suggestion": "How to leverage or address this"
    }}
  ],
  "recommendations": [
    {{
      "priority": 1,
      "title": "Action title",
      "description": "What to do",
      "action_type": "practice_exam|world_challenge|flashcard|quiz|etc",
      "action_link": "/learn/exams",
      "estimated_time": "30 min",
      "rationale": "Why this will help"
    }}
  ],
  "encouragement": "Personalized motivational message acknowledging their progress",
  "next_milestone": "Their next achievable milestone",
  "days_to_milestone": 7
}}

Be specific, data-driven, and actionable. Reference actual numbers from their data.
Output ONLY valid JSON."""


# Exam domains by certification
EXAM_DOMAINS = {
    "SAA": [
        "Domain 1: Design Secure Architectures (30%)",
        "Domain 2: Design Resilient Architectures (26%)",
        "Domain 3: Design High-Performing Architectures (24%)",
        "Domain 4: Design Cost-Optimized Architectures (20%)",
    ],
    "DVA": [
        "Domain 1: Development with AWS Services (32%)",
        "Domain 2: Security (26%)",
        "Domain 3: Deployment (24%)",
        "Domain 4: Troubleshooting and Optimization (18%)",
    ],
    "SOA": [
        "Domain 1: Monitoring, Logging, and Remediation (20%)",
        "Domain 2: Reliability and Business Continuity (16%)",
        "Domain 3: Deployment, Provisioning, and Automation (18%)",
        "Domain 4: Security and Compliance (16%)",
        "Domain 5: Networking and Content Delivery (18%)",
        "Domain 6: Cost and Performance Optimization (12%)",
    ],
    "CLF": [
        "Domain 1: Cloud Concepts (24%)",
        "Domain 2: Security and Compliance (30%)",
        "Domain 3: Cloud Technology and Services (34%)",
        "Domain 4: Billing, Pricing, and Support (12%)",
    ],
    "SAP": [
        "Domain 1: Design Solutions for Organizational Complexity (26%)",
        "Domain 2: Design for New Solutions (29%)",
        "Domain 3: Continuous Improvement for Existing Solutions (25%)",
        "Domain 4: Accelerate Workload Migration and Modernization (20%)",
    ],
    "DOP": [
        "Domain 1: SDLC Automation (22%)",
        "Domain 2: Configuration Management and IaC (17%)",
        "Domain 3: Resilient Cloud Solutions (15%)",
        "Domain 4: Monitoring and Logging (15%)",
        "Domain 5: Incident and Event Response (14%)",
        "Domain 6: Security and Compliance (17%)",
    ],
    "ANS": [
        "Domain 1: Network Design (30%)",
        "Domain 2: Network Implementation (26%)",
        "Domain 3: Network Management and Operation (20%)",
        "Domain 4: Network Security, Compliance, and Governance (24%)",
    ],
    "SCS": [
        "Domain 1: Threat Detection and Incident Response (14%)",
        "Domain 2: Security Logging and Monitoring (18%)",
        "Domain 3: Infrastructure Security (20%)",
        "Domain 4: Identity and Access Management (16%)",
        "Domain 5: Data Protection (18%)",
        "Domain 6: Management and Security Governance (14%)",
    ],
    "MLS": [
        "Domain 1: Data Engineering (20%)",
        "Domain 2: Exploratory Data Analysis (24%)",
        "Domain 3: Modeling (36%)",
        "Domain 4: Machine Learning Implementation and Operations (20%)",
    ],
    "DBS": [
        "Domain 1: Workload-Specific Database Design (26%)",
        "Domain 2: Deployment and Migration (20%)",
        "Domain 3: Management and Operations (18%)",
        "Domain 4: Monitoring and Troubleshooting (18%)",
        "Domain 5: Database Security (18%)",
    ],
}


async def generate_diagnostics(
    context: DiagnosticsContext,
    *,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> DiagnosticsResult:
    """
    Generate comprehensive learner diagnostics based on their platform activity.
    
    Args:
        context: DiagnosticsContext with all learner data
        model: Optional model override
        api_key: Optional OpenAI API key
    
    Returns:
        DiagnosticsResult with analysis, strengths, weaknesses, and recommendations
    """
    key = api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required for diagnostics generation")
    
    model_name = model or get_request_model() or DEFAULT_MODEL
    
    # Get certification info
    cert_code = context.target_certification or "SAA"
    if cert_code in CERTIFICATION_PERSONAS:
        cert_name = CERTIFICATION_PERSONAS[cert_code]["cert"]
    else:
        cert_name = "AWS Solutions Architect Associate"
        cert_code = "SAA"
    
    # Get exam domains
    exam_domains = EXAM_DOMAINS.get(cert_code, EXAM_DOMAINS["SAA"])
    
    # Format data for prompt
    top_services_str = "\n".join([
        f"- {s['service']}: practiced {s['count']} times"
        for s in context.top_services[:10]
    ]) if context.top_services else "No services practiced yet"
    
    industry_str = "\n".join([
        f"- {i['industry']}: {i['count']} scenarios"
        for i in context.industry_breakdown[:5]
    ]) if context.industry_breakdown else "No industry exposure yet"
    
    keywords_str = ", ".join([
        k['keyword'] for k in context.top_keywords[:10]
    ]) if context.top_keywords else "None"
    
    recent_str = "\n".join([
        f"- {s['title']} ({s['status']}): {s['pointsEarned']}/{s['maxPoints']} points"
        for s in context.recent_scenarios[:5]
    ]) if context.recent_scenarios else "No recent scenarios"
    
    timeline_str = f"{len(context.activity_timeline)} active days in last 30 days" if context.activity_timeline else "No recent activity"
    
    # Format previous diagnostics for progress tracking
    if context.previous_diagnostics:
        prev_diag_str = "\n".join([
            f"- {d.get('date', 'Unknown date')}: Readiness {d.get('readiness', 0)}% ({d.get('label', 'Unknown')})"
            for d in context.previous_diagnostics
        ])
        prev_diag_str += "\n\nIMPORTANT: Compare current performance to previous diagnostics. Note improvements or regressions. Acknowledge their progress in your encouragement."
    else:
        prev_diag_str = "No previous diagnostics - this is their first assessment."
    
    # Build the prompt
    prompt = DIAGNOSTICS_PROMPT.format(
        display_name=context.display_name or "Learner",
        target_certification=cert_name,
        skill_level=context.skill_level,
        subscription_tier=context.subscription_tier,
        level=context.level,
        xp=context.xp,
        total_points=context.total_points,
        current_streak=context.current_streak,
        longest_streak=context.longest_streak,
        achievements_count=context.achievements_count,
        total_time_minutes=context.total_time_minutes,
        challenges_total=context.challenges_total,
        challenges_completed=context.challenges_completed,
        challenges_completion_rate=context.challenges_completion_rate,
        challenges_avg_score=context.challenges_avg_score,
        challenges_hints_used=context.challenges_hints_used,
        challenges_avg_hints=context.challenges_avg_hints,
        difficulty_breakdown=json.dumps(context.difficulty_breakdown),
        scenarios_total=context.scenarios_total,
        scenarios_completed=context.scenarios_completed,
        scenarios_completion_rate=context.scenarios_completion_rate,
        top_services=top_services_str,
        industry_breakdown=industry_str,
        chat_sessions=context.chat_sessions,
        questions_asked=context.questions_asked,
        top_keywords=keywords_str,
        flashcards_studied=context.flashcards_studied,
        flashcards_mastered=context.flashcards_mastered,
        flashcard_reviews=context.flashcard_reviews,
        flashcard_time_minutes=context.flashcard_time_minutes,
        flashcard_mastery_rate=context.flashcard_mastery_rate,
        quizzes_attempted=context.quizzes_attempted,
        quizzes_completed=context.quizzes_completed,
        quizzes_passed=context.quizzes_passed,
        quiz_pass_rate=context.quiz_pass_rate,
        quiz_avg_score=context.quiz_avg_score,
        quiz_accuracy=context.quiz_accuracy,
        recent_scenarios=recent_str,
        activity_timeline=timeline_str,
        previous_diagnostics=prev_diag_str,
        exam_domains="\n".join(exam_domains),
    )
    
    # Fetch relevant AWS knowledge for context
    try:
        knowledge_context = await fetch_knowledge_for_generation(
            cert_code=cert_code,
            topic=f"{cert_name} exam preparation diagnostics",
            limit=3,
            api_key=key,
        )
        if knowledge_context:
            prompt += f"\n\n## Additional AWS Context\n{knowledge_context}"
    except Exception as e:
        logger.warning(f"Failed to fetch knowledge context: {e}")
    
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Generate my comprehensive learning diagnostics now. Be specific and reference my actual data."},
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
        result_data = json.loads(content)
    except json.JSONDecodeError as err:
        logger.error("Diagnostics JSON parse failure: %s", err)
        raise ValueError("Agent returned invalid diagnostics JSON") from err
    
    # Validate and construct result
    return DiagnosticsResult(
        summary=result_data.get("summary", "Unable to generate summary"),
        overall_readiness=result_data.get("overall_readiness", 0),
        readiness_label=result_data.get("readiness_label", "Not Ready"),
        strengths=[
            StrengthWeakness(**s) for s in result_data.get("strengths", [])
        ],
        weaknesses=[
            StrengthWeakness(**w) for w in result_data.get("weaknesses", [])
        ],
        domain_scores=result_data.get("domain_scores", {}),
        patterns=[
            LearningPattern(**p) for p in result_data.get("patterns", [])
        ],
        recommendations=[
            Recommendation(**r) for r in result_data.get("recommendations", [])
        ],
        encouragement=result_data.get("encouragement", "Keep learning!"),
        next_milestone=result_data.get("next_milestone", "Complete your first challenge"),
        days_to_milestone=result_data.get("days_to_milestone"),
    )
