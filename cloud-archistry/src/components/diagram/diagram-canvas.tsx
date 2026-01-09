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
  useViewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes, SERVICE_FULL_NAMES } from "./aws-nodes";
import { ServicePicker, type NodeStyleUpdate, type SelectedNodeInfo } from "./service-picker";
import { DiagramHierarchyPanel } from "./diagram-hierarchy-panel";
import { type AWSService } from "@/lib/aws-services";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Loader2,
  AlertCircle,
  Sparkles,
  Save,
  Flame,
  TrendingUp,
  Lightbulb,
  X,
  Archive,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  Trash2 as TrashIcon,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  validatePlacement,
  validateConnection,
  updateScore,
  createInitialScore,
  detectHAPattern,
  detectSecurityPattern,
  validateEdge,
  getENIInfo,
  type DiagramScore,
  type ConnectionValidation,
} from "@/lib/aws-placement-rules";
import { getServiceById } from "@/lib/aws-services";

// Types for diagram data
export interface DiagramNode extends Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  parentId?: string;
  zIndex?: number;
  style?: Record<string, unknown>;
  data: {
    serviceId: string;
    label: string;
    sublabel?: string;
    color: string;
    config?: Record<string, unknown>;
    subnetType?: "public" | "private";
    width?: number;
    height?: number;
    iconPath?: string; // Custom AWS icon path for user-added services
    icon?: string; // Emoji icon for generic elements
    // Text node styling
    fontSize?: number;
    fontFamily?: "sans" | "serif" | "mono";
    fontWeight?: "normal" | "bold";
    fontStyle?: "normal" | "italic";
    textDecoration?: "none" | "underline" | "line-through";
    textColor?: string;
  };
}

export interface DiagramEdge extends Edge {
  id: string;
  source: string;
  target: string;
  type?: string;
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

// Stored tip from the database
export interface StoredTip {
  id: string;
  auditScore: number;
  category: "correct" | "missing" | "suggestion" | "feedback";
  content: string;
  isDismissed: boolean;
  isHelpful: boolean | null;
  userNotes: string | null;
  createdAt: string;
}

interface DiagramCanvasProps {
  // Initial diagram data (for loading saved progress)
  initialData?: DiagramData;
  initialScore?: DiagramScore;
  // Challenge context for the agent
  challengeContext?: {
    challengeId: string;
    challengeTitle: string;
    challengeBrief: string;
    awsServices?: string[];
  };
  // Challenge progress ID for saving tips to the database
  challengeProgressId?: string;
  // Session for agent chat continuity
  sessionId?: string;
  // Callbacks
  onSave?: (data: DiagramData, score: DiagramScore) => void | Promise<void>;
  onScoreChange?: (score: DiagramScore) => void;
  onAuditComplete?: (result: AuditResult) => void;
}

// Helper: Sort nodes so parents come before children (required by React Flow)
function sortNodesForReactFlow(nodes: DiagramNode[]): DiagramNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const sorted: DiagramNode[] = [];
  const visited = new Set<string>();
  
  function visit(node: DiagramNode) {
    if (visited.has(node.id)) return;
    
    // If this node has a parent, visit the parent first
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        visit(parent);
      } else {
        // Parent doesn't exist - remove the invalid parentId reference
        node = { ...node, parentId: undefined, extent: undefined };
        nodeMap.set(node.id, node);
      }
    }
    
    visited.add(node.id);
    sorted.push(node);
  }
  
  // Visit all nodes
  for (const node of nodes) {
    visit(node);
  }
  
  return sorted;
}

function DiagramCanvasInner({
  initialData,
  initialScore,
  challengeContext,
  challengeProgressId,
  sessionId,
  onSave,
  onScoreChange,
  onAuditComplete,
}: DiagramCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  
  // Diagram state - sort nodes to ensure parents come before children
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialData?.nodes ? sortNodesForReactFlow(initialData.nodes) : []
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData?.edges || []);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  
  // Track if any text node is being edited (disables panning)
  const isTextEditing = nodes.some(n => n.type === "textNode" && n.draggable === false);
  
  // Audit state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  
  // Track if diagram has been modified
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // 🎮 GAMIFICATION STATE
  const [diagramScore, setDiagramScore] = useState<DiagramScore>(initialScore || createInitialScore());
  const [proTip, setProTip] = useState<{ message: string; isError: boolean } | null>(null);
  const [showScoreAnimation, setShowScoreAnimation] = useState<{ points: number; isPositive: boolean } | null>(null);
  const proTipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [awardedBonuses, setAwardedBonuses] = useState<Set<string>>(new Set()); // Track which bonuses have been awarded

  useEffect(() => {
    if (initialScore) {
      setDiagramScore(initialScore);
    }
  }, [initialScore]);

  // 📦 TIP JAR STATE
  const [tipJarOpen, setTipJarOpen] = useState(false);
  const [storedTips, setStoredTips] = useState<StoredTip[]>([]);
  const [isLoadingTips, setIsLoadingTips] = useState(false);
  const [tipJarFilter, setTipJarFilter] = useState<"all" | "correct" | "missing" | "suggestion">("all");

  // 🔄 UNDO/REDO STATE
  type HistoryState = { nodes: DiagramNode[]; edges: DiagramEdge[] };
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);
  
  // 📋 CLIPBOARD STATE
  const [clipboard, setClipboard] = useState<{ nodes: DiagramNode[]; edges: DiagramEdge[] } | null>(null);
  
  // 🖱️ CONTEXT MENU STATE
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null);
  
  // Track if user has manually adjusted z-indices (disables auto-recalculation)
  const manualZIndexAdjustment = useRef(false);
  
  // 🔲 GRID STATE
  const [showGrid, setShowGrid] = useState(true);
  
  // 🖥️ FULLSCREEN STATE
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // 📊 HIERARCHY PANEL STATE
  const [showHierarchyPanel, setShowHierarchyPanel] = useState(true);
  const [hierarchyNeedsRecalc, setHierarchyNeedsRecalc] = useState(true);
  
  // Get viewport for zoom level
  const { zoom } = useViewport();
  const zoomLevel = Math.round(zoom * 100);
  const { fitView, zoomIn: rfZoomIn, zoomOut: rfZoomOut } = useReactFlow();

  // Auto-save function
  const saveData = useCallback(async () => {
    if (nodes.length === 0 && edges.length === 0) return;
    
    const data: DiagramData = { nodes: nodes as DiagramNode[], edges: edges as DiagramEdge[] };
    setIsSaving(true);
    
    try {
      // Call the onSave callback and wait for it if it's a promise
      await onSave?.(data, diagramScore);
      
      setIsDirty(false);
      setLastSaved(new Date());
    } catch (error) {
      console.error("Failed to save diagram:", error);
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, onSave, diagramScore]);

  // Notify parent whenever score changes
  useEffect(() => {
    onScoreChange?.(diagramScore);
  }, [diagramScore, onScoreChange]);

  // Mark as dirty when nodes/edges change (no auto-save - manual save only)
  useEffect(() => {
    // Skip initial render
    if (nodes.length === 0 && edges.length === 0) return;
    
    setIsDirty(true);
  }, [nodes, edges]);

  // Calculate proper z-index for a node based on its hierarchy
  const calculateZIndex = useCallback((node: DiagramNode, allNodes: DiagramNode[]): number => {
    // Base z-index by node type (lower = further back)
    // Note: securityGroup removed - SGs are regular nodes (awsResource)
    // Note: auto-scaling uses hyphenated ID for consistency
    const baseZIndex: Record<string, number> = {
      // Organizational boundaries (furthest back) - use very low values
      orgNode: -100,
      accountNode: -90,
      awsCloud: -80,
      region: -70,
      availabilityZone: -60,
      // Service containers (should be behind their children but above boundaries)
      vpc: -50,
      subnet: -40,
      "auto-scaling": -20,
      // Regular services and elements
      awsResource: 10,
      genericIcon: 10,
      textNode: 15,
      noteNode: 15,
      // Annotations (on top)
      legendNode: 20,
      lifecycleNode: 20,
      pipelineNode: 20,
      scalingPolicyNode: 20,
      backupPlanNode: 20,
      dataFlowNode: 20,
      policyDocumentNode: 20,
    };
    
    const nodeType = node.type || 'awsResource';
    let zIndex = baseZIndex[nodeType] ?? 10;
    
    // If this node has children, ensure it stays behind them
    const hasChildren = allNodes.some(n => n.parentId === node.id);
    if (hasChildren) {
      // Container nodes should be behind their children
      // Find the maximum z-index of children and stay below it
      const childrenZIndices = allNodes
        .filter(n => n.parentId === node.id)
        .map(child => calculateZIndex(child, allNodes));
      
      if (childrenZIndices.length > 0) {
        const maxChildZ = Math.max(...childrenZIndices);
        // Stay at least 1 level below the lowest child
        zIndex = Math.min(zIndex, maxChildZ - 1);
      }
    }
    
    return zIndex;
  }, []);
  
  // Recalculate all z-indices based on hierarchy
  const recalculateZIndices = useCallback(() => {
    setNodes(nds => {
      const updatedNodes = nds.map(node => {
        const newZIndex = calculateZIndex(node as DiagramNode, nds as DiagramNode[]);
        return { ...node, zIndex: newZIndex } as DiagramNode;
      });
      return updatedNodes;
    });
  }, [calculateZIndex, setNodes]);
  
  // Recalculate z-indices when nodes are first added (but not if user has manually adjusted)
  useEffect(() => {
    // Only auto-recalculate on initial node creation, not on every change
    if (manualZIndexAdjustment.current) return;
    
    const timer = setTimeout(() => {
      recalculateZIndices();
    }, 100);
    return () => clearTimeout(timer);
  }, [nodes.length, recalculateZIndices]);

  // Handle node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // 🎮 Show pro-tip with auto-dismiss
  const showProTip = useCallback((message: string, isError: boolean = false) => {
    // Clear existing timeout
    if (proTipTimeoutRef.current) {
      clearTimeout(proTipTimeoutRef.current);
    }
    
    setProTip({ message, isError });
    
    // Auto-dismiss after 6 seconds
    proTipTimeoutRef.current = setTimeout(() => {
      setProTip(null);
    }, 6000);
  }, []);

  // 🎮 Show score animation
  const animateScore = useCallback((points: number) => {
    setShowScoreAnimation({ points, isPositive: points > 0 });
    setTimeout(() => setShowScoreAnimation(null), 1500);
  }, []);

  // 🎮 Check for architecture pattern bonuses
  const checkPatternBonuses = useCallback(() => {
    // Check HA pattern
    if (!awardedBonuses.has("ha")) {
      const haResult = detectHAPattern(nodes as { id: string; type?: string; data?: { serviceId?: string; subnetType?: "public" | "private"; label?: string }; parentId?: string }[]);
      if (haResult.detected) {
        setAwardedBonuses(prev => new Set([...prev, "ha"]));
        setDiagramScore(prev => ({
          ...prev,
          totalPoints: prev.totalPoints + haResult.bonus,
        }));
        animateScore(haResult.bonus);
        showProTip(haResult.message, false);
      }
    }
    
    // Check security pattern
    if (!awardedBonuses.has("security")) {
      const secResult = detectSecurityPattern(nodes as { id: string; type?: string; data?: { serviceId?: string; subnetType?: "public" | "private"; label?: string }; parentId?: string }[]);
      if (secResult.detected) {
        setAwardedBonuses(prev => new Set([...prev, "security"]));
        setDiagramScore(prev => ({
          ...prev,
          totalPoints: prev.totalPoints + secResult.bonus,
        }));
        animateScore(secResult.bonus);
        showProTip(secResult.message, false);
      }
    }
  }, [nodes, awardedBonuses, animateScore, showProTip]);

  // Check for bonuses when nodes change (debounced)
  useEffect(() => {
    if (nodes.length >= 3) { // Only check when there are enough nodes
      const timer = setTimeout(checkPatternBonuses, 2000); // Check 2 seconds after changes settle
      return () => clearTimeout(timer);
    }
  }, [nodes, checkPatternBonuses]);

  // Handle new connections with validation (using edge-based relationship model)
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      
      // Find source and target nodes to get their service IDs
      const sourceNode = nodes.find((n: DiagramNode) => n.id === params.source);
      const targetNode = nodes.find((n: DiagramNode) => n.id === params.target);
      
      if (sourceNode && targetNode) {
        const sourceServiceId = sourceNode.data?.serviceId;
        const targetServiceId = targetNode.data?.serviceId;
        
        // 🔌 NEW: Validate using edge-based relationship model
        const edgeValidation = validateEdge(sourceServiceId, targetServiceId);
        
        // Get ENI info for educational feedback
        const sourceENI = getENIInfo(sourceServiceId);
        const targetENI = getENIInfo(targetServiceId);
        
        // Get the source service's connection rules (legacy validation)
        const sourceService = getServiceById(sourceServiceId);
        
        // Validate the connection (legacy)
        const validation: ConnectionValidation = validateConnection(
          sourceServiceId,
          targetServiceId,
          sourceService?.canConnectTo
        );
        
        // Award/deduct points for connection
        if (validation.pointsAwarded !== 0) {
          animateScore(validation.pointsAwarded);
          setDiagramScore(prev => ({
            ...prev,
            totalPoints: Math.max(0, prev.totalPoints + validation.pointsAwarded),
          }));
        }
        
        // Show feedback based on edge validation
        if (edgeValidation.isValid && edgeValidation.edgeType) {
          // Valid edge with known type - show educational info
          const edgeInfo = edgeValidation.edgeType;
          if (sourceENI && targetENI) {
            showProTip(`🔌 ${edgeInfo.name}: Traffic flows via ENIs. ${sourceENI.description}`, false);
          } else {
            showProTip(`✅ ${edgeInfo.name}: ${edgeInfo.description}`, false);
          }
        } else if (edgeValidation.proTip) {
          // Edge validation has specific feedback
          showProTip(edgeValidation.proTip, !edgeValidation.isValid);
        } else if (!validation.isValid && validation.proTip) {
          // Fall back to legacy validation feedback
          showProTip(validation.proTip, true);
        } else if (validation.isValid && validation.pointsAwarded > 0) {
          showProTip(`✅ +${validation.pointsAwarded} pts for valid connection!`, false);
        }
      }
      
      // Always add the edge (we don't block connections, just score them)
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
    [setEdges, nodes, animateScore, showProTip]
  );

  // 📦 TIP JAR FUNCTIONS
  // Load tips from the database
  const loadTips = useCallback(async () => {
    if (!challengeProgressId) return;
    
    setIsLoadingTips(true);
    try {
      const response = await fetch(
        `/api/diagram/tips?challengeProgressId=${challengeProgressId}&includeDismissed=true`
      );
      if (response.ok) {
        const data = await response.json();
        setStoredTips(data.tips || []);
      }
    } catch (error) {
      console.error("Failed to load tips:", error);
    } finally {
      setIsLoadingTips(false);
    }
  }, [challengeProgressId]);

  // Save audit result as tips
  const saveTipsFromAudit = useCallback(async (result: AuditResult) => {
    if (!challengeProgressId) return;
    
    try {
      const diagramSnapshot = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type,
          label: n.data?.label,
        })),
        edges: edges.map((e) => ({
          source: e.source,
          target: e.target,
        })),
      };

      await fetch("/api/diagram/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeProgressId,
          auditResult: result,
          diagramSnapshot,
        }),
      });
      
      // Reload tips to show the new ones
      await loadTips();
    } catch (error) {
      console.error("Failed to save tips:", error);
    }
  }, [challengeProgressId, nodes, edges, loadTips]);

  // Dismiss a tip
  const dismissTip = useCallback(async (tipId: string) => {
    try {
      await fetch(`/api/diagram/tips/${tipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDismissed: true }),
      });
      
      // Update local state
      setStoredTips((prev) =>
        prev.map((t) => (t.id === tipId ? { ...t, isDismissed: true, dismissedAt: new Date().toISOString() } : t))
      );
    } catch (error) {
      console.error("Failed to dismiss tip:", error);
    }
  }, []);

  // Mark tip as helpful or not
  const markTipHelpful = useCallback(async (tipId: string, isHelpful: boolean) => {
    try {
      await fetch(`/api/diagram/tips/${tipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHelpful }),
      });
      
      // Update local state
      setStoredTips((prev) =>
        prev.map((t) => (t.id === tipId ? { ...t, isHelpful } : t))
      );
    } catch (error) {
      console.error("Failed to update tip:", error);
    }
  }, []);

  // Delete a tip permanently
  const deleteTip = useCallback(async (tipId: string) => {
    try {
      await fetch(`/api/diagram/tips/${tipId}`, {
        method: "DELETE",
      });
      
      // Update local state
      setStoredTips((prev) => prev.filter((t) => t.id !== tipId));
    } catch (error) {
      console.error("Failed to delete tip:", error);
    }
  }, []);

  // Load tips on mount if we have a challengeProgressId
  useEffect(() => {
    if (challengeProgressId) {
      loadTips();
    }
  }, [challengeProgressId, loadTips]);

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

  // Helper to get absolute position of a node (accounting for parent chain)
  const getAbsolutePosition = useCallback((node: DiagramNode, allNodes: DiagramNode[]): { x: number; y: number } => {
    let x = node.position.x;
    let y = node.position.y;
    let currentParentId = node.parentId;
    
    while (currentParentId) {
      const parent = allNodes.find(n => n.id === currentParentId);
      if (parent) {
        x += parent.position.x;
        y += parent.position.y;
        currentParentId = parent.parentId;
      } else {
        break;
      }
    }
    
    return { x, y };
  }, []);

  // Find which container node contains a given position
  const findContainerAtPosition = useCallback(
    (pos: { x: number; y: number }, excludeId?: string) => {
      // Container types that can have children
      // Note: securityGroup removed - SGs are attachments/bindings, not containers per AWS standards
      // Note: auto-scaling uses hyphenated ID for consistency
      const containerTypes = ["awsCloud", "region", "availabilityZone", "vpc", "subnet", "auto-scaling"];
      
      // Find containers that contain this position (check from smallest to largest)
      const containers = nodes
        .filter((n) => containerTypes.includes(n.type || "") && n.id !== excludeId)
        .filter((n) => {
          // Get absolute position of container
          const absPos = getAbsolutePosition(n as DiagramNode, nodes as DiagramNode[]);
          const nodeWidth = n.measured?.width || n.width || 200;
          const nodeHeight = n.measured?.height || n.height || 150;
          return (
            pos.x >= absPos.x &&
            pos.x <= absPos.x + nodeWidth &&
            pos.y >= absPos.y &&
            pos.y <= absPos.y + nodeHeight
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
    [nodes, getAbsolutePosition]
  );

  // 🔄 Handle node drag stop - update parentId when node is moved into a container
  const onNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    // Get the node's absolute position (accounting for current parent)
    const draggedNode = nodes.find((n: DiagramNode) => n.id === node.id) as DiagramNode | undefined;
    const nodeAbsPos = draggedNode 
      ? getAbsolutePosition({ ...draggedNode, position: node.position }, nodes as DiagramNode[])
      : node.position;
    
    // Find the container at this position (excluding the node itself)
    const container = findContainerAtPosition(nodeAbsPos, node.id);
    
    // Get current parentId
    const currentParentId = draggedNode?.parentId;
    const newParentId = container?.id || undefined;
    
    // If parentId changed, update the node
    if (currentParentId !== newParentId) {
      setNodes((nds: DiagramNode[]) => nds.map((n: DiagramNode) => {
        if (n.id === node.id) {
          // Calculate new relative position if moving into a container
          let newPosition = nodeAbsPos;
          if (container) {
            const containerAbsPos = getAbsolutePosition(container as DiagramNode, nodes as DiagramNode[]);
            newPosition = {
              x: nodeAbsPos.x - containerAbsPos.x,
              y: nodeAbsPos.y - containerAbsPos.y,
            };
          }
          return {
            ...n,
            parentId: newParentId,
            position: newPosition,
          };
        }
        return n;
      }));
      
      // Recalculate z-indices after parent change
      setTimeout(() => recalculateZIndices(), 50);
    }
  }, [nodes, findContainerAtPosition, setNodes, recalculateZIndices, getAbsolutePosition]);

  // 🔄 Recalculate ALL parentIds based on visual containment
  // This fixes nodes that were placed before the drag-stop handler was added
  const recalculateAllParentIds = useCallback(() => {
    const containerTypes = ["awsCloud", "region", "availabilityZone", "vpc", "subnet", "auto-scaling"];
    
    // Get all containers sorted by area (largest first - so we process outer containers first)
    // Using 'any' because React Flow nodes have measured/width/height that aren't in our DiagramNode type
    const containers = nodes
      .filter((n: { type?: string }) => containerTypes.includes(n.type || ""))
      .map((n: { id: string; type?: string; parentId?: string; position: { x: number; y: number }; measured?: { width?: number; height?: number }; width?: number; height?: number }) => ({
        node: n,
        absPos: getAbsolutePosition(n as DiagramNode, nodes as DiagramNode[]),
        area: (n.measured?.width || n.width || 200) * (n.measured?.height || n.height || 150),
        width: n.measured?.width || n.width || 200,
        height: n.measured?.height || n.height || 150,
      }))
      .sort((a: { area: number }, b: { area: number }) => b.area - a.area); // Largest first
    
    let hasChanges = false;
    const updatedNodes = nodes.map((n: DiagramNode) => {
      // Get node's absolute position
      const nodeAbsPos = getAbsolutePosition(n, nodes as DiagramNode[]);
      
      // Find the smallest container that contains this node
      let newParentId: string | undefined = undefined;
      for (const container of containers) {
        if (container.node.id === n.id) continue; // Skip self
        
        if (
          nodeAbsPos.x >= container.absPos.x &&
          nodeAbsPos.x <= container.absPos.x + container.width &&
          nodeAbsPos.y >= container.absPos.y &&
          nodeAbsPos.y <= container.absPos.y + container.height
        ) {
          // This container contains the node - but we want the smallest one
          // Since containers are sorted largest first, keep checking for smaller ones
          newParentId = container.node.id;
        }
      }
      
      if (n.parentId !== newParentId) {
        hasChanges = true;
        // Calculate new relative position
        let newPosition = nodeAbsPos;
        if (newParentId) {
          const parentContainer = containers.find((c: { node: { id: string } }) => c.node.id === newParentId);
          if (parentContainer) {
            newPosition = {
              x: nodeAbsPos.x - parentContainer.absPos.x,
              y: nodeAbsPos.y - parentContainer.absPos.y,
            };
          }
        }
        return { ...n, parentId: newParentId, position: newPosition };
      }
      return n;
    });
    
    if (hasChanges) {
      setNodes(updatedNodes);
      setTimeout(() => recalculateZIndices(), 50);
    }
  }, [nodes, setNodes, getAbsolutePosition, recalculateZIndices]);

  // 🔄 Recalculate hierarchy when panel is shown or nodes change significantly
  useEffect(() => {
    if (showHierarchyPanel && hierarchyNeedsRecalc && nodes.length > 0) {
      // Delay to ensure node measurements are available
      const timer = setTimeout(() => {
        recalculateAllParentIds();
        setHierarchyNeedsRecalc(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showHierarchyPanel, hierarchyNeedsRecalc, nodes.length, recalculateAllParentIds]);

  // Handle drop - create new node with VALIDATION
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      // Check for shape/element data first
      const shapeData = event.dataTransfer.getData("application/diagram-shape");
      if (shapeData) {
        const shape = JSON.parse(shapeData);
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        // Create shape node based on type
        if (shape.type === "boundary") {
          // AWS boundary containers - ONLY the ones not in Services
          // VPC, Subnet, Security Group come from Services > Networking
          // Z-index will be calculated by calculateZIndex based on hierarchy
          const boundaryConfig: Record<string, { width: number; height: number; nodeType: string }> = {
            "AWS Cloud": { width: 500, height: 350, nodeType: "awsCloud" },
            "Region": { width: 400, height: 280, nodeType: "region" },
            "Availability Zone": { width: 220, height: 160, nodeType: "availabilityZone" },
          };
          
          const config = boundaryConfig[shape.label];
          if (!config) return; // Unknown boundary type
          
          const newNode: DiagramNode = {
            id: `${shape.label.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
            type: config.nodeType,
            position,
            style: { width: config.width, height: config.height },
            data: {
              serviceId: shape.label.toLowerCase().replace(/\s+/g, "-"),
              label: shape.label,
              color: shape.color,
            },
            // z-index will be set by calculateZIndex
          };
          
          setNodes((nds) => nds.concat(newNode));
        } else if (shape.type === "icon") {
          // General icon (user, mobile, internet, etc.)
          const newNode: DiagramNode = {
            id: `icon-${shape.label.toLowerCase()}-${Date.now()}`,
            type: "genericIcon",
            position,
            data: {
              serviceId: `icon-${shape.label.toLowerCase()}`,
              label: shape.label,
              sublabel: "",
              color: "#64748b",
              icon: shape.icon,
            },
            zIndex: 10,
          };
          
          setNodes((nds) => nds.concat(newNode));
        } else if (shape.type === "text") {
          // Text box or Note
          const newNode: DiagramNode = {
            id: `${shape.textType}-${Date.now()}`,
            type: shape.textType === "note" ? "noteNode" : "textNode",
            position,
            data: {
              serviceId: shape.textType,
              label: shape.textType === "note" ? "Add note..." : "Add text...",
              sublabel: "",
              color: shape.textType === "note" ? "#fbbf24" : "#64748b",
            },
            zIndex: 15,
          };
          
          setNodes((nds) => nds.concat(newNode));
        } else if (shape.type === "annotation") {
          // Architecture annotations (Legend, Lifecycle, Pipeline, etc.)
          const annotationDefaults: Record<string, Record<string, unknown>> = {
            legendNode: { 
              label: "Legend",
              owner: "Platform Team",
              environment: "Production",
              costCenter: "PROD-001",
            },
            lifecycleNode: {
              label: "S3 Lifecycle Policy",
              rules: [
                { days: 30, action: "Transition", storageClass: "IA" },
                { days: 90, action: "Transition", storageClass: "Glacier" },
                { days: 365, action: "Delete" },
              ],
              versioningEnabled: true,
            },
            pipelineNode: {
              label: "CI/CD Pipeline",
              stages: [
                { name: "Source", status: "success" },
                { name: "Build", status: "success" },
                { name: "Test", status: "running" },
                { name: "Deploy", status: "pending" },
              ],
            },
            scalingPolicyNode: {
              label: "Auto Scaling Policy",
              policyType: "target-tracking",
              metric: "CPU Utilization",
              targetValue: 70,
              minCapacity: 2,
              maxCapacity: 10,
            },
            backupPlanNode: {
              label: "Backup Plan",
              schedule: "Daily at 2:00 AM",
              retentionDays: 30,
              copyToRegion: "us-west-2",
            },
            dataFlowNode: {
              label: "HTTPS Traffic",
              protocol: "HTTPS",
              port: 443,
              direction: "inbound",
              encrypted: true,
            },
            policyDocumentNode: {
              label: "S3 Read Policy",
              policyType: "identity",
              effect: "Allow",
              actions: ["s3:GetObject", "s3:ListBucket"],
              resources: ["arn:aws:s3:::my-bucket/*"],
              conditions: [],
            },
          };
          
          const newNode: DiagramNode = {
            id: `${shape.nodeType}-${Date.now()}`,
            type: shape.nodeType,
            position,
            data: {
              serviceId: shape.nodeType,
              label: shape.label,
              color: "#64748b",
              ...annotationDefaults[shape.nodeType],
            },
            zIndex: 20, // Annotations on top
          };
          
          setNodes((nds) => nds.concat(newNode));
        } else if (shape.type === "container") {
          // Multi-account containers (Organization, Account)
          const containerConfig: Record<string, { width: number; height: number; zIndex: number; extraData?: Record<string, unknown> }> = {
            orgNode: { width: 500, height: 400, zIndex: 3, extraData: { orgId: "o-abc123" } },
            accountNode: { width: 400, height: 300, zIndex: 4, extraData: { accountId: "123456789012", environment: "Production" } },
          };
          
          const config = containerConfig[shape.nodeType];
          if (!config) return;
          
          const newNode: DiagramNode = {
            id: `${shape.nodeType}-${Date.now()}`,
            type: shape.nodeType,
            position,
            style: { width: config.width, height: config.height },
            data: {
              serviceId: shape.nodeType,
              label: shape.label,
              color: shape.nodeType === "orgNode" ? "#232F3E" : "#f59e0b",
              config: config.extraData || {},
            },
            zIndex: config.zIndex,
          };
          
          setNodes((nds) => nds.concat(newNode));
        }
        return;
      }

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
      else if (service.id === "security-group") nodeType = "awsResource";  // SGs are regular nodes, not containers
      else if (service.id === "auto-scaling") nodeType = "auto-scaling";
      else if (service.id === "aws-cloud") nodeType = "awsCloud";
      else if (service.id === "region") nodeType = "region";
      else if (service.id === "availability-zone") nodeType = "availabilityZone";

      // Default sizes for containers
      // Note: securityGroup removed - SGs are regular nodes, not containers
      const containerSizes: Record<string, { width: number; height: number }> = {
        vpc: { width: 600, height: 400 },
        subnet: { width: 250, height: 180 },
        "auto-scaling": { width: 150, height: 100 },
        awsCloud: { width: 500, height: 350 },
        region: { width: 400, height: 280 },
        availabilityZone: { width: 220, height: 160 },
      };
      
      // Z-index hierarchy for proper layering (lower = further back)
      // Shapes & Elements: Org(-100) < Account(-90) < AWS Cloud(-80) < Region(-70) < AZ(-60)
      // Services containers: VPC(-50) < Subnet(-40) < Auto Scaling(-20)
      // Note: securityGroup removed - SGs are regular nodes (z-index 10)
      // Regular services: 10
      const containerZIndex: Record<string, number> = {
        awsCloud: -80,
        region: -70,
        availabilityZone: -60,
        vpc: -50,
        subnet: -40,
        "auto-scaling": -20,
      };

      // Check if dropping inside a container
      let parentId: string | undefined;
      let relativePosition = position;
      let targetType: string | null = null;
      let targetSubnetType: "public" | "private" | undefined;
      
      const container = findContainerAtPosition(position);
      if (container) {
        // Get the container's type for validation
        // For subnets, we need to use "subnet-public" or "subnet-private" as the key
        targetSubnetType = container.data?.subnetType as "public" | "private" | undefined;
        if (container.type === "subnet" && targetSubnetType) {
          targetType = `subnet-${targetSubnetType}`;
        } else {
          targetType = container.type || null;
        }
        
        // 🎮 VALIDATE PLACEMENT
        const validation = validatePlacement(service.id, targetType, targetSubnetType);
        
        if (!validation.isValid) {
          // Check severity - only ERRORS block placement
          // WARNINGS and NOTES allow placement but show feedback
          if (validation.severity === "error") {
            // ❌ HARD ERROR - Block placement
            showProTip(validation.proTip || "This service cannot be placed here.", true);
            animateScore(validation.pointsAwarded);
            setDiagramScore(prev => updateScore(prev, validation, service.id, targetType));
            return; // Don't add the node
          } else if (validation.severity === "warning") {
            // ⚠️ WARNING - Allow placement but show warning
            showProTip(`⚠️ ${validation.proTip}`, true);
            // No negative points for warnings, but no positive either
          }
          // NOTE severity - allow silently (diagram abstraction)
        }
        
        // ✅ Valid placement inside container
        parentId = container.id;
        relativePosition = {
          x: position.x - container.position.x,
          y: position.y - container.position.y,
        };
        
        // Award points for correct placement
        animateScore(validation.pointsAwarded);
        setDiagramScore(prev => updateScore(prev, validation, service.id, targetType));
        
        // Show positive feedback for streak
        if (diagramScore.currentStreak >= 2) {
          showProTip(`🔥 ${diagramScore.currentStreak + 1} correct in a row! +${validation.pointsAwarded} points`, false);
        }
      } else {
        // Dropping on canvas (not in container)
        // Validate canvas-level placement
        const validation = validatePlacement(service.id, "canvas", undefined);
        
        if (!validation.isValid) {
          // Check severity - only ERRORS block placement
          if (validation.severity === "error") {
            showProTip(validation.proTip || "This service cannot be placed here.", true);
            animateScore(validation.pointsAwarded);
            setDiagramScore(prev => updateScore(prev, validation, service.id, "canvas"));
            return;
          } else if (validation.severity === "warning") {
            showProTip(`⚠️ ${validation.proTip}`, true);
          }
          // NOTE severity - allow silently
        } else {
          // Award points for valid placement
          animateScore(validation.pointsAwarded);
          setDiagramScore(prev => updateScore(prev, validation, service.id, "canvas"));
        }
      }

      // Get size for this node type
      const size = containerSizes[nodeType];
      
      // Check if service has a custom iconPath (for user-added services)
      const serviceWithIcon = service as typeof service & { iconPath?: string };
      
      const newNode: DiagramNode = {
        id: `${service.id}-${Date.now()}`,
        type: nodeType,
        position: relativePosition,
        parentId,
        // Remove extent constraint to allow free movement - nodes can be moved anywhere
        // The parentId is kept for logical grouping and z-index calculations only
        extent: undefined,
        ...(size && { width: size.width, height: size.height }),
        style: size ? { width: size.width, height: size.height } : undefined,
        data: {
          serviceId: service.id,
          label: service.shortName,
          sublabel: SERVICE_FULL_NAMES[service.id] || service.name,
          color: service.color,
          config: service.defaultConfig || {},
          subnetType: service.id === "subnet-public" ? "public" : service.id === "subnet-private" ? "private" : undefined,
          iconPath: serviceWithIcon.iconPath, // Pass custom icon path if available
        },
        zIndex: containerZIndex[nodeType] ?? (service.isContainer ? 0 : 10),
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, findContainerAtPosition, showProTip, animateScore, diagramScore.currentStreak]
  );

  // Delete selected node
  const deleteSelectedNode = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
      setSelectedNode(null);
    }
  }, [selectedNode, setNodes, setEdges]);
  
  // 🎨 LAYER CONTROLS - Send to Back / Bring to Front
  const sendToBack = useCallback(() => {
    if (!selectedNode) return;
    manualZIndexAdjustment.current = true; // Disable auto-recalculation
    
    setNodes(nds => {
      const selectedNodeData = nds.find(n => n.id === selectedNode.id) as DiagramNode | undefined;
      if (!selectedNodeData) return nds;
      
      // Get siblings (nodes with same parent or both at root level)
      const siblings = nds.filter(n => {
        const isSibling = n.parentId === selectedNodeData.parentId;
        const notSelf = n.id !== selectedNode.id;
        return isSibling && notSelf;
      });
      
      if (siblings.length === 0) return nds;
      
      // Find minimum z-index among siblings
      const minZ = Math.min(...siblings.map(n => n.zIndex ?? 0));
      
      return nds.map(n => {
        if (n.id === selectedNode.id) {
          return { ...n, zIndex: minZ - 1 } as DiagramNode;
        }
        return n;
      });
    });
  }, [selectedNode, setNodes]);
  
  const bringToFront = useCallback(() => {
    if (!selectedNode) return;
    manualZIndexAdjustment.current = true; // Disable auto-recalculation
    
    setNodes(nds => {
      const selectedNodeData = nds.find(n => n.id === selectedNode.id) as DiagramNode | undefined;
      if (!selectedNodeData) return nds;
      
      // Get siblings (nodes with same parent or both at root level)
      const siblings = nds.filter(n => {
        const isSibling = n.parentId === selectedNodeData.parentId;
        const notSelf = n.id !== selectedNode.id;
        return isSibling && notSelf;
      });
      
      if (siblings.length === 0) return nds;
      
      // Find maximum z-index among siblings
      const maxZ = Math.max(...siblings.map(n => n.zIndex ?? 0));
      
      return nds.map(n => {
        if (n.id === selectedNode.id) {
          return { ...n, zIndex: maxZ + 1 } as DiagramNode;
        }
        return n;
      });
    });
  }, [selectedNode, setNodes]);
  
  const sendBackward = useCallback(() => {
    if (!selectedNode) return;
    manualZIndexAdjustment.current = true; // Disable auto-recalculation
    
    setNodes(nds => {
      const selectedNodeData = nds.find(n => n.id === selectedNode.id) as DiagramNode | undefined;
      if (!selectedNodeData) return nds;
      
      const currentZ = selectedNodeData.zIndex ?? 0;
      
      // Get siblings (nodes with same parent or both at root level)
      const siblings = nds.filter(n => {
        const isSibling = n.parentId === selectedNodeData.parentId;
        const notSelf = n.id !== selectedNode.id;
        return isSibling && notSelf;
      });
      
      // Find the next lower z-index among siblings
      const lowerSiblings = siblings.filter(n => (n.zIndex ?? 0) < currentZ);
      if (lowerSiblings.length === 0) return nds; // Already at back
      
      const targetZ = Math.max(...lowerSiblings.map(n => n.zIndex ?? 0));
      
      return nds.map(n => {
        if (n.id === selectedNode.id) {
          // Swap z-index with the node below
          return { ...n, zIndex: targetZ - 0.5 } as DiagramNode;
        }
        return n;
      });
    });
  }, [selectedNode, setNodes]);
  
  const bringForward = useCallback(() => {
    if (!selectedNode) return;
    manualZIndexAdjustment.current = true; // Disable auto-recalculation
    
    setNodes(nds => {
      const selectedNodeData = nds.find(n => n.id === selectedNode.id) as DiagramNode | undefined;
      if (!selectedNodeData) return nds;
      
      const currentZ = selectedNodeData.zIndex ?? 0;
      
      // Get siblings (nodes with same parent or both at root level)
      const siblings = nds.filter(n => {
        const isSibling = n.parentId === selectedNodeData.parentId;
        const notSelf = n.id !== selectedNode.id;
        return isSibling && notSelf;
      });
      
      // Find the next higher z-index among siblings
      const higherSiblings = siblings.filter(n => (n.zIndex ?? 0) > currentZ);
      if (higherSiblings.length === 0) return nds; // Already at front
      
      const targetZ = Math.min(...higherSiblings.map(n => n.zIndex ?? 0));
      
      return nds.map(n => {
        if (n.id === selectedNode.id) {
          // Swap z-index with the node above
          return { ...n, zIndex: targetZ + 0.5 } as DiagramNode;
        }
        return n;
      });
    });
  }, [selectedNode, setNodes]);

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

  // 🔄 UNDO/REDO FUNCTIONS
  // Save state to history
  const saveToHistory = useCallback(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ nodes: [...nodes], edges: [...edges] });
      // Keep max 50 history states
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [nodes, edges, historyIndex]);

  // Track changes for undo/redo
  useEffect(() => {
    const timeout = setTimeout(() => {
      saveToHistory();
    }, 500); // Debounce to avoid too many history entries
    return () => clearTimeout(timeout);
  }, [nodes, edges, saveToHistory]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    isUndoRedoAction.current = true;
    const prevState = history[historyIndex - 1];
    setNodes(prevState.nodes);
    setEdges(prevState.edges);
    setHistoryIndex(prev => prev - 1);
  }, [canUndo, history, historyIndex, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    isUndoRedoAction.current = true;
    const nextState = history[historyIndex + 1];
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    setHistoryIndex(prev => prev + 1);
  }, [canRedo, history, historyIndex, setNodes, setEdges]);

  // 🎨 TEXT STYLE FUNCTIONS
  const handleUpdateTextStyle = useCallback((styleUpdate: {
    fontSize?: number;
    fontFamily?: "sans" | "serif" | "mono";
    fontWeight?: "normal" | "bold";
    fontStyle?: "normal" | "italic";
    textDecoration?: "none" | "underline" | "line-through";
    textColor?: string;
  }) => {
    if (!selectedNode || (selectedNode.type !== "textNode")) return;
    
    setNodes(nds => nds.map(n => 
      n.id === selectedNode.id 
        ? { ...n, data: { ...n.data, ...styleUpdate } } as DiagramNode
        : n
    ));
  }, [selectedNode, setNodes]);

  // Helper to get selected node info for style panel - use live node data
  const getSelectedNodeInfo = useCallback((): SelectedNodeInfo | null => {
    if (!selectedNode) return null;
    
    // Get live node data from nodes array, not stale selectedNode
    const liveNode = nodes.find(n => n.id === selectedNode.id);
    if (!liveNode) return null;
    
    const nodeStyle = (liveNode.data as Record<string, unknown>)?.nodeStyle as NodeStyleUpdate | undefined;
    
    return {
      id: liveNode.id,
      type: liveNode.type,
      serviceId: liveNode.data?.serviceId as string | undefined,
      label: liveNode.data?.label as string | undefined,
      currentStyle: nodeStyle,
    };
  }, [selectedNode, nodes]);

  // 📋 COPY/PASTE FUNCTIONS
  const handleCopy = useCallback(() => {
    if (!selectedNode) return;
    // Copy selected node and its connected edges
    const nodesToCopy = nodes.filter(n => n.id === selectedNode.id) as DiagramNode[];
    const edgesToCopy = edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id) as DiagramEdge[];
    setClipboard({ nodes: nodesToCopy, edges: edgesToCopy });
  }, [selectedNode, nodes, edges]);

  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.nodes.length === 0) return;
    
    // Create new nodes with offset position and new IDs
    const idMap: Record<string, string> = {};
    const newNodes: DiagramNode[] = clipboard.nodes.map(node => {
      const newId = `${node.data?.serviceId || node.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      idMap[node.id] = newId;
      return {
        ...node,
        id: newId,
        position: { x: node.position.x + 50, y: node.position.y + 50 },
        selected: true,
      } as DiagramNode;
    });
    
    // Create new edges with updated IDs
    const newEdges: DiagramEdge[] = clipboard.edges
      .filter(edge => idMap[edge.source] && idMap[edge.target])
      .map(edge => ({
        ...edge,
        id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source: idMap[edge.source],
        target: idMap[edge.target],
      } as DiagramEdge));
    
    setNodes(nds => [...nds.map(n => ({ ...n, selected: false }) as DiagramNode), ...newNodes]);
    setEdges(eds => [...eds, ...newEdges]);
  }, [clipboard, setNodes, setEdges]);

  const handleDuplicate = useCallback(() => {
    if (!selectedNode) return;
    const nodeToDupe = nodes.find(n => n.id === selectedNode.id) as DiagramNode | undefined;
    if (!nodeToDupe) return;
    
    const newId = `${nodeToDupe.data?.serviceId || nodeToDupe.type}-${Date.now()}`;
    const newNode: DiagramNode = {
      ...nodeToDupe,
      id: newId,
      position: { x: nodeToDupe.position.x + 50, y: nodeToDupe.position.y + 50 },
      selected: true,
    };
    
    setNodes(nds => [...nds.map(n => ({ ...n, selected: false }) as DiagramNode), newNode]);
  }, [selectedNode, nodes, setNodes]);

  const handleSelectAll = useCallback(() => {
    setNodes(nds => nds.map(n => ({ ...n, selected: true })));
  }, [setNodes]);

  // 🖱️ CONTEXT MENU
  const handleContextMenu = useCallback((event: React.MouseEvent | MouseEvent, node?: Node) => {
    event.preventDefault();
    const mouseEvent = event as MouseEvent;
    setContextMenu({
      x: mouseEvent.clientX,
      y: mouseEvent.clientY,
      nodeId: node?.id,
    });
    if (node) {
      setSelectedNode(node);
    }
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Close context menu on click elsewhere
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [closeContextMenu]);

  // ⌨️ KEYBOARD SHORTCUTS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;
      
      if (cmdKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (cmdKey && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if (cmdKey && e.key === "c") {
        e.preventDefault();
        handleCopy();
      } else if (cmdKey && e.key === "v") {
        e.preventDefault();
        handlePaste();
      } else if (cmdKey && e.key === "d") {
        e.preventDefault();
        handleDuplicate();
      } else if (cmdKey && e.key === "a") {
        e.preventDefault();
        handleSelectAll();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNode) {
          e.preventDefault();
          deleteSelectedNode();
        }
      } else if (e.key === "Escape") {
        setIsFullscreen(false);
      }
      // Layer control shortcuts
      else if (cmdKey && e.shiftKey && e.key === "]") {
        e.preventDefault();
        bringToFront();
      } else if (cmdKey && e.shiftKey && e.key === "[") {
        e.preventDefault();
        sendToBack();
      } else if (cmdKey && e.key === "]") {
        e.preventDefault();
        bringForward();
      } else if (cmdKey && e.key === "[") {
        e.preventDefault();
        sendBackward();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, handleCopy, handlePaste, handleDuplicate, handleSelectAll, selectedNode, deleteSelectedNode, bringToFront, sendToBack, bringForward, sendBackward]);

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
      // Use Next.js API proxy route for proper auth and API key handling
      const response = await fetch('/api/diagram/audit', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: nodes.map((n) => ({
            id: n.id,
            type: n.data?.serviceId || n.type,
            label: n.data?.label,
            config: n.data?.config,
            parentId: n.parentId,  // Critical for hierarchy analysis
            position: n.position,
          })),
          connections: edges.map((e) => ({
            from: e.source,
            to: e.target,
          })),
          challengeId: challengeContext?.challengeId,
          challengeTitle: challengeContext?.challengeTitle,
          challengeBrief: challengeContext?.challengeBrief,
          sessionId: sessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.detail || "Failed to get audit response");
      }

      // The Next.js proxy wraps the response in { success, audit, sessionId }
      const data = await response.json();
      const result: AuditResult = data.audit || data;

      setAuditResult(result);
      onAuditComplete?.(result);
      
      // 📦 Save tips to the tip jar
      await saveTipsFromAudit(result);
    } catch (error) {
      console.error("Audit error:", error);
      setAuditError(error instanceof Error ? error.message : "Failed to audit diagram");
    } finally {
      setIsAuditing(false);
    }
  }, [nodes, edges, challengeContext, sessionId, onAuditComplete, saveTipsFromAudit]);

  return (
    <div className={cn(
      "flex h-full",
      isFullscreen && "fixed inset-0 z-50 bg-slate-950"
    )}>
      {/* Service Picker Sidebar */}
      <ServicePicker
        onDragStart={onServiceDragStart}
        suggestedServices={challengeContext?.awsServices}
        // Control callbacks
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDuplicate={handleDuplicate}
        onDelete={deleteSelectedNode}
        onSelectAll={handleSelectAll}
        onToggleGrid={() => setShowGrid(prev => !prev)}
        onZoomIn={() => rfZoomIn()}
        onZoomOut={() => rfZoomOut()}
        onFitView={() => fitView()}
        onClear={clearCanvas}
        // Layer controls
        onSendToBack={sendToBack}
        onBringToFront={bringToFront}
        onSendBackward={sendBackward}
        onBringForward={bringForward}
        // Control state
        canUndo={canUndo}
        canRedo={canRedo}
        hasSelection={!!selectedNode}
        showGrid={showGrid}
        zoomLevel={zoomLevel}
        // Text style controls - use live node data from nodes array, not stale selectedNode
        onUpdateTextStyle={handleUpdateTextStyle}
        isTextNodeSelected={selectedNode?.type === "textNode"}
        selectedTextStyle={(() => {
          if (selectedNode?.type !== "textNode") return undefined;
          const liveNode = nodes.find(n => n.id === selectedNode.id);
          if (!liveNode) return undefined;
          return {
            fontSize: liveNode.data?.fontSize as number | undefined,
            fontFamily: liveNode.data?.fontFamily as "sans" | "serif" | "mono" | undefined,
            fontWeight: liveNode.data?.fontWeight as "normal" | "bold" | undefined,
            fontStyle: liveNode.data?.fontStyle as "normal" | "italic" | undefined,
            textDecoration: liveNode.data?.textDecoration as "none" | "underline" | "line-through" | undefined,
            textColor: liveNode.data?.textColor as string | undefined,
          };
        })()}
        // Node style controls
        selectedNode={getSelectedNodeInfo()}
      />

      {/* Main Canvas Area */}
      <div className="flex flex-col flex-1">
        {/* Toolbar */}
        <div className="h-10 flex items-center justify-between px-3 border-b border-slate-800 bg-slate-900/80">
          {/* Left side - Fullscreen toggle + Hierarchy panel toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowHierarchyPanel(!showHierarchyPanel)}
              className={cn(
                "p-1.5 rounded hover:bg-slate-800 transition-colors",
                showHierarchyPanel ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
              )}
              title={showHierarchyPanel ? "Hide hierarchy panel" : "Show hierarchy panel"}
            >
              {showHierarchyPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>
            {isFullscreen && (
              <span className="text-xs text-slate-500">Press ESC to exit</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* 🎮 GAMIFICATION: Live Score Display */}
            <div className="flex items-center gap-3 mr-4">
              {/* Points */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-sm font-bold text-white">{diagramScore.totalPoints}</span>
                <span className="text-xs text-slate-400">pts</span>
              </div>
              
              {/* Streak indicator */}
              {diagramScore.currentStreak >= 2 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 animate-pulse">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-bold text-orange-400">{diagramScore.currentStreak}x</span>
                </div>
              )}
              
              {/* Score Animation */}
              {showScoreAnimation && (
                <div
                  className={cn(
                    "absolute top-16 right-48 text-lg font-bold animate-bounce",
                    showScoreAnimation.isPositive ? "text-green-400" : "text-red-400"
                  )}
                >
                  {showScoreAnimation.isPositive ? "+" : ""}{showScoreAnimation.points}
                </div>
              )}
            </div>

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

            {/* 📦 Tip Jar Toggle */}
            {challengeProgressId && (
              <Button
                variant={tipJarOpen ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setTipJarOpen(!tipJarOpen)}
                className="h-8 text-xs gap-1.5"
              >
                <Archive className="w-3.5 h-3.5" />
                Tips
                {storedTips.filter(t => !t.isDismissed).length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px]">
                    {storedTips.filter(t => !t.isDismissed).length}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Canvas + Hierarchy Panel Container */}
        <div className="flex flex-1 overflow-hidden">
          {/* React Flow Canvas */}
          <div ref={reactFlowWrapper} className="flex-1 bg-slate-950 relative">
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
            onNodeDragStop={onNodeDragStop}
            onNodeContextMenu={(e, node) => handleContextMenu(e, node)}
            onPaneContextMenu={(e) => handleContextMenu(e)}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[20, 20]}
            panOnDrag={!isTextEditing}
            zoomOnScroll={!isTextEditing}
            zoomOnPinch={!isTextEditing}
            zoomOnDoubleClick={false}
            elevateNodesOnSelect={false}
            defaultEdgeOptions={{
              type: "smoothstep",
              animated: true,
              style: { stroke: "#22d3ee", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#22d3ee" },
            }}
            className="bg-slate-950"
          >
            {showGrid && (
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color="#334155"
              />
            )}
            {/* Controls removed - now in sidebar */}
          </ReactFlow>
          
          {/* 🖱️ CONTEXT MENU */}
          {contextMenu && (
            <div
              className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50 min-w-[160px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.nodeId ? (
                <>
                  <button
                    onClick={() => { handleCopy(); closeContextMenu(); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                  >
                    <span className="w-4">📋</span> Copy
                    <span className="ml-auto text-slate-500">⌘C</span>
                  </button>
                  <button
                    onClick={() => { handleDuplicate(); closeContextMenu(); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                  >
                    <span className="w-4">📑</span> Duplicate
                    <span className="ml-auto text-slate-500">⌘D</span>
                  </button>
                  <div className="h-px bg-slate-700 my-1" />
                  {/* Layer Controls */}
                  <button
                    onClick={() => { bringToFront(); closeContextMenu(); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                  >
                    <span className="w-4">⬆️</span> Bring to Front
                  </button>
                  <button
                    onClick={() => { bringForward(); closeContextMenu(); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                  >
                    <span className="w-4">🔼</span> Bring Forward
                  </button>
                  <button
                    onClick={() => { sendBackward(); closeContextMenu(); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                  >
                    <span className="w-4">🔽</span> Send Backward
                  </button>
                  <button
                    onClick={() => { sendToBack(); closeContextMenu(); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                  >
                    <span className="w-4">⬇️</span> Send to Back
                  </button>
                  <div className="h-px bg-slate-700 my-1" />
                  <button
                    onClick={() => { deleteSelectedNode(); closeContextMenu(); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-900/30 flex items-center gap-2"
                  >
                    <span className="w-4">🗑️</span> Delete
                    <span className="ml-auto text-slate-500">Del</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { handlePaste(); closeContextMenu(); }}
                    disabled={!clipboard}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="w-4">📋</span> Paste
                    <span className="ml-auto text-slate-500">⌘V</span>
                  </button>
                  <button
                    onClick={() => { handleSelectAll(); closeContextMenu(); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                  >
                    <span className="w-4">☑️</span> Select All
                    <span className="ml-auto text-slate-500">⌘A</span>
                  </button>
                  <div className="h-px bg-slate-700 my-1" />
                  <button
                    onClick={() => { handleUndo(); closeContextMenu(); }}
                    disabled={!canUndo}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="w-4">↩️</span> Undo
                    <span className="ml-auto text-slate-500">⌘Z</span>
                  </button>
                  <button
                    onClick={() => { handleRedo(); closeContextMenu(); }}
                    disabled={!canRedo}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="w-4">↪️</span> Redo
                    <span className="ml-auto text-slate-500">⌘Y</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* 🎮 PRO-TIP TOAST */}
          {proTip && (
            <div
              className={cn(
                "absolute bottom-4 left-1/2 -translate-x-1/2 max-w-lg px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-sm animate-in slide-in-from-bottom-4 duration-300",
                proTip.isError
                  ? "bg-red-950/90 border-red-500/50 text-red-100"
                  : "bg-emerald-950/90 border-emerald-500/50 text-emerald-100"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                  proTip.isError ? "bg-red-500/20" : "bg-emerald-500/20"
                )}>
                  {proTip.isError ? (
                    <X className="w-4 h-4 text-red-400" />
                  ) : (
                    <Lightbulb className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-0.5">
                    {proTip.isError ? "❌ Invalid Placement" : "💡 Pro Tip"}
                  </p>
                  <p className="text-xs opacity-90">{proTip.message}</p>
                </div>
                <button
                  onClick={() => setProTip(null)}
                  className="flex-shrink-0 p-1 hover:bg-white/10 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

          {/* 📊 HIERARCHY PANEL - Right side tree view */}
          {showHierarchyPanel && (
            <DiagramHierarchyPanel
              nodes={nodes as DiagramNode[]}
              selectedNodeId={selectedNode?.id || null}
              onNodeSelect={(nodeId) => {
                const node = nodes.find(n => n.id === nodeId);
                if (node) setSelectedNode(node);
              }}
              onNodeFocus={(nodeId) => {
                const node = nodes.find(n => n.id === nodeId);
                if (node) {
                  setSelectedNode(node);
                  // Center view on node
                  fitView({ nodes: [node], duration: 300, padding: 0.5 });
                }
              }}
              className="w-64 flex-shrink-0"
            />
          )}
        </div>

        {/* Audit Feedback Panel */}
        {(auditResult || auditError) && (
          <div className="border-t border-slate-800 bg-slate-900/80 p-4 max-h-48 overflow-y-auto">
            {auditError ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{auditError}</span>
                </div>
                <button
                  onClick={() => setAuditError(null)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : auditResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-slate-200">Audit Results</h4>
                  <div className="flex items-center gap-2">
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
                    <button
                      onClick={() => setAuditResult(null)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300"
                      title="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
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

        {/* 📦 Tip Jar Panel - Shows all stored tips for this challenge */}
        {tipJarOpen && (
          <div className="border-t border-slate-800 bg-slate-900/95 max-h-64 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-medium text-slate-200">Tip Jar</h4>
                <span className="text-xs text-slate-500">
                  ({storedTips.filter(t => !t.isDismissed).length} active)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Filter buttons */}
                <div className="flex gap-1">
                  {(["all", "correct", "missing", "suggestion"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setTipJarFilter(filter)}
                      className={cn(
                        "px-2 py-0.5 text-xs rounded",
                        tipJarFilter === filter
                          ? "bg-cyan-500/20 text-cyan-400"
                          : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                      )}
                    >
                      {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setTipJarOpen(false)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {isLoadingTips ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                </div>
              ) : storedTips.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  No tips yet. Run an audit to get feedback!
                </p>
              ) : (
                storedTips
                  .filter((tip) => {
                    if (tipJarFilter === "all") return !tip.isDismissed;
                    return tip.category === tipJarFilter && !tip.isDismissed;
                  })
                  .map((tip) => (
                    <div
                      key={tip.id}
                      className={cn(
                        "p-2 rounded-lg border text-xs",
                        tip.category === "correct" && "bg-green-500/10 border-green-500/30",
                        tip.category === "missing" && "bg-amber-500/10 border-amber-500/30",
                        tip.category === "suggestion" && "bg-cyan-500/10 border-cyan-500/30",
                        tip.category === "feedback" && "bg-slate-800 border-slate-700"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <span
                            className={cn(
                              "text-[10px] font-medium uppercase",
                              tip.category === "correct" && "text-green-400",
                              tip.category === "missing" && "text-amber-400",
                              tip.category === "suggestion" && "text-cyan-400",
                              tip.category === "feedback" && "text-slate-400"
                            )}
                          >
                            {tip.category}
                          </span>
                          <p className="text-slate-300 mt-0.5">{tip.content}</p>
                          <p className="text-slate-600 text-[10px] mt-1">
                            Score: {tip.auditScore}/100 • {new Date(tip.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => markTipHelpful(tip.id, true)}
                            className={cn(
                              "p-1 rounded hover:bg-white/10",
                              tip.isHelpful === true ? "text-green-400" : "text-slate-600"
                            )}
                            title="Helpful"
                          >
                            <ThumbsUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => markTipHelpful(tip.id, false)}
                            className={cn(
                              "p-1 rounded hover:bg-white/10",
                              tip.isHelpful === false ? "text-red-400" : "text-slate-600"
                            )}
                            title="Not helpful"
                          >
                            <ThumbsDown className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => dismissTip(tip.id)}
                            className="p-1 rounded hover:bg-white/10 text-slate-600 hover:text-slate-400"
                            title="Dismiss"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteTip(tip.id)}
                            className="p-1 rounded hover:bg-white/10 text-slate-600 hover:text-red-400"
                            title="Delete permanently"
                          >
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
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
