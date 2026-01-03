"use client";

/**
 * Architect Arena Game
 * 
 * AI generates puzzle pieces (AWS services) that are pre-placed on canvas.
 * User repositions them to build correct architecture. AI judges the result.
 * 
 * Uses same React Flow setup and nodeTypes as diagram-canvas.tsx but WITHOUT
 * the sidebar and toolbar - just the canvas.
 */

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  MarkerType,
  ReactFlowProvider,
  Controls,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "@/components/diagram/aws-nodes";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Trophy,
  RotateCcw,
  Clock,
  Loader2,
  Sparkles,
  Puzzle,
  Send,
  Home,
  CheckCircle2,
  Trash2,
  Undo2,
  Redo2,
  Layers,
  ArrowUpToLine,
  ArrowDownToLine,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PuzzlePiecesPanel } from "@/components/game/puzzle-pieces-panel";

// Types matching the backend puzzle
interface PuzzlePiece {
  id: string;
  service_id: string;
  label: string;
  sublabel?: string;
  hint?: string;
  required: boolean;
  category: string;
}

interface Puzzle {
  id: string;
  title: string;
  brief: string;
  difficulty: string;
  time_limit_seconds: number;
  target_score: number;
  pieces: PuzzlePiece[];
  expected_connections: Array<{
    from_piece: string;
    to_piece: string;
    description: string;
    required: boolean;
  }>;
  expected_hierarchy: Record<string, string[]>;
  objectives: Array<{ id: string; text: string; points: number }>;
  penalties: Array<{ id: string; text: string; points: number }>;
  aws_services: string[];
  topics: string[];
}

interface AuditResult {
  score: number;
  correct: string[];
  missing: string[];
  suggestions: string[];
  feedback: string;
}

type GameStatus = "idle" | "loading" | "playing" | "submitting" | "finished";

// Determine the correct React Flow node type based on service_id
function getNodeType(serviceId: string): string {
  // Service containers
  if (serviceId === "vpc") return "vpc";
  if (serviceId === "subnet-public" || serviceId === "subnet-private") return "subnet";
  if (serviceId === "security-group") return "securityGroup";
  if (serviceId === "auto-scaling") return "autoScaling";
  // AWS Boundaries
  if (serviceId === "aws-cloud") return "awsCloud";
  if (serviceId === "region") return "region";
  if (serviceId === "availability-zone") return "availabilityZone";
  // General Icons (external actors)
  if (serviceId.startsWith("icon-")) return "genericIcon";
  return "awsResource";
}

// Get subnet type for subnet nodes
function getSubnetType(serviceId: string): "public" | "private" | undefined {
  if (serviceId === "subnet-public") return "public";
  if (serviceId === "subnet-private") return "private";
  return undefined;
}

// Container sizes for VPC, subnets, boundaries, etc.
const containerSizes: Record<string, { width: number; height: number }> = {
  // Service containers
  vpc: { width: 600, height: 400 },
  subnet: { width: 250, height: 180 },
  securityGroup: { width: 180, height: 120 },
  autoScaling: { width: 150, height: 100 },
  // AWS Boundaries
  awsCloud: { width: 700, height: 500 },
  region: { width: 550, height: 400 },
  availabilityZone: { width: 300, height: 220 },
};

// Z-index hierarchy for proper layering (lower = further back, higher = in front)
// Matches diagram-canvas.tsx so containers don't cover child nodes
// Using negative values ensures containers stay behind their children
const containerZIndex: Record<string, number> = {
  // AWS Boundaries (furthest back)
  awsCloud: -80,
  region: -70,
  availabilityZone: -60,
  // Service containers
  vpc: -50,
  subnet: -40,
  securityGroup: -30,
  autoScaling: -20,
};
const DEFAULT_SERVICE_ZINDEX = 10; // Regular services always on top

// Container node types that can have children
const CONTAINER_TYPES = new Set([
  "vpc", "subnet", "securityGroup", "autoScaling",
  "awsCloud", "region", "availabilityZone"
]);

// Icon mapping for general icons (external actors)
const ICON_EMOJIS: Record<string, string> = {
  "icon-user": "👤",
  "icon-users": "👥",
  "icon-mobile": "📱",
  "icon-laptop": "💻",
  "icon-desktop": "🖥️",
  "icon-internet": "🌐",
  "icon-cloud": "☁️",
  "icon-corporate": "🏢",
  "icon-onprem": "🏭",
  "icon-server": "🗄️",
  "icon-database": "💾",
  "icon-security": "🔒",
};

// Base z-index values by node type (matches diagram-canvas.tsx)
const BASE_ZINDEX: Record<string, number> = {
  // Organizational boundaries (furthest back)
  orgNode: -100,
  accountNode: -90,
  awsCloud: -80,
  region: -70,
  availabilityZone: -60,
  // Service containers
  vpc: -50,
  subnet: -40,
  securityGroup: -30,
  autoScaling: -20,
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

// Helper: Sort nodes so parents come before children (required by React Flow)
function sortNodesForReactFlow(nodes: Node[]): Node[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const sorted: Node[] = [];
  const visited = new Set<string>();
  
  function visit(node: Node) {
    if (visited.has(node.id)) return;
    
    // If this node has a parent, visit the parent first
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        visit(parent);
      } else {
        // Parent doesn't exist - remove the invalid parentId reference
        node = { ...node, parentId: undefined };
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

// Calculate proper z-index for a node based on its hierarchy
function calculateZIndex(node: Node, allNodes: Node[]): number {
  const nodeType = node.type || 'awsResource';
  let zIndex = BASE_ZINDEX[nodeType] ?? 10;
  
  // If this node has children, ensure it stays behind them
  const hasChildren = allNodes.some(n => n.parentId === node.id);
  if (hasChildren) {
    // Find the minimum z-index of children and stay below it
    const childrenZIndices = allNodes
      .filter(n => n.parentId === node.id)
      .map(child => calculateZIndex(child, allNodes));
    
    if (childrenZIndices.length > 0) {
      const minChildZ = Math.min(...childrenZIndices);
      zIndex = Math.min(zIndex, minChildZ - 1);
    }
  }
  
  return zIndex;
}

// Convert a single puzzle piece to a React Flow node at a given position
function puzzlePieceToNode(piece: PuzzlePiece, position: { x: number; y: number }): Node {
  const nodeType = getNodeType(piece.service_id);
  const size = containerSizes[nodeType];
  
  // For subnets, use simple labels
  let displayLabel = piece.label;
  if (piece.service_id === "vpc") {
    displayLabel = "VPC";
  } else if (piece.service_id.startsWith("subnet-")) {
    const subnetType = getSubnetType(piece.service_id);
    displayLabel = subnetType === "public" ? "Public" : "Private";
  }
  
  // Determine z-index: containers get lower values, services get higher
  const isContainer = !!size;
  const zIndex = containerZIndex[nodeType] ?? (isContainer ? 0 : DEFAULT_SERVICE_ZINDEX);
  
  // Build node data based on type
  const nodeData: Record<string, unknown> = {
    serviceId: piece.service_id,
    label: displayLabel,
    color: getCategoryColor(piece.category),
  };
  
  // Add type-specific data
  if (piece.service_id.startsWith("subnet-")) {
    nodeData.subnetType = getSubnetType(piece.service_id);
  }
  if (piece.service_id.startsWith("icon-")) {
    nodeData.icon = ICON_EMOJIS[piece.service_id] || "❓";
  }
  
  return {
    id: piece.id,
    type: nodeType,
    position,
    style: size ? { width: size.width, height: size.height } : undefined,
    data: nodeData,
    draggable: true,
    zIndex,
  };
}

// Get color based on category (matching aws-services.ts)
function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    networking: "#3b82f6",
    compute: "#f97316",
    containers: "#8b5cf6",
    database: "#6366f1",
    storage: "#22c55e",
    security: "#ef4444",
    integration: "#ec4899",
    analytics: "#eab308",
    management: "#64748b",
    devops: "#14b8a6",
  };
  return colors[category] || "#22d3ee";
}

function ArchitectArenaGame() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: authStatus } = useSession();
  
  // Get difficulty from URL query param (from lobby)
  const difficulty = searchParams.get("difficulty") || "medium";

  // Game state - start loading immediately
  const [gameStatus, setGameStatus] = useState<GameStatus>("loading");
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [timerStarted, setTimerStarted] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [finalScore, setFinalScore] = useState(0);

  // React Flow state - same pattern as diagram-canvas.tsx
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasStarted = useRef(false);

  // Node selection state
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'node' | 'edge' | 'pane'; targetId?: string } | null>(null);

  // Track if user has manually adjusted z-indices (disables auto-recalculation)
  const manualZIndexAdjustment = useRef(false);

  // Undo/Redo state
  type HistoryState = { nodes: Node[]; edges: Edge[] };
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);

  // Track which pieces have been placed on the canvas
  const placedPieceIds: Set<string> = new Set(nodes.map((n: Node) => n.id));

  // Helper to get absolute position of a node (accounting for nested parents)
  const getAbsolutePosition = useCallback((node: Node, nodeMap: Map<string, Node>): { x: number; y: number } => {
    let absX = node.position.x;
    let absY = node.position.y;
    let currentParentId = node.parentId;
    
    // Walk up the parent chain to get absolute position
    while (currentParentId) {
      const parent = nodeMap.get(currentParentId);
      if (!parent) break;
      absX += parent.position.x;
      absY += parent.position.y;
      currentParentId = parent.parentId;
    }
    
    return { x: absX, y: absY };
  }, []);

  // Find the best container for a node based on position (smallest container that contains it)
  // Returns the container node for relative position calculation - matches diagram-canvas.tsx
  const findContainerAtPosition = useCallback((pos: { x: number; y: number }, excludeId?: string): Node | null => {
    const nodeMap = new Map<string, Node>(nodes.map((n: Node) => [n.id, n]));
    
    // Find containers that contain this position (check from smallest to largest)
    const containers = nodes
      .filter((n: Node) => CONTAINER_TYPES.has(n.type as string) && n.id !== excludeId)
      .filter((n: Node) => {
        // Get absolute position of container (accounting for nested parents)
        const absPos = getAbsolutePosition(n, nodeMap);
        const nodeWidth = (n.style?.width as number) || (n.measured?.width) || containerSizes[n.type as string]?.width || 200;
        const nodeHeight = (n.style?.height as number) || (n.measured?.height) || containerSizes[n.type as string]?.height || 150;
        return (
          pos.x >= absPos.x &&
          pos.x <= absPos.x + nodeWidth &&
          pos.y >= absPos.y &&
          pos.y <= absPos.y + nodeHeight
        );
      })
      // Sort by area (smallest first - most specific container)
      .sort((a: Node, b: Node) => {
        const aWidth = (a.style?.width as number) || containerSizes[a.type as string]?.width || 200;
        const aHeight = (a.style?.height as number) || containerSizes[a.type as string]?.height || 150;
        const bWidth = (b.style?.width as number) || containerSizes[b.type as string]?.width || 200;
        const bHeight = (b.style?.height as number) || containerSizes[b.type as string]?.height || 150;
        return (aWidth * aHeight) - (bWidth * bHeight);
      });
    
    return containers[0] || null;
  }, [nodes, getAbsolutePosition]);

  // Handle node changes and update parentId based on position
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodesChange = useCallback((changes: any[]) => {
    // After position changes (drag end), update parentIds and convert to relative positions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const positionChanges = changes.filter((c: any) => c.type === "position" && c.dragging === false);
    
    if (positionChanges.length === 0) {
      // No drag-end changes, just apply normally
      onNodesChange(changes);
      return;
    }

    // For drag-end, we need to handle parent assignment ourselves
    setNodes((currentNodes: Node[]) => {
      // First, apply the position changes from React Flow
      const updatedNodes = [...currentNodes];
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          const idx = updatedNodes.findIndex(n => n.id === change.id);
          if (idx !== -1) {
            updatedNodes[idx] = { ...updatedNodes[idx], position: change.position };
          }
        }
      }
      
      // Build a map for quick lookup (with updated positions)
      const nodeMap = new Map<string, Node>(updatedNodes.map((n: Node) => [n.id, n]));
      
      // Helper to get absolute position of a node (accounting for nested parents)
      const getAbsPos = (node: Node): { x: number; y: number } => {
        let absX = node.position.x;
        let absY = node.position.y;
        let currentParentId = node.parentId;
        while (currentParentId) {
          const parent = nodeMap.get(currentParentId);
          if (!parent) break;
          absX += parent.position.x;
          absY += parent.position.y;
          currentParentId = parent.parentId;
        }
        return { x: absX, y: absY };
      };
      
      // Helper to find container at absolute position (using updated node positions)
      const findContainer = (pos: { x: number; y: number }, excludeId?: string): { node: Node; absPos: { x: number; y: number } } | null => {
        const containersWithAbsPos = updatedNodes
          .filter((n: Node) => CONTAINER_TYPES.has(n.type as string) && n.id !== excludeId)
          .map((n: Node) => ({ node: n, absPos: getAbsPos(n) }))
          .filter(({ node: n, absPos }) => {
            const nodeWidth = (n.style?.width as number) || (n.measured?.width) || containerSizes[n.type as string]?.width || 200;
            const nodeHeight = (n.style?.height as number) || (n.measured?.height) || containerSizes[n.type as string]?.height || 150;
            return (
              pos.x >= absPos.x &&
              pos.x <= absPos.x + nodeWidth &&
              pos.y >= absPos.y &&
              pos.y <= absPos.y + nodeHeight
            );
          })
          .sort((a, b) => {
            const aWidth = (a.node.style?.width as number) || containerSizes[a.node.type as string]?.width || 200;
            const aHeight = (a.node.style?.height as number) || containerSizes[a.node.type as string]?.height || 150;
            const bWidth = (b.node.style?.width as number) || containerSizes[b.node.type as string]?.width || 200;
            const bHeight = (b.node.style?.height as number) || containerSizes[b.node.type as string]?.height || 150;
            return (aWidth * aHeight) - (bWidth * bHeight);
          });
        return containersWithAbsPos[0] || null;
      };
      
      // Now update parentIds for nodes that were dragged
      return updatedNodes.map((node: Node) => {
        const change = positionChanges.find(c => c.id === node.id);
        if (!change) return node;
        
        // Don't set parent for container nodes themselves
        if (CONTAINER_TYPES.has(node.type as string)) return node;
        
        // Get the node's absolute position on canvas
        const absolutePos = getAbsPos(node);
        
        // Find the container at this absolute position
        const containerResult = findContainer(absolutePos, node.id);
        const newParentId = containerResult?.node.id;
        
        // If parent hasn't changed, no update needed
        if (newParentId === node.parentId) return node;
        
        // Calculate new position (relative to new parent, or absolute if no parent)
        let newPosition = absolutePos;
        if (containerResult) {
          // Convert to relative position within the new parent (use container's absolute position)
          newPosition = {
            x: absolutePos.x - containerResult.absPos.x,
            y: absolutePos.y - containerResult.absPos.y,
          };
        }
        
        return { ...node, parentId: newParentId, position: newPosition };
      });
    });
  }, [onNodesChange, setNodes]);

  // Handle connections - same as diagram-canvas.tsx
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        id: `e-${params.source}-${params.target}`,
        source: params.source || "",
        target: params.target || "",
        type: "smoothstep",
        animated: true,
        style: { stroke: "#22d3ee", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#22d3ee" },
      };
      setEdges((eds: Edge[]) => [...eds, newEdge]);
    },
    [setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  // Handle edge selection (click to select, then can delete)
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setContextMenu(null);
  }, []);

  // Delete selected edge
  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdge) return;
    setEdges((eds: Edge[]) => eds.filter(e => e.id !== selectedEdge.id));
    setSelectedEdge(null);
  }, [selectedEdge, setEdges]);

  // Delete edge by ID (for context menu)
  const deleteEdgeById = useCallback((edgeId: string) => {
    setEdges((eds: Edge[]) => eds.filter(e => e.id !== edgeId));
    setSelectedEdge(null);
    setContextMenu(null);
  }, [setEdges]);

  // Context menu handlers
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setSelectedNode(node);
    setSelectedEdge(null);
    setContextMenu({ x: event.clientX, y: event.clientY, type: 'node', targetId: node.id });
  }, []);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setSelectedEdge(edge);
    setSelectedNode(null);
    setContextMenu({ x: event.clientX, y: event.clientY, type: 'edge', targetId: edge.id });
  }, []);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, type: 'pane' });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Recalculate all z-indices based on hierarchy
  const recalculateZIndices = useCallback(() => {
    setNodes((nds: Node[]) => {
      const updatedNodes = nds.map((node: Node) => {
        const newZIndex = calculateZIndex(node, nds);
        return { ...node, zIndex: newZIndex };
      });
      return sortNodesForReactFlow(updatedNodes);
    });
  }, [setNodes]);

  // Recalculate z-indices when nodes change (but not if user has manually adjusted)
  useEffect(() => {
    if (manualZIndexAdjustment.current) return;
    if (nodes.length === 0) return;
    
    const timer = setTimeout(() => {
      recalculateZIndices();
    }, 100);
    return () => clearTimeout(timer);
  }, [nodes.length, recalculateZIndices]);

  // Close context menu on click elsewhere
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [closeContextMenu]);

  // Layer controls - Send to Back
  const sendToBack = useCallback(() => {
    if (!selectedNode) return;
    manualZIndexAdjustment.current = true;
    
    setNodes((nds: Node[]) => {
      const selectedNodeData = nds.find(n => n.id === selectedNode.id);
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
          return { ...n, zIndex: minZ - 1 };
        }
        return n;
      });
    });
  }, [selectedNode, setNodes]);

  // Layer controls - Bring to Front
  const bringToFront = useCallback(() => {
    if (!selectedNode) return;
    manualZIndexAdjustment.current = true;
    
    setNodes((nds: Node[]) => {
      const selectedNodeData = nds.find(n => n.id === selectedNode.id);
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
          return { ...n, zIndex: maxZ + 1 };
        }
        return n;
      });
    });
  }, [selectedNode, setNodes]);

  // Layer controls - Send Backward (one level)
  const sendBackward = useCallback(() => {
    if (!selectedNode) return;
    manualZIndexAdjustment.current = true;
    
    setNodes((nds: Node[]) => {
      const selectedNodeData = nds.find(n => n.id === selectedNode.id);
      if (!selectedNodeData) return nds;
      
      const currentZ = selectedNodeData.zIndex ?? 0;
      
      // Get siblings
      const siblings = nds.filter(n => {
        const isSibling = n.parentId === selectedNodeData.parentId;
        const notSelf = n.id !== selectedNode.id;
        return isSibling && notSelf;
      });
      
      // Find the next lower z-index among siblings
      const lowerSiblings = siblings.filter(n => (n.zIndex ?? 0) < currentZ);
      if (lowerSiblings.length === 0) return nds;
      
      const targetZ = Math.max(...lowerSiblings.map(n => n.zIndex ?? 0));
      
      return nds.map(n => {
        if (n.id === selectedNode.id) {
          return { ...n, zIndex: targetZ - 0.5 };
        }
        return n;
      });
    });
  }, [selectedNode, setNodes]);

  // Layer controls - Bring Forward (one level)
  const bringForward = useCallback(() => {
    if (!selectedNode) return;
    manualZIndexAdjustment.current = true;
    
    setNodes((nds: Node[]) => {
      const selectedNodeData = nds.find(n => n.id === selectedNode.id);
      if (!selectedNodeData) return nds;
      
      const currentZ = selectedNodeData.zIndex ?? 0;
      
      // Get siblings
      const siblings = nds.filter(n => {
        const isSibling = n.parentId === selectedNodeData.parentId;
        const notSelf = n.id !== selectedNode.id;
        return isSibling && notSelf;
      });
      
      // Find the next higher z-index among siblings
      const higherSiblings = siblings.filter(n => (n.zIndex ?? 0) > currentZ);
      if (higherSiblings.length === 0) return nds;
      
      const targetZ = Math.min(...higherSiblings.map(n => n.zIndex ?? 0));
      
      return nds.map(n => {
        if (n.id === selectedNode.id) {
          return { ...n, zIndex: targetZ + 0.5 };
        }
        return n;
      });
    });
  }, [selectedNode, setNodes]);

  // Undo/Redo - Save state to history
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
    if (gameStatus !== "playing") return;
    const timeout = setTimeout(() => {
      saveToHistory();
    }, 500); // Debounce
    return () => clearTimeout(timeout);
  }, [nodes, edges, saveToHistory, gameStatus]);

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

  // Fetch puzzle from API
  const fetchPuzzle = useCallback(async () => {
    setGameStatus("loading");
    setLoadError(null);
    setAuditResult(null);

    try {
      const response = await fetch("/api/gaming/architect-arena/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 402) {
          setLoadError("Please configure your OpenAI API key in Settings to play.");
        } else if (response.status === 400) {
          setLoadError("Please set your target AWS certification in Settings.");
        } else {
          setLoadError(errorData.error || "Failed to generate puzzle");
        }
        setGameStatus("idle");
        return;
      }

      const data = await response.json();
      if (data.success && data.puzzle) {
        setPuzzle(data.puzzle);
        setTimeLeft(data.puzzle.time_limit_seconds || 300);

        // Convert puzzle pieces to React Flow nodes
        // Start with empty canvas - pieces are in the sidebar panel
        setNodes([]);
        setEdges([]);

        setGameStatus("playing");
      } else {
        setLoadError(data.error || "Failed to generate puzzle");
        setGameStatus("idle");
      }
    } catch (error) {
      console.error("Failed to fetch puzzle:", error);
      setLoadError("Network error. Please try again.");
      setGameStatus("idle");
    }
  }, [setNodes, setEdges, difficulty]);

  // Handle drag start from pieces panel
  const handlePieceDragStart = useCallback((event: React.DragEvent, piece: PuzzlePiece) => {
    event.dataTransfer.setData("application/puzzle-piece", JSON.stringify(piece));
    event.dataTransfer.effectAllowed = "move";
  }, []);

  // Handle drop on canvas - with container detection like diagram-canvas.tsx
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      // Prevent dropping pieces until timer has started (anti-cheat)
      if (!timerStarted) return;

      const pieceData = event.dataTransfer.getData("application/puzzle-piece");
      if (!pieceData) return;

      const piece: PuzzlePiece = JSON.parse(pieceData);
      
      // Check if already placed
      if (nodes.some((n: Node) => n.id === piece.id)) return;

      // Get position relative to the flow (properly handles zoom/pan)
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Check if dropping inside a container (like diagram-canvas.tsx)
      const nodeType = getNodeType(piece.service_id);
      const isContainerNode = CONTAINER_TYPES.has(nodeType);
      
      let parentId: string | undefined;
      let finalPosition = position;
      
      // Only non-container nodes can be nested inside containers
      if (!isContainerNode) {
        const container = findContainerAtPosition(position);
        if (container) {
          parentId = container.id;
          // Calculate container's absolute position (accounting for nested parents)
          const nodeMap = new Map<string, Node>(nodes.map((n: Node) => [n.id, n]));
          let containerAbsX = container.position.x;
          let containerAbsY = container.position.y;
          let currentParentId = container.parentId;
          while (currentParentId) {
            const parent = nodeMap.get(currentParentId);
            if (!parent) break;
            containerAbsX += parent.position.x;
            containerAbsY += parent.position.y;
            currentParentId = parent.parentId;
          }
          // Calculate position relative to container's absolute position
          finalPosition = {
            x: position.x - containerAbsX,
            y: position.y - containerAbsY,
          };
        }
      }

      const newNode = puzzlePieceToNode(piece, finalPosition);
      // Add parentId if dropping inside a container
      if (parentId) {
        newNode.parentId = parentId;
      }
      
      setNodes((nds: Node[]) => [...nds, newNode]);
    },
    [nodes, setNodes, findContainerAtPosition, timerStarted, screenToFlowPosition]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Submit for AI audit
  const submitPuzzle = useCallback(async () => {
    if (!puzzle) return;

    setGameStatus("submitting");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Log what we're sending for debugging
    console.log("[Architect Arena] Submitting puzzle:", {
      nodesCount: nodes.length,
      edgesCount: edges.length,
      nodes: nodes.map((n: Node) => ({ id: n.id, type: n.type, serviceId: n.data?.serviceId })),
      edges: edges.map((e: Edge) => ({ source: e.source, target: e.target })),
    });

    try {
      // Build payload matching the format the agent expects
      const payload = {
        puzzle_id: puzzle.id,
        puzzle_title: puzzle.title,
        puzzle_brief: puzzle.brief,
        expected_hierarchy: puzzle.expected_hierarchy,
        expected_connections: puzzle.expected_connections,
        nodes: nodes.map((n: Node) => ({
          id: n.id,
          type: n.data?.serviceId || n.type, // Use serviceId as type like diagram-canvas
          service_id: n.data?.serviceId,
          label: n.data?.label,
          position: n.position,
          parentId: n.parentId,
        })),
        connections: edges.map((e: Edge) => ({
          from: e.source, // Match diagram-canvas format
          to: e.target,
          source: e.source, // Keep both for compatibility
          target: e.target,
        })),
      };

      console.log("[Architect Arena] Payload:", JSON.stringify(payload, null, 2));

      const response = await fetch("/api/gaming/architect-arena/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        setAuditResult(result);
        setFinalScore(result.score || 0);
      } else {
        // Show error state instead of fake score
        setAuditResult({
          score: 0,
          correct: [],
          missing: ["Failed to evaluate your submission"],
          suggestions: ["Please try again or check your connection"],
          feedback: "We couldn't evaluate your architecture. Your work was not lost - try submitting again.",
        });
        setFinalScore(0);
      }
    } catch (error) {
      console.error("Audit failed:", error);
      setAuditResult({
        score: 0,
        correct: [],
        missing: ["Network error during evaluation"],
        suggestions: ["Check your internet connection and try again"],
        feedback: "We couldn't reach the evaluation server. Please try submitting again.",
      });
      setFinalScore(0);
    }

    setGameStatus("finished");
  }, [puzzle, nodes, edges]);

  // Auto-generate puzzle on mount
  useEffect(() => {
    if (!hasStarted.current && authStatus === "authenticated") {
      hasStarted.current = true;
      // Use setTimeout to avoid the setState-in-effect lint warning
      setTimeout(() => {
        fetchPuzzle();
      }, 0);
    }
  }, [authStatus, fetchPuzzle]);

  // Timer effect - only runs when timerStarted is true
  useEffect(() => {
    if (gameStatus !== "playing" || !timerStarted) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          submitPuzzle();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStatus, timerStarted, submitPuzzle]);

  // Start the timer
  const startTimer = useCallback(() => {
    setTimerStarted(true);
  }, []);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Auth check
  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden">

      {/* ERROR STATE */}
      {gameStatus === "idle" && loadError && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <Puzzle className="w-24 h-24 text-red-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-4">Failed to Load Puzzle</h1>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-left">
              <p className="text-red-400 text-sm">{loadError}</p>
            </div>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => router.push("/game")}>
                Back to Hub
              </Button>
              <Button
                onClick={fetchPuzzle}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LOADING STATE */}
      {gameStatus === "loading" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-cyan-500 mx-auto mb-4 animate-spin" />
            <p className="text-slate-400">Generating your puzzle...</p>
            <p className="text-slate-500 text-sm mt-2">Generating pieces based on your certification</p>
          </div>
        </div>
      )}

      {/* PLAYING STATE - Info Panel + Pieces Panel + Canvas */}
      {gameStatus === "playing" && puzzle && (
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT SIDEBAR - Brief, Objectives, Penalties, Score */}
          <div className="w-[240px] border-r border-slate-800 bg-slate-900/50 flex flex-col overflow-hidden shrink-0">
            {/* Header with Exit and Timer */}
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <Link
                href="/game"
                className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Exit
              </Link>
              <div
                className={cn(
                  "flex items-center gap-1.5 font-mono text-sm font-bold",
                  !timerStarted ? "text-slate-500" : timeLeft <= 30 ? "text-red-500 animate-pulse" : "text-white"
                )}
              >
                <Clock className="w-4 h-4" />
                {timerStarted ? formatTime(timeLeft) : "Paused"}
              </div>
            </div>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto">
              {/* How to Play */}
              <div className="p-3 border-b border-slate-800 bg-cyan-500/5">
                <h3 className="text-xs text-cyan-400 uppercase tracking-wider mb-2">How to Play</h3>
                <ol className="text-[11px] text-slate-400 space-y-1 list-decimal list-inside">
                  <li><strong className="text-slate-300">Drag pieces</strong> from the right panel onto the canvas</li>
                  <li><strong className="text-slate-300">Connect services</strong> by dragging from node handles to show data flow</li>
                  <li><strong className="text-slate-300">Nest if needed</strong> - place EC2 inside Subnets, Subnets inside VPCs</li>
                  <li><strong className="text-slate-300">Submit</strong> when done - AI will score your architecture</li>
                </ol>
              </div>

              {/* Puzzle Brief */}
              <div className="p-3 border-b border-slate-800">
                <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Brief</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{puzzle.brief}</p>
              </div>

              {/* Objectives */}
              <div className="p-3 border-b border-slate-800">
                <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Objectives</h3>
                <div className="space-y-1.5">
                  {puzzle.objectives.map((obj) => (
                    <div key={obj.id} className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="text-slate-400 flex-1">{obj.text}</span>
                      <span className="text-cyan-400">+{obj.points}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Penalties */}
              <div className="p-3 border-b border-slate-800">
                <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Penalties</h3>
                <div className="space-y-1.5">
                  {puzzle.penalties.map((pen) => (
                    <div key={pen.id} className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 text-red-400 shrink-0">⚠</span>
                      <span className="text-red-300 flex-1">{pen.text}</span>
                      <span className="text-red-400">{pen.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Progress - Fixed at bottom */}
            <div className="p-3 bg-slate-900 border-t border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 uppercase">Progress</span>
                <span className="text-xs text-slate-500">Target: {puzzle.target_score} pts</span>
              </div>
              <div className="space-y-1.5 mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Pieces placed</span>
                  <span className={nodes.length === puzzle.pieces.length ? "text-green-400" : "text-cyan-400"}>
                    {nodes.length}/{puzzle.pieces.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Connections</span>
                  <span className="text-cyan-400">{edges.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Nested in containers</span>
                  <span className="text-cyan-400">{nodes.filter((n: Node) => n.parentId).length}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-600 mt-2 italic">Final score determined by AI audit</p>
            </div>

            {/* Start/Submit Button */}
            <div className="p-3 border-t border-slate-800">
              {!timerStarted ? (
                <Button
                  onClick={startTimer}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 gap-2"
                >
                  <Clock className="w-4 h-4" />
                  Start Timer
                </Button>
              ) : (
                <Button
                  onClick={submitPuzzle}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 gap-2"
                >
                  <Send className="w-4 h-4" />
                  Submit
                </Button>
              )}
            </div>
          </div>

          {/* CANVAS - Middle, blank workspace */}
          <div 
            ref={reactFlowWrapper} 
            className="flex-1 bg-slate-950"
            onDrop={onDrop}
            onDragOver={onDragOver}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onPaneClick={onPaneClick}
              onNodeContextMenu={onNodeContextMenu}
              onEdgeContextMenu={onEdgeContextMenu}
              onPaneContextMenu={onPaneContextMenu}
              nodeTypes={nodeTypes}
              fitView
              snapToGrid
              snapGrid={[20, 20]}
              edgesUpdatable
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
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
              <Controls className="!bg-slate-800 !border-slate-700 !rounded-lg [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button]:!text-white [&>button:hover]:!bg-slate-600" />
              
              {/* Toolbar for selected node and undo/redo */}
              <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                {/* Undo/Redo */}
                <div className="flex items-center gap-1 bg-slate-800/90 rounded-lg p-1 border border-slate-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className="h-7 w-7 p-0 text-slate-400 hover:text-white disabled:opacity-30"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRedo}
                    disabled={!canRedo}
                    className="h-7 w-7 p-0 text-slate-400 hover:text-white disabled:opacity-30"
                    title="Redo (Ctrl+Y)"
                  >
                    <Redo2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Layer controls - only show when node selected */}
                {selectedNode && (
                  <div className="flex items-center gap-1 bg-slate-800/90 rounded-lg p-1 border border-slate-700">
                    <span className="text-[10px] text-slate-500 px-1.5">
                      <Layers className="w-3 h-3 inline mr-1" />
                      Layer
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={sendToBack}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                      title="Send to Back"
                    >
                      <ArrowDownToLine className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={sendBackward}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                      title="Send Backward"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={bringForward}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                      title="Bring Forward"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={bringToFront}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                      title="Bring to Front"
                    >
                      <ArrowUpToLine className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Edge delete - show when edge selected */}
                {selectedEdge && (
                  <div className="flex items-center gap-1 bg-slate-800/90 rounded-lg p-1 border border-slate-700">
                    <span className="text-[10px] text-cyan-400 px-1.5">
                      Connection selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={deleteSelectedEdge}
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                      title="Delete Connection"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </ReactFlow>

            {/* Context Menu */}
            {contextMenu && (
              <div
                className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50 min-w-[140px]"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onClick={(e) => e.stopPropagation()}
              >
                {contextMenu.type === 'edge' && contextMenu.targetId && (
                  <button
                    onClick={() => deleteEdgeById(contextMenu.targetId!)}
                    className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-900/30 flex items-center gap-2"
                  >
                    <Trash2 className="w-3 h-3" /> Delete Connection
                  </button>
                )}
                {contextMenu.type === 'node' && (
                  <>
                    <button
                      onClick={() => { bringToFront(); closeContextMenu(); }}
                      className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                    >
                      <ArrowUpToLine className="w-3 h-3" /> Bring to Front
                    </button>
                    <button
                      onClick={() => { sendToBack(); closeContextMenu(); }}
                      className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                    >
                      <ArrowDownToLine className="w-3 h-3" /> Send to Back
                    </button>
                  </>
                )}
                {contextMenu.type === 'pane' && (
                  <>
                    <button
                      onClick={() => { handleUndo(); closeContextMenu(); }}
                      disabled={!canUndo}
                      className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2 disabled:opacity-40"
                    >
                      <Undo2 className="w-3 h-3" /> Undo
                    </button>
                    <button
                      onClick={() => { handleRedo(); closeContextMenu(); }}
                      disabled={!canRedo}
                      className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2 disabled:opacity-40"
                    >
                      <Redo2 className="w-3 h-3" /> Redo
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR - Categorized puzzle pieces */}
          <div className="w-[220px] border-l border-slate-800 shrink-0">
            <PuzzlePiecesPanel
              pieces={puzzle.pieces}
              placedPieceIds={placedPieceIds}
              onDragStart={handlePieceDragStart}
            />
          </div>
        </div>
      )}

      {/* SUBMITTING STATE */}
      {gameStatus === "submitting" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Sparkles className="w-16 h-16 text-cyan-500 mx-auto mb-4 animate-pulse" />
            <p className="text-xl text-slate-300 mb-2">Evaluating your architecture...</p>
            <p className="text-slate-500">Analyzing placements and connections</p>
          </div>
        </div>
      )}

      {/* FINISHED STATE */}
      {gameStatus === "finished" && puzzle && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-xl w-full text-center">
            {finalScore >= puzzle.target_score ? (
              <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
            ) : finalScore >= puzzle.target_score * 0.6 ? (
              <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
            ) : (
              <Puzzle className="w-20 h-20 text-slate-500 mx-auto mb-4" />
            )}

            <h1 className="text-3xl font-black mb-2">
              {finalScore >= puzzle.target_score ? (
                <span className="text-yellow-400">Excellent!</span>
              ) : finalScore >= puzzle.target_score * 0.6 ? (
                <span className="text-green-400">Good Job!</span>
              ) : (
                <span className="text-slate-400">Keep Practicing</span>
              )}
            </h1>

            <p className="text-5xl font-black text-cyan-400 mb-1">{finalScore}</p>
            <p className="text-slate-500 mb-8">out of {puzzle.target_score} target</p>

            {/* Audit feedback */}
            {auditResult && (
              <div className="text-left space-y-3 mb-8">
                {auditResult.correct.length > 0 && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <p className="text-green-400 text-sm font-medium mb-1">✓ What you got right</p>
                    <ul className="text-green-300 text-sm space-y-0.5">
                      {auditResult.correct.slice(0, 3).map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {auditResult.missing.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <p className="text-amber-400 text-sm font-medium mb-1">💡 Consider</p>
                    <ul className="text-amber-300 text-sm space-y-0.5">
                      {auditResult.missing.slice(0, 3).map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {auditResult.suggestions && auditResult.suggestions.length > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-blue-400 text-sm font-medium mb-1">🤔 Think about</p>
                    <ul className="text-blue-300 text-sm space-y-0.5">
                      {auditResult.suggestions.slice(0, 3).map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {auditResult.feedback && (
                  <p className="text-slate-400 text-sm italic">&ldquo;{auditResult.feedback}&rdquo;</p>
                )}
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => router.push("/game")} className="gap-2">
                <Home className="w-4 h-4" />
                Game Hub
              </Button>
              <Button
                onClick={fetchPuzzle}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                New Puzzle
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap with ReactFlowProvider and Suspense for useSearchParams
export default function ArchitectArenaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-12 h-12 text-cyan-500 animate-spin" /></div>}>
      <ReactFlowProvider>
        <ArchitectArenaGame />
      </ReactFlowProvider>
    </Suspense>
  );
}
