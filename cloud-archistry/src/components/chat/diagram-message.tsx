"use client";

/**
 * Diagram Message Component
 * 
 * Renders AWS architecture diagrams in chat messages using React Flow.
 * Uses the same node types as the main diagram canvas for consistent styling.
 */

import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  ReactFlowProvider,
  MarkerType,
  Position,
  Handle,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Download, Maximize2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildAWSDiagram, isNewPayloadFormat } from "@/lib/aws-diagram-template";

/**
 * Dynamic icon path resolver for AWS services.
 * Icons are stored in /public/aws-icons/ as {service-id}.svg
 * This function normalizes the service_id and constructs the path.
 * 
 * The icon files follow AWS naming conventions:
 * - lowercase with hyphens (e.g., api-gateway.svg, step-functions.svg)
 * - Some have "group-" prefix for container types (e.g., group-vpc.svg)
 */
// Available icons in /public/aws-icons/ (64 icons)
const AVAILABLE_ICONS = new Set([
  "acm", "api-gateway", "app-runner", "appsync", "athena", "aurora", "aws-logo",
  "batch", "bedrock", "cloudformation", "cloudfront", "cloudtrail", "cloudwatch",
  "cognito", "comprehend", "direct-connect", "dms", "documentdb", "dynamodb",
  "ebs", "ec2", "ecr", "ecs", "eks", "elasticache", "elastic-beanstalk", "elb",
  "emr", "eventbridge", "fargate", "fsx", "glue", "group-auto-scaling",
  "group-aws-cloud", "group-private-subnet", "group-public-subnet", "group-region",
  "group-vpc", "guardduty", "iam", "kendra", "kinesis", "kms", "lambda", "lex",
  "neptune", "opensearch", "personalize", "polly", "quicksight", "rds",
  "rekognition", "route53", "s3", "secrets-manager", "shield", "sns", "sqs",
  "step-functions", "systems-manager", "transcribe", "translate", "vpc", "waf"
]);

function getIconPath(serviceId: string): string {
  if (!serviceId) return "";
  
  // Normalize: lowercase, replace underscores with hyphens
  const normalized = serviceId.toLowerCase().replace(/_/g, "-");
  
  // If the icon exists directly, use it
  if (AVAILABLE_ICONS.has(normalized)) {
    return `/aws-icons/${normalized}.svg`;
  }
  
  // Common aliases - map variations to available icons
  const aliases: Record<string, string> = {
    // API Gateway variants
    "apigateway": "api-gateway",
    "api_gateway": "api-gateway",
    // Step Functions variants
    "stepfunctions": "step-functions",
    "step_functions": "step-functions",
    // Secrets Manager variants
    "secretsmanager": "secrets-manager",
    "secrets_manager": "secrets-manager",
    // Load Balancers -> elb
    "alb": "elb",
    "nlb": "elb",
    "application-load-balancer": "elb",
    "network-load-balancer": "elb",
    "elastic-load-balancer": "elb",
    // IoT -> kinesis (similar streaming icon)
    "iot-core": "kinesis",
    "iot": "kinesis",
    "iot_core": "kinesis",
    // Elastic Beanstalk variants
    "elasticbeanstalk": "elastic-beanstalk",
    // Systems Manager variants
    "ssm": "systems-manager",
    // Direct Connect variants
    "directconnect": "direct-connect",
    // Database variants -> rds
    "rds-mysql": "rds",
    "rds-postgres": "rds",
    "rds-aurora": "aurora",
    "rds-replica": "rds",
    "mysql": "rds",
    "postgres": "rds",
    "read-replica": "rds",
    // Networking -> vpc
    "security-group": "vpc",
    "internet-gateway": "vpc",
    "nat-gateway": "vpc",
    "igw": "vpc",
    "sg": "vpc",
    "vpc-endpoint": "vpc",
    // Subnets
    "subnet-public": "group-public-subnet",
    "subnet-private": "group-private-subnet",
    "public-subnet": "group-public-subnet",
    "private-subnet": "group-private-subnet",
    // Auto Scaling
    "auto-scaling": "group-auto-scaling",
    "autoscaling": "group-auto-scaling",
    "asg": "group-auto-scaling",
    // Backup -> s3 (storage icon)
    "backup": "s3",
    "aws-backup": "s3",
    // Config -> cloudwatch (monitoring)
    "config": "cloudwatch",
    "aws-config": "cloudwatch",
    // X-Ray -> cloudwatch
    "xray": "cloudwatch",
    "x-ray": "cloudwatch",
    // SES -> sns (messaging)
    "ses": "sns",
    // MSK -> kinesis (streaming)
    "msk": "kinesis",
    // Redshift -> rds (database)
    "redshift": "rds",
    // MemoryDB -> elasticache
    "memorydb": "elasticache",
    // Generic/custom fallbacks
    "dev-env": "ec2",
    "third-party-payment": "api-gateway",
    "payment-gateway": "api-gateway",
    "external-service": "api-gateway",
    "user": "cognito",
    "users": "cognito",
    "client": "cognito",
  };
  
  // Apply alias if exists
  if (aliases[normalized]) {
    return `/aws-icons/${aliases[normalized]}.svg`;
  }
  
  // Try to find a partial match in available icons
  for (const icon of AVAILABLE_ICONS) {
    if (normalized.includes(icon) || icon.includes(normalized)) {
      return `/aws-icons/${icon}.svg`;
    }
  }
  
  // Default fallback - return empty to trigger fallback UI
  return "";
}

// AWS Service Node - Professional PowerPoint style with larger icons and proper spacing
function ChatAWSServiceNode({ data }: { data: { label: string; service_id?: string; description?: string } }) {
  const serviceId = data.service_id || "";
  const iconPath = getIconPath(serviceId);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-white shadow-sm min-w-[100px] max-w-[140px] border border-gray-100 relative">
      {/* Connection handles - positioned at edges with IDs matching AWSResourceNode */}
      <Handle type="target" position={Position.Left} id="left" className="!bg-cyan-500 !w-2.5 !h-2.5 !border-2 !border-white !shadow-sm" />
      <Handle type="target" position={Position.Top} className="!bg-cyan-500 !w-2.5 !h-2.5 !border-2 !border-white !shadow-sm" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-cyan-500 !w-2.5 !h-2.5 !border-2 !border-white !shadow-sm" />
      <Handle type="source" position={Position.Bottom} className="!bg-cyan-500 !w-2.5 !h-2.5 !border-2 !border-white !shadow-sm" />
      
      {/* AWS Icon - larger for better visibility */}
      <div className="w-14 h-14 flex items-center justify-center mb-2">
        {iconPath && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={iconPath} 
            alt={data.label} 
            className="w-12 h-12 object-contain drop-shadow-sm"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#232F3E] to-[#3d4f5f] flex items-center justify-center text-white text-sm font-bold shadow-sm">
            {(data.label || "AWS").substring(0, 3).toUpperCase()}
          </div>
        )}
      </div>
      
      {/* Service Name - clear and readable */}
      <div className="text-xs font-semibold text-gray-800 text-center leading-tight max-w-[120px] truncate">
        {data.label}
      </div>
      {/* Description - subtle and compact */}
      {data.description && (
        <div className="text-[9px] text-gray-500 text-center leading-tight max-w-[120px] mt-1 line-clamp-2">
          {data.description}
        </div>
      )}
    </div>
  );
}

// AWS Cloud container node - Professional style matching AWS reference diagrams
function AWSCloudNode({ data }: { data: { label: string; width?: number; height?: number } }) {
  return (
    <div
      className="rounded-xl border-2 border-[#232F3E] bg-gradient-to-b from-slate-50 to-white"
      style={{
        width: data.width || 700,
        height: data.height || 300,
      }}
    >
      {/* AWS Cloud badge - top left corner */}
      <div className="absolute top-3 left-3 bg-[#232F3E] text-white text-xs font-bold px-3 py-1.5 rounded-md inline-flex items-center gap-2 shadow-sm">
        <span className="text-orange-400 text-sm">☁</span>
        <span>{data.label || "AWS Cloud"}</span>
      </div>
    </div>
  );
}

// Group/container node (VPC, Subnet, etc.)
function GroupNode({ data }: { data: { label: string; service_id?: string; width?: number; height?: number } }) {
  const isAwsCloud = data.label?.toLowerCase().includes("aws cloud");
  
  if (isAwsCloud) {
    return <AWSCloudNode data={data} />;
  }
  
  return (
    <div
      className="rounded-lg border-2 border-dashed p-2"
      style={{
        borderColor: "#8C4FFF",
        backgroundColor: "rgba(140, 79, 255, 0.05)",
        width: data.width || 200,
        height: data.height || 150,
      }}
    >
      <div className="text-xs font-bold px-2 py-1 rounded inline-block bg-purple-600 text-white">
        {data.label}
      </div>
    </div>
  );
}

// Label node - for headers and numbered steps (AWS PowerPoint style)
function LabelNode({ data }: { data: { label: string } }) {
  const isNumber = /^\d+$/.test(data.label?.trim() || "");
  
  if (isNumber) {
    // Numbered step circle - orange badge like AWS reference diagrams
    return (
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white text-[11px] font-bold flex items-center justify-center shadow-md border-2 border-white">
        {data.label}
      </div>
    );
  }
  
  // Column header - clean and professional
  return (
    <div className="text-sm font-semibold text-gray-700 bg-white px-3 py-1 rounded-md shadow-sm border border-gray-100">
      {data.label}
    </div>
  );
}

// Node types for chat diagrams
const nodeTypes = {
  awsService: ChatAWSServiceNode,
  group: GroupNode,
  label: LabelNode,
  default: ChatAWSServiceNode,
};

// Simplified types for diagram data from the API
interface DiagramNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };  // Optional - buildAWSDiagram adds positions if missing
  data: Record<string, unknown>;
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
}

interface DiagramMessageProps {
  diagram: {
    nodes: DiagramNode[];
    edges: DiagramEdge[];
    metadata?: Record<string, unknown>;
  };
  onEdit?: () => void;
  onExpand?: () => void;
  fullscreen?: boolean;
}

function DiagramCanvas({ diagram, onEdit, onExpand, fullscreen }: DiagramMessageProps) {
  // Check if nodes need positioning (new tier-based format)
  const diagramData = useMemo(() => {
    try {
      // Debug: Log incoming diagram data
      console.log("[DiagramCanvas] Input diagram:", JSON.stringify(diagram, null, 2).slice(0, 500));
      console.log("[DiagramCanvas] First node:", diagram.nodes[0]);
      
      // Check if nodes lack positions but have tier data - need to apply template
      const needsLayout = diagram.nodes.some(n => !n.position && n.data?.tier);
      
      console.log("[DiagramCanvas] needsLayout:", needsLayout, "nodes:", diagram.nodes.length);
      
      if (needsLayout) {
        // Convert nodes with tiers to services format for template engine
        const services = diagram.nodes
          .filter(n => n.type === "awsService" || !n.type)
          .map(n => ({
            id: n.id,
            service_id: String(n.data?.service_id || ""),
            label: String(n.data?.label || ""),
            tier: (n.data?.tier as "edge" | "public" | "compute" | "data" | "security" | "integration") || "compute",
          }));
        
        const connections = diagram.edges.map(e => ({
          from: e.source,
          to: e.target,
        }));
        
        console.log("[DiagramCanvas] Building diagram with", services.length, "services");
        console.log("[DiagramCanvas] Sample services:", services.slice(0, 3));
        const result = buildAWSDiagram({ services, connections });
        console.log("[DiagramCanvas] Built", result.nodes.length, "nodes");
        console.log("[DiagramCanvas] Sample node positions:", result.nodes.slice(0, 5).map(n => ({ id: n.id, type: n.type, pos: n.position })));
        return result;
      }
      
      // If payload has "services" array directly, use template engine
      if (isNewPayloadFormat(diagram)) {
        return buildAWSDiagram(diagram);
      }
      
      // Otherwise use existing nodes/edges directly (old format with positions)
      return { nodes: diagram.nodes, edges: diagram.edges };
    } catch (error) {
      console.error("[DiagramCanvas] Error building diagram:", error);
      return { nodes: diagram.nodes, edges: diagram.edges };
    }
  }, [diagram]);

  // Transform nodes with proper styling
  const nodes = useMemo(() => {
    const transformedNodes = diagramData.nodes.map((node) => {
      const isGroup = node.type === "group";
      const isLabel = node.type === "label";
      return {
        ...node,
        // Ensure position exists (buildAWSDiagram adds it, but TypeScript needs assurance)
        position: node.position || { x: 0, y: 0 },
        type: node.type || "awsService",
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        // Groups go to back, labels in middle, services on top
        zIndex: isGroup ? -10 : isLabel ? 5 : 10,
        data: {
          ...node.data,
          label: node.data?.label || "Service",
        },
      };
    });
    console.log("[DiagramCanvas] Final nodes for ReactFlow:", transformedNodes.length, transformedNodes.slice(0, 2));
    return transformedNodes;
  }, [diagramData.nodes]);
  
  // Calculate canvas size from nodes
  const canvasSize = useMemo(() => {
    if (!diagramData.nodes || diagramData.nodes.length === 0) {
      return { width: 800, height: 500 };
    }
    
    const positions = diagramData.nodes
      .filter((n): n is typeof n & { position: { x: number; y: number } } => !!n.position)
      .map(n => ({ x: n.position.x, y: n.position.y }));
    
    if (positions.length === 0) {
      return { width: 800, height: 500 };
    }
    
    const maxX = Math.max(...positions.map(p => p.x)) + 200;
    const maxY = Math.max(...positions.map(p => p.y)) + 200;
    
    return {
      width: Math.max(800, maxX),
      height: Math.max(500, maxY)
    };
  }, [diagramData.nodes]);

  // Transform edges with proper styling and arrow markers
  const edges = useMemo(() => {
    return diagramData.edges.map((edge) => ({
      ...edge,
      type: edge.type || "smoothstep",
      animated: true,
      style: { stroke: "#22d3ee", strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#22d3ee",
        width: 20,
        height: 20,
      },
    }));
  }, [diagramData.edges]);

  return (
    <div 
      className={`relative w-full overflow-hidden ${fullscreen ? '' : 'rounded-xl border border-border/50'} bg-gradient-to-br from-white to-slate-50`}
      style={{ height: fullscreen ? '100%' : '450px' }}
    >
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-slate-100 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#232F3E] flex items-center justify-center">
            <span className="text-white text-xs font-bold">AWS</span>
          </div>
          <span className="text-xs font-medium text-gray-600">
            Architecture Diagram
          </span>
          {typeof diagram.metadata?.nodes_count === "number" && (
            <span className="text-[10px] text-gray-400">
              ({diagram.metadata.nodes_count} services)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onEdit}
            >
              <Edit3 className="w-3 h-3 mr-1" />
              Edit
            </Button>
          )}
          {onExpand && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onExpand}
            >
              <Maximize2 className="w-3 h-3 mr-1" />
              Expand
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              // Download as JSON
              const blob = new Blob([JSON.stringify(diagram, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "aws-architecture.json";
              a.click();
            }}
          >
            <Download className="w-3 h-3 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Debug info */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          No nodes to display
        </div>
      )}
      
      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={true}
        zoomOnScroll={true}
        onInit={() => console.log("[DiagramCanvas] ReactFlow initialized with", nodes.length, "nodes")}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} className="!bottom-2 !left-2" />
      </ReactFlow>
    </div>
  );
}

export function DiagramMessage(props: DiagramMessageProps) {
  return (
    <ReactFlowProvider>
      <DiagramCanvas {...props} />
    </ReactFlowProvider>
  );
}

export default DiagramMessage;
