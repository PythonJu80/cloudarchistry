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
    DEFAULT_MODEL,
)


# Valid user levels
VALID_USER_LEVELS = ["beginner", "intermediate", "advanced", "expert"]

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

VALID_CERT_CODES = list(CERTIFICATION_PERSONAS.keys()) + list(CERT_CODE_TO_PERSONA.keys())

# Certification exam domains - used to create domain-specific weekly themes
CERTIFICATION_EXAM_DOMAINS = {
    "cloud-practitioner": [
        {"name": "Cloud Concepts", "weight": 24, "topics": ["Cloud value proposition", "AWS Cloud economics", "Cloud architecture design principles"]},
        {"name": "Security and Compliance", "weight": 30, "topics": ["Shared responsibility model", "IAM", "Security services", "Compliance resources"]},
        {"name": "Cloud Technology and Services", "weight": 34, "topics": ["Compute", "Storage", "Networking", "Database", "AI/ML services"]},
        {"name": "Billing, Pricing, and Support", "weight": 12, "topics": ["Pricing models", "Account structures", "Support plans", "Cost management"]},
    ],
    "solutions-architect-associate": [
        {"name": "Design Secure Architectures", "weight": 30, "topics": ["IAM", "VPC security", "Encryption", "Security services"]},
        {"name": "Design Resilient Architectures", "weight": 26, "topics": ["Multi-AZ", "Auto Scaling", "Disaster recovery", "Decoupling"]},
        {"name": "Design High-Performing Architectures", "weight": 24, "topics": ["Compute optimization", "Storage performance", "Database scaling", "Caching"]},
        {"name": "Design Cost-Optimized Architectures", "weight": 20, "topics": ["Cost-effective compute", "Storage tiers", "Data transfer costs", "Right-sizing"]},
    ],
    "developer-associate": [
        {"name": "Development with AWS Services", "weight": 32, "topics": ["Lambda", "API Gateway", "DynamoDB", "S3", "SQS/SNS"]},
        {"name": "Security", "weight": 26, "topics": ["IAM for developers", "Cognito", "Secrets Manager", "KMS encryption"]},
        {"name": "Deployment", "weight": 24, "topics": ["CI/CD", "CodePipeline", "CodeBuild", "CodeDeploy", "SAM/CloudFormation"]},
        {"name": "Troubleshooting and Optimization", "weight": 18, "topics": ["X-Ray", "CloudWatch Logs", "Performance tuning", "Error handling"]},
    ],
    "sysops-associate": [
        {"name": "Monitoring, Logging, and Remediation", "weight": 20, "topics": ["CloudWatch", "EventBridge", "Automated remediation", "Alerting"]},
        {"name": "Reliability and Business Continuity", "weight": 16, "topics": ["Backup strategies", "Disaster recovery", "High availability"]},
        {"name": "Deployment, Provisioning, and Automation", "weight": 18, "topics": ["CloudFormation", "Systems Manager", "AMI management"]},
        {"name": "Security and Compliance", "weight": 16, "topics": ["IAM", "Config", "Inspector", "GuardDuty", "Compliance"]},
        {"name": "Networking and Content Delivery", "weight": 18, "topics": ["VPC", "Route 53", "CloudFront", "Connectivity options"]},
        {"name": "Cost and Performance Optimization", "weight": 12, "topics": ["Cost Explorer", "Trusted Advisor", "Performance monitoring"]},
    ],
    "data-engineer-associate": [
        {"name": "Data Ingestion and Transformation", "weight": 34, "topics": ["Kinesis", "Glue ETL", "Data pipelines", "Batch vs streaming"]},
        {"name": "Data Store Management", "weight": 26, "topics": ["S3 data lakes", "Redshift", "DynamoDB", "Data catalog"]},
        {"name": "Data Operations and Support", "weight": 22, "topics": ["Data quality", "Monitoring", "Troubleshooting", "Optimization"]},
        {"name": "Data Security and Governance", "weight": 18, "topics": ["Lake Formation", "Encryption", "Access control", "Compliance"]},
    ],
    "machine-learning-engineer-associate": [
        {"name": "Data Preparation", "weight": 28, "topics": ["Data collection", "Feature engineering", "Data validation", "Preprocessing"]},
        {"name": "Model Development", "weight": 26, "topics": ["SageMaker", "Algorithm selection", "Training", "Hyperparameter tuning"]},
        {"name": "Deployment and Orchestration", "weight": 22, "topics": ["Model deployment", "Inference optimization", "MLOps", "Pipelines"]},
        {"name": "Monitoring and Maintenance", "weight": 24, "topics": ["Model monitoring", "Drift detection", "Retraining", "A/B testing"]},
    ],
    "ai-practitioner": [
        {"name": "Fundamentals of AI and ML", "weight": 20, "topics": ["AI/ML concepts", "Types of ML", "Model lifecycle"]},
        {"name": "Fundamentals of Generative AI", "weight": 24, "topics": ["Foundation models", "Prompt engineering", "Use cases"]},
        {"name": "Applications of Foundation Models", "weight": 28, "topics": ["Amazon Bedrock", "Model selection", "RAG", "Fine-tuning"]},
        {"name": "Responsible AI", "weight": 14, "topics": ["Bias detection", "Fairness", "Transparency", "Governance"]},
        {"name": "Security and Compliance for AI", "weight": 14, "topics": ["Data privacy", "Model security", "Compliance"]},
    ],
    "solutions-architect-professional": [
        {"name": "Design for Organizational Complexity", "weight": 26, "topics": ["Multi-account", "Cross-region", "Hybrid architectures"]},
        {"name": "Design for New Solutions", "weight": 29, "topics": ["Business requirements", "Architecture patterns", "Migration strategies"]},
        {"name": "Continuous Improvement", "weight": 25, "topics": ["Cost optimization", "Performance tuning", "Operational excellence"]},
        {"name": "Accelerate Workload Migration", "weight": 20, "topics": ["Migration strategies", "Data migration", "Application modernization"]},
    ],
    "devops-professional": [
        {"name": "SDLC Automation", "weight": 22, "topics": ["CI/CD pipelines", "Testing automation", "Artifact management"]},
        {"name": "Configuration Management and IaC", "weight": 17, "topics": ["CloudFormation", "CDK", "Systems Manager", "Config"]},
        {"name": "Resilient Cloud Solutions", "weight": 15, "topics": ["High availability", "Fault tolerance", "Disaster recovery"]},
        {"name": "Monitoring and Logging", "weight": 15, "topics": ["CloudWatch", "X-Ray", "Centralized logging", "Alerting"]},
        {"name": "Incident and Event Response", "weight": 14, "topics": ["Automated remediation", "Runbooks", "Incident management"]},
        {"name": "Security and Compliance", "weight": 17, "topics": ["Security automation", "Compliance as code", "Secrets management"]},
    ],
    "security-specialty": [
        {"name": "Threat Detection and Incident Response", "weight": 14, "topics": ["GuardDuty", "Security Hub", "Incident response"]},
        {"name": "Security Logging and Monitoring", "weight": 18, "topics": ["CloudTrail", "CloudWatch", "VPC Flow Logs", "SIEM"]},
        {"name": "Infrastructure Security", "weight": 20, "topics": ["VPC security", "Network ACLs", "WAF", "Shield"]},
        {"name": "Identity and Access Management", "weight": 16, "topics": ["IAM policies", "Organizations", "SSO", "Federation"]},
        {"name": "Data Protection", "weight": 18, "topics": ["KMS", "Encryption", "Secrets Manager", "Certificate Manager"]},
        {"name": "Management and Security Governance", "weight": 14, "topics": ["Config", "Control Tower", "Compliance frameworks"]},
    ],
    "networking-specialty": [
        {"name": "Network Design", "weight": 30, "topics": ["VPC design", "Hybrid connectivity", "Multi-region", "IP addressing"]},
        {"name": "Network Implementation", "weight": 26, "topics": ["VPC peering", "Transit Gateway", "Direct Connect", "VPN"]},
        {"name": "Network Management and Operations", "weight": 20, "topics": ["Monitoring", "Troubleshooting", "Automation"]},
        {"name": "Network Security", "weight": 24, "topics": ["Security groups", "NACLs", "WAF", "Firewall Manager"]},
    ],
    "machine-learning-specialty": [
        {"name": "Data Engineering", "weight": 20, "topics": ["Data collection", "Feature engineering", "Data transformation"]},
        {"name": "Exploratory Data Analysis", "weight": 24, "topics": ["Data visualization", "Statistics", "Data quality"]},
        {"name": "Modeling", "weight": 36, "topics": ["Algorithm selection", "Training", "Hyperparameter tuning", "Evaluation"]},
        {"name": "ML Implementation and Operations", "weight": 20, "topics": ["Deployment", "A/B testing", "Monitoring", "MLOps"]},
    ],
}

# Default domains for certifications not explicitly mapped
DEFAULT_EXAM_DOMAINS = [
    {"name": "Core Services", "weight": 30, "topics": ["Compute", "Storage", "Networking", "Database"]},
    {"name": "Security", "weight": 25, "topics": ["IAM", "Encryption", "Compliance", "Access control"]},
    {"name": "Architecture", "weight": 25, "topics": ["High availability", "Scalability", "Cost optimization"]},
    {"name": "Operations", "weight": 20, "topics": ["Monitoring", "Automation", "Troubleshooting"]},
]


class StudyPlanValidationError(Exception):
    """Raised when study plan generation parameters are invalid"""
    pass


def validate_study_plan_params(user_level: str, cert_code: str) -> str:
    """
    Validate that user_level and cert_code are provided and valid.
    Converts exam codes (e.g., 'CLF', 'SAA') to persona IDs.
    
    Args:
        user_level: User skill level ('beginner', 'intermediate', 'advanced', 'expert')
        cert_code: AWS certification code or persona ID (e.g., 'CLF', 'SAA-C03', 'solutions-architect-associate')
    
    Returns:
        Normalized persona ID (e.g., 'cloud-practitioner')
    
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
    
    # Convert exam code to persona ID if needed
    if cert_code.upper() in CERT_CODE_TO_PERSONA:
        cert_code = CERT_CODE_TO_PERSONA[cert_code.upper()]
    
    if cert_code not in CERTIFICATION_PERSONAS:
        raise StudyPlanValidationError(
            f"Invalid cert_code '{cert_code}'. "
            f"Valid cert codes: {', '.join(list(CERTIFICATION_PERSONAS.keys()))}"
        )
    
    return cert_code

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
            "link": "/challenges",
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


def build_platform_features_text(platform_content: Dict[str, Any]) -> str:
    """Build dynamic platform features text from database content."""
    lines = []
    
    lines.append("\n**CONTENT THAT WILL BE AUTO-GENERATED FOR THIS STUDY PLAN:**")
    lines.append("When you include these action types, the system will automatically generate the content:")
    
    lines.append("\n**Flashcards (type: \"flashcard\")**")
    lines.append("- System will AUTO-GENERATE a custom flashcard deck (30 cards)")
    lines.append("- Tailored to certification and skill level")
    lines.append("- Spaced repetition review")
    lines.append("- **INCLUDE 1-2 flashcard actions per week**")
    
    lines.append("\n**Study Notes (type: \"notes\")**")
    lines.append("- System will AUTO-GENERATE comprehensive study notes")
    lines.append("- Covers key exam topics and AWS services")
    lines.append("- Markdown formatted with examples")
    lines.append("- **INCLUDE 1 notes action in the plan**")
    
    lines.append("\n**Quizzes (type: \"quiz\")**")
    lines.append("- System will AUTO-GENERATE a practice quiz (10-15 questions)")
    lines.append("- Multiple choice questions with explanations")
    lines.append("- Certification-specific content")
    lines.append("- **INCLUDE 1-2 quiz actions in the plan**")
    
    lines.append("\n**EXISTING PLATFORM FEATURES:**")
    
    # Practice Exams
    exams = platform_content.get("exams", [])
    if exams:
        lines.append("\n**Practice Exams (type: \"practice_exam\")**")
        lines.append(f"- {len(exams)} full-length certification practice exams available")
        lines.append("- Real exam conditions and scoring")
        lines.append("- **CRITICAL: Include at least 1 practice exam in final weeks**")
    
    # World Map Challenges (Scenarios)
    scenarios = platform_content.get("scenarios", [])
    if scenarios:
        lines.append("\n**World Map Challenges (type: \"world_challenge\")**")
        lines.append(f"- Unlimited scenario generation capability")
        lines.append("- Real-world architecture challenges")
        lines.append("- Hands-on problem-solving")
        lines.append("- **INCLUDE 2-3 world challenges throughout the plan**")
    
    lines.append("\n**Architecture Drawing (type: \"drawing_challenge\")**")
    lines.append("- Design and draw AWS architectures")
    lines.append("- Visual learning and hands-on practice")
    
    lines.append("\n**CLI Practice (type: \"cli_practice\")**")
    lines.append("- Practice AWS CLI commands in sandbox")
    lines.append("- Safe environment for experimentation")
    
    lines.append("\n**Learning Center (type: \"learning_center\")**")
    lines.append("- Comprehensive learning resources and guided paths")
    
    lines.append("\n**AI Chat (type: \"ai_chat\")**")
    lines.append("- Ask questions and get personalized explanations")
    
    lines.append("\n**Resources (type: \"resources\")**")
    lines.append("- Curated AWS docs, videos, materials")
    
    # Games (dynamic from DB)
    games = platform_content.get("games", [])
    if games:
        lines.append("\n**GAMES (type: \"game\")** - Use ONLY in final week as stress relief before exam")
        lines.append("- **LIMIT: Only 1 game in the FINAL week of the plan**")
        lines.append("- **ROTATE**: Pick different games each time - do NOT always use cloud_tycoon")
        for game in games[:5]:  # Show top 5 games
            icon = game.get("icon", "🎮")
            name = game.get("name", "")
            lines.append(f"- {icon} {name}")
    
    return "\n".join(lines)


STUDY_GUIDE_PROMPT_DYNAMIC = """You are an expert AWS certification coach creating a personalized study plan.

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
{platform_features}

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


# Legacy prompt kept for backward compatibility
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

**SECONDARY: GAMES (Use ONLY in final week as stress relief before exam)**

**Game Zone (type: "game")** - ONLY include in final week, rotate through different games
- sniper_quiz: High-stakes single-shot questions
- lightning_round: 60-second speed challenges
- hot_streak: Build multiplier streaks
- cloud_tycoon: Build infrastructure simulation
- IMPORTANT: Rotate through different games - do NOT always pick cloud_tycoon

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
        temperature=0.5,  # Study plans should be consistent, not creative
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
    
    # CRITICAL: Validate required parameters and normalize cert_code
    cert_code = validate_study_plan_params(context.skill_level, context.cert_code)
    
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required. Set OPENAI_API_KEY in .env file.")
    
    # Fetch active platform content from database
    from db import get_active_platform_content
    platform_content = await get_active_platform_content()
    
    # Fetch current AWS knowledge from database
    from utils import fetch_knowledge_for_generation
    knowledge_context = await fetch_knowledge_for_generation(
        cert_code=cert_code,
        topic=f"{cert_code} study guide",
        limit=5,
        api_key=api_key
    )
    
    model_name = model or get_request_model() or DEFAULT_MODEL
    
    # Get certification context (cert_code is now validated and normalized)
    persona = CERTIFICATION_PERSONAS[cert_code]
    target_certification = persona["cert"]

    # Build dynamic platform features list from DB
    platform_features_text = build_platform_features_text(platform_content)
    
    # Build the prompt with dynamic content
    prompt = STUDY_GUIDE_PROMPT_DYNAMIC.format(
        target_certification=target_certification,
        skill_level=context.skill_level,
        time_horizon_weeks=context.time_horizon_weeks,
        hours_per_week=context.hours_per_week,
        learning_style=context.learning_style,
        coach_notes=context.coach_notes or "None provided",
        telemetry_summary=context.telemetry_summary or "New learner, no activity yet",
        platform_features=platform_features_text,
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
    plan = enrich_plan_with_platform_data(plan, platform_content)

    return plan


def enrich_plan_with_platform_data(plan: Dict[str, Any], platform_content: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure all actions have proper IDs and links from dynamic platform data."""
    
    # Build link mapping from platform content
    link_map = {
        "practice_exam": "/learn/exams",
        "exam": "/learn/exams",
        "world_challenge": "/world",
        "scenario": "/world",
        "drawing_challenge": "/challenges",
        "architecture": "/challenges",
        "cli_practice": "/challenges",
        "cli": "/challenges",
        "flashcard": "/learn/flashcards",
        "flashcards": "/learn/flashcards",
        "quiz": "/learn/quiz",
        "notes": "/learn/notes",
        "study_notes": "/learn/notes",
        "learning_center": "/learn",
        "ai_chat": "/learn/chat",
        "chat": "/learn/chat",
        "resources": "/learn/resources",
    }
    
    # Add game links dynamically from DB
    for game in platform_content.get("games", []):
        slug = game.get("slug")
        if slug:
            link_map[slug] = f"/game/modes/{slug.replace('_', '-')}"
            link_map["game"] = "/game"  # Generic game link
    
    for week in plan.get("weeks", []):
        for action in week.get("actions", []):
            # Ensure unique ID
            if not action.get("id"):
                action["id"] = str(uuid.uuid4())[:8]
            
            # Ensure completed is boolean
            action["completed"] = bool(action.get("completed", False))
            
            # Get correct link from dynamic platform data
            action_type = action.get("type", "")
            if action_type in link_map and not action.get("link"):
                action["link"] = link_map[action_type]
    
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

## CERTIFICATION EXAM DOMAINS (use these for weekly themes!)
{exam_domains_text}

## IMPORTANT: Your Role
You are a FORMATTER, not a decision maker. The content below has already been selected from the database.
Your job is to:
1. Add a motivating, personalized summary that acknowledges their exam timeline and learning preferences
2. **Add weekly themes BASED ON THE EXAM DOMAINS above** - distribute domains across weeks proportionally to their weight
3. Add focus descriptions for each week that mention specific topics from the domain
4. Add specific, measurable targets for each action (progressive difficulty across weeks)
5. Add 6-8 deeply personalized accountability reminders with encouragement

**CRITICAL FOR WEEKLY THEMES:**
- Use the actual exam domain names (e.g., "Security and Compliance", "Design Resilient Architectures")
- Higher-weight domains should span more weeks
- For longer plans, revisit important domains with deeper focus
- Make themes specific to the certification, not generic

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

**GAMES (type: "game")** - Use ONLY in final week as stress relief:
- game: Game zone → Target: "10-minute break" or "Quick reinforcement"
- IMPORTANT: Games should rotate (sniper-quiz, lightning-round, hot-streak, cloud-tycoon) - do NOT always pick the same game

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
    exam_date: Optional[str],
    progress_summary: str,
    structured_content: Dict[str, Any],
    previous_plan_context: Optional[str] = None,
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
        exam_date: Optional exam date for countdown awareness
        progress_summary: Optional user progress summary
        structured_content: Pre-selected content to format
        previous_plan_context: Optional previous plan context for variation
        model: Optional model override
        api_key: Optional OpenAI API key
    
    Returns:
        Formatted study guide JSON
    
    Raises:
        StudyPlanValidationError: If cert_code or skill_level are missing/invalid
    """
    
    # CRITICAL: Validate required parameters and normalize cert_code
    cert_code = validate_study_plan_params(skill_level, cert_code)
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required. Set OPENAI_API_KEY in .env file.")

    model_name = model or get_request_model() or DEFAULT_MODEL
    
    # Get certification context (cert_code is now validated and normalized)
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

    # Get exam domains for this certification
    exam_domains = CERTIFICATION_EXAM_DOMAINS.get(cert_code, DEFAULT_EXAM_DOMAINS)
    
    # Build exam domains text for the prompt
    exam_domains_lines = []
    for domain in exam_domains:
        topics_str = ", ".join(domain["topics"][:4])  # Limit to 4 topics for brevity
        exam_domains_lines.append(f"- **{domain['name']}** ({domain['weight']}% of exam): {topics_str}")
    exam_domains_text = "\n".join(exam_domains_lines)
    
    # Build the prompt with the pre-selected content
    prompt = FORMAT_STUDY_GUIDE_PROMPT.format(
        target_certification=target_certification,
        skill_level=skill_level,
        time_horizon_weeks=time_horizon_weeks,
        hours_per_week=hours_per_week,
        learning_styles=", ".join(learning_styles),
        exam_date_info=exam_date_info,
        coach_notes=coach_notes or "None provided",
        progress_summary=progress_summary,
        exam_domains_text=exam_domains_text,
        structured_content_json=json.dumps(structured_content, indent=2),
    )

    # Add previous plan context if available for variation
    user_message = "Format my study guide now. Remember: DO NOT change the actions, just add themes, targets, and formatting."
    if previous_plan_context:
        user_message += f"\n\n{previous_plan_context}\n\nIMPORTANT: Generate DIFFERENT themes and vary the game selections. Do not repeat the exact same content as the previous plan."

    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": user_message},
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

    # Fetch real resources in parallel using crawler
    try:
        from generators.resource_fetcher import fetch_study_resources
        resources = await fetch_study_resources(
            certification=cert_code,
            skill_level=skill_level,
            learning_styles=learning_styles,
            max_resources=8
        )
        plan["resources"] = resources
        logger.info(f"Added {len(resources)} resources to plan")
    except Exception as e:
        logger.error(f"Failed to fetch resources: {e}")
        plan["resources"] = []
    
    return plan


def validate_and_fix_actions(
    formatted_plan: Dict[str, Any],
    original_content: Dict[str, Any]
) -> Dict[str, Any]:
    """Ensure the AI didn't hallucinate or remove actions."""
    
    original_weeks = original_content.get("weeks", [])
    formatted_weeks = formatted_plan.get("weeks", [])
    
    # Safety check: ensure formatted_weeks is a list of dicts
    if not isinstance(formatted_weeks, list):
        logger.warning("AI returned invalid weeks format, using original structure")
        formatted_plan["weeks"] = original_weeks
        return formatted_plan
    
    # If AI messed up the weeks, use original structure
    if len(formatted_weeks) != len(original_weeks):
        logger.warning("AI changed week count, using original structure")
        formatted_plan["weeks"] = original_weeks
        return formatted_plan
    
    # For each week, ensure actions match
    for i, (orig_week, fmt_week) in enumerate(zip(original_weeks, formatted_weeks)):
        # Safety check: ensure fmt_week is a dict
        if not isinstance(fmt_week, dict):
            logger.warning(f"Week {i+1}: AI returned invalid week format, using original")
            formatted_weeks[i] = orig_week
            continue
            
        orig_actions = orig_week.get("actions", [])
        fmt_actions = fmt_week.get("actions", [])
        
        # Safety check: ensure fmt_actions is a list
        if not isinstance(fmt_actions, list):
            logger.warning(f"Week {i+1}: AI returned invalid actions format, using original")
            fmt_week["actions"] = orig_actions
            continue
        
        # If action count doesn't match, use original
        if len(fmt_actions) != len(orig_actions):
            logger.warning(f"Week {i+1}: AI changed action count, using original")
            fmt_week["actions"] = orig_actions
            continue
        
        # Ensure each action has the original ID and link
        for j, (orig_action, fmt_action) in enumerate(zip(orig_actions, fmt_actions)):
            # Safety check: ensure fmt_action is a dict
            if not isinstance(fmt_action, dict):
                logger.warning(f"Week {i+1}, Action {j+1}: AI returned invalid action format, using original")
                fmt_actions[j] = orig_action
                continue
            
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
    original_milestones = original_content.get("milestones", [])
    formatted_plan["milestones"] = []
    for m in original_milestones:
        if isinstance(m, dict):
            m["completed"] = False
            formatted_plan["milestones"].append(m)
        else:
            logger.warning(f"Invalid milestone format, skipping: {m}")
    
    return formatted_plan
