/**
 * AWS Placement Rules Engine
 * 
 * Enforces AWS architecture conventions for diagram building.
 * Validates where services can be placed and provides educational feedback.
 */

// ============================================
// PLACEMENT RULES - What can go WHERE
// ============================================

export interface PlacementRule {
  allowedChildren: string[];
  rejectedWith: Record<string, string>;  // serviceId -> pro tip message
}

export const PLACEMENT_RULES: Record<string, PlacementRule> = {
  // VPC - can contain subnets and gateways
  "vpc": {
    allowedChildren: [
      "subnet-public", "subnet-private", "subnet",
      "internet-gateway", "vpn-gateway", "transit-gateway",
      "nat-gateway",  // NAT GW is in public subnet, but can be direct child of VPC in simple diagrams
      "alb", "nlb", "elb",  // Load balancers span subnets but are VPC resources
      "route-table", "nacl", "security-group",  // VPC networking components
      "efs",  // EFS mount targets are in VPC
    ],
    rejectedWith: {
      "s3": "☁️ S3 is a Regional Service - it exists OUTSIDE your VPC. Connect to it using a VPC Endpoint or NAT Gateway.",
      "dynamodb": "☁️ DynamoDB is a Regional Service - it lives outside VPCs. Use a VPC Endpoint for private access.",
      "cloudfront": "🌐 CloudFront is a Global Edge Service - it sits IN FRONT of your VPC, not inside it.",
      "route53": "🌐 Route 53 is Global DNS - it routes traffic TO your VPC from the internet.",
      "iam": "🔐 IAM is a Global Service - it controls WHO can access resources, not WHERE they live.",
      "cognito": "🔐 Cognito is a Regional Service - it handles auth outside your VPC.",
      "kms": "🔑 KMS is a Regional Service - encryption keys are managed outside VPCs.",
      "cloudwatch": "📊 CloudWatch is a Regional Service - it monitors your VPC from outside.",
      "sns": "📬 SNS is a Regional Service - pub/sub messaging lives outside VPCs.",
      "sqs": "📬 SQS is a Regional Service - message queues exist outside VPCs.",
      "lambda": "⚡ Lambda functions live OUTSIDE VPCs by default. You can configure VPC access, but the function itself is regional.",
      "api-gateway": "🚪 API Gateway is a Regional Service - it's the entry point TO your VPC.",
      "waf": "🛡️ WAF is attached to CloudFront or ALB - it's not a VPC resource itself.",
      "secrets-manager": "🔐 Secrets Manager is Regional - access it via VPC Endpoint.",
      "ecr": "📦 ECR is a Regional Service - container registry lives outside VPCs.",
    }
  },

  // Public Subnet - internet-facing resources ONLY
  "subnet-public": {
    allowedChildren: [
      "nat-gateway", "internet-gateway",
      "alb", "nlb", "elb",
      "bastion", "ec2",  // Bastion hosts, public-facing EC2
      "auto-scaling",
    ],
    rejectedWith: {
      "rds": "🔒 SECURITY RISK! Databases should NEVER be in public subnets. Put RDS in a PRIVATE subnet and access via your app tier.",
      "aurora": "🔒 SECURITY RISK! Aurora clusters must be in PRIVATE subnets. Never expose databases to the internet!",
      "elasticache": "🔒 Cache layers belong in PRIVATE subnets - Redis/Memcached should not be internet-accessible.",
      "fargate": "💡 Fargate tasks with app logic should be in PRIVATE subnets, behind an ALB in the public subnet.",
      "ecs": "💡 ECS services typically run in PRIVATE subnets for security. Use ALB in public subnet to route traffic.",
      "eks": "💡 EKS worker nodes should be in PRIVATE subnets. Only the ALB/NLB should be public.",
      "lambda": "⚡ Lambda doesn't go IN subnets - it can be configured to ACCESS private subnets via ENI.",
      "msk": "🔒 MSK (Kafka) clusters should be in PRIVATE subnets - they don't need direct internet access.",
      "opensearch": "🔒 OpenSearch domains should be in PRIVATE subnets for security.",
      "mq": "🔒 Amazon MQ brokers should be in PRIVATE subnets - access via VPC endpoints.",
      "documentdb": "🔒 DocumentDB clusters must be in PRIVATE subnets - never expose databases to the internet!",
      "memorydb": "🔒 MemoryDB clusters should be in PRIVATE subnets for security.",
      "neptune": "🔒 Neptune graph databases must be in PRIVATE subnets.",
      "redshift": "🔒 Redshift clusters should be in PRIVATE subnets - use VPN or Direct Connect for access.",
    }
  },

  // Private Subnet - internal/protected resources
  "subnet-private": {
    allowedChildren: [
      "ec2", "ecs", "fargate", "eks",
      "rds", "aurora", "elasticache", "neptune", "redshift",
      "documentdb", "memorydb", "rds-replica",  // Additional databases
      "msk", "opensearch", "mq",  // Analytics/messaging that need VPC
      "fsx",  // Storage in VPC
      "lambda",  // Lambda with VPC config
      "auto-scaling", "ebs",
    ],
    rejectedWith: {
      "nat-gateway": "🚪 NAT Gateway must be in a PUBLIC subnet! It routes private subnet traffic to the internet.",
      "internet-gateway": "🚪 Internet Gateway attaches to the VPC level, not to subnets.",
      "alb": "🌐 ALB needs to be in PUBLIC subnets to receive internet traffic. It then routes to private resources.",
      "nlb": "🌐 NLB typically goes in PUBLIC subnets for internet-facing apps.",
      "bastion": "🔐 Bastion hosts need to be in PUBLIC subnets so you can SSH to them from the internet.",
    }
  },

  // Generic subnet (when type not specified)
  "subnet": {
    allowedChildren: [
      "ec2", "ecs", "fargate", "eks",
      "rds", "aurora", "elasticache", "neptune", "redshift",
      "documentdb", "memorydb", "rds-replica",
      "msk", "opensearch", "mq", "fsx",
      "nat-gateway", "alb", "nlb",
      "auto-scaling", "lambda",
    ],
    rejectedWith: {
      "s3": "☁️ S3 is a Regional Service - it exists outside subnets and VPCs.",
      "dynamodb": "☁️ DynamoDB is Regional - it doesn't go inside subnets.",
      "cloudfront": "🌐 CloudFront is Global - it's an edge service outside your VPC.",
      "route53": "🌐 Route 53 is Global DNS - it exists outside VPCs.",
      "internet-gateway": "🚪 Internet Gateway attaches at the VPC level, not subnet level.",
    }
  },

  // Security Group - logical grouping
  "securityGroup": {
    allowedChildren: ["ec2", "ecs", "fargate", "rds", "aurora", "elasticache", "alb", "nlb"],
    rejectedWith: {
      "subnet-public": "📦 Subnets contain security groups, not the other way around.",
      "subnet-private": "📦 Subnets contain security groups, not the other way around.",
      "vpc": "📦 VPCs contain security groups, not the other way around.",
    }
  },

  // Auto Scaling Group
  "autoScaling": {
    allowedChildren: ["ec2", "ecs", "fargate"],
    rejectedWith: {
      "rds": "📊 RDS has its own scaling (Read Replicas, Aurora Auto Scaling) - not EC2 Auto Scaling.",
      "elasticache": "📊 ElastiCache has its own scaling mechanisms.",
    }
  },

  // Canvas root - global/regional services
  "canvas": {
    allowedChildren: [
      "vpc", "vpc-peering", "transit-gateway",
      // Global services
      "cloudfront", "route53", "iam", "waf", "shield", "global-accelerator",
      // Regional services (outside VPC)
      "s3", "dynamodb", "lambda", "api-gateway",
      "cognito", "kms", "cloudwatch", "cloudtrail", "sns", "sqs",
      "secrets-manager", "ecr", "step-functions",
      "eventbridge", "kinesis-streams", "kinesis-firehose", "kinesis-analytics",
      // Backup & monitoring
      "backup", "glacier", "guardduty", "config", "systems-manager", "xray",
      "cloudwatch-logs", "cloudwatch-alarms", "trusted-advisor", "health-dashboard",
      // DevOps & CI/CD (regional, outside VPC)
      "codecommit", "codepipeline", "codebuild", "codedeploy", "codeartifact", "cloud9",
      "cloudformation",
      // Analytics (regional, outside VPC)
      "athena", "glue", "quicksight",
      // Security (regional, outside VPC)
      "iam-role", "iam-policy", "permission-boundary", "acm",
      "inspector", "macie", "security-hub", "detective",
      "iam-user", "iam-group", "resource-policy", "trust-policy",
      "identity-provider", "iam-identity-center",
      // Governance (global/regional)
      "organizations", "scp", "control-tower", "service-catalog", "license-manager", "resource-groups",
      // Integration
      "appsync", "ses",
      // Storage (regional)
      "storage-gateway", "datasync",
      // Hybrid networking
      "direct-connect",
      // Policies & Rules (all policies are regional/global, outside VPC)
      "s3-lifecycle-policy", "s3-bucket-policy", "iam-identity-policy", "iam-trust-policy",
      "resource-based-policy", "vpc-endpoint-policy", "backup-policy", "scaling-policy",
      "dlm-policy", "ecr-lifecycle-policy", "permission-boundary-policy",
      "rds-parameter-group", "elasticache-parameter-group", "waf-rules",
    ],
    rejectedWith: {}  // Everything is allowed at canvas root
  },

  // Organization - can contain accounts
  "orgNode": {
    allowedChildren: ["accountNode", "scp"],
    rejectedWith: {
      "vpc": "🏛️ VPCs belong inside AWS Accounts, not directly in Organizations.",
      "ec2": "🏛️ Resources belong inside AWS Accounts, not directly in Organizations.",
    }
  },

  // Account - can contain VPCs and regional services
  "accountNode": {
    allowedChildren: [
      "vpc", "s3", "dynamodb", "lambda", "cloudfront", "route53",
      "iam", "iam-role", "iam-policy", "kms", "secrets-manager",
      "cloudwatch", "cloudtrail", "config", "guardduty",
      "codecommit", "codepipeline", "codebuild", "codedeploy",
    ],
    rejectedWith: {
      "organizations": "🏛️ Organizations is above the account level.",
      "scp": "🏛️ SCPs are applied at the Organizations level, not inside accounts.",
    }
  }
};

// ============================================
// SERVICE METADATA - For scoring and display
// ============================================

export interface ServiceMetadata {
  name: string;
  category: "compute" | "database" | "storage" | "networking" | "security" | "integration" | "monitoring" | "devops" | "governance" | "analytics";
  isGlobal: boolean;       // Global vs Regional
  isVpcResource: boolean;  // Can exist inside VPC
  basePoints: number;      // Points for correct placement
  tier: number;            // For vertical positioning (1=top, 4=bottom)
}

export const SERVICE_METADATA: Record<string, ServiceMetadata> = {
  // Networking - Tier 1
  "vpc": { name: "VPC", category: "networking", isGlobal: false, isVpcResource: false, basePoints: 15, tier: 0 },
  "subnet-public": { name: "Public Subnet", category: "networking", isGlobal: false, isVpcResource: true, basePoints: 10, tier: 0 },
  "subnet-private": { name: "Private Subnet", category: "networking", isGlobal: false, isVpcResource: true, basePoints: 10, tier: 0 },
  "internet-gateway": { name: "Internet Gateway", category: "networking", isGlobal: false, isVpcResource: true, basePoints: 10, tier: 1 },
  "nat-gateway": { name: "NAT Gateway", category: "networking", isGlobal: false, isVpcResource: true, basePoints: 10, tier: 1 },
  "vpn-gateway": { name: "VPN Gateway", category: "networking", isGlobal: false, isVpcResource: true, basePoints: 10, tier: 1 },
  "transit-gateway": { name: "Transit Gateway", category: "networking", isGlobal: false, isVpcResource: true, basePoints: 15, tier: 1 },
  "alb": { name: "Application Load Balancer", category: "networking", isGlobal: false, isVpcResource: true, basePoints: 12, tier: 1 },
  "nlb": { name: "Network Load Balancer", category: "networking", isGlobal: false, isVpcResource: true, basePoints: 12, tier: 1 },
  "elb": { name: "Classic Load Balancer", category: "networking", isGlobal: false, isVpcResource: true, basePoints: 10, tier: 1 },
  
  // Compute - Tier 2
  "ec2": { name: "EC2", category: "compute", isGlobal: false, isVpcResource: true, basePoints: 10, tier: 2 },
  "ecs": { name: "ECS", category: "compute", isGlobal: false, isVpcResource: true, basePoints: 12, tier: 2 },
  "fargate": { name: "Fargate", category: "compute", isGlobal: false, isVpcResource: true, basePoints: 12, tier: 2 },
  "eks": { name: "EKS", category: "compute", isGlobal: false, isVpcResource: true, basePoints: 15, tier: 2 },
  "lambda": { name: "Lambda", category: "compute", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 2 },
  "auto-scaling": { name: "Auto Scaling", category: "compute", isGlobal: false, isVpcResource: true, basePoints: 10, tier: 2 },
  "bastion": { name: "Bastion Host", category: "compute", isGlobal: false, isVpcResource: true, basePoints: 8, tier: 2 },
  
  // Cache - Tier 3
  "elasticache": { name: "ElastiCache", category: "database", isGlobal: false, isVpcResource: true, basePoints: 12, tier: 3 },
  
  // Database - Tier 4
  "rds": { name: "RDS", category: "database", isGlobal: false, isVpcResource: true, basePoints: 12, tier: 4 },
  "aurora": { name: "Aurora", category: "database", isGlobal: false, isVpcResource: true, basePoints: 15, tier: 4 },
  "dynamodb": { name: "DynamoDB", category: "database", isGlobal: false, isVpcResource: false, basePoints: 12, tier: 4 },
  
  // Storage
  "s3": { name: "S3", category: "storage", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "efs": { name: "EFS", category: "storage", isGlobal: false, isVpcResource: true, basePoints: 10, tier: 3 },
  "ecr": { name: "ECR", category: "storage", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  
  // Global Services
  "cloudfront": { name: "CloudFront", category: "networking", isGlobal: true, isVpcResource: false, basePoints: 12, tier: 0 },
  "route53": { name: "Route 53", category: "networking", isGlobal: true, isVpcResource: false, basePoints: 10, tier: 0 },
  "waf": { name: "WAF", category: "security", isGlobal: true, isVpcResource: false, basePoints: 10, tier: 0 },
  "iam": { name: "IAM", category: "security", isGlobal: true, isVpcResource: false, basePoints: 8, tier: 0 },
  
  // Security (Regional, outside VPC)
  "kms": { name: "KMS", category: "security", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "secrets-manager": { name: "Secrets Manager", category: "security", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "cognito": { name: "Cognito", category: "security", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "security-group": { name: "Security Group", category: "security", isGlobal: false, isVpcResource: true, basePoints: 8, tier: 0 },
  
  // Integration
  "api-gateway": { name: "API Gateway", category: "integration", isGlobal: false, isVpcResource: false, basePoints: 12, tier: 0 },
  "sns": { name: "SNS", category: "integration", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "sqs": { name: "SQS", category: "integration", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "eventbridge": { name: "EventBridge", category: "integration", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "step-functions": { name: "Step Functions", category: "integration", isGlobal: false, isVpcResource: false, basePoints: 12, tier: 0 },
  "kinesis": { name: "Kinesis", category: "integration", isGlobal: false, isVpcResource: false, basePoints: 12, tier: 0 },
  
  // Monitoring
  "cloudwatch": { name: "CloudWatch", category: "monitoring", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "cloudtrail": { name: "CloudTrail", category: "monitoring", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "xray": { name: "X-Ray", category: "monitoring", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  
  // Additional VPC resources
  "route-table": { name: "Route Table", category: "networking", isGlobal: false, isVpcResource: true, basePoints: 8, tier: 1 },
  "nacl": { name: "Network ACL", category: "networking", isGlobal: false, isVpcResource: true, basePoints: 8, tier: 1 },
  "vpc-peering": { name: "VPC Peering", category: "networking", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "ebs": { name: "EBS", category: "storage", isGlobal: false, isVpcResource: true, basePoints: 8, tier: 2 },
  
  // Additional databases
  "neptune": { name: "Neptune", category: "database", isGlobal: false, isVpcResource: true, basePoints: 12, tier: 4 },
  "redshift": { name: "Redshift", category: "database", isGlobal: false, isVpcResource: true, basePoints: 15, tier: 4 },
  "documentdb": { name: "DocumentDB", category: "database", isGlobal: false, isVpcResource: true, basePoints: 12, tier: 4 },
  "memorydb": { name: "MemoryDB", category: "database", isGlobal: false, isVpcResource: true, basePoints: 12, tier: 3 },
  "rds-replica": { name: "Read Replica", category: "database", isGlobal: false, isVpcResource: true, basePoints: 10, tier: 4 },
  
  // Backup & Storage
  "glacier": { name: "S3 Glacier", category: "storage", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "backup": { name: "AWS Backup", category: "storage", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "fsx": { name: "FSx", category: "storage", isGlobal: false, isVpcResource: true, basePoints: 10, tier: 3 },
  "storage-gateway": { name: "Storage Gateway", category: "storage", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "datasync": { name: "DataSync", category: "storage", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  
  // Security & Compliance
  "guardduty": { name: "GuardDuty", category: "security", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "shield": { name: "AWS Shield", category: "security", isGlobal: true, isVpcResource: false, basePoints: 10, tier: 0 },
  "config": { name: "AWS Config", category: "monitoring", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "systems-manager": { name: "Systems Manager", category: "monitoring", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "iam-role": { name: "IAM Role", category: "security", isGlobal: true, isVpcResource: false, basePoints: 10, tier: 0 },
  "iam-policy": { name: "IAM Policy", category: "security", isGlobal: true, isVpcResource: false, basePoints: 8, tier: 0 },
  "permission-boundary": { name: "Permission Boundary", category: "security", isGlobal: true, isVpcResource: false, basePoints: 10, tier: 0 },
  "acm": { name: "ACM", category: "security", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "inspector": { name: "Inspector", category: "security", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "macie": { name: "Macie", category: "security", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "security-hub": { name: "Security Hub", category: "security", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "detective": { name: "Detective", category: "security", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "iam-user": { name: "IAM User", category: "security", isGlobal: true, isVpcResource: false, basePoints: 8, tier: 0 },
  "iam-group": { name: "IAM Group", category: "security", isGlobal: true, isVpcResource: false, basePoints: 8, tier: 0 },
  "resource-policy": { name: "Resource Policy", category: "security", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "trust-policy": { name: "Trust Policy", category: "security", isGlobal: true, isVpcResource: false, basePoints: 10, tier: 0 },
  "identity-provider": { name: "Identity Provider", category: "security", isGlobal: true, isVpcResource: false, basePoints: 10, tier: 0 },
  "iam-identity-center": { name: "IAM Identity Center", category: "security", isGlobal: true, isVpcResource: false, basePoints: 12, tier: 0 },

  // DevOps & CI/CD
  "codecommit": { name: "CodeCommit", category: "devops", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "codepipeline": { name: "CodePipeline", category: "devops", isGlobal: false, isVpcResource: false, basePoints: 15, tier: 0 },
  "codebuild": { name: "CodeBuild", category: "devops", isGlobal: false, isVpcResource: false, basePoints: 12, tier: 0 },
  "codedeploy": { name: "CodeDeploy", category: "devops", isGlobal: false, isVpcResource: false, basePoints: 12, tier: 0 },
  "codeartifact": { name: "CodeArtifact", category: "devops", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "cloud9": { name: "Cloud9", category: "devops", isGlobal: false, isVpcResource: false, basePoints: 5, tier: 0 },
  "cloudformation": { name: "CloudFormation", category: "devops", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },

  // Analytics & Streaming
  "kinesis-streams": { name: "Kinesis Streams", category: "analytics", isGlobal: false, isVpcResource: false, basePoints: 12, tier: 0 },
  "kinesis-firehose": { name: "Kinesis Firehose", category: "analytics", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "kinesis-analytics": { name: "Kinesis Analytics", category: "analytics", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "msk": { name: "MSK (Kafka)", category: "analytics", isGlobal: false, isVpcResource: true, basePoints: 15, tier: 3 },
  "athena": { name: "Athena", category: "analytics", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "glue": { name: "Glue", category: "analytics", isGlobal: false, isVpcResource: false, basePoints: 12, tier: 0 },
  "quicksight": { name: "QuickSight", category: "analytics", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "opensearch": { name: "OpenSearch", category: "analytics", isGlobal: false, isVpcResource: true, basePoints: 12, tier: 3 },

  // Governance & Organizations
  "organizations": { name: "Organizations", category: "governance", isGlobal: true, isVpcResource: false, basePoints: 15, tier: 0 },
  "scp": { name: "SCP", category: "governance", isGlobal: true, isVpcResource: false, basePoints: 12, tier: 0 },
  "control-tower": { name: "Control Tower", category: "governance", isGlobal: true, isVpcResource: false, basePoints: 15, tier: 0 },
  "service-catalog": { name: "Service Catalog", category: "governance", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "license-manager": { name: "License Manager", category: "governance", isGlobal: false, isVpcResource: false, basePoints: 5, tier: 0 },
  "resource-groups": { name: "Resource Groups", category: "governance", isGlobal: false, isVpcResource: false, basePoints: 5, tier: 0 },

  // Additional Networking (DR/HA)
  "global-accelerator": { name: "Global Accelerator", category: "networking", isGlobal: true, isVpcResource: false, basePoints: 15, tier: 0 },
  "direct-connect": { name: "Direct Connect", category: "networking", isGlobal: false, isVpcResource: false, basePoints: 15, tier: 0 },
  "privatelink": { name: "PrivateLink", category: "networking", isGlobal: false, isVpcResource: true, basePoints: 10, tier: 1 },
  "elastic-ip": { name: "Elastic IP", category: "networking", isGlobal: false, isVpcResource: false, basePoints: 5, tier: 1 },

  // Additional Management
  "cloudwatch-logs": { name: "CloudWatch Logs", category: "monitoring", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "cloudwatch-alarms": { name: "CloudWatch Alarms", category: "monitoring", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  "health-dashboard": { name: "Health Dashboard", category: "monitoring", isGlobal: true, isVpcResource: false, basePoints: 5, tier: 0 },
  "trusted-advisor": { name: "Trusted Advisor", category: "monitoring", isGlobal: true, isVpcResource: false, basePoints: 5, tier: 0 },

  // Additional Integration
  "appsync": { name: "AppSync", category: "integration", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "mq": { name: "Amazon MQ", category: "integration", isGlobal: false, isVpcResource: true, basePoints: 10, tier: 3 },
  "ses": { name: "SES", category: "integration", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },

  // Additional Compute
  "batch": { name: "Batch", category: "compute", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 2 },
  "lightsail": { name: "Lightsail", category: "compute", isGlobal: false, isVpcResource: false, basePoints: 5, tier: 2 },

  // Policies & Rules
  "s3-lifecycle-policy": { name: "S3 Lifecycle Policy", category: "storage", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "s3-bucket-policy": { name: "S3 Bucket Policy", category: "security", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "iam-identity-policy": { name: "IAM Identity Policy", category: "security", isGlobal: true, isVpcResource: false, basePoints: 10, tier: 0 },
  "iam-trust-policy": { name: "IAM Trust Policy", category: "security", isGlobal: true, isVpcResource: false, basePoints: 10, tier: 0 },
  "resource-based-policy": { name: "Resource-Based Policy", category: "security", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "vpc-endpoint-policy": { name: "VPC Endpoint Policy", category: "networking", isGlobal: false, isVpcResource: true, basePoints: 10, tier: 1 },
  "backup-policy": { name: "Backup Policy", category: "storage", isGlobal: false, isVpcResource: false, basePoints: 12, tier: 0 },
  "scaling-policy": { name: "Scaling Policy", category: "compute", isGlobal: false, isVpcResource: false, basePoints: 12, tier: 2 },
  "dlm-policy": { name: "DLM Lifecycle Policy", category: "storage", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
  "ecr-lifecycle-policy": { name: "ECR Lifecycle Policy", category: "storage", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 0 },
  // Note: SCP is defined as "scp" in governance section above
  "permission-boundary-policy": { name: "Permission Boundary", category: "security", isGlobal: true, isVpcResource: false, basePoints: 12, tier: 0 },
  "rds-parameter-group": { name: "RDS Parameter Group", category: "database", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 4 },
  "elasticache-parameter-group": { name: "ElastiCache Parameter Group", category: "database", isGlobal: false, isVpcResource: false, basePoints: 8, tier: 3 },
  "waf-rules": { name: "WAF Rules", category: "security", isGlobal: false, isVpcResource: false, basePoints: 10, tier: 0 },
};

// ============================================
// SCORING CONFIGURATION
// ============================================

export const SCORING = {
  correctPlacement: 10,      // Dropped in valid location
  incorrectAttempt: -5,      // Tried invalid placement
  validConnection: 5,        // Connected services correctly
  invalidConnection: -3,     // Wrong connection
  
  // Bonus points
  haPattern: 20,             // Multi-AZ setup detected
  securityBonus: 15,         // Proper security group usage
  completionBonus: 50,       // All required services placed
  streakBonus: 5,            // Per correct placement in streak (3+)
  speedBonus: 25,            // Complete under target time
};

// ============================================
// VALIDATION FUNCTIONS
// ============================================

export interface PlacementValidation {
  isValid: boolean;
  proTip?: string;
  pointsAwarded: number;
  serviceMetadata?: ServiceMetadata;
}

/**
 * Validate if a service can be placed in a target container
 */
export function validatePlacement(
  serviceId: string,
  targetType: string | null,  // null = canvas root
  targetSubnetType?: "public" | "private"
): PlacementValidation {
  const metadata = SERVICE_METADATA[serviceId];
  const targetKey = targetType || "canvas";
  
  // Determine the actual target (use subnet type if available)
  let effectiveTarget = targetKey;
  if (targetKey === "subnet" && targetSubnetType) {
    effectiveTarget = `subnet-${targetSubnetType}`;
  }
  
  const rules = PLACEMENT_RULES[effectiveTarget] || PLACEMENT_RULES["canvas"];
  
  // Check if service is explicitly rejected
  if (rules.rejectedWith[serviceId]) {
    return {
      isValid: false,
      proTip: rules.rejectedWith[serviceId],
      pointsAwarded: SCORING.incorrectAttempt,
      serviceMetadata: metadata,
    };
  }
  
  // Check if service is in allowed list
  if (rules.allowedChildren.includes(serviceId)) {
    return {
      isValid: true,
      pointsAwarded: metadata?.basePoints || SCORING.correctPlacement,
      serviceMetadata: metadata,
    };
  }
  
  // Not explicitly allowed or rejected - check if it's a global service being placed in VPC
  if (metadata && !metadata.isVpcResource && targetType && targetType !== "canvas") {
    return {
      isValid: false,
      proTip: `${metadata.name} is a ${metadata.isGlobal ? "Global" : "Regional"} service that exists outside VPCs. Place it on the canvas, not inside containers.`,
      pointsAwarded: SCORING.incorrectAttempt,
      serviceMetadata: metadata,
    };
  }
  
  // Default: allow with base points
  return {
    isValid: true,
    pointsAwarded: metadata?.basePoints || SCORING.correctPlacement,
    serviceMetadata: metadata,
  };
}

/**
 * Get suggested placements for a service
 */
export function getSuggestedPlacements(serviceId: string): string[] {
  const suggestions: string[] = [];
  const metadata = SERVICE_METADATA[serviceId];
  
  if (!metadata) return ["canvas"];
  
  // Global/Regional services outside VPC
  if (!metadata.isVpcResource) {
    suggestions.push("canvas (outside VPC)");
    return suggestions;
  }
  
  // Check each container type
  for (const [containerType, rules] of Object.entries(PLACEMENT_RULES)) {
    if (rules.allowedChildren.includes(serviceId)) {
      if (containerType === "subnet-public") {
        suggestions.push("Public Subnet");
      } else if (containerType === "subnet-private") {
        suggestions.push("Private Subnet");
      } else if (containerType === "vpc") {
        suggestions.push("VPC (direct child)");
      } else if (containerType !== "canvas") {
        suggestions.push(containerType);
      }
    }
  }
  
  return suggestions;
}

// ============================================
// CONNECTION VALIDATION
// ============================================

export interface ConnectionValidation {
  isValid: boolean;
  proTip?: string;
  pointsAwarded: number;
}

/**
 * Validate if a connection between two services is valid
 * Uses canConnectTo from aws-services.ts definitions
 */
export function validateConnection(
  sourceServiceId: string,
  targetServiceId: string,
  canConnectTo?: string[]
): ConnectionValidation {
  // If no connection rules defined, allow it (neutral - no points)
  if (!canConnectTo || canConnectTo.length === 0) {
    return {
      isValid: true,
      pointsAwarded: 0,
    };
  }
  
  // Check if target is in the allowed connections
  if (canConnectTo.includes(targetServiceId)) {
    return {
      isValid: true,
      pointsAwarded: SCORING.validConnection,
      proTip: `✓ Valid connection: ${sourceServiceId} → ${targetServiceId}`,
    };
  }
  
  // Invalid connection
  const sourceMeta = SERVICE_METADATA[sourceServiceId];
  const targetMeta = SERVICE_METADATA[targetServiceId];
  
  return {
    isValid: false,
    pointsAwarded: SCORING.invalidConnection,
    proTip: `⚠️ ${sourceMeta?.name || sourceServiceId} typically doesn't connect directly to ${targetMeta?.name || targetServiceId}. Check AWS best practices.`,
  };
}

// ============================================
// SCORE TRACKING
// ============================================

export interface DiagramScore {
  correctPlacements: number;
  incorrectAttempts: number;
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  placementHistory: PlacementHistoryEntry[];
}

export interface PlacementHistoryEntry {
  timestamp: number;
  serviceId: string;
  targetType: string | null;
  isValid: boolean;
  pointsAwarded: number;
  proTip?: string;
}

export function createInitialScore(): DiagramScore {
  return {
    correctPlacements: 0,
    incorrectAttempts: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalPoints: 0,
    placementHistory: [],
  };
}

export function updateScore(
  score: DiagramScore,
  validation: PlacementValidation,
  serviceId: string,
  targetType: string | null
): DiagramScore {
  const entry: PlacementHistoryEntry = {
    timestamp: Date.now(),
    serviceId,
    targetType,
    isValid: validation.isValid,
    pointsAwarded: validation.pointsAwarded,
    proTip: validation.proTip,
  };
  
  const newScore = { ...score };
  newScore.placementHistory = [...score.placementHistory, entry];
  
  if (validation.isValid) {
    newScore.correctPlacements++;
    newScore.currentStreak++;
    newScore.longestStreak = Math.max(newScore.longestStreak, newScore.currentStreak);
    
    // Streak bonus (3+ correct in a row)
    let points = validation.pointsAwarded;
    if (newScore.currentStreak >= 3) {
      points += SCORING.streakBonus;
    }
    newScore.totalPoints += points;
  } else {
    newScore.incorrectAttempts++;
    newScore.currentStreak = 0;  // Reset streak
    newScore.totalPoints += validation.pointsAwarded;  // Negative points
  }
  
  // Ensure score doesn't go below 0
  newScore.totalPoints = Math.max(0, newScore.totalPoints);
  
  return newScore;
}

// ============================================
// BONUS DETECTION FUNCTIONS
// ============================================

interface DiagramNode {
  id: string;
  type?: string;
  data?: {
    serviceId?: string;
    subnetType?: "public" | "private";
    label?: string;
  };
  parentId?: string;
}

/**
 * Detect Multi-AZ / High Availability pattern
 * Returns bonus points if diagram has services in multiple AZs
 */
export function detectHAPattern(nodes: DiagramNode[]): { detected: boolean; bonus: number; message: string } {
  // Find availability zone nodes
  const azNodes = nodes.filter(n => n.type === "availabilityZone");
  
  // Find database services (RDS, Aurora, ElastiCache, etc.)
  const dbServices = ["rds", "aurora", "elasticache", "neptune", "documentdb", "memorydb"];
  const dbNodes = nodes.filter(n => dbServices.includes(n.data?.serviceId || ""));
  
  // Check if we have multiple AZs with database services
  if (azNodes.length >= 2 && dbNodes.length >= 1) {
    // Check if databases are distributed across AZs
    const azWithDb = new Set<string>();
    dbNodes.forEach(db => {
      if (db.parentId) {
        const parent = nodes.find(n => n.id === db.parentId);
        if (parent?.type === "availabilityZone" || parent?.type === "subnet") {
          azWithDb.add(parent.parentId || parent.id);
        }
      }
    });
    
    if (azWithDb.size >= 2) {
      return {
        detected: true,
        bonus: SCORING.haPattern,
        message: "🏆 Multi-AZ High Availability pattern detected! +20 pts",
      };
    }
  }
  
  // Check for multiple private subnets (simpler HA indicator)
  const privateSubnets = nodes.filter(n => 
    n.type === "subnet" && n.data?.subnetType === "private"
  );
  
  if (privateSubnets.length >= 2 && dbNodes.length >= 1) {
    return {
      detected: true,
      bonus: SCORING.haPattern,
      message: "🏆 Multi-AZ setup detected with redundant subnets! +20 pts",
    };
  }
  
  return { detected: false, bonus: 0, message: "" };
}

/**
 * Detect proper security group usage
 * Returns bonus if security groups are properly wrapping resources
 */
export function detectSecurityPattern(nodes: DiagramNode[]): { detected: boolean; bonus: number; message: string } {
  const securityGroups = nodes.filter(n => n.type === "securityGroup");
  const protectedServices = ["ec2", "rds", "aurora", "elasticache", "ecs", "eks", "alb", "nlb"];
  
  // Check if any protected services are inside security groups
  const servicesInSG = nodes.filter(n => {
    if (!protectedServices.includes(n.data?.serviceId || "")) return false;
    // Check if parent is a security group
    const parent = nodes.find(p => p.id === n.parentId);
    return parent?.type === "securityGroup";
  });
  
  if (securityGroups.length >= 1 && servicesInSG.length >= 1) {
    return {
      detected: true,
      bonus: SCORING.securityBonus,
      message: "🔒 Security best practice: Resources properly protected by Security Groups! +15 pts",
    };
  }
  
  return { detected: false, bonus: 0, message: "" };
}

/**
 * Check if all required services for a challenge are placed
 */
export function checkCompletionBonus(
  nodes: DiagramNode[],
  requiredServices: string[]
): { complete: boolean; bonus: number; message: string; missing: string[] } {
  if (!requiredServices || requiredServices.length === 0) {
    return { complete: false, bonus: 0, message: "", missing: [] };
  }
  
  const placedServiceIds = nodes
    .map(n => n.data?.serviceId)
    .filter(Boolean) as string[];
  
  const missing = requiredServices.filter(s => !placedServiceIds.includes(s));
  
  if (missing.length === 0) {
    return {
      complete: true,
      bonus: SCORING.completionBonus,
      message: "🎉 All required services placed! Completion bonus: +50 pts",
      missing: [],
    };
  }
  
  return {
    complete: false,
    bonus: 0,
    message: "",
    missing,
  };
}
