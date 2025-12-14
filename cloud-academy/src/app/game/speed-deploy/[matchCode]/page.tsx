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
  Users,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

interface Brief {
  id: string;
  client_name: string;
  industry: string;
  icon: string;
  requirements: Requirement[];
  available_services: string[];
  optimal_solution: string[];
  acceptable_solutions: string[][];
  time_limit: number;
  difficulty: string;
  max_score: number;
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
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-green-400 bg-green-500/20 border-green-500/30",
  medium: "text-amber-400 bg-amber-500/20 border-amber-500/30",
  hard: "text-red-400 bg-red-500/20 border-red-500/30",
};


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
  selectedServices,
  onDragStart,
  disabled,
}: {
  selectedServices: (AWSService | null)[];
  onDragStart: (e: React.DragEvent, service: AWSService) => void;
  disabled?: boolean;
}) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Use ALL AWS services, not just a subset
  const availableServices = AWS_SERVICES;
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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mx-auto mb-4" />
          <p className="text-slate-400">Loading match...</p>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Card className="max-w-md bg-slate-900 border-slate-800">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-white">Match Not Found</h2>
            <p className="text-slate-400 mb-4">{error || "This match doesn't exist or you don't have access."}</p>
            <Link href="/game">
              <Button>Back to Arena</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const brief = match.matchState?.brief;
  const filledSlots = selectedServices.filter(s => s !== null).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/game" className="flex items-center gap-2 text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <Rocket className="w-5 h-5 text-cyan-400" />
            <span className="font-bold">Speed Deploy</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 text-xs ${isConnected ? "text-green-500" : "text-red-500"}`}>
              {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isConnected ? "Live" : "Reconnecting..."}
            </div>
            <Badge variant={match.status === "active" ? "default" : "secondary"}>
              {match.status === "pending" && "Waiting..."}
              {match.status === "active" && "LIVE"}
              {match.status === "completed" && "Finished"}
              {match.status === "cancelled" && "Cancelled"}
            </Badge>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4">
        {/* Scoreboard */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Player 1 */}
          <Card className={cn("bg-slate-900 border-slate-800", match.isPlayer1 && "ring-2 ring-cyan-500")}>
            <CardContent className="pt-4 text-center">
              <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-2">
                <Users className="w-6 h-6 text-cyan-500" />
              </div>
              <p className="font-semibold truncate text-white">
                {match.player1.name || match.player1.username || "Player 1"}
                {match.isPlayer1 && " (You)"}
              </p>
              <p className="text-3xl font-bold text-cyan-500 mt-2">{match.player1Score}</p>
              {match.winnerId === match.player1.id && (
                <Crown className="w-6 h-6 text-yellow-500 mx-auto mt-2" />
              )}
            </CardContent>
          </Card>

          {/* VS / Status */}
          <Card className="flex items-center justify-center bg-slate-900 border-slate-800">
            <CardContent className="text-center py-4">
              {match.status === "active" && brief && (
                <>
                  <p className="text-sm text-slate-400">Time Left</p>
                  <p className={cn(
                    "text-2xl font-bold font-mono",
                    timeLeft <= 10 ? "text-red-400 animate-pulse" : "text-white"
                  )}>{timeLeft}s</p>
                </>
              )}
              {match.status === "pending" && (
                <p className="text-xl font-bold text-slate-400">VS</p>
              )}
              {match.status === "completed" && (
                <>
                  <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-white">
                    {match.winnerId === match.myPlayerId ? "You Win!" : 
                     match.winnerId ? "You Lose" : "Draw!"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Player 2 */}
          <Card className={cn("bg-slate-900 border-slate-800", !match.isPlayer1 && "ring-2 ring-cyan-500")}>
            <CardContent className="pt-4 text-center">
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-2">
                <Users className="w-6 h-6 text-orange-500" />
              </div>
              <p className="font-semibold truncate text-white">
                {match.player2.name || match.player2.username || "Player 2"}
                {!match.isPlayer1 && " (You)"}
              </p>
              <p className="text-3xl font-bold text-orange-500 mt-2">{match.player2Score}</p>
              {match.winnerId === match.player2.id && (
                <Crown className="w-6 h-6 text-yellow-500 mx-auto mt-2" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending State */}
        {match.status === "pending" && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Clock className="w-5 h-5" />
                {match.isPlayer1 ? "Waiting for opponent..." : "You've been challenged!"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {match.isPlayer1 ? (
                <p className="text-slate-400">
                  Waiting for {match.opponent.name || match.opponent.username} to accept the Speed Deploy challenge.
                </p>
              ) : (
                <div className="space-y-4">
                  <p className="text-slate-400">
                    {match.player1.name || match.player1.username} wants to race you in Speed Deploy!
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={handleAccept} className="gap-2 bg-cyan-600 hover:bg-cyan-700">
                      <CheckCircle className="w-4 h-4" />
                      Accept Challenge
                    </Button>
                    <Button variant="outline" onClick={handleDecline} className="gap-2">
                      <X className="w-4 h-4" />
                      Decline
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Active - No brief yet */}
        {match.status === "active" && !brief && (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="pt-6 text-center">
              {match.isPlayer1 ? (
                <>
                  <Play className="w-12 h-12 text-cyan-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2 text-white">Ready to Start?</h3>
                  <p className="text-slate-400 mb-4">
                    Click below to generate the client brief and begin the race!
                  </p>
                  <Button onClick={handleStartGame} size="lg" className="gap-2 bg-cyan-600 hover:bg-cyan-700">
                    <Rocket className="w-5 h-5" />
                    Generate Brief
                  </Button>
                </>
              ) : (
                <>
                  <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2 text-white">Get Ready!</h3>
                  <p className="text-slate-400">
                    Waiting for {match.player1.name || match.player1.username} to generate the brief...
                  </p>
                </>
              )}
            </CardContent>
          </Card>
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
                      <span className={cn("text-xs px-2 py-0.5 rounded border", DIFFICULTY_COLORS[brief.difficulty])}>
                        {brief.difficulty}
                      </span>
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
                        "text-xs px-2 py-1 rounded",
                        req.priority === "critical" ? "bg-red-500/20 text-red-400" : "bg-slate-800 text-slate-400"
                      )}
                    >
                      {req.description.slice(0, 50)}...
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
              selectedServices={selectedServices}
              onDragStart={handleDragStart}
            />
          </div>
        )}

        {/* Submitted - Waiting */}
        {match.status === "active" && hasSubmitted && !showResults && (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="pt-6 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-white">Deployed! 🚀</h3>
              <p className="text-slate-400">
                {opponentSubmitted 
                  ? "Calculating results..." 
                  : `Waiting for ${match.opponent.name || match.opponent.username} to submit...`
                }
              </p>
            </CardContent>
          </Card>
        )}

        {/* Completed State */}
        {match.status === "completed" && (
          <Card className={cn(
            "border",
            match.winnerId === match.myPlayerId 
              ? "bg-green-500/10 border-green-500/30" 
              : match.winnerId
                ? "bg-red-500/10 border-red-500/30"
                : "bg-slate-900 border-slate-800"
          )}>
            <CardContent className="pt-6 text-center">
              {match.winnerId === match.myPlayerId ? (
                <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
              ) : match.winnerId ? (
                <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              ) : (
                <Target className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              )}
              
              <h3 className="text-2xl font-bold mb-2 text-white">
                {match.winnerId === match.myPlayerId ? "🎉 Victory!" : 
                 match.winnerId ? "Better luck next time!" : "It's a Draw!"}
              </h3>
              <p className="text-slate-400 mb-4">
                Final Score: {match.player1Score} - {match.player2Score}
              </p>
              <div className="flex gap-3 justify-center">
                <Link href="/game">
                  <Button variant="outline">Back to Arena</Button>
                </Link>
                <Link href="/game/modes/speed-deploy">
                  <Button className="gap-2 bg-cyan-600 hover:bg-cyan-700">
                    <Zap className="w-4 h-4" />
                    Play Again
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
