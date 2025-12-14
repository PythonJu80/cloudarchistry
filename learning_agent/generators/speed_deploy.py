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

Difficulty scaling:
- Beginner: Clear requirements, obvious optimal solution
- Intermediate: Multiple valid solutions, optimization matters
- Pro: Ambiguous requirements, cost vs latency tension, constraint traps
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
    time_limit: int  # seconds (45-90 based on difficulty)
    difficulty: str  # beginner, intermediate, pro
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

DIFFICULTY: {difficulty}

DIFFICULTY RULES:
- beginner: Clear requirements, obvious optimal solution, 10 services in palette, no traps
- intermediate: Multiple valid solutions, optimization matters, 12 services, 1-2 traps
- pro: Ambiguous requirements, cost vs latency tension, 14 services, 2-3 traps, hidden constraints

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
7. Time limits: beginner=90s, intermediate=60s, pro=45s
"""


# =============================================================================
# GENERATOR FUNCTIONS
# =============================================================================

async def generate_deploy_brief(
    user_level: str = "intermediate",
    cert_code: Optional[str] = None,
    difficulty: Optional[str] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> DeployBrief:
    """
    Generate a Speed Deploy challenge brief.
    
    Args:
        user_level: User's skill level
        cert_code: Target certification code
        difficulty: Optional difficulty override (random if not provided)
        api_key: OpenAI API key
        model: Preferred model
    
    Returns:
        DeployBrief with client requirements and service palette
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
    
    # Map difficulty names (support both old and new naming)
    difficulty_map = {"easy": "beginner", "medium": "intermediate", "hard": "pro"}
    if difficulty in difficulty_map:
        difficulty = difficulty_map[difficulty]
    
    # Random difficulty if not specified
    if not difficulty:
        weights = {"beginner": 0.3, "intermediate": 0.5, "pro": 0.2}
        difficulty = random.choices(
            list(weights.keys()), 
            weights=list(weights.values())
        )[0]
    
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
    
    # Build prompt
    system_prompt = SPEED_DEPLOY_PROMPT.format(
        user_level=user_level,
        cert_name=cert_name,
        focus_areas=", ".join(focus_areas),
        difficulty=difficulty,
        services_reference=AWS_SERVICES_REFERENCE,
    )
    
    user_prompt = f"""Generate a {difficulty} difficulty Speed Deploy challenge.

Target certification: {cert_name}
Skill level: {user_level}
Scenario theme: {theme}

Create a realistic client brief that tests architectural TRADEOFFS, not memorization.
Focus on patterns relevant to {cert_name} certification.

Remember:
- {difficulty} difficulty rules apply
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
    
    # Time limit based on difficulty (beginner=90s, intermediate=60s, pro=45s)
    time_limits = {"beginner": 90, "intermediate": 60, "pro": 45}
    time_limit = result.get("time_limit", time_limits.get(difficulty, 60))
    
    # Max score based on difficulty
    max_scores = {"beginner": 100, "intermediate": 150, "pro": 200}
    max_score = result.get("max_score", max_scores.get(difficulty, 100))
    
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
        difficulty=difficulty,
        max_score=max_score,
        learning_point=learning_point,
    )


def validate_deployment(
    brief: DeployBrief,
    submitted_services: List[str],
    time_remaining: int,
) -> DeployResult:
    """
    Validate a player's deployment with GRADED scoring (not pass/fail).
    
    Scoring model:
    - Correctness (base score) - mandatory
    - Speed bonus - faster = more points
    - Cost efficiency bonus - if using cost-optimal solution
    - Overengineering penalty - unnecessary services
    - Trap penalty - using suboptimal services
    - Missed requirement penalty - missing critical requirements
    
    Grades: S (95%+), A (85%+), B (70%+), C (50%+), D (30%+), F (<30%)
    """
    submitted_set = set(s.lower().strip() for s in submitted_services)
    optimal_set = set(brief.optimal_solution)
    
    # Check if it matches optimal
    is_optimal = submitted_set == optimal_set
    
    # Check if it matches any acceptable solution
    is_acceptable = False
    matched_acceptable = None
    for acceptable in brief.acceptable_solutions:
        if submitted_set == set(acceptable):
            is_acceptable = True
            matched_acceptable = acceptable
            break
    
    # Calculate what's missing/extra compared to optimal
    missing = list(optimal_set - submitted_set)
    extra = list(submitted_set - optimal_set)
    
    # =========================================================================
    # SCORING BREAKDOWN
    # =========================================================================
    
    # 1. CORRECTNESS SCORE (base: 0-60% of max)
    if is_optimal:
        correctness_score = int(brief.max_score * 0.60)
        feedback = "🎯 Perfect architecture! Optimal solution selected."
    elif is_acceptable:
        correctness_score = int(brief.max_score * 0.50)
        feedback = "✅ Valid architecture. Works but not optimal."
    elif len(missing) == 0:
        # Has all optimal services but some extra
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
    
    # 2. SPEED BONUS (up to 20% of max)
    speed_ratio = time_remaining / brief.time_limit if brief.time_limit > 0 else 0
    if is_optimal or is_acceptable or len(missing) <= 1:
        speed_bonus = int(brief.max_score * 0.20 * speed_ratio)
    else:
        speed_bonus = 0  # No speed bonus for bad solutions
    
    # 3. COST EFFICIENCY BONUS (up to 10% of max)
    # Optimal solution is assumed to be cost-optimal
    if is_optimal:
        cost_efficiency_bonus = int(brief.max_score * 0.10)
    elif is_acceptable:
        cost_efficiency_bonus = int(brief.max_score * 0.05)
    else:
        cost_efficiency_bonus = 0
    
    # 4. OVERENGINEERING PENALTY (5 points per extra service)
    overengineering_penalty = len(extra) * 5 if not is_optimal else 0
    
    # 5. TRAP PENALTY - check if they used any trap services
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
    
    # 6. MISSED REQUIREMENT PENALTY (critical = 15pts, important = 8pts)
    requirements_met = []
    requirements_missed = []
    missed_requirement_penalty = 0
    
    # Simple check: if missing services, check which requirement categories are affected
    SERVICE_CATEGORY_MAP = {
        "auto-scaling": ["traffic", "availability"], "alb": ["traffic", "availability"],
        "cloudfront": ["traffic", "latency"], "api-gateway": ["traffic", "latency"],
        "lambda": ["traffic", "cost"], "ec2": ["traffic"], "ecs": ["traffic"], "fargate": ["traffic"],
        "elasticache": ["latency", "data"], "dynamodb": ["latency", "data", "availability"],
        "s3": ["cost", "data"], "rds": ["data", "availability"], "aurora": ["data", "availability"],
        "waf": ["compliance", "traffic"], "kms": ["compliance", "data"],
        "cognito": ["compliance"], "shield": ["compliance"],
        "route53": ["availability"], "sqs": ["data", "availability"],
    }
    
    for req in brief.requirements:
        # Check if any submitted service covers this category
        covered = any(
            req.category in SERVICE_CATEGORY_MAP.get(svc, [])
            for svc in submitted_set
        )
        if covered or is_optimal or is_acceptable:
            requirements_met.append(req.category)
        else:
            requirements_missed.append(req.category)
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
    
    # Calculate percentage for grade
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
    
    # Build learning point
    learning_point = brief.learning_point
    if trap_services_used:
        learning_point = trap_services_used[0]["why_suboptimal"]
    
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
        learning_point=learning_point,
    )


# =============================================================================
# TEST
# =============================================================================

if __name__ == "__main__":
    import asyncio
    
    async def test():
        brief = await generate_deploy_brief(
            user_level="intermediate",
            cert_code="SAA-C03",
            difficulty="medium",
        )
        print(f"Client: {brief.icon} {brief.client_name} ({brief.industry})")
        print(f"Difficulty: {brief.difficulty}")
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
