"""
Bug Bounty Challenge Generator (AI-Powered)
=============================================
Generates fully dynamic AWS architecture challenges with flawed diagrams,
fake logs, metrics, and production context - ALL using LLM generation.

Uses the same patterns as LLMDiagramGenerator for consistency.
"""

import json
import re
import random
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pydantic import BaseModel
from openai import OpenAI
import httpx

logger = logging.getLogger(__name__)

# Knowledge base integration - direct database access
import db

async def fetch_knowledge_for_generation(
    cert_code: str,
    topic: str,
    limit: int = 5,
    api_key: Optional[str] = None
) -> str:
    """
    Fetch AWS knowledge from database directly.
    
    Args:
        cert_code: Certification code (e.g., 'solutions-architect-associate')
        topic: Topic to search for
        limit: Number of chunks to retrieve
        api_key: OpenAI API key for embeddings
    
    Returns:
        Formatted knowledge context string
    """
    try:
        if not api_key:
            logger.warning("No API key provided for knowledge search")
            return ""
        
        # Generate embedding for the search query
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        
        # Create search query combining cert code and topic
        search_query = f"{cert_code} {topic}"
        
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=search_query
        )
        query_embedding = response.data[0].embedding
        
        # Search knowledge chunks in database
        chunks = await db.search_knowledge_chunks(
            query_embedding=query_embedding,
            limit=limit
        )
        
        if not chunks:
            logger.info(f"No knowledge chunks found for: {search_query}")
            return ""
        
        # Format chunks into context string
        context_parts = []
        for chunk in chunks:
            context_parts.append(f"[{chunk['url']}]\n{chunk['content']}")
        
        knowledge_context = "\n\n".join(context_parts)
        logger.info(f"Fetched {len(chunks)} knowledge chunks for {cert_code}")
        return knowledge_context
        
    except Exception as e:
        logger.warning(f"Failed to fetch knowledge from database: {e}")
        return ""


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class BugDefinition(BaseModel):
    """Definition of a bug in the architecture."""
    id: str
    type: str  # security, reliability, cost, performance, compliance, mismatch
    severity: str  # critical, high, medium, low
    location: str  # node_id, edge_id, description, or log reference
    description: str
    evidence_in_logs: List[str]
    blast_radius: str  # high, medium, low
    fix_suggestion: str


class CloudWatchLog(BaseModel):
    """CloudWatch log entry."""
    timestamp: str
    log_group: str
    log_stream: str
    message: str
    level: str  # ERROR, WARN, INFO


class CloudWatchMetric(BaseModel):
    """CloudWatch metric data."""
    value: float
    unit: str
    alarm: bool
    threshold: Optional[float] = None


class XRaySegment(BaseModel):
    """X-Ray trace segment."""
    name: str
    duration: float
    error: bool
    cause: Optional[str] = None


class XRayTrace(BaseModel):
    """X-Ray trace."""
    id: str
    duration: float
    segments: List[XRaySegment]


class ConfigRule(BaseModel):
    """AWS Config compliance rule."""
    rule: str
    status: str  # COMPLIANT, NON_COMPLIANT
    resource: Optional[str] = None


class CostItem(BaseModel):
    """Cost Explorer item."""
    service: str
    cost: float
    trend: str


class AWSEnvironment(BaseModel):
    """Complete AWS environment context."""
    cloudwatch_logs: List[CloudWatchLog]
    cloudwatch_metrics: Dict[str, CloudWatchMetric]
    vpc_flow_logs: List[str]
    iam_policies: Dict[str, Dict]
    cost_data: Dict
    xray_traces: List[XRayTrace]
    config_compliance: List[ConfigRule]


class BugBountyChallenge(BaseModel):
    """Complete Bug Bounty challenge."""
    challenge_id: str
    diagram: Dict
    description: str
    aws_environment: AWSEnvironment
    hidden_bugs: List[BugDefinition]
    user_level: str  # beginner, intermediate, advanced, expert (from AcademyUserProfile.skillLevel)
    target_cert: Optional[str] = None  # AWS certification goal (from AcademyUserProfile.targetCertification)
    bounty_value: int
    time_limit: int  # seconds


# =============================================================================
# SCENARIO TEMPLATES (for variety, LLM will expand on these)
# =============================================================================

SCENARIO_TEMPLATES = [
    {
        "type": "ecommerce",
        "name": "E-Commerce Platform",
        "description": "High-traffic online retail platform with payment processing",
        "keywords": ["shopping cart", "checkout", "inventory", "payments", "PCI DSS"],
    },
    {
        "type": "data_pipeline",
        "name": "Real-Time Data Pipeline",
        "description": "Streaming data ingestion and analytics platform",
        "keywords": ["streaming", "ETL", "analytics", "data lake", "real-time"],
    },
    {
        "type": "saas_platform",
        "name": "Multi-Tenant SaaS Application",
        "description": "B2B software platform with tenant isolation",
        "keywords": ["multi-tenant", "API", "authentication", "billing", "SOC2"],
    },
    {
        "type": "ml_platform",
        "name": "Machine Learning Platform",
        "description": "ML model training and inference infrastructure",
        "keywords": ["training", "inference", "GPU", "model registry", "MLOps"],
    },
    {
        "type": "iot_platform",
        "name": "IoT Device Management",
        "description": "Connected device fleet management and telemetry",
        "keywords": ["devices", "telemetry", "MQTT", "edge", "firmware"],
    },
    {
        "type": "media_streaming",
        "name": "Video Streaming Service",
        "description": "On-demand video streaming with global CDN",
        "keywords": ["transcoding", "CDN", "adaptive bitrate", "DRM", "live"],
    },
    {
        "type": "fintech",
        "name": "Financial Services Platform",
        "description": "Trading and transaction processing system",
        "keywords": ["transactions", "compliance", "audit", "encryption", "HIPAA"],
    },
    {
        "type": "healthcare",
        "name": "Healthcare Data Platform",
        "description": "Patient data management with HIPAA compliance",
        "keywords": ["PHI", "HIPAA", "encryption", "audit logs", "access control"],
    },
]

# Bug categories with severity weights
BUG_CATEGORIES = {
    "security": {
        "weight": 1.5,
        "examples": [
            "publicly accessible database",
            "overly permissive IAM policy",
            "unencrypted data at rest",
            "missing WAF protection",
            "exposed secrets in logs",
        ],
    },
    "reliability": {
        "weight": 1.2,
        "examples": [
            "single point of failure",
            "no auto-scaling",
            "missing health checks",
            "no disaster recovery",
            "insufficient capacity",
        ],
    },
    "performance": {
        "weight": 1.0,
        "examples": [
            "database in wrong region",
            "missing caching layer",
            "synchronous bottleneck",
            "undersized instances",
            "missing CDN",
        ],
    },
    "cost": {
        "weight": 0.8,
        "examples": [
            "oversized instances",
            "unused resources",
            "missing reserved capacity",
            "inefficient data transfer",
            "redundant NAT gateways",
        ],
    },
    "compliance": {
        "weight": 1.3,
        "examples": [
            "missing encryption",
            "inadequate logging",
            "missing access controls",
            "data residency violation",
            "missing audit trail",
        ],
    },
    "mismatch": {
        "weight": 1.1,
        "examples": [
            "description contradicts diagram",
            "missing required component",
            "wrong service for use case",
            "incomplete implementation",
            "SLA mismatch",
        ],
    },
}


class BugBountyGenerator:
    """
    Generate fully AI-powered Bug Bounty challenges.
    
    All content is dynamically generated based on:
    - User's target certification
    - User's skill level
    - Random scenario selection
    """
    
    def __init__(self, openai_api_key: str = None):
        """Initialize the generator with OpenAI API key."""
        self.openai_api_key = openai_api_key
        self.client = None
        self.model = "gpt-4.1"
        self.max_retries = 3
        
        if openai_api_key:
            try:
                http_client = httpx.Client()
                self.client = OpenAI(api_key=openai_api_key, http_client=http_client)
                logger.info("BugBountyGenerator initialized with OpenAI")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI client: {e}")
    
    async def generate_challenge(
        self,
        user_level: str = "intermediate",
        target_cert: Optional[str] = None,
        scenario_type: Optional[str] = None,
    ) -> BugBountyChallenge:
        """
        Generate a complete Bug Bounty challenge using AI.
        
        Args:
            user_level: beginner, intermediate, advanced, expert (from AcademyUserProfile.skillLevel)
            target_cert: Target AWS certification (from AcademyUserProfile.targetCertification)
            scenario_type: Optional specific scenario type
        
        Returns:
            Complete challenge with AI-generated diagram, logs, and hidden bugs
        """
        if not self.client:
            raise ValueError("OpenAI API key not configured")
        
        challenge_id = f"BB-{random.randint(10000, 99999)}"
        
        # Select scenario template
        scenario = self._select_scenario(scenario_type)
        
        # Determine bug count and time based on user_level
        level_config = {
            "beginner": {"bug_count": 3, "time_limit": 900, "complexity": "simple"},
            "intermediate": {"bug_count": 5, "time_limit": 720, "complexity": "moderate"},
            "advanced": {"bug_count": 7, "time_limit": 600, "complexity": "complex"},
            "expert": {"bug_count": 10, "time_limit": 480, "complexity": "enterprise-scale"},
        }
        config = level_config.get(user_level, level_config["intermediate"])
        
        logger.info(f"Generating challenge: {scenario['name']} (user_level={user_level}, target_cert={target_cert})")
        
        # Fetch AWS knowledge from learning agent API
        knowledge_context = ""
        if target_cert:
            try:
                topic = f"{scenario['name']} {' '.join(scenario['keywords'][:2])}"
                knowledge_context = await fetch_knowledge_for_generation(
                    cert_code=target_cert,
                    topic=topic,
                    limit=5,
                    api_key=self.openai_api_key
                )
                if knowledge_context:
                    logger.info(f"Fetched AWS knowledge for {target_cert}: {len(knowledge_context)} chars")
                else:
                    logger.info(f"No AWS knowledge fetched for {target_cert}")
            except Exception as e:
                logger.warning(f"Failed to fetch knowledge: {e}")
                knowledge_context = ""
        
        # Step 1: Generate the use case description with requirements
        description = self._generate_description(
            scenario=scenario,
            user_level=user_level,
            target_cert=target_cert,
            complexity=config["complexity"],
            knowledge_context=knowledge_context,
        )
        
        # Step 2: Generate the flawed architecture diagram
        diagram, bugs_in_diagram = self._generate_flawed_diagram(
            scenario=scenario,
            description=description,
            user_level=user_level,
            bug_count=config["bug_count"],
            knowledge_context=knowledge_context,
        )
        
        # Step 3: Generate hidden bugs (including diagram bugs + additional)
        hidden_bugs = self._generate_hidden_bugs(
            diagram=diagram,
            description=description,
            bugs_in_diagram=bugs_in_diagram,
            bug_count=config["bug_count"],
        )
        
        # Step 4: Generate AWS environment with evidence
        aws_environment = self._generate_aws_environment(
            diagram=diagram,
            description=description,
            hidden_bugs=hidden_bugs,
        )
        
        # Calculate bounty value
        bounty_value = sum(
            {"critical": 200, "high": 100, "medium": 50, "low": 25}.get(bug.severity, 50)
            for bug in hidden_bugs
        )
        
        return BugBountyChallenge(
            challenge_id=challenge_id,
            diagram=diagram,
            description=description,
            aws_environment=aws_environment,
            hidden_bugs=hidden_bugs,
            user_level=user_level,
            target_cert=target_cert,
            bounty_value=bounty_value,
            time_limit=config["time_limit"],
        )
    
    def _select_scenario(self, scenario_type: Optional[str] = None) -> Dict:
        """Select a scenario template, randomly if not specified."""
        if scenario_type:
            for scenario in SCENARIO_TEMPLATES:
                if scenario["type"] == scenario_type:
                    return scenario
        return random.choice(SCENARIO_TEMPLATES)
    
    def _generate_description(
        self,
        scenario: Dict,
        user_level: str,
        target_cert: Optional[str],
        complexity: str,
        knowledge_context: str = "",
    ) -> str:
        """Generate a detailed use case description using LLM with AWS knowledge."""
        
        cert_context = ""
        if target_cert:
            cert_context = f"\nTarget certification: {target_cert}. Include relevant AWS services and concepts for this certification."
        
        knowledge_section = ""
        if knowledge_context:
            knowledge_section = f"\n\nAWS KNOWLEDGE BASE CONTEXT:\n{knowledge_context}\n\nUse this AWS documentation to inform your architecture requirements and ensure certification-relevant services."
        
        prompt = f"""Generate a realistic AWS architecture use case description for a Bug Bounty challenge.

SCENARIO: {scenario['name']}
TYPE: {scenario['type']}
USER LEVEL: {user_level} ({complexity})
KEYWORDS: {', '.join(scenario['keywords'])}
{cert_context}{knowledge_section}

Generate a professional use case document with:

1. **Business Overview** (2-3 sentences about the company/product)
2. **Requirements** (bullet list of 6-8 specific requirements including):
   - Traffic/scale requirements (requests per day, users, etc.)
   - Uptime SLA (e.g., 99.9%, 99.99%)
   - Compliance requirements (PCI DSS, HIPAA, SOC2, etc.)
   - Performance requirements (latency, response time)
   - Security requirements
   - Specific feature requirements

3. **Current Architecture** (brief description of what's supposedly deployed)

IMPORTANT: Include some requirements that will CONTRADICT the actual architecture diagram.
For example, claim "multi-AZ deployment" but the diagram will show single AZ.
These contradictions are intentional bugs for players to find.

Write in a professional, technical style. Be specific with numbers and metrics.
Output ONLY the description text, no JSON or markdown code blocks."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.8,
                max_tokens=800,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Failed to generate description: {e}")
            return f"{scenario['name']}\n\nA {complexity} AWS architecture for {scenario['description']}."
    
    def _generate_flawed_diagram(
        self,
        scenario: Dict,
        description: str,
        user_level: str,
        bug_count: int,
        knowledge_context: str = "",
    ) -> tuple[Dict, List[Dict]]:
        """Generate an architecture diagram with intentional flaws using LLM and AWS knowledge."""
        
        knowledge_section = ""
        if knowledge_context:
            knowledge_section = f"\n\nAWS KNOWLEDGE BASE CONTEXT:\n{knowledge_context}\n\nUse this AWS documentation to select appropriate services and create realistic architectural flaws."
        
        prompt = f"""Generate an AWS architecture diagram with INTENTIONAL FLAWS for a Bug Bounty game.

SCENARIO: {scenario['name']}
USER LEVEL: {user_level}
NUMBER OF BUGS TO EMBED: {bug_count}

USE CASE DESCRIPTION:
{description}{knowledge_section}

Generate a React Flow diagram JSON with intentional security, reliability, and architecture flaws.

OUTPUT FORMAT:
{{
  "services": [
    {{"id": "svc1", "service_id": "apigateway", "label": "API Gateway", "tier": "edge"}},
    {{"id": "svc2", "service_id": "lambda", "label": "Lambda Functions", "tier": "compute"}},
    {{"id": "svc3", "service_id": "rds", "label": "RDS PostgreSQL", "tier": "data", "flaw": "publicly_accessible"}}
  ],
  "connections": [
    {{"from": "svc1", "to": "svc2"}},
    {{"from": "svc2", "to": "svc3"}}
  ],
  "embedded_bugs": [
    {{
      "location": "svc3",
      "type": "security",
      "severity": "critical",
      "description": "RDS instance is publicly accessible",
      "evidence_hint": "Check VPC flow logs and Config rules"
    }}
  ]
}}

TIER VALUES:
- "edge": Internet-facing (CloudFront, Route53, API Gateway, ALB)
- "public": Public subnet (NAT Gateway, Bastion)
- "compute": Private subnet compute (Lambda, ECS, EC2, EKS)
- "data": Private subnet data (RDS, DynamoDB, ElastiCache, S3)
- "security": Security services (WAF, Shield, Cognito, IAM)
- "integration": Integration (SQS, SNS, EventBridge, Step Functions)

CRITICAL RULE FOR service_id:
- service_id MUST be the base AWS service name ONLY
- NEVER add suffixes like -web, -payment, -catalog, -inventory, -orders, -cart
- Use the label field for descriptive names
- CORRECT: {{"id": "svc1", "service_id": "ec2", "label": "EC2 Web Servers"}}
- WRONG: {{"id": "svc1", "service_id": "ec2-web", "label": "Web Servers"}}
- Valid service_ids: ec2, lambda, dynamodb, rds, s3, apigateway, cloudfront, elb, ecs, eks, sqs, sns, kinesis, elasticache, cloudwatch, cognito, waf, route53, vpc, iam, stepfunctions, eventbridge, appsync, athena, glue, emr, redshift, neptune, documentdb, aurora, elasticbeanstalk, amplify, apprunner

FLAW TYPES TO EMBED:
- security: publicly accessible resources, overly permissive IAM, missing encryption
- reliability: single AZ, no auto-scaling, no health checks
- performance: wrong region, missing cache, undersized instances
- cost: oversized instances, redundant NAT gateways
- compliance: missing encryption, inadequate logging
- mismatch: diagram contradicts description requirements

Include 8-15 services for a realistic architecture.
Make flaws subtle but discoverable through logs/metrics.
Return ONLY valid JSON, no markdown."""

        for attempt in range(self.max_retries):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=2000,
                )
                
                content = response.choices[0].message.content
                data = self._extract_json(content)
                
                # Convert to React Flow format
                diagram = self._convert_to_react_flow(data)
                bugs_in_diagram = data.get("embedded_bugs", [])
                
                logger.info(f"Generated diagram with {len(diagram.get('nodes', []))} nodes and {len(bugs_in_diagram)} embedded bugs")
                return diagram, bugs_in_diagram
                
            except Exception as e:
                logger.warning(f"Diagram generation attempt {attempt + 1} failed: {e}")
                if attempt == self.max_retries - 1:
                    # Return a basic fallback diagram
                    return self._fallback_diagram(scenario), []
        
        return self._fallback_diagram(scenario), []
    
    def _convert_to_react_flow(self, data: Dict) -> Dict:
        """Convert LLM output to React Flow format."""
        services = data.get("services", [])
        connections = data.get("connections", [])
        
        nodes = []
        for svc in services:
            if not isinstance(svc, dict) or "id" not in svc:
                continue
            nodes.append({
                "id": svc["id"],
                "type": "awsService",
                "data": {
                    "label": svc.get("label", ""),
                    "service_id": svc.get("service_id", ""),
                    "tier": svc.get("tier", "compute"),
                    "flaw": svc.get("flaw"),  # Hidden flaw marker
                },
            })
        
        edges = []
        for i, conn in enumerate(connections):
            if isinstance(conn, dict) and "from" in conn and "to" in conn:
                edges.append({
                    "id": f"edge-{i}",
                    "source": conn["from"],
                    "target": conn["to"],
                })
        
        return {"nodes": nodes, "edges": edges}
    
    def _fallback_diagram(self, scenario: Dict) -> Dict:
        """Generate a basic fallback diagram if LLM fails."""
        return {
            "nodes": [
                {"id": "alb", "type": "awsService", "data": {"label": "Application Load Balancer", "service_id": "alb", "tier": "edge"}},
                {"id": "ec2", "type": "awsService", "data": {"label": "EC2 Instances", "service_id": "ec2", "tier": "compute"}},
                {"id": "rds", "type": "awsService", "data": {"label": "RDS Database", "service_id": "rds", "tier": "data"}},
            ],
            "edges": [
                {"id": "edge-0", "source": "alb", "target": "ec2"},
                {"id": "edge-1", "source": "ec2", "target": "rds"},
            ],
        }
    
    def _generate_hidden_bugs(
        self,
        diagram: Dict,
        description: str,
        bugs_in_diagram: List[Dict],
        bug_count: int,
    ) -> List[BugDefinition]:
        """Generate the complete list of hidden bugs using LLM."""
        
        # Get node IDs for reference
        node_ids = [n["id"] for n in diagram.get("nodes", [])]
        
        prompt = f"""Generate {bug_count} hidden bugs for a Bug Bounty challenge.

ARCHITECTURE NODES: {', '.join(node_ids)}

DESCRIPTION:
{description}

BUGS ALREADY IN DIAGRAM:
{json.dumps(bugs_in_diagram, indent=2)}

Generate a complete list of {bug_count} bugs. Include the diagram bugs and add more.
Each bug should be discoverable through logs, metrics, IAM policies, or config rules.

OUTPUT FORMAT (JSON array):
[
  {{
    "id": "bug_1",
    "type": "security",
    "severity": "critical",
    "location": "rds_node_id",
    "description": "RDS instance is publicly accessible without encryption",
    "evidence_in_logs": ["cloudwatch_log_rds_connection", "config_rule_public_access", "vpc_flow_external_ip"],
    "blast_radius": "high",
    "fix_suggestion": "Move RDS to private subnet and enable encryption at rest"
  }},
  {{
    "id": "bug_2",
    "type": "mismatch",
    "severity": "high",
    "location": "architecture",
    "description": "Description claims multi-AZ but diagram shows single AZ",
    "evidence_in_logs": ["description_requirement_multiaz"],
    "blast_radius": "high",
    "fix_suggestion": "Deploy across multiple availability zones"
  }}
]

BUG TYPES: security, reliability, performance, cost, compliance, mismatch
SEVERITIES: critical, high, medium, low
BLAST RADIUS: high, medium, low

Make bugs realistic and educational. Include variety of types.
Return ONLY valid JSON array, no markdown."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=2000,
            )
            
            content = response.choices[0].message.content
            bugs_data = self._extract_json(content)
            
            if not isinstance(bugs_data, list):
                bugs_data = [bugs_data]
            
            bugs = []
            for bug in bugs_data[:bug_count]:
                try:
                    bugs.append(BugDefinition(
                        id=bug.get("id", f"bug_{len(bugs)+1}"),
                        type=bug.get("type", "security"),
                        severity=bug.get("severity", "medium"),
                        location=bug.get("location", "architecture"),
                        description=bug.get("description", "Unknown bug"),
                        evidence_in_logs=bug.get("evidence_in_logs", []),
                        blast_radius=bug.get("blast_radius", "medium"),
                        fix_suggestion=bug.get("fix_suggestion", "Review and fix"),
                    ))
                except Exception as e:
                    logger.warning(f"Failed to parse bug: {e}")
            
            logger.info(f"Generated {len(bugs)} hidden bugs")
            return bugs
            
        except Exception as e:
            logger.error(f"Failed to generate bugs: {e}")
            return self._fallback_bugs(bug_count)
    
    def _fallback_bugs(self, count: int) -> List[BugDefinition]:
        """Generate fallback bugs if LLM fails."""
        return [
            BugDefinition(
                id=f"bug_{i+1}",
                type="security",
                severity="medium",
                location="architecture",
                description=f"Security issue #{i+1}",
                evidence_in_logs=[],
                blast_radius="medium",
                fix_suggestion="Review security configuration",
            )
            for i in range(count)
        ]
    
    def _generate_aws_environment(
        self,
        diagram: Dict,
        description: str,
        hidden_bugs: List[BugDefinition],
    ) -> AWSEnvironment:
        """Generate fake AWS environment data with evidence of bugs using LLM."""
        
        # Get services from diagram
        services = [n["data"]["service_id"] for n in diagram.get("nodes", []) if n.get("data", {}).get("service_id")]
        
        # Get bug evidence hints
        bug_hints = [
            {"type": bug.type, "location": bug.location, "evidence": bug.evidence_in_logs}
            for bug in hidden_bugs
        ]
        
        prompt = f"""Generate realistic AWS environment data for a Bug Bounty challenge.
This data should contain EVIDENCE of the hidden bugs.

SERVICES IN ARCHITECTURE: {', '.join(services)}

HIDDEN BUGS (generate evidence for these):
{json.dumps(bug_hints, indent=2)}

Generate JSON with:

1. cloudwatch_logs: Array of 8-12 log entries with timestamps, log_groups, messages, levels (ERROR, WARN, INFO)
   - Include errors that hint at bugs (connection timeouts, permission denied, etc.)
   
2. cloudwatch_metrics: Object with 6-8 metrics showing alarms
   - Format: {{"MetricName": {{"value": 95.0, "unit": "Percent", "alarm": true, "threshold": 80.0}}}}
   
3. vpc_flow_logs: Array of 4-6 VPC flow log entries
   - Include REJECT entries showing suspicious traffic
   - Format: "2 account_id eni_id src_ip dst_ip src_port dst_port protocol packets bytes start end ACCEPT/REJECT OK"
   
4. iam_policies: Object with 2-3 IAM policies
   - Include overly permissive policies with "Action": ["*"] or "Resource": "*"
   
5. cost_data: Object with daily_cost, monthly_projection, top_services array
   - Show cost anomalies
   
6. xray_traces: Array of 2-3 traces with segments showing latency issues
   
7. config_compliance: Array of 5-8 AWS Config rules
   - Include NON_COMPLIANT rules that match the bugs

OUTPUT FORMAT:
{{
  "cloudwatch_logs": [...],
  "cloudwatch_metrics": {{...}},
  "vpc_flow_logs": [...],
  "iam_policies": {{...}},
  "cost_data": {{...}},
  "xray_traces": [...],
  "config_compliance": [...]
}}

Make the evidence realistic and discoverable. Players should be able to find bugs by analyzing this data.
Return ONLY valid JSON, no markdown."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=3000,
            )
            
            content = response.choices[0].message.content
            env_data = self._extract_json(content)
            
            return self._parse_aws_environment(env_data)
            
        except Exception as e:
            logger.error(f"Failed to generate AWS environment: {e}")
            return self._fallback_environment()
    
    def _parse_aws_environment(self, data: Dict) -> AWSEnvironment:
        """Parse LLM output into AWSEnvironment model."""
        now = datetime.utcnow()
        
        # Parse CloudWatch logs
        logs = []
        for log in data.get("cloudwatch_logs", []):
            try:
                logs.append(CloudWatchLog(
                    timestamp=log.get("timestamp", (now - timedelta(minutes=random.randint(1, 30))).isoformat() + "Z"),
                    log_group=log.get("log_group", "/aws/application"),
                    log_stream=log.get("log_stream", "default"),
                    message=log.get("message", "Log entry"),
                    level=log.get("level", "INFO"),
                ))
            except Exception:
                pass
        
        # Parse CloudWatch metrics
        metrics = {}
        for key, metric in data.get("cloudwatch_metrics", {}).items():
            try:
                metrics[key] = CloudWatchMetric(
                    value=float(metric.get("value", 0)),
                    unit=metric.get("unit", "Count"),
                    alarm=bool(metric.get("alarm", False)),
                    threshold=float(metric.get("threshold")) if metric.get("threshold") else None,
                )
            except Exception:
                pass
        
        # Parse VPC flow logs (keep as strings)
        vpc_logs = data.get("vpc_flow_logs", [])
        if not isinstance(vpc_logs, list):
            vpc_logs = []
        
        # Parse IAM policies
        iam_policies = data.get("iam_policies", {})
        if not isinstance(iam_policies, dict):
            iam_policies = {}
        
        # Parse cost data
        cost_data = data.get("cost_data", {})
        if not isinstance(cost_data, dict):
            cost_data = {"daily_cost": 0, "top_services": []}
        
        # Parse X-Ray traces
        traces = []
        for trace in data.get("xray_traces", []):
            try:
                segments = []
                for seg in trace.get("segments", []):
                    segments.append(XRaySegment(
                        name=seg.get("name", "Segment"),
                        duration=float(seg.get("duration", 0.1)),
                        error=bool(seg.get("error", False)),
                        cause=seg.get("cause"),
                    ))
                traces.append(XRayTrace(
                    id=trace.get("id", f"trace-{random.randint(1000, 9999)}"),
                    duration=float(trace.get("duration", 1.0)),
                    segments=segments,
                ))
            except Exception:
                pass
        
        # Parse Config compliance
        config_rules = []
        for rule in data.get("config_compliance", []):
            try:
                config_rules.append(ConfigRule(
                    rule=rule.get("rule", "unknown-rule"),
                    status=rule.get("status", "COMPLIANT"),
                    resource=rule.get("resource"),
                ))
            except Exception:
                pass
        
        return AWSEnvironment(
            cloudwatch_logs=logs,
            cloudwatch_metrics=metrics,
            vpc_flow_logs=vpc_logs,
            iam_policies=iam_policies,
            cost_data=cost_data,
            xray_traces=traces,
            config_compliance=config_rules,
        )
    
    def _fallback_environment(self) -> AWSEnvironment:
        """Generate fallback environment if LLM fails."""
        now = datetime.utcnow()
        return AWSEnvironment(
            cloudwatch_logs=[
                CloudWatchLog(
                    timestamp=(now - timedelta(minutes=5)).isoformat() + "Z",
                    log_group="/aws/application",
                    log_stream="default",
                    message="Application started",
                    level="INFO",
                ),
            ],
            cloudwatch_metrics={
                "CPUUtilization": CloudWatchMetric(value=50.0, unit="Percent", alarm=False),
            },
            vpc_flow_logs=[],
            iam_policies={},
            cost_data={"daily_cost": 100.0, "top_services": []},
            xray_traces=[],
            config_compliance=[],
        )
    
    def _extract_json(self, content: str) -> Dict:
        """Extract JSON from LLM response, handling markdown code blocks."""
        # Remove markdown code blocks if present
        content = re.sub(r'```json\s*', '', content)
        content = re.sub(r'```\s*', '', content)
        content = content.strip()
        
        # Try to parse JSON
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # Try to find JSON object or array in content
            json_match = re.search(r'[\[{].*[\]}]', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
            raise ValueError(f"Could not extract valid JSON from response")
    
    def validate_claim(
        self,
        challenge: BugBountyChallenge,
        claim: Dict,
        cert_code: Optional[str] = None,
        user_level: Optional[str] = None,
    ) -> Dict:
        """
        Validate a user's bug claim using semantic matching with LLM.
        Provides certification-specific and skill-level appropriate feedback.
        
        Args:
            challenge: The challenge being played
            claim: User's bug claim with evidence
            cert_code: Target certification code (e.g., 'SAA', 'solutions-architect-associate')
            user_level: User's skill level (beginner, intermediate, advanced, expert)
        
        Returns:
            Validation result with scoring and personalized feedback
        """
        if not self.client:
            return self._simple_validate(challenge, claim)
        
        target = claim.get("target_id", "")
        bug_type = claim.get("bug_type", "")
        severity = claim.get("severity", "")
        user_claim = claim.get("claim", "")
        evidence = claim.get("evidence", [])
        confidence = claim.get("confidence", 50)
        
        # Prepare hidden bugs for comparison
        bugs_summary = [
            {
                "id": bug.id,
                "type": bug.type,
                "severity": bug.severity,
                "location": bug.location,
                "description": bug.description,
            }
            for bug in challenge.hidden_bugs
        ]
        
        # Build certification and skill level context
        cert_context = ""
        if cert_code:
            cert_context = f"\n\nTARGET CERTIFICATION: {cert_code}\nProvide feedback relevant to this certification's exam focus areas."
        
        skill_context = ""
        if user_level:
            skill_level_guidance = {
                "beginner": "Provide explicit, educational feedback. Explain WHY this is/isn't a bug and what to look for.",
                "intermediate": "Provide feedback with best practices references. Guide them to understand the architectural implications.",
                "advanced": "Provide concise feedback focused on edge cases and optimization opportunities.",
                "expert": "Provide minimal feedback. Focus on enterprise-scale implications and compliance considerations."
            }
            skill_context = f"\n\nUSER SKILL LEVEL: {user_level}\n{skill_level_guidance.get(user_level, skill_level_guidance['intermediate'])}"
        
        prompt = f"""You are a strict Bug Bounty claim validator. Determine if the user ACTUALLY identified a real bug.{cert_context}{skill_context}

HIDDEN BUGS IN THIS CHALLENGE:
{json.dumps(bugs_summary, indent=2)}

USER'S CLAIM:
- Target: {target}
- Bug Type: {bug_type}
- Severity: {severity}
- Description: {user_claim}
- Evidence: {evidence}
- Confidence: {confidence}%

CRITICAL VALIDATION RULES:
1. The user's DESCRIPTION is the PRIMARY factor for validation - NOT the metadata fields.
2. The description MUST meaningfully explain what the bug is and why it's a problem.
3. Vague, empty, or placeholder descriptions like "test", "bug", "issue", "problem", single words, or gibberish = AUTOMATIC REJECTION.
4. Just selecting the right target/type/severity is NOT enough - the user must DESCRIBE the actual issue.
5. The description should demonstrate understanding of the architectural flaw.

MATCHING CRITERIA (all must be satisfied):
- Description explains a specific issue (not vague or placeholder text)
- The explained issue matches or relates to one of the hidden bugs
- Target and bug type are reasonably aligned with the described issue

OUTPUT FORMAT (JSON):
{{
  "matches_bug": true/false,
  "matched_bug_id": "bug_1" or null,
  "match_quality": "exact" / "partial" / "none",
  "explanation": "Why this is/isn't a valid bug claim",
  "pushback": "If rejected, explain what was wrong with the claim",
  "hint": "If rejected, give a subtle hint to guide their thinking"
}}

IMPORTANT: Reject claims with lazy or meaningless descriptions. The user must demonstrate they understand the bug.
Return ONLY valid JSON."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,  # Lower temperature for consistent validation
                max_tokens=500,
            )
            
            content = response.choices[0].message.content
            result = self._extract_json(content)
            
            if result.get("matches_bug"):
                # Find the matched bug for scoring
                matched_bug = None
                for bug in challenge.hidden_bugs:
                    if bug.id == result.get("matched_bug_id"):
                        matched_bug = bug
                        break
                
                if matched_bug:
                    # Calculate points
                    severity_multiplier = {
                        "critical": 2.0,
                        "high": 1.5,
                        "medium": 1.0,
                        "low": 0.5,
                    }.get(matched_bug.severity, 1.0)
                    
                    quality_multiplier = {
                        "exact": 1.0,
                        "partial": 0.7,
                    }.get(result.get("match_quality", "exact"), 1.0)
                    
                    base_points = 100
                    points = int(base_points * severity_multiplier * quality_multiplier)
                    
                    # Bonus for evidence
                    if len(evidence) >= 2:
                        points += 30
                    
                    # Bonus for high confidence on correct answer
                    if confidence >= 80:
                        points += 20
                    
                    return {
                        "correct": True,
                        "points": points,
                        "bug_id": matched_bug.id,
                        "explanation": result.get("explanation", matched_bug.description),
                        "fix_suggestion": matched_bug.fix_suggestion,
                        "severity": matched_bug.severity,
                    }
            
            # Incorrect claim
            return {
                "correct": False,
                "points": -50,
                "pushback": result.get("pushback", "That's not a bug in this architecture."),
                "hint": result.get("hint", "Review the logs and metrics more carefully."),
            }
            
        except Exception as e:
            logger.error(f"LLM validation failed: {e}")
            return self._simple_validate(challenge, claim)
    
    def _simple_validate(self, challenge: BugBountyChallenge, claim: Dict) -> Dict:
        """Simple string-matching validation as fallback."""
        target = claim.get("target_id", "")
        user_claim = claim.get("claim", "").lower()
        
        for bug in challenge.hidden_bugs:
            # Check if target matches
            if bug.location == target or target in bug.evidence_in_logs:
                return {
                    "correct": True,
                    "points": 100,
                    "bug_id": bug.id,
                    "explanation": bug.description,
                    "fix_suggestion": bug.fix_suggestion,
                    "severity": bug.severity,
                }
            
            # Check if description matches
            if any(word in user_claim for word in bug.description.lower().split()[:5]):
                return {
                    "correct": True,
                    "points": 70,
                    "bug_id": bug.id,
                    "explanation": bug.description,
                    "fix_suggestion": bug.fix_suggestion,
                    "severity": bug.severity,
                }
        
        return {
            "correct": False,
            "points": -50,
            "pushback": f"No bug found at {target}. This appears to be working as intended.",
            "hint": "Review the CloudWatch logs and Config rules more carefully.",
        }
    
    def validate_claim_from_bugs(
        self,
        hidden_bugs: List[BugDefinition],
        claim: Dict,
        cert_code: Optional[str] = None,
        user_level: Optional[str] = None,
    ) -> Dict:
        """
        Validate a user's bug claim against a list of hidden bugs.
        Used when challenge is loaded from database instead of memory.
        Provides certification-specific and skill-level appropriate feedback.
        
        Args:
            hidden_bugs: List of BugDefinition objects (the answers)
            claim: User's bug claim with evidence
        
        Returns:
            Validation result with scoring
        """
        if not self.client:
            return self._simple_validate_from_bugs(hidden_bugs, claim)
        
        target = claim.get("target_id", "")
        bug_type = claim.get("bug_type", "")
        severity = claim.get("severity", "")
        user_claim = claim.get("claim", "")
        evidence = claim.get("evidence", [])
        confidence = claim.get("confidence", 50)
        
        # Prepare hidden bugs for comparison
        bugs_summary = [
            {
                "id": bug.id,
                "type": bug.type,
                "severity": bug.severity,
                "location": bug.location,
                "description": bug.description,
            }
            for bug in hidden_bugs
        ]
        
        # Build certification and skill level context (same as validate_claim)
        cert_context = ""
        if cert_code:
            cert_context = f"\n\nTARGET CERTIFICATION: {cert_code}\nProvide feedback relevant to this certification's exam focus areas."
        
        skill_context = ""
        if user_level:
            skill_level_guidance = {
                "beginner": "Provide explicit, educational feedback. Explain WHY this is/isn't a bug and what to look for.",
                "intermediate": "Provide feedback with best practices references. Guide them to understand the architectural implications.",
                "advanced": "Provide concise feedback focused on edge cases and optimization opportunities.",
                "expert": "Provide minimal feedback. Focus on enterprise-scale implications and compliance considerations."
            }
            skill_context = f"\n\nUSER SKILL LEVEL: {user_level}\n{skill_level_guidance.get(user_level, skill_level_guidance['intermediate'])}"
        
        prompt = f"""You are a strict Bug Bounty claim validator. Determine if the user ACTUALLY identified a real bug.{cert_context}{skill_context}

HIDDEN BUGS IN THIS CHALLENGE:
{json.dumps(bugs_summary, indent=2)}

USER'S CLAIM:
- Target: {target}
- Bug Type: {bug_type}
- Severity: {severity}
- Description: {user_claim}
- Evidence: {evidence}
- Confidence: {confidence}%

CRITICAL VALIDATION RULES:
1. The user's DESCRIPTION is the PRIMARY factor for validation - NOT the metadata fields.
2. The description MUST meaningfully explain what the bug is and why it's a problem.
3. Vague, empty, or placeholder descriptions like "test", "bug", "issue", "problem", single words, or gibberish = AUTOMATIC REJECTION.
4. Just selecting the right target/type/severity is NOT enough - the user must DESCRIBE the actual issue.
5. The description should demonstrate understanding of the architectural flaw.

MATCHING CRITERIA (all must be satisfied):
- Description explains a specific issue (not vague or placeholder text)
- The explained issue matches or relates to one of the hidden bugs
- Target and bug type are reasonably aligned with the described issue

OUTPUT FORMAT (JSON):
{{
  "matches_bug": true/false,
  "matched_bug_id": "bug_1" or null,
  "match_quality": "exact" / "partial" / "none",
  "explanation": "Why this is/isn't a valid bug claim",
  "pushback": "If rejected, explain what was wrong with the claim",
  "hint": "If rejected, give a subtle hint to guide their thinking"
}}

IMPORTANT: Reject claims with lazy or meaningless descriptions. The user must demonstrate they understand the bug.
Return ONLY valid JSON."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=500,
            )
            
            content = response.choices[0].message.content
            result = self._extract_json(content)
            
            if result.get("matches_bug"):
                # Find the matched bug for scoring
                matched_bug = None
                for bug in hidden_bugs:
                    if bug.id == result.get("matched_bug_id"):
                        matched_bug = bug
                        break
                
                if matched_bug:
                    # Calculate points
                    severity_multiplier = {
                        "critical": 2.0,
                        "high": 1.5,
                        "medium": 1.0,
                        "low": 0.5,
                    }.get(matched_bug.severity, 1.0)
                    
                    quality_multiplier = {
                        "exact": 1.0,
                        "partial": 0.7,
                    }.get(result.get("match_quality", "exact"), 1.0)
                    
                    base_points = 100
                    points = int(base_points * severity_multiplier * quality_multiplier)
                    
                    if len(evidence) >= 2:
                        points += 30
                    if confidence >= 80:
                        points += 20
                    
                    return {
                        "correct": True,
                        "points": points,
                        "bug_id": matched_bug.id,
                        "explanation": result.get("explanation", matched_bug.description),
                        "fix_suggestion": matched_bug.fix_suggestion,
                        "severity": matched_bug.severity,
                    }
            
            return {
                "correct": False,
                "points": -50,
                "pushback": result.get("pushback", "That's not a bug in this architecture."),
                "hint": result.get("hint", "Review the logs and metrics more carefully."),
            }
            
        except Exception as e:
            logger.error(f"LLM validation failed: {e}")
            return self._simple_validate_from_bugs(hidden_bugs, claim)
    
    def _simple_validate_from_bugs(self, hidden_bugs: List[BugDefinition], claim: Dict) -> Dict:
        """Simple string-matching validation for bugs list."""
        target = claim.get("target_id", "")
        user_claim = claim.get("claim", "").lower()
        
        for bug in hidden_bugs:
            if bug.location == target or target in bug.evidence_in_logs:
                return {
                    "correct": True,
                    "points": 100,
                    "bug_id": bug.id,
                    "explanation": bug.description,
                    "fix_suggestion": bug.fix_suggestion,
                    "severity": bug.severity,
                }
            
            if any(word in user_claim for word in bug.description.lower().split()[:5]):
                return {
                    "correct": True,
                    "points": 70,
                    "bug_id": bug.id,
                    "explanation": bug.description,
                    "fix_suggestion": bug.fix_suggestion,
                    "severity": bug.severity,
                }
        
        return {
            "correct": False,
            "points": -50,
            "pushback": f"No bug found at {target}. This appears to be working as intended.",
            "hint": "Review the CloudWatch logs and Config rules more carefully.",
        }
