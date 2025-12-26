"use client";

/**
 * Read-only Diagram Preview for Portfolio
 * Uses the same React Flow node types as the diagram canvas
 */

import { ReactFlow, ReactFlowProvider, Background, Controls, BackgroundVariant } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "@/components/diagram/aws-nodes";

interface DiagramNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    serviceId: string;
    label: string;
    sublabel?: string;
    color: string;
    subnetType?: "public" | "private";
  };
  parentId?: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  animated?: boolean;
}

interface DiagramPreviewProps {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  className?: string;
}

export function DiagramPreview({ nodes, edges, className }: DiagramPreviewProps) {
  // Convert nodes to React Flow format with proper styling
  const flowNodes = nodes.map((node) => ({
    ...node,
    // Ensure container nodes have proper dimensions
    style: node.type === "vpc" 
      ? { width: node.width || 600, height: node.height || 400 }
      : node.type === "subnet"
      ? { width: node.width || 250, height: node.height || 180 }
      : node.style,
    // Keep extent for child nodes
    extent: node.parentId ? "parent" as const : undefined,
  }));

  // Convert edges to React Flow format with styling
  const flowEdges = edges.map((edge) => ({
    ...edge,
    type: edge.type || "smoothstep",
    animated: edge.animated !== false,
    style: { stroke: "#22d3ee", strokeWidth: 2 },
    markerEnd: { type: "arrowclosed" as const, color: "#22d3ee" },
  }));

  return (
    <ReactFlowProvider>
      <div className={className} style={{ width: "100%", height: 500 }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          className="bg-slate-100 rounded-lg"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#cbd5e1"
          />
          <Controls 
            showInteractive={false}
            className="!bg-white !border-slate-300 !rounded-lg [&>button]:!bg-white [&>button]:!border-slate-300 [&>button]:!text-slate-600 [&>button:hover]:!bg-slate-100"
          />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
