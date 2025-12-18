"""
AWS Documentation Crawl Presets and Filters
============================================
Defines service categories, URL patterns, and crawl presets for focused AWS documentation crawling.
"""

# All AWS services from the user's system (cloud-academy/src/lib/aws-services.ts)
# Extracted from TypeScript file - 132 unique services
SYSTEM_SERVICES = ['vpc', 'subnet-public', 'subnet-private', 'route-table', 'nacl', 'security-group', 'internet-gateway', 'nat-gateway', 'vpc-peering', 'transit-gateway', 'alb', 'nlb', 'ec2', 'auto-scaling', 'lambda', 'ebs', 'efs', 'ecs', 'eks', 'fargate', 'ecr', 'rds', 'aurora', 'dynamodb', 'elasticache', 'redshift', 'neptune', 's3', 'glacier', 'backup', 'iam', 'kms', 'secrets-manager', 'cognito', 'waf', 'shield', 'guardduty', 'api-gateway', 'eventbridge', 'sns', 'sqs', 'cloudwatch', 'cloudtrail', 'systems-manager', 'config', 'route53', 'cloudfront', 'global-accelerator', 'vpn-gateway', 'direct-connect', 'privatelink', 'elastic-ip', 'codecommit', 'codepipeline', 'codebuild', 'codedeploy', 'codeartifact', 'cloud9', 'kinesis-streams', 'kinesis-firehose', 'kinesis-analytics', 'msk', 'athena', 'glue', 'quicksight', 'opensearch', 'iam-role', 'iam-policy', 'permission-boundary', 'acm', 'inspector', 'macie', 'security-hub', 'detective', 'iam-user', 'iam-group', 'resource-policy', 'trust-policy', 'identity-provider', 'iam-identity-center', 'fsx', 'storage-gateway', 'datasync', 'documentdb', 'memorydb', 'rds-replica', 'organizations', 'scp', 'control-tower', 'service-catalog', 'license-manager', 'resource-groups', 'xray', 'cloudwatch-logs', 'cloudwatch-alarms', 'cloudformation', 'health-dashboard', 'trusted-advisor', 'step-functions', 'appsync', 'mq', 'ses', 'batch', 'lightsail', 's3-lifecycle-policy', 's3-bucket-policy', 'iam-identity-policy', 'iam-trust-policy', 'resource-based-policy', 'vpc-endpoint-policy', 'backup-policy', 'scaling-policy', 'dlm-policy', 'ecr-lifecycle-policy', 'permission-boundary-policy', 'rds-parameter-group', 'elasticache-parameter-group', 'waf-rules', 'emr', 'ebsk']

# Core AWS services by category (Tier 1 - Essential)
CORE_SERVICES = {
    "compute": ["ec2", "lambda", "elastic-beanstalk", "lightsail"],
    "storage": ["s3", "ebs", "efs", "fsx"],
    "database": ["rds", "dynamodb", "aurora"],
    "networking": ["vpc", "cloudfront", "route53", "elb"],
    "security": ["iam", "kms", "secrets-manager", "cognito"],
    "monitoring": ["cloudwatch", "cloudtrail", "x-ray"],
}

# Extended services (Tier 2 - Intermediate)
EXTENDED_SERVICES = {
    "containers": ["ecs", "eks", "ecr", "fargate"],
    "serverless": ["lambda", "api-gateway", "step-functions", "eventbridge"],
    "analytics": ["athena", "glue", "emr", "kinesis"],
    "management": ["cloudformation", "systems-manager", "config", "organizations"],
    "messaging": ["sqs", "sns", "eventbridge"],
}

# Advanced services (Tier 3 - Specialized)
ADVANCED_SERVICES = {
    "machine-learning": ["sagemaker", "bedrock", "comprehend", "rekognition"],
    "iot": ["iot-core", "greengrass", "iot-analytics"],
    "migration": ["dms", "application-migration", "transfer-family"],
    "developer-tools": ["codecommit", "codebuild", "codedeploy", "codepipeline"],
}

# URL patterns to include (user guides, getting started, best practices)
INCLUDE_PATTERNS = [
    "*/userguide/*",
    "*/gettingstarted/*",
    "*/developerguide/*",
    "*/best-practices/*",
    "*/architecture-diagrams/*",
    "*/wellarchitected/*",
    "*/whitepapers/*",
    "*/prescriptive-guidance/*",
]

# URL patterns to exclude (API references, old versions, SDKs)
EXCLUDE_PATTERNS = [
    "*/APIReference/*",
    "*/api-reference/*",
    "*/api/*",
    "*/sdk/*",
    "*/cli/*",
    "*/20[0-1][0-9]-*",  # Old versioned APIs (2008-2019)
    "*/latest/api/*",
    "*-api-*",
]


def _flatten_services(service_dict: dict) -> list:
    """Flatten nested service dictionary into a list of service names."""
    services = []
    for category_services in service_dict.values():
        services.extend(category_services)
    return list(set(services))  # Remove duplicates


# Predefined crawl presets
CRAWL_PRESETS = {
    "system-services": {
        "description": "All 132 AWS services from your Cloud Academy system - complete coverage",
        "include_patterns": INCLUDE_PATTERNS,
        "exclude_patterns": EXCLUDE_PATTERNS,
        "services": SYSTEM_SERVICES,
        "max_urls": 15000,
    },
    "architecture-only": {
        "description": "Only AWS architecture diagrams and reference architectures",
        "include_patterns": ["*/architecture-diagrams/*", "*/wellarchitected/*"],
        "exclude_patterns": [],
        "services": [],
        "max_urls": 500,
    },
    "core-services": {
        "description": "Top 15 essential AWS services - compute, storage, database, networking, security",
        "include_patterns": INCLUDE_PATTERNS,
        "exclude_patterns": EXCLUDE_PATTERNS,
        "services": _flatten_services(CORE_SERVICES),
        "max_urls": 2000,
    },
    "learning-essentials": {
        "description": "Core services + architecture diagrams - ideal for learning platform",
        "include_patterns": INCLUDE_PATTERNS + ["*/architecture-diagrams/*"],
        "exclude_patterns": EXCLUDE_PATTERNS,
        "services": _flatten_services(CORE_SERVICES),
        "max_urls": 3000,
    },
    "intermediate": {
        "description": "Core + extended services (containers, serverless, analytics)",
        "include_patterns": INCLUDE_PATTERNS,
        "exclude_patterns": EXCLUDE_PATTERNS,
        "services": _flatten_services({**CORE_SERVICES, **EXTENDED_SERVICES}),
        "max_urls": 5000,
    },
    "comprehensive": {
        "description": "All services including ML, IoT, migration tools",
        "include_patterns": INCLUDE_PATTERNS,
        "exclude_patterns": EXCLUDE_PATTERNS,
        "services": _flatten_services({**CORE_SERVICES, **EXTENDED_SERVICES, **ADVANCED_SERVICES}),
        "max_urls": 10000,
    },
}


def get_preset(preset_name: str) -> dict:
    """Get a crawl preset by name."""
    return CRAWL_PRESETS.get(preset_name, CRAWL_PRESETS["core-services"])


def get_all_presets() -> dict:
    """Get all available presets."""
    return CRAWL_PRESETS


def should_include_url(url: str, include_patterns: list, exclude_patterns: list, services: list = None) -> bool:
    """
    Determine if a URL should be included based on patterns and service filters.
    
    Args:
        url: URL to check
        include_patterns: List of glob patterns to include
        exclude_patterns: List of glob patterns to exclude
        services: Optional list of service names to filter by
        
    Returns:
        True if URL should be included, False otherwise
    """
    import fnmatch
    from config.aws_service_url_mapping import get_all_url_patterns
    
    # First check exclusions (higher priority)
    for pattern in exclude_patterns:
        if fnmatch.fnmatch(url, pattern):
            return False
    
    # Check service filter if provided
    if services:
        # Get AWS documentation URL patterns for the user's service IDs
        url_patterns = get_all_url_patterns(services)
        url_lower = url.lower()
        
        # Check if any of the AWS URL patterns match
        service_match = any(
            f"/{pattern.lower()}/" in url_lower or 
            f"/{pattern.lower()}/latest/" in url_lower or
            f".amazon.com/{pattern.lower()}/" in url_lower
            for pattern in url_patterns
        )
        
        if not service_match:
            return False
    
    # Check inclusions (if no include patterns, include all that passed exclusions)
    if not include_patterns:
        return True
    
    for pattern in include_patterns:
        if fnmatch.fnmatch(url, pattern):
            return True
    
    return False


def filter_sitemap_urls(sitemap_urls: list, preset_name: str = None, custom_filters: dict = None) -> list:
    """
    Filter sitemap URLs based on preset or custom filters.
    
    Args:
        sitemap_urls: List of URLs from sitemap
        preset_name: Name of preset to use (optional)
        custom_filters: Custom filter dict with include_patterns, exclude_patterns, services (optional)
        
    Returns:
        Filtered list of URLs
    """
    if preset_name:
        filters = get_preset(preset_name)
    elif custom_filters:
        filters = custom_filters
    else:
        filters = get_preset("core-services")  # Default
    
    include_patterns = filters.get("include_patterns", [])
    exclude_patterns = filters.get("exclude_patterns", [])
    services = filters.get("services", [])
    max_urls = filters.get("max_urls", 1000)
    
    filtered = []
    for url in sitemap_urls:
        if should_include_url(url, include_patterns, exclude_patterns, services):
            filtered.append(url)
            if len(filtered) >= max_urls:
                break
    
    return filtered
