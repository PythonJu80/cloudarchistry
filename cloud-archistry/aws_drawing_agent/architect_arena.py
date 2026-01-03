"""
Architect Arena Puzzle Generator for Drawing Agent
===================================================
Generates AI-powered architecture puzzles where users must assemble
AWS service "pieces" into a correct architecture diagram.

This is the Drawing Agent version - uses the local knowledge base
and AWS service mappings for accurate service names.
"""

import json
import uuid
import logging
from typing import List, Optional, Dict, Any, Set
from pydantic import BaseModel
from openai import OpenAI

from aws_service_url_mapping import AWS_SERVICE_URL_MAPPING

logger = logging.getLogger(__name__)

# AWS Boundaries - organizational containers
AWS_BOUNDARIES: Dict[str, str] = {
    "aws-cloud": "AWS Cloud",
    "region": "Region",
    "availability-zone": "Availability Zone",
}

# General Icons - external actors for architecture diagrams
GENERAL_ICONS: Dict[str, str] = {
    "icon-user": "User",
    "icon-users": "Users",
    "icon-mobile": "Mobile",
    "icon-laptop": "Laptop",
    "icon-desktop": "Desktop",
    "icon-internet": "Internet",
    "icon-cloud": "Cloud",
    "icon-corporate": "Corporate",
    "icon-onprem": "On-Premises",
    "icon-server": "Server",
    "icon-database": "Database",
    "icon-security": "Security",
}

# AWS Service short names - the canonical display names
AWS_SERVICE_SHORT_NAMES: Dict[str, str] = {
    # Networking
    "vpc": "VPC",
    "subnet-public": "Public Subnet",
    "subnet-private": "Private Subnet",
    "route-table": "Route Table",
    "nacl": "NACL",
    "security-group": "Security Group",
    "internet-gateway": "Internet Gateway",
    "nat-gateway": "NAT Gateway",
    "vpc-peering": "VPC Peering",
    "transit-gateway": "Transit Gateway",
    "alb": "ALB",
    "nlb": "NLB",
    "route53": "Route 53",
    "cloudfront": "CloudFront",
    "global-accelerator": "Global Accelerator",
    "vpn-gateway": "VPN Gateway",
    "direct-connect": "Direct Connect",
    "privatelink": "PrivateLink",
    "elastic-ip": "Elastic IP",
    
    # Compute
    "ec2": "EC2",
    "auto-scaling": "Auto Scaling",
    "lambda": "Lambda",
    "elastic-beanstalk": "Elastic Beanstalk",
    "lightsail": "Lightsail",
    "batch": "Batch",
    
    # Containers
    "ecs": "ECS",
    "eks": "EKS",
    "fargate": "Fargate",
    "ecr": "ECR",
    
    # Storage
    "s3": "S3",
    "ebs": "EBS",
    "efs": "EFS",
    "fsx": "FSx",
    "glacier": "Glacier",
    "backup": "AWS Backup",
    "storage-gateway": "Storage Gateway",
    "datasync": "DataSync",
    
    # Database
    "rds": "RDS",
    "aurora": "Aurora",
    "dynamodb": "DynamoDB",
    "elasticache": "ElastiCache",
    "redshift": "Redshift",
    "neptune": "Neptune",
    "documentdb": "DocumentDB",
    "memorydb": "MemoryDB",
    
    # Security
    "iam": "IAM",
    "iam-role": "IAM Role",
    "iam-policy": "IAM Policy",
    "kms": "KMS",
    "secrets-manager": "Secrets Manager",
    "cognito": "Cognito",
    "waf": "WAF",
    "shield": "Shield",
    "guardduty": "GuardDuty",
    "inspector": "Inspector",
    "macie": "Macie",
    "security-hub": "Security Hub",
    "acm": "ACM",
    
    # Management
    "cloudwatch": "CloudWatch",
    "cloudwatch-logs": "CloudWatch Logs",
    "cloudtrail": "CloudTrail",
    "systems-manager": "Systems Manager",
    "config": "AWS Config",
    "cloudformation": "CloudFormation",
    "organizations": "Organizations",
    "xray": "X-Ray",
    
    # Integration
    "api-gateway": "API Gateway",
    "eventbridge": "EventBridge",
    "sns": "SNS",
    "sqs": "SQS",
    "step-functions": "Step Functions",
    "appsync": "AppSync",
    "mq": "Amazon MQ",
    "ses": "SES",
    
    # Analytics
    "athena": "Athena",
    "glue": "Glue",
    "emr": "EMR",
    "kinesis-streams": "Kinesis Streams",
    "kinesis-firehose": "Kinesis Firehose",
    "msk": "MSK",
    "quicksight": "QuickSight",
    "opensearch": "OpenSearch",
}

# Service categories for grouping in the puzzle panel
SERVICE_CATEGORIES: Dict[str, str] = {
    # AWS Boundaries
    "aws-cloud": "boundaries",
    "region": "boundaries",
    "availability-zone": "boundaries",
    # General Icons
    "icon-user": "actors",
    "icon-users": "actors",
    "icon-mobile": "actors",
    "icon-laptop": "actors",
    "icon-desktop": "actors",
    "icon-internet": "actors",
    "icon-cloud": "actors",
    "icon-corporate": "actors",
    "icon-onprem": "actors",
    "icon-server": "actors",
    "icon-database": "actors",
    "icon-security": "actors",
    # Services
    "vpc": "networking",
    "subnet-public": "networking",
    "subnet-private": "networking",
    "route-table": "networking",
    "nacl": "networking",
    "security-group": "security",
    "internet-gateway": "networking",
    "nat-gateway": "networking",
    "alb": "networking",
    "nlb": "networking",
    "route53": "networking",
    "cloudfront": "networking",
    "ec2": "compute",
    "auto-scaling": "compute",
    "lambda": "compute",
    "batch": "compute",
    "ecs": "containers",
    "eks": "containers",
    "fargate": "containers",
    "ecr": "containers",
    "s3": "storage",
    "ebs": "storage",
    "efs": "storage",
    "glacier": "storage",
    "rds": "database",
    "aurora": "database",
    "dynamodb": "database",
    "elasticache": "database",
    "redshift": "database",
    "neptune": "database",
    "documentdb": "database",
    "iam": "security",
    "kms": "security",
    "secrets-manager": "security",
    "cognito": "security",
    "waf": "security",
    "shield": "security",
    "guardduty": "security",
    "cloudwatch": "management",
    "cloudtrail": "management",
    "config": "management",
    "xray": "management",
    "api-gateway": "integration",
    "eventbridge": "integration",
    "sns": "integration",
    "sqs": "integration",
    "step-functions": "integration",
    "athena": "analytics",
    "glue": "analytics",
    "kinesis-streams": "analytics",
    "kinesis-firehose": "analytics",
}

# Certification personas for puzzle generation
CERTIFICATION_PERSONAS = {
    "cloud-practitioner": {
        "cert": "AWS Certified Cloud Practitioner",
        "focus": ["core services", "cloud concepts", "billing", "security basics"],
        "piece_modifier": 0.5,  # Fewer pieces for beginners
    },
    "solutions-architect-associate": {
        "cert": "AWS Certified Solutions Architect – Associate",
        "focus": ["high availability", "cost optimization", "security", "networking"],
        "piece_modifier": 1.0,
    },
    "developer-associate": {
        "cert": "AWS Certified Developer – Associate",
        "focus": ["serverless", "API development", "CI/CD", "debugging"],
        "piece_modifier": 0.9,
    },
    "sysops-associate": {
        "cert": "AWS Certified SysOps Administrator – Associate",
        "focus": ["monitoring", "automation", "security", "networking"],
        "piece_modifier": 1.0,
    },
    "solutions-architect-professional": {
        "cert": "AWS Certified Solutions Architect – Professional",
        "focus": ["multi-account", "hybrid", "migration", "cost optimization"],
        "piece_modifier": 1.5,
    },
    "devops-professional": {
        "cert": "AWS Certified DevOps Engineer – Professional",
        "focus": ["CI/CD", "automation", "monitoring", "incident response"],
        "piece_modifier": 1.3,
    },
    "security-specialty": {
        "cert": "AWS Certified Security – Specialty",
        "focus": ["IAM", "encryption", "logging", "incident response"],
        "piece_modifier": 1.2,
    },
    "networking-specialty": {
        "cert": "AWS Certified Advanced Networking – Specialty",
        "focus": ["VPC", "hybrid connectivity", "DNS", "load balancing"],
        "piece_modifier": 1.3,
    },
}

# Map cert codes to persona IDs
CERT_CODE_TO_PERSONA = {
    "CLF": "cloud-practitioner",
    "CLF-C02": "cloud-practitioner",
    "SAA": "solutions-architect-associate",
    "SAA-C03": "solutions-architect-associate",
    "DVA": "developer-associate",
    "DVA-C02": "developer-associate",
    "SOA": "sysops-associate",
    "SOA-C02": "sysops-associate",
    "SAP": "solutions-architect-professional",
    "SAP-C02": "solutions-architect-professional",
    "DOP": "devops-professional",
    "DOP-C02": "devops-professional",
    "SCS": "security-specialty",
    "SCS-C02": "security-specialty",
    "ANS": "networking-specialty",
    "ANS-C01": "networking-specialty",
}


class PuzzlePiece(BaseModel):
    """A single AWS service piece for the puzzle"""
    id: str
    service_id: str
    label: str
    sublabel: Optional[str] = None
    hint: Optional[str] = None
    required: bool = True
    category: str = "compute"


class ExpectedConnection(BaseModel):
    """An expected connection between two pieces"""
    from_piece: str
    to_piece: str
    description: str
    required: bool = True


class PuzzleObjective(BaseModel):
    """An objective the user should achieve"""
    id: str
    text: str
    points: int = 10
    hint: Optional[str] = None


class PuzzlePenalty(BaseModel):
    """A penalty for incorrect placement"""
    id: str
    text: str
    points: int = -5


class ArchitectArenaPuzzle(BaseModel):
    """Complete puzzle payload for Architect Arena"""
    id: str
    title: str
    brief: str
    difficulty: str
    user_level: str
    target_cert: str
    time_limit_seconds: int = 300
    target_score: int = 100
    pieces: List[PuzzlePiece]
    expected_connections: List[ExpectedConnection]
    expected_hierarchy: Dict[str, List[str]]
    objectives: List[PuzzleObjective]
    penalties: List[PuzzlePenalty]
    aws_services: List[str]
    topics: List[str]


def get_service_short_name(service_id: str) -> str:
    """Get the canonical short name for a service ID."""
    return AWS_SERVICE_SHORT_NAMES.get(service_id, service_id.upper().replace("-", " "))


def get_service_category(service_id: str) -> str:
    """Get the category for a service ID."""
    return SERVICE_CATEGORIES.get(service_id, "compute")


def get_valid_service_ids() -> Set[str]:
    """Get all valid service IDs from the mapping."""
    return set(AWS_SERVICE_URL_MAPPING.keys())


class ArchitectArenaGenerator:
    """Generates Architect Arena puzzles using the Drawing Agent's knowledge base."""
    
    def __init__(self, openai_api_key: str, model: str = "gpt-4.1"):
        self.api_key = openai_api_key
        self.model = model
        self.valid_service_ids = get_valid_service_ids()
    
    def generate_puzzle(
        self,
        user_level: str = "intermediate",
        cert_code: str = "SAA-C03",
        difficulty: Optional[str] = None,
    ) -> ArchitectArenaPuzzle:
        """
        Generate an Architect Arena puzzle.
        
        Args:
            user_level: User's skill level (beginner, intermediate, advanced, expert)
            cert_code: Target certification code (e.g., 'SAA-C03')
            difficulty: Override difficulty (easy/medium/hard/expert)
        
        Returns:
            ArchitectArenaPuzzle with pieces and scoring rules
        """
        # Get persona for certification
        upper_code = cert_code.upper()
        persona_id = CERT_CODE_TO_PERSONA.get(upper_code)
        if not persona_id:
            base_code = upper_code.split("-")[0]
            persona_id = CERT_CODE_TO_PERSONA.get(base_code, "solutions-architect-associate")
        
        persona = CERTIFICATION_PERSONAS.get(persona_id, CERTIFICATION_PERSONAS["solutions-architect-associate"])
        cert_name = persona["cert"]
        focus_areas = persona["focus"]
        
        # Determine difficulty and piece count
        if not difficulty:
            difficulty_map = {
                "beginner": "easy",
                "intermediate": "medium",
                "advanced": "hard",
                "expert": "expert",
            }
            difficulty = difficulty_map.get(user_level, "medium")
        
        piece_count_map = {
            "beginner": 10,
            "intermediate": 20,
            "advanced": 30,
            "expert": 40,
        }
        base_piece_count = piece_count_map.get(user_level, 20)
        piece_count = int(base_piece_count * persona.get("piece_modifier", 1.0))
        piece_count = max(8, min(piece_count, 45))  # Clamp between 8 and 45
        
        # Build available services list for the prompt
        services_by_category = {}
        for service_id in self.valid_service_ids:
            cat = get_service_category(service_id)
            if cat not in services_by_category:
                services_by_category[cat] = []
            services_by_category[cat].append(service_id)
        
        services_list = "\n".join([
            f"   - {cat}: {', '.join(sorted(sids))}"
            for cat, sids in sorted(services_by_category.items())
        ])
        
        # Generate puzzle via LLM
        result = self._generate_puzzle_json(
            user_level=user_level,
            cert_name=cert_name,
            focus_areas=focus_areas,
            difficulty=difficulty,
            piece_count=piece_count,
            services_list=services_list,
        )
        
        # Parse and validate the result
        return self._parse_puzzle_result(result, user_level, cert_name, difficulty)
    
    def _generate_puzzle_json(
        self,
        user_level: str,
        cert_name: str,
        focus_areas: List[str],
        difficulty: str,
        piece_count: int,
        services_list: str,
    ) -> Dict:
        """Generate puzzle JSON from LLM."""
        import httpx
        http_client = httpx.Client()
        client = OpenAI(api_key=self.api_key, http_client=http_client)
        
        request_id = uuid.uuid4().hex
        
        system_prompt = f"""You are an expert AWS Solutions Architect generating architecture puzzles for the "Architect Arena" game.

The user must assemble pre-generated AWS service "pieces" into a correct architecture diagram.

## USER PROFILE
- Skill Level: {user_level}
- Target Certification: {cert_name}
- Focus Areas: {', '.join(focus_areas)}
- Request ID: {request_id}

## PIECE COUNT: {piece_count}
Generate EXACTLY {piece_count} pieces. No more, no less.

## AVAILABLE AWS SERVICES (use ONLY these service_id values)
{services_list}

## CRITICAL RULES
1. Use ONLY service_id values from the list above (lowercase, hyphenated)
2. The "label" field MUST be the AWS service short name:
   - "EC2" not "Web Server"
   - "RDS" not "Database"
   - "ALB" not "Load Balancer"
   - "VPC" not "Network"
   - "Lambda" not "Function"
3. The "sublabel" can have context (e.g., "Web tier", "Primary database")
4. Generate a UNIQUE business scenario - not generic "3-tier web app"
5. Penalties should be cryptic hints (2-4 words), not explicit answers
6. **CRITICAL: The "brief" MUST mention ALL the AWS services that appear in the pieces!**
   - The brief should describe a scenario where each service is needed
   - Example: "TechCorp needs a web application with EC2 instances behind an ALB, 
     storing data in RDS, with S3 for static assets and CloudFront for CDN."
   - Do NOT mention services in the brief that are NOT in the pieces
   - Do NOT include pieces for services NOT mentioned in the brief
   - The brief and pieces must be 100% aligned

Return JSON with this exact schema:
{{
  "title": "<creative title>",
  "brief": "<2-3 sentence business scenario with company name>",
  "difficulty": "{difficulty}",
  "time_limit_seconds": <180-600>,
  "target_score": 100,
  "pieces": [
    {{
      "id": "<unique_id>",
      "service_id": "<from service list>",
      "label": "<AWS service short name>",
      "sublabel": "<optional context>",
      "hint": "<placement hint>",
      "required": true,
      "category": "<networking|compute|database|storage|security|integration|management|analytics|containers>"
    }}
  ],
  "expected_connections": [
    {{
      "from_piece": "<piece_id>",
      "to_piece": "<piece_id>",
      "description": "<why these connect>",
      "required": true
    }}
  ],
  "expected_hierarchy": {{
    "<container_piece_id>": ["<child_piece_id>", "..."]
  }},
  "objectives": [
    {{"id": "<unique>", "text": "<goal>", "points": <10-25>, "hint": "<cryptic hint>"}}
  ],
  "penalties": [
    {{"id": "<unique>", "text": "<2-4 word cryptic risk>", "points": <-5 to -15>}}
  ],
  "aws_services": ["<list of service_ids used>"],
  "topics": ["<relevant AWS topics>"]
}}"""

        user_prompt = f"""Generate a unique Architect Arena puzzle for {cert_name}.

Requirements:
1. EXACTLY {piece_count} pieces
2. Unique business scenario (not generic patterns)
3. Labels must be AWS service names (EC2, RDS, Lambda, etc.)
4. Focus on: {', '.join(focus_areas)}
5. **IMPORTANT: The brief MUST explicitly mention every AWS service that appears in the pieces!**
   - First decide which services you'll use
   - Then write the brief to naturally incorporate ALL of them
   - Example: "XYZ Corp needs to deploy their app using EC2 behind an ALB, with RDS for the database, S3 for storage, and CloudFront for global delivery."

Generate the puzzle JSON now."""

        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.85,
        )
        
        return json.loads(response.choices[0].message.content)
    
    def _parse_puzzle_result(
        self,
        result: Dict,
        user_level: str,
        cert_name: str,
        difficulty: str,
    ) -> ArchitectArenaPuzzle:
        """Parse and validate the LLM result into a puzzle."""
        
        # Parse pieces with validation
        pieces = []
        for p in result.get("pieces", []):
            service_id = p.get("service_id", "ec2")
            
            # Validate service_id
            if service_id not in self.valid_service_ids:
                logger.warning(f"Invalid service_id '{service_id}', falling back to 'ec2'")
                service_id = "ec2"
            
            # Always use canonical short name as label
            label = get_service_short_name(service_id)
            category = get_service_category(service_id)
            
            pieces.append(PuzzlePiece(
                id=p.get("id", f"piece_{uuid.uuid4().hex[:8]}"),
                service_id=service_id,
                label=label,
                sublabel=p.get("sublabel"),
                hint=p.get("hint"),
                required=p.get("required", True),
                category=category,
            ))
        
        # Build piece ID set for validation
        piece_ids: Set[str] = {p.id for p in pieces}
        
        # Parse connections with validation
        connections = []
        for c in result.get("expected_connections", []):
            from_piece = c.get("from_piece", "")
            to_piece = c.get("to_piece", "")
            
            if from_piece not in piece_ids or to_piece not in piece_ids:
                logger.warning(f"Invalid connection {from_piece} -> {to_piece}, skipping")
                continue
            
            connections.append(ExpectedConnection(
                from_piece=from_piece,
                to_piece=to_piece,
                description=c.get("description", ""),
                required=c.get("required", True),
            ))
        
        # Parse objectives
        objectives = []
        for o in result.get("objectives", []):
            objectives.append(PuzzleObjective(
                id=o.get("id", f"obj_{uuid.uuid4().hex[:8]}"),
                text=o.get("text", "Complete the architecture"),
                points=o.get("points", 10),
                hint=o.get("hint"),
            ))
        
        # Parse penalties
        penalties = []
        for pen in result.get("penalties", []):
            penalties.append(PuzzlePenalty(
                id=pen.get("id", f"pen_{uuid.uuid4().hex[:8]}"),
                text=pen.get("text", "Incorrect placement"),
                points=pen.get("points", -5),
            ))
        
        # Validate hierarchy
        raw_hierarchy = result.get("expected_hierarchy", {})
        validated_hierarchy = {}
        for parent_id, children in raw_hierarchy.items():
            if parent_id not in piece_ids:
                continue
            valid_children = [c for c in children if c in piece_ids]
            if valid_children:
                validated_hierarchy[parent_id] = valid_children
        
        return ArchitectArenaPuzzle(
            id=f"puzzle_{uuid.uuid4().hex[:12]}",
            title=result.get("title", "AWS Architecture Challenge"),
            brief=result.get("brief", "Design a secure, scalable AWS architecture."),
            difficulty=result.get("difficulty", difficulty),
            user_level=user_level,
            target_cert=cert_name,
            time_limit_seconds=result.get("time_limit_seconds", 300),
            target_score=result.get("target_score", 100),
            pieces=pieces,
            expected_connections=connections,
            expected_hierarchy=validated_hierarchy,
            objectives=objectives,
            penalties=penalties,
            aws_services=result.get("aws_services", []),
            topics=result.get("topics", []),
        )
    
    def audit_puzzle(
        self,
        puzzle_title: str,
        puzzle_brief: str,
        expected_hierarchy: Dict,
        expected_connections: List[Dict],
        nodes: List[Dict],
        connections: List[Dict],
        cert_code: Optional[str] = None,
        user_level: Optional[str] = None,
    ) -> Dict:
        """
        Audit a user's puzzle submission.
        
        Args:
            puzzle_title: The puzzle title
            puzzle_brief: The puzzle brief/scenario
            expected_hierarchy: Expected container hierarchy
            expected_connections: Expected connections
            nodes: User's placed nodes
            connections: User's connections
            cert_code: User's target certification
            user_level: User's skill level
        
        Returns:
            Audit result with score, feedback, etc.
        """
        import httpx
        http_client = httpx.Client()
        client = OpenAI(api_key=self.api_key, http_client=http_client)
        
        # Build diagram JSON for audit
        diagram_json = json.dumps({
            "nodes": nodes,
            "connections": connections,
        }, indent=2)
        
        audit_prompt = f"""You are auditing an AWS architecture PUZZLE submission.

## CRITICAL: This is a PUZZLE game, NOT a free-form design!
The user was given PRE-GENERATED puzzle pieces (AWS services) scattered randomly.
Their job was to:
1. PLACE pieces correctly (drag into proper containers)
2. CONNECT pieces correctly (draw edges between related services)

## DO NOT give credit for:
- Having the services present (they were pre-generated)
- The types of services used (the puzzle defined these)

## DO give credit/penalties for:
- Correct PLACEMENT: Is EC2 inside a private subnet? Is ALB in public subnet?
- Correct CONNECTIONS: Did user connect ALB -> EC2 -> RDS?
- Correct HIERARCHY: Proper nesting of containers

## Puzzle Context
Title: {puzzle_title}
Brief: {puzzle_brief}
Expected Hierarchy: {json.dumps(expected_hierarchy)}
Expected Connections: {json.dumps(expected_connections)}

## User's Submission
```json
{diagram_json}
```

## Scoring Guide (out of 100)
- 0-30: Pieces not placed in containers, no connections
- 31-50: Some correct placements, few connections
- 51-70: Most placements correct, most connections made
- 71-90: All placements correct, all connections, good hierarchy
- 91-100: Perfect placement, connections, and hierarchy

Return ONLY valid JSON:
{{"score": <0-100>, "correct": ["achievements"], "missing": ["issues as risks"], "suggestions": ["hints"], "feedback": "encouraging message"}}"""

        response = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": audit_prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        
        return json.loads(response.choices[0].message.content)
