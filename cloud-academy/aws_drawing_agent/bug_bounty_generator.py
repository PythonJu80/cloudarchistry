"""
Bug Bounty Challenge Generator
===============================
Generates flawed AWS architectures with fake logs, metrics, and production context.
"""

import json
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pydantic import BaseModel


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


class VPCFlowLog(BaseModel):
    """VPC Flow Log entry."""
    version: int
    account_id: str
    interface_id: str
    src_addr: str
    dst_addr: str
    src_port: int
    dst_port: int
    protocol: int
    packets: int
    bytes: int
    start: int
    end: int
    action: str  # ACCEPT, REJECT
    log_status: str


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
    difficulty: str
    bounty_value: int
    time_limit: int  # seconds


class BugBountyGenerator:
    """Generate Bug Bounty challenges with flawed architectures."""
    
    def __init__(self, openai_api_key: Optional[str] = None):
        """Initialize the generator."""
        self.openai_api_key = openai_api_key
        
        # Bug templates for different scenarios
        self.bug_templates = {
            "security": [
                {
                    "description": "RDS publicly accessible without encryption",
                    "severity": "critical",
                    "evidence": ["config_rule", "vpc_flow_log"],
                },
                {
                    "description": "S3 bucket with public read access",
                    "severity": "high",
                    "evidence": ["config_rule", "cloudwatch_metric"],
                },
                {
                    "description": "IAM role with overly permissive policies",
                    "severity": "high",
                    "evidence": ["iam_policy"],
                },
            ],
            "reliability": [
                {
                    "description": "Single AZ deployment, no high availability",
                    "severity": "high",
                    "evidence": ["diagram", "cloudwatch_alarm"],
                },
                {
                    "description": "No auto-scaling configured despite traffic spikes",
                    "severity": "medium",
                    "evidence": ["cloudwatch_metric", "description"],
                },
            ],
            "performance": [
                {
                    "description": "Database in wrong region causing high latency",
                    "severity": "medium",
                    "evidence": ["xray_trace", "cloudwatch_metric"],
                },
                {
                    "description": "Lambda timeout too low for database queries",
                    "severity": "medium",
                    "evidence": ["cloudwatch_log", "xray_trace"],
                },
            ],
            "cost": [
                {
                    "description": "NAT Gateway in every AZ unnecessarily",
                    "severity": "low",
                    "evidence": ["cost_data", "diagram"],
                },
                {
                    "description": "Oversized RDS instance for workload",
                    "severity": "medium",
                    "evidence": ["cost_data", "cloudwatch_metric"],
                },
            ],
        }
    
    def generate_challenge(
        self,
        difficulty: str = "intermediate",
        certification_code: Optional[str] = None,
        scenario_type: str = "ecommerce"
    ) -> BugBountyChallenge:
        """
        Generate a complete Bug Bounty challenge.
        
        Args:
            difficulty: beginner, intermediate, advanced
            certification_code: Target AWS certification
            scenario_type: Type of scenario (ecommerce, data_pipeline, etc.)
        
        Returns:
            Complete challenge with diagram, logs, and hidden bugs
        """
        challenge_id = f"BB-{random.randint(1000, 9999)}"
        
        # Generate base architecture
        diagram = self._generate_flawed_diagram(scenario_type, difficulty)
        
        # Generate description with contradictions
        description = self._generate_description(scenario_type, difficulty)
        
        # Generate hidden bugs
        bug_count = {"beginner": 3, "intermediate": 5, "advanced": 7}[difficulty]
        hidden_bugs = self._generate_bugs(diagram, description, bug_count)
        
        # Generate AWS environment with evidence
        aws_environment = self._generate_aws_environment(diagram, hidden_bugs)
        
        # Calculate bounty value
        bounty_value = sum(
            {"critical": 200, "high": 100, "medium": 50, "low": 25}[bug.severity]
            for bug in hidden_bugs
        )
        
        # Time limit based on difficulty
        time_limit = {"beginner": 900, "intermediate": 600, "advanced": 450}[difficulty]
        
        return BugBountyChallenge(
            challenge_id=challenge_id,
            diagram=diagram,
            description=description,
            aws_environment=aws_environment,
            hidden_bugs=hidden_bugs,
            difficulty=difficulty,
            bounty_value=bounty_value,
            time_limit=time_limit,
        )
    
    def _generate_flawed_diagram(self, scenario_type: str, difficulty: str) -> Dict:
        """Generate a diagram with intentional flaws."""
        # Base e-commerce architecture
        nodes = [
            {
                "id": "node_alb_1",
                "type": "aws",
                "position": {"x": 100, "y": 100},
                "data": {
                    "label": "Application Load Balancer",
                    "service": "alb",
                    "service_id": "alb",
                },
            },
            {
                "id": "node_ec2_1",
                "type": "aws",
                "position": {"x": 100, "y": 250},
                "data": {
                    "label": "EC2 Instance (us-east-1a)",
                    "service": "ec2",
                    "service_id": "ec2",
                },
            },
            {
                "id": "node_rds_1",
                "type": "aws",
                "position": {"x": 100, "y": 400},
                "data": {
                    "label": "RDS PostgreSQL",
                    "service": "rds",
                    "service_id": "rds",
                    "publicly_accessible": True,  # BUG!
                    "encrypted": False,  # BUG!
                },
            },
            {
                "id": "node_s3_1",
                "type": "aws",
                "position": {"x": 300, "y": 250},
                "data": {
                    "label": "S3 Bucket",
                    "service": "s3",
                    "service_id": "s3",
                },
            },
        ]
        
        edges = [
            {
                "id": "edge_1",
                "source": "node_alb_1",
                "target": "node_ec2_1",
                "type": "default",
            },
            {
                "id": "edge_2",
                "source": "node_ec2_1",
                "target": "node_rds_1",
                "type": "default",
            },
            {
                "id": "edge_3",
                "source": "node_ec2_1",
                "target": "node_s3_1",
                "type": "default",
            },
        ]
        
        return {"nodes": nodes, "edges": edges}
    
    def _generate_description(self, scenario_type: str, difficulty: str) -> str:
        """Generate use case description with contradictions."""
        return """E-commerce Platform Architecture

Requirements:
• Handle 10 million requests per day
• 99.99% uptime SLA (multi-region deployment)
• PCI DSS compliant for payment processing
• Sub-100ms response time globally
• Auto-scaling based on traffic
• Encrypted data at rest and in transit
• Real-time inventory updates

Current Setup:
• Application Load Balancer distributing traffic
• EC2 instances running application servers
• RDS PostgreSQL for transactional data
• S3 for static assets and backups
• CloudFront CDN for global distribution

The architecture is designed for high availability with automatic failover
and disaster recovery capabilities across multiple availability zones."""
    
    def _generate_bugs(
        self, diagram: Dict, description: str, count: int
    ) -> List[BugDefinition]:
        """Generate hidden bugs based on diagram and description."""
        bugs = []
        
        # Bug 1: RDS publicly accessible
        bugs.append(
            BugDefinition(
                id="bug_1",
                type="security",
                severity="critical",
                location="node_rds_1",
                description="RDS instance is publicly accessible without encryption",
                evidence_in_logs=["cloudwatch_log_2", "config_rule_1", "vpc_flow_log_1"],
                blast_radius="high",
                fix_suggestion="Move RDS to private subnet, enable encryption at rest",
            )
        )
        
        # Bug 2: Single AZ (contradicts description)
        bugs.append(
            BugDefinition(
                id="bug_2",
                type="mismatch",
                severity="high",
                location="architecture",
                description="Claims multi-AZ deployment but only single AZ shown",
                evidence_in_logs=["description_line_8", "diagram"],
                blast_radius="high",
                fix_suggestion="Deploy across multiple availability zones",
            )
        )
        
        # Bug 3: No auto-scaling
        bugs.append(
            BugDefinition(
                id="bug_3",
                type="reliability",
                severity="medium",
                location="node_ec2_1",
                description="Fixed EC2 instance, no auto-scaling despite requirement",
                evidence_in_logs=["description_line_5", "cloudwatch_metric_1"],
                blast_radius="medium",
                fix_suggestion="Implement Auto Scaling Group with target tracking",
            )
        )
        
        # Bug 4: IAM overly permissive
        bugs.append(
            BugDefinition(
                id="bug_4",
                type="security",
                severity="high",
                location="iam_policy",
                description="EC2 IAM role has wildcard permissions",
                evidence_in_logs=["iam_policy_1"],
                blast_radius="high",
                fix_suggestion="Apply principle of least privilege, scope permissions",
            )
        )
        
        # Bug 5: No CloudFront (contradicts description)
        bugs.append(
            BugDefinition(
                id="bug_5",
                type="mismatch",
                severity="medium",
                location="description",
                description="Description mentions CloudFront CDN but not in diagram",
                evidence_in_logs=["description_line_13", "diagram"],
                blast_radius="medium",
                fix_suggestion="Add CloudFront distribution or remove from description",
            )
        )
        
        return bugs[:count]
    
    def _generate_aws_environment(
        self, diagram: Dict, bugs: List[BugDefinition]
    ) -> AWSEnvironment:
        """Generate fake AWS logs, metrics, and environment data."""
        now = datetime.utcnow()
        
        # CloudWatch Logs
        logs = [
            CloudWatchLog(
                timestamp=(now - timedelta(minutes=5)).isoformat() + "Z",
                log_group="/aws/ec2/application",
                log_stream="i-abc123/application.log",
                message="INFO: Application started successfully",
                level="INFO",
            ),
            CloudWatchLog(
                timestamp=(now - timedelta(minutes=3)).isoformat() + "Z",
                log_group="/aws/ec2/application",
                log_stream="i-abc123/application.log",
                message="ERROR: Unable to connect to RDS instance - timeout after 30s",
                level="ERROR",
            ),
            CloudWatchLog(
                timestamp=(now - timedelta(minutes=2)).isoformat() + "Z",
                log_group="/aws/rds/postgres-prod",
                log_stream="error.log",
                message="WARN: Connection from 203.0.113.45 rejected - not in security group",
                level="WARN",
            ),
            CloudWatchLog(
                timestamp=(now - timedelta(minutes=1)).isoformat() + "Z",
                log_group="/aws/ec2/application",
                log_stream="i-abc123/application.log",
                message="ERROR: High latency detected - database query took 2.8s",
                level="ERROR",
            ),
        ]
        
        # CloudWatch Metrics
        metrics = {
            "RDS_CPUUtilization": CloudWatchMetric(
                value=95.0, unit="Percent", alarm=True, threshold=80.0
            ),
            "EC2_CPUUtilization": CloudWatchMetric(
                value=78.0, unit="Percent", alarm=False, threshold=80.0
            ),
            "ALB_TargetResponseTime": CloudWatchMetric(
                value=3200.0, unit="Milliseconds", alarm=True, threshold=1000.0
            ),
            "RDS_DatabaseConnections": CloudWatchMetric(
                value=245.0, unit="Count", alarm=False, threshold=300.0
            ),
        }
        
        # VPC Flow Logs (showing rejected connections to RDS)
        vpc_logs = [
            "2 123456789012 eni-abc123 203.0.113.45 10.0.1.50 49152 5432 6 5 500 1639920323 1639920383 REJECT OK",
            "2 123456789012 eni-def456 10.0.1.10 10.0.1.50 49153 5432 6 10 5000 1639920323 1639920383 ACCEPT OK",
        ]
        
        # IAM Policies (overly permissive)
        iam_policies = {
            "ec2_instance_role": {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": ["rds:*", "s3:*", "dynamodb:*"],
                        "Resource": "*",
                    }
                ],
            }
        }
        
        # Cost Data
        cost_data = {
            "daily_cost": 847.32,
            "monthly_projection": 25419.60,
            "top_services": [
                CostItem(service="RDS", cost=456.20, trend="+45%").dict(),
                CostItem(service="EC2", cost=234.10, trend="+12%").dict(),
                CostItem(service="NAT Gateway", cost=89.50, trend="+5%").dict(),
                CostItem(service="S3", cost=67.52, trend="-3%").dict(),
            ],
        }
        
        # X-Ray Traces
        traces = [
            XRayTrace(
                id="1-abc-123",
                duration=3.2,
                segments=[
                    XRaySegment(name="ALB", duration=0.1, error=False),
                    XRaySegment(name="EC2-Application", duration=2.9, error=False),
                    XRaySegment(
                        name="RDS-Query", duration=2.5, error=True, cause="Timeout"
                    ),
                ],
            )
        ]
        
        # Config Compliance
        config_rules = [
            ConfigRule(
                rule="rds-storage-encrypted",
                status="NON_COMPLIANT",
                resource="rds-postgres-prod",
            ),
            ConfigRule(
                rule="rds-instance-public-access-check",
                status="NON_COMPLIANT",
                resource="rds-postgres-prod",
            ),
            ConfigRule(
                rule="s3-bucket-public-read-prohibited", status="COMPLIANT"
            ),
            ConfigRule(rule="vpc-flow-logs-enabled", status="NON_COMPLIANT"),
        ]
        
        return AWSEnvironment(
            cloudwatch_logs=logs,
            cloudwatch_metrics=metrics,
            vpc_flow_logs=vpc_logs,
            iam_policies=iam_policies,
            cost_data=cost_data,
            xray_traces=traces,
            config_compliance=config_rules,
        )
    
    def validate_claim(
        self,
        challenge: BugBountyChallenge,
        claim: Dict,
    ) -> Dict:
        """
        Validate a user's bug claim.
        
        Args:
            challenge: The challenge being played
            claim: User's bug claim with evidence
        
        Returns:
            Validation result with scoring
        """
        target = claim.get("target_id")
        bug_type = claim.get("bug_type")
        severity = claim.get("severity")
        user_claim = claim.get("claim", "")
        evidence = claim.get("evidence", [])
        confidence = claim.get("confidence", 50)
        
        # Find matching bug
        matching_bug = None
        for bug in challenge.hidden_bugs:
            if bug.location == target or target in bug.evidence_in_logs:
                matching_bug = bug
                break
        
        if matching_bug:
            # Correct bug found
            severity_multiplier = {
                "critical": 2.0,
                "high": 1.5,
                "medium": 1.0,
                "low": 0.5,
            }[matching_bug.severity]
            
            base_points = 100
            points = int(base_points * severity_multiplier)
            
            # Bonus for evidence
            if len(evidence) >= 2:
                points += 30
            
            # Bonus for confidence accuracy
            if confidence >= 80:
                points += 20
            
            return {
                "correct": True,
                "points": points,
                "bug_id": matching_bug.id,
                "explanation": matching_bug.description,
                "fix_suggestion": matching_bug.fix_suggestion,
                "evidence_found": evidence,
                "severity": matching_bug.severity,
            }
        else:
            # False positive
            return {
                "correct": False,
                "points": -50,
                "pushback": f"No bug found at {target}. This appears to be working as intended.",
                "hint": "Review the CloudWatch logs and Config rules more carefully.",
            }
