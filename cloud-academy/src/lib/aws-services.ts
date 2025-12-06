/**
 * AWS Services Registry for Cloud Academy Diagram Builder
 * 
 * Defines all AWS services available for drag-drop architecture diagrams.
 * Uses Lucide icons as fallback - can be extended with official AWS SVGs later.
 */

export type AWSCategory = 
  | "compute"
  | "containers"
  | "database"
  | "storage"
  | "networking"
  | "security"
  | "analytics"
  | "integration"
  | "management";

export interface AWSService {
  id: string;
  name: string;
  shortName: string;
  category: AWSCategory;
  color: string;
  description: string;
  // For diagram validation - what can this service connect to?
  canConnectTo?: string[];
  // For diagram validation - must be inside these container types
  mustBeInside?: string[];
  // Is this a container (VPC, Subnet, etc)?
  isContainer?: boolean;
  // Default configuration
  defaultConfig?: Record<string, unknown>;
}

// AWS Official Category Colors
export const AWS_CATEGORY_COLORS: Record<AWSCategory, string> = {
  compute: "#ED7100",
  containers: "#ED7100",
  database: "#3B48CC",
  storage: "#3F8624",
  networking: "#8C4FFF",
  security: "#DD344C",
  analytics: "#8C4FFF",
  integration: "#E7157B",
  management: "#E7157B",
};

// Category metadata for the service picker
export const AWS_CATEGORIES: Array<{ id: AWSCategory; name: string; color: string; icon: string }> = [
  { id: "networking", name: "Networking", color: "#8C4FFF", icon: "Network" },
  { id: "compute", name: "Compute", color: "#ED7100", icon: "Server" },
  { id: "containers", name: "Containers", color: "#ED7100", icon: "Container" },
  { id: "database", name: "Database", color: "#3B48CC", icon: "Database" },
  { id: "storage", name: "Storage", color: "#3F8624", icon: "HardDrive" },
  { id: "security", name: "Security", color: "#DD344C", icon: "Shield" },
  { id: "analytics", name: "Analytics", color: "#8C4FFF", icon: "BarChart3" },
  { id: "integration", name: "Integration", color: "#E7157B", icon: "Workflow" },
  { id: "management", name: "Management", color: "#E7157B", icon: "Settings" },
];

// ============================================================================
// CORE AWS SERVICES (~45 components)
// These are the services architects actually use daily
// ============================================================================
export const AWS_SERVICES: AWSService[] = [
  // ============ NETWORKING (10) ============
  {
    id: "vpc",
    name: "Amazon VPC",
    shortName: "VPC",
    category: "networking",
    color: "#8C4FFF",
    description: "Virtual Private Cloud - isolated network",
    isContainer: true,
    defaultConfig: { cidrBlock: "10.0.0.0/16" },
  },
  {
    id: "subnet-public",
    name: "Public Subnet",
    shortName: "Public Subnet",
    category: "networking",
    color: "#7AA116",
    description: "Subnet with internet access",
    isContainer: true,
    mustBeInside: ["vpc"],
    defaultConfig: { cidrBlock: "10.0.1.0/24", isPublic: true },
  },
  {
    id: "subnet-private",
    name: "Private Subnet",
    shortName: "Private Subnet",
    category: "networking",
    color: "#527FFF",
    description: "Subnet without direct internet access",
    isContainer: true,
    mustBeInside: ["vpc"],
    defaultConfig: { cidrBlock: "10.0.2.0/24", isPublic: false },
  },
  {
    id: "route-table",
    name: "Route Table",
    shortName: "Route Table",
    category: "networking",
    color: "#8C4FFF",
    description: "Control traffic routing in VPC",
    mustBeInside: ["vpc"],
    canConnectTo: ["subnet-public", "subnet-private", "internet-gateway", "nat-gateway"],
  },
  {
    id: "nacl",
    name: "Network ACL",
    shortName: "NACL",
    category: "networking",
    color: "#8C4FFF",
    description: "Stateless subnet-level firewall",
    mustBeInside: ["vpc"],
    canConnectTo: ["subnet-public", "subnet-private"],
  },
  {
    id: "security-group",
    name: "Security Group",
    shortName: "SG",
    category: "networking",
    color: "#DD344C",
    description: "Stateful instance-level firewall",
    isContainer: true,
    mustBeInside: ["vpc"],
  },
  {
    id: "internet-gateway",
    name: "Internet Gateway",
    shortName: "IGW",
    category: "networking",
    color: "#8C4FFF",
    description: "Connect VPC to the internet",
    canConnectTo: ["vpc", "route-table"],
  },
  {
    id: "nat-gateway",
    name: "NAT Gateway",
    shortName: "NAT GW",
    category: "networking",
    color: "#8C4FFF",
    description: "Enable private subnet internet access",
    mustBeInside: ["subnet-public"],
    canConnectTo: ["route-table"],
  },
  {
    id: "vpc-peering",
    name: "VPC Peering",
    shortName: "VPC Peering",
    category: "networking",
    color: "#8C4FFF",
    description: "Connect two VPCs privately",
    canConnectTo: ["vpc"],
  },
  {
    id: "transit-gateway",
    name: "Transit Gateway",
    shortName: "TGW",
    category: "networking",
    color: "#8C4FFF",
    description: "Hub for VPC and on-premises connectivity",
    canConnectTo: ["vpc", "vpc-peering"],
  },
  {
    id: "alb",
    name: "Application Load Balancer",
    shortName: "ALB",
    category: "networking",
    color: "#8C4FFF",
    description: "Layer 7 load balancer for HTTP/HTTPS",
    mustBeInside: ["subnet-public"],
    canConnectTo: ["ec2", "ecs", "eks", "lambda", "auto-scaling"],
  },
  {
    id: "nlb",
    name: "Network Load Balancer",
    shortName: "NLB",
    category: "networking",
    color: "#8C4FFF",
    description: "Layer 4 load balancer for TCP/UDP",
    mustBeInside: ["subnet-public"],
    canConnectTo: ["ec2", "ecs", "eks", "auto-scaling"],
  },

  // ============ COMPUTE (5) ============
  {
    id: "ec2",
    name: "Amazon EC2",
    shortName: "EC2",
    category: "compute",
    color: "#ED7100",
    description: "Virtual servers in the cloud",
    mustBeInside: ["subnet-public", "subnet-private", "auto-scaling"],
    canConnectTo: ["rds", "aurora", "dynamodb", "s3", "elasticache", "efs", "ebs", "sqs", "sns"],
    defaultConfig: { instanceType: "t3.micro" },
  },
  {
    id: "auto-scaling",
    name: "Auto Scaling Group",
    shortName: "ASG",
    category: "compute",
    color: "#ED7100",
    description: "Automatic EC2 scaling",
    isContainer: true,
    mustBeInside: ["subnet-public", "subnet-private"],
    canConnectTo: ["alb", "nlb"],
  },
  {
    id: "lambda",
    name: "AWS Lambda",
    shortName: "Lambda",
    category: "compute",
    color: "#ED7100",
    description: "Serverless compute",
    canConnectTo: ["rds", "aurora", "dynamodb", "s3", "elasticache", "sqs", "sns", "eventbridge"],
    defaultConfig: { runtime: "nodejs20.x", memory: 128 },
  },
  {
    id: "ebs",
    name: "Amazon EBS",
    shortName: "EBS",
    category: "compute",
    color: "#ED7100",
    description: "Block storage volumes for EC2",
    canConnectTo: ["ec2"],
  },
  {
    id: "efs",
    name: "Amazon EFS",
    shortName: "EFS",
    category: "compute",
    color: "#ED7100",
    description: "Elastic file system for EC2",
    mustBeInside: ["vpc"],
    canConnectTo: ["ec2", "ecs", "eks", "lambda"],
  },

  // ============ CONTAINERS (4) ============
  {
    id: "ecs",
    name: "Amazon ECS",
    shortName: "ECS",
    category: "containers",
    color: "#ED7100",
    description: "Container orchestration service",
    mustBeInside: ["subnet-private"],
    canConnectTo: ["rds", "aurora", "dynamodb", "s3", "elasticache", "ecr"],
  },
  {
    id: "eks",
    name: "Amazon EKS",
    shortName: "EKS",
    category: "containers",
    color: "#ED7100",
    description: "Managed Kubernetes service",
    mustBeInside: ["subnet-private"],
    canConnectTo: ["rds", "aurora", "dynamodb", "s3", "elasticache", "ecr"],
  },
  {
    id: "fargate",
    name: "AWS Fargate",
    shortName: "Fargate",
    category: "containers",
    color: "#ED7100",
    description: "Serverless containers",
    canConnectTo: ["rds", "aurora", "dynamodb", "s3", "ecr"],
  },
  {
    id: "ecr",
    name: "Amazon ECR",
    shortName: "ECR",
    category: "containers",
    color: "#ED7100",
    description: "Container image registry",
    canConnectTo: ["ecs", "eks", "fargate"],
  },

  // ============ DATABASE (6) ============
  {
    id: "rds",
    name: "Amazon RDS",
    shortName: "RDS",
    category: "database",
    color: "#3B48CC",
    description: "Managed relational database",
    mustBeInside: ["subnet-private"],
    defaultConfig: { engine: "postgresql", instanceClass: "db.t3.micro", multiAZ: false },
  },
  {
    id: "aurora",
    name: "Amazon Aurora",
    shortName: "Aurora",
    category: "database",
    color: "#3B48CC",
    description: "High-performance MySQL/PostgreSQL",
    mustBeInside: ["subnet-private"],
    defaultConfig: { engine: "aurora-postgresql", multiAZ: true },
  },
  {
    id: "dynamodb",
    name: "Amazon DynamoDB",
    shortName: "DynamoDB",
    category: "database",
    color: "#3B48CC",
    description: "Managed NoSQL database",
    defaultConfig: { billingMode: "PAY_PER_REQUEST" },
  },
  {
    id: "elasticache",
    name: "Amazon ElastiCache",
    shortName: "ElastiCache",
    category: "database",
    color: "#3B48CC",
    description: "In-memory cache (Redis/Memcached)",
    mustBeInside: ["subnet-private"],
    defaultConfig: { engine: "redis" },
  },
  {
    id: "redshift",
    name: "Amazon Redshift",
    shortName: "Redshift",
    category: "database",
    color: "#3B48CC",
    description: "Data warehouse",
    mustBeInside: ["subnet-private"],
  },
  {
    id: "neptune",
    name: "Amazon Neptune",
    shortName: "Neptune",
    category: "database",
    color: "#3B48CC",
    description: "Graph database",
    mustBeInside: ["subnet-private"],
  },

  // ============ STORAGE (3) ============
  {
    id: "s3",
    name: "Amazon S3",
    shortName: "S3",
    category: "storage",
    color: "#3F8624",
    description: "Object storage",
    canConnectTo: ["cloudfront", "lambda", "eventbridge"],
    defaultConfig: { versioning: false },
  },
  {
    id: "glacier",
    name: "Amazon S3 Glacier",
    shortName: "Glacier",
    category: "storage",
    color: "#3F8624",
    description: "Archive storage",
    canConnectTo: ["s3"],
  },
  {
    id: "backup",
    name: "AWS Backup",
    shortName: "Backup",
    category: "storage",
    color: "#3F8624",
    description: "Centralized backup service",
    canConnectTo: ["rds", "aurora", "dynamodb", "efs", "ebs", "s3"],
  },

  // ============ SECURITY (7) ============
  {
    id: "iam",
    name: "AWS IAM",
    shortName: "IAM",
    category: "security",
    color: "#DD344C",
    description: "Identity and access management",
  },
  {
    id: "kms",
    name: "AWS KMS",
    shortName: "KMS",
    category: "security",
    color: "#DD344C",
    description: "Key management service",
    canConnectTo: ["s3", "rds", "aurora", "ebs", "efs"],
  },
  {
    id: "secrets-manager",
    name: "AWS Secrets Manager",
    shortName: "Secrets Mgr",
    category: "security",
    color: "#DD344C",
    description: "Secrets rotation and management",
    canConnectTo: ["rds", "aurora", "lambda"],
  },
  {
    id: "cognito",
    name: "Amazon Cognito",
    shortName: "Cognito",
    category: "security",
    color: "#DD344C",
    description: "User authentication and authorization",
    canConnectTo: ["api-gateway", "alb", "lambda"],
  },
  {
    id: "waf",
    name: "AWS WAF",
    shortName: "WAF",
    category: "security",
    color: "#DD344C",
    description: "Web application firewall",
    canConnectTo: ["cloudfront", "alb", "api-gateway"],
  },
  {
    id: "shield",
    name: "AWS Shield",
    shortName: "Shield",
    category: "security",
    color: "#DD344C",
    description: "DDoS protection",
    canConnectTo: ["cloudfront", "alb", "nlb"],
  },
  {
    id: "guardduty",
    name: "Amazon GuardDuty",
    shortName: "GuardDuty",
    category: "security",
    color: "#DD344C",
    description: "Threat detection service",
  },

  // ============ INTEGRATION (4) ============
  {
    id: "api-gateway",
    name: "Amazon API Gateway",
    shortName: "API Gateway",
    category: "integration",
    color: "#E7157B",
    description: "API management service",
    canConnectTo: ["lambda", "ec2", "ecs", "alb", "nlb"],
  },
  {
    id: "eventbridge",
    name: "Amazon EventBridge",
    shortName: "EventBridge",
    category: "integration",
    color: "#E7157B",
    description: "Serverless event bus",
    canConnectTo: ["lambda", "sqs", "sns", "api-gateway"],
  },
  {
    id: "sns",
    name: "Amazon SNS",
    shortName: "SNS",
    category: "integration",
    color: "#E7157B",
    description: "Pub/sub messaging",
    canConnectTo: ["lambda", "sqs", "ec2"],
  },
  {
    id: "sqs",
    name: "Amazon SQS",
    shortName: "SQS",
    category: "integration",
    color: "#E7157B",
    description: "Message queue service",
    canConnectTo: ["lambda", "ec2", "ecs"],
  },

  // ============ MANAGEMENT (4) ============
  {
    id: "cloudwatch",
    name: "Amazon CloudWatch",
    shortName: "CloudWatch",
    category: "management",
    color: "#E7157B",
    description: "Monitoring and observability",
  },
  {
    id: "cloudtrail",
    name: "AWS CloudTrail",
    shortName: "CloudTrail",
    category: "management",
    color: "#E7157B",
    description: "API activity logging",
  },
  {
    id: "systems-manager",
    name: "AWS Systems Manager",
    shortName: "SSM",
    category: "management",
    color: "#E7157B",
    description: "Operations management",
    canConnectTo: ["ec2", "ecs", "eks"],
  },
  {
    id: "config",
    name: "AWS Config",
    shortName: "Config",
    category: "management",
    color: "#E7157B",
    description: "Resource configuration tracking",
  },

  // ============ ADDITIONAL NETWORKING ============
  {
    id: "route53",
    name: "Amazon Route 53",
    shortName: "Route 53",
    category: "networking",
    color: "#8C4FFF",
    description: "DNS and domain management",
    canConnectTo: ["alb", "nlb", "cloudfront", "api-gateway", "s3"],
  },
  {
    id: "cloudfront",
    name: "Amazon CloudFront",
    shortName: "CloudFront",
    category: "networking",
    color: "#8C4FFF",
    description: "Content delivery network",
    canConnectTo: ["s3", "alb", "api-gateway", "lambda"],
  },
];

// Helper functions
export function getServiceById(id: string): AWSService | undefined {
  return AWS_SERVICES.find((s) => s.id === id);
}

export function getServicesByCategory(category: AWSCategory): AWSService[] {
  return AWS_SERVICES.filter((s) => s.category === category);
}

export function searchServices(query: string): AWSService[] {
  const q = query.toLowerCase();
  return AWS_SERVICES.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.shortName.toLowerCase().includes(q) ||
      s.id.includes(q) ||
      s.description.toLowerCase().includes(q)
  );
}

// Get container services (VPC, Subnet, etc.)
export function getContainerServices(): AWSService[] {
  return AWS_SERVICES.filter((s) => s.isContainer);
}

// Get non-container services (EC2, RDS, etc.)
export function getResourceServices(): AWSService[] {
  return AWS_SERVICES.filter((s) => !s.isContainer);
}
