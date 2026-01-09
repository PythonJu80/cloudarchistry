/**
 * AWS Placement Rules Engine
 * 
 * Enforces AWS architecture conventions for diagram building.
 * Validates where services can be placed and provides educational feedback.
 * 
 * Architecture Model:
 * 1. PLACEMENT (Containment) - Where resources exist in hierarchy
 * 2. EDGES (Relationships) - How resources connect and interact
 *    - ENI edges: Network interface bindings (the atomic network unit)
 *    - Attachment edges: Service-to-service bindings (IGW→VPC, TGW→VPC)
 *    - Endpoint edges: VPC access to external services (PrivateLink, Gateway Endpoints)
 *    - Trust edges: IAM relationships (Role→Service, Policy→Role)
 */

// ============================================
// PLACEMENT RULES - What can go WHERE
// ============================================

export interface PlacementRule {
  allowedChildren: string[];
  rejectedWith: Record<string, string>;  // serviceId -> pro tip message
}

export const PLACEMENT_RULES: Record<string, PlacementRule> = {
  // AWS Cloud boundary - contains regions
  "awsCloud": {
    allowedChildren: [
      "region",
      // Global services can be shown at AWS Cloud level
      "route53", "cloudfront", "iam", "waf", "shield", "global-accelerator",
      "organizations", "iam-identity-center",
    ],
    rejectedWith: {
      "vpc": "🌍 VPCs exist inside Regions, not directly in the AWS Cloud boundary. Add a Region first.",
      "ec2": "🌍 EC2 instances exist inside VPCs within Regions. Add Region → VPC → Subnet first.",
      "rds": "🌍 RDS exists inside VPCs within Regions. Add Region → VPC → Subnet first.",
      "subnet-public": "🌍 Subnets exist inside VPCs. Add Region → VPC first.",
      "subnet-private": "🌍 Subnets exist inside VPCs. Add Region → VPC first.",
    }
  },

  // Region - contains AZs and VPCs
  "region": {
    allowedChildren: [
      "availabilityZone", "vpc",
      // Regional services that exist outside VPCs
      "s3", "dynamodb", "lambda", "api-gateway",
      "cognito", "kms", "cloudwatch", "cloudtrail", "sns", "sqs",
      "secrets-manager", "ecr", "step-functions", "eventbridge",
      "efs",  // EFS is regional - mount targets are created in subnets
      "codecommit", "codepipeline", "codebuild", "codedeploy",
      "athena", "glue", "quicksight",
      "guardduty", "config", "inspector", "macie", "security-hub",
    ],
    rejectedWith: {
      "route53": "🌐 Route 53 is a GLOBAL service - place it at the AWS Cloud level or canvas, not inside a Region.",
      "cloudfront": "🌐 CloudFront is a GLOBAL edge service - place it at the AWS Cloud level or canvas.",
      "iam": "🌐 IAM is a GLOBAL service - place it at the AWS Cloud level or canvas.",
      "organizations": "🌐 Organizations is a GLOBAL service - place it at the AWS Cloud level or canvas.",
      "ec2": "💡 EC2 instances go inside VPCs → Subnets, not directly in a Region.",
      "rds": "💡 RDS goes inside VPCs → Private Subnets, not directly in a Region.",
    }
  },

  // Availability Zone - contains subnets (VPCs span AZs, but subnets are AZ-specific)
  "availabilityZone": {
    allowedChildren: [
      "subnet-public", "subnet-private", "subnet",
    ],
    rejectedWith: {
      "vpc": "🏗️ VPCs SPAN multiple Availability Zones - place VPC at the Region level, then put subnets inside AZs.",
      "ec2": "💡 EC2 instances go inside Subnets, not directly in an AZ. Add a Subnet first.",
      "rds": "💡 RDS goes inside Subnets, not directly in an AZ. Add a Private Subnet first.",
      "alb": "🌐 ALB spans multiple AZs at the VPC level - it's not placed inside a single AZ.",
      "nlb": "🌐 NLB spans multiple AZs at the VPC level - it's not placed inside a single AZ.",
    }
  },

  // VPC - contains AZs, subnets, and VPC-level resources
  // Note: Subnets ARE AZ-scoped in AWS, but we allow both placements:
  // 1. VPC → AZ → Subnet (explicit AZ grouping - more accurate)
  // 2. VPC → Subnet (simplified - tool can auto-assign AZ or user understands implicitly)
  // This avoids forcing users to add AZ boxes when they just want a quick diagram.
  "vpc": {
    allowedChildren: [
      "availabilityZone",  // VPC contains AZs
      "subnet-public", "subnet-private", "subnet",  // Allow direct subnet placement (simplified diagrams)
      "internet-gateway", "vpn-gateway", "transit-gateway",
      "alb", "nlb", "elb",  // Load balancers span subnets but are VPC resources
      "route-table", "nacl", "security-group",  // VPC networking components
    ],
    rejectedWith: {
      "nat-gateway": "🚪 NAT Gateway lives in a PUBLIC SUBNET, not directly in VPC. Create: VPC → Subnet (public) → NAT Gateway.",
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
      "lambda": "⚡ Lambda functions live at the Region level, OUTSIDE VPCs. Configure 'VPC Access' to let Lambda attach ENIs to subnets at invocation time - but place the Lambda icon at Region or Canvas level, not inside VPC.",
      "api-gateway": "🚪 API Gateway is a Regional Service - it's the entry point TO your VPC.",
      "waf": "🛡️ WAF is attached to CloudFront or ALB - it's not a VPC resource itself.",
      "secrets-manager": "🔐 Secrets Manager is Regional - access it via VPC Endpoint.",
      "ecr": "📦 ECR is a Regional Service - container registry lives outside VPCs.",
      "efs": "📁 EFS is a Regional Service - the file system exists outside VPCs. Mount Targets are created in subnets to provide access. Place EFS at Region or Canvas level.",
    }
  },

  // Public Subnet - internet-facing resources ONLY
  "subnet-public": {
    allowedChildren: [
      "nat-gateway",  // NAT Gateway lives in public subnets
      "bastion", "ec2",  // Bastion hosts, public-facing EC2
      "auto-scaling",
    ],
    // Note: ALB/NLB are VPC-level resources that span subnets - they have ENIs in subnets but are managed at VPC level
    rejectedWith: {
      "internet-gateway": "🚪 Internet Gateway attaches at the VPC level, not inside subnets. Place it directly in the VPC.",
      "alb": "🌐 ALB is a VPC-level resource that spans multiple subnets/AZs. Place it at the VPC level - it will have ENIs in your subnets.",
      "nlb": "🌐 NLB is a VPC-level resource that spans multiple subnets/AZs. Place it at the VPC level.",
      "elb": "🌐 ELB is a VPC-level resource that spans multiple subnets/AZs. Place it at the VPC level.",
      "rds": "🔒 SECURITY RISK! Databases should NEVER be in public subnets. Put RDS in a PRIVATE subnet and access via your app tier.",
      "aurora": "🔒 SECURITY RISK! Aurora clusters must be in PRIVATE subnets. Never expose databases to the internet!",
      "elasticache": "🔒 Cache layers belong in PRIVATE subnets - Redis/Memcached should not be internet-accessible.",
      "fargate": "💡 Fargate tasks with app logic should be in PRIVATE subnets, behind an ALB at the VPC level.",
      "ecs": "💡 ECS services typically run in PRIVATE subnets for security. Use ALB at VPC level to route traffic.",
      "eks": "💡 EKS worker nodes should be in PRIVATE subnets. ALB/NLB are placed at VPC level.",
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
      "auto-scaling", "ebs",
    ],
    rejectedWith: {
      "nat-gateway": "🚪 NAT Gateway must be in a PUBLIC subnet! It routes private subnet traffic to the internet.",
      "internet-gateway": "🚪 Internet Gateway attaches at the VPC level, not inside subnets.",
      "alb": "🌐 ALB is a VPC-level resource that spans subnets. Place it at VPC level - it routes traffic to your private resources.",
      "nlb": "🌐 NLB is a VPC-level resource that spans subnets. Place it at VPC level.",
      "elb": "🌐 ELB is a VPC-level resource. Place it at VPC level.",
      "bastion": "🔐 Bastion hosts need to be in PUBLIC subnets so you can SSH to them from the internet.",
      "lambda": "⚡ Lambda functions live OUTSIDE VPCs at the Region level. They can be configured with 'VPC Access' to attach ENIs to subnets at invocation time - but the function itself is never placed IN a subnet. Place Lambda at Region or Canvas level.",
    }
  },

  // Generic subnet (when type not specified) - conservative rules
  "subnet": {
    allowedChildren: [
      "ec2", "ecs", "fargate", "eks",
      "rds", "aurora", "elasticache", "neptune", "redshift",
      "documentdb", "memorydb", "rds-replica",
      "msk", "opensearch", "mq", "fsx",
      "auto-scaling",
    ],
    rejectedWith: {
      "nat-gateway": "🚪 NAT Gateway must be in a PUBLIC subnet specifically. Use a typed public subnet, not a generic subnet.",
      "s3": "☁️ S3 is a Regional Service - it exists outside subnets and VPCs.",
      "dynamodb": "☁️ DynamoDB is Regional - it doesn't go inside subnets.",
      "cloudfront": "🌐 CloudFront is Global - it's an edge service outside your VPC.",
      "route53": "🌐 Route 53 is Global DNS - it exists outside VPCs.",
      "internet-gateway": "🚪 Internet Gateway attaches at the VPC level, not inside subnets.",
      "alb": "🌐 ALB is a VPC-level resource that spans multiple subnets. Place it at VPC level.",
      "nlb": "🌐 NLB is a VPC-level resource that spans multiple subnets. Place it at VPC level.",
      "elb": "🌐 ELB is a VPC-level resource. Place it at VPC level.",
      "lambda": "⚡ Lambda functions live at the Region level, not inside subnets. Configure 'VPC Access' to let Lambda attach ENIs to subnets - but place the Lambda icon at Region or Canvas level.",
    }
  },

  // NOTE: Security Groups are NOT containers - they are attachments/bindings.
  // No placement rule needed here. SGs are handled via edge relationships (sg-eni attachment).
  // The canonical service ID is "security-group" (with hyphen).

  // Auto Scaling Group - canonical ID is "auto-scaling" (with hyphen)
  "auto-scaling": {
    allowedChildren: ["ec2", "ecs", "fargate"],
    rejectedWith: {
      "rds": "📊 RDS has its own scaling (Read Replicas, Aurora Auto Scaling) - not EC2 Auto Scaling.",
      "elasticache": "📊 ElastiCache has its own scaling mechanisms.",
    }
  },

  // Canvas root - global/regional services
  "canvas": {
    allowedChildren: [
      // AWS boundary containers
      "awsCloud", "region", "availabilityZone",
      // VPC and networking
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

/**
 * Service scope defines where a service can be placed:
 * - "global": Truly global services (IAM, Route53, Organizations) - exist at AWS Cloud level
 * - "edge": Edge/CDN services (CloudFront, Global Accelerator, WAF for CloudFront) - distributed globally but configured regionally
 * - "regional": Regional services (most services) - exist within a specific region
 * - "az": AZ-scoped resources (subnets, EBS volumes) - tied to specific availability zone
 * - "vpc": VPC-scoped resources - exist within VPC context
 */
export type ServiceScope = "global" | "edge" | "regional" | "az" | "vpc";

export interface ServiceMetadata {
  name: string;
  category: "compute" | "database" | "storage" | "networking" | "security" | "integration" | "monitoring" | "devops" | "governance" | "analytics";
  scope: ServiceScope;     // Where the service exists (replaces isGlobal)
  isVpcResource: boolean;  // Can exist inside VPC (for backward compatibility)
  basePoints: number;      // Points for correct placement
  tier: number;            // For vertical positioning (1=top, 4=bottom)
}

export const SERVICE_METADATA: Record<string, ServiceMetadata> = {
  // Networking - Tier 1
  "vpc": { name: "VPC", category: "networking", scope: "regional", isVpcResource: false, basePoints: 15, tier: 0 },
  "subnet-public": { name: "Public Subnet", category: "networking", scope: "az", isVpcResource: true, basePoints: 10, tier: 0 },
  "subnet-private": { name: "Private Subnet", category: "networking", scope: "az", isVpcResource: true, basePoints: 10, tier: 0 },
  "internet-gateway": { name: "Internet Gateway", category: "networking", scope: "regional", isVpcResource: true, basePoints: 10, tier: 1 },
  "nat-gateway": { name: "NAT Gateway", category: "networking", scope: "regional", isVpcResource: true, basePoints: 10, tier: 1 },
  "vpn-gateway": { name: "VPN Gateway", category: "networking", scope: "regional", isVpcResource: true, basePoints: 10, tier: 1 },
  "transit-gateway": { name: "Transit Gateway", category: "networking", scope: "regional", isVpcResource: false, basePoints: 15, tier: 1 },
  "alb": { name: "Application Load Balancer", category: "networking", scope: "regional", isVpcResource: true, basePoints: 12, tier: 1 },
  "nlb": { name: "Network Load Balancer", category: "networking", scope: "regional", isVpcResource: true, basePoints: 12, tier: 1 },
  "elb": { name: "Classic Load Balancer", category: "networking", scope: "regional", isVpcResource: true, basePoints: 10, tier: 1 },
  
  // Compute - Tier 2
  "ec2": { name: "EC2", category: "compute", scope: "regional", isVpcResource: true, basePoints: 10, tier: 2 },
  "ecs": { name: "ECS", category: "compute", scope: "regional", isVpcResource: true, basePoints: 12, tier: 2 },
  "fargate": { name: "Fargate", category: "compute", scope: "regional", isVpcResource: true, basePoints: 12, tier: 2 },
  "eks": { name: "EKS", category: "compute", scope: "regional", isVpcResource: true, basePoints: 15, tier: 2 },
  "lambda": { name: "Lambda", category: "compute", scope: "regional", isVpcResource: false, basePoints: 10, tier: 2 },
  "auto-scaling": { name: "Auto Scaling", category: "compute", scope: "regional", isVpcResource: true, basePoints: 10, tier: 2 },
  "bastion": { name: "Bastion Host", category: "compute", scope: "regional", isVpcResource: true, basePoints: 8, tier: 2 },
  
  // Cache - Tier 3
  "elasticache": { name: "ElastiCache", category: "database", scope: "regional", isVpcResource: true, basePoints: 12, tier: 3 },
  
  // Database - Tier 4
  "rds": { name: "RDS", category: "database", scope: "regional", isVpcResource: true, basePoints: 12, tier: 4 },
  "aurora": { name: "Aurora", category: "database", scope: "regional", isVpcResource: true, basePoints: 15, tier: 4 },
  "dynamodb": { name: "DynamoDB", category: "database", scope: "regional", isVpcResource: false, basePoints: 12, tier: 4 },
  
  // Storage
  "s3": { name: "S3", category: "storage", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "efs": { name: "EFS", category: "storage", scope: "regional", isVpcResource: true, basePoints: 10, tier: 3 },
  "ecr": { name: "ECR", category: "storage", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  
  // Edge Services (distributed globally, configured regionally or globally depending on use)
  "cloudfront": { name: "CloudFront", category: "networking", scope: "edge", isVpcResource: false, basePoints: 12, tier: 0 },
  "global-accelerator": { name: "Global Accelerator", category: "networking", scope: "edge", isVpcResource: false, basePoints: 15, tier: 0 },
  
  // Global Services (truly global, exist at AWS Cloud level)
  "route53": { name: "Route 53", category: "networking", scope: "global", isVpcResource: false, basePoints: 10, tier: 0 },
  "iam": { name: "IAM", category: "security", scope: "global", isVpcResource: false, basePoints: 8, tier: 0 },
  
  // WAF - scope depends on what it's attached to (regional for ALB, edge for CloudFront)
  "waf": { name: "WAF", category: "security", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  
  // Security (Regional, outside VPC)
  "kms": { name: "KMS", category: "security", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "secrets-manager": { name: "Secrets Manager", category: "security", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "cognito": { name: "Cognito", category: "security", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "security-group": { name: "Security Group", category: "security", scope: "regional", isVpcResource: true, basePoints: 8, tier: 0 },
  
  // Integration
  "api-gateway": { name: "API Gateway", category: "integration", scope: "regional", isVpcResource: false, basePoints: 12, tier: 0 },
  "sns": { name: "SNS", category: "integration", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "sqs": { name: "SQS", category: "integration", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "eventbridge": { name: "EventBridge", category: "integration", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "step-functions": { name: "Step Functions", category: "integration", scope: "regional", isVpcResource: false, basePoints: 12, tier: 0 },
  "kinesis": { name: "Kinesis", category: "integration", scope: "regional", isVpcResource: false, basePoints: 12, tier: 0 },
  
  // Monitoring
  "cloudwatch": { name: "CloudWatch", category: "monitoring", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "cloudtrail": { name: "CloudTrail", category: "monitoring", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "xray": { name: "X-Ray", category: "monitoring", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  
  // Additional VPC resources
  "route-table": { name: "Route Table", category: "networking", scope: "regional", isVpcResource: true, basePoints: 8, tier: 1 },
  "nacl": { name: "Network ACL", category: "networking", scope: "regional", isVpcResource: true, basePoints: 8, tier: 1 },
  "vpc-peering": { name: "VPC Peering", category: "networking", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "ebs": { name: "EBS", category: "storage", scope: "az", isVpcResource: true, basePoints: 8, tier: 2 },
  
  // Additional databases
  "neptune": { name: "Neptune", category: "database", scope: "regional", isVpcResource: true, basePoints: 12, tier: 4 },
  "redshift": { name: "Redshift", category: "database", scope: "regional", isVpcResource: true, basePoints: 15, tier: 4 },
  "documentdb": { name: "DocumentDB", category: "database", scope: "regional", isVpcResource: true, basePoints: 12, tier: 4 },
  "memorydb": { name: "MemoryDB", category: "database", scope: "regional", isVpcResource: true, basePoints: 12, tier: 3 },
  "rds-replica": { name: "Read Replica", category: "database", scope: "regional", isVpcResource: true, basePoints: 10, tier: 4 },
  
  // Backup & Storage
  "glacier": { name: "S3 Glacier", category: "storage", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "backup": { name: "AWS Backup", category: "storage", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "fsx": { name: "FSx", category: "storage", scope: "regional", isVpcResource: true, basePoints: 10, tier: 3 },
  "storage-gateway": { name: "Storage Gateway", category: "storage", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "datasync": { name: "DataSync", category: "storage", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  
  // Security & Compliance
  "guardduty": { name: "GuardDuty", category: "security", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "shield": { name: "AWS Shield", category: "security", scope: "global", isVpcResource: false, basePoints: 10, tier: 0 },
  "config": { name: "AWS Config", category: "monitoring", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "systems-manager": { name: "Systems Manager", category: "monitoring", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "iam-role": { name: "IAM Role", category: "security", scope: "global", isVpcResource: false, basePoints: 10, tier: 0 },
  "iam-policy": { name: "IAM Policy", category: "security", scope: "global", isVpcResource: false, basePoints: 8, tier: 0 },
  "permission-boundary": { name: "Permission Boundary", category: "security", scope: "global", isVpcResource: false, basePoints: 10, tier: 0 },
  "acm": { name: "ACM", category: "security", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "inspector": { name: "Inspector", category: "security", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "macie": { name: "Macie", category: "security", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "security-hub": { name: "Security Hub", category: "security", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "detective": { name: "Detective", category: "security", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "iam-user": { name: "IAM User", category: "security", scope: "global", isVpcResource: false, basePoints: 8, tier: 0 },
  "iam-group": { name: "IAM Group", category: "security", scope: "global", isVpcResource: false, basePoints: 8, tier: 0 },
  "resource-policy": { name: "Resource Policy", category: "security", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "trust-policy": { name: "Trust Policy", category: "security", scope: "global", isVpcResource: false, basePoints: 10, tier: 0 },
  "identity-provider": { name: "Identity Provider", category: "security", scope: "global", isVpcResource: false, basePoints: 10, tier: 0 },
  "iam-identity-center": { name: "IAM Identity Center", category: "security", scope: "global", isVpcResource: false, basePoints: 12, tier: 0 },

  // DevOps & CI/CD
  "codecommit": { name: "CodeCommit", category: "devops", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "codepipeline": { name: "CodePipeline", category: "devops", scope: "regional", isVpcResource: false, basePoints: 15, tier: 0 },
  "codebuild": { name: "CodeBuild", category: "devops", scope: "regional", isVpcResource: false, basePoints: 12, tier: 0 },
  "codedeploy": { name: "CodeDeploy", category: "devops", scope: "regional", isVpcResource: false, basePoints: 12, tier: 0 },
  "codeartifact": { name: "CodeArtifact", category: "devops", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "cloud9": { name: "Cloud9", category: "devops", scope: "regional", isVpcResource: false, basePoints: 5, tier: 0 },
  "cloudformation": { name: "CloudFormation", category: "devops", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },

  // Analytics & Streaming
  "kinesis-streams": { name: "Kinesis Streams", category: "analytics", scope: "regional", isVpcResource: false, basePoints: 12, tier: 0 },
  "kinesis-firehose": { name: "Kinesis Firehose", category: "analytics", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "kinesis-analytics": { name: "Kinesis Analytics", category: "analytics", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "msk": { name: "MSK (Kafka)", category: "analytics", scope: "regional", isVpcResource: true, basePoints: 15, tier: 3 },
  "athena": { name: "Athena", category: "analytics", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "glue": { name: "Glue", category: "analytics", scope: "regional", isVpcResource: false, basePoints: 12, tier: 0 },
  "quicksight": { name: "QuickSight", category: "analytics", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "opensearch": { name: "OpenSearch", category: "analytics", scope: "regional", isVpcResource: true, basePoints: 12, tier: 3 },

  // Governance & Organizations
  "organizations": { name: "Organizations", category: "governance", scope: "global", isVpcResource: false, basePoints: 15, tier: 0 },
  "scp": { name: "SCP", category: "governance", scope: "global", isVpcResource: false, basePoints: 12, tier: 0 },
  "control-tower": { name: "Control Tower", category: "governance", scope: "global", isVpcResource: false, basePoints: 15, tier: 0 },
  "service-catalog": { name: "Service Catalog", category: "governance", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "license-manager": { name: "License Manager", category: "governance", scope: "regional", isVpcResource: false, basePoints: 5, tier: 0 },
  "resource-groups": { name: "Resource Groups", category: "governance", scope: "regional", isVpcResource: false, basePoints: 5, tier: 0 },

  // Additional Networking (DR/HA)
  "direct-connect": { name: "Direct Connect", category: "networking", scope: "regional", isVpcResource: false, basePoints: 15, tier: 0 },
  "privatelink": { name: "PrivateLink", category: "networking", scope: "regional", isVpcResource: true, basePoints: 10, tier: 1 },
  "elastic-ip": { name: "Elastic IP", category: "networking", scope: "regional", isVpcResource: false, basePoints: 5, tier: 1 },

  // Additional Management
  "cloudwatch-logs": { name: "CloudWatch Logs", category: "monitoring", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "cloudwatch-alarms": { name: "CloudWatch Alarms", category: "monitoring", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  "health-dashboard": { name: "Health Dashboard", category: "monitoring", scope: "global", isVpcResource: false, basePoints: 5, tier: 0 },
  "trusted-advisor": { name: "Trusted Advisor", category: "monitoring", scope: "global", isVpcResource: false, basePoints: 5, tier: 0 },

  // Additional Integration
  "appsync": { name: "AppSync", category: "integration", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "mq": { name: "Amazon MQ", category: "integration", scope: "regional", isVpcResource: true, basePoints: 10, tier: 3 },
  "ses": { name: "SES", category: "integration", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },

  // Additional Compute
  "batch": { name: "Batch", category: "compute", scope: "regional", isVpcResource: false, basePoints: 10, tier: 2 },
  "lightsail": { name: "Lightsail", category: "compute", scope: "regional", isVpcResource: false, basePoints: 5, tier: 2 },

  // Policies & Rules
  "s3-lifecycle-policy": { name: "S3 Lifecycle Policy", category: "storage", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "s3-bucket-policy": { name: "S3 Bucket Policy", category: "security", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "iam-identity-policy": { name: "IAM Identity Policy", category: "security", scope: "global", isVpcResource: false, basePoints: 10, tier: 0 },
  "iam-trust-policy": { name: "IAM Trust Policy", category: "security", scope: "global", isVpcResource: false, basePoints: 10, tier: 0 },
  "resource-based-policy": { name: "Resource-Based Policy", category: "security", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "vpc-endpoint-policy": { name: "VPC Endpoint Policy", category: "networking", scope: "regional", isVpcResource: true, basePoints: 10, tier: 1 },
  "backup-policy": { name: "Backup Policy", category: "storage", scope: "regional", isVpcResource: false, basePoints: 12, tier: 0 },
  "scaling-policy": { name: "Scaling Policy", category: "compute", scope: "regional", isVpcResource: false, basePoints: 12, tier: 2 },
  "dlm-policy": { name: "DLM Lifecycle Policy", category: "storage", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
  "ecr-lifecycle-policy": { name: "ECR Lifecycle Policy", category: "storage", scope: "regional", isVpcResource: false, basePoints: 8, tier: 0 },
  // Note: SCP is defined as "scp" in governance section above
  "permission-boundary-policy": { name: "Permission Boundary", category: "security", scope: "global", isVpcResource: false, basePoints: 12, tier: 0 },
  "rds-parameter-group": { name: "RDS Parameter Group", category: "database", scope: "regional", isVpcResource: false, basePoints: 8, tier: 4 },
  "elasticache-parameter-group": { name: "ElastiCache Parameter Group", category: "database", scope: "regional", isVpcResource: false, basePoints: 8, tier: 3 },
  "waf-rules": { name: "WAF Rules", category: "security", scope: "regional", isVpcResource: false, basePoints: 10, tier: 0 },
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
  /**
   * Severity level for invalid placements:
   * - error: Hard invalid - blocks placement (global in VPC, DB in public subnet)
   * - warning: Soft issue - allows placement with warning (suboptimal but functional)
   * - note: Informational - allows placement silently (diagram abstraction)
   */
  severity?: "error" | "warning" | "note";
}

/**
 * Classify severity for rejected placements
 * Used by validatePlacement to determine if rejection is error/warning/note
 */
function classifyRejectionSeverity(
  serviceId: string,
  targetType: string,
  metadata?: ServiceMetadata
): "error" | "warning" | "note" {
  const scope = metadata?.scope;
  
  // ERRORS: Scope violations - these are always wrong
  // Global/edge services inside VPC or subnet
  if ((scope === "global" || scope === "edge") && 
      (targetType === "vpc" || targetType.startsWith("subnet"))) {
    return "error";
  }
  
  // Regional services inside subnet (S3, DynamoDB in subnet)
  if (scope === "regional" && !metadata?.isVpcResource && targetType.startsWith("subnet")) {
    return "error";
  }
  
  // VPC resource in wrong container type (EC2 in Security Group as container)
  if (targetType === "securityGroup" || targetType === "security-group") {
    return "error"; // SG is not a container
  }
  
  // RDS/databases in public subnet - security error
  if (serviceId === "rds" || serviceId === "aurora" || serviceId === "elasticache" || 
      serviceId === "redshift" || serviceId === "neptune" || serviceId === "documentdb") {
    if (targetType === "subnet-public") {
      return "error";
    }
  }
  
  // Default to warning for other rejections
  return "warning";
}

/**
 * Validate if a service can be placed in a target container
 */
// Normalize hyphenated IDs to camelCase to match PLACEMENT_RULES keys
function normalizeServiceId(id: string): string {
  const mapping: Record<string, string> = {
    "availability-zone": "availabilityZone",
    "aws-cloud": "awsCloud",
    "security-group": "securityGroup",
    "auto-scaling": "autoScaling",
  };
  return mapping[id] || id;
}

export function validatePlacement(
  serviceId: string,
  targetType: string | null,  // null = canvas root
  targetSubnetType?: "public" | "private"
): PlacementValidation {
  // Normalize IDs to match PLACEMENT_RULES keys
  const normalizedServiceId = normalizeServiceId(serviceId);
  const metadata = SERVICE_METADATA[normalizedServiceId] || SERVICE_METADATA[serviceId];
  const targetKey = normalizeServiceId(targetType || "canvas");
  
  // Determine the actual target (use subnet type if available)
  let effectiveTarget = targetKey;
  if (targetKey === "subnet" && targetSubnetType) {
    effectiveTarget = `subnet-${targetSubnetType}`;
  }
  
  const rules = PLACEMENT_RULES[effectiveTarget] || PLACEMENT_RULES["canvas"];
  
  // Check if service is explicitly rejected
  if (rules.rejectedWith[serviceId]) {
    // Determine severity based on the type of rejection
    const severity = classifyRejectionSeverity(serviceId, effectiveTarget, metadata);
    return {
      isValid: false,
      proTip: rules.rejectedWith[serviceId],
      pointsAwarded: severity === "error" ? SCORING.incorrectAttempt : 0,
      serviceMetadata: metadata,
      severity,
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
  
  // Not explicitly allowed or rejected - check if it's a non-VPC service being placed in VPC
  if (metadata && !metadata.isVpcResource && targetType && targetType !== "canvas") {
    const scopeLabel = metadata.scope === "global" ? "Global" : 
                       metadata.scope === "edge" ? "Edge" : "Regional";
    // Scope violations are always errors
    return {
      isValid: false,
      proTip: `${metadata.name} is a ${scopeLabel} service that exists outside VPCs. Place it on the canvas or at the appropriate scope level.`,
      pointsAwarded: SCORING.incorrectAttempt,
      serviceMetadata: metadata,
      severity: "error",
    };
  }
  
  // ⚠️ DENY-BY-DEFAULT for containers (not canvas)
  // If we reach here, the service is not in allowedChildren and not explicitly rejected.
  // For canvas, we allow anything (it's the root). For containers, we deny by default.
  if (targetType && targetType !== "canvas") {
    // This is a warning, not an error - placement is suboptimal but not critically wrong
    return {
      isValid: false,
      proTip: `📋 ${metadata?.name || serviceId} is not listed as valid inside ${targetType}. Check AWS documentation for correct placement.`,
      pointsAwarded: 0,  // Neutral - not penalized, but not rewarded
      serviceMetadata: metadata,
      severity: "warning",
    };
  }
  
  // Canvas root: allow with base points (this is the only "allow-by-default" case)
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

export interface DiagramNode {
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
 * 
 * AWS Reality Check:
 * - RDS ≠ Multi-AZ by default (requires explicit Multi-AZ deployment)
 * - Aurora ≠ HA unless configured with replicas
 * - ElastiCache ≠ HA unless replication groups exist
 * 
 * We detect ACTUAL HA patterns, not just presence:
 * 1. Same service type deployed in multiple AZs/subnets
 * 2. Explicit replica nodes (rds-replica)
 * 3. Multiple instances of same compute service across AZs
 */
export function detectHAPattern(nodes: DiagramNode[]): { detected: boolean; bonus: number; message: string } {
  // Find availability zone nodes
  const azNodes = nodes.filter(n => n.type === "availabilityZone");
  if (azNodes.length < 2) {
    return { detected: false, bonus: 0, message: "" };
  }
  
  // Helper: Get the AZ ancestor for a node
  const getAZForNode = (node: DiagramNode): string | null => {
    let current: DiagramNode | undefined = node;
    while (current) {
      if (current.type === "availabilityZone") {
        return current.id;
      }
      current = nodes.find(n => n.id === current?.parentId);
    }
    return null;
  };
  
  // Pattern 1: Explicit Read Replicas (strongest HA indicator)
  const replicaNodes = nodes.filter(n => n.data?.serviceId === "rds-replica");
  const primaryDbNodes = nodes.filter(n => 
    ["rds", "aurora"].includes(n.data?.serviceId || "")
  );
  
  if (replicaNodes.length >= 1 && primaryDbNodes.length >= 1) {
    // Check if replica is in different AZ than primary
    const primaryAZs = new Set(primaryDbNodes.map(getAZForNode).filter(Boolean));
    const replicaAZs = new Set(replicaNodes.map(getAZForNode).filter(Boolean));
    
    // If replica is in a different AZ, that's true Multi-AZ
    const hasMultiAZReplica = Array.from(replicaAZs).some(az => !primaryAZs.has(az as string));
    if (hasMultiAZReplica) {
      return {
        detected: true,
        bonus: SCORING.haPattern,
        message: "🏆 Multi-AZ Database Replication detected! Primary + Replica in different AZs. +20 pts",
      };
    }
  }
  
  // Pattern 2: Same service type in multiple AZs (compute HA)
  const haServices = ["ec2", "ecs", "fargate", "eks"];
  const servicesByType = new Map<string, Set<string>>();
  
  nodes.forEach(node => {
    const serviceId = node.data?.serviceId;
    if (serviceId && haServices.includes(serviceId)) {
      const az = getAZForNode(node);
      if (az) {
        if (!servicesByType.has(serviceId)) {
          servicesByType.set(serviceId, new Set());
        }
        servicesByType.get(serviceId)!.add(az);
      }
    }
  });
  
  // Check if any service type spans multiple AZs
  const serviceEntries = Array.from(servicesByType.entries());
  for (const [serviceId, azSet] of serviceEntries) {
    if (azSet.size >= 2) {
      return {
        detected: true,
        bonus: SCORING.haPattern,
        message: `🏆 High Availability pattern: ${serviceId.toUpperCase()} deployed across ${azSet.size} Availability Zones! +20 pts`,
      };
    }
  }
  
  // Pattern 3: ElastiCache with multiple nodes in different AZs (replication group indicator)
  const cacheNodes = nodes.filter(n => 
    ["elasticache", "memorydb"].includes(n.data?.serviceId || "")
  );
  const cacheAZs = new Set(cacheNodes.map(getAZForNode).filter(Boolean));
  
  if (cacheNodes.length >= 2 && cacheAZs.size >= 2) {
    return {
      detected: true,
      bonus: SCORING.haPattern,
      message: "🏆 Cache Replication Group pattern: ElastiCache nodes in multiple AZs! +20 pts",
    };
  }
  
  return { detected: false, bonus: 0, message: "" };
}

/**
 * Detect proper security architecture patterns
 * 
 * Since Security Groups are attachments (not containers), we detect security patterns by:
 * 1. Presence of security group nodes in the diagram (indicates awareness)
 * 2. Proper network segmentation (public/private subnet separation)
 * 3. Resources in private subnets (protected from direct internet access)
 */
export function detectSecurityPattern(nodes: DiagramNode[]): { detected: boolean; bonus: number; message: string } {
  // Pattern 1: Security Group awareness - SG nodes present in diagram
  const securityGroups = nodes.filter(n => n.type === "securityGroup" || n.data?.serviceId === "security-group");
  
  // Pattern 2: Network segmentation - both public and private subnets exist
  const publicSubnets = nodes.filter(n => n.type === "subnet" && n.data?.subnetType === "public");
  const privateSubnets = nodes.filter(n => n.type === "subnet" && n.data?.subnetType === "private");
  const hasNetworkSegmentation = publicSubnets.length >= 1 && privateSubnets.length >= 1;
  
  // Pattern 3: Protected resources in private subnets
  const protectedServices = ["rds", "aurora", "elasticache", "ecs", "fargate", "eks", "msk", "opensearch"];
  
  // Helper: Check if node is in a private subnet
  const isInPrivateSubnet = (node: DiagramNode): boolean => {
    let current: DiagramNode | undefined = node;
    while (current) {
      if (current.type === "subnet" && current.data?.subnetType === "private") {
        return true;
      }
      current = nodes.find(n => n.id === current?.parentId);
    }
    return false;
  };
  
  const protectedResourcesInPrivate = nodes.filter(n => {
    const serviceId = n.data?.serviceId;
    return serviceId && protectedServices.includes(serviceId) && isInPrivateSubnet(n);
  });
  
  // Award bonus for good security patterns
  if (hasNetworkSegmentation && protectedResourcesInPrivate.length >= 1) {
    return {
      detected: true,
      bonus: SCORING.securityBonus,
      message: "🔒 Security best practice: Network segmentation with protected resources in private subnets! +15 pts",
    };
  }
  
  if (securityGroups.length >= 1 && hasNetworkSegmentation) {
    return {
      detected: true,
      bonus: SCORING.securityBonus,
      message: "🔒 Security awareness: Security Groups defined with proper network segmentation! +15 pts",
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

// ============================================
// EDGE TYPES - How resources CONNECT and INTERACT
// ============================================

/**
 * Edge categories represent different types of AWS relationships:
 * - eni: Elastic Network Interface - the atomic network unit in AWS
 * - attachment: Service bindings (IGW→VPC, TGW→VPC, SG→ENI)
 * - endpoint: VPC access to external services (PrivateLink, Gateway Endpoints)
 * - trust: IAM relationships (Role trusts Service, Policy attached to Role)
 * - data: Data flow connections (ALB→Target, NAT→IGW)
 * - control: Control plane relationships (CloudFormation→Resources)
 */
export type EdgeCategory = "eni" | "attachment" | "endpoint" | "trust" | "data" | "control";

/**
 * Edge definition for relationship validation
 */
export interface EdgeType {
  id: string;
  name: string;
  category: EdgeCategory;
  description: string;
  // Source and target constraints
  validSources: string[];      // Service IDs that can be the source
  validTargets: string[];      // Service IDs that can be the target
  // Cardinality
  sourceCardinality: "one" | "many";  // Can source have multiple of this edge?
  targetCardinality: "one" | "many";  // Can target receive multiple of this edge?
  // Validation
  requiresSubnet?: boolean;    // Does this edge require subnet context?
  requiresVpc?: boolean;       // Does this edge require VPC context?
  crossAZ?: boolean;           // Can this edge span AZs?
  crossVpc?: boolean;          // Can this edge span VPCs?
  crossRegion?: boolean;       // Can this edge span regions?
}

// ============================================
// ENI EDGE DEFINITIONS
// ============================================

/**
 * Services that create ENIs (Elastic Network Interfaces)
 * ENIs are the atomic network unit - Security Groups attach to ENIs, not services
 */
export const ENI_CREATORS: Record<string, {
  eniCount: "single" | "multiple" | "per-az";
  description: string;
}> = {
  "ec2": { eniCount: "multiple", description: "EC2 can have multiple ENIs attached" },
  "lambda": { eniCount: "multiple", description: "Lambda creates ENIs in subnets when VPC-enabled (Hyperplane)" },
  "rds": { eniCount: "multiple", description: "RDS creates ENIs in each subnet of the subnet group" },
  "aurora": { eniCount: "multiple", description: "Aurora creates ENIs for each instance in the cluster" },
  "elasticache": { eniCount: "multiple", description: "ElastiCache nodes have ENIs in their subnets" },
  "alb": { eniCount: "per-az", description: "ALB creates one ENI per AZ/subnet it's configured in" },
  "nlb": { eniCount: "per-az", description: "NLB creates one ENI per AZ/subnet" },
  "nat-gateway": { eniCount: "single", description: "NAT Gateway has a single ENI in its subnet" },
  "efs": { eniCount: "per-az", description: "EFS mount targets are ENIs, one per AZ" },
  "ecs": { eniCount: "multiple", description: "ECS tasks in awsvpc mode get their own ENIs" },
  "fargate": { eniCount: "multiple", description: "Each Fargate task gets its own ENI" },
  "eks": { eniCount: "multiple", description: "EKS worker nodes and pods can have ENIs" },
  "msk": { eniCount: "multiple", description: "MSK brokers have ENIs in configured subnets" },
  "opensearch": { eniCount: "multiple", description: "OpenSearch nodes have ENIs when VPC-enabled" },
  "redshift": { eniCount: "multiple", description: "Redshift nodes have ENIs in the cluster subnet group" },
  "documentdb": { eniCount: "multiple", description: "DocumentDB instances have ENIs" },
  "neptune": { eniCount: "multiple", description: "Neptune instances have ENIs" },
  "mq": { eniCount: "multiple", description: "Amazon MQ brokers have ENIs" },
  "vpn-gateway": { eniCount: "multiple", description: "VPN Gateway has ENIs for VPN connections" },
  "transit-gateway": { eniCount: "per-az", description: "TGW attachments create ENIs in each AZ" },
  "privatelink": { eniCount: "per-az", description: "Interface endpoints create ENIs per AZ" },
};

// ============================================
// ATTACHMENT EDGE DEFINITIONS
// ============================================

export const ATTACHMENT_EDGES: EdgeType[] = [
  // Gateway Attachments
  {
    id: "igw-vpc",
    name: "Internet Gateway Attachment",
    category: "attachment",
    description: "Internet Gateway attaches to exactly one VPC",
    validSources: ["internet-gateway"],
    validTargets: ["vpc"],
    sourceCardinality: "one",
    targetCardinality: "one",
    requiresVpc: true,
  },
  {
    id: "vgw-vpc",
    name: "VPN Gateway Attachment",
    category: "attachment",
    description: "VPN Gateway attaches to a VPC",
    validSources: ["vpn-gateway"],
    validTargets: ["vpc"],
    sourceCardinality: "one",
    targetCardinality: "one",
    requiresVpc: true,
  },
  {
    id: "tgw-vpc",
    name: "Transit Gateway Attachment",
    category: "attachment",
    description: "Transit Gateway can attach to multiple VPCs",
    validSources: ["transit-gateway"],
    validTargets: ["vpc"],
    sourceCardinality: "many",
    targetCardinality: "many",
    crossVpc: true,
    crossRegion: true,
  },
  
  // Security Group Attachments (to ENIs, not resources directly)
  {
    id: "sg-eni",
    name: "Security Group to ENI",
    category: "attachment",
    description: "Security Groups attach to ENIs, not directly to resources",
    validSources: ["security-group"],
    validTargets: ["ec2", "lambda", "rds", "aurora", "elasticache", "alb", "nlb", "ecs", "fargate", "eks"],
    sourceCardinality: "many",
    targetCardinality: "many",
    requiresVpc: true,
  },
  
  // Route Table Associations
  {
    id: "rt-subnet",
    name: "Route Table Association",
    category: "attachment",
    description: "Route tables associate with subnets",
    validSources: ["route-table"],
    validTargets: ["subnet-public", "subnet-private", "subnet"],
    sourceCardinality: "many",
    targetCardinality: "one",
    requiresVpc: true,
  },
  
  // NACL Associations
  {
    id: "nacl-subnet",
    name: "Network ACL Association",
    category: "attachment",
    description: "NACLs associate with subnets",
    validSources: ["nacl"],
    validTargets: ["subnet-public", "subnet-private", "subnet"],
    sourceCardinality: "many",
    targetCardinality: "one",
    requiresVpc: true,
  },
  
  // WAF Attachments
  {
    id: "waf-alb",
    name: "WAF to ALB",
    category: "attachment",
    description: "Regional WAF attaches to ALB",
    validSources: ["waf"],
    validTargets: ["alb"],
    sourceCardinality: "one",
    targetCardinality: "many",
  },
  {
    id: "waf-cloudfront",
    name: "WAF to CloudFront",
    category: "attachment",
    description: "Global WAF attaches to CloudFront distribution",
    validSources: ["waf"],
    validTargets: ["cloudfront"],
    sourceCardinality: "one",
    targetCardinality: "many",
    crossRegion: true,
  },
  {
    id: "waf-apigw",
    name: "WAF to API Gateway",
    category: "attachment",
    description: "WAF attaches to API Gateway",
    validSources: ["waf"],
    validTargets: ["api-gateway"],
    sourceCardinality: "one",
    targetCardinality: "many",
  },
];

// ============================================
// ENDPOINT EDGE DEFINITIONS
// ============================================

export const ENDPOINT_EDGES: EdgeType[] = [
  // Gateway Endpoints (route-table based, no ENI)
  {
    id: "gwep-s3",
    name: "Gateway Endpoint to S3",
    category: "endpoint",
    description: "Gateway endpoint provides private access to S3 via route tables",
    validSources: ["vpc"],
    validTargets: ["s3"],
    sourceCardinality: "one",
    targetCardinality: "one",
    requiresVpc: true,
  },
  {
    id: "gwep-dynamodb",
    name: "Gateway Endpoint to DynamoDB",
    category: "endpoint",
    description: "Gateway endpoint provides private access to DynamoDB via route tables",
    validSources: ["vpc"],
    validTargets: ["dynamodb"],
    sourceCardinality: "one",
    targetCardinality: "one",
    requiresVpc: true,
  },
  
  // Interface Endpoints (ENI-based via PrivateLink)
  // Note: These are common VPC endpoint-enabled services that users expect.
  // Excludes services like "ec2" which would confuse users (PrivateLink is for API access, not instance connectivity)
  {
    id: "ifep-service",
    name: "Interface Endpoint",
    category: "endpoint",
    description: "Interface endpoint creates ENIs for private access to AWS service APIs",
    validSources: ["privatelink"],
    validTargets: [
      // Container & Compute APIs
      "ecr", "ecs", "lambda", "eks",
      // Security & Secrets
      "secrets-manager", "kms", "sts",
      // Messaging
      "sns", "sqs", "kinesis", "eventbridge",
      // Monitoring & Management
      "cloudwatch", "cloudwatch-logs", "ssm", "xray",
      // Integration
      "step-functions", "api-gateway",
      // Analytics
      "athena", "glue",
      // Storage (for API access, not data transfer - use Gateway Endpoints for S3/DynamoDB)
      "codecommit", "codeartifact",
    ],
    sourceCardinality: "many",
    targetCardinality: "many",
    requiresSubnet: true,
    requiresVpc: true,
  },
];

// ============================================
// TRUST EDGE DEFINITIONS (IAM)
// ============================================

export const TRUST_EDGES: EdgeType[] = [
  // Role Trust Relationships
  {
    id: "role-trust-service",
    name: "Role Trusts Service",
    category: "trust",
    description: "IAM Role trusts an AWS service to assume it",
    validSources: ["iam-role"],
    validTargets: ["ec2", "lambda", "ecs", "eks", "rds", "s3", "cloudformation", "codepipeline", "codebuild"],
    sourceCardinality: "many",
    targetCardinality: "many",
  },
  {
    id: "role-trust-account",
    name: "Role Trusts Account",
    category: "trust",
    description: "IAM Role trusts another AWS account",
    validSources: ["iam-role"],
    validTargets: ["accountNode"],
    sourceCardinality: "many",
    targetCardinality: "many",
    crossRegion: true,
  },
  
  // Policy Attachments
  {
    id: "policy-role",
    name: "Policy Attached to Role",
    category: "trust",
    description: "IAM Policy attached to a Role",
    validSources: ["iam-policy"],
    validTargets: ["iam-role"],
    sourceCardinality: "many",
    targetCardinality: "many",
  },
  {
    id: "policy-user",
    name: "Policy Attached to User",
    category: "trust",
    description: "IAM Policy attached to a User",
    validSources: ["iam-policy"],
    validTargets: ["iam-user"],
    sourceCardinality: "many",
    targetCardinality: "many",
  },
  {
    id: "policy-group",
    name: "Policy Attached to Group",
    category: "trust",
    description: "IAM Policy attached to a Group",
    validSources: ["iam-policy"],
    validTargets: ["iam-group"],
    sourceCardinality: "many",
    targetCardinality: "many",
  },
  
  // Resource-Based Policies
  {
    id: "resource-policy",
    name: "Resource-Based Policy",
    category: "trust",
    description: "Resource allows access from principals",
    validSources: ["s3", "sqs", "sns", "lambda", "kms", "secrets-manager", "ecr"],
    validTargets: ["iam-role", "iam-user", "accountNode"],
    sourceCardinality: "one",
    targetCardinality: "many",
    crossRegion: true,
  },
  
  // SCP (Service Control Policy)
  {
    id: "scp-ou",
    name: "SCP Applied to OU",
    category: "trust",
    description: "Service Control Policy applied to Organizational Unit",
    validSources: ["scp"],
    validTargets: ["organizations", "accountNode"],
    sourceCardinality: "many",
    targetCardinality: "many",
  },
];

// ============================================
// DATA FLOW EDGE DEFINITIONS
// ============================================

export const DATA_FLOW_EDGES: EdgeType[] = [
  // Load Balancer to Targets
  {
    id: "alb-target",
    name: "ALB to Target",
    category: "data",
    description: "ALB routes traffic to targets (EC2, ECS, Lambda, IP)",
    validSources: ["alb"],
    validTargets: ["ec2", "ecs", "fargate", "lambda", "eks"],
    sourceCardinality: "one",
    targetCardinality: "many",
    requiresVpc: true,
    crossAZ: true,
  },
  {
    id: "nlb-target",
    name: "NLB to Target",
    category: "data",
    description: "NLB routes traffic to targets",
    validSources: ["nlb"],
    validTargets: ["ec2", "ecs", "fargate", "eks", "alb"],
    sourceCardinality: "one",
    targetCardinality: "many",
    requiresVpc: true,
    crossAZ: true,
  },
  
  // NAT Gateway routing
  {
    id: "nat-igw",
    name: "NAT to Internet Gateway",
    category: "data",
    description: "NAT Gateway routes outbound traffic through Internet Gateway",
    validSources: ["nat-gateway"],
    validTargets: ["internet-gateway"],
    sourceCardinality: "many",
    targetCardinality: "one",
    requiresVpc: true,
  },
  
  // CloudFront Origins
  {
    id: "cf-origin",
    name: "CloudFront Origin",
    category: "data",
    description: "CloudFront distribution has origins",
    validSources: ["cloudfront"],
    validTargets: ["s3", "alb", "nlb", "api-gateway", "ec2"],
    sourceCardinality: "one",
    targetCardinality: "many",
    crossRegion: true,
  },
  
  // API Gateway Integrations
  {
    id: "apigw-integration",
    name: "API Gateway Integration",
    category: "data",
    description: "API Gateway integrates with backend services",
    validSources: ["api-gateway"],
    validTargets: ["lambda", "ec2", "alb", "nlb", "ecs", "step-functions", "sqs", "kinesis"],
    sourceCardinality: "one",
    targetCardinality: "many",
  },
  
  // Database Connections
  {
    id: "app-db",
    name: "Application to Database",
    category: "data",
    description: "Application connects to database",
    validSources: ["ec2", "ecs", "fargate", "lambda", "eks"],
    validTargets: ["rds", "aurora", "dynamodb", "elasticache", "neptune", "documentdb", "redshift"],
    sourceCardinality: "many",
    targetCardinality: "many",
    requiresVpc: true,
  },
  
  // Messaging
  {
    id: "producer-queue",
    name: "Producer to Queue",
    category: "data",
    description: "Service sends messages to queue",
    validSources: ["ec2", "ecs", "fargate", "lambda", "eks", "api-gateway"],
    validTargets: ["sqs", "sns", "kinesis", "eventbridge", "msk", "mq"],
    sourceCardinality: "many",
    targetCardinality: "many",
  },
  {
    id: "queue-consumer",
    name: "Queue to Consumer",
    category: "data",
    description: "Service consumes from queue",
    validSources: ["sqs", "sns", "kinesis", "eventbridge", "msk", "mq"],
    validTargets: ["lambda", "ec2", "ecs", "fargate", "eks"],
    sourceCardinality: "many",
    targetCardinality: "many",
  },
  
  // Storage Access
  {
    id: "service-s3",
    name: "Service to S3",
    category: "data",
    description: "Service accesses S3",
    validSources: ["ec2", "ecs", "fargate", "lambda", "eks", "glue", "athena", "redshift"],
    validTargets: ["s3"],
    sourceCardinality: "many",
    targetCardinality: "many",
  },
];

// ============================================
// EDGE VALIDATION
// ============================================

export interface EdgeValidation {
  isValid: boolean;
  proTip?: string;
  edgeType?: EdgeType;
}

/**
 * Validate if an edge connection is valid between two services
 */
export function validateEdge(
  sourceServiceId: string,
  targetServiceId: string,
  edgeCategory?: EdgeCategory
): EdgeValidation {
  // Collect all edge definitions
  const allEdges = [
    ...ATTACHMENT_EDGES,
    ...ENDPOINT_EDGES,
    ...TRUST_EDGES,
    ...DATA_FLOW_EDGES,
  ];
  
  // Filter by category if specified
  const edges = edgeCategory 
    ? allEdges.filter(e => e.category === edgeCategory)
    : allEdges;
  
  // Find matching edge type
  const matchingEdge = edges.find(edge => 
    edge.validSources.includes(sourceServiceId) &&
    edge.validTargets.includes(targetServiceId)
  );
  
  if (matchingEdge) {
    return {
      isValid: true,
      edgeType: matchingEdge,
    };
  }
  
  // Check if reverse connection exists (wrong direction)
  const reverseEdge = edges.find(edge =>
    edge.validSources.includes(targetServiceId) &&
    edge.validTargets.includes(sourceServiceId)
  );
  
  if (reverseEdge) {
    return {
      isValid: false,
      proTip: `🔄 Connection direction is reversed. ${reverseEdge.name} flows from ${targetServiceId} to ${sourceServiceId}, not the other way.`,
    };
  }
  
  // Check if source creates ENIs (for network-related connections)
  // ⚠️ IMPORTANT: This is an EDUCATIONAL HINT only, not a correctness validation.
  // Both services having ENIs means traffic CAN flow, but doesn't validate WHY they're connected.
  // This should NOT award points or substitute for explicit edge types.
  // Returning isValid: false because "possible connectivity" ≠ "valid relationship"
  const sourceCreatesENI = ENI_CREATORS[sourceServiceId];
  const targetCreatesENI = ENI_CREATORS[targetServiceId];
  
  if (sourceCreatesENI && targetCreatesENI) {
    return {
      isValid: false,  // Not validated - just a hint about possible connectivity
      proTip: `🔌 Network hint: Both services have ENIs, so traffic CAN flow via VPC network. This connection is allowed but not validated as a known AWS pattern.`,
      // Note: No edgeType returned - this is intentionally a fallback, not a validated relationship
    };
  }
  
  // No matching edge found
  return {
    isValid: false,
    proTip: `❓ No known relationship between ${sourceServiceId} and ${targetServiceId}. Check AWS documentation for valid integration patterns.`,
  };
}

/**
 * Get all valid edge types for a given source service
 */
export function getValidEdgesForSource(sourceServiceId: string): EdgeType[] {
  const allEdges = [
    ...ATTACHMENT_EDGES,
    ...ENDPOINT_EDGES,
    ...TRUST_EDGES,
    ...DATA_FLOW_EDGES,
  ];
  
  return allEdges.filter(edge => edge.validSources.includes(sourceServiceId));
}

/**
 * Get all valid edge types for a given target service
 */
export function getValidEdgesForTarget(targetServiceId: string): EdgeType[] {
  const allEdges = [
    ...ATTACHMENT_EDGES,
    ...ENDPOINT_EDGES,
    ...TRUST_EDGES,
    ...DATA_FLOW_EDGES,
  ];
  
  return allEdges.filter(edge => edge.validTargets.includes(targetServiceId));
}

/**
 * Check if a service creates ENIs (and thus needs subnet/SG context)
 */
export function serviceCreatesENI(serviceId: string): boolean {
  return serviceId in ENI_CREATORS;
}

/**
 * Get ENI information for a service
 */
export function getENIInfo(serviceId: string): { eniCount: string; description: string } | null {
  return ENI_CREATORS[serviceId] || null;
}

// ============================================
// EDGE-BASED PATTERN DETECTION
// ============================================

interface DiagramEdge {
  id: string;
  source: string;      // Node ID
  target: string;      // Node ID
  sourceServiceId?: string;
  targetServiceId?: string;
  edgeType?: string;   // Edge type ID
}

/**
 * Detect if diagram has proper network segmentation with edge validation
 */
export function detectNetworkSegmentationPattern(
  nodes: DiagramNode[],
  edges: DiagramEdge[]
): { detected: boolean; score: number; message: string } {
  // Check for ALB → private subnet targets pattern
  const albNodes = nodes.filter(n => n.data?.serviceId === "alb");
  const privateTargets = nodes.filter(n => {
    const serviceId = n.data?.serviceId;
    return serviceId && ["ec2", "ecs", "fargate", "eks"].includes(serviceId);
  });
  
  // Check if ALB has edges to private targets
  const albToPrivateEdges = edges.filter(e => {
    const sourceNode = nodes.find(n => n.id === e.source);
    return sourceNode?.data?.serviceId === "alb" && 
           privateTargets.some(t => t.id === e.target);
  });
  
  if (albNodes.length >= 1 && albToPrivateEdges.length >= 1) {
    return {
      detected: true,
      score: 15,
      message: "🏗️ Proper network segmentation: ALB routes to private resources",
    };
  }
  
  return { detected: false, score: 0, message: "" };
}

/**
 * Detect proper security group usage via edge relationships
 */
export function detectSecurityGroupEdges(
  nodes: DiagramNode[],
  edges: DiagramEdge[]
): { detected: boolean; score: number; message: string } {
  const sgNodes = nodes.filter(n => 
    n.type === "securityGroup" || n.data?.serviceId === "security-group"
  );
  
  // Check for SG attachment edges
  const sgAttachments = edges.filter(e => {
    const sourceNode = nodes.find(n => n.id === e.source);
    return sourceNode?.data?.serviceId === "security-group";
  });
  
  if (sgNodes.length >= 1 && sgAttachments.length >= 1) {
    return {
      detected: true,
      score: 10,
      message: "🔒 Security Groups properly attached to resources via edges",
    };
  }
  
  return { detected: false, score: 0, message: "" };
}

/**
 * Detect VPC endpoint usage for private access
 */
export function detectPrivateAccessPattern(
  nodes: DiagramNode[],
  edges: DiagramEdge[]
): { detected: boolean; score: number; message: string } {
  const endpointNodes = nodes.filter(n => 
    n.data?.serviceId === "privatelink" || 
    n.data?.serviceId?.includes("endpoint")
  );
  
  const regionalServices = ["s3", "dynamodb", "ecr", "secrets-manager", "kms"];
  const hasRegionalService = nodes.some(n => 
    regionalServices.includes(n.data?.serviceId || "")
  );
  
  // Check for endpoint edges to regional services
  const endpointEdges = edges.filter(e => {
    const targetNode = nodes.find(n => n.id === e.target);
    return endpointNodes.some(ep => ep.id === e.source) &&
           regionalServices.includes(targetNode?.data?.serviceId || "");
  });
  
  if (endpointNodes.length >= 1 && endpointEdges.length >= 1) {
    return {
      detected: true,
      score: 20,
      message: "🔐 Private access pattern: VPC Endpoints for secure service access",
    };
  }
  
  // Suggest endpoints if regional services exist but no endpoints
  if (hasRegionalService && endpointNodes.length === 0) {
    return {
      detected: false,
      score: 0,
      message: "💡 Consider adding VPC Endpoints for private access to S3/DynamoDB/ECR",
    };
  }
  
  return { detected: false, score: 0, message: "" };
}

// ============================================
// AUDIT EXPORT - Single Source of Truth
// ============================================

/**
 * Export placement rules in a format suitable for the audit endpoint.
 * This ensures the Learning Agent uses the same rules as the real-time UI validation.
 * 
 * The audit endpoint should use this instead of aws-services.ts to maintain consistency.
 */
export interface AuditServiceRule {
  id: string;
  name: string;
  category: string;
  scope: ServiceScope;
  isVpcResource: boolean;
  isContainer: boolean;
  mustBeInside: string[];
  canConnectTo: string[];
  eniInfo: { eniCount: string; description: string } | null;
}

export function getPlacementRulesForAudit(): {
  services: AuditServiceRule[];
  placementRules: typeof PLACEMENT_RULES;
  edgeTypes: {
    attachment: typeof ATTACHMENT_EDGES;
    endpoint: typeof ENDPOINT_EDGES;
    trust: typeof TRUST_EDGES;
    dataFlow: typeof DATA_FLOW_EDGES;
  };
} {
  // Build service rules from SERVICE_METADATA + PLACEMENT_RULES
  const services: AuditServiceRule[] = [];
  
  for (const [serviceId, metadata] of Object.entries(SERVICE_METADATA)) {
    // Determine mustBeInside from PLACEMENT_RULES (reverse lookup)
    const mustBeInside: string[] = [];
    for (const [containerType, rules] of Object.entries(PLACEMENT_RULES)) {
      if (rules.allowedChildren.includes(serviceId)) {
        mustBeInside.push(containerType);
      }
    }
    
    // Determine canConnectTo from edge definitions
    const canConnectTo: string[] = [];
    const allEdges = [...ATTACHMENT_EDGES, ...ENDPOINT_EDGES, ...DATA_FLOW_EDGES];
    for (const edge of allEdges) {
      if (edge.validSources.includes(serviceId)) {
        canConnectTo.push(...edge.validTargets);
      }
    }
    // Deduplicate
    const uniqueCanConnectTo = [...new Set(canConnectTo)];
    
    // Determine if this is a container
    const isContainer = serviceId in PLACEMENT_RULES && 
                        PLACEMENT_RULES[serviceId].allowedChildren.length > 0;
    
    services.push({
      id: serviceId,
      name: metadata.name,
      category: metadata.category,
      scope: metadata.scope,
      isVpcResource: metadata.isVpcResource,
      isContainer,
      mustBeInside,
      canConnectTo: uniqueCanConnectTo,
      eniInfo: ENI_CREATORS[serviceId] || null,
    });
  }
  
  return {
    services,
    placementRules: PLACEMENT_RULES,
    edgeTypes: {
      attachment: ATTACHMENT_EDGES,
      endpoint: ENDPOINT_EDGES,
      trust: TRUST_EDGES,
      dataFlow: DATA_FLOW_EDGES,
    },
  };
}

/**
 * Validate a complete diagram against placement rules.
 * Returns a structured audit result that can be used by the audit endpoint.
 */
export interface DiagramAuditResult {
  score: number;
  maxScore: number;
  isValid: boolean;
  correct: string[];
  incorrect: string[];
  missing: string[];
  suggestions: string[];
  placementIssues: Array<{
    nodeId: string;
    serviceId: string;
    issue: string;
    suggestion: string;
    severity: "error" | "warning" | "note";
  }>;
  connectionIssues: Array<{
    sourceId: string;
    targetId: string;
    issue: string;
    suggestion: string;
    severity: "error" | "warning" | "note";
  }>;
  patterns: {
    ha: { detected: boolean; bonus: number; message: string };
    security: { detected: boolean; bonus: number; message: string };
  };
}

/**
 * Classify placement issue severity
 * 
 * ERROR: Hard invalid - wrong scope (global in VPC, regional in subnet, etc.)
 * WARNING: Soft architectural - suboptimal but functional  
 * NOTE: Diagram abstraction - visually simplified but acceptable
 */
function classifyPlacementSeverity(
  serviceId: string,
  parentType: string,
  metadata: ServiceMetadata
): "error" | "warning" | "note" {
  const scope = metadata.scope;
  
  // ERRORS: Scope violations - these are always wrong
  // Global/edge services inside VPC or subnet
  if ((scope === "global" || scope === "edge") && 
      (parentType === "vpc" || parentType.startsWith("subnet"))) {
    return "error";
  }
  
  // Regional services inside subnet (S3, DynamoDB in subnet)
  if (scope === "regional" && !metadata.isVpcResource && parentType.startsWith("subnet")) {
    return "error";
  }
  
  // VPC resource in wrong container type (EC2 in Security Group as container)
  if (parentType === "securityGroup" || parentType === "security-group") {
    return "error"; // SG is not a container
  }
  
  // RDS/databases in public subnet - security error
  if (serviceId === "rds" || serviceId === "aurora" || serviceId === "elasticache" || 
      serviceId === "redshift" || serviceId === "neptune" || serviceId === "documentdb") {
    if (parentType === "subnet-public") {
      return "error";
    }
  }
  
  // Default to warning for other placement issues
  // These are suboptimal but functional placements
  return "warning";
}

/**
 * Classify connection issue severity
 * 
 * ERROR: Invalid connection (EC2→VPC, Subnet→EC2)
 * WARNING: Suboptimal pattern (missing redundancy)
 * NOTE: Diagram abstraction (IGW→ALB, RDS replication, CloudWatch edges)
 */
function classifyConnectionSeverity(
  sourceServiceId: string,
  targetServiceId: string
): "error" | "warning" | "note" {
  // NOTES: Diagram abstractions that are acceptable
  // IGW → ALB (visually implies IGW → VPC → ALB ENIs)
  if (sourceServiceId === "internet-gateway" && 
      (targetServiceId === "alb" || targetServiceId === "nlb")) {
    return "note";
  }
  
  // RDS → RDS (replication is managed internally)
  if (sourceServiceId === "rds" && targetServiceId === "rds") {
    return "note";
  }
  if (sourceServiceId === "aurora" && targetServiceId === "aurora") {
    return "note";
  }
  
  // CloudWatch → anything (monitoring relationship)
  if (sourceServiceId === "cloudwatch") {
    return "note";
  }
  
  // Anything → CloudWatch (metrics/logs)
  if (targetServiceId === "cloudwatch") {
    return "note";
  }
  
  // ERRORS: Structurally invalid connections
  // Connecting to containers as if they were resources
  const containers = ["vpc", "subnet-public", "subnet-private", "region", "availabilityZone", "awsCloud"];
  if (containers.includes(targetServiceId) && !containers.includes(sourceServiceId)) {
    // Non-container connecting TO a container (except IGW→VPC which is valid)
    if (!(sourceServiceId === "internet-gateway" && targetServiceId === "vpc")) {
      return "error";
    }
  }
  
  // Container connecting to resource (Subnet→EC2)
  if (containers.includes(sourceServiceId) && !containers.includes(targetServiceId)) {
    return "error";
  }
  
  // Default to warning for other connection issues
  return "warning";
}

export function auditDiagram(
  nodes: DiagramNode[],
  edges: Array<{ id: string; source: string; target: string }>,
  expectedServices?: string[]
): DiagramAuditResult {
  const correct: string[] = [];
  const incorrect: string[] = [];
  const missing: string[] = [];
  const suggestions: string[] = [];
  const placementIssues: DiagramAuditResult["placementIssues"] = [];
  const connectionIssues: DiagramAuditResult["connectionIssues"] = [];
  
  let score = 0;
  let maxScore = 0;
  
  // 1. Validate each node's placement
  for (const node of nodes) {
    const serviceId = node.data?.serviceId;
    if (!serviceId) continue;
    
    // Normalize serviceId to match PLACEMENT_RULES keys
    const normalizedServiceId = normalizeServiceId(serviceId);
    const metadata = SERVICE_METADATA[normalizedServiceId] || SERVICE_METADATA[serviceId];
    if (!metadata) continue;
    
    maxScore += metadata.basePoints;
    
    // Find parent container
    const parentNode = node.parentId ? nodes.find(n => n.id === node.parentId) : null;
    // Normalize parent type - use serviceId if available, fall back to node type
    const parentServiceId = parentNode?.data?.serviceId || parentNode?.type || "canvas";
    const parentType = normalizeServiceId(parentServiceId);
    
    // Handle subnet type
    let effectiveParentType = parentType;
    if (parentType === "subnet" && parentNode?.data?.subnetType) {
      effectiveParentType = `subnet-${parentNode.data.subnetType}`;
    }
    
    // Validate placement
    const validation = validatePlacement(normalizedServiceId, effectiveParentType);
    
    if (validation.isValid) {
      score += validation.pointsAwarded;
      correct.push(`✅ ${metadata.name} correctly placed in ${effectiveParentType}`);
    } else {
      // Classify severity based on the type of placement error
      // ERROR: Hard invalid - wrong scope (global in VPC, regional in subnet, etc.)
      // WARNING: Soft architectural - suboptimal but functional
      // NOTE: Diagram abstraction - visually simplified but acceptable
      const severity = classifyPlacementSeverity(serviceId, effectiveParentType, metadata);
      
      if (severity === "error") {
        incorrect.push(`❌ ${metadata.name}: ${validation.proTip}`);
      }
      // Warnings and notes don't go in incorrect - they go in suggestions via placementIssues
      
      placementIssues.push({
        nodeId: node.id,
        serviceId,
        issue: validation.proTip || "Invalid placement",
        suggestion: `Move ${metadata.name} to a valid container`,
        severity,
      });
    }
  }
  
  // 2. Validate each connection
  for (const edge of edges) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) continue;
    
    const sourceServiceId = sourceNode.data?.serviceId;
    const targetServiceId = targetNode.data?.serviceId;
    
    if (!sourceServiceId || !targetServiceId) continue;
    
    const edgeValidation = validateEdge(sourceServiceId, targetServiceId);
    
    if (edgeValidation.isValid && edgeValidation.edgeType) {
      score += 5; // Bonus for valid connection
      maxScore += 5;
      correct.push(`✅ Valid connection: ${edgeValidation.edgeType.name}`);
    } else if (!edgeValidation.isValid) {
      maxScore += 5;
      // Classify connection severity
      const severity = classifyConnectionSeverity(sourceServiceId, targetServiceId);
      
      connectionIssues.push({
        sourceId: edge.source,
        targetId: edge.target,
        issue: edgeValidation.proTip || "Invalid connection",
        suggestion: "Review AWS documentation for valid integration patterns",
        severity,
      });
    }
  }
  
  // 3. Check for expected services
  if (expectedServices && expectedServices.length > 0) {
    const placedServiceIds = nodes
      .map(n => n.data?.serviceId)
      .filter((id): id is string => !!id);
    
    for (const expected of expectedServices) {
      maxScore += 10;
      if (placedServiceIds.includes(expected)) {
        score += 10;
        correct.push(`✅ Required service ${expected} is present`);
      } else {
        missing.push(`❌ Missing required service: ${expected}`);
      }
    }
  }
  
  // 4. Detect patterns
  const haPattern = detectHAPattern(nodes);
  const securityPattern = detectSecurityPattern(nodes);
  
  if (haPattern.detected) {
    score += haPattern.bonus;
    maxScore += haPattern.bonus;
    correct.push(haPattern.message);
  }
  
  if (securityPattern.detected) {
    score += securityPattern.bonus;
    maxScore += securityPattern.bonus;
    correct.push(securityPattern.message);
  }
  
  // 5. Generate suggestions
  if (placementIssues.length > 0) {
    suggestions.push("Review service placements - some services are in incorrect containers");
  }
  if (connectionIssues.length > 0) {
    suggestions.push("Review connections - some relationships don't match AWS patterns");
  }
  if (!haPattern.detected && nodes.length >= 5) {
    suggestions.push("Consider adding multi-AZ deployment for high availability");
  }
  if (!securityPattern.detected && nodes.length >= 3) {
    suggestions.push("Consider network segmentation with public/private subnets");
  }
  
  // GOLDEN RULE: Only severity="error" issues can invalidate a diagram
  // Warnings and notes should NEVER fail the diagram
  const errorPlacements = placementIssues.filter(p => p.severity === "error");
  const errorConnections = connectionIssues.filter(c => c.severity === "error");
  
  return {
    score,
    maxScore: maxScore || 100,
    isValid: errorPlacements.length === 0 && errorConnections.length === 0,
    correct,
    incorrect,
    missing,
    suggestions,
    placementIssues,
    connectionIssues,
    patterns: {
      ha: haPattern,
      security: securityPattern,
    },
  };
}
