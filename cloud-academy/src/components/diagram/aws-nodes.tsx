"use client";

/**
 * AWS Node Components for React Flow
 * 
 * Custom node types for rendering AWS services in the diagram.
 */

import { memo, useState, useRef, useEffect } from "react";
import { Handle, Position, NodeResizer, useReactFlow } from "@xyflow/react";
import { cn } from "@/lib/utils";
import {
  Server,
  Database,
  HardDrive,
  Globe,
  Shield,
  Network,
  Layers,
  Cloud,
  Container,
  Zap,
  Box,
  Key,
  Users,
  Workflow,
  BarChart3,
  Settings,
  Bell,
  Activity,
  Route,
  Boxes,
} from "lucide-react";

// Icon mapping for AWS services (95+ services - synced with aws-services.ts)
const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  // Networking (19)
  "vpc": Network,
  "subnet-public": Layers,
  "subnet-private": Layers,
  "route-table": Route,
  "nacl": Shield,
  "security-group": Shield,
  "internet-gateway": Globe,
  "nat-gateway": Route,
  "vpc-peering": Network,
  "transit-gateway": Network,
  "alb": Boxes,
  "nlb": Boxes,
  "route53": Globe,
  "cloudfront": Cloud,
  "global-accelerator": Globe,
  "vpn-gateway": Network,
  "direct-connect": Network,
  "privatelink": Network,
  "elastic-ip": Network,
  // Compute (7)
  "ec2": Server,
  "auto-scaling": Boxes,
  "lambda": Zap,
  "ebs": HardDrive,
  "efs": HardDrive,
  "batch": Server,
  "lightsail": Server,
  // Containers (4)
  "ecs": Container,
  "eks": Container,
  "fargate": Container,
  "ecr": Box,
  // Database (9)
  "rds": Database,
  "aurora": Database,
  "dynamodb": Database,
  "elasticache": Database,
  "redshift": Database,
  "neptune": Database,
  "documentdb": Database,
  "memorydb": Database,
  "rds-replica": Database,
  // Storage (6)
  "s3": HardDrive,
  "glacier": HardDrive,
  "backup": HardDrive,
  "fsx": HardDrive,
  "storage-gateway": HardDrive,
  "datasync": HardDrive,
  // Security (15)
  "iam": Users,
  "kms": Key,
  "secrets-manager": Key,
  "cognito": Users,
  "waf": Shield,
  "shield": Shield,
  "guardduty": Shield,
  "iam-role": Users,
  "iam-policy": Shield,
  "permission-boundary": Shield,
  "acm": Key,
  "inspector": Shield,
  "macie": Shield,
  "security-hub": Shield,
  "detective": Shield,
  "iam-user": Users,
  "iam-group": Users,
  "resource-policy": Shield,
  "trust-policy": Shield,
  "identity-provider": Users,
  "iam-identity-center": Users,
  // Integration (8)
  "api-gateway": Workflow,
  "eventbridge": Activity,
  "sns": Bell,
  "sqs": Box,
  "step-functions": Workflow,
  "appsync": Workflow,
  "mq": Box,
  "ses": Bell,
  // Management (10)
  "cloudwatch": BarChart3,
  "cloudtrail": Activity,
  "systems-manager": Settings,
  "config": Settings,
  "xray": Activity,
  "cloudwatch-logs": BarChart3,
  "cloudwatch-alarms": Bell,
  "cloudformation": Settings,
  "health-dashboard": Activity,
  "trusted-advisor": Settings,
  // DevOps & CI/CD (6)
  "codecommit": Box,
  "codepipeline": Workflow,
  "codebuild": Server,
  "codedeploy": Boxes,
  "codeartifact": Box,
  "cloud9": Server,
  // Analytics & Streaming (8)
  "kinesis-streams": Activity,
  "kinesis-firehose": Activity,
  "kinesis-analytics": BarChart3,
  "msk": Activity,
  "athena": Database,
  "glue": Settings,
  "quicksight": BarChart3,
  "opensearch": Database,
  // Governance (6)
  "organizations": Users,
  "scp": Shield,
  "control-tower": Settings,
  "service-catalog": Box,
  "license-manager": Key,
  "resource-groups": Boxes,
  // Policies & Rules (15)
  "s3-lifecycle-policy": HardDrive,
  "s3-bucket-policy": Shield,
  "iam-identity-policy": Shield,
  "iam-trust-policy": Shield,
  "resource-based-policy": Shield,
  "vpc-endpoint-policy": Network,
  "backup-policy": HardDrive,
  "scaling-policy": Boxes,
  "dlm-policy": HardDrive,
  "ecr-lifecycle-policy": Box,
  "scp-policy": Shield,
  "permission-boundary-policy": Shield,
  "rds-parameter-group": Settings,
  "elasticache-parameter-group": Settings,
  "waf-rules": Shield,
};

// Map service ID to actual full service name (not "Amazon X" but the real name)
export const SERVICE_FULL_NAMES: Record<string, string> = {
  // Compute
  "ec2": "Elastic Compute Cloud",
  "lambda": "Lambda",
  "auto-scaling": "Auto Scaling Group",
  "ebs": "Elastic Block Store",
  "efs": "Elastic File System",
  "batch": "Batch",
  "lightsail": "Lightsail",
  // Containers
  "ecs": "Elastic Container Service",
  "eks": "Elastic Kubernetes Service",
  "fargate": "Fargate",
  "ecr": "Elastic Container Registry",
  // Database
  "rds": "Relational Database Service",
  "aurora": "Aurora",
  "dynamodb": "DynamoDB",
  "elasticache": "ElastiCache",
  "redshift": "Redshift",
  "neptune": "Neptune",
  "documentdb": "DocumentDB",
  "memorydb": "MemoryDB",
  "rds-replica": "Read Replica",
  // Storage
  "s3": "Simple Storage Service",
  "glacier": "S3 Glacier",
  "backup": "Backup",
  "fsx": "FSx",
  "storage-gateway": "Storage Gateway",
  "datasync": "DataSync",
  // Networking
  "vpc": "Virtual Private Cloud",
  "subnet-public": "Public Subnet",
  "subnet-private": "Private Subnet",
  "route-table": "Route Table",
  "nacl": "Network ACL",
  "security-group": "Security Group",
  "internet-gateway": "Internet Gateway",
  "nat-gateway": "NAT Gateway",
  "vpc-peering": "VPC Peering",
  "transit-gateway": "Transit Gateway",
  "alb": "Application Load Balancer",
  "nlb": "Network Load Balancer",
  "route53": "Route 53",
  "cloudfront": "CloudFront",
  "global-accelerator": "Global Accelerator",
  "vpn-gateway": "VPN Gateway",
  "direct-connect": "Direct Connect",
  "privatelink": "PrivateLink",
  "elastic-ip": "Elastic IP",
  // Security
  "iam": "Identity & Access Management",
  "iam-role": "IAM Role",
  "iam-policy": "IAM Policy",
  "iam-user": "IAM User",
  "iam-group": "IAM Group",
  "kms": "Key Management Service",
  "secrets-manager": "Secrets Manager",
  "cognito": "Cognito",
  "waf": "Web Application Firewall",
  "shield": "Shield",
  "guardduty": "GuardDuty",
  "acm": "Certificate Manager",
  "inspector": "Inspector",
  "macie": "Macie",
  "security-hub": "Security Hub",
  "detective": "Detective",
  "permission-boundary": "Permission Boundary",
  "resource-policy": "Resource Policy",
  "trust-policy": "Trust Policy",
  "identity-provider": "Identity Provider",
  "iam-identity-center": "IAM Identity Center",
  // Integration
  "api-gateway": "API Gateway",
  "eventbridge": "EventBridge",
  "sns": "Simple Notification Service",
  "sqs": "Simple Queue Service",
  "step-functions": "Step Functions",
  "appsync": "AppSync",
  "mq": "MQ",
  "ses": "Simple Email Service",
  // Management
  "cloudwatch": "CloudWatch",
  "cloudtrail": "CloudTrail",
  "systems-manager": "Systems Manager",
  "config": "Config",
  "xray": "X-Ray",
  "cloudwatch-logs": "CloudWatch Logs",
  "cloudwatch-alarms": "CloudWatch Alarms",
  "cloudformation": "CloudFormation",
  "health-dashboard": "Health Dashboard",
  "trusted-advisor": "Trusted Advisor",
  // DevOps
  "codecommit": "CodeCommit",
  "codepipeline": "CodePipeline",
  "codebuild": "CodeBuild",
  "codedeploy": "CodeDeploy",
  "codeartifact": "CodeArtifact",
  "cloud9": "Cloud9",
  // Analytics
  "kinesis-streams": "Kinesis Data Streams",
  "kinesis-firehose": "Kinesis Firehose",
  "kinesis-analytics": "Kinesis Analytics",
  "msk": "Managed Streaming for Kafka",
  "athena": "Athena",
  "glue": "Glue",
  "quicksight": "QuickSight",
  "opensearch": "OpenSearch",
  // Governance
  "organizations": "Organizations",
  "scp": "Service Control Policy",
  "control-tower": "Control Tower",
  "service-catalog": "Service Catalog",
  "license-manager": "License Manager",
  "resource-groups": "Resource Groups",
};

// AWS service name to acronym mapping - only abbreviate long names
const SERVICE_ACRONYMS: Record<string, string> = {
  // Load balancers - always abbreviate
  "Application Load Balancer": "ALB",
  "Network Load Balancer": "NLB",
  "Classic Load Balancer": "CLB",
  "Elastic Load Balancer": "ELB",
  // Gateways
  "NAT Gateway": "NAT GW",
  "Internet Gateway": "IGW",
  "API Gateway": "API GW",
  // Long service names
  "Virtual Private Cloud": "VPC",
  "Elastic Compute Cloud": "EC2",
  "Relational Database Service": "RDS",
  "Simple Storage Service": "S3",
  "Elastic Container Service": "ECS",
  "Elastic Kubernetes Service": "EKS",
  "Key Management Service": "KMS",
  "Identity and Access Management": "IAM",
  "Simple Queue Service": "SQS",
  "Simple Notification Service": "SNS",
  "Web Application Firewall": "WAF",
  "Auto Scaling Group": "ASG",
  "Systems Manager": "SSM",
  "Certificate Manager": "ACM",
  // Keep these readable
  "CloudFront Distribution": "CloudFront",
  "S3 Bucket": "S3",
  "ECS Fargate": "Fargate",
  "Lambda Function": "Lambda",
};

// Get abbreviated label for diagram display
export function getAbbreviatedLabel(label: string): string {
  if (SERVICE_ACRONYMS[label]) return SERVICE_ACRONYMS[label];
  for (const [full, abbrev] of Object.entries(SERVICE_ACRONYMS)) {
    if (label.toLowerCase().includes(full.toLowerCase())) return abbrev;
  }
  if (label.length > 14) return label.substring(0, 12) + "..";
  return label;
}

// Handle styles - visible when selected
const handleClass = (selected?: boolean) => cn(
  "!w-3 !h-3 !bg-cyan-500 !border-2 !border-cyan-600 transition-opacity",
  selected ? "!opacity-100" : "!opacity-0 group-hover:!opacity-50"
);

// ============================================
// AWS Resource Node (EC2, RDS, Lambda, etc.)
// Clean square icon with label below - matches AWS architecture diagrams
// ============================================

// Node style type (shared with service-picker)
interface NodeStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderStyle?: "solid" | "dashed" | "dotted";
  opacity?: number;
}

interface AWSResourceNodeData {
  serviceId: string;
  label: string;
  sublabel?: string;
  color: string;
  config?: Record<string, unknown>;
  iconPath?: string; // Custom icon path for user-added services
  nodeStyle?: NodeStyle; // Custom styling from style panel
}

export const AWSResourceNode = memo(({ data, selected }: { data: AWSResourceNodeData; selected?: boolean }) => {
  const Icon = iconMap[data.serviceId] || Server;
  const color = data.color || "#ED7100";
  const hasCustomIcon = data.iconPath && data.iconPath.startsWith("/aws-icons/");
  
  // Apply custom styles if present
  const nodeStyle = data.nodeStyle || {};
  const bgColor = nodeStyle.backgroundColor || "white";
  const borderColor = selected ? undefined : (nodeStyle.borderColor || "rgb(209 213 219)"); // gray-300
  const borderStyle = nodeStyle.borderStyle || "solid";
  const opacity = (nodeStyle.opacity ?? 100) / 100;

  return (
    <>
      {/* Resizer - only visible when selected */}
      <NodeResizer
        isVisible={selected}
        minWidth={60}
        minHeight={60}
        lineClassName="border-cyan-500"
        handleClassName="w-2 h-2 bg-cyan-500 border border-white rounded-sm"
      />
      <div
        className={cn(
          "rounded-lg border-2 shadow-sm transition-all flex flex-col items-center justify-center w-full h-full overflow-hidden group cursor-pointer",
          selected ? "border-cyan-500 ring-2 ring-cyan-500/30 shadow-lg" : "hover:border-gray-400"
        )}
        style={{ 
          padding: "8%",
          backgroundColor: bgColor,
          borderColor: borderColor,
          borderStyle: borderStyle,
          opacity: opacity,
        }}
      >
        {/* Connection handles */}
        <Handle type="target" position={Position.Top} className={handleClass(selected)} />
        <Handle type="target" position={Position.Left} id="left" className={handleClass(selected)} />
        
        {/* Icon container - takes 60% of height, scales with node */}
        <div className="flex-[3] min-h-0 w-full flex items-center justify-center">
          <div 
            className="h-full aspect-square rounded flex items-center justify-center"
            style={{ backgroundColor: `${color}15`, maxHeight: "100%", maxWidth: "100%" }}
          >
            {hasCustomIcon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.iconPath} alt={data.label} className="w-[65%] h-[65%] object-contain" />
            ) : (
              <Icon className="w-[65%] h-[65%]" style={{ color }} />
            )}
          </div>
        </div>
        
        {/* Labels container - takes 40% of height, scales with node */}
        <div className="flex-[2] min-h-0 w-full flex flex-col items-center justify-center overflow-hidden px-1">
          <p 
            className="font-bold text-gray-800 text-center leading-tight w-full break-words"
            style={{ 
              fontSize: "clamp(6px, 12%, 14px)",
              wordBreak: "break-word",
              overflowWrap: "break-word",
              hyphens: "auto"
            }}
          >
            {data.label}
          </p>
          {data.sublabel && (
            <p 
              className="text-gray-500 text-center leading-tight w-full break-words"
              style={{ 
                fontSize: "clamp(5px, 9%, 11px)",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                hyphens: "auto"
              }}
            >
              {data.sublabel}
            </p>
          )}
        </div>

        {/* Output handles */}
        <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
        <Handle type="source" position={Position.Right} id="right" className={handleClass(selected)} />
      </div>
    </>
  );
});

AWSResourceNode.displayName = "AWSResourceNode";

// ============================================
// VPC Container Node
// ============================================
interface VPCNodeData {
  label: string;
  sublabel?: string;
  width?: number;
  height?: number;
}

export const VPCNode = memo(({ data, selected }: { data: VPCNodeData; selected?: boolean }) => {
  return (
    <div
      className={cn(
        "rounded-lg border-2 border-dashed relative",
        selected ? "border-cyan-500 bg-cyan-50/20" : "border-[#8C4FFF] bg-purple-50/30"
      )}
      style={{ 
        width: "100%",
        height: "100%",
        minWidth: 200,
        minHeight: 150,
      }}
    >
      {/* Resizer - only visible when selected */}
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={150}
        lineClassName="!border-cyan-500"
        handleClassName="!w-3 !h-3 !bg-cyan-500 !border-2 !border-white"
      />
      
      {/* VPC Label */}
      <div className="absolute -top-3 left-4 flex items-center gap-1.5 bg-white px-2 py-0.5 border border-[#8C4FFF] rounded z-10">
        <Network className="w-3.5 h-3.5 text-[#8C4FFF]" />
        <span className="text-[#8C4FFF] text-xs font-medium">{data.label || "VPC"}</span>
        {data.sublabel && <span className="text-gray-500 text-[10px] ml-1">{data.sublabel}</span>}
      </div>
      
      {/* Handles */}
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
    </div>
  );
});

VPCNode.displayName = "VPCNode";

// ============================================
// Subnet Container Node (Public/Private)
// ============================================
interface SubnetNodeData {
  label: string;
  subnetType: "public" | "private";
  width?: number;
  height?: number;
}

export const SubnetNode = memo(({ data, selected }: { data: SubnetNodeData; selected?: boolean }) => {
  const isPublic = data.subnetType === "public";
  const color = isPublic ? "#7AA116" : "#527FFF";
  const bgColor = isPublic ? "rgba(122, 161, 22, 0.15)" : "rgba(82, 127, 255, 0.15)";
  
  return (
    <div
      className={cn(
        "rounded border-2 relative",
        selected ? "border-cyan-500" : ""
      )}
      style={{ 
        backgroundColor: bgColor,
        borderColor: selected ? undefined : color,
        width: "100%",
        height: "100%",
        minWidth: 150,
        minHeight: 100,
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={150}
        minHeight={100}
        lineClassName="!border-cyan-500"
        handleClassName="!w-3 !h-3 !bg-cyan-500 !border-2 !border-white"
      />
      
      {/* Subnet Label */}
      <div 
        className="absolute top-0 left-0 right-0 px-2 py-1 rounded-t flex items-center gap-1.5 z-10"
        style={{ backgroundColor: color }}
      >
        <Layers className="w-3 h-3 text-white" />
        <span className="text-white text-xs font-medium">
          {data.label || (isPublic ? "Public Subnet" : "Private Subnet")}
        </span>
      </div>
      
      {/* Handles */}
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="target" position={Position.Left} id="left" className={handleClass(selected)} />
      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass(selected)} />
    </div>
  );
});

SubnetNode.displayName = "SubnetNode";

// ============================================
// Security Group Container Node
// ============================================
interface SecurityGroupNodeData {
  label: string;
  width?: number;
  height?: number;
}

export const SecurityGroupNode = memo(({ data, selected }: { data: SecurityGroupNodeData; selected?: boolean }) => {
  return (
    <div
      className={cn(
        "rounded border-2 border-dashed relative",
        selected ? "border-cyan-500" : "border-[#DD344C]"
      )}
      style={{ 
        backgroundColor: "rgba(221, 52, 76, 0.05)",
        width: data.width || 180,
        height: data.height || 120,
      }}
    >
      {/* SG Label */}
      <div className="absolute -top-3 left-4 flex items-center gap-1 bg-white px-2 py-0.5 border border-[#DD344C] rounded">
        <Shield className="w-3 h-3 text-[#DD344C]" />
        <span className="text-[#DD344C] text-[10px] font-medium">{data.label || "Security Group"}</span>
      </div>
      
      <Handle type="target" position={Position.Left} className={handleClass(selected)} />
      <Handle type="source" position={Position.Right} className={handleClass(selected)} />
    </div>
  );
});

SecurityGroupNode.displayName = "SecurityGroupNode";

// ============================================
// Auto Scaling Group Container Node
// ============================================
interface AutoScalingNodeData {
  label: string;
  width?: number;
  height?: number;
}

export const AutoScalingNode = memo(({ data, selected }: { data: AutoScalingNodeData; selected?: boolean }) => {
  return (
    <div
      className={cn(
        "rounded border-2 border-dashed relative flex items-center justify-center",
        selected ? "border-cyan-500" : "border-[#ED7100]"
      )}
      style={{ 
        backgroundColor: "rgba(237, 113, 0, 0.05)",
        width: data.width || 150,
        height: data.height || 100,
      }}
    >
      <div className="text-center">
        <Boxes className="w-6 h-6 text-[#ED7100] mx-auto mb-1" />
        <span className="text-[10px] text-gray-600 font-medium">{data.label || "Auto Scaling"}</span>
      </div>
      
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
    </div>
  );
});

AutoScalingNode.displayName = "AutoScalingNode";

// ============================================
// Generic Icon Node (User, Mobile, Internet, etc.)
// ============================================
interface GenericIconNodeData {
  label: string;
  icon: string; // Emoji
  color?: string;
}

export const GenericIconNode = memo(({ data, selected }: { data: GenericIconNodeData; selected?: boolean }) => {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border-2 shadow-sm transition-all flex flex-col items-center p-3 min-w-[80px] group cursor-pointer",
        selected ? "border-cyan-500 ring-2 ring-cyan-500/30 shadow-lg" : "border-gray-300 hover:border-gray-400"
      )}
    >
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="target" position={Position.Left} id="left" className={handleClass(selected)} />
      
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-1.5 text-2xl">
        {data.icon}
      </div>
      
      <p className="text-xs font-medium text-gray-800 text-center leading-tight">{data.label}</p>

      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass(selected)} />
    </div>
  );
});

GenericIconNode.displayName = "GenericIconNode";

// ============================================
// AWS Cloud Boundary Node
// ============================================
interface BoundaryNodeData {
  label: string;
  color?: string;
}

export const AWSCloudNode = memo(({ data, selected }: { data: BoundaryNodeData; selected?: boolean }) => {
  return (
    <div
      className={cn(
        "rounded-lg border-2 border-dashed relative",
        selected ? "border-orange-400 bg-orange-500/5" : "border-slate-500 bg-slate-800/30"
      )}
      style={{ width: "100%", height: "100%", minWidth: 300, minHeight: 200, pointerEvents: "none" }}
    >
      <div style={{ pointerEvents: "auto" }}>
        <NodeResizer
          isVisible={selected}
          minWidth={300}
          minHeight={200}
          lineClassName="!border-orange-400"
          handleClassName="!w-3 !h-3 !bg-orange-400 !border-2 !border-white"
        />
      </div>
      <div className="absolute -top-3 left-4 flex items-center gap-1.5 bg-slate-800 px-2 py-0.5 border border-slate-600 rounded z-10" style={{ pointerEvents: "auto" }}>
        <span className="text-sm">☁️</span>
        <span className="text-white text-xs font-medium">{data.label}</span>
      </div>
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
    </div>
  );
});

AWSCloudNode.displayName = "AWSCloudNode";

// ============================================
// Region Boundary Node
// ============================================
export const RegionNode = memo(({ data, selected }: { data: BoundaryNodeData; selected?: boolean }) => {
  return (
    <div
      className={cn(
        "rounded-lg border-2 border-dashed relative",
        selected ? "border-cyan-400 bg-cyan-500/5" : "border-blue-400 bg-blue-500/10"
      )}
      style={{ width: "100%", height: "100%", minWidth: 250, minHeight: 180, pointerEvents: "none" }}
    >
      <div style={{ pointerEvents: "auto" }}>
        <NodeResizer
          isVisible={selected}
          minWidth={250}
          minHeight={180}
          lineClassName="!border-blue-400"
          handleClassName="!w-3 !h-3 !bg-blue-400 !border-2 !border-white"
        />
      </div>
      <div className="absolute -top-3 left-4 flex items-center gap-1.5 bg-blue-600 px-2 py-0.5 border border-blue-500 rounded z-10" style={{ pointerEvents: "auto" }}>
        <span className="text-sm">🌍</span>
        <span className="text-white text-xs font-medium">{data.label}</span>
      </div>
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
    </div>
  );
});

RegionNode.displayName = "RegionNode";

// ============================================
// Availability Zone Node
// ============================================
export const AvailabilityZoneNode = memo(({ data, selected }: { data: BoundaryNodeData; selected?: boolean }) => {
  return (
    <div
      className={cn(
        "rounded-lg border-2 relative",
        selected ? "border-cyan-400 bg-cyan-500/5" : "border-sky-400 bg-sky-500/10"
      )}
      style={{ width: "100%", height: "100%", minWidth: 180, minHeight: 120, pointerEvents: "none" }}
    >
      <div style={{ pointerEvents: "auto" }}>
        <NodeResizer
          isVisible={selected}
          minWidth={180}
          minHeight={120}
          lineClassName="!border-sky-400"
          handleClassName="!w-3 !h-3 !bg-sky-400 !border-2 !border-white"
        />
      </div>
      <div className="absolute -top-3 left-4 flex items-center gap-1.5 bg-sky-500 px-2 py-0.5 border border-sky-400 rounded z-10" style={{ pointerEvents: "auto" }}>
        <span className="text-sm">📍</span>
        <span className="text-white text-xs font-medium">{data.label}</span>
      </div>
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
    </div>
  );
});

AvailabilityZoneNode.displayName = "AvailabilityZoneNode";

// ============================================
// Text Box Node - Editable with style support
// ============================================
interface TextNodeData {
  label: string;
  fontSize?: number;
  fontFamily?: "sans" | "serif" | "mono";
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline" | "line-through";
  textColor?: string;
  onLabelChange?: (newLabel: string) => void;
}

export const TextNode = memo(({ data, selected, id }: { data: TextNodeData; selected?: boolean; id: string }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localText, setLocalText] = useState(data.label);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { setNodes } = useReactFlow();

  // When editing starts/stops, update the node's draggable property
  useEffect(() => {
    setNodes(nodes => nodes.map(node => 
      node.id === id 
        ? { ...node, draggable: !isEditing }
        : node
    ));
  }, [isEditing, id, setNodes]);

  // Focus textarea when editing starts - put cursor at end, don't select all
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.focus();
      // Put cursor at end instead of selecting all text
      const len = textarea.value.length;
      textarea.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // Auto-resize textarea - run immediately and on text change
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.max(24, textareaRef.current.scrollHeight) + "px";
    }
  }, [localText, isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    setLocalText(data.label);
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    // Save the text to the node data
    if (localText !== data.label) {
      setNodes(nodes => nodes.map(node => 
        node.id === id 
          ? { ...node, data: { ...node.data, label: localText } }
          : node
      ));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setLocalText(data.label);
      setIsEditing(false);
    } else if (e.key === "Enter" && !e.shiftKey) {
      // Enter saves (Shift+Enter for new line)
      e.preventDefault();
      handleBlur();
    }
    // Don't propagate to prevent React Flow shortcuts
    e.stopPropagation();
  };

  // Build style object from data
  const textStyle: React.CSSProperties = {
    fontSize: data.fontSize || 14,
    fontFamily: data.fontFamily === "serif" ? "Georgia, serif" : 
                data.fontFamily === "mono" ? "monospace" : 
                "system-ui, sans-serif",
    fontWeight: data.fontWeight || "normal",
    fontStyle: data.fontStyle || "normal",
    textDecoration: data.textDecoration || "none",
    color: data.textColor || "#374151",
  };

  // Stop all drag/mouse events when editing to allow text selection
  const stopEventPropagation = (e: React.MouseEvent | React.DragEvent) => {
    if (isEditing) {
      e.stopPropagation();
    }
  };

  return (
    <div
      className={cn(
        "bg-white rounded border shadow-sm p-2 min-w-[100px] group",
        selected ? "border-cyan-500 ring-2 ring-cyan-500/30" : "border-gray-300 hover:border-gray-400",
        isEditing ? "min-w-[150px] cursor-text" : "cursor-grab" // Different cursor based on mode
      )}
      onDoubleClick={handleDoubleClick}
      onMouseDown={stopEventPropagation}
      onMouseMove={stopEventPropagation}
      onDragStart={(e) => { if (isEditing) e.preventDefault(); }}
    >
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="target" position={Position.Left} id="left" className={handleClass(selected)} />
      
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onMouseDown={(e) => e.stopPropagation()} // Prevent node drag when selecting text
          onMouseMove={(e) => e.stopPropagation()}
          className="w-full min-h-[24px] resize-none border-none outline-none bg-transparent text-center block select-text"
          style={textStyle}
          placeholder="Enter text..."
          autoFocus
        />
      ) : (
        <p 
          className="min-h-[24px] text-center whitespace-pre-wrap break-words"
          style={textStyle}
        >
          {data.label || "Double-click to edit"}
        </p>
      )}

      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass(selected)} />
    </div>
  );
});

TextNode.displayName = "TextNode";

// ============================================
// Note Node (sticky note style)
// ============================================
export const NoteNode = memo(({ data, selected }: { data: TextNodeData; selected?: boolean }) => {
  return (
    <div
      className={cn(
        "bg-amber-100 rounded shadow-sm transition-all p-3 min-w-[140px] group cursor-pointer border-l-4 border-amber-400",
        selected ? "ring-2 ring-cyan-500/30" : ""
      )}
    >
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="target" position={Position.Left} id="left" className={handleClass(selected)} />
      
      <div className="flex items-start gap-2">
        <span className="text-base">📌</span>
        <p className="text-sm text-amber-900 min-h-[20px] flex-1">{data.label}</p>
      </div>

      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass(selected)} />
    </div>
  );
});

NoteNode.displayName = "NoteNode";

// ============================================
// Legend Node - Diagram key/legend
// ============================================
interface LegendNodeData {
  label: string;
  items?: Array<{ color: string; label: string }>;
  owner?: string;
  environment?: string;
  costCenter?: string;
}

export const LegendNode = memo(({ data, selected }: { data: LegendNodeData; selected?: boolean }) => {
  const defaultItems = [
    { color: "#ED7100", label: "Compute" },
    { color: "#3B48CC", label: "Database" },
    { color: "#3F8624", label: "Storage" },
    { color: "#8C4FFF", label: "Networking" },
    { color: "#DD344C", label: "Security" },
    { color: "#E7157B", label: "Integration" },
  ];
  
  const items = data.items || defaultItems;
  
  return (
    <div
      className={cn(
        "bg-white rounded-lg border-2 shadow-md p-3 min-w-[200px] group",
        selected ? "border-cyan-500 ring-2 ring-cyan-500/30" : "border-slate-300"
      )}
    >
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      
      {/* Legend Title */}
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
        <span className="text-sm">📋</span>
        <span className="text-sm font-semibold text-slate-700">{data.label || "Legend"}</span>
      </div>
      
      {/* Color Key */}
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] text-slate-600">{item.label}</span>
          </div>
        ))}
      </div>
      
      {/* Metadata */}
      {(data.owner || data.environment || data.costCenter) && (
        <div className="pt-2 border-t border-slate-200 space-y-0.5">
          {data.owner && (
            <p className="text-[10px] text-slate-500"><span className="font-medium">Owner:</span> {data.owner}</p>
          )}
          {data.environment && (
            <p className="text-[10px] text-slate-500"><span className="font-medium">Env:</span> {data.environment}</p>
          )}
          {data.costCenter && (
            <p className="text-[10px] text-slate-500"><span className="font-medium">Cost Center:</span> {data.costCenter}</p>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
    </div>
  );
});

LegendNode.displayName = "LegendNode";

// ============================================
// Lifecycle Policy Node - S3/Backup lifecycle rules
// ============================================
interface LifecycleNodeData {
  label: string;
  rules?: Array<{ days: number; action: string; storageClass?: string }>;
  retentionDays?: number;
  versioningEnabled?: boolean;
}

export const LifecycleNode = memo(({ data, selected }: { data: LifecycleNodeData; selected?: boolean }) => {
  const defaultRules = [
    { days: 30, action: "Transition", storageClass: "IA" },
    { days: 90, action: "Transition", storageClass: "Glacier" },
    { days: 365, action: "Delete" },
  ];
  
  const rules = data.rules || defaultRules;
  
  return (
    <div
      className={cn(
        "bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-2 shadow-sm p-3 min-w-[180px] group",
        selected ? "border-cyan-500 ring-2 ring-cyan-500/30" : "border-green-300"
      )}
    >
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="target" position={Position.Left} id="left" className={handleClass(selected)} />
      
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">📜</span>
        <span className="text-xs font-semibold text-green-800">{data.label || "Lifecycle Policy"}</span>
      </div>
      
      {/* Rules */}
      <div className="space-y-1">
        {rules.map((rule, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px]">
            <span className="text-green-600 font-mono">{rule.days}d</span>
            <span className="text-slate-400">→</span>
            <span className="text-green-700">
              {rule.action}{rule.storageClass ? ` to ${rule.storageClass}` : ""}
            </span>
          </div>
        ))}
      </div>
      
      {/* Additional Info */}
      {(data.retentionDays || data.versioningEnabled !== undefined) && (
        <div className="mt-2 pt-2 border-t border-green-200 text-[10px] text-green-600">
          {data.retentionDays && <p>Retention: {data.retentionDays} days</p>}
          {data.versioningEnabled !== undefined && (
            <p>Versioning: {data.versioningEnabled ? "✓ Enabled" : "✗ Disabled"}</p>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass(selected)} />
    </div>
  );
});

LifecycleNode.displayName = "LifecycleNode";

// ============================================
// Pipeline Node - CI/CD Pipeline visualization
// ============================================
interface PipelineNodeData {
  label: string;
  stages?: Array<{ name: string; status?: "pending" | "running" | "success" | "failed" }>;
}

export const PipelineNode = memo(({ data, selected }: { data: PipelineNodeData; selected?: boolean }) => {
  const defaultStages = [
    { name: "Source", status: "success" as const },
    { name: "Build", status: "success" as const },
    { name: "Test", status: "running" as const },
    { name: "Deploy", status: "pending" as const },
  ];
  
  const stages = data.stages || defaultStages;
  
  const statusColors = {
    pending: "bg-slate-300",
    running: "bg-blue-500 animate-pulse",
    success: "bg-green-500",
    failed: "bg-red-500",
  };
  
  return (
    <div
      className={cn(
        "bg-white rounded-lg border-2 shadow-sm p-3 min-w-[280px] group",
        selected ? "border-cyan-500 ring-2 ring-cyan-500/30" : "border-slate-300"
      )}
    >
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="target" position={Position.Left} id="left" className={handleClass(selected)} />
      
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">🔧</span>
        <span className="text-xs font-semibold text-slate-700">{data.label || "CI/CD Pipeline"}</span>
      </div>
      
      {/* Pipeline Stages */}
      <div className="flex items-center gap-1">
        {stages.map((stage, i) => (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={cn("w-4 h-4 rounded-full", statusColors[stage.status || "pending"])} />
              <span className="text-[9px] text-slate-500 mt-0.5">{stage.name}</span>
            </div>
            {i < stages.length - 1 && (
              <div className="w-8 h-0.5 bg-slate-300 mx-1" />
            )}
          </div>
        ))}
      </div>

      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass(selected)} />
    </div>
  );
});

PipelineNode.displayName = "PipelineNode";

// ============================================
// Account Node - AWS Account boundary
// ============================================
interface AccountNodeData {
  label: string;
  accountId?: string;
  environment?: string;
}

export const AccountNode = memo(({ data, selected }: { data: AccountNodeData; selected?: boolean }) => {
  return (
    <div
      className={cn(
        "rounded-lg border-2 border-dashed relative",
        selected ? "border-cyan-500 bg-cyan-50/10" : "border-amber-500 bg-amber-50/20"
      )}
      style={{ width: "100%", height: "100%", minWidth: 350, minHeight: 250 }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={350}
        minHeight={250}
        lineClassName="!border-amber-500"
        handleClassName="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
      />
      
      {/* Account Label */}
      <div className="absolute -top-3 left-4 flex items-center gap-1.5 bg-amber-500 px-2 py-0.5 rounded z-10">
        <span className="text-sm">🏢</span>
        <span className="text-white text-xs font-medium">{data.label || "AWS Account"}</span>
        {data.accountId && (
          <span className="text-amber-200 text-[10px] ml-1">({data.accountId})</span>
        )}
      </div>
      
      {/* Environment Badge */}
      {data.environment && (
        <div className="absolute -top-3 right-4 bg-white px-2 py-0.5 rounded border border-amber-300 z-10">
          <span className="text-[10px] text-amber-700 font-medium">{data.environment}</span>
        </div>
      )}
      
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
    </div>
  );
});

AccountNode.displayName = "AccountNode";

// ============================================
// Organization Node - AWS Organizations boundary
// ============================================
interface OrgNodeData {
  label: string;
  orgId?: string;
}

export const OrgNode = memo(({ data, selected }: { data: OrgNodeData; selected?: boolean }) => {
  return (
    <div
      className={cn(
        "rounded-lg border-2 border-dashed relative",
        selected ? "border-cyan-500 bg-cyan-50/10" : "border-slate-600 bg-slate-100/30"
      )}
      style={{ width: "100%", height: "100%", minWidth: 400, minHeight: 300 }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={400}
        minHeight={300}
        lineClassName="!border-slate-600"
        handleClassName="!w-3 !h-3 !bg-slate-600 !border-2 !border-white"
      />
      
      {/* Org Label */}
      <div className="absolute -top-3 left-4 flex items-center gap-1.5 bg-slate-700 px-2 py-0.5 rounded z-10">
        <span className="text-sm">🏛️</span>
        <span className="text-white text-xs font-medium">{data.label || "AWS Organizations"}</span>
      </div>
      
      {/* Org ID */}
      {data.orgId && (
        <div className="absolute -top-3 right-4 bg-white px-2 py-0.5 rounded border border-slate-400 z-10">
          <span className="text-[10px] text-slate-600 font-mono">{data.orgId}</span>
        </div>
      )}
      
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
    </div>
  );
});

OrgNode.displayName = "OrgNode";

// ============================================
// Data Flow Node - Traffic/data flow annotation
// ============================================
interface DataFlowNodeData {
  label: string;
  protocol?: string;
  port?: string | number;
  direction?: "inbound" | "outbound" | "bidirectional";
  encrypted?: boolean;
}

export const DataFlowNode = memo(({ data, selected }: { data: DataFlowNodeData; selected?: boolean }) => {
  const directionIcon = {
    inbound: "⬇️",
    outbound: "⬆️",
    bidirectional: "↕️",
  };
  
  return (
    <div
      className={cn(
        "bg-gradient-to-r from-blue-50 to-cyan-50 rounded border-2 shadow-sm px-2 py-1.5 min-w-[100px] group",
        selected ? "border-cyan-500 ring-2 ring-cyan-500/30" : "border-blue-300"
      )}
    >
      <Handle type="target" position={Position.Left} className={handleClass(selected)} />
      
      <div className="flex items-center gap-1.5">
        <span className="text-xs">{directionIcon[data.direction || "bidirectional"]}</span>
        <div className="flex-1">
          <p className="text-[10px] font-medium text-blue-800">{data.label || "Data Flow"}</p>
          <div className="flex items-center gap-1 text-[9px] text-blue-600">
            {data.protocol && <span>{data.protocol}</span>}
            {data.port && <span>:{data.port}</span>}
            {data.encrypted && <span>🔒</span>}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className={handleClass(selected)} />
    </div>
  );
});

DataFlowNode.displayName = "DataFlowNode";

// ============================================
// Scaling Policy Node - Auto Scaling configuration
// ============================================
interface ScalingPolicyNodeData {
  label: string;
  policyType?: "target-tracking" | "step" | "simple";
  targetValue?: number;
  metric?: string;
  minCapacity?: number;
  maxCapacity?: number;
}

export const ScalingPolicyNode = memo(({ data, selected }: { data: ScalingPolicyNodeData; selected?: boolean }) => {
  return (
    <div
      className={cn(
        "bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border-2 shadow-sm p-2.5 min-w-[160px] group",
        selected ? "border-cyan-500 ring-2 ring-cyan-500/30" : "border-orange-300"
      )}
    >
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="target" position={Position.Left} id="left" className={handleClass(selected)} />
      
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">📈</span>
        <span className="text-xs font-semibold text-orange-800">{data.label || "Scaling Policy"}</span>
      </div>
      
      {/* Policy Details */}
      <div className="space-y-1 text-[10px]">
        {data.policyType && (
          <p className="text-orange-700">
            <span className="font-medium">Type:</span> {data.policyType}
          </p>
        )}
        {data.metric && (
          <p className="text-orange-700">
            <span className="font-medium">Metric:</span> {data.metric}
          </p>
        )}
        {data.targetValue && (
          <p className="text-orange-700">
            <span className="font-medium">Target:</span> {data.targetValue}%
          </p>
        )}
        {(data.minCapacity !== undefined || data.maxCapacity !== undefined) && (
          <p className="text-orange-600">
            Capacity: {data.minCapacity || 1} - {data.maxCapacity || 10}
          </p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass(selected)} />
    </div>
  );
});

ScalingPolicyNode.displayName = "ScalingPolicyNode";

// ============================================
// Backup Plan Node - AWS Backup configuration
// ============================================
interface BackupPlanNodeData {
  label: string;
  schedule?: string;
  retentionDays?: number;
  copyToRegion?: string;
  resources?: string[];
}

export const BackupPlanNode = memo(({ data, selected }: { data: BackupPlanNodeData; selected?: boolean }) => {
  return (
    <div
      className={cn(
        "bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border-2 shadow-sm p-2.5 min-w-[170px] group",
        selected ? "border-cyan-500 ring-2 ring-cyan-500/30" : "border-indigo-300"
      )}
    >
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="target" position={Position.Left} id="left" className={handleClass(selected)} />
      
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">💾</span>
        <span className="text-xs font-semibold text-indigo-800">{data.label || "Backup Plan"}</span>
      </div>
      
      {/* Backup Details */}
      <div className="space-y-1 text-[10px]">
        {data.schedule && (
          <p className="text-indigo-700">
            <span className="font-medium">Schedule:</span> {data.schedule}
          </p>
        )}
        {data.retentionDays && (
          <p className="text-indigo-700">
            <span className="font-medium">Retention:</span> {data.retentionDays} days
          </p>
        )}
        {data.copyToRegion && (
          <p className="text-indigo-700">
            <span className="font-medium">Copy to:</span> {data.copyToRegion}
          </p>
        )}
        {data.resources && data.resources.length > 0 && (
          <p className="text-indigo-600">
            Resources: {data.resources.length} selected
          </p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass(selected)} />
    </div>
  );
});

BackupPlanNode.displayName = "BackupPlanNode";

// ============================================
// IAM Policy Document Node - Visualize IAM policies
// ============================================
interface PolicyDocumentNodeData {
  label: string;
  policyType?: "identity" | "resource" | "trust" | "scp" | "permission-boundary";
  effect?: "Allow" | "Deny";
  actions?: string[];
  resources?: string[];
  principals?: string[];
  conditions?: string[];
}

export const PolicyDocumentNode = memo(({ data, selected }: { data: PolicyDocumentNodeData; selected?: boolean }) => {
  const policyColors = {
    identity: { bg: "from-red-50 to-rose-50", border: "border-red-300", text: "text-red-800", badge: "bg-red-100 text-red-700" },
    resource: { bg: "from-blue-50 to-indigo-50", border: "border-blue-300", text: "text-blue-800", badge: "bg-blue-100 text-blue-700" },
    trust: { bg: "from-purple-50 to-violet-50", border: "border-purple-300", text: "text-purple-800", badge: "bg-purple-100 text-purple-700" },
    scp: { bg: "from-slate-50 to-gray-50", border: "border-slate-400", text: "text-slate-800", badge: "bg-slate-200 text-slate-700" },
    "permission-boundary": { bg: "from-amber-50 to-yellow-50", border: "border-amber-300", text: "text-amber-800", badge: "bg-amber-100 text-amber-700" },
  };
  
  const colors = policyColors[data.policyType || "identity"];
  const effectColor = data.effect === "Deny" ? "text-red-600" : "text-green-600";
  
  return (
    <div
      className={cn(
        `bg-gradient-to-br ${colors.bg} rounded-lg border-2 shadow-sm p-3 min-w-[200px] max-w-[280px] group`,
        selected ? "border-cyan-500 ring-2 ring-cyan-500/30" : colors.border
      )}
    >
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="target" position={Position.Left} id="left" className={handleClass(selected)} />
      
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">📜</span>
          <span className={`text-xs font-semibold ${colors.text}`}>{data.label || "IAM Policy"}</span>
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 rounded ${colors.badge}`}>
          {data.policyType || "identity"}
        </span>
      </div>
      
      {/* Effect */}
      {data.effect && (
        <div className="mb-1.5">
          <span className={`text-[10px] font-mono font-bold ${effectColor}`}>
            {data.effect === "Deny" ? "✗ DENY" : "✓ ALLOW"}
          </span>
        </div>
      )}
      
      {/* Actions */}
      {data.actions && data.actions.length > 0 && (
        <div className="mb-1.5">
          <p className="text-[9px] text-slate-500 uppercase">Actions:</p>
          <div className="flex flex-wrap gap-0.5">
            {data.actions.slice(0, 3).map((action, i) => (
              <span key={i} className="text-[9px] font-mono bg-white/50 px-1 rounded text-slate-700">
                {action}
              </span>
            ))}
            {data.actions.length > 3 && (
              <span className="text-[9px] text-slate-500">+{data.actions.length - 3} more</span>
            )}
          </div>
        </div>
      )}
      
      {/* Resources */}
      {data.resources && data.resources.length > 0 && (
        <div className="mb-1.5">
          <p className="text-[9px] text-slate-500 uppercase">Resources:</p>
          <div className="flex flex-wrap gap-0.5">
            {data.resources.slice(0, 2).map((resource, i) => (
              <span key={i} className="text-[9px] font-mono bg-white/50 px-1 rounded text-slate-700 truncate max-w-[120px]">
                {resource}
              </span>
            ))}
            {data.resources.length > 2 && (
              <span className="text-[9px] text-slate-500">+{data.resources.length - 2} more</span>
            )}
          </div>
        </div>
      )}
      
      {/* Principals (for resource/trust policies) */}
      {data.principals && data.principals.length > 0 && (
        <div className="mb-1.5">
          <p className="text-[9px] text-slate-500 uppercase">Principals:</p>
          <div className="flex flex-wrap gap-0.5">
            {data.principals.slice(0, 2).map((principal, i) => (
              <span key={i} className="text-[9px] font-mono bg-white/50 px-1 rounded text-slate-700">
                {principal}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Conditions indicator */}
      {data.conditions && data.conditions.length > 0 && (
        <div className="text-[9px] text-slate-500 flex items-center gap-1">
          <span>🔒</span>
          <span>{data.conditions.length} condition(s)</span>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass(selected)} />
    </div>
  );
});

PolicyDocumentNode.displayName = "PolicyDocumentNode";

// ============================================
// Export all node types for React Flow
// ============================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeTypes: Record<string, any> = {
  awsResource: AWSResourceNode,
  vpc: VPCNode,
  subnet: SubnetNode,
  securityGroup: SecurityGroupNode,
  autoScaling: AutoScalingNode,
  genericIcon: GenericIconNode,
  awsCloud: AWSCloudNode,
  region: RegionNode,
  availabilityZone: AvailabilityZoneNode,
  textNode: TextNode,
  noteNode: NoteNode,
  // New node types for complete architecture diagrams
  legendNode: LegendNode,
  lifecycleNode: LifecycleNode,
  pipelineNode: PipelineNode,
  accountNode: AccountNode,
  orgNode: OrgNode,
  dataFlowNode: DataFlowNode,
  scalingPolicyNode: ScalingPolicyNode,
  backupPlanNode: BackupPlanNode,
  policyDocumentNode: PolicyDocumentNode,
};
