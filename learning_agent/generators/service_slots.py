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
from typing import List, Optional, Dict
from pydantic import BaseModel
from openai import AsyncOpenAI

from prompts import CERTIFICATION_PERSONAS
from utils import get_request_api_key, get_request_model, ApiKeyRequiredError
from generators.cloud_tycoon import VALID_SERVICE_IDS, AWS_SERVICES_REFERENCE


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
    difficulty: str
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

DIFFICULTY LEVELS:
- easy: Common patterns but still varied
- medium: Less obvious combos, requires thinking about the certification focus
- hard: Advanced patterns specific to the certification, edge cases

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
  "difficulty": "easy",
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
    user_level: str = "intermediate",
    cert_code: Optional[str] = None,
    difficulty: Optional[str] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> SlotChallenge:
    """
    Generate a single slot machine challenge.
    
    Args:
        user_level: User's skill level
        cert_code: Target certification code
        difficulty: Optional difficulty override (random if not provided)
        api_key: OpenAI API key
    
    Returns:
        SlotChallenge with 3 services and 4 options
    """
    # Get API key
    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required")
    
    # Build cert context
    cert_name = "AWS Cloud Practitioner"
    focus_areas = ["Core AWS Services", "Cloud Concepts", "Security"]
    
    if cert_code and cert_code in CERTIFICATION_PERSONAS:
        persona = CERTIFICATION_PERSONAS[cert_code]
        cert_name = persona.get("cert", cert_name)
        focus_areas = persona.get("focus", focus_areas)
    
    # Random difficulty if not specified
    if not difficulty:
        weights = {"easy": 0.4, "medium": 0.4, "hard": 0.2}
        difficulty = random.choices(
            list(weights.keys()), 
            weights=list(weights.values())
        )[0]
    
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
    
    # Build prompt
    system_prompt = SERVICE_SLOTS_PROMPT.format(
        user_level=user_level,
        cert_name=cert_name,
        focus_areas=", ".join(focus_areas),
        services_reference=AWS_SERVICES_REFERENCE,
    )
    
    user_prompt = f"""Generate a {difficulty} difficulty Service Slots challenge.

Target certification: {cert_name}
Skill level: {user_level}
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
        difficulty=result.get("difficulty", difficulty),
        base_payout=result.get("base_payout", 2),
    )


def validate_slot_answer(
    challenge: SlotChallenge,
    selected_option_id: str,
    bet_amount: int,
) -> Dict:
    """
    Validate the player's answer and calculate winnings.
    
    Args:
        challenge: The slot challenge
        selected_option_id: The option ID the player selected
        bet_amount: How much they bet
    
    Returns:
        {
            "correct": bool,
            "winnings": int (positive if won, negative if lost),
            "correct_answer": str,
            "explanation": str,
            "pattern_name": str,
            "pattern_description": str,
        }
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
    
    if selected.is_correct:
        # Winner! Payout is bet * base_payout
        winnings = int(bet_amount * challenge.base_payout)
        return {
            "correct": True,
            "winnings": winnings,
            "correct_answer": selected.text,
            "explanation": selected.explanation,
            "pattern_name": challenge.pattern_name,
            "pattern_description": challenge.pattern_description,
        }
    else:
        # Loser - lose the bet
        return {
            "correct": False,
            "winnings": -bet_amount,
            "correct_answer": correct.text if correct else "",
            "explanation": selected.explanation,
            "pattern_name": challenge.pattern_name,
            "pattern_description": challenge.pattern_description,
        }


# =============================================================================
# BATCH GENERATION (for preloading)
# =============================================================================

async def generate_slot_batch(
    count: int = 5,
    user_level: str = "intermediate",
    cert_code: Optional[str] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> List[SlotChallenge]:
    """Generate multiple challenges at once for smoother UX."""
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
            difficulty="medium",
        )
        print(f"Services: {[s.service_name for s in challenge.services]}")
        print(f"Pattern: {challenge.pattern_name}")
        print(f"Difficulty: {challenge.difficulty}")
        print(f"Payout: {challenge.base_payout}x")
        print("\nOptions:")
        for opt in challenge.options:
            mark = "✓" if opt.is_correct else "✗"
            print(f"  {mark} {opt.text}")
    
    asyncio.run(test())
