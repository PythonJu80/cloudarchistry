"use client";

/**
 * AWS Node Components for React Flow
 * 
 * Custom node types for rendering AWS services in the diagram.
 */

import { memo } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
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

// Icon mapping for AWS services (~45 core services)
const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  // Networking (12)
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
  // Compute (5)
  "ec2": Server,
  "auto-scaling": Boxes,
  "lambda": Zap,
  "ebs": HardDrive,
  "efs": HardDrive,
  // Containers (4)
  "ecs": Container,
  "eks": Container,
  "fargate": Container,
  "ecr": Box,
  // Database (6)
  "rds": Database,
  "aurora": Database,
  "dynamodb": Database,
  "elasticache": Database,
  "redshift": Database,
  "neptune": Database,
  // Storage (3)
  "s3": HardDrive,
  "glacier": HardDrive,
  "backup": HardDrive,
  // Security (7)
  "iam": Users,
  "kms": Key,
  "secrets-manager": Key,
  "cognito": Users,
  "waf": Shield,
  "shield": Shield,
  "guardduty": Shield,
  // Integration (4)
  "api-gateway": Workflow,
  "eventbridge": Activity,
  "sns": Bell,
  "sqs": Box,
  // Management (4)
  "cloudwatch": BarChart3,
  "cloudtrail": Activity,
  "systems-manager": Settings,
  "config": Settings,
};

// Handle styles - visible when selected
const handleClass = (selected?: boolean) => cn(
  "!w-3 !h-3 !bg-cyan-500 !border-2 !border-cyan-600 transition-opacity",
  selected ? "!opacity-100" : "!opacity-0 group-hover:!opacity-50"
);

// ============================================
// AWS Resource Node (EC2, RDS, Lambda, etc.)
// ============================================
interface AWSResourceNodeData {
  serviceId: string;
  label: string;
  sublabel?: string;
  color: string;
  config?: Record<string, unknown>;
}

export const AWSResourceNode = memo(({ data, selected }: { data: AWSResourceNodeData; selected?: boolean }) => {
  const Icon = iconMap[data.serviceId] || Server;
  const color = data.color || "#ED7100";

  return (
    <div
      className={cn(
        "bg-white rounded-lg border-2 shadow-sm transition-all flex flex-col items-center p-3 min-w-[100px] group cursor-pointer",
        selected ? "border-cyan-500 ring-2 ring-cyan-500/30 shadow-lg" : "border-gray-300 hover:border-gray-400"
      )}
    >
      {/* Connection handles */}
      <Handle type="target" position={Position.Top} className={handleClass(selected)} />
      <Handle type="target" position={Position.Left} id="left" className={handleClass(selected)} />
      
      {/* Icon */}
      <div
        className="w-12 h-12 rounded flex items-center justify-center mb-2"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-7 h-7" style={{ color }} />
      </div>
      
      {/* Label */}
      <p className="text-xs font-medium text-gray-800 text-center leading-tight">{data.label}</p>
      {data.sublabel && (
        <p className="text-[10px] text-gray-500 text-center mt-0.5">{data.sublabel}</p>
      )}

      {/* Output handles */}
      <Handle type="source" position={Position.Bottom} className={handleClass(selected)} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass(selected)} />
    </div>
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
// Export all node types for React Flow
// ============================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeTypes: Record<string, any> = {
  awsResource: AWSResourceNode,
  vpc: VPCNode,
  subnet: SubnetNode,
  securityGroup: SecurityGroupNode,
  autoScaling: AutoScalingNode,
};
