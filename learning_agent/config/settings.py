"""
Application settings and constants.
"""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("cloudmigrate-agent")

# Load environment variables from the project root .env file
project_root = Path(__file__).resolve().parent.parent.parent
dotenv_path = project_root / '.env'
load_dotenv(dotenv_path, override=True)


# ============================================
# OPENAI MODEL CONFIGURATION
# ============================================

AVAILABLE_MODELS = {
    "gpt-5.1": {
        "id": "gpt-5.1",
        "name": "GPT-5.1",
        "description": "The best model for coding and agentic tasks with configurable reasoning effort",
        "tier": "premium",
        "context_window": 128000,
    },
    "gpt-5-mini": {
        "id": "gpt-5-mini",
        "name": "GPT-5 mini",
        "description": "A faster, cost-efficient version of GPT-5 for well-defined tasks",
        "tier": "standard",
        "context_window": 128000,
    },
    "gpt-5-nano": {
        "id": "gpt-5-nano",
        "name": "GPT-5 nano",
        "description": "Fastest, most cost-efficient version of GPT-5",
        "tier": "basic",
        "context_window": 64000,
    },
    "gpt-5-pro": {
        "id": "gpt-5-pro",
        "name": "GPT-5 pro",
        "description": "Version of GPT-5 that produces smarter and more precise responses",
        "tier": "enterprise",
        "context_window": 256000,
    },
    "gpt-5": {
        "id": "gpt-5",
        "name": "GPT-5",
        "description": "Previous intelligent reasoning model for coding and agentic tasks",
        "tier": "premium",
        "context_window": 128000,
    },
    "gpt-4.1": {
        "id": "gpt-4.1",
        "name": "GPT-4.1",
        "description": "Smartest non-reasoning model",
        "tier": "standard",
        "context_window": 128000,
    },
}

DEFAULT_MODEL = "gpt-4.1"


# ============================================
# AWS SERVICES CONFIGURATION
# ============================================

AWS_SERVICES = {
    # Compute
    "EC2": "Compute", "Lambda": "Compute", "ECS": "Compute", "EKS": "Compute", 
    "Fargate": "Compute", "Lightsail": "Compute", "Batch": "Compute", "Elastic Beanstalk": "Compute",
    "App Runner": "Compute", "Outposts": "Compute",
    # Storage
    "S3": "Storage", "EBS": "Storage", "EFS": "Storage", "FSx": "Storage", 
    "Storage Gateway": "Storage", "Backup": "Storage", "Snow Family": "Storage",
    # Database
    "RDS": "Database", "DynamoDB": "Database", "Aurora": "Database", "ElastiCache": "Database",
    "Neptune": "Database", "DocumentDB": "Database", "Keyspaces": "Database", "QLDB": "Database",
    "Timestream": "Database", "MemoryDB": "Database", "Redshift": "Database",
    # Networking
    "VPC": "Networking", "CloudFront": "Networking", "Route 53": "Networking", 
    "API Gateway": "Networking", "Direct Connect": "Networking", "Global Accelerator": "Networking",
    "Transit Gateway": "Networking", "PrivateLink": "Networking", "App Mesh": "Networking",
    "Cloud Map": "Networking", "ELB": "Networking", "ALB": "Networking", "NLB": "Networking",
    # Security
    "IAM": "Security", "Cognito": "Security", "Secrets Manager": "Security", 
    "KMS": "Security", "CloudHSM": "Security", "WAF": "Security", "Shield": "Security",
    "GuardDuty": "Security", "Inspector": "Security", "Macie": "Security",
    "Security Hub": "Security", "Detective": "Security", "Firewall Manager": "Security",
    # Management
    "CloudWatch": "Management", "CloudTrail": "Management", "Config": "Management",
    "Systems Manager": "Management", "CloudFormation": "Management", "Service Catalog": "Management",
    "Trusted Advisor": "Management", "Control Tower": "Management", "Organizations": "Management",
    "License Manager": "Management", "Cost Explorer": "Management",
    # Migration
    "Migration Hub": "Migration", "Application Migration Service": "Migration", 
    "Database Migration Service": "Migration", "DMS": "Migration", "DataSync": "Migration",
    "Transfer Family": "Migration", "Snow Family": "Migration", "Application Discovery Service": "Migration",
    # Analytics
    "Athena": "Analytics", "EMR": "Analytics", "Kinesis": "Analytics", "QuickSight": "Analytics",
    "Data Pipeline": "Analytics", "Glue": "Analytics", "Lake Formation": "Analytics",
    "MSK": "Analytics", "OpenSearch": "Analytics", "Elasticsearch": "Analytics",
    # AI/ML
    "SageMaker": "AI/ML", "Rekognition": "AI/ML", "Comprehend": "AI/ML", "Polly": "AI/ML",
    "Transcribe": "AI/ML", "Translate": "AI/ML", "Lex": "AI/ML", "Personalize": "AI/ML",
    "Forecast": "AI/ML", "Textract": "AI/ML", "Bedrock": "AI/ML", "CodeWhisperer": "AI/ML",
    # Integration
    "SQS": "Integration", "SNS": "Integration", "EventBridge": "Integration", 
    "Step Functions": "Integration", "MQ": "Integration", "AppFlow": "Integration",
    # Developer Tools
    "CodeCommit": "Developer Tools", "CodeBuild": "Developer Tools", "CodeDeploy": "Developer Tools",
    "CodePipeline": "Developer Tools", "CodeArtifact": "Developer Tools", "X-Ray": "Developer Tools",
    "Cloud9": "Developer Tools", "CloudShell": "Developer Tools",
}

# Common relationship patterns between AWS services
AWS_RELATIONSHIP_PATTERNS = [
    # Compute relationships
    (["Lambda"], ["S3", "DynamoDB", "SQS", "SNS", "API Gateway", "EventBridge", "Kinesis"], "TRIGGERS"),
    (["EC2", "ECS", "EKS"], ["ELB", "ALB", "NLB"], "BEHIND"),
    (["EC2", "ECS", "EKS", "Lambda"], ["RDS", "Aurora", "DynamoDB", "ElastiCache"], "CONNECTS_TO"),
    (["EC2", "ECS", "EKS"], ["EBS", "EFS"], "USES_STORAGE"),
    # Storage relationships
    (["S3"], ["CloudFront"], "DISTRIBUTED_BY"),
    (["S3"], ["Lambda", "Glue", "Athena"], "TRIGGERS"),
    # Database relationships
    (["RDS", "Aurora"], ["Secrets Manager"], "STORES_CREDENTIALS_IN"),
    (["DynamoDB"], ["DAX"], "CACHED_BY"),
    # Security relationships
    (["EC2", "ECS", "EKS", "Lambda", "RDS"], ["IAM"], "AUTHENTICATED_BY"),
    (["Secrets Manager", "KMS"], ["RDS", "Aurora", "S3", "EBS"], "ENCRYPTS"),
    (["CloudFront", "ALB", "API Gateway"], ["WAF"], "PROTECTED_BY"),
    # Monitoring relationships
    (["EC2", "ECS", "EKS", "Lambda", "RDS", "DynamoDB"], ["CloudWatch"], "MONITORED_BY"),
    (["CloudWatch"], ["SNS"], "ALERTS_VIA"),
    # Migration relationships
    (["Migration Hub"], ["Application Migration Service", "Database Migration Service", "DMS"], "TRACKS"),
    (["DMS"], ["RDS", "Aurora", "DynamoDB", "Redshift"], "MIGRATES_TO"),
]

# Default tenant ID for Neo4j (Community Edition - single DB, use tenant_id property)
DEFAULT_TENANT_ID = "cmiq0pitp0001w5fml5rwn1xe"  # Anais Solutions
