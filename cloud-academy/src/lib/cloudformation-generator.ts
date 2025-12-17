/**
 * CloudFormation Template Generator
 * 
 * Converts diagram nodes into a CloudFormation YAML template.
 * Handles resource dependencies, parameters, and outputs.
 * 
 * PRODUCTION FEATURES:
 * - Proper resource naming with Ref/GetAtt
 * - Parameter injection for secrets
 * - Condition support
 * - Output exports for cross-stack references
 * - Metadata for documentation
 */

import type { DiagramNode, DiagramEdge } from "@/components/diagram";

// ============================================================================
// TYPES
// ============================================================================

export interface CloudFormationTemplate {
  AWSTemplateFormatVersion: string;
  Description: string;
  Metadata?: Record<string, unknown>;
  Parameters?: Record<string, CFParameter>;
  Mappings?: Record<string, unknown>;
  Conditions?: Record<string, unknown>;
  Resources: Record<string, CFResource>;
  Outputs?: Record<string, CFOutput>;
}

interface CFParameter {
  Type: string;
  Description?: string;
  Default?: string | number | boolean;
  AllowedValues?: (string | number)[];
  ConstraintDescription?: string;
  NoEcho?: boolean;
}

interface CFResource {
  Type: string;
  DependsOn?: string | string[];
  Properties: Record<string, unknown>;
  Metadata?: Record<string, unknown>;
}

interface CFOutput {
  Description?: string;
  Value: unknown;
  Export?: { Name: string };
}

export interface GeneratorOptions {
  stackName: string;
  environment: string;
  region: string;
  includeOutputs: boolean;
  includeParameters: boolean;
}

// ============================================================================
// RESOURCE TEMPLATES
// ============================================================================

type ResourceGenerator = (
  node: DiagramNode,
  logicalId: string,
  context: GenerationContext
) => CFResource;

const RESOURCE_GENERATORS: Record<string, ResourceGenerator> = {
  // -------------------------------------------------------------------------
  // NETWORKING
  // -------------------------------------------------------------------------
  "vpc": (node, logicalId, ctx) => ({
    Type: "AWS::EC2::VPC",
    Properties: {
      CidrBlock: node.data.config?.cidrBlock || "10.0.0.0/16",
      EnableDnsHostnames: true,
      EnableDnsSupport: true,
      Tags: ctx.getTags(node, logicalId),
    },
  }),

  "subnet": (node, logicalId, ctx) => {
    const vpcRef = ctx.getParentRef(node, "vpc");
    const subnetIndex = ctx.getSubnetIndex();
    return {
      Type: "AWS::EC2::Subnet",
      DependsOn: ctx.getParentLogicalId(node, "vpc"),
      Properties: {
        VpcId: vpcRef,
        CidrBlock: node.data.config?.cidrBlock || `10.0.${subnetIndex}.0/24`,
        AvailabilityZone: node.data.config?.availabilityZone || { "Fn::Select": [subnetIndex % 2, { "Fn::GetAZs": "" }] },
        MapPublicIpOnLaunch: node.data.config?.public || false,
        Tags: ctx.getTags(node, logicalId),
      },
    };
  },

  "internet-gateway": (node, logicalId, ctx) => ({
    Type: "AWS::EC2::InternetGateway",
    Properties: {
      Tags: ctx.getTags(node, logicalId),
    },
  }),

  "nat-gateway": (node, logicalId, ctx) => {
    const subnetRef = ctx.getParentRef(node, "subnet");
    const eipLogicalId = `${logicalId}EIP`;
    ctx.addResource(eipLogicalId, {
      Type: "AWS::EC2::EIP",
      Properties: { Domain: "vpc" },
    });
    return {
      Type: "AWS::EC2::NatGateway",
      DependsOn: eipLogicalId,
      Properties: {
        AllocationId: { "Fn::GetAtt": [eipLogicalId, "AllocationId"] },
        SubnetId: subnetRef,
        Tags: ctx.getTags(node, logicalId),
      },
    };
  },

  "security-group": (node, logicalId, ctx) => {
    const vpcRef = ctx.getParentRef(node, "vpc") || ctx.findVpcRef();
    return {
      Type: "AWS::EC2::SecurityGroup",
      Properties: {
        GroupDescription: node.data.config?.description || `Security group for ${node.data.label}`,
        VpcId: vpcRef,
        SecurityGroupIngress: node.data.config?.ingressRules || [],
        SecurityGroupEgress: node.data.config?.egressRules || [
          { IpProtocol: "-1", CidrIp: "0.0.0.0/0" },
        ],
        Tags: ctx.getTags(node, logicalId),
      },
    };
  },

  "route-table": (node, logicalId, ctx) => {
    const vpcRef = ctx.getParentRef(node, "vpc") || ctx.findVpcRef();
    return {
      Type: "AWS::EC2::RouteTable",
      Properties: {
        VpcId: vpcRef,
        Tags: ctx.getTags(node, logicalId),
      },
    };
  },

  "elastic-ip": (node, logicalId, ctx) => ({
    Type: "AWS::EC2::EIP",
    Properties: {
      Domain: "vpc",
      Tags: ctx.getTags(node, logicalId),
    },
  }),

  // -------------------------------------------------------------------------
  // COMPUTE
  // -------------------------------------------------------------------------
  "ec2": (node, logicalId, ctx) => {
    const subnetRef = ctx.getParentRef(node, "subnet");
    const sgRef = ctx.getConnectedRef(node, "security-group");
    return {
      Type: "AWS::EC2::Instance",
      Properties: {
        InstanceType: node.data.config?.instanceType || "t3.micro",
        ImageId: node.data.config?.ami || { Ref: "LatestAmiId" },
        SubnetId: subnetRef,
        SecurityGroupIds: sgRef ? [sgRef] : [],
        Tags: ctx.getTags(node, logicalId),
      },
    };
  },

  "lambda": (node, logicalId, ctx) => ({
    Type: "AWS::Lambda::Function",
    Properties: {
      FunctionName: logicalId,
      Runtime: node.data.config?.runtime || "nodejs18.x",
      Handler: node.data.config?.handler || "index.handler",
      Role: node.data.config?.role || { "Fn::GetAtt": [`${logicalId}Role`, "Arn"] },
      MemorySize: node.data.config?.memory || 128,
      Timeout: node.data.config?.timeout || 30,
      Code: {
        ZipFile: `exports.handler = async (event) => { return { statusCode: 200, body: 'Hello from ${logicalId}' }; };`,
      },
      Tags: ctx.getTagsArray(node, logicalId),
    },
  }),

  "ecs-cluster": (node, logicalId, ctx) => ({
    Type: "AWS::ECS::Cluster",
    Properties: {
      ClusterName: logicalId,
      CapacityProviders: ["FARGATE", "FARGATE_SPOT"],
      Tags: ctx.getTagsArray(node, logicalId),
    },
  }),

  "auto-scaling": (node, logicalId, ctx) => ({
    Type: "AWS::AutoScaling::AutoScalingGroup",
    Properties: {
      AutoScalingGroupName: logicalId,
      MinSize: node.data.config?.minSize || "1",
      MaxSize: node.data.config?.maxSize || "3",
      DesiredCapacity: node.data.config?.desiredCapacity || "1",
      LaunchTemplate: {
        LaunchTemplateId: { Ref: `${logicalId}LaunchTemplate` },
        Version: { "Fn::GetAtt": [`${logicalId}LaunchTemplate`, "LatestVersionNumber"] },
      },
      VPCZoneIdentifier: ctx.getAllSubnetRefs(),
      Tags: ctx.getTagsArray(node, logicalId).map((t: Record<string, string>) => ({ ...t, PropagateAtLaunch: true })),
    },
  }),

  // -------------------------------------------------------------------------
  // DATABASE
  // -------------------------------------------------------------------------
  "rds": (node, logicalId, ctx) => {
    const sgRef = ctx.getConnectedRef(node, "security-group");
    return {
      Type: "AWS::RDS::DBInstance",
      DeletionPolicy: "Snapshot",
      Properties: {
        DBInstanceIdentifier: logicalId.toLowerCase(),
        DBInstanceClass: node.data.config?.instanceClass || "db.t3.micro",
        Engine: node.data.config?.engine || "mysql",
        EngineVersion: node.data.config?.engineVersion,
        AllocatedStorage: node.data.config?.allocatedStorage || "20",
        MasterUsername: { Ref: "DBUsername" },
        MasterUserPassword: { Ref: "DBPassword" },
        VPCSecurityGroups: sgRef ? [sgRef] : [],
        DBSubnetGroupName: { Ref: `${logicalId}SubnetGroup` },
        PubliclyAccessible: false,
        StorageEncrypted: true,
        Tags: ctx.getTagsArray(node, logicalId),
      },
    };
  },

  "aurora": (node, logicalId, ctx) => ({
    Type: "AWS::RDS::DBCluster",
    DeletionPolicy: "Snapshot",
    Properties: {
      DBClusterIdentifier: logicalId.toLowerCase(),
      Engine: node.data.config?.engine || "aurora-mysql",
      EngineMode: "provisioned",
      MasterUsername: { Ref: "DBUsername" },
      MasterUserPassword: { Ref: "DBPassword" },
      StorageEncrypted: true,
      Tags: ctx.getTagsArray(node, logicalId),
    },
  }),

  "dynamodb": (node, logicalId, ctx) => ({
    Type: "AWS::DynamoDB::Table",
    Properties: {
      TableName: logicalId,
      BillingMode: node.data.config?.billingMode || "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: node.data.config?.partitionKey || "id", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: node.data.config?.partitionKey || "id", KeyType: "HASH" },
      ],
      Tags: ctx.getTagsArray(node, logicalId),
    },
  }),

  "elasticache": (node, logicalId, ctx) => ({
    Type: "AWS::ElastiCache::CacheCluster",
    Properties: {
      ClusterName: logicalId,
      Engine: node.data.config?.engine || "redis",
      CacheNodeType: node.data.config?.nodeType || "cache.t3.micro",
      NumCacheNodes: node.data.config?.numCacheNodes || 1,
      Tags: ctx.getTagsArray(node, logicalId),
    },
  }),

  // -------------------------------------------------------------------------
  // STORAGE
  // -------------------------------------------------------------------------
  "s3": (node, logicalId, ctx) => ({
    Type: "AWS::S3::Bucket",
    DeletionPolicy: "Retain",
    Properties: {
      BucketName: `${ctx.opts.stackName}-${logicalId}`.toLowerCase(),
      VersioningConfiguration: {
        Status: node.data.config?.versioning ? "Enabled" : "Suspended",
      },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } },
        ],
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      Tags: ctx.getTagsArray(node, logicalId),
    },
  }),

  "efs": (node, logicalId, ctx) => ({
    Type: "AWS::EFS::FileSystem",
    Properties: {
      PerformanceMode: "generalPurpose",
      ThroughputMode: "bursting",
      Encrypted: true,
      FileSystemTags: ctx.getTagsArray(node, logicalId),
    },
  }),

  // -------------------------------------------------------------------------
  // LOAD BALANCING
  // -------------------------------------------------------------------------
  "alb": (node, logicalId, ctx) => {
    const sgRef = ctx.getConnectedRef(node, "security-group");
    return {
      Type: "AWS::ElasticLoadBalancingV2::LoadBalancer",
      Properties: {
        Name: logicalId,
        Type: "application",
        Scheme: "internet-facing",
        Subnets: ctx.getAllSubnetRefs(),
        SecurityGroups: sgRef ? [sgRef] : [],
        Tags: ctx.getTagsArray(node, logicalId),
      },
    };
  },

  "nlb": (node, logicalId, ctx) => ({
    Type: "AWS::ElasticLoadBalancingV2::LoadBalancer",
    Properties: {
      Name: logicalId,
      Type: "network",
      Scheme: "internet-facing",
      Subnets: ctx.getAllSubnetRefs(),
      Tags: ctx.getTagsArray(node, logicalId),
    },
  }),

  // -------------------------------------------------------------------------
  // MESSAGING
  // -------------------------------------------------------------------------
  "sqs": (node, logicalId, ctx) => ({
    Type: "AWS::SQS::Queue",
    Properties: {
      QueueName: node.data.config?.fifo ? `${logicalId}.fifo` : logicalId,
      FifoQueue: node.data.config?.fifo || false,
      Tags: ctx.getTagsArray(node, logicalId),
    },
  }),

  "sns": (node, logicalId, ctx) => ({
    Type: "AWS::SNS::Topic",
    Properties: {
      TopicName: logicalId,
      Tags: ctx.getTagsArray(node, logicalId),
    },
  }),

  "eventbridge": (node, logicalId, ctx) => ({
    Type: "AWS::Events::EventBus",
    Properties: {
      Name: logicalId,
    },
  }),

  // -------------------------------------------------------------------------
  // API & CDN
  // -------------------------------------------------------------------------
  "api-gateway": (node, logicalId, ctx) => ({
    Type: "AWS::ApiGateway::RestApi",
    Properties: {
      Name: logicalId,
      Description: `API Gateway for ${ctx.opts.stackName}`,
      EndpointConfiguration: { Types: ["REGIONAL"] },
      Tags: ctx.getTagsArray(node, logicalId),
    },
  }),

  "cloudfront": (node, logicalId, ctx) => ({
    Type: "AWS::CloudFront::Distribution",
    Properties: {
      DistributionConfig: {
        Enabled: true,
        Comment: `CloudFront for ${ctx.opts.stackName}`,
        DefaultCacheBehavior: {
          TargetOriginId: "default",
          ViewerProtocolPolicy: "redirect-to-https",
          ForwardedValues: { QueryString: false, Cookies: { Forward: "none" } },
        },
        Origins: [
          {
            Id: "default",
            DomainName: node.data.config?.originDomain || "example.com",
            CustomOriginConfig: {
              HTTPPort: 80,
              HTTPSPort: 443,
              OriginProtocolPolicy: "https-only",
            },
          },
        ],
      },
      Tags: ctx.getTagsArray(node, logicalId),
    },
  }),

  // -------------------------------------------------------------------------
  // SECURITY
  // -------------------------------------------------------------------------
  "iam-role": (node, logicalId, ctx) => ({
    Type: "AWS::IAM::Role",
    Properties: {
      RoleName: logicalId,
      AssumeRolePolicyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: node.data.config?.service || "ec2.amazonaws.com" },
            Action: "sts:AssumeRole",
          },
        ],
      },
      Tags: ctx.getTagsArray(node, logicalId),
    },
  }),

  "secrets-manager": (node, logicalId, ctx) => ({
    Type: "AWS::SecretsManager::Secret",
    Properties: {
      Name: logicalId,
      Description: `Secret for ${ctx.opts.stackName}`,
      GenerateSecretString: {
        SecretStringTemplate: '{"username": "admin"}',
        GenerateStringKey: "password",
        PasswordLength: 32,
        ExcludeCharacters: '"@/\\',
      },
      Tags: ctx.getTagsArray(node, logicalId),
    },
  }),

  "kms": (node, logicalId, ctx) => ({
    Type: "AWS::KMS::Key",
    Properties: {
      Description: `KMS key for ${ctx.opts.stackName}`,
      EnableKeyRotation: true,
      KeyPolicy: {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "Enable IAM User Permissions",
            Effect: "Allow",
            Principal: { AWS: { "Fn::Sub": "arn:aws:iam::${AWS::AccountId}:root" } },
            Action: "kms:*",
            Resource: "*",
          },
        ],
      },
      Tags: ctx.getTagsArray(node, logicalId),
    },
  }),

  "cognito": (node, logicalId, ctx) => ({
    Type: "AWS::Cognito::UserPool",
    Properties: {
      UserPoolName: logicalId,
      AutoVerifiedAttributes: ["email"],
      UsernameAttributes: ["email"],
      UserPoolTags: ctx.getTagsObject(node, logicalId),
    },
  }),

  "waf": (node, logicalId, ctx) => ({
    Type: "AWS::WAFv2::WebACL",
    Properties: {
      Name: logicalId,
      Scope: "REGIONAL",
      DefaultAction: { Allow: {} },
      VisibilityConfig: {
        SampledRequestsEnabled: true,
        CloudWatchMetricsEnabled: true,
        MetricName: logicalId,
      },
      Tags: ctx.getTagsArray(node, logicalId),
    },
  }),

  // -------------------------------------------------------------------------
  // MONITORING
  // -------------------------------------------------------------------------
  "cloudwatch": (node, logicalId, ctx) => ({
    Type: "AWS::Logs::LogGroup",
    Properties: {
      LogGroupName: `/aws/${ctx.opts.stackName}/${logicalId}`,
      RetentionInDays: 30,
      Tags: ctx.getTagsArray(node, logicalId),
    },
  }),
};

// ============================================================================
// GENERATION CONTEXT
// ============================================================================

class GenerationContext {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  opts: GeneratorOptions;
  private logicalIds: Map<string, string> = new Map();
  private additionalResources: Record<string, CFResource> = {};
  private subnetCounter = 0;

  constructor(nodes: DiagramNode[], edges: DiagramEdge[], opts: GeneratorOptions) {
    this.nodes = nodes;
    this.edges = edges;
    this.opts = opts;
    
    // Pre-compute logical IDs
    nodes.forEach(node => {
      const logicalId = this.computeLogicalId(node);
      this.logicalIds.set(node.id, logicalId);
    });
  }

  private computeLogicalId(node: DiagramNode): string {
    const label = (node.data.label || node.data.serviceId)
      .replace(/[^a-zA-Z0-9]/g, "")
      .replace(/^[0-9]+/, "");
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  getLogicalId(nodeId: string): string {
    return this.logicalIds.get(nodeId) || "Unknown";
  }

  getParentLogicalId(node: DiagramNode, parentType: string): string | undefined {
    if (!node.parentId) return undefined;
    const parent = this.nodes.find(n => n.id === node.parentId);
    if (!parent) return undefined;
    if (parent.data.serviceId === parentType) {
      return this.getLogicalId(parent.id);
    }
    return this.getParentLogicalId(parent, parentType);
  }

  getParentRef(node: DiagramNode, parentType: string): unknown {
    const logicalId = this.getParentLogicalId(node, parentType);
    if (!logicalId) return undefined;
    return { Ref: logicalId };
  }

  getConnectedRef(node: DiagramNode, targetType: string): unknown {
    const edge = this.edges.find(e => e.source === node.id || e.target === node.id);
    if (!edge) return undefined;
    
    const connectedId = edge.source === node.id ? edge.target : edge.source;
    const connectedNode = this.nodes.find(n => n.id === connectedId);
    
    if (connectedNode?.data.serviceId === targetType) {
      return { Ref: this.getLogicalId(connectedNode.id) };
    }
    return undefined;
  }

  findVpcRef(): unknown {
    const vpc = this.nodes.find(n => n.data.serviceId === "vpc");
    if (vpc) return { Ref: this.getLogicalId(vpc.id) };
    return { Ref: "VPC" };
  }

  getAllSubnetRefs(): unknown[] {
    const subnets = this.nodes.filter(n => n.data.serviceId === "subnet");
    if (subnets.length === 0) return [{ Ref: "Subnet" }];
    return subnets.map(s => ({ Ref: this.getLogicalId(s.id) }));
  }

  getSubnetIndex(): number {
    return this.subnetCounter++;
  }

  getTags(node: DiagramNode, logicalId: string): Array<{ Key: string; Value: string }> {
    return [
      { Key: "Name", Value: logicalId },
      { Key: "Project", Value: this.opts.stackName },
      { Key: "Environment", Value: this.opts.environment },
      { Key: "ManagedBy", Value: "CloudFormation" },
    ];
  }

  getTagsArray(node: DiagramNode, logicalId: string): Array<{ Key: string; Value: string }> {
    return this.getTags(node, logicalId);
  }

  getTagsObject(node: DiagramNode, logicalId: string): Record<string, string> {
    return {
      Name: logicalId,
      Project: this.opts.stackName,
      Environment: this.opts.environment,
      ManagedBy: "CloudFormation",
    };
  }

  addResource(logicalId: string, resource: CFResource): void {
    this.additionalResources[logicalId] = resource;
  }

  getAdditionalResources(): Record<string, CFResource> {
    return this.additionalResources;
  }
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateCloudFormation(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  options: Partial<GeneratorOptions> = {}
): CloudFormationTemplate {
  const opts: GeneratorOptions = {
    stackName: options.stackName || "CloudArchistryStack",
    environment: options.environment || "dev",
    region: options.region || "us-east-1",
    includeOutputs: options.includeOutputs ?? true,
    includeParameters: options.includeParameters ?? true,
  };

  const ctx = new GenerationContext(nodes, edges, opts);
  const resources: Record<string, CFResource> = {};
  const outputs: Record<string, CFOutput> = {};

  // Generate resources for each node
  for (const node of nodes) {
    const serviceId = node.data.serviceId;
    const generator = RESOURCE_GENERATORS[serviceId];
    
    if (!generator) continue;

    const logicalId = ctx.getLogicalId(node.id);
    const resource = generator(node, logicalId, ctx);
    resources[logicalId] = resource;

    // Generate outputs for key resources
    if (opts.includeOutputs) {
      const output = generateOutput(node, logicalId, resource);
      if (output) {
        outputs[`${logicalId}Output`] = output;
      }
    }
  }

  // Add any additional resources created by generators
  Object.assign(resources, ctx.getAdditionalResources());

  // Build template
  const template: CloudFormationTemplate = {
    AWSTemplateFormatVersion: "2010-09-09",
    Description: `Infrastructure stack for ${opts.stackName} (${opts.environment}) - Generated by Cloud Archistry`,
    Metadata: {
      "CloudArchistry::Generator": {
        Version: "1.0.0",
        GeneratedAt: new Date().toISOString(),
        NodeCount: nodes.length,
      },
    },
    Resources: resources,
  };

  // Add parameters if needed
  if (opts.includeParameters) {
    template.Parameters = generateParameters(nodes);
  }

  // Add outputs
  if (opts.includeOutputs && Object.keys(outputs).length > 0) {
    template.Outputs = outputs;
  }

  return template;
}

// ============================================================================
// HELPERS
// ============================================================================

function generateParameters(nodes: DiagramNode[]): Record<string, CFParameter> {
  const params: Record<string, CFParameter> = {
    Environment: {
      Type: "String",
      Default: "dev",
      AllowedValues: ["dev", "staging", "prod"],
      Description: "Deployment environment",
    },
  };

  // Add DB parameters if RDS/Aurora exists
  const hasDatabase = nodes.some(n => ["rds", "aurora"].includes(n.data.serviceId));
  if (hasDatabase) {
    params.DBUsername = {
      Type: "String",
      Default: "admin",
      Description: "Database master username",
    };
    params.DBPassword = {
      Type: "String",
      NoEcho: true,
      Description: "Database master password",
      ConstraintDescription: "Must be at least 8 characters",
    };
  }

  // Add AMI parameter if EC2 exists
  const hasEC2 = nodes.some(n => n.data.serviceId === "ec2");
  if (hasEC2) {
    params.LatestAmiId = {
      Type: "AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>",
      Default: "/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2",
      Description: "Latest Amazon Linux 2 AMI",
    };
  }

  return params;
}

function generateOutput(
  node: DiagramNode,
  logicalId: string,
  resource: CFResource
): CFOutput | null {
  const outputGenerators: Record<string, () => CFOutput> = {
    "vpc": () => ({
      Description: `VPC ID for ${logicalId}`,
      Value: { Ref: logicalId },
      Export: { Name: { "Fn::Sub": `\${AWS::StackName}-${logicalId}` } as unknown as string },
    }),
    "subnet": () => ({
      Description: `Subnet ID for ${logicalId}`,
      Value: { Ref: logicalId },
    }),
    "alb": () => ({
      Description: `Load Balancer DNS for ${logicalId}`,
      Value: { "Fn::GetAtt": [logicalId, "DNSName"] },
    }),
    "rds": () => ({
      Description: `RDS Endpoint for ${logicalId}`,
      Value: { "Fn::GetAtt": [logicalId, "Endpoint.Address"] },
    }),
    "s3": () => ({
      Description: `S3 Bucket Name for ${logicalId}`,
      Value: { Ref: logicalId },
    }),
    "lambda": () => ({
      Description: `Lambda ARN for ${logicalId}`,
      Value: { "Fn::GetAtt": [logicalId, "Arn"] },
    }),
    "api-gateway": () => ({
      Description: `API Gateway ID for ${logicalId}`,
      Value: { Ref: logicalId },
    }),
  };

  const generator = outputGenerators[node.data.serviceId];
  return generator ? generator() : null;
}

// ============================================================================
// YAML EXPORT
// ============================================================================

export function templateToYaml(template: CloudFormationTemplate): string {
  // Simple YAML serializer (for production, use js-yaml)
  return jsonToYaml(template);
}

function jsonToYaml(obj: unknown, indent = 0): string {
  const spaces = "  ".repeat(indent);
  
  if (obj === null || obj === undefined) {
    return "null";
  }
  
  if (typeof obj === "string") {
    if (obj.includes("\n") || obj.includes(":") || obj.includes("#")) {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    return obj;
  }
  
  if (typeof obj === "number" || typeof obj === "boolean") {
    return String(obj);
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj.map(item => `\n${spaces}- ${jsonToYaml(item, indent + 1).trimStart()}`).join("");
  }
  
  if (typeof obj === "object") {
    const entries = Object.entries(obj);
    if (entries.length === 0) return "{}";
    
    // Handle CloudFormation intrinsic functions
    if (entries.length === 1) {
      const [key, value] = entries[0];
      if (key.startsWith("Fn::") || key === "Ref") {
        if (typeof value === "string") {
          return `!${key.replace("Fn::", "")} ${value}`;
        }
      }
    }
    
    return entries.map(([key, value]) => {
      const valueStr = jsonToYaml(value, indent + 1);
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return `\n${spaces}${key}:${valueStr}`;
      }
      if (Array.isArray(value)) {
        return `\n${spaces}${key}:${valueStr}`;
      }
      return `\n${spaces}${key}: ${valueStr}`;
    }).join("");
  }
  
  return String(obj);
}

// ============================================================================
// EXPORTS
// ============================================================================

export { RESOURCE_GENERATORS };
