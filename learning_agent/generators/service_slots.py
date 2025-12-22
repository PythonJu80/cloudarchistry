"""
Service Slots Game Generator
==============================
Generates "reverse engineering" challenges where players see 3 AWS services
and must identify what architecture pattern they represent.

Economy: Players bet virtual money, win more if correct, lose if wrong.
"""

import json
import uuid
import random
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from openai import AsyncOpenAI

from prompts import CERTIFICATION_PERSONAS
from utils import get_request_api_key, get_request_model, ApiKeyRequiredError
from generators.cloud_tycoon import VALID_SERVICE_IDS, AWS_SERVICES_REFERENCE


# Valid user levels
VALID_USER_LEVELS = ["beginner", "intermediate", "advanced", "expert"]
VALID_CERT_CODES = list(CERTIFICATION_PERSONAS.keys())


class ServiceSlotsValidationError(Exception):
    """Raised when service slots generation parameters are invalid"""
    pass


def validate_slots_params(user_level: str, cert_code: str) -> None:
    """
    Validate that user_level and cert_code are provided and valid.
    
    Args:
        user_level: User skill level ('beginner', 'intermediate', 'advanced', 'expert')
        cert_code: AWS certification persona ID (e.g., 'solutions-architect-associate')
    
    Raises:
        ServiceSlotsValidationError: If parameters are missing or invalid
    """
    if not user_level:
        raise ServiceSlotsValidationError(
            "user_level is required. Service slots challenges must be user-level specific. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if not cert_code:
        raise ServiceSlotsValidationError(
            "cert_code is required. Service slots challenges must be certification-specific. "
            f"Valid cert codes: {', '.join(VALID_CERT_CODES)}"
        )
    
    if user_level not in VALID_USER_LEVELS:
        raise ServiceSlotsValidationError(
            f"Invalid user_level '{user_level}'. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if cert_code not in VALID_CERT_CODES:
        raise ServiceSlotsValidationError(
            f"Invalid cert_code '{cert_code}'. "
            f"Valid cert codes: {', '.join(VALID_CERT_CODES)}"
        )


# Map cert codes (e.g., "SAA-C03" from DB) to persona IDs
CERT_CODE_TO_PERSONA = {
    "SAA": "solutions-architect-associate",
    "SAA-C03": "solutions-architect-associate",
    "SAP": "solutions-architect-professional",
    "SAP-C02": "solutions-architect-professional",
    "DVA": "developer-associate",
    "DVA-C02": "developer-associate",
    "SOA": "sysops-administrator-associate",
    "SOA-C02": "sysops-administrator-associate",
    "DOP": "devops-engineer-professional",
    "DOP-C02": "devops-engineer-professional",
    "CLF": "cloud-practitioner",
    "CLF-C02": "cloud-practitioner",
    "ANS": "advanced-networking-specialty",
    "ANS-C01": "advanced-networking-specialty",
    "SCS": "security-specialty",
    "SCS-C02": "security-specialty",
    "DBS": "database-specialty",
    "DBS-C01": "database-specialty",
    "MLS": "machine-learning-specialty",
    "MLS-C01": "machine-learning-specialty",
}


# =============================================================================
# DATA MODELS
# =============================================================================

class SlotService(BaseModel):
    """A service that appears on a slot reel"""
    service_id: str
    service_name: str
    category: str


class AnswerOption(BaseModel):
    """A multiple choice answer option"""
    id: str
    text: str
    is_correct: bool
    explanation: str


class SlotChallenge(BaseModel):
    """A single slot machine challenge"""
    id: str
    services: List[SlotService]
    pattern_name: str
    pattern_description: str
    options: List[AnswerOption]
    user_level: str  # beginner, intermediate, advanced, expert
    base_payout: float  # How much you win if correct (multiplied by bet) - e.g. 1.5x, 2x, 3x


# =============================================================================
# CATEGORY COLORS (matches aws-services.ts)
# =============================================================================

CATEGORY_COLORS = {
    "compute": "#ED7100",
    "containers": "#ED7100", 
    "database": "#3B48CC",
    "storage": "#3F8624",
    "networking": "#8C4FFF",
    "security": "#DD344C",
    "analytics": "#8C4FFF",
    "integration": "#E7157B",
    "management": "#E7157B",
    "devops": "#3F8624",
    "governance": "#232F3E",
}


# =============================================================================
# GENERATION PROMPT
# =============================================================================

SERVICE_SLOTS_PROMPT = """You are generating a Service Slots challenge for an AWS certification student.
The game shows 3 AWS services and the player must identify what architecture pattern they represent.

USER PROFILE:
- Skill Level: {user_level}
- Target Certification: {cert_name}
- Focus Areas: {focus_areas}

CRITICAL: Generate UNIQUE and VARIED patterns every time. DO NOT repeat common patterns like:
- Lambda + API Gateway + DynamoDB (serverless API)
- EC2 + RDS + S3 (basic web app)
- CloudFront + S3 + Route53 (static website)

Instead, explore DIVERSE patterns based on the user's certification focus areas:
- For SAA: Multi-AZ, disaster recovery, cost optimization, hybrid cloud
- For DVA: CI/CD, debugging, testing, deployment strategies
- For SOA: Monitoring, automation, compliance, operational excellence
- For SAP: Complex multi-account, enterprise patterns, migrations
- For SCS: Security architectures, encryption, access control, compliance
- For ANS: Advanced networking, Transit Gateway, Direct Connect, VPN
- For MLS: ML pipelines, training, inference, data preparation
- For DAS: Data lakes, ETL, streaming, analytics

RULES:
1. Pick EXACTLY 3 AWS services that logically work together in a real architecture
2. Create 4 multiple choice options - 1 correct, 3 plausible but wrong
3. The correct answer should describe what these 3 services build together
4. Wrong answers should be believable but clearly wrong if you know AWS
5. Provide brief explanations for why each option is right/wrong
6. VARY the service combinations - use different services each time
7. Focus on patterns relevant to the user's TARGET CERTIFICATION

SKILL LEVEL RULES:
- beginner: Common patterns but still varied
- intermediate: Less obvious combos, requires thinking about the certification focus
- advanced: Advanced patterns specific to the certification, edge cases
- expert: Complex multi-service patterns, subtle distinctions, certification deep-dives

{services_reference}

IMPORTANT: Randomize which option (a, b, c, or d) is the correct answer. Do NOT always make "a" correct.
Vary the position of the correct answer across challenges.

Return JSON:
{{
  "services": [
    {{"service_id": "lambda", "service_name": "AWS Lambda", "category": "compute"}},
    {{"service_id": "sqs", "service_name": "Amazon SQS", "category": "integration"}},
    {{"service_id": "dynamodb", "service_name": "Amazon DynamoDB", "category": "database"}}
  ],
  "pattern_name": "Event-Driven Processing",
  "pattern_description": "Decoupled serverless architecture where SQS queues trigger Lambda functions to process messages and store results in DynamoDB",
  "options": [
    {{"id": "a", "text": "Real-time streaming analytics", "is_correct": false, "explanation": "Streaming would use Kinesis, not SQS. SQS is for message queuing, not streaming"}},
    {{"id": "b", "text": "Static website with database", "is_correct": false, "explanation": "Static websites use S3+CloudFront, not Lambda+SQS"}},
    {{"id": "c", "text": "Event-driven serverless processing pipeline", "is_correct": true, "explanation": "SQS queues messages, Lambda processes them, DynamoDB stores results - classic decoupled pattern"}},
    {{"id": "d", "text": "Machine learning inference endpoint", "is_correct": false, "explanation": "ML inference typically uses SageMaker, not this combination"}}
  ],
  "user_level": "beginner",
  "base_payout": 2
}}

BASE PAYOUT GUIDE:
- easy: 1.5x to 2x
- medium: 2x to 3x  
- hard: 3x to 5x
"""


# =============================================================================
# GENERATOR FUNCTIONS
# =============================================================================

async def generate_slot_challenge(
    user_level: str,
    cert_code: str,
    _difficulty: Optional[str] = None,  # DEPRECATED - ignored, kept for backward compat
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> SlotChallenge:
    """
    Generate a single slot machine challenge.
    
    IMPORTANT: Both user_level and cert_code are REQUIRED.
    Each challenge must be certification-specific and user-level specific.
    
    Args:
        user_level: User's skill level (REQUIRED: 'beginner', 'intermediate', 'advanced', 'expert')
        cert_code: Certification persona ID (REQUIRED, e.g., 'solutions-architect-associate')
        _difficulty: DEPRECATED - ignored, user_level is used instead
        api_key: OpenAI API key
        model: Optional model override
    
    Returns:
        SlotChallenge with 3 services and 4 options
    
    Raises:
        ServiceSlotsValidationError: If user_level or cert_code are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_slots_params(user_level, cert_code)
    # Get API key
    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required")
    
    # Get certification context (cert_code is now required and validated)
    if cert_code not in CERTIFICATION_PERSONAS:
        raise ServiceSlotsValidationError(f"Unknown certification persona: {cert_code}")
    
    persona = CERTIFICATION_PERSONAS[cert_code]
    cert_name = persona["cert"]
    focus_areas = persona["focus"]
    
    # Normalize user_level for lookups
    user_level = user_level.lower()
    
    # Random theme to force variety
    themes = [
        "data processing and ETL",
        "real-time streaming",
        "batch processing",
        "microservices communication",
        "event-driven architecture",
        "disaster recovery",
        "high availability",
        "cost optimization",
        "security and compliance",
        "monitoring and observability",
        "CI/CD pipeline",
        "container orchestration",
        "serverless computing",
        "data lake architecture",
        "machine learning workflow",
        "API management",
        "content delivery",
        "database replication",
        "message queuing",
        "workflow orchestration",
        "log aggregation",
        "backup and restore",
        "hybrid cloud connectivity",
        "multi-region deployment",
        "edge computing",
        "IoT data ingestion",
        "analytics and reporting",
        "identity and access management",
        "encryption and key management",
        "network security",
    ]
    theme = random.choice(themes)
    
    # Fetch current AWS knowledge from database
    from utils import fetch_knowledge_for_generation
    knowledge_context = await fetch_knowledge_for_generation(
        cert_code=cert_code,
        topic=f"{theme} {' '.join(focus_areas[:2])}",
        limit=5,
        api_key=api_key
    )
    
    # Build prompt
    system_prompt = SERVICE_SLOTS_PROMPT.format(
        user_level=user_level,
        cert_name=cert_name,
        focus_areas=", ".join(focus_areas),
        services_reference=AWS_SERVICES_REFERENCE,
    )
    
    user_prompt = f"""Generate a {user_level} skill level Service Slots challenge.

Target certification: {cert_name}
Skill level: {user_level}

{knowledge_context}
Theme hint: Focus on "{theme}" patterns for this challenge.

Pick 3 AWS services that work together in a real-world architecture pattern related to {theme}.
Make sure the services are from the valid list provided.
Be creative and avoid the most common/obvious combinations."""

    # Call OpenAI
    model_to_use = model or get_request_model() or "gpt-4o"
    client = AsyncOpenAI(api_key=key)
    
    response = await client.chat.completions.create(
        model=model_to_use,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.9,
    )
    
    result = json.loads(response.choices[0].message.content)
    
    # Validate and filter services
    valid_services = []
    for svc in result.get("services", [])[:3]:
        service_id = svc.get("service_id", "").lower().strip()
        if service_id in VALID_SERVICE_IDS:
            valid_services.append(SlotService(
                service_id=service_id,
                service_name=svc.get("service_name", ""),
                category=svc.get("category", ""),
            ))
    
    # Need exactly 3 services
    if len(valid_services) < 3:
        raise ValueError("AI didn't return 3 valid services")
    
    # Parse options
    options = []
    for opt in result.get("options", [])[:4]:
        options.append(AnswerOption(
            id=opt.get("id", str(uuid.uuid4())[:4]),
            text=opt.get("text", ""),
            is_correct=opt.get("is_correct", False),
            explanation=opt.get("explanation", ""),
        ))
    
    # Ensure exactly one correct answer
    correct_count = sum(1 for o in options if o.is_correct)
    if correct_count != 1:
        # Fix it - pick a random position for the correct answer
        correct_idx = random.randint(0, len(options) - 1)
        for i, opt in enumerate(options):
            opt.is_correct = (i == correct_idx)
    
    # Shuffle options so correct answer position is randomized
    random.shuffle(options)
    
    # Re-assign IDs after shuffle to maintain a, b, c, d order
    option_ids = ["a", "b", "c", "d"]
    for i, opt in enumerate(options):
        opt.id = option_ids[i]
    
    return SlotChallenge(
        id=f"slot_{uuid.uuid4().hex[:8]}",
        services=valid_services[:3],
        pattern_name=result.get("pattern_name", "Architecture Pattern"),
        pattern_description=result.get("pattern_description", ""),
        options=options,
        user_level=result.get("user_level", user_level),
        base_payout=result.get("base_payout", 2),
    )


def validate_slot_answer(
    challenge: SlotChallenge,
    selected_option_id: str,
    bet_amount: int,
    cert_code: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Validate the player's answer and calculate winnings.
    Provides certification-specific educational feedback.
    
    Args:
        challenge: The slot challenge
        selected_option_id: ID of the option the player selected
        bet_amount: Amount the player bet
        cert_code: Optional certification code for cert-specific feedback
    
    Returns:
        Validation result with winnings and personalized feedback
    """
    # Find selected option
    selected = None
    correct = None
    for opt in challenge.options:
        if opt.id == selected_option_id:
            selected = opt
        if opt.is_correct:
            correct = opt
    
    if not selected:
        return {
            "correct": False,
            "winnings": -bet_amount,
            "correct_answer": correct.text if correct else "",
            "explanation": "Invalid selection",
            "pattern_name": challenge.pattern_name,
            "pattern_description": challenge.pattern_description,
        }
    
    # Add certification-specific educational note if cert_code provided
    cert_note = ""
    if cert_code and cert_code in CERTIFICATION_PERSONAS:
        persona = CERTIFICATION_PERSONAS[cert_code]
        cert_note = f"\n\n💡 {persona['cert']} Tip: This pattern is commonly tested in the exam's {persona['focus'][0]} domain."
    
    if selected.is_correct:
        # Winner! Payout is bet * base_payout
        winnings = int(bet_amount * challenge.base_payout)
        return {
            "correct": True,
            "winnings": winnings,
            "correct_answer": selected.text,
            "explanation": selected.explanation + cert_note,
            "pattern_name": challenge.pattern_name,
            "pattern_description": challenge.pattern_description,
        }
    else:
        # Loser - lose the bet
        return {
            "correct": False,
            "winnings": -bet_amount,
            "correct_answer": correct.text if correct else "",
            "explanation": selected.explanation + cert_note,
            "pattern_name": challenge.pattern_name,
            "pattern_description": challenge.pattern_description,
        }


# =============================================================================
# BATCH GENERATION (for preloading)
# =============================================================================

async def generate_slot_batch(
    count: int,
    user_level: str,
    cert_code: str,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> List[SlotChallenge]:
    """
    Generate multiple challenges at once for smoother UX.
    
    IMPORTANT: Both user_level and cert_code are REQUIRED.
    
    Args:
        count: Number of challenges to generate
        user_level: User's skill level (REQUIRED: 'beginner', 'intermediate', 'advanced', 'expert')
        cert_code: Certification persona ID (REQUIRED)
        api_key: Optional OpenAI API key
        model: Optional model override
    
    Returns:
        List of SlotChallenges
    
    Raises:
        ServiceSlotsValidationError: If user_level or cert_code are missing/invalid
    """
    
    # Validate parameters once for the batch
    validate_slots_params(user_level, cert_code)
    challenges = []
    for _ in range(count):
        try:
            challenge = await generate_slot_challenge(
                user_level=user_level,
                cert_code=cert_code,
                api_key=api_key,
                model=model,
            )
            challenges.append(challenge)
        except Exception as e:
            print(f"Failed to generate challenge: {e}")
            continue
    return challenges


# =============================================================================
# TEST
# =============================================================================

if __name__ == "__main__":
    import asyncio
    
    async def test():
        challenge = await generate_slot_challenge(
            user_level="intermediate",
            cert_code="SAA-C03",
            # difficulty param deprecated - user_level drives everything
        )
        print(f"Services: {[s.service_name for s in challenge.services]}")
        print(f"Pattern: {challenge.pattern_name}")
        print(f"Skill Level: {challenge.user_level}")
        print(f"Payout: {challenge.base_payout}x")
        print("\nOptions:")
        for opt in challenge.options:
            mark = "✓" if opt.is_correct else "✗"
            print(f"  {mark} {opt.text}")
    
    asyncio.run(test())
