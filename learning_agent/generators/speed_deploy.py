"""
Speed Deploy Game Generator
==============================
Generates architecture deployment challenges where players must select
the correct AWS services to meet client requirements under time pressure.

This is NOT trivia - it's architectural judgment under pressure.
Players are graded on:
- Correctness (meets requirements) - mandatory
- Speed bonus - faster = more points
- Cost efficiency - cheapest valid solution gets bonus
- Overengineering penalty - unnecessary services cost points

Skill level scaling:
- Beginner: Clear requirements, obvious optimal solution
- Intermediate: Multiple valid solutions, optimization matters
- Advanced/Expert: Ambiguous requirements, cost vs latency tension, constraint traps
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


# Valid user levels
VALID_USER_LEVELS = ["beginner", "intermediate", "advanced", "expert"]
VALID_CERT_CODES = list(CERTIFICATION_PERSONAS.keys())


class SpeedDeployValidationError(Exception):
    """Raised when speed deploy generation parameters are invalid"""
    pass


def validate_deploy_params(user_level: str, cert_code: str) -> None:
    """
    Validate that user_level and cert_code are provided and valid.
    
    Args:
        user_level: User skill level ('beginner', 'intermediate', 'advanced', 'expert')
        cert_code: AWS certification persona ID (e.g., 'solutions-architect-associate')
    
    Raises:
        SpeedDeployValidationError: If parameters are missing or invalid
    """
    if not user_level:
        raise SpeedDeployValidationError(
            "user_level is required. Speed deploy challenges must be user-level specific. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if not cert_code:
        raise SpeedDeployValidationError(
            "cert_code is required. Speed deploy challenges must be certification-specific. "
            f"Valid cert codes: {', '.join(VALID_CERT_CODES)}"
        )
    
    if user_level not in VALID_USER_LEVELS:
        raise SpeedDeployValidationError(
            f"Invalid user_level '{user_level}'. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if cert_code not in VALID_CERT_CODES:
        raise SpeedDeployValidationError(
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

class ClientRequirement(BaseModel):
    """A single requirement from the client brief"""
    category: str  # traffic, latency, cost, availability, compliance, data
    description: str
    priority: str  # critical, important, nice-to-have


class ServiceTrap(BaseModel):
    """A service that works but is suboptimal - tests architectural judgment"""
    service_id: str
    why_suboptimal: str  # e.g., "RDS MySQL works but Aurora Serverless is better for variable traffic"
    penalty: int  # Points deducted for using this


class DeployBrief(BaseModel):
    """A client deployment brief - the challenge"""
    id: str
    client_name: str
    industry: str
    icon: str
    requirements: List[ClientRequirement]
    available_services: List[str]  # 10-14 service IDs to choose from (curated palette)
    optimal_solution: List[str]  # The "best" answer (3-6 services)
    acceptable_solutions: List[List[str]]  # Other valid solutions (work but suboptimal)
    trap_services: List[ServiceTrap] = []  # Valid but suboptimal - penalty if used
    time_limit: int  # seconds (60-180 based on user_level)
    user_level: str  # beginner, intermediate, advanced, expert
    target_cert: str  # e.g., "AWS Solutions Architect Associate"
    max_score: int
    cost_optimal: bool = True  # Is the optimal solution also the cheapest?
    learning_point: str = ""  # Key architectural lesson this round teaches


class DeployResult(BaseModel):
    """Result of validating a deployment - GRADED, not pass/fail"""
    # Core result
    grade: str  # S, A, B, C, D, F
    score: int
    max_score: int
    
    # Score breakdown
    correctness_score: int  # Base score for meeting requirements
    speed_bonus: int  # Bonus for fast deployment
    cost_efficiency_bonus: int  # Bonus for cost-optimal solution
    overengineering_penalty: int  # Penalty for unnecessary services
    trap_penalty: int  # Penalty for using trap services
    missed_requirement_penalty: int  # Penalty for missing critical requirements
    
    # Analysis
    met_requirements: bool
    is_optimal: bool
    is_acceptable: bool
    requirements_met: List[str]  # Which requirement categories were satisfied
    requirements_missed: List[str]  # Which were missed
    trap_services_used: List[Dict]  # Which traps they fell into and why
    missing_services: List[str]
    extra_services: List[str]
    
    # Feedback
    feedback: str
    optimal_solution: List[str]
    learning_point: str  # Key architectural lesson from this round


# =============================================================================
# GENERATION PROMPT
# =============================================================================

SPEED_DEPLOY_PROMPT = """You are generating a Speed Deploy challenge for an AWS certification student.
This is NOT trivia - it's architectural judgment under pressure.

USER PROFILE:
- Skill Level: {user_level}
- Target Certification: {cert_name}
- Focus Areas: {focus_areas}

Generate a realistic client deployment scenario that tests TRADEOFFS, not memorization.

USER SKILL LEVEL: {user_level}

SKILL LEVEL RULES:
- beginner: Clear requirements, obvious optimal solution, 10 services in palette, no traps
- intermediate: Multiple valid solutions, optimization matters, 12 services, 1-2 traps
- advanced: Ambiguous requirements, cost vs latency tension, 14 services, 2-3 traps, hidden constraints
- expert: Complex multi-service architectures, subtle tradeoffs, 14 services, 3-4 traps, edge cases

REQUIREMENT CATEGORIES (use 4-6 per brief):
- traffic: Request volume, scaling needs, burst handling
- latency: Response time requirements, global users
- cost: Budget constraints, pay-per-use preference
- availability: Uptime SLA, disaster recovery, multi-region
- compliance: HIPAA, PCI-DSS, SOC2, GDPR, encryption requirements
- data: Storage volume, processing needs, analytics

TRAP SERVICES (critical for learning):
Include services that WORK but are SUBOPTIMAL. Examples:
- RDS MySQL works → Aurora Serverless is better for variable traffic
- EC2 + Auto Scaling works → ECS/Fargate is faster to deploy + cheaper
- S3 alone works → S3 + CloudFront is better for global latency
- Single-AZ RDS works → Multi-AZ is required for 99.9% SLA

{services_reference}

Return JSON:
{{
  "client_name": "TechFlow Startup",
  "industry": "FinTech",
  "icon": "💳",
  "requirements": [
    {{"category": "traffic", "description": "Handle 50K requests/second during peak with 10x burst capacity", "priority": "critical"}},
    {{"category": "latency", "description": "Sub-100ms API response time for users in US and EU", "priority": "critical"}},
    {{"category": "compliance", "description": "PCI-DSS Level 1 compliant - all payment data encrypted at rest and in transit", "priority": "critical"}},
    {{"category": "cost", "description": "Pay-per-use model preferred - minimize idle costs", "priority": "important"}},
    {{"category": "availability", "description": "99.9% uptime SLA with automatic failover", "priority": "important"}}
  ],
  "available_services": ["lambda", "api-gateway", "dynamodb", "rds", "aurora", "elasticache", "cloudfront", "waf", "kms", "ec2", "auto-scaling", "alb", "ecs", "fargate"],
  "optimal_solution": ["api-gateway", "lambda", "dynamodb", "elasticache", "cloudfront", "waf", "kms"],
  "acceptable_solutions": [
    ["alb", "ecs", "fargate", "aurora", "elasticache", "cloudfront", "waf", "kms"],
    ["api-gateway", "lambda", "aurora", "elasticache", "waf", "kms"]
  ],
  "trap_services": [
    {{"service_id": "rds", "why_suboptimal": "RDS MySQL requires capacity planning. Aurora Serverless auto-scales and is better for variable traffic patterns.", "penalty": 10}},
    {{"service_id": "ec2", "why_suboptimal": "EC2 + Auto Scaling works but requires more management. Lambda or Fargate are better for pay-per-use requirements.", "penalty": 8}}
  ],
  "time_limit": 60,
  "learning_point": "For variable traffic with pay-per-use requirements, serverless (Lambda/Fargate + DynamoDB/Aurora Serverless) beats traditional EC2/RDS."
}}

CRITICAL RULES:
1. All service IDs must be from the valid list provided
2. optimal_solution = BEST choice (fastest, cheapest, most appropriate)
3. acceptable_solutions = WORK but are suboptimal (more expensive, slower, harder to manage)
4. trap_services = technically valid but WRONG choice - include WHY they're wrong
5. available_services = optimal + acceptable + traps + 2-3 pure distractors
6. learning_point = the key architectural lesson this round teaches
7. Time limits: beginner=180s, intermediate=160s, advanced=90s, expert=60s
"""


# =============================================================================
# GENERATOR FUNCTIONS
# =============================================================================

async def generate_deploy_brief(
    user_level: str,
    cert_code: str,
    _difficulty: Optional[str] = None,  # DEPRECATED - ignored, kept for backward compat
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> DeployBrief:
    """
    Generate a Speed Deploy challenge brief.
    
    IMPORTANT: Both user_level and cert_code are REQUIRED.
    Each challenge must be certification-specific and user-level specific.
    
    Args:
        user_level: User's skill level (REQUIRED: 'beginner', 'intermediate', 'advanced', 'expert')
        cert_code: Certification persona ID (REQUIRED, e.g., 'solutions-architect-associate')
        _difficulty: DEPRECATED - ignored, user_level is used instead
        api_key: OpenAI API key
        model: Preferred model
    
    Returns:
        DeployBrief with client requirements and service palette
    
    Raises:
        SpeedDeployValidationError: If user_level or cert_code are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_deploy_params(user_level, cert_code)
    # Get API key
    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required")
    
    # Get certification context (cert_code is now required and validated)
    if cert_code not in CERTIFICATION_PERSONAS:
        raise SpeedDeployValidationError(f"Unknown certification persona: {cert_code}")
    
    persona = CERTIFICATION_PERSONAS[cert_code]
    cert_name = persona["cert"]
    focus_areas = persona["focus"]
    
    # Normalize user_level for lookups
    user_level = user_level.lower()
    
    # Random scenario theme for variety
    themes = [
        "e-commerce platform launch",
        "real-time analytics dashboard",
        "mobile app backend",
        "IoT data processing",
        "media streaming service",
        "financial trading platform",
        "healthcare patient portal",
        "gaming leaderboard system",
        "social media feed",
        "enterprise document management",
        "machine learning inference API",
        "multi-tenant SaaS platform",
        "event ticketing system",
        "logistics tracking system",
        "content management system",
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
    system_prompt = SPEED_DEPLOY_PROMPT.format(
        user_level=user_level,
        cert_name=cert_name,
        focus_areas=", ".join(focus_areas),
        services_reference=AWS_SERVICES_REFERENCE,
    )
    
    user_prompt = f"""Generate a {user_level} skill level Speed Deploy challenge.

Target certification: {cert_name}
Skill level: {user_level}
Scenario theme: {theme}

{knowledge_context}

Create a realistic client brief that tests architectural TRADEOFFS, not memorization.
Focus on patterns relevant to {cert_name} certification.

Remember:
- {user_level} skill level rules apply
- Include trap_services with why_suboptimal explanations
- Include a learning_point that teaches the key architectural lesson"""

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
    def filter_valid_services(service_list: List[str]) -> List[str]:
        return [s.lower().strip() for s in service_list if s.lower().strip() in VALID_SERVICE_IDS]
    
    available = filter_valid_services(result.get("available_services", []))
    optimal = filter_valid_services(result.get("optimal_solution", []))
    acceptable = [filter_valid_services(sol) for sol in result.get("acceptable_solutions", [])]
    
    # Ensure we have enough services
    if len(available) < 10:
        # Add more valid services as distractors
        all_services = list(VALID_SERVICE_IDS)
        random.shuffle(all_services)
        for svc in all_services:
            if svc not in available:
                available.append(svc)
            if len(available) >= 12:
                break
    
    # Ensure optimal solution services are in available
    for svc in optimal:
        if svc not in available:
            available.append(svc)
    
    # Parse requirements
    requirements = []
    for req in result.get("requirements", []):
        requirements.append(ClientRequirement(
            category=req.get("category", "general"),
            description=req.get("description", ""),
            priority=req.get("priority", "important"),
        ))
    
    # Time limit based on user_level (beginner=180s, intermediate=160s, advanced=90s, expert=60s)
    time_limits = {"beginner": 180, "intermediate": 160, "advanced": 90, "expert": 60}
    time_limit = result.get("time_limit", time_limits.get(user_level, 160))
    
    # Max score based on user_level
    max_scores = {"beginner": 100, "intermediate": 150, "advanced": 200, "expert": 250}
    max_score = result.get("max_score", max_scores.get(user_level, 100))
    
    # Parse trap services
    trap_services = []
    for trap in result.get("trap_services", []):
        service_id = trap.get("service_id", "").lower().strip()
        if service_id in VALID_SERVICE_IDS:
            trap_services.append(ServiceTrap(
                service_id=service_id,
                why_suboptimal=trap.get("why_suboptimal", "This service works but is not optimal."),
                penalty=trap.get("penalty", 10),
            ))
    
    # Get learning point
    learning_point = result.get("learning_point", "Consider the tradeoffs between cost, performance, and complexity.")
    
    return DeployBrief(
        id=f"deploy_{uuid.uuid4().hex[:8]}",
        client_name=result.get("client_name", "Client Corp"),
        industry=result.get("industry", "Technology"),
        icon=result.get("icon", "🏢"),
        requirements=requirements,
        available_services=available[:14],  # Cap at 14
        optimal_solution=optimal,
        acceptable_solutions=acceptable,
        trap_services=trap_services,
        time_limit=time_limit,
        user_level=user_level,
        target_cert=cert_name,
        max_score=max_score,
        learning_point=learning_point,
    )


async def validate_deployment_with_ai(
    brief: DeployBrief,
    submitted_services: List[str],
    time_remaining: int,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> DeployResult:
    """
    AI-powered validation that evaluates the submission in context of the 
    target certification and user skill level.
    
    The AI evaluates:
    - Does this architecture meet the requirements for THIS certification?
    - What's missing or suboptimal for THIS cert's exam focus?
    - Cert-specific feedback (e.g., "For SAA, Multi-AZ is required for 99.9% SLA")
    
    Scoring model:
    - AI correctness score (0-60% of max)
    - Speed bonus (up to 20% of max)
    - Cost efficiency bonus (up to 10% of max)
    - Penalties from AI evaluation
    
    Grades: S (95%+), A (85%+), B (70%+), C (50%+), D (30%+), F (<30%)
    """
    key = api_key or get_request_api_key()
    if not key:
        # Fallback to deterministic validation if no API key
        return validate_deployment_deterministic(brief, submitted_services, time_remaining)
    
    submitted_set = set(s.lower().strip() for s in submitted_services)
    optimal_set = set(brief.optimal_solution)
    
    # Quick checks for exact matches (no AI needed)
    is_optimal = submitted_set == optimal_set
    is_acceptable = any(submitted_set == set(acc) for acc in brief.acceptable_solutions)
    
    # Calculate what's missing/extra compared to optimal
    missing = list(optimal_set - submitted_set)
    extra = list(submitted_set - optimal_set)
    
    # Build the AI evaluation prompt
    requirements_text = "\n".join([
        f"- [{req.priority.upper()}] {req.category}: {req.description}"
        for req in brief.requirements
    ])
    
    trap_info = ""
    if brief.trap_services:
        trap_info = "\nKnown suboptimal services in palette:\n" + "\n".join([
            f"- {t.service_id}: {t.why_suboptimal}"
            for t in brief.trap_services
        ])
    
    eval_prompt = f"""You are an AWS certification exam grader evaluating a Speed Deploy architecture challenge.

TARGET CERTIFICATION: {brief.target_cert or "AWS Solutions Architect"}
USER SKILL LEVEL: {brief.user_level}
CLIENT: {brief.client_name} ({brief.industry})

REQUIREMENTS:
{requirements_text}

OPTIMAL SOLUTION: {', '.join(brief.optimal_solution)}
ACCEPTABLE ALTERNATIVES: {brief.acceptable_solutions}
{trap_info}

SUBMITTED ARCHITECTURE: {', '.join(submitted_services) if submitted_services else "EMPTY (no services selected)"}

Evaluate this submission specifically for the {brief.target_cert or "AWS Solutions Architect"} certification exam context.

Return JSON:
{{
  "correctness_percent": <0-100, how well does this meet requirements for THIS cert>,
  "requirements_met": ["list", "of", "requirement", "categories", "satisfied"],
  "requirements_missed": ["list", "of", "requirement", "categories", "NOT", "satisfied"],
  "is_valid_solution": <true if it would work, even if not optimal>,
  "is_cost_efficient": <true if cost-optimized for the requirements>,
  "trap_services_used": [
    {{"service_id": "...", "why_suboptimal": "cert-specific reason why this is wrong"}}
  ],
  "missing_critical": ["services that are REQUIRED for this cert's focus areas"],
  "unnecessary_services": ["services that add cost/complexity without benefit"],
  "feedback": "2-3 sentence cert-specific feedback explaining the grade",
  "learning_point": "Key architectural lesson for THIS certification"
}}

Be strict but fair. Consider what the {brief.target_cert or "AWS"} exam would expect."""

    # Call OpenAI for evaluation
    model_to_use = model or get_request_model() or "gpt-4o"
    client = AsyncOpenAI(api_key=key)
    
    try:
        response = await client.chat.completions.create(
            model=model_to_use,
            messages=[
                {"role": "system", "content": "You are an AWS certification exam grader. Return only valid JSON."},
                {"role": "user", "content": eval_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,  # Lower temperature for more consistent grading
        )
        
        eval_result = json.loads(response.choices[0].message.content or "{}")
    except Exception as e:
        # Fallback to deterministic if AI fails
        print(f"AI validation failed, using deterministic: {e}")
        return validate_deployment_deterministic(brief, submitted_services, time_remaining)
    
    # =========================================================================
    # SCORING BREAKDOWN (using AI evaluation)
    # =========================================================================
    
    # 1. CORRECTNESS SCORE (base: 0-60% of max) - from AI
    ai_correctness = eval_result.get("correctness_percent", 50)
    correctness_score = int(brief.max_score * 0.60 * (ai_correctness / 100))
    
    # Override for exact matches
    if is_optimal:
        correctness_score = int(brief.max_score * 0.60)
    elif is_acceptable:
        correctness_score = max(correctness_score, int(brief.max_score * 0.50))
    
    # 2. SPEED BONUS (up to 20% of max)
    speed_ratio = time_remaining / brief.time_limit if brief.time_limit > 0 else 0
    is_valid = eval_result.get("is_valid_solution", False) or is_optimal or is_acceptable
    if is_valid:
        speed_bonus = int(brief.max_score * 0.20 * speed_ratio)
    else:
        speed_bonus = 0
    
    # 3. COST EFFICIENCY BONUS (up to 10% of max)
    if is_optimal or eval_result.get("is_cost_efficient", False):
        cost_efficiency_bonus = int(brief.max_score * 0.10)
    elif is_acceptable:
        cost_efficiency_bonus = int(brief.max_score * 0.05)
    else:
        cost_efficiency_bonus = 0
    
    # 4. OVERENGINEERING PENALTY
    unnecessary = eval_result.get("unnecessary_services", [])
    overengineering_penalty = len(unnecessary) * 5 if not is_optimal else 0
    
    # 5. TRAP PENALTY - from AI evaluation
    trap_services_used = eval_result.get("trap_services_used", [])
    trap_penalty = len(trap_services_used) * 10
    
    # 6. MISSED REQUIREMENT PENALTY
    requirements_met = eval_result.get("requirements_met", [])
    requirements_missed = eval_result.get("requirements_missed", [])
    missed_requirement_penalty = 0
    for req in brief.requirements:
        if req.category in requirements_missed:
            if req.priority == "critical":
                missed_requirement_penalty += 15
            else:
                missed_requirement_penalty += 8
    
    # =========================================================================
    # FINAL SCORE & GRADE
    # =========================================================================
    
    final_score = max(0, (
        correctness_score 
        + speed_bonus 
        + cost_efficiency_bonus 
        - overengineering_penalty 
        - trap_penalty 
        - missed_requirement_penalty
    ))
    
    percentage = (final_score / brief.max_score) * 100 if brief.max_score > 0 else 0
    
    if percentage >= 95:
        grade = "S"
    elif percentage >= 85:
        grade = "A"
    elif percentage >= 70:
        grade = "B"
    elif percentage >= 50:
        grade = "C"
    elif percentage >= 30:
        grade = "D"
    else:
        grade = "F"
    
    # Get feedback from AI
    feedback = eval_result.get("feedback", "Architecture evaluated.")
    learning_point = eval_result.get("learning_point", brief.learning_point)
    
    return DeployResult(
        grade=grade,
        score=final_score,
        max_score=brief.max_score,
        correctness_score=correctness_score,
        speed_bonus=speed_bonus,
        cost_efficiency_bonus=cost_efficiency_bonus,
        overengineering_penalty=overengineering_penalty,
        trap_penalty=trap_penalty,
        missed_requirement_penalty=missed_requirement_penalty,
        met_requirements=len(requirements_missed) == 0,
        is_optimal=is_optimal,
        is_acceptable=is_acceptable or eval_result.get("is_valid_solution", False),
        requirements_met=requirements_met,
        requirements_missed=requirements_missed,
        trap_services_used=trap_services_used,
        missing_services=eval_result.get("missing_critical", missing),
        extra_services=eval_result.get("unnecessary_services", extra),
        feedback=feedback,
        optimal_solution=brief.optimal_solution,
        learning_point=learning_point,
    )


def validate_deployment_deterministic(
    brief: DeployBrief,
    submitted_services: List[str],
    time_remaining: int,
) -> DeployResult:
    """
    Deterministic validation fallback (no AI).
    Used when API key is not available or AI call fails.
    """
    submitted_set = set(s.lower().strip() for s in submitted_services)
    optimal_set = set(brief.optimal_solution)
    
    is_optimal = submitted_set == optimal_set
    is_acceptable = any(submitted_set == set(acc) for acc in brief.acceptable_solutions)
    
    missing = list(optimal_set - submitted_set)
    extra = list(submitted_set - optimal_set)
    
    # Correctness score
    if is_optimal:
        correctness_score = int(brief.max_score * 0.60)
        feedback = "🎯 Perfect architecture! Optimal solution selected."
    elif is_acceptable:
        correctness_score = int(brief.max_score * 0.50)
        feedback = "✅ Valid architecture. Works but not optimal."
    elif len(missing) == 0:
        correctness_score = int(brief.max_score * 0.45)
        feedback = "⚠️ Overengineered. All required services present but with extras."
    elif len(missing) == 1:
        correctness_score = int(brief.max_score * 0.35)
        feedback = f"❌ Almost there! Missing: {missing[0]}"
    elif len(missing) == 2:
        correctness_score = int(brief.max_score * 0.25)
        feedback = f"❌ Missing key services: {', '.join(missing)}"
    else:
        correctness_score = int(brief.max_score * 0.15)
        feedback = "❌ Architecture doesn't meet requirements."
    
    # Speed bonus
    speed_ratio = time_remaining / brief.time_limit if brief.time_limit > 0 else 0
    speed_bonus = int(brief.max_score * 0.20 * speed_ratio) if is_optimal or is_acceptable or len(missing) <= 1 else 0
    
    # Cost efficiency bonus
    cost_efficiency_bonus = int(brief.max_score * 0.10) if is_optimal else (int(brief.max_score * 0.05) if is_acceptable else 0)
    
    # Overengineering penalty
    overengineering_penalty = len(extra) * 5 if not is_optimal else 0
    
    # Trap penalty
    trap_services_used = []
    trap_penalty = 0
    trap_ids = {trap.service_id for trap in brief.trap_services}
    for svc in submitted_set:
        if svc in trap_ids:
            trap = next(t for t in brief.trap_services if t.service_id == svc)
            trap_services_used.append({
                "service_id": svc,
                "why_suboptimal": trap.why_suboptimal,
                "penalty": trap.penalty,
            })
            trap_penalty += trap.penalty
    
    # Requirements check (simplified - just check if optimal/acceptable)
    requirements_met = [req.category for req in brief.requirements] if is_optimal or is_acceptable else []
    requirements_missed = [] if is_optimal or is_acceptable else [req.category for req in brief.requirements if req.priority == "critical"]
    missed_requirement_penalty = len(requirements_missed) * 15
    
    final_score = max(0, correctness_score + speed_bonus + cost_efficiency_bonus - overengineering_penalty - trap_penalty - missed_requirement_penalty)
    percentage = (final_score / brief.max_score) * 100 if brief.max_score > 0 else 0
    
    if percentage >= 95: grade = "S"
    elif percentage >= 85: grade = "A"
    elif percentage >= 70: grade = "B"
    elif percentage >= 50: grade = "C"
    elif percentage >= 30: grade = "D"
    else: grade = "F"
    
    return DeployResult(
        grade=grade,
        score=final_score,
        max_score=brief.max_score,
        correctness_score=correctness_score,
        speed_bonus=speed_bonus,
        cost_efficiency_bonus=cost_efficiency_bonus,
        overengineering_penalty=overengineering_penalty,
        trap_penalty=trap_penalty,
        missed_requirement_penalty=missed_requirement_penalty,
        met_requirements=len(requirements_missed) == 0,
        is_optimal=is_optimal,
        is_acceptable=is_acceptable,
        requirements_met=requirements_met,
        requirements_missed=requirements_missed,
        trap_services_used=trap_services_used,
        missing_services=missing,
        extra_services=extra,
        feedback=feedback,
        optimal_solution=brief.optimal_solution,
        learning_point=brief.learning_point,
    )


def validate_deployment(
    brief: DeployBrief,
    submitted_services: List[str],
    time_remaining: int,
) -> DeployResult:
    """
    Synchronous wrapper for backward compatibility.
    Uses deterministic validation (no AI).
    For AI-powered validation, use validate_deployment_with_ai().
    """
    return validate_deployment_deterministic(brief, submitted_services, time_remaining)


# =============================================================================
# TEST
# =============================================================================

if __name__ == "__main__":
    import asyncio
    
    async def test():
        brief = await generate_deploy_brief(
            user_level="intermediate",
            cert_code="SAA-C03",
            # difficulty param deprecated - user_level drives everything
        )
        print(f"Client: {brief.icon} {brief.client_name} ({brief.industry})")
        print(f"Skill Level: {brief.user_level}")
        print(f"Time Limit: {brief.time_limit}s")
        print(f"\nRequirements:")
        for req in brief.requirements:
            print(f"  [{req.priority}] {req.category}: {req.description}")
        print(f"\nAvailable Services: {brief.available_services}")
        print(f"Optimal Solution: {brief.optimal_solution}")
        print(f"Acceptable Solutions: {brief.acceptable_solutions}")
        
        # Test validation
        result = validate_deployment(brief, brief.optimal_solution, 30)
        print(f"\nValidation (optimal): {result.feedback}")
        print(f"Score: {result.score}/{result.max_score}")
    
    asyncio.run(test())
