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
function getAbbreviatedLabel(label: string): string {
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
interface AWSResourceNodeData {
  serviceId: string;
  label: string;
  sublabel?: string;
  color: string;
  config?: Record<string, unknown>;
  iconPath?: string; // Custom icon path for user-added services
}

export const AWSResourceNode = memo(({ data, selected }: { data: AWSResourceNodeData; selected?: boolean }) => {
  const Icon = iconMap[data.serviceId] || Server;
  const color = data.color || "#ED7100";
  const hasCustomIcon = data.iconPath && data.iconPath.startsWith("/aws-icons/");

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
      
      {/* Icon - supports both Lucide icons and AWS SVG icons */}
      <div
        className="w-12 h-12 rounded flex items-center justify-center mb-2"
        style={{ backgroundColor: `${color}15` }}
      >
        {hasCustomIcon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.iconPath} alt={data.label} className="w-8 h-8" />
        ) : (
          <Icon className="w-7 h-7" style={{ color }} />
        )}
      </div>
      
      {/* Label - abbreviated for cleaner display */}
      <p className="text-xs font-medium text-gray-800 text-center leading-tight">{getAbbreviatedLabel(data.label)}</p>
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
      style={{ width: "100%", height: "100%", minWidth: 300, minHeight: 200 }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={300}
        minHeight={200}
        lineClassName="!border-orange-400"
        handleClassName="!w-3 !h-3 !bg-orange-400 !border-2 !border-white"
      />
      <div className="absolute -top-3 left-4 flex items-center gap-1.5 bg-slate-800 px-2 py-0.5 border border-slate-600 rounded z-10">
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
      style={{ width: "100%", height: "100%", minWidth: 250, minHeight: 180 }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={250}
        minHeight={180}
        lineClassName="!border-blue-400"
        handleClassName="!w-3 !h-3 !bg-blue-400 !border-2 !border-white"
      />
      <div className="absolute -top-3 left-4 flex items-center gap-1.5 bg-blue-600 px-2 py-0.5 border border-blue-500 rounded z-10">
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
      style={{ width: "100%", height: "100%", minWidth: 180, minHeight: 120 }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={120}
        lineClassName="!border-sky-400"
        handleClassName="!w-3 !h-3 !bg-sky-400 !border-2 !border-white"
      />
      <div className="absolute -top-3 left-4 flex items-center gap-1.5 bg-sky-500 px-2 py-0.5 border border-sky-400 rounded z-10">
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
};
