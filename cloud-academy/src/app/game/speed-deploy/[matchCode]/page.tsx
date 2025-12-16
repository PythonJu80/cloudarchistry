"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSocket } from "@/hooks/use-socket";
import {
  Loader2,
  ArrowLeft,
  XCircle,
  Wifi,
  WifiOff,
  Trophy,
  Rocket,
  Clock,
  CheckCircle,
  Crown,
  Play,
  X,
  GripVertical,
  Trash2,
  ChevronRight,
  ChevronDown,
  Search,
  Zap,
  AlertTriangle,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AWS_SERVICES, AWS_CATEGORIES, type AWSService } from "@/lib/aws-services";

// =============================================================================
// TYPES
// =============================================================================

interface Player {
  id: string;
  name: string | null;
  username: string | null;
  email: string;
}

interface Requirement {
  category: string;
  description: string;
  priority: string;
}

interface TrapService {
  service_id: string;
  why_suboptimal: string;
  penalty: number;
}

interface Brief {
  id: string;
  client_name: string;
  industry: string;
  icon: string;
  requirements: Requirement[];
  available_services: string[];
  optimal_solution: string[];
  acceptable_solutions: string[][];
  trap_services: TrapService[];
  time_limit: number;
  user_level: string;
  target_cert?: string;
  max_score: number;
  learning_point: string;
}

interface ValidationResult {
  grade: string;
  score: number;
  max_score: number;
  correctness_score: number;
  speed_bonus: number;
  cost_efficiency_bonus: number;
  overengineering_penalty: number;
  trap_penalty: number;
  missed_requirement_penalty: number;
  met_requirements: boolean;
  is_optimal: boolean;
  is_acceptable: boolean;
  requirements_met: string[];
  requirements_missed: string[];
  trap_services_used: Array<{ service_id: string; why_suboptimal: string; penalty: number }>;
  missing_services: string[];
  extra_services: string[];
  feedback: string;
  optimal_solution: string[];
  learning_point: string;
  requirement_analysis?: Array<{
    category: string;
    description: string;
    priority: string;
    met: boolean;
    status?: string;
    your_services?: string[];
    recommended?: string[];
    missing?: string[];
  }>;
}

interface MatchData {
  id: string;
  matchCode: string;
  player1: Player;
  player2: Player;
  player1Score: number;
  player2Score: number;
  status: string;
  matchType: string;
  myPlayerId: string;
  isPlayer1: boolean;
  myScore: number;
  opponentScore: number;
  opponent: Player;
  winnerId: string | null;
  matchState: {
    brief?: Brief;
    player1Services?: string[];
    player2Services?: string[];
    player1Submitted?: boolean;
    player2Submitted?: boolean;
    player1TimeRemaining?: number;
    player2TimeRemaining?: number;
    player1Result?: ValidationResult;
    player2Result?: ValidationResult;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const USER_LEVEL_COLORS: Record<string, string> = {
  beginner: "text-green-400 bg-green-500/20 border-green-500/30",
  intermediate: "text-amber-400 bg-amber-500/20 border-amber-500/30",
  advanced: "text-orange-400 bg-orange-500/20 border-orange-500/30",
  expert: "text-red-400 bg-red-500/20 border-red-500/30",
};

// =============================================================================
// ANIMATED BACKGROUND COMPONENTS (matching main lobby)
// =============================================================================

const AnimatedGrid = () => (
  <div className="absolute inset-0 overflow-hidden opacity-20">
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `
          linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)
        `,
        backgroundSize: "50px 50px",
        animation: "gridMove 20s linear infinite",
      }}
    />
    <style jsx>{`
      @keyframes gridMove {
        0% { transform: translate(0, 0); }
        100% { transform: translate(50px, 50px); }
      }
    `}</style>
  </div>
);

const FloatingOrbs = () => {
  const orbs = [
    { color: "#06b6d4", size: 800, x: -20, y: -20, duration: 25 },
    { color: "#8b5cf6", size: 600, x: 80, y: 60, duration: 30 },
    { color: "#22c55e", size: 500, x: 50, y: 30, duration: 20 },
    { color: "#f97316", size: 400, x: 20, y: 70, duration: 35 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden">
      {orbs.map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-[100px] opacity-30"
          style={{
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            width: orb.size,
            height: orb.size,
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            animation: `float${i} ${orb.duration}s ease-in-out infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes float0 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(30px, -30px) scale(1.1); } }
        @keyframes float1 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-40px, 20px) scale(0.9); } }
        @keyframes float2 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(20px, 40px) scale(1.05); } }
        @keyframes float3 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-30px, -20px) scale(1.1); } }
      `}</style>
    </div>
  );
};

const ScanLines = () => (
  <div
    className="absolute inset-0 pointer-events-none opacity-[0.03]"
    style={{
      background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)",
    }}
  />
);


// =============================================================================
// DRAGGABLE SERVICE COMPONENT
// =============================================================================

function DraggableService({ 
  service, 
  onDragStart,
  disabled,
}: { 
  service: AWSService;
  onDragStart: (e: React.DragEvent, service: AWSService) => void;
  disabled?: boolean;
}) {
  return (
    <div
      draggable={!disabled}
      onDragStart={(e) => !disabled && onDragStart(e, service)}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all",
        disabled 
          ? "opacity-50 cursor-not-allowed bg-slate-900 border border-slate-800"
          : "cursor-grab bg-slate-800 border border-slate-700 hover:border-slate-600 hover:bg-slate-700"
      )}
    >
      <GripVertical className="w-3 h-3 text-slate-600" />
      <div 
        className="w-2 h-2 rounded-full" 
        style={{ backgroundColor: service.color }}
      />
      <span className="text-xs text-slate-300">{service.shortName}</span>
    </div>
  );
}

// =============================================================================
// DROPPABLE SLOT COMPONENT
// =============================================================================

function DroppableSlot({ 
  index, 
  service, 
  onRemove,
  onDrop,
  isOver,
  disabled,
}: { 
  index: number; 
  service: AWSService | null;
  onRemove: () => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  isOver: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      onDragOver={(e) => !disabled && e.preventDefault()}
      onDrop={(e) => !disabled && onDrop(e, index)}
      className={cn(
        "relative h-12 rounded-lg border-2 border-dashed transition-all flex items-center justify-center",
        disabled && "opacity-50",
        isOver 
          ? "border-green-500 bg-green-500/10" 
          : service 
            ? "border-slate-600 bg-slate-800" 
            : "border-slate-700 bg-slate-900"
      )}
    >
      {service ? (
        <div className="flex items-center gap-2 px-3">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: service.color }}
          />
          <span className="text-sm text-slate-200">{service.shortName}</span>
          {!disabled && (
            <button
              onClick={onRemove}
              className="ml-2 text-slate-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <span className="text-xs text-slate-600">Drop service #{index + 1}</span>
      )}
    </div>
  );
}

// =============================================================================
// SERVICE PICKER COMPONENT
// =============================================================================

function ServicePicker({
  availableServiceIds,
  selectedServices,
  onDragStart,
  disabled,
}: {
  availableServiceIds: string[];
  selectedServices: (AWSService | null)[];
  onDragStart: (e: React.DragEvent, service: AWSService) => void;
  disabled?: boolean;
}) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Use CURATED service palette from brief (10-14 services)
  const availableServices = AWS_SERVICES.filter(s => availableServiceIds.includes(s.id));
  const selectedIds = new Set(selectedServices.filter(Boolean).map(s => s!.id));

  const filteredServices = searchQuery
    ? availableServices.filter(s => 
        s.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableServices;

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  return (
    <div className="w-64 border-l border-slate-800 bg-slate-900 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-slate-300">AWS Services</h3>
          <span className="text-[10px] text-slate-600">{availableServices.length}</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={disabled}
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-slate-600 disabled:opacity-50"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {searchQuery ? (
          <div className="space-y-0.5">
            {filteredServices.map(service => (
              <DraggableService 
                key={service.id} 
                service={service} 
                onDragStart={onDragStart}
                disabled={disabled || selectedIds.has(service.id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {AWS_CATEGORIES.map(cat => {
              const services = availableServices.filter(s => s.category === cat.id);
              if (services.length === 0) return null;
              const isExpanded = expandedCategories.has(cat.id);
              
              return (
                <div key={cat.id}>
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span className="text-xs font-medium text-slate-300">{cat.name}</span>
                    <span className="text-[10px] text-slate-600 ml-auto">{services.length}</span>
                  </button>
                  
                  {isExpanded && (
                    <div className="ml-5 mt-1 space-y-0.5">
                      {services.map(service => (
                        <DraggableService 
                          key={service.id} 
                          service={service} 
                          onDragStart={onDragStart}
                          disabled={disabled || selectedIds.has(service.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SpeedDeployMatchPage() {
  const params = useParams();
  const router = useRouter();
  const matchCode = params.matchCode as string;
  const { status: authStatus } = useSession();
  const { toast } = useToast();

  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Game state
  const [selectedServices, setSelectedServices] = useState<(AWSService | null)[]>([]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [opponentSubmitted, setOpponentSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRematchLoading, setIsRematchLoading] = useState(false);
  
  // Connection status
  const [opponentOnline, setOpponentOnline] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch match data
  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/versus/${matchCode}`);
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to load match");
        return;
      }
      
      setMatch(data.match);
      
      // Initialize game state from match
      if (data.match.matchState?.brief) {
        setTimeLeft(data.match.matchState.brief.time_limit);
        setSelectedServices(new Array(6).fill(null));
        
        // Check submission status
        const isPlayer1 = data.match.isPlayer1;
        if (isPlayer1 && data.match.matchState.player1Submitted) {
          setHasSubmitted(true);
        } else if (!isPlayer1 && data.match.matchState.player2Submitted) {
          setHasSubmitted(true);
        }
        
        // Check opponent submission
        if (isPlayer1 && data.match.matchState.player2Submitted) {
          setOpponentSubmitted(true);
        } else if (!isPlayer1 && data.match.matchState.player1Submitted) {
          setOpponentSubmitted(true);
        }
      }
      
      setError(null);
    } catch {
      setError("Failed to load match");
    } finally {
      setLoading(false);
    }
  }, [matchCode]);

  // Socket event handlers
  const handleSocketMatchStatus = useCallback((status: { status: string; winnerId?: string }) => {
    if (status.status === "completed") {
      setShowResults(true);
      fetchMatch();
    }
  }, [fetchMatch]);

  const handleSocketScoreUpdate = useCallback(() => {
    // Opponent submitted - refresh to get latest state
    fetchMatch();
  }, [fetchMatch]);

  const handleSocketRoomUpdate = useCallback((update: { players: Array<{ userId: string }>; playerCount: number }) => {
    if (match) {
      const opponentId = match.isPlayer1 ? match.player2.id : match.player1.id;
      const isOnline = update.players.some(p => p.userId === opponentId);
      if (isOnline !== opponentOnline) {
        setOpponentOnline(isOnline);
      }
    }
  }, [match, opponentOnline]);

  // Initialize socket connection
  const {
    isConnected,
    updateMatchStatus,
    updateScores,
  } = useSocket({
    matchCode,
    userId: match?.myPlayerId || "",
    userName: match?.isPlayer1 
      ? (match?.player1.name || match?.player1.username || "Player 1")
      : (match?.player2.name || match?.player2.username || "Player 2"),
    onMatchStatus: handleSocketMatchStatus,
    onScoreUpdate: handleSocketScoreUpdate,
    onRoomUpdate: handleSocketRoomUpdate,
  });
  
  // Suppress unused variable warnings
  void updateMatchStatus;
  void updateScores;

  // Initial load
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
      return;
    }
    
    if (authStatus === "authenticated" && matchCode) {
      fetchMatch();
    }
  }, [authStatus, matchCode, router, fetchMatch]);

  // Poll for match updates when pending (waiting for opponent to accept)
  useEffect(() => {
    if (match?.status !== "pending") return;
    
    const pollInterval = setInterval(() => {
      fetchMatch();
    }, 2000); // Poll every 2 seconds
    
    return () => clearInterval(pollInterval);
  }, [match?.status, fetchMatch]);

  // Poll for brief when Player 2 is waiting for Player 1 to generate
  useEffect(() => {
    if (match?.status !== "active" || match?.isPlayer1 || match?.matchState?.brief) return;
    
    const pollInterval = setInterval(() => {
      fetchMatch();
    }, 2000); // Poll every 2 seconds
    
    return () => clearInterval(pollInterval);
  }, [match?.status, match?.isPlayer1, match?.matchState?.brief, fetchMatch]);

  // Poll for opponent submission when waiting after submitting
  useEffect(() => {
    if (match?.status !== "active" || !hasSubmitted || showResults) return;
    
    const pollInterval = setInterval(() => {
      fetchMatch();
    }, 2000); // Poll every 2 seconds
    
    return () => clearInterval(pollInterval);
  }, [match?.status, hasSubmitted, showResults, fetchMatch]);

  // Show results when match is completed
  useEffect(() => {
    if (match?.status === "completed" && !showResults) {
      setShowResults(true);
    }
  }, [match?.status, showResults]);

  // Timer countdown
  useEffect(() => {
    if (match?.status !== "active" || hasSubmitted || !match?.matchState?.brief) return;
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [match?.status, hasSubmitted, match?.matchState?.brief]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (match?.status === "active" && timeLeft === 0 && !hasSubmitted && match?.matchState?.brief) {
      handleSubmit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, match?.status, hasSubmitted, match?.matchState?.brief]);

  // Accept match
  const handleAccept = async () => {
    try {
      const res = await fetch(`/api/versus/${matchCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      
      if (res.ok) {
        fetchMatch();
      }
    } catch (err) {
      console.error("Failed to accept:", err);
    }
  };

  // Decline match
  const handleDecline = async () => {
    try {
      const res = await fetch(`/api/versus/${matchCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });
      
      if (res.ok) {
        router.push("/game");
      }
    } catch (err) {
      console.error("Failed to decline:", err);
    }
  };

  // Generate brief and start
  const handleStartGame = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/versus/${matchCode}/speed-deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      
      if (res.ok) {
        fetchMatch();
      }
    } catch (err) {
      console.error("Failed to start game:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, service: AWSService) => {
    e.dataTransfer.setData("application/json", JSON.stringify(service));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    try {
      const serviceData = e.dataTransfer.getData("application/json");
      const service = JSON.parse(serviceData) as AWSService;
      
      setSelectedServices(prev => {
        const newSlots = [...prev];
        const existingIndex = newSlots.findIndex(s => s?.id === service.id);
        if (existingIndex !== -1) {
          newSlots[existingIndex] = null;
        }
        newSlots[slotIndex] = service;
        return newSlots;
      });
    } catch (err) {
      console.error("Drop error:", err);
    }
  };

  const removeFromSlot = (index: number) => {
    setSelectedServices(prev => {
      const newSlots = [...prev];
      newSlots[index] = null;
      return newSlots;
    });
  };

  // Submit architecture
  const handleSubmit = async () => {
    if (!match?.matchState?.brief || hasSubmitted) return;
    
    if (timerRef.current) clearInterval(timerRef.current);
    setHasSubmitted(true);
    
    const submittedServices = selectedServices
      .filter((s): s is AWSService => s !== null)
      .map(s => s.id);
    
    try {
      const res = await fetch(`/api/versus/${matchCode}/speed-deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "submit",
          services: submittedServices,
          timeRemaining: timeLeft,
        }),
      });
      
      if (res.ok) {
        toast({ title: "🚀 Deployed!", description: "Waiting for opponent..." });
        fetchMatch();
      }
    } catch (err) {
      console.error("Failed to submit:", err);
      setHasSubmitted(false);
    }
  };

  if (loading || authStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        {/* Animated background */}
        <div className="fixed inset-0 pointer-events-none">
          <FloatingOrbs />
          <AnimatedGrid />
          <ScanLines />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#050508_70%)]" />
        </div>
        
        <div className="relative z-10 text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-cyan-500 rounded-full animate-spin" />
            <div className="absolute inset-4 bg-cyan-500/20 rounded-full animate-pulse" />
            <Rocket className="absolute inset-0 m-auto w-8 h-8 text-cyan-500" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">LOADING MATCH</h2>
          <p className="text-gray-500 animate-pulse">Preparing the battlefield...</p>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        {/* Animated background */}
        <div className="fixed inset-0 pointer-events-none">
          <FloatingOrbs />
          <AnimatedGrid />
          <ScanLines />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#050508_70%)]" />
        </div>
        
        <div className="relative z-10">
          <Card className="max-w-md bg-gray-900/80 border-gray-700 backdrop-blur-xl">
            <CardContent className="pt-6 text-center">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-black mb-2 text-white">Match Not Found</h2>
              <p className="text-gray-400 mb-4">{error || "This match doesn't exist or you don't have access."}</p>
              <Link href="/game">
                <Button className="bg-cyan-600 hover:bg-cyan-500">Back to Arena</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const brief = match.matchState?.brief;
  const filledSlots = selectedServices.filter(s => s !== null).length;

  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <FloatingOrbs />
        <AnimatedGrid />
        <ScanLines />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#050508_70%)]" />
      </div>

      {/* Header */}
      <nav className="relative z-20 border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/game" className="flex items-center gap-2 text-white hover:text-gray-400 transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Exit Match</span>
          </Link>
          
          {/* Center Logo */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur-lg opacity-50 animate-pulse" />
              <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <Rocket className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                SPEED DEPLOY
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${isConnected ? "bg-green-500/20 border border-green-500/30" : "bg-red-500/20 border border-red-500/30"}`}>
              {isConnected ? <Wifi className="w-3 h-3 text-green-400" /> : <WifiOff className="w-3 h-3 text-red-400" />}
              <span className={`text-xs font-bold ${isConnected ? "text-green-400" : "text-red-400"}`}>
                {isConnected ? "LIVE" : "RECONNECTING"}
              </span>
            </div>
            {match.status === "active" && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs font-bold text-cyan-400">IN MATCH</span>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Scoreboard */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Player 1 */}
          <div className={cn(
            "relative group",
            match.isPlayer1 && "scale-105"
          )}>
            {/* Glow effect for current player */}
            {match.isPlayer1 && (
              <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity" />
            )}
            <div className={cn(
              "relative rounded-xl border overflow-hidden transition-all duration-300 bg-gray-900/80 backdrop-blur-xl",
              match.isPlayer1 ? "border-cyan-500/50" : "border-gray-700"
            )}>
              <CardContent className="pt-6 pb-4 text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mx-auto mb-3 text-white font-bold text-xl">
                  {(match.player1.name || match.player1.username || "P")[0].toUpperCase()}
                </div>
                <p className="font-black truncate text-white text-lg">
                  {match.player1.name || match.player1.username || "Player 1"}
                </p>
                {match.isPlayer1 && <span className="text-xs text-cyan-400">(You)</span>}
                <p className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mt-3">{match.player1Score}</p>
                {match.winnerId === match.player1.id && (
                  <Crown className="w-6 h-6 text-yellow-400 mx-auto mt-2 animate-bounce" />
                )}
              </CardContent>
            </div>
          </div>

          {/* VS / Status */}
          <div className="relative">
            <div className="absolute -inset-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-2xl blur-xl opacity-30" />
            <div className="relative h-full rounded-xl border border-gray-700 overflow-hidden bg-gray-900/80 backdrop-blur-xl flex items-center justify-center">
              <div className="text-center py-6">
                {match.status === "active" && brief && (
                  <>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Time Left</p>
                    <p className={cn(
                      "text-4xl font-black font-mono",
                      timeLeft <= 10 ? "text-red-400 animate-pulse" : "bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent"
                    )}>{timeLeft}s</p>
                  </>
                )}
                {match.status === "pending" && (
                  <div className="text-5xl font-black text-gray-600 animate-pulse">VS</div>
                )}
                {match.status === "completed" && (
                  <>
                    <Trophy className="w-10 h-10 text-yellow-400 mx-auto mb-2 animate-bounce" />
                    <p className="text-lg font-black text-white">
                      {match.winnerId === match.myPlayerId ? "Victory!" : 
                       match.winnerId ? "Defeat" : "Draw!"}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Player 2 */}
          <div className={cn(
            "relative group",
            !match.isPlayer1 && "scale-105"
          )}>
            {/* Glow effect for current player */}
            {!match.isPlayer1 && (
              <div className="absolute -inset-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity" />
            )}
            <div className={cn(
              "relative rounded-xl border overflow-hidden transition-all duration-300 bg-gray-900/80 backdrop-blur-xl",
              !match.isPlayer1 ? "border-orange-500/50" : "border-gray-700"
            )}>
              <CardContent className="pt-6 pb-4 text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mx-auto mb-3 text-white font-bold text-xl">
                  {(match.player2.name || match.player2.username || "P")[0].toUpperCase()}
                </div>
                <p className="font-black truncate text-white text-lg">
                  {match.player2.name || match.player2.username || "Player 2"}
                </p>
                {!match.isPlayer1 && <span className="text-xs text-orange-400">(You)</span>}
                <p className="text-4xl font-black bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent mt-3">{match.player2Score}</p>
                {match.winnerId === match.player2.id && (
                  <Crown className="w-6 h-6 text-yellow-400 mx-auto mt-2 animate-bounce" />
                )}
              </CardContent>
            </div>
          </div>
        </div>

        {/* Pending State */}
        {match.status === "pending" && (
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500 via-purple-500 to-orange-500 rounded-2xl blur-xl opacity-30 animate-pulse" />
            
            <div className="relative bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-2xl p-8">
              {match.isPlayer1 ? (
                <div className="text-center">
                  {/* Animated waiting indicator */}
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-transparent border-t-cyan-500 rounded-full animate-spin" />
                    <div className="absolute inset-4 bg-cyan-500/20 rounded-full animate-pulse" />
                    <Clock className="absolute inset-0 m-auto w-8 h-8 text-cyan-400" />
                  </div>
                  
                  <h3 className="text-2xl font-black text-white mb-2">WAITING FOR OPPONENT</h3>
                  <p className="text-gray-400 mb-4">
                    Waiting for <span className="text-cyan-400 font-bold">{match.opponent.name || match.opponent.username}</span> to accept the challenge
                  </p>
                  
                  {/* Match code display */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700">
                    <span className="text-xs text-gray-500">Match Code:</span>
                    <span className="font-mono font-bold text-cyan-400">{match.matchCode}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  {/* Challenge icon with animation */}
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500 to-orange-500 rounded-full blur-2xl opacity-40 animate-pulse" />
                    <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-orange-500 flex items-center justify-center animate-bounce">
                      <Rocket className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-orange-400 bg-clip-text text-transparent mb-2">
                    YOU&apos;VE BEEN CHALLENGED!
                  </h3>
                  <p className="text-gray-400 mb-6">
                    <span className="text-white font-bold">{match.player1.name || match.player1.username}</span> wants to race you in Speed Deploy!
                  </p>
                  
                  <div className="flex gap-4 justify-center">
                    <Button 
                      onClick={handleAccept} 
                      size="lg"
                      className="relative overflow-hidden bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-black text-lg px-8 py-6 rounded-xl group"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        ACCEPT BATTLE
                      </span>
                      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="lg"
                      onClick={handleDecline} 
                      className="border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 px-6"
                    >
                      <X className="w-5 h-5 mr-2" />
                      Decline
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active - No brief yet */}
        {match.status === "active" && !brief && (
          <div className="relative">
            <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-2xl blur-xl opacity-30" />
            
            <div className="relative bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-2xl p-8">
              {match.isPlayer1 ? (
                isGenerating ? (
                  <div className="text-center">
                    <div className="relative w-24 h-24 mx-auto mb-6">
                      <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full" />
                      <div className="absolute inset-0 border-4 border-transparent border-t-cyan-500 rounded-full animate-spin" />
                      <div className="absolute inset-4 bg-cyan-500/20 rounded-full animate-pulse" />
                      <Rocket className="absolute inset-0 m-auto w-8 h-8 text-cyan-400" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-2">GENERATING BRIEF</h3>
                    <p className="text-gray-400">
                      Creating your client scenario. This may take a few seconds...
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="relative w-24 h-24 mx-auto mb-6">
                      <div className="absolute -inset-4 bg-gradient-to-r from-green-500 to-cyan-500 rounded-full blur-2xl opacity-40 animate-pulse" />
                      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center">
                        <Play className="w-10 h-10 text-white fill-current" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-black bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                      READY TO START?
                    </h3>
                    <p className="text-gray-400 mb-6">
                      Click below to generate the client brief and begin the race!
                    </p>
                    <Button 
                      onClick={handleStartGame} 
                      size="lg" 
                      className="relative overflow-hidden bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-400 hover:to-cyan-400 text-white font-black text-lg px-10 py-6 rounded-xl group"
                    >
                      <span className="relative z-10 flex items-center gap-3">
                        <Rocket className="w-6 h-6" />
                        GENERATE BRIEF
                      </span>
                      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    </Button>
                  </div>
                )
              ) : (
                <div className="text-center">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-transparent border-t-cyan-500 rounded-full animate-spin" />
                    <div className="absolute inset-4 bg-cyan-500/20 rounded-full animate-pulse" />
                    <Zap className="absolute inset-0 m-auto w-8 h-8 text-cyan-400" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2">GET READY!</h3>
                  <p className="text-gray-400">
                    Waiting for <span className="text-cyan-400 font-bold">{match.player1.name || match.player1.username}</span> to generate the brief...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active - Building */}
        {match.status === "active" && brief && !hasSubmitted && (
          <div className="flex gap-6 h-[calc(100vh-280px)]">
            {/* Main Build Area */}
            <div className="flex-1 flex flex-col">
              {/* Brief Summary */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-3xl">{brief.icon}</span>
                  <div>
                    <h3 className="font-bold text-white">{brief.client_name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">{brief.industry}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded border", USER_LEVEL_COLORS[brief.user_level])}>
                        {brief.user_level}
                      </span>
                      {brief.target_cert && (
                        <span className="text-xs px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                          {brief.target_cert}
                        </span>
                      )}
                    </div>
                  </div>
                  {opponentSubmitted && (
                    <div className="ml-auto px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-sm">
                      ⚡ Opponent submitted!
                    </div>
                  )}
                </div>
                
                <h4 className="text-sm font-medium text-slate-400 mb-2">Requirements</h4>
                <div className="flex flex-wrap gap-2">
                  {brief.requirements.map((req, i) => (
                    <div 
                      key={i}
                      className={cn(
                        "text-xs px-2 py-1 rounded max-w-md",
                        req.priority === "critical" ? "bg-red-500/20 text-red-400" : "bg-slate-800 text-slate-400"
                      )}
                      title={req.description}
                    >
                      {req.description.length > 80 ? `${req.description.slice(0, 80)}...` : req.description}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Architecture Slots */}
              <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-slate-400">Your Architecture ({filledSlots}/6 services)</h4>
                  <Button
                    onClick={handleSubmit}
                    disabled={filledSlots === 0}
                    className="bg-cyan-600 hover:bg-cyan-700 gap-2"
                  >
                    <Rocket className="w-4 h-4" />
                    Deploy
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {selectedServices.map((service, index) => (
                    <div
                      key={index}
                      onDragEnter={() => setDragOverIndex(index)}
                      onDragLeave={() => setDragOverIndex(null)}
                    >
                      <DroppableSlot
                        index={index}
                        service={service}
                        onRemove={() => removeFromSlot(index)}
                        onDrop={handleDrop}
                        isOver={dragOverIndex === index}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Service Picker */}
            <ServicePicker
              availableServiceIds={brief.available_services}
              selectedServices={selectedServices}
              onDragStart={handleDragStart}
            />
          </div>
        )}

        {/* Submitted - Waiting */}
        {match.status === "active" && hasSubmitted && !showResults && (
          <div className="relative">
            <div className="absolute -inset-2 bg-gradient-to-r from-green-500 via-cyan-500 to-blue-500 rounded-2xl blur-xl opacity-30 animate-pulse" />
            
            <div className="relative bg-gray-900/80 backdrop-blur-xl border border-gray-700 rounded-2xl p-8">
              <div className="text-center">
                {/* Success animation */}
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute -inset-4 bg-gradient-to-r from-green-500 to-cyan-500 rounded-full blur-2xl opacity-40 animate-pulse" />
                  <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center">
                    <Rocket className="w-10 h-10 text-white animate-bounce" />
                  </div>
                </div>
                
                <h3 className="text-2xl font-black bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                  DEPLOYED!
                </h3>
                <p className="text-gray-400 mb-4">
                  {opponentSubmitted 
                    ? "Calculating results..." 
                    : <>Waiting for <span className="text-orange-400 font-bold">{match.opponent.name || match.opponent.username}</span> to submit...</>
                  }
                </p>
                
                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Completed State */}
        {match.status === "completed" && (() => {
          const p1Result = match.matchState.player1Result;
          const p2Result = match.matchState.player2Result;
          const myResult = match.isPlayer1 ? p1Result : p2Result;
          
          // Helper to render a player's result card
          const renderPlayerResult = (result: ValidationResult | undefined, playerName: string, isMe: boolean, isWinner: boolean) => {
            if (!result) return null;
            return (
              <div className={cn(
                "flex-1 p-4 rounded-xl border",
                isWinner ? "border-yellow-500/30 bg-yellow-500/5" : "border-slate-700 bg-slate-900/50"
              )}>
                {/* Player Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-medium", isMe ? "text-cyan-400" : "text-red-400")}>
                      {playerName} {isMe && "(You)"}
                    </span>
                    {isWinner && <Crown className="w-4 h-4 text-yellow-400" />}
                  </div>
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold",
                    result.grade === "S" ? "bg-yellow-500/20 text-yellow-400" :
                    result.grade === "A" ? "bg-green-500/20 text-green-400" :
                    result.grade === "B" ? "bg-cyan-500/20 text-cyan-400" :
                    result.grade === "C" ? "bg-amber-500/20 text-amber-400" :
                    result.grade === "D" ? "bg-orange-500/20 text-orange-400" :
                    "bg-red-500/20 text-red-400"
                  )}>
                    {result.grade}
                  </div>
                </div>
                
                {/* Score */}
                <div className="text-2xl font-bold text-center mb-2">
                  <span className="text-cyan-400">{result.score}</span>
                  <span className="text-slate-500 text-sm">/{result.max_score}</span>
                </div>
                
                {/* Score Breakdown - Compact */}
                <div className="flex flex-wrap justify-center gap-1 text-xs mb-3">
                  {(result.speed_bonus || 0) > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">+{result.speed_bonus}</span>
                  )}
                  {(result.trap_penalty || 0) > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">-{result.trap_penalty}</span>
                  )}
                  {(result.missed_requirement_penalty || 0) > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">-{result.missed_requirement_penalty}</span>
                  )}
                </div>
                
                {/* Feedback */}
                <p className="text-xs text-slate-400">{result.feedback}</p>
                
                {/* Trap Services - Compact */}
                {result.trap_services_used && result.trap_services_used.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <div className="text-xs text-orange-400 mb-1">Trap services used:</div>
                    <div className="flex flex-wrap gap-1">
                      {result.trap_services_used.map((trap, i) => {
                        const svc = AWS_SERVICES.find(s => s.id === trap.service_id);
                        return (
                          <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300">
                            {svc?.shortName || trap.service_id}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          };
          
          return (
          <div className="space-y-4">
            {/* Business Requirements - For Reference */}
            {brief && (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="pt-4">
                  <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Business Requirements
                  </h4>
                  <ul className="space-y-2 text-sm text-slate-300 list-disc list-inside">
                    {brief.requirements.map((req: { description: string }, i: number) => (
                      <li key={i}>{req.description}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Win/Lose Header */}
            <div className={cn(
              "text-center p-6 rounded-xl border",
              match.winnerId === match.myPlayerId 
                ? "bg-green-500/10 border-green-500/30" 
                : match.winnerId
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-slate-900 border-slate-800"
            )}>
              {match.winnerId === match.myPlayerId ? (
                <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
              ) : match.winnerId ? (
                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-2" />
              ) : (
                <Target className="w-12 h-12 text-slate-400 mx-auto mb-2" />
              )}
              <h3 className="text-xl font-bold text-white">
                {match.winnerId === match.myPlayerId ? "🎉 Victory!" : 
                 match.winnerId ? "Better luck next time!" : "It's a Draw!"}
              </h3>
            </div>

            {/* Side-by-Side Comparison */}
            <div className="grid grid-cols-2 gap-4">
              {renderPlayerResult(
                p1Result, 
                match.player1.name || match.player1.username || "Player 1",
                match.isPlayer1,
                match.winnerId === match.player1.id
              )}
              {renderPlayerResult(
                p2Result,
                match.player2.name || match.player2.username || "Player 2", 
                !match.isPlayer1,
                match.winnerId === match.player2.id
              )}
            </div>

            {/* Your Detailed Feedback - Full */}
            {myResult && (
              <>
                {/* Learning Point */}
                {myResult.learning_point && (
                  <Card className="bg-cyan-500/10 border-cyan-500/20">
                    <CardContent className="pt-4">
                      <h4 className="text-sm font-medium text-cyan-400 mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Key Takeaway
                      </h4>
                      <p className="text-sm text-slate-300">{myResult.learning_point}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Optimal Solution */}
                {myResult.optimal_solution && myResult.optimal_solution.length > 0 && (
                  <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="pt-4">
                      <h4 className="text-sm font-medium text-slate-400 mb-3">Optimal Solution</h4>
                      <div className="flex flex-wrap gap-2">
                        {myResult.optimal_solution.map((svcId, i) => {
                          const svc = AWS_SERVICES.find(s => s.id === svcId);
                          return (
                            <div key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-green-500/10 border border-green-500/20">
                              {svc && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: svc.color }} />}
                              <span className="text-xs text-green-400">{svc?.shortName || svcId}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center">
              <Link href="/game">
                <Button variant="outline">Back to Arena</Button>
              </Link>
              <Button 
                className="gap-2 bg-cyan-600 hover:bg-cyan-700"
                disabled={isRematchLoading}
                onClick={async () => {
                  setIsRematchLoading(true);
                  try {
                    const opponentId = match.isPlayer1 ? match.player2.id : match.player1.id;
                    const res = await fetch("/api/versus", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ opponentId, matchType: "speed_deploy" }),
                    });
                    const data = await res.json();
                    if (res.ok && data.match) {
                      router.push(`/game/speed-deploy/${data.match.matchCode}`);
                    }
                  } catch (err) {
                    console.error("Failed to create rematch:", err);
                  } finally {
                    setIsRematchLoading(false);
                  }
                }}
              >
                {isRematchLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {isRematchLoading ? "Creating..." : "Rematch"}
              </Button>
            </div>
          </div>
          );
        })()}
      </main>
    </div>
  );
}
