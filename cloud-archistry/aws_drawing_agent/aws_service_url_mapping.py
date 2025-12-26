"""
AWS Service URL Mapping
=======================
Maps user's service IDs to AWS documentation URL patterns.
AWS uses inconsistent naming in their documentation URLs, so we need explicit mappings.
"""

# Mapping from user's service IDs to AWS documentation URL patterns
# Each service can have multiple URL patterns (e.g., different doc sections)
AWS_SERVICE_URL_MAPPING = {
    # Networking & Content Delivery
    "vpc": ["vpc", "VPC"],
    "subnet-public": ["vpc"],
    "subnet-private": ["vpc"],
    "route-table": ["vpc"],
    "nacl": ["vpc"],
    "security-group": ["vpc", "ec2"],
    "internet-gateway": ["vpc"],
    "nat-gateway": ["vpc"],
    "vpc-peering": ["vpc"],
    "transit-gateway": ["vpc", "transit-gateway"],
    "alb": ["elasticloadbalancing", "ElasticLoadBalancing"],
    "nlb": ["elasticloadbalancing", "ElasticLoadBalancing"],
    "route53": ["Route53", "route53"],
    "cloudfront": ["CloudFront", "AmazonCloudFront"],
    "global-accelerator": ["global-accelerator"],
    "vpn-gateway": ["vpn", "vpc"],
    "direct-connect": ["directconnect"],
    "privatelink": ["vpc"],
    "elastic-ip": ["ec2", "AWSEC2"],
    "vpc-endpoint-policy": ["vpc"],
    
    # Compute
    "ec2": ["ec2", "AWSEC2"],
    "auto-scaling": ["autoscaling"],
    "lambda": ["lambda"],
    "elastic-beanstalk": ["elasticbeanstalk"],
    "lightsail": ["lightsail"],
    "batch": ["batch"],
    
    # Containers
    "ecs": ["ecs", "AmazonECS"],
    "eks": ["eks"],
    "fargate": ["ecs", "eks"],
    "ecr": ["ecr", "AmazonECR"],
    "ecr-lifecycle-policy": ["ecr", "AmazonECR"],
    
    # Storage
    "s3": ["s3", "AmazonS3"],
    "ebs": ["ebs", "ec2"],
    "efs": ["efs", "elasticfilesystem"],
    "fsx": ["fsx"],
    "glacier": ["glacier", "amazonglacier"],
    "backup": ["backup", "aws-backup"],
    "storage-gateway": ["storagegateway"],
    "datasync": ["datasync"],
    "s3-lifecycle-policy": ["s3", "AmazonS3"],
    "s3-bucket-policy": ["s3", "AmazonS3"],
    
    # Database
    "rds": ["rds", "AmazonRDS"],
    "aurora": ["rds", "AmazonRDS"],
    "dynamodb": ["dynamodb", "amazondynamodb"],
    "elasticache": ["elasticache", "AmazonElastiCache"],
    "redshift": ["redshift"],
    "neptune": ["neptune"],
    "documentdb": ["documentdb"],
    "memorydb": ["memorydb"],
    "rds-replica": ["rds", "AmazonRDS"],
    "rds-parameter-group": ["rds", "AmazonRDS"],
    "elasticache-parameter-group": ["elasticache", "AmazonElastiCache"],
    
    # Security, Identity & Compliance
    "iam": ["iam", "IAM"],
    "iam-role": ["iam", "IAM"],
    "iam-policy": ["iam", "IAM"],
    "iam-user": ["iam", "IAM"],
    "iam-group": ["iam", "IAM"],
    "iam-identity-center": ["singlesignon", "identitystore"],
    "iam-identity-policy": ["iam", "IAM"],
    "iam-trust-policy": ["iam", "IAM"],
    "kms": ["kms"],
    "secrets-manager": ["secretsmanager"],
    "cognito": ["cognito"],
    "waf": ["waf"],
    "shield": ["shield"],
    "guardduty": ["guardduty"],
    "inspector": ["inspector"],
    "macie": ["macie"],
    "security-hub": ["securityhub"],
    "detective": ["detective"],
    "acm": ["acm"],
    "permission-boundary": ["iam", "IAM"],
    "permission-boundary-policy": ["iam", "IAM"],
    "resource-policy": ["iam", "IAM"],
    "trust-policy": ["iam", "IAM"],
    "identity-provider": ["iam", "IAM"],
    "resource-based-policy": ["iam", "IAM"],
    "waf-rules": ["waf"],
    "backup-policy": ["backup", "aws-backup"],
    
    # Management & Governance
    "cloudwatch": ["cloudwatch", "AmazonCloudWatch"],
    "cloudwatch-logs": ["cloudwatch", "AmazonCloudWatchLogs"],
    "cloudwatch-alarms": ["cloudwatch", "AmazonCloudWatch"],
    "cloudtrail": ["cloudtrail"],
    "systems-manager": ["systems-manager"],
    "config": ["config"],
    "cloudformation": ["cloudformation"],
    "organizations": ["organizations"],
    "scp": ["organizations"],
    "control-tower": ["controltower"],
    "service-catalog": ["servicecatalog"],
    "license-manager": ["license-manager"],
    "resource-groups": ["resource-groups"],
    "xray": ["xray"],
    "x-ray": ["xray"],
    "health-dashboard": ["health"],
    "trusted-advisor": ["trustedadvisor"],
    "scaling-policy": ["autoscaling", "application-autoscaling"],
    "dlm-policy": ["dlm"],
    
    # Application Integration
    "api-gateway": ["apigateway"],
    "eventbridge": ["eventbridge"],
    "sns": ["sns"],
    "sqs": ["sqs"],
    "step-functions": ["step-functions"],
    "appsync": ["appsync"],
    "mq": ["amazon-mq"],
    "ses": ["ses"],
    
    # Analytics
    "athena": ["athena"],
    "glue": ["glue"],
    "emr": ["emr"],
    "kinesis-streams": ["kinesis", "streams"],
    "kinesis-firehose": ["kinesis", "firehose"],
    "kinesis-analytics": ["kinesis", "kinesisanalytics"],
    "msk": ["msk"],
    "quicksight": ["quicksight"],
    "opensearch": ["opensearch"],
    
    # Developer Tools
    "codecommit": ["codecommit"],
    "codepipeline": ["codepipeline"],
    "codebuild": ["codebuild"],
    "codedeploy": ["codedeploy"],
    "codeartifact": ["codeartifact"],
    "cloud9": ["cloud9"],
    
    # Other
    "ebsk": ["emr"],  # EMR on EKS
}


def get_url_patterns_for_service(service_id: str) -> list:
    """
    Get AWS documentation URL patterns for a given service ID.
    
    Args:
        service_id: User's service ID (e.g., 'vpc', 's3', 'lambda')
        
    Returns:
        List of URL patterns to match in AWS documentation URLs
    """
    return AWS_SERVICE_URL_MAPPING.get(service_id, [service_id])


def get_all_url_patterns(service_ids: list) -> list:
    """
    Get all AWS documentation URL patterns for a list of service IDs.
    
    Args:
        service_ids: List of user's service IDs
        
    Returns:
        Deduplicated list of all URL patterns
    """
    all_patterns = []
    for service_id in service_ids:
        patterns = get_url_patterns_for_service(service_id)
        all_patterns.extend(patterns)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_patterns = []
    for pattern in all_patterns:
        if pattern.lower() not in seen:
            seen.add(pattern.lower())
            unique_patterns.append(pattern)
    
    return unique_patterns
