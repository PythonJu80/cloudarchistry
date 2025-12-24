"""
Cloud Tycoon Game Generator
============================
Generates personalized business use cases with AWS service matching challenges.
Players travel a journey map, clicking on businesses and matching AWS services
to their use cases to earn contract money.
"""

import json
import os
import uuid
from typing import List, Optional, Dict
from pydantic import BaseModel
from openai import AsyncOpenAI

from prompts import CERTIFICATION_PERSONAS
from utils import get_request_model, ApiKeyRequiredError


# Valid user levels
VALID_USER_LEVELS = ["beginner", "intermediate", "advanced", "expert"]
VALID_CERT_CODES = list(CERTIFICATION_PERSONAS.keys())


class TycoonValidationError(Exception):
    """Raised when Cloud Tycoon generation parameters are invalid"""
    pass


def validate_tycoon_params(user_level: str, cert_code: str) -> None:
    """
    Validate that user_level and cert_code are provided and valid.
    
    Args:
        user_level: User skill level ('beginner', 'intermediate', 'advanced', 'expert')
        cert_code: AWS certification persona ID (e.g., 'solutions-architect-associate')
    
    Raises:
        TycoonValidationError: If parameters are missing or invalid
    """
    if not user_level:
        raise TycoonValidationError(
            "user_level is required. Cloud Tycoon journey must be user-level specific. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if not cert_code:
        raise TycoonValidationError(
            "cert_code is required. Cloud Tycoon journey must be certification-specific. "
            f"Valid cert codes: {', '.join(VALID_CERT_CODES)}"
        )
    
    if user_level not in VALID_USER_LEVELS:
        raise TycoonValidationError(
            f"Invalid user_level '{user_level}'. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if cert_code not in VALID_CERT_CODES:
        raise TycoonValidationError(
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
# VALID SERVICE IDS - Must match frontend aws-services.ts (95+ services)
# =============================================================================

VALID_SERVICE_IDS = {
    # Networking
    "vpc", "subnet-public", "subnet-private", "route-table", "nacl", "security-group",
    "internet-gateway", "nat-gateway", "vpc-peering", "transit-gateway", "alb", "nlb",
    "route53", "cloudfront", "global-accelerator", "vpn-gateway", "direct-connect",
    "privatelink", "elastic-ip",
    # Compute
    "ec2", "auto-scaling", "lambda", "ebs", "efs", "batch", "lightsail",
    # Containers
    "ecs", "eks", "fargate", "ecr",
    # Database
    "rds", "aurora", "dynamodb", "elasticache", "redshift", "neptune",
    "documentdb", "memorydb", "rds-replica",
    # Storage
    "s3", "glacier", "backup", "fsx", "storage-gateway", "datasync",
    # Security
    "iam", "kms", "secrets-manager", "cognito", "waf", "shield", "guardduty",
    "iam-role", "iam-policy", "permission-boundary", "acm", "inspector", "macie",
    "security-hub", "detective", "iam-user", "iam-group", "resource-policy",
    "trust-policy", "identity-provider", "iam-identity-center",
    # Integration
    "api-gateway", "eventbridge", "sns", "sqs", "step-functions", "appsync", "mq", "ses",
    # Management
    "cloudwatch", "cloudtrail", "systems-manager", "config", "xray",
    "cloudwatch-logs", "cloudwatch-alarms", "cloudformation", "health-dashboard", "trusted-advisor",
    # Analytics
    "kinesis-streams", "kinesis-firehose", "kinesis-analytics", "msk", "athena",
    "glue", "quicksight", "opensearch",
    # DevOps
    "codecommit", "codepipeline", "codebuild", "codedeploy", "codeartifact", "cloud9",
    # Governance
    "organizations", "scp", "control-tower", "service-catalog", "license-manager", "resource-groups",
    # Policies
    "s3-lifecycle-policy", "s3-bucket-policy", "iam-identity-policy", "iam-trust-policy",
    "resource-based-policy", "vpc-endpoint-policy", "backup-policy", "scaling-policy", "dlm-policy",
}

# =============================================================================
# AWS SERVICES REFERENCE (for AI to pick from)
# =============================================================================

AWS_SERVICES_REFERENCE = """
Available AWS Services (use these exact IDs). Pick services appropriate for the use case:

NETWORKING:
- vpc: Amazon VPC - Virtual private cloud
- subnet-public / subnet-private: Public/Private Subnets
- alb: Application Load Balancer - HTTP/HTTPS load balancing
- nlb: Network Load Balancer - TCP/UDP load balancing
- cloudfront: Amazon CloudFront - CDN
- route53: Amazon Route 53 - DNS
- api-gateway: Amazon API Gateway - API management
- nat-gateway: NAT Gateway - Outbound internet for private subnets
- internet-gateway: Internet Gateway - VPC internet access
- transit-gateway: Transit Gateway - Multi-VPC connectivity
- direct-connect: AWS Direct Connect - Dedicated network connection
- global-accelerator: AWS Global Accelerator - Global traffic management
- vpn-gateway: VPN Gateway - Site-to-site VPN
- privatelink: AWS PrivateLink - Private connectivity to services

COMPUTE:
- ec2: Amazon EC2 - Virtual servers
- lambda: AWS Lambda - Serverless functions
- auto-scaling: Auto Scaling Group - Scale EC2 automatically
- batch: AWS Batch - Batch computing
- lightsail: Amazon Lightsail - Simple VPS

CONTAINERS:
- ecs: Amazon ECS - Container orchestration
- eks: Amazon EKS - Kubernetes
- fargate: AWS Fargate - Serverless containers
- ecr: Amazon ECR - Container registry

DATABASE:
- rds: Amazon RDS - Managed relational database
- aurora: Amazon Aurora - High-performance MySQL/PostgreSQL
- dynamodb: Amazon DynamoDB - NoSQL database
- elasticache: Amazon ElastiCache - In-memory caching (Redis/Memcached)
- redshift: Amazon Redshift - Data warehouse
- neptune: Amazon Neptune - Graph database
- documentdb: Amazon DocumentDB - MongoDB-compatible
- memorydb: Amazon MemoryDB - Redis-compatible durable database

STORAGE:
- s3: Amazon S3 - Object storage
- efs: Amazon EFS - Elastic file system
- ebs: Amazon EBS - Block storage
- glacier: Amazon S3 Glacier - Archive storage
- backup: AWS Backup - Centralized backup
- fsx: Amazon FSx - Windows/Lustre file systems
- storage-gateway: AWS Storage Gateway - Hybrid storage
- datasync: AWS DataSync - Data transfer

SECURITY:
- iam: AWS IAM - Identity and access management
- iam-role: IAM Role - Service/cross-account access
- kms: AWS KMS - Key management
- secrets-manager: AWS Secrets Manager - Secrets storage
- waf: AWS WAF - Web application firewall
- shield: AWS Shield - DDoS protection
- cognito: Amazon Cognito - User authentication
- guardduty: Amazon GuardDuty - Threat detection
- inspector: Amazon Inspector - Vulnerability scanning
- macie: Amazon Macie - S3 data security
- security-hub: AWS Security Hub - Security posture
- acm: AWS Certificate Manager - SSL/TLS certificates
- iam-identity-center: IAM Identity Center - SSO

INTEGRATION:
- sqs: Amazon SQS - Message queuing
- sns: Amazon SNS - Pub/sub messaging
- eventbridge: Amazon EventBridge - Event bus
- step-functions: AWS Step Functions - Workflow orchestration
- appsync: AWS AppSync - GraphQL API
- mq: Amazon MQ - Message broker (ActiveMQ/RabbitMQ)
- ses: Amazon SES - Email service

ANALYTICS:
- kinesis-streams: Amazon Kinesis Data Streams - Real-time streaming
- kinesis-firehose: Amazon Kinesis Firehose - Data delivery
- athena: Amazon Athena - Query S3 with SQL
- glue: AWS Glue - ETL service
- quicksight: Amazon QuickSight - BI dashboards
- opensearch: Amazon OpenSearch - Search and analytics
- msk: Amazon MSK - Managed Kafka

MANAGEMENT:
- cloudwatch: Amazon CloudWatch - Monitoring
- cloudwatch-logs: CloudWatch Logs - Log management
- cloudwatch-alarms: CloudWatch Alarms - Alerting
- cloudtrail: AWS CloudTrail - Audit logging
- cloudformation: AWS CloudFormation - Infrastructure as code
- systems-manager: AWS Systems Manager - Operations management
- config: AWS Config - Resource compliance
- xray: AWS X-Ray - Distributed tracing
- trusted-advisor: AWS Trusted Advisor - Best practices

DEVOPS:
- codepipeline: AWS CodePipeline - CI/CD pipeline
- codebuild: AWS CodeBuild - Build service
- codedeploy: AWS CodeDeploy - Deployment automation
- codecommit: AWS CodeCommit - Git repository
- codeartifact: AWS CodeArtifact - Artifact repository

GOVERNANCE:
- organizations: AWS Organizations - Multi-account management
- scp: Service Control Policy - Organization policies
- control-tower: AWS Control Tower - Landing zone
- service-catalog: AWS Service Catalog - Approved products

CONTRACT VALUE CALCULATION:
The contract_value should represent a realistic 1-YEAR consulting/implementation contract.
Base it on complexity: Easy ($50K-150K), Medium ($150K-400K), Hard ($400K-800K).
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

CRITICAL: Generate EXACTLY 10 business use cases. Not 9, not 11 - exactly 10.
The game map has exactly 10 waypoints and will break if you return more or fewer.

Each business should:

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
    """JSON chat completion with .env only."""
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Set OPENAI_API_KEY in .env file."
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
    user_level: str,
    cert_code: str,
    theme: Optional[str] = None,
    api_key: Optional[str] = None,
) -> TycoonJourney:
    """
    Generate a complete Cloud Tycoon journey with 10 business use cases.
    
    IMPORTANT: Both user_level and cert_code are REQUIRED.
    Each journey must be certification-specific and user-level specific.
    
    Args:
        user_level: User's skill level (REQUIRED: 'beginner', 'intermediate', 'advanced', 'expert')
        cert_code: Certification persona ID (REQUIRED, e.g., 'solutions-architect-associate')
        theme: Optional journey theme (random if not provided)
        api_key: Optional OpenAI API key
    
    Returns:
        TycoonJourney with 10 businesses tailored to cert and level
    
    Raises:
        TycoonValidationError: If user_level or cert_code are missing/invalid
    """
    
    # Normalize cert_code: Convert database format (SAA-C03) to persona ID (solutions-architect-associate)
    if cert_code and cert_code in CERT_CODE_TO_PERSONA:
        cert_code = CERT_CODE_TO_PERSONA[cert_code]
    
    # CRITICAL: Validate required parameters
    validate_tycoon_params(user_level, cert_code)
    import random
    
    # Select theme
    if not theme:
        theme = random.choice(JOURNEY_THEMES)
    
    # Get certification context (cert_code is now required and validated)
    if cert_code not in CERTIFICATION_PERSONAS:
        raise TycoonValidationError(f"Unknown certification persona: {cert_code}")
    
    persona = CERTIFICATION_PERSONAS[cert_code]
    cert_name = persona["cert"]
    focus_areas = persona["focus"]
    
    # Fetch current AWS knowledge from database
    from utils import fetch_knowledge_for_generation
    knowledge_context = await fetch_knowledge_for_generation(
        cert_code=cert_code,
        topic=f"{theme} AWS architecture {' '.join(focus_areas[:2])}",
        limit=5,
        api_key=api_key
    )
    
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

{knowledge_context}

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
        
        # Filter and validate required services - only keep valid IDs
        valid_services = []
        for svc in biz.get("required_services", []):
            service_id = svc.get("service_id", "").lower().strip()
            if service_id in VALID_SERVICE_IDS:
                valid_services.append(RequiredService(
                    service_id=service_id,
                    service_name=svc.get("service_name", ""),
                    category=svc.get("category", ""),
                    reason=svc.get("reason", ""),
                ))
        
        # Skip businesses with no valid services
        if not valid_services:
            continue
            
        businesses.append(BusinessUseCase(
            id=biz.get("id", f"biz_{uuid.uuid4().hex[:8]}"),
            business_name=biz.get("business_name", "Unknown Corp"),
            industry=biz.get("industry", "Technology"),
            icon=biz.get("icon", "🏢"),
            use_case_title=biz.get("use_case_title", "Cloud Migration"),
            use_case_description=biz.get("use_case_description", ""),
            required_services=valid_services,
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
    cert_code: Optional[str] = None,
    user_level: Optional[str] = None,
) -> Dict:
    """
    Validate if the submitted services match the required services.
    Provides certification-specific and skill-level appropriate feedback.
    Returns match percentage, missing services, and extra services.
    
    Args:
        use_case: BusinessUseCase to validate against
        submitted_services: List of service_ids submitted by the user
        cert_code: Optional certification code for personalized feedback
        user_level: Optional user skill level for personalized feedback
    
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
    
    # Generate feedback with certification and skill level context
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
    
    # Add certification-specific guidance if cert_code provided
    if cert_code:
        from prompts import CERTIFICATION_PERSONAS
        if cert_code in CERTIFICATION_PERSONAS:
            persona = CERTIFICATION_PERSONAS[cert_code]
            feedback += f"\n\n💡 {persona['cert']} Focus: Consider how this architecture aligns with {persona['focus'][0]} best practices."
    
    # Add skill-level appropriate guidance if user_level provided
    if user_level and missing:
        skill_guidance = {
            "beginner": "💭 Tip: Review the use case requirements carefully and match each requirement to a specific AWS service.",
            "intermediate": "💭 Tip: Think about which AWS services best address scalability, security, and cost optimization for this use case.",
            "advanced": "💭 Tip: Consider service integration patterns and how missing services impact the overall architecture's resilience.",
            "expert": "💭 Tip: Evaluate the architectural trade-offs and compliance implications of the missing services."
        }
        if user_level in skill_guidance:
            feedback += f"\n\n{skill_guidance[user_level]}"
    
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
