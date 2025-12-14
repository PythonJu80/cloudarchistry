"""
Speed Deploy Game Generator
==============================
Generates architecture deployment challenges where players must select
the correct AWS services to meet client requirements under time pressure.

Players see a client brief with requirements and constraints, then
select services from a palette to build the architecture.
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


class DeployBrief(BaseModel):
    """A client deployment brief - the challenge"""
    id: str
    client_name: str
    industry: str
    icon: str
    requirements: List[ClientRequirement]
    available_services: List[str]  # 10-14 service IDs to choose from
    optimal_solution: List[str]  # The "best" answer (3-6 services)
    acceptable_solutions: List[List[str]]  # Other valid solutions
    time_limit: int  # seconds (45-60)
    difficulty: str
    max_score: int


class DeployResult(BaseModel):
    """Result of validating a deployment"""
    met_requirements: bool
    is_optimal: bool
    is_acceptable: bool
    score: int
    max_score: int
    speed_bonus: int
    overengineering_penalty: int
    missing_services: List[str]
    extra_services: List[str]
    feedback: str
    optimal_solution: List[str]
    requirement_analysis: List[Dict]  # Which requirements were met/missed


# =============================================================================
# GENERATION PROMPT
# =============================================================================

SPEED_DEPLOY_PROMPT = """You are generating a Speed Deploy challenge for an AWS certification student.
The player sees a client brief with requirements and must quickly select the right AWS services.

USER PROFILE:
- Skill Level: {user_level}
- Target Certification: {cert_name}
- Focus Areas: {focus_areas}

Generate a realistic client deployment scenario that tests architectural decision-making.

RULES:
1. Create a believable client with specific technical requirements
2. Requirements should cover multiple categories (traffic, latency, cost, availability, compliance, data)
3. The optimal solution should use 3-6 AWS services
4. Include 1-2 acceptable alternative solutions
5. Provide 10-14 services in the palette (including optimal + some distractors)
6. Distractors should be plausible but suboptimal choices

DIFFICULTY LEVELS:
- easy: Clear requirements, obvious optimal solution, few distractors
- medium: Some trade-offs, multiple valid approaches, more distractors
- hard: Ambiguous requirements, cost vs performance tension, subtle optimal choice

REQUIREMENT CATEGORIES:
- traffic: Request volume, scaling needs
- latency: Response time requirements
- cost: Budget constraints, optimization needs
- availability: Uptime, disaster recovery, multi-region
- compliance: HIPAA, PCI-DSS, SOC2, GDPR
- data: Storage, processing, analytics needs

{services_reference}

Return JSON:
{{
  "client_name": "TechFlow Startup",
  "industry": "FinTech",
  "icon": "💳",
  "requirements": [
    {{"category": "traffic", "description": "Handle 50K requests/second during peak", "priority": "critical"}},
    {{"category": "latency", "description": "Sub-100ms response time for API calls", "priority": "critical"}},
    {{"category": "compliance", "description": "PCI-DSS compliant for payment data", "priority": "critical"}},
    {{"category": "cost", "description": "Minimize costs during off-peak hours", "priority": "important"}},
    {{"category": "availability", "description": "99.9% uptime SLA", "priority": "important"}}
  ],
  "available_services": ["lambda", "api-gateway", "dynamodb", "rds", "elasticache", "cloudfront", "waf", "kms", "ec2", "auto-scaling", "alb", "s3", "sqs", "sns"],
  "optimal_solution": ["api-gateway", "lambda", "dynamodb", "elasticache", "waf", "kms"],
  "acceptable_solutions": [
    ["alb", "ec2", "auto-scaling", "rds", "elasticache", "waf", "kms"],
    ["api-gateway", "lambda", "rds", "elasticache", "waf", "kms"]
  ],
  "time_limit": 60,
  "difficulty": "medium",
  "max_score": 100
}}

IMPORTANT:
- All service IDs must be from the valid list provided
- optimal_solution should be the BEST choice for the requirements
- acceptable_solutions should WORK but be suboptimal (more expensive, slower, etc.)
- available_services must include all services from optimal + acceptable + some distractors
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
    
    # Random difficulty if not specified
    if not difficulty:
        weights = {"easy": 0.3, "medium": 0.5, "hard": 0.2}
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
        services_reference=AWS_SERVICES_REFERENCE,
    )
    
    user_prompt = f"""Generate a {difficulty} difficulty Speed Deploy challenge.

Target certification: {cert_name}
Skill level: {user_level}
Scenario theme: {theme}

Create a realistic client brief that tests architectural decision-making.
Focus on patterns relevant to {cert_name} certification."""

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
    
    # Time limit based on difficulty
    time_limits = {"easy": 60, "medium": 50, "hard": 45}
    time_limit = result.get("time_limit", time_limits.get(difficulty, 60))
    
    # Max score based on difficulty
    max_scores = {"easy": 100, "medium": 150, "hard": 200}
    max_score = result.get("max_score", max_scores.get(difficulty, 100))
    
    return DeployBrief(
        id=f"deploy_{uuid.uuid4().hex[:8]}",
        client_name=result.get("client_name", "Client Corp"),
        industry=result.get("industry", "Technology"),
        icon=result.get("icon", "🏢"),
        requirements=requirements,
        available_services=available[:14],  # Cap at 14
        optimal_solution=optimal,
        acceptable_solutions=acceptable,
        time_limit=time_limit,
        difficulty=difficulty,
        max_score=max_score,
    )


def validate_deployment(
    brief: DeployBrief,
    submitted_services: List[str],
    time_remaining: int,
) -> DeployResult:
    """
    Validate a player's deployment against the brief requirements.
    
    Args:
        brief: The deployment brief
        submitted_services: Services the player selected
        time_remaining: Seconds remaining when they submitted
    
    Returns:
        DeployResult with score and feedback
    """
    submitted_set = set(s.lower().strip() for s in submitted_services)
    optimal_set = set(brief.optimal_solution)
    
    # Check if it matches optimal
    is_optimal = submitted_set == optimal_set
    
    # Check if it matches any acceptable solution
    is_acceptable = False
    for acceptable in brief.acceptable_solutions:
        if submitted_set == set(acceptable):
            is_acceptable = True
            break
    
    # Calculate what's missing/extra compared to optimal
    missing = list(optimal_set - submitted_set)
    extra = list(submitted_set - optimal_set)
    
    # Base score calculation
    if is_optimal:
        base_score = brief.max_score
        feedback = "🎯 Perfect architecture! You selected the optimal solution."
    elif is_acceptable:
        base_score = int(brief.max_score * 0.75)
        feedback = "✅ Good architecture! This solution works but isn't optimal."
    elif len(missing) == 0:
        # Has all required services but some extra
        base_score = int(brief.max_score * 0.6)
        feedback = "⚠️ Overengineered. You have all required services but added unnecessary ones."
    elif len(missing) <= 2:
        # Missing a few services
        base_score = int(brief.max_score * 0.4)
        feedback = f"❌ Missing key services: {', '.join(missing)}"
    else:
        # Missing too many
        base_score = int(brief.max_score * 0.2)
        feedback = "❌ This architecture doesn't meet the requirements."
    
    # Speed bonus (up to 25% of max score)
    speed_ratio = time_remaining / brief.time_limit
    speed_bonus = int(brief.max_score * 0.25 * speed_ratio) if is_optimal or is_acceptable else 0
    
    # Overengineering penalty
    overengineering_penalty = len(extra) * 5 if not is_optimal else 0
    
    # Final score
    final_score = max(0, base_score + speed_bonus - overengineering_penalty)
    
    # Analyze requirements - map services to requirement categories
    # This maps common AWS services to the requirement categories they address
    SERVICE_CATEGORY_MAP = {
        # Traffic/Scaling
        "auto-scaling": ["traffic", "availability"],
        "alb": ["traffic", "availability"],
        "nlb": ["traffic", "availability"],
        "cloudfront": ["traffic", "latency"],
        "api-gateway": ["traffic", "latency"],
        "lambda": ["traffic", "cost"],
        "ecs": ["traffic"],
        "eks": ["traffic"],
        "ec2": ["traffic"],
        
        # Latency
        "elasticache": ["latency", "data"],
        "dynamodb": ["latency", "data", "availability"],
        "global-accelerator": ["latency"],
        
        # Cost
        "s3": ["cost", "data"],
        "glacier": ["cost", "data"],
        "spot-instances": ["cost"],
        
        # Availability/DR
        "route53": ["availability", "latency"],
        "rds": ["data", "availability"],
        "aurora": ["data", "availability"],
        "multi-az": ["availability"],
        
        # Compliance/Security
        "waf": ["compliance", "traffic"],
        "shield": ["compliance", "traffic"],
        "kms": ["compliance", "data"],
        "secrets-manager": ["compliance"],
        "cognito": ["compliance"],
        "iam": ["compliance"],
        "guardduty": ["compliance"],
        "macie": ["compliance", "data"],
        "config": ["compliance"],
        
        # Data
        "kinesis": ["data", "traffic"],
        "kinesis-streams": ["data", "traffic"],
        "sqs": ["data", "availability"],
        "sns": ["data"],
        "athena": ["data", "cost"],
        "redshift": ["data"],
        "glue": ["data"],
        "emr": ["data"],
    }
    
    requirement_analysis = []
    for req in brief.requirements:
        # Check if any submitted service addresses this requirement category
        category_services = [svc for svc, cats in SERVICE_CATEGORY_MAP.items() 
                           if req.category in cats and svc in submitted_set]
        
        # Check optimal services for this category
        optimal_for_category = [svc for svc, cats in SERVICE_CATEGORY_MAP.items() 
                               if req.category in cats and svc in optimal_set]
        
        # Check which optimal services for this category are missing
        missing_for_category = [svc for svc in optimal_for_category if svc not in submitted_set]
        
        # Requirement is fully met only if:
        # 1. We match optimal/acceptable solution, OR
        # 2. We have ALL the optimal services for this category (not just some)
        if is_optimal or is_acceptable:
            met = True
            status = "optimal"
        elif len(missing_for_category) == 0 and len(optimal_for_category) > 0:
            # Have all optimal services for this category
            met = True
            status = "complete"
        elif len(category_services) > 0 and len(missing_for_category) > 0:
            # Have some but not all
            met = False
            status = "partial"
        elif len(category_services) > 0:
            # Have some services but optimal doesn't specify any for this category
            met = True
            status = "covered"
        else:
            # No services for this category
            met = False
            status = "missing"
        
        requirement_analysis.append({
            "category": req.category,
            "description": req.description,
            "priority": req.priority,
            "met": met,
            "status": status,
            "your_services": category_services,
            "recommended": optimal_for_category,
            "missing": missing_for_category,
        })
    
    return DeployResult(
        met_requirements=is_optimal or is_acceptable or len(missing) == 0,
        is_optimal=is_optimal,
        is_acceptable=is_acceptable,
        score=final_score,
        max_score=brief.max_score,
        speed_bonus=speed_bonus,
        overengineering_penalty=overengineering_penalty,
        missing_services=missing,
        extra_services=extra,
        feedback=feedback,
        optimal_solution=brief.optimal_solution,
        requirement_analysis=requirement_analysis,
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
