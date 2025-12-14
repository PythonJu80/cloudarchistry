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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  if (serviceId === "vpc") return "vpc";
  if (serviceId === "subnet-public" || serviceId === "subnet-private") return "subnet";
  if (serviceId === "security-group") return "securityGroup";
  if (serviceId === "auto-scaling") return "autoScaling";
  return "awsResource";
}

// Get subnet type for subnet nodes
function getSubnetType(serviceId: string): "public" | "private" | undefined {
  if (serviceId === "subnet-public") return "public";
  if (serviceId === "subnet-private") return "private";
  return undefined;
}

// Container sizes for VPC, subnets, etc.
const containerSizes: Record<string, { width: number; height: number }> = {
  vpc: { width: 600, height: 400 },
  subnet: { width: 250, height: 180 },
  securityGroup: { width: 180, height: 120 },
  autoScaling: { width: 150, height: 100 },
};

// Convert puzzle pieces to React Flow nodes - ALL pieces stacked vertically on LEFT
function puzzlePiecesToNodes(pieces: PuzzlePiece[]): Node[] {
  const nodes: Node[] = [];
  
  // Layout config - stack ALL pieces vertically on left side
  const startX = 50;
  let currentY = 50;
  const gap = 20;
  
  // Process ALL pieces in order, stacking vertically
  pieces.forEach((piece) => {
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
    
    // Calculate height for this piece
    const pieceHeight = size?.height || 60;
    
    nodes.push({
      id: piece.id,
      type: nodeType,
      position: { x: startX, y: currentY },
      style: size ? { width: size.width, height: size.height } : undefined,
      data: {
        serviceId: piece.service_id,
        label: displayLabel, // Use the contextual label from the puzzle
        // No sublabel - keeps nodes clean and readable
        color: getCategoryColor(piece.category),
        subnetType: piece.service_id.startsWith("subnet-") ? getSubnetType(piece.service_id) : undefined,
      },
      draggable: true,
    });
    
    currentY += pieceHeight + gap;
  });
  
  return nodes;
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
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [finalScore, setFinalScore] = useState(0);

  // React Flow state - same pattern as diagram-canvas.tsx
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasStarted = useRef(false);

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
      setEdges((eds) => [...eds, newEdge]);
    },
    [setEdges]
  );

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
        const initialNodes = puzzlePiecesToNodes(data.puzzle.pieces) as Node[];
        setNodes(initialNodes);
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

  // Submit for AI audit
  const submitPuzzle = useCallback(async () => {
    if (!puzzle) return;

    setGameStatus("submitting");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const response = await fetch("/api/gaming/architect-arena/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzle_id: puzzle.id,
          puzzle_title: puzzle.title,
          puzzle_brief: puzzle.brief,
          expected_hierarchy: puzzle.expected_hierarchy,
          expected_connections: puzzle.expected_connections,
          nodes: nodes.map((n) => ({
            id: n.id,
            type: n.type,
            label: n.data?.label,
            position: n.position,
            parent_id: n.parentId,
          })),
          connections: edges.map((e) => ({
            source: e.source,
            target: e.target,
          })),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setAuditResult(result);
        setFinalScore(result.score || 0);
      } else {
        // Fallback score
        setFinalScore(Math.min(edges.length * 15, 60));
      }
    } catch (error) {
      console.error("Audit failed:", error);
      setFinalScore(Math.min(edges.length * 15, 60));
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

  // Timer effect
  useEffect(() => {
    if (gameStatus !== "playing") return;

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
  }, [gameStatus, submitPuzzle]);

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

      {/* PLAYING STATE - Sidebar + Canvas */}
      {gameStatus === "playing" && puzzle && (
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT SIDEBAR - Brief, Objectives, Penalties, Pieces, Score */}
          <div className="w-[280px] border-r border-slate-800 bg-slate-900/50 flex flex-col overflow-hidden shrink-0">
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
                  timeLeft <= 30 ? "text-red-500 animate-pulse" : "text-white"
                )}
              >
                <Clock className="w-4 h-4" />
                {formatTime(timeLeft)}
              </div>
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

            {/* Live Score */}
            <div className="p-3 bg-slate-900">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 uppercase">Live Score</span>
                <span className="text-xs text-slate-500">Target: {puzzle.target_score}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-cyan-400">{edges.length * 10}</span>
                <span className="text-slate-500 text-sm">pts</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Connections: {edges.length}
              </div>
            </div>

            {/* Submit Button */}
            <div className="p-3 border-t border-slate-800">
              <Button
                onClick={submitPuzzle}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 gap-2"
              >
                <Send className="w-4 h-4" />
                Save to Submit
              </Button>
            </div>
          </div>

          {/* CANVAS */}
          <div ref={reactFlowWrapper} className="flex-1 bg-slate-950">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
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
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
              <Controls className="!bg-slate-800 !border-slate-700 !rounded-lg [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button]:!text-white [&>button:hover]:!bg-slate-600" />
            </ReactFlow>
          </div>
        </div>
      )}

      {/* SUBMITTING STATE */}
      {gameStatus === "submitting" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Sparkles className="w-16 h-16 text-cyan-500 mx-auto mb-4 animate-pulse" />
            <p className="text-xl text-slate-300 mb-2">AI is evaluating your architecture...</p>
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
