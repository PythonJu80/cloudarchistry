"use client";

/**
 * Diagram Canvas Component
 * 
 * Main React Flow canvas for building AWS architecture diagrams.
 * Supports drag-drop from ServicePicker, connections, and audit via Learning Agent.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "./aws-nodes";
import { ServicePicker } from "./service-picker";
import { type AWSService } from "@/lib/aws-services";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  RotateCcw,
  CheckCircle,
  Loader2,
  AlertCircle,
  Sparkles,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types for diagram data
export interface DiagramNode extends Node {
  data: {
    serviceId: string;
    label: string;
    sublabel?: string;
    color: string;
    config?: Record<string, unknown>;
    subnetType?: "public" | "private";
    width?: number;
    height?: number;
  };
}

export interface DiagramEdge extends Edge {
  data?: {
    dataFlow?: string;
  };
}

export interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface AuditResult {
  score: number;
  correct: string[];
  missing: string[];
  suggestions: string[];
  feedback: string;
}

interface DiagramCanvasProps {
  // Initial diagram data (for loading saved progress)
  initialData?: DiagramData;
  // Challenge context for the agent
  challengeContext?: {
    challengeId: string;
    challengeTitle: string;
    challengeBrief: string;
    awsServices?: string[];
  };
  // Session for agent chat continuity
  sessionId?: string;
  // API key for Learning Agent
  apiKey?: string;
  preferredModel?: string;
  // Callbacks
  onSave?: (data: DiagramData) => void;
  onAuditComplete?: (result: AuditResult) => void;
}

function DiagramCanvasInner({
  initialData,
  challengeContext,
  sessionId,
  apiKey,
  preferredModel,
  onSave,
  onAuditComplete,
}: DiagramCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  
  // Diagram state
  const [nodes, setNodes, onNodesChange] = useNodesState(initialData?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData?.edges || []);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  
  // Audit state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  
  // Track if diagram has been modified
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save function
  const saveData = useCallback(() => {
    if (nodes.length === 0 && edges.length === 0) return;
    
    const data: DiagramData = { nodes: nodes as DiagramNode[], edges: edges as DiagramEdge[] };
    setIsSaving(true);
    
    // Call the onSave callback
    onSave?.(data);
    
    setIsDirty(false);
    setLastSaved(new Date());
    setIsSaving(false);
  }, [nodes, edges, onSave]);

  // Mark as dirty and trigger auto-save when nodes/edges change
  useEffect(() => {
    // Skip initial render
    if (nodes.length === 0 && edges.length === 0) return;
    
    setIsDirty(true);
    
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Set new auto-save timeout (5 seconds)
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveData();
    }, 5000);
    
    // Cleanup on unmount
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [nodes, edges, saveData]);

  // Handle new connections
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            animated: true,
            style: { stroke: "#22d3ee", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#22d3ee" },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Handle drag start from service picker
  const onServiceDragStart = useCallback((event: React.DragEvent, service: AWSService) => {
    event.dataTransfer.setData("application/aws-service", JSON.stringify(service));
    event.dataTransfer.effectAllowed = "move";
  }, []);

  // Handle drag over
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Find which container node contains a given position
  const findContainerAtPosition = useCallback(
    (pos: { x: number; y: number }, excludeId?: string) => {
      // Container types that can have children
      const containerTypes = ["vpc", "subnet", "securityGroup", "autoScaling"];
      
      // Find containers that contain this position (check from smallest to largest)
      const containers = nodes
        .filter((n) => containerTypes.includes(n.type || "") && n.id !== excludeId)
        .filter((n) => {
          const nodeWidth = n.measured?.width || n.width || 200;
          const nodeHeight = n.measured?.height || n.height || 150;
          return (
            pos.x >= n.position.x &&
            pos.x <= n.position.x + nodeWidth &&
            pos.y >= n.position.y &&
            pos.y <= n.position.y + nodeHeight
          );
        })
        // Sort by area (smallest first - most specific container)
        .sort((a, b) => {
          const areaA = (a.measured?.width || a.width || 200) * (a.measured?.height || a.height || 150);
          const areaB = (b.measured?.width || b.width || 200) * (b.measured?.height || b.height || 150);
          return areaA - areaB;
        });
      
      return containers[0] || null;
    },
    [nodes]
  );

  // Handle drop - create new node
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const serviceData = event.dataTransfer.getData("application/aws-service");
      if (!serviceData) return;

      const service: AWSService = JSON.parse(serviceData);
      
      // Get position relative to the flow
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Determine node type based on service
      let nodeType = "awsResource";
      if (service.id === "vpc") nodeType = "vpc";
      else if (service.id.startsWith("subnet")) nodeType = "subnet";
      else if (service.id === "security-group") nodeType = "securityGroup";
      else if (service.id === "auto-scaling") nodeType = "autoScaling";

      // Default sizes for containers
      const containerSizes: Record<string, { width: number; height: number }> = {
        vpc: { width: 600, height: 400 },
        subnet: { width: 250, height: 180 },
        securityGroup: { width: 180, height: 120 },
        autoScaling: { width: 150, height: 100 },
      };

      // Check if dropping inside a container (for non-container nodes, or subnet inside VPC)
      let parentId: string | undefined;
      let relativePosition = position;
      
      // Services that should be OUTSIDE VPC (global services)
      const globalServices = ["s3", "cloudfront", "route53", "dynamodb", "iam", "cognito", "kms", "cloudwatch", "cloudtrail"];
      
      if (!globalServices.includes(service.id)) {
        const container = findContainerAtPosition(position);
        if (container) {
          parentId = container.id;
          // Convert to position relative to parent
          relativePosition = {
            x: position.x - container.position.x,
            y: position.y - container.position.y,
          };
        }
      }

      // Get size for this node type
      const size = containerSizes[nodeType];
      
      const newNode: DiagramNode = {
        id: `${service.id}-${Date.now()}`,
        type: nodeType,
        position: relativePosition,
        parentId,
        extent: parentId ? "parent" : undefined, // Keep inside parent bounds
        // Set width/height at node level for React Flow resizing
        ...(size && { width: size.width, height: size.height }),
        style: size ? { width: size.width, height: size.height } : undefined,
        data: {
          serviceId: service.id,
          label: service.shortName,
          sublabel: service.description,
          color: service.color,
          config: service.defaultConfig || {},
          subnetType: service.id === "subnet-public" ? "public" : service.id === "subnet-private" ? "private" : undefined,
        },
        // Containers should be behind resources
        zIndex: service.isContainer ? 0 : 10,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, findContainerAtPosition]
  );

  // Delete selected node
  const deleteSelectedNode = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
      setSelectedNode(null);
    }
  }, [selectedNode, setNodes, setEdges]);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    if (nodes.length === 0) return;
    if (confirm("Clear all services from the canvas?")) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
      setAuditResult(null);
    }
  }, [nodes.length, setNodes, setEdges]);

  // Audit diagram via Learning Agent
  const auditDiagram = useCallback(async () => {
    if (nodes.length === 0) {
      setAuditError("Add some services to the canvas first");
      return;
    }

    setIsAuditing(true);
    setAuditError(null);
    setAuditResult(null);

    try {
      const learningAgentUrl = process.env.NEXT_PUBLIC_LEARNING_AGENT_URL || "http://localhost:1027";
      
      // Use the dedicated audit endpoint with full hierarchy data
      const response = await fetch(`${learningAgentUrl}/api/learning/audit-diagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: nodes.map((n) => ({
            id: n.id,
            type: n.data?.serviceId || n.type,
            label: n.data?.label,
            config: n.data?.config,
            parent_id: n.parentId,  // Critical for hierarchy analysis
            position: n.position,
          })),
          connections: edges.map((e) => ({
            from: e.source,
            to: e.target,
          })),
          challenge_id: challengeContext?.challengeId,
          challenge_title: challengeContext?.challengeTitle,
          challenge_brief: challengeContext?.challengeBrief,
          expected_services: challengeContext?.awsServices,
          session_id: sessionId,
          openai_api_key: apiKey,
          preferred_model: preferredModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to get audit response");
      }

      // The endpoint returns structured JSON directly
      const result: AuditResult = await response.json();

      setAuditResult(result);
      onAuditComplete?.(result);
    } catch (error) {
      console.error("Audit error:", error);
      setAuditError(error instanceof Error ? error.message : "Failed to audit diagram");
    } finally {
      setIsAuditing(false);
    }
  }, [nodes, edges, challengeContext, sessionId, apiKey, preferredModel, onAuditComplete]);

  return (
    <div className="flex h-full">
      {/* Service Picker Sidebar */}
      <ServicePicker
        onDragStart={onServiceDragStart}
        suggestedServices={challengeContext?.awsServices}
      />

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={deleteSelectedNode}
              disabled={!selectedNode}
              className="h-8 text-xs gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCanvas}
              disabled={nodes.length === 0}
              className="h-8 text-xs gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {/* Audit Result Badge */}
            {auditResult && (
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium",
                  auditResult.score >= 80
                    ? "bg-green-500/20 text-green-400"
                    : auditResult.score >= 50
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-red-500/20 text-red-400"
                )}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Score: {auditResult.score}/100
              </div>
            )}

            {/* Save status indicator */}
            <div className="flex items-center gap-2">
              {isSaving && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving...
                </span>
              )}
              {!isSaving && lastSaved && !isDirty && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Saved
                </span>
              )}
              {isDirty && !isSaving && (
                <span className="text-xs text-amber-400">Unsaved changes</span>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={saveData}
              disabled={!isDirty || isSaving}
              className="h-8 text-xs gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Save Now
            </Button>

            <Button
              onClick={auditDiagram}
              disabled={isAuditing || nodes.length === 0}
              className="h-8 text-xs gap-1.5 bg-cyan-500 hover:bg-cyan-600"
            >
              {isAuditing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Auditing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Audit Diagram
                </>
              )}
            </Button>
          </div>
        </div>

        {/* React Flow Canvas */}
        <div ref={reactFlowWrapper} className="flex-1 bg-slate-950">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[20, 20]}
            defaultEdgeOptions={{
              type: "smoothstep",
              animated: true,
              style: { stroke: "#22d3ee", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#22d3ee" },
            }}
            className="bg-slate-950"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#334155"
            />
            <Controls className="!bg-slate-800 !border-slate-700 !rounded-lg [&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button]:!text-slate-400 [&>button:hover]:!bg-slate-700" />
          </ReactFlow>
        </div>

        {/* Audit Feedback Panel */}
        {(auditResult || auditError) && (
          <div className="border-t border-slate-800 bg-slate-900/80 p-4 max-h-48 overflow-y-auto">
            {auditError ? (
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{auditError}</span>
              </div>
            ) : auditResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-slate-200">Audit Results</h4>
                  <span
                    className={cn(
                      "text-lg font-bold",
                      auditResult.score >= 80
                        ? "text-green-400"
                        : auditResult.score >= 50
                        ? "text-amber-400"
                        : "text-red-400"
                    )}
                  >
                    {auditResult.score}/100
                  </span>
                </div>

                {auditResult.correct.length > 0 && (
                  <div>
                    <p className="text-xs text-green-400 font-medium mb-1">✓ Correct:</p>
                    <ul className="text-xs text-slate-400 space-y-0.5">
                      {auditResult.correct.map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {auditResult.missing.length > 0 && (
                  <div>
                    <p className="text-xs text-amber-400 font-medium mb-1">⚠ Missing:</p>
                    <ul className="text-xs text-slate-400 space-y-0.5">
                      {auditResult.missing.map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {auditResult.suggestions.length > 0 && (
                  <div>
                    <p className="text-xs text-cyan-400 font-medium mb-1">💡 Suggestions:</p>
                    <ul className="text-xs text-slate-400 space-y-0.5">
                      {auditResult.suggestions.map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {auditResult.feedback && (
                  <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800">
                    {auditResult.feedback}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Wrap with ReactFlowProvider
export function DiagramCanvas(props: DiagramCanvasProps) {
  return (
    <ReactFlowProvider>
      <DiagramCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
