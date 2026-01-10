"""
AWS Pricing Service
====================
Fetches live pricing from AWS Price List API for architecture cost estimation.
"""
import logging
import os
from typing import Dict, List, Optional
from functools import lru_cache

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

logger = logging.getLogger(__name__)

# AWS service code mapping from diagram serviceId to AWS Pricing API service codes
SERVICE_CODE_MAP = {
    # Compute
    "lambda": "AWSLambda",
    "ec2": "AmazonEC2",
    "ecs": "AmazonECS",
    "fargate": "AmazonECS",  # Fargate is part of ECS pricing
    "eks": "AmazonEKS",
    "lightsail": "AmazonLightsail",
    "batch": "AWSBatch",
    
    # Storage
    "s3": "AmazonS3",
    "ebs": "AmazonEC2",  # EBS is part of EC2 pricing
    "efs": "AmazonEFS",
    "fsx": "AmazonFSx",
    "glacier": "AmazonGlacier",
    
    # Database
    "rds": "AmazonRDS",
    "aurora": "AmazonRDS",
    "dynamodb": "AmazonDynamoDB",
    "elasticache": "AmazonElastiCache",
    "neptune": "AmazonNeptune",
    "documentdb": "AmazonDocDB",
    "redshift": "AmazonRedshift",
    
    # Networking
    "api-gateway": "AmazonApiGateway",
    "cloudfront": "AmazonCloudFront",
    "route53": "AmazonRoute53",
    "elb": "AWSELB",
    "alb": "AWSELB",
    "nlb": "AWSELB",
    "vpc": "AmazonVPC",
    "nat-gateway": "AmazonEC2",  # NAT Gateway is part of EC2/VPC pricing
    "transit-gateway": "AWSTransitGateway",
    
    # Security
    "waf": "awswaf",
    "shield": "AWSShield",
    "kms": "awskms",
    "secrets-manager": "AWSSecretsManager",
    "cognito": "AmazonCognito",
    "iam": None,  # IAM is free
    
    # Application Integration
    "sqs": "AWSQueueService",
    "sns": "AmazonSNS",
    "eventbridge": "AmazonEventBridge",
    "step-functions": "AWSStepFunctions",
    "mq": "AmazonMQ",
    
    # Management & Monitoring
    "cloudwatch": "AmazonCloudWatch",
    "cloudwatch-logs": "AmazonCloudWatch",
    "cloudtrail": "AWSCloudTrail",
    "config": "AWSConfig",
    "systems-manager": "AWSSystemsManager",
    
    # Analytics
    "kinesis": "AmazonKinesis",
    "athena": "AmazonAthena",
    "glue": "AWSGlue",
    "emr": "ElasticMapReduce",
    "quicksight": "AmazonQuickSight",
}

# Typical monthly usage assumptions for cost estimation
# These are conservative estimates for a small-to-medium workload
USAGE_ASSUMPTIONS = {
    "AWSLambda": {
        "requests": 1_000_000,  # 1M requests/month
        "duration_ms": 200,  # Average 200ms per invocation
        "memory_mb": 256,
        "estimated_monthly_usd": 4.00,  # ~$4/month for 1M requests @ 200ms
    },
    "AmazonApiGateway": {
        "requests": 1_000_000,  # 1M API calls/month
        "estimated_monthly_usd": 3.50,  # $3.50 per million requests
    },
    "AmazonS3": {
        "storage_gb": 100,  # 100GB storage
        "requests": 100_000,  # 100K requests
        "estimated_monthly_usd": 2.50,  # ~$2.30 storage + requests
    },
    "AmazonDynamoDB": {
        "wcu": 25,  # Write capacity units
        "rcu": 25,  # Read capacity units
        "storage_gb": 25,
        "estimated_monthly_usd": 25.00,  # On-demand pricing estimate
    },
    "AmazonRDS": {
        "instance_type": "db.t3.medium",
        "hours": 730,  # Full month
        "storage_gb": 100,
        "estimated_monthly_usd": 75.00,  # ~$50 instance + $10 storage + backups
    },
    "AmazonEC2": {
        "instance_type": "t3.medium",
        "hours": 730,
        "estimated_monthly_usd": 30.00,  # ~$0.0416/hr * 730
    },
    "AmazonECS": {
        "vcpu_hours": 730,  # 1 vCPU full month
        "memory_gb_hours": 2920,  # 4GB * 730 hours
        "estimated_monthly_usd": 45.00,  # Fargate pricing
    },
    "AmazonCloudFront": {
        "data_transfer_gb": 100,
        "requests": 1_000_000,
        "estimated_monthly_usd": 10.00,
    },
    "AmazonCloudWatch": {
        "metrics": 50,
        "logs_gb": 10,
        "estimated_monthly_usd": 8.00,
    },
    "AWSQueueService": {  # SQS
        "requests": 1_000_000,
        "estimated_monthly_usd": 0.40,
    },
    "AmazonSNS": {
        "requests": 100_000,
        "estimated_monthly_usd": 0.50,
    },
    "AmazonCognito": {
        "mau": 1000,  # Monthly active users
        "estimated_monthly_usd": 5.00,  # First 50K MAU free, then $0.0055/MAU
    },
    "AWSSecretsManager": {
        "secrets": 10,
        "api_calls": 10_000,
        "estimated_monthly_usd": 4.00,  # $0.40/secret/month
    },
    "awskms": {
        "keys": 5,
        "requests": 10_000,
        "estimated_monthly_usd": 5.00,  # $1/key/month
    },
    "AmazonElastiCache": {
        "node_type": "cache.t3.micro",
        "nodes": 1,
        "estimated_monthly_usd": 12.00,
    },
    "AWSELB": {
        "hours": 730,
        "lcu": 10,  # Load balancer capacity units
        "estimated_monthly_usd": 22.00,  # ~$16 fixed + LCU charges
    },
    "AmazonRoute53": {
        "hosted_zones": 1,
        "queries": 1_000_000,
        "estimated_monthly_usd": 1.00,
    },
    "AmazonVPC": {
        "nat_gateway_hours": 730,
        "data_processed_gb": 100,
        "estimated_monthly_usd": 45.00,  # NAT Gateway: $0.045/hr + $0.045/GB
    },
    "AWSStepFunctions": {
        "state_transitions": 100_000,
        "estimated_monthly_usd": 2.50,
    },
    "AWSGlue": {
        "dpu_hours": 10,
        "estimated_monthly_usd": 4.40,  # $0.44/DPU-hour
    },
    "AmazonAthena": {
        "data_scanned_tb": 0.1,
        "estimated_monthly_usd": 0.50,  # $5/TB scanned
    },
    "AmazonKinesis": {
        "shards": 1,
        "hours": 730,
        "estimated_monthly_usd": 11.00,  # $0.015/shard-hour
    },
    "awswaf": {
        "web_acls": 1,
        "rules": 10,
        "requests": 1_000_000,
        "estimated_monthly_usd": 11.00,  # $5 ACL + $1/rule + requests
    },
}


class AWSPricingService:
    """Service to fetch and calculate AWS pricing estimates."""
    
    def __init__(self, region: str = "us-east-1"):
        self.region = region
        self._client = None
        self._initialized = False
        
    def _get_client(self):
        """Lazy initialization of boto3 pricing client."""
        if self._client is None:
            try:
                # Pricing API is only available in us-east-1 and ap-south-1
                self._client = boto3.client(
                    'pricing',
                    region_name='us-east-1',
                    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
                )
                self._initialized = True
            except (NoCredentialsError, ClientError) as e:
                logger.warning(f"AWS credentials not available for pricing API: {e}")
                self._initialized = False
        return self._client
    
    def get_service_price(self, service_code: str) -> Optional[Dict]:
        """
        Get pricing information for an AWS service.
        
        Note: The AWS Pricing API is complex and returns detailed SKU-level pricing.
        For simplicity, we use pre-calculated estimates based on typical usage.
        """
        client = self._get_client()
        if not client:
            return None
            
        try:
            # This is a simplified example - real implementation would need
            # to filter by specific attributes (region, instance type, etc.)
            response = client.get_products(
                ServiceCode=service_code,
                Filters=[
                    {
                        'Type': 'TERM_MATCH',
                        'Field': 'location',
                        'Value': 'US East (N. Virginia)'
                    }
                ],
                MaxResults=1
            )
            
            if response.get('PriceList'):
                return response['PriceList'][0]
            return None
            
        except ClientError as e:
            logger.error(f"Error fetching price for {service_code}: {e}")
            return None
    
    def estimate_architecture_cost(
        self,
        services: List[str],
        region: str = "us-east-1"
    ) -> Dict:
        """
        Estimate monthly cost for an architecture based on services used.
        
        Args:
            services: List of service IDs from the diagram (e.g., ['lambda', 'api-gateway', 's3'])
            region: AWS region for pricing
            
        Returns:
            Dict with cost breakdown and total
        """
        cost_breakdown = []
        total_monthly = 0.0
        total_yearly = 0.0
        
        # Track unique services to avoid double-counting
        seen_service_codes = set()
        
        for service_id in services:
            # Normalize service ID
            service_id_lower = service_id.lower().replace(" ", "-").replace("amazon", "").replace("aws", "").strip("-")
            
            # Map to AWS service code
            service_code = SERVICE_CODE_MAP.get(service_id_lower)
            
            if not service_code or service_code in seen_service_codes:
                continue
                
            seen_service_codes.add(service_code)
            
            # Get usage assumptions and estimated cost
            usage = USAGE_ASSUMPTIONS.get(service_code, {})
            monthly_cost = usage.get("estimated_monthly_usd", 0)
            
            if monthly_cost > 0:
                cost_breakdown.append({
                    "service": service_id,
                    "service_code": service_code,
                    "monthly_usd": monthly_cost,
                    "usage_assumptions": {k: v for k, v in usage.items() if k != "estimated_monthly_usd"}
                })
                total_monthly += monthly_cost
        
        total_yearly = total_monthly * 12
        
        # Add 15% buffer for data transfer, misc charges
        buffer_monthly = total_monthly * 0.15
        buffer_yearly = total_yearly * 0.15
        
        return {
            "breakdown": cost_breakdown,
            "subtotal_monthly": round(total_monthly, 2),
            "subtotal_yearly": round(total_yearly, 2),
            "buffer_monthly": round(buffer_monthly, 2),
            "buffer_yearly": round(buffer_yearly, 2),
            "total_monthly": round(total_monthly + buffer_monthly, 2),
            "total_yearly": round(total_yearly + buffer_yearly, 2),
            "currency": "USD",
            "region": region,
            "disclaimer": "Estimates based on typical small-to-medium workload usage patterns. Actual costs vary based on usage, configuration, and current AWS pricing.",
            "pricing_date": "January 2026",
        }


# Singleton instance
_pricing_service: Optional[AWSPricingService] = None


def get_pricing_service() -> AWSPricingService:
    """Get or create the pricing service singleton."""
    global _pricing_service
    if _pricing_service is None:
        _pricing_service = AWSPricingService()
    return _pricing_service


def estimate_architecture_cost(services: List[str], region: str = "us-east-1") -> Dict:
    """
    Convenience function to estimate architecture cost.
    
    Args:
        services: List of AWS service names/IDs from the diagram
        region: AWS region
        
    Returns:
        Cost estimation dict
    """
    service = get_pricing_service()
    return service.estimate_architecture_cost(services, region)
