"""
Cloud Tycoon Game Generator
============================
Generates personalized business use cases with AWS service matching challenges.
Players travel a journey map, clicking on businesses and matching AWS services
to their use cases to earn contract money.
"""

import json
import uuid
from typing import List, Optional, Dict
from pydantic import BaseModel
from openai import AsyncOpenAI

from prompts import CERTIFICATION_PERSONAS
from utils import get_request_api_key, get_request_model, ApiKeyRequiredError


# =============================================================================
# DATA MODELS
# =============================================================================

class RequiredService(BaseModel):
    """An AWS service required for a use case"""
    service_id: str  # e.g., "s3", "lambda", "rds"
    service_name: str  # e.g., "Amazon S3"
    category: str  # e.g., "storage", "compute", "database"
    reason: str  # Why this service is needed for the use case


class BusinessUseCase(BaseModel):
    """A business use case that requires AWS services"""
    id: str
    business_name: str  # e.g., "MedFirst Clinic", "TechFlow Startup"
    industry: str  # e.g., "Healthcare", "E-commerce", "FinTech"
    icon: str  # Emoji for the business
    use_case_title: str  # Short title
    use_case_description: str  # The problem/requirement
    required_services: List[RequiredService]  # 2-5 services needed
    contract_value: int  # How much $ this contract is worth
    difficulty: str  # easy, medium, hard
    hints: List[str]  # Optional hints for the player
    compliance_requirements: Optional[List[str]] = None  # HIPAA, PCI-DSS, etc.


class TycoonJourney(BaseModel):
    """A complete Cloud Tycoon journey with 10 businesses"""
    id: str
    journey_name: str  # e.g., "Silicon Valley Sprint", "Healthcare Hub"
    theme: str  # Overall theme of the journey
    businesses: List[BusinessUseCase]
    total_contract_value: int
    difficulty_distribution: Dict[str, int]  # {"easy": 3, "medium": 4, "hard": 3}


# =============================================================================
# AWS SERVICES REFERENCE (for AI to pick from)
# =============================================================================

AWS_SERVICES_REFERENCE = """
Available AWS Services (use these exact IDs) with TYPICAL ANNUAL COSTS for mid-size deployments:

COMPUTE:
- ec2: Amazon EC2 - Virtual servers (~$15,000-50,000/year for production fleet)
- lambda: AWS Lambda - Serverless functions (~$2,000-20,000/year based on invocations)
- auto-scaling: Auto Scaling Group - Scale EC2 automatically (included with EC2)
- ecs: Amazon ECS - Container orchestration (~$20,000-60,000/year with Fargate)
- eks: Amazon EKS - Kubernetes (~$30,000-100,000/year including nodes)
- fargate: AWS Fargate - Serverless containers (~$25,000-80,000/year)

DATABASE:
- rds: Amazon RDS - Managed relational database (~$12,000-48,000/year)
- aurora: Amazon Aurora - High-performance MySQL/PostgreSQL (~$24,000-120,000/year)
- dynamodb: Amazon DynamoDB - NoSQL database (~$5,000-50,000/year based on capacity)
- elasticache: Amazon ElastiCache - In-memory caching (~$8,000-36,000/year)
- redshift: Amazon Redshift - Data warehouse (~$50,000-200,000/year)
- neptune: Amazon Neptune - Graph database (~$20,000-80,000/year)

STORAGE:
- s3: Amazon S3 - Object storage (~$1,000-30,000/year based on volume)
- efs: Amazon EFS - Elastic file system (~$3,000-24,000/year)
- ebs: Amazon EBS - Block storage (~$2,000-15,000/year)
- glacier: Amazon S3 Glacier - Archive storage (~$500-5,000/year)
- backup: AWS Backup - Centralized backup (~$2,000-12,000/year)

NETWORKING:
- vpc: Amazon VPC - Virtual private cloud (~$1,000-5,000/year for NAT/endpoints)
- alb: Application Load Balancer - HTTP/HTTPS load balancing (~$2,000-12,000/year)
- nlb: Network Load Balancer - TCP/UDP load balancing (~$2,000-10,000/year)
- cloudfront: Amazon CloudFront - CDN (~$5,000-50,000/year based on traffic)
- route53: Amazon Route 53 - DNS (~$500-2,000/year)
- api-gateway: Amazon API Gateway - API management (~$3,000-30,000/year)

SECURITY:
- iam: AWS IAM - Identity and access management (free)
- kms: AWS KMS - Key management (~$1,000-5,000/year)
- secrets-manager: AWS Secrets Manager - Secrets storage (~$500-3,000/year)
- waf: AWS WAF - Web application firewall (~$3,000-15,000/year)
- shield: AWS Shield - DDoS protection (~$36,000/year for Advanced)
- cognito: Amazon Cognito - User authentication (~$2,000-20,000/year based on MAU)
- guardduty: Amazon GuardDuty - Threat detection (~$3,000-15,000/year)

INTEGRATION:
- sqs: Amazon SQS - Message queuing (~$500-5,000/year)
- sns: Amazon SNS - Pub/sub messaging (~$500-3,000/year)
- eventbridge: Amazon EventBridge - Event bus (~$1,000-10,000/year)
- step-functions: AWS Step Functions - Workflow orchestration (~$2,000-15,000/year)

ANALYTICS:
- kinesis: Amazon Kinesis - Real-time streaming (~$10,000-60,000/year)
- athena: Amazon Athena - Query S3 with SQL (~$2,000-20,000/year)
- glue: AWS Glue - ETL service (~$5,000-40,000/year)
- quicksight: Amazon QuickSight - BI dashboards (~$3,000-30,000/year)

MANAGEMENT:
- cloudwatch: Amazon CloudWatch - Monitoring (~$2,000-15,000/year)
- cloudtrail: AWS CloudTrail - Audit logging (~$1,000-5,000/year)
- cloudformation: AWS CloudFormation - Infrastructure as code (free)

CONTRACT VALUE CALCULATION:
The contract_value should represent a realistic 1-YEAR consulting/implementation contract that includes:
1. Sum of annual AWS infrastructure costs for all required services
2. Add 30-50% for implementation, migration, and consulting fees
3. Add 10-20% for ongoing support and optimization

Example: If services cost ~$80,000/year in AWS spend, contract = $80,000 + 40% = $112,000
"""

# =============================================================================
# GENERATION PROMPT
# =============================================================================

CLOUD_TYCOON_PROMPT = """You are generating a Cloud Tycoon game journey for an AWS certification student.
The player travels a map visiting businesses, and must match the correct AWS services to each business's use case.

USER PROFILE:
- Skill Level: {user_level}
- Target Certification: {cert_name}
- Focus Areas: {focus_areas}

JOURNEY THEME: {theme}

Generate exactly 10 unique business use cases. Each business should:

1. BE REALISTIC AND SPECIFIC:
   - Real-world business scenarios
   - Clear technical requirements
   - Industry-appropriate challenges

2. REQUIRE 2-5 AWS SERVICES:
   - Services must logically solve the use case
   - Include a mix of categories (compute, storage, database, etc.)
   - Match the user's certification focus areas

3. SCALE DIFFICULTY:
   - 3 easy (2-3 obvious services)
   - 4 medium (3-4 services, some trade-offs)
   - 3 hard (4-5 services, nuanced choices)

4. CALCULATE REALISTIC CONTRACT VALUES:
   Use the AWS pricing data provided above to calculate:
   - Sum the typical annual costs for each required service
   - Add 35-45% for consulting, implementation, and migration fees
   - Add 15% for ongoing support
   
   Examples based on services:
   - Simple (Lambda + S3 + DynamoDB): ~$15K AWS + fees = $25,000-35,000
   - Medium (EC2 + RDS + ALB + S3 + CloudWatch): ~$50K AWS + fees = $75,000-100,000  
   - Complex (EKS + Aurora + ElastiCache + CloudFront + WAF): ~$150K AWS + fees = $220,000-280,000
   - Enterprise (Redshift + Kinesis + Glue + QuickSight + Shield): ~$250K+ AWS + fees = $400,000+

5. PROVIDE HELPFUL HINTS:
   - 2-3 hints per use case
   - Don't give away the answer directly

{services_reference}

Return JSON with this structure:
{{
  "journey_name": "Theme-based name",
  "theme": "Brief theme description",
  "businesses": [
    {{
      "id": "unique_id",
      "business_name": "Company Name",
      "industry": "Industry",
      "icon": "emoji",
      "use_case_title": "Short title",
      "use_case_description": "Detailed description of what they need (2-3 sentences)",
      "required_services": [
        {{
          "service_id": "exact_service_id",
          "service_name": "Full Service Name",
          "category": "category",
          "reason": "Why this service is needed"
        }}
      ],
      "contract_value": 250000,
      "difficulty": "easy|medium|hard",
      "hints": ["hint1", "hint2"],
      "compliance_requirements": ["HIPAA", "PCI-DSS"] // optional
    }}
  ]
}}
"""

# Journey themes for variety
JOURNEY_THEMES = [
    "Silicon Valley Startup Sprint",
    "Healthcare Innovation Hub",
    "FinTech Revolution",
    "E-Commerce Empire",
    "Media & Entertainment District",
    "Government & Public Sector",
    "Manufacturing 4.0",
    "Education Technology Campus",
    "Gaming & Esports Arena",
    "Sustainability & Green Tech",
]


# =============================================================================
# GENERATOR FUNCTIONS
# =============================================================================

async def _chat_json(
    messages: List[Dict],
    model: Optional[str] = None,
    api_key: Optional[str] = None
) -> Dict:
    """JSON chat completion with request-scoped key support."""
    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Please configure your API key in Settings."
        )
    
    model = model or get_request_model() or "gpt-4o"
    client = AsyncOpenAI(api_key=key)
    
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.9,  # Higher for variety in business scenarios
    )
    return json.loads(response.choices[0].message.content)


async def generate_tycoon_journey(
    # User context
    user_level: str = "intermediate",
    cert_code: Optional[str] = None,
    
    # Journey options
    theme: Optional[str] = None,  # If None, random theme selected
    
    # API config
    api_key: Optional[str] = None,
) -> TycoonJourney:
    """
    Generate a complete Cloud Tycoon journey with 10 business use cases.
    
    Args:
        user_level: User's skill level (beginner/intermediate/advanced/expert)
        cert_code: Target certification code (e.g., "SAA-C03", "DVA-C02")
        theme: Optional journey theme (random if not provided)
        api_key: Optional OpenAI API key
    
    Returns:
        TycoonJourney with 10 businesses to visit
    """
    import random
    
    # Select theme
    if not theme:
        theme = random.choice(JOURNEY_THEMES)
    
    # Build cert context
    cert_name = "AWS Cloud Practitioner"
    focus_areas = ["Core AWS Services", "Cloud Concepts", "Security", "Pricing"]
    
    if cert_code and cert_code in CERTIFICATION_PERSONAS:
        persona = CERTIFICATION_PERSONAS[cert_code]
        cert_name = persona.get("cert", cert_name)
        focus_areas = persona.get("focus", focus_areas)
    
    # Build the prompt
    system_prompt = CLOUD_TYCOON_PROMPT.format(
        user_level=user_level,
        cert_name=cert_name,
        focus_areas=", ".join(focus_areas),
        theme=theme,
        services_reference=AWS_SERVICES_REFERENCE,
    )
    
    user_prompt = f"""Generate a Cloud Tycoon journey with theme: "{theme}"

Target certification: {cert_name}
Skill level: {user_level}

Create 10 diverse, realistic business use cases that test AWS architecture knowledge.
Make the journey feel like a real consulting trip through different companies."""

    result = await _chat_json(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        api_key=api_key,
    )
    
    # Parse businesses
    businesses = []
    difficulty_counts = {"easy": 0, "medium": 0, "hard": 0}
    total_value = 0
    
    # Limit to exactly 10 businesses (AI sometimes returns more)
    raw_businesses = result.get("businesses", [])[:10]
    
    for biz in raw_businesses:
        difficulty = biz.get("difficulty", "medium")
        difficulty_counts[difficulty] = difficulty_counts.get(difficulty, 0) + 1
        contract_value = biz.get("contract_value", 200000)
        total_value += contract_value
        
        businesses.append(BusinessUseCase(
            id=biz.get("id", f"biz_{uuid.uuid4().hex[:8]}"),
            business_name=biz.get("business_name", "Unknown Corp"),
            industry=biz.get("industry", "Technology"),
            icon=biz.get("icon", "🏢"),
            use_case_title=biz.get("use_case_title", "Cloud Migration"),
            use_case_description=biz.get("use_case_description", ""),
            required_services=[
                RequiredService(
                    service_id=svc.get("service_id", ""),
                    service_name=svc.get("service_name", ""),
                    category=svc.get("category", ""),
                    reason=svc.get("reason", ""),
                )
                for svc in biz.get("required_services", [])
            ],
            contract_value=contract_value,
            difficulty=difficulty,
            hints=biz.get("hints", []),
            compliance_requirements=biz.get("compliance_requirements"),
        ))
    
    return TycoonJourney(
        id=f"journey_{uuid.uuid4().hex[:8]}",
        journey_name=result.get("journey_name", theme),
        theme=result.get("theme", theme),
        businesses=businesses,
        total_contract_value=total_value,
        difficulty_distribution=difficulty_counts,
    )


async def validate_service_match(
    use_case: BusinessUseCase,
    submitted_services: List[str],  # List of service_ids
) -> Dict:
    """
    Validate if the submitted services match the required services.
    
    Returns:
        {
            "correct": bool,
            "score": float (0-1),
            "matched": ["s3", "lambda"],
            "missing": ["rds"],
            "extra": ["ec2"],
            "contract_earned": int,
            "feedback": str
        }
    """
    required_ids = {svc.service_id for svc in use_case.required_services}
    submitted_set = set(submitted_services)
    
    matched = required_ids & submitted_set
    missing = required_ids - submitted_set
    extra = submitted_set - required_ids
    
    # Calculate score
    if len(required_ids) == 0:
        score = 0.0
    else:
        # Matched services count positively, extra services count negatively
        score = max(0, (len(matched) - len(extra) * 0.5) / len(required_ids))
    
    # Perfect match = full contract, partial = proportional
    contract_earned = int(use_case.contract_value * score)
    
    # Generate feedback
    if score == 1.0:
        feedback = f"🎉 Perfect match! You've won the ${use_case.contract_value:,} contract!"
    elif score >= 0.8:
        feedback = f"Great job! You matched most services. Contract: ${contract_earned:,}"
    elif score >= 0.5:
        feedback = f"Partial match. You're missing some key services. Contract: ${contract_earned:,}"
    else:
        feedback = f"This solution doesn't quite fit the requirements. Contract: ${contract_earned:,}"
    
    # Add specific feedback about missing services
    if missing:
        missing_names = [
            svc.service_name for svc in use_case.required_services 
            if svc.service_id in missing
        ]
        feedback += f"\n\nMissing: {', '.join(missing_names)}"
    
    return {
        "correct": score == 1.0,
        "score": score,
        "matched": list(matched),
        "missing": list(missing),
        "extra": list(extra),
        "contract_earned": contract_earned,
        "feedback": feedback,
        "required_services": [
            {
                "service_id": svc.service_id,
                "service_name": svc.service_name,
                "reason": svc.reason,
            }
            for svc in use_case.required_services
        ],
    }


# =============================================================================
# QUICK TEST
# =============================================================================

if __name__ == "__main__":
    import asyncio
    
    async def test():
        result = await generate_tycoon_journey(
            user_level="intermediate",
            cert_code="SAA-C03",
            theme="Healthcare Innovation Hub",
        )
        print(f"Journey: {result.journey_name}")
        print(f"Total Contract Value: ${result.total_contract_value:,}")
        print(f"Difficulty: {result.difficulty_distribution}")
        print(f"\nBusinesses:")
        for biz in result.businesses:
            print(f"  {biz.icon} {biz.business_name} ({biz.industry})")
            print(f"     {biz.use_case_title} - ${biz.contract_value:,}")
            print(f"     Services: {[s.service_id for s in biz.required_services]}")
    
    asyncio.run(test())
