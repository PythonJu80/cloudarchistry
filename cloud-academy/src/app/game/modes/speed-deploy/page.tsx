"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Rocket,
  Trophy,
  RotateCcw,
  Home,
  Clock,
  Zap,
  Check,
  AlertTriangle,
  Target,
  DollarSign,
  Shield,
  Activity,
  Database,
  Server,
  GripVertical,
  Trash2,
  ChevronRight,
  ChevronDown,
  Search,
  Users,
  Swords,
  X,
  Loader2,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AWS_SERVICES, AWS_CATEGORIES, type AWSService } from "@/lib/aws-services";

// =============================================================================
// TYPES
// =============================================================================

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
  difficulty: string;
  max_score: number;
  learning_point: string;
}

interface ValidationResult {
  // Core result
  grade: string;
  score: number;
  max_score: number;
  
  // Score breakdown
  correctness_score: number;
  speed_bonus: number;
  cost_efficiency_bonus: number;
  overengineering_penalty: number;
  trap_penalty: number;
  missed_requirement_penalty: number;
  
  // Analysis
  met_requirements: boolean;
  is_optimal: boolean;
  is_acceptable: boolean;
  requirements_met: string[];
  requirements_missed: string[];
  trap_services_used: TrapService[];
  missing_services: string[];
  extra_services: string[];
  
  // Feedback
  feedback: string;
  optimal_solution: string[];
  learning_point: string;
  
  // Legacy fields for backward compatibility
  requirement_analysis?: { category: string; description: string; priority: string; met: boolean }[];
}

interface GameState {
  status: "ready" | "briefing" | "building" | "deploying" | "result";
  score: number;
  roundsPlayed: number;
  roundsWon: number;
  totalScore: number;
  bestScore: number;
}

interface TeamMember {
  id: string;
  role: string;
  academyUser: {
    id: string;
    name: string | null;
    email: string;
    username: string | null;
  } | null;
}

interface Team {
  id: string;
  name: string;
  members: TeamMember[];
}

interface Opponent {
  id: string;
  name: string | null;
  email: string;
  username: string | null;
  teamName: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const BRIEFING_DURATION = 5;

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-green-400 bg-green-500/20 border-green-500/30",
  medium: "text-amber-400 bg-amber-500/20 border-amber-500/30",
  hard: "text-red-400 bg-red-500/20 border-red-500/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-500/20",
  important: "text-amber-400 bg-amber-500/20",
  "nice-to-have": "text-blue-400 bg-blue-500/20",
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  traffic: Activity,
  latency: Zap,
  cost: DollarSign,
  availability: Shield,
  compliance: Shield,
  data: Database,
  general: Server,
};

const RACE_IN_CONTAINER = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.16,
      delayChildren: 0.12,
    },
  },
} as const;

const RACE_IN_UP = {
  hidden: { opacity: 0, y: 44, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 260, damping: 26, mass: 0.9, bounce: 0.2 },
  },
} as const;

const RACE_IN_LEFT = {
  hidden: { opacity: 0, x: -220, filter: "blur(10px)" },
  show: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 300, damping: 28, mass: 0.9, bounce: 0.2 },
  },
} as const;

const RACE_IN_RIGHT = {
  hidden: { opacity: 0, x: 220, filter: "blur(10px)" },
  show: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 300, damping: 28, mass: 0.9, bounce: 0.2 },
  },
} as const;

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
      
      <div className="p-2 border-t border-slate-800">
        <p className="text-[10px] text-slate-600 text-center">
          Drag services to build your architecture
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SpeedDeployPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { toast } = useToast();

  const backgroundParticles = useMemo(
    () =>
      Array.from({ length: 20 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        dx: Math.random() * 100 - 50,
        duration: 3 + Math.random() * 4,
        delay: Math.random() * 2,
      })),
    []
  );
  
  const [gameState, setGameState] = useState<GameState>({
    status: "ready",
    score: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    totalScore: 0,
    bestScore: 0,
  });
  
  const [brief, setBrief] = useState<Brief | null>(null);
  const [selectedServices, setSelectedServices] = useState<(AWSService | null)[]>([]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [briefingTimeLeft, setBriefingTimeLeft] = useState(BRIEFING_DURATION);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  
  // PvP state
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [challenging, setChallenging] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const briefingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch team members for PvP
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/team");
      if (response.ok) {
        const data = await response.json();
        const teams: Team[] = data.teams || [];
        
        // Find current user ID and build opponents list
        const opponentsList: Opponent[] = [];
        for (const team of teams) {
          const myMember = team.members.find(
            (m: TeamMember) => m.academyUser?.email === session?.user?.email
          );
          if (myMember?.academyUser?.id) {
            setMyUserId(myMember.academyUser.id);
          }
          
          // Add other team members as potential opponents
          for (const member of team.members) {
            if (member.academyUser && member.academyUser.email !== session?.user?.email) {
              opponentsList.push({
                ...member.academyUser,
                teamName: team.name,
              });
            }
          }
        }
        setOpponents(opponentsList);
      }
    } catch (error) {
      console.error("Failed to fetch team members:", error);
    }
  }, [session?.user?.email]);

  // Fetch team members on mount
  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchTeamMembers();
    }
  }, [authStatus, fetchTeamMembers]);

  // Handle PvP challenge
  const handleChallenge = async (opponentId: string) => {
    setChallenging(opponentId);
    try {
      const res = await fetch("/api/versus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opponentId, matchType: "speed_deploy" }),
      });
      const data = await res.json();
      if (res.ok && data.match) {
        toast({
          title: "🚀 Challenge Sent!",
          description: data.emailSent ? "Email sent to opponent!" : "Match created!",
        });
        setShowChallengeModal(false);
        setTimeout(() => router.push(`/game/speed-deploy/${data.match.matchCode}`), 1000);
      }
    } catch (err) {
      console.error("Failed to create challenge:", err);
    } finally {
      setChallenging(null);
    }
  };

  // Fetch a new brief
  const fetchBrief = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/gaming/speed-deploy/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      
      if (response.ok) {
        const data = await response.json();
        setBrief(data);
        setSelectedServices(new Array(6).fill(null)); // 6 slots for services
        setTimeLeft(data.time_limit);
        setBriefingTimeLeft(BRIEFING_DURATION);
        setResult(null);
        return data;
      } else {
        const error = await response.json();
        alert(error.error || "Failed to generate brief. Please check your API key in Settings.");
      }
    } catch (error) {
      console.error("Failed to fetch brief:", error);
      alert("Failed to connect to the server.");
    }
    setIsLoading(false);
    return null;
  }, []);

  // Start a new round
  const startRound = useCallback(async () => {
    const newBrief = await fetchBrief();
    if (newBrief) {
      setGameState(prev => ({ ...prev, status: "briefing" }));
      setIsLoading(false);
    }
  }, [fetchBrief]);

  // Handle briefing countdown
  useEffect(() => {
    if (gameState.status !== "briefing") return;
    
    briefingTimerRef.current = setInterval(() => {
      setBriefingTimeLeft(prev => {
        if (prev <= 1) {
          setGameState(p => ({ ...p, status: "building" }));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (briefingTimerRef.current) clearInterval(briefingTimerRef.current);
    };
  }, [gameState.status]);

  // Deploy and validate
  const handleDeploy = useCallback(async () => {
    if (!brief) return;
    
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState(prev => ({ ...prev, status: "deploying" }));
    
    const submittedServices = selectedServices
      .filter((s): s is AWSService => s !== null)
      .map(s => s.id);
    
    try {
      const response = await fetch("/api/gaming/speed-deploy/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief_id: brief.id,
          client_name: brief.client_name,
          industry: brief.industry,
          requirements: brief.requirements,
          available_services: brief.available_services,
          optimal_solution: brief.optimal_solution,
          acceptable_solutions: brief.acceptable_solutions,
          trap_services: brief.trap_services || [],
          time_limit: brief.time_limit,
          difficulty: brief.difficulty,
          max_score: brief.max_score,
          learning_point: brief.learning_point || "",
          submitted_services: submittedServices,
          time_remaining: timeLeft,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setResult(data);
        setGameState(prev => ({
          ...prev,
          status: "result",
          score: data.score,
          roundsPlayed: prev.roundsPlayed + 1,
          roundsWon: prev.roundsWon + (data.met_requirements ? 1 : 0),
          totalScore: prev.totalScore + data.score,
          bestScore: Math.max(prev.bestScore, data.score),
        }));
      }
    } catch (error) {
      console.error("Validation failed:", error);
      setGameState(prev => ({ ...prev, status: "result" }));
    }
  }, [brief, selectedServices, timeLeft]);

  // Handle build timer
  useEffect(() => {
    if (gameState.status !== "building") return;
    
    const handleDeployRef = handleDeploy;
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Use setTimeout to avoid calling setState in effect
          setTimeout(() => handleDeployRef(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState.status, handleDeploy]);

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


  // Skip briefing
  const skipBriefing = () => {
    if (briefingTimerRef.current) clearInterval(briefingTimerRef.current);
    setGameState(prev => ({ ...prev, status: "building" }));
  };

  // Auth check
  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Rocket className="w-16 h-16 text-cyan-500 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Initializing...</p>
        </div>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const filledSlots = selectedServices.filter(s => s !== null).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden relative flex flex-col">
      {/* Enhanced Background with Animations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-[#0a0a0a] to-gray-950" />
        
        {/* Animated floating particles */}
        <div className="absolute inset-0">
          {backgroundParticles.map((p, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400/30 rounded-full"
              animate={{
                y: [0, -100, 0],
                x: [0, p.dx, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                delay: p.delay,
                ease: "easeInOut"
              }}
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
              }}
            />
          ))}
        </div>
        
        {/* Radial gradient with animation */}
        <motion.div 
          className="absolute inset-0"
          animate={{
            background: [
              'radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 30% 70%, rgba(6, 182, 212, 0.15) 0%, transparent 50%)',
              'radial-gradient(circle at 70% 30%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)',
            ]
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Grid overlay */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/game">
              <Button variant="ghost" size="sm" className="gap-2 text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Rocket className="w-6 h-6 text-cyan-400" />
              <span className="text-lg font-bold">Speed Deploy</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-slate-400">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="font-mono">{gameState.totalScore}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Target className="w-4 h-4 text-green-400" />
              <span className="font-mono">{gameState.roundsWon}/{gameState.roundsPlayed}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 min-h-0 max-w-7xl mx-auto w-full px-4 py-4 overflow-y-auto">
        
        {/* Ready State */}
        {gameState.status === "ready" && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={RACE_IN_CONTAINER}
            className="space-y-6"
          >
            {/* Hero Section */}
            <motion.div variants={RACE_IN_UP} className="text-center py-6">
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  rotate: [0, 1, -1, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="inline-block mb-4"
              >
                <Rocket className="w-24 h-24 text-cyan-400 drop-shadow-[0_0_30px_rgba(6,182,212,0.5)]" />
              </motion.div>

              <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Speed Deploy
              </h1>
              <p className="text-lg text-slate-300 mb-1 max-w-2xl mx-auto">
                Architectural Judgment Under Pressure
              </p>
              <p className="text-slate-400 mb-6 max-w-xl mx-auto">
                Race against time (and opponents) to build the optimal AWS architecture.
                Not just trivia - real architectural decision-making where every choice matters.
              </p>
            </motion.div>

            {/* Game Features */}
            <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-6">
              <motion.div
                whileHover={{ scale: 1.02 }}
                variants={RACE_IN_LEFT}
                className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 rounded-xl p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-cyan-400">Graded Scoring</h3>
                </div>
                <p className="text-sm text-slate-400">
                  Earn grades S-F based on correctness, speed, cost efficiency, and avoiding overengineering
                </p>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                variants={RACE_IN_UP}
                className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-xl p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-amber-400">Trap Services</h3>
                </div>
                <p className="text-sm text-slate-400">
                  Learn why technically valid solutions might be suboptimal in real-world scenarios
                </p>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                variants={RACE_IN_RIGHT}
                className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-green-400">Learning Points</h3>
                </div>
                <p className="text-sm text-slate-400">
                  Every round teaches key architectural lessons that apply to AWS certification exams
                </p>
              </motion.div>
            </div>

            {/* Mode Selection */}
            <motion.div variants={RACE_IN_UP} className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
              {/* Solo Mode */}
              <motion.div variants={RACE_IN_LEFT} className="flex-1">
                <Button
                  onClick={startRound}
                  disabled={isLoading}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-6 text-lg gap-3 flex-col h-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <User className="w-8 h-8" />
                      <span className="font-bold">Solo Mode</span>
                      <span className="text-xs text-cyan-200">Race the clock</span>
                    </>
                  )}
                </Button>
              </motion.div>
              
              {/* PvP Mode */}
              <motion.div variants={RACE_IN_RIGHT} className="flex-1">
                <Button
                  onClick={() => setShowChallengeModal(true)}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full border-cyan-500/50 hover:bg-cyan-500/10 text-white px-6 py-6 text-lg gap-3 flex-col h-auto"
                >
                  <Swords className="w-8 h-8 text-cyan-400" />
                  <span className="font-bold">Challenge</span>
                  <span className="text-xs text-slate-400">Race a teammate</span>
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {/* Challenge Modal */}
        {showChallengeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowChallengeModal(false)}
            />
            
            {/* Modal */}
            <div className="relative bg-gray-900 border border-cyan-500/30 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
              {/* Close button */}
              <button 
                onClick={() => setShowChallengeModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">🚀</div>
                <h3 className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  SPEED DEPLOY
                </h3>
                <p className="text-gray-400 text-sm mt-1">Challenge a teammate</p>
              </div>

              {/* Team members list */}
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {opponents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No team members found</p>
                    <p className="text-xs mt-1">Invite people to your team first!</p>
                  </div>
                ) : (
                  opponents.map((opponent) => (
                    <div 
                      key={opponent.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-800/50 border border-gray-700 hover:border-cyan-500/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold">
                          {(opponent.name || opponent.username || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">
                            {opponent.name || opponent.username || "Unknown"}
                          </p>
                          <p className="text-xs text-gray-500">{opponent.teamName}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleChallenge(opponent.id)}
                        disabled={challenging === opponent.id}
                        className="bg-cyan-500 hover:bg-cyan-400 text-white font-bold gap-2"
                      >
                        {challenging === opponent.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Swords className="w-4 h-4" />
                        )}
                        Challenge
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-gray-800 text-center">
                <p className="text-xs text-gray-500">
                  Your opponent will receive a challenge notification
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Briefing State */}
        {gameState.status === "briefing" && brief && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto"
          >
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/20 text-cyan-400 mb-4">
                <Clock className="w-4 h-4" />
                <span className="font-mono text-lg">{briefingTimeLeft}s</span>
              </div>
              <h2 className="text-2xl font-bold">📋 Client Brief</h2>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-4xl">{brief.icon}</span>
                <div>
                  <h3 className="text-xl font-bold">{brief.client_name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">{brief.industry}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded border", DIFFICULTY_COLORS[brief.difficulty])}>
                      {brief.difficulty}
                    </span>
                  </div>
                </div>
              </div>
              
              <h4 className="text-sm font-medium text-slate-400 mb-3">Requirements</h4>
              <div className="space-y-2 mb-6">
                {brief.requirements.map((req, i) => {
                  const Icon = CATEGORY_ICONS[req.category] || Server;
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50">
                      <Icon className="w-4 h-4 mt-0.5 text-slate-400" />
                      <div className="flex-1">
                        <p className="text-sm text-slate-200">{req.description}</p>
                      </div>
                      <span className={cn("text-xs px-2 py-0.5 rounded", PRIORITY_COLORS[req.priority])}>
                        {req.priority}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>Time to build: {brief.time_limit}s</span>
                <span>Max score: {brief.max_score}</span>
              </div>
            </div>
            
            <div className="text-center mt-6">
              <Button onClick={skipBriefing} variant="outline" className="gap-2">
                <Zap className="w-4 h-4" />
                Skip & Start Building
              </Button>
            </div>
          </motion.div>
        )}

        {/* Building State */}
        {gameState.status === "building" && brief && (
          <div className="flex gap-6 h-[calc(100vh-200px)]">
            {/* Main Build Area */}
            <div className="flex-1 flex flex-col">
              {/* Timer & Client Info */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{brief.icon}</span>
                  <div>
                    <h3 className="font-bold">{brief.client_name}</h3>
                    <span className="text-sm text-slate-500">{brief.industry}</span>
                  </div>
                </div>
                
                <div className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full font-mono text-xl",
                  timeLeft <= 10 ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-slate-800 text-white"
                )}>
                  <Clock className="w-5 h-5" />
                  {timeLeft}s
                </div>
              </div>
              
              {/* Requirements Summary */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 mb-4">
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
                      {req.description}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Architecture Slots */}
              <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-slate-400">Your Architecture ({filledSlots}/6 services)</h4>
                  <Button
                    onClick={handleDeploy}
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

        {/* Deploying State */}
        {gameState.status === "deploying" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Rocket className="w-24 h-24 text-cyan-400 mx-auto mb-6 animate-bounce" />
            <h2 className="text-2xl font-bold mb-2">Deploying...</h2>
            <p className="text-slate-400">Validating your architecture</p>
          </motion.div>
        )}

        {/* Result State */}
        {gameState.status === "result" && result && brief && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto"
          >
            {/* Grade & Score Header */}
            <div className={cn(
              "text-center p-8 rounded-xl border mb-6",
              result.grade === "S" || result.grade === "A"
                ? "bg-green-500/10 border-green-500/30" 
                : result.grade === "B" || result.grade === "C"
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-red-500/10 border-red-500/30"
            )}>
              {/* Grade Badge */}
              <div className={cn(
                "w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center text-4xl font-bold",
                result.grade === "S" ? "bg-yellow-500/20 text-yellow-400 ring-2 ring-yellow-500" :
                result.grade === "A" ? "bg-green-500/20 text-green-400" :
                result.grade === "B" ? "bg-cyan-500/20 text-cyan-400" :
                result.grade === "C" ? "bg-amber-500/20 text-amber-400" :
                result.grade === "D" ? "bg-orange-500/20 text-orange-400" :
                "bg-red-500/20 text-red-400"
              )}>
                {result.grade || (result.is_optimal ? "S" : result.met_requirements ? "B" : "F")}
              </div>
              
              <h2 className="text-2xl font-bold mb-2">{result.feedback}</h2>
              
              <div className="text-4xl font-bold text-cyan-400 mb-4">
                {result.score} / {result.max_score}
              </div>
              
              {/* Score Breakdown */}
              <div className="flex flex-wrap justify-center gap-3 text-xs">
                {(result.correctness_score || 0) > 0 && (
                  <span className="px-2 py-1 rounded bg-slate-800 text-slate-300">
                    Base: {result.correctness_score}
                  </span>
                )}
                {(result.speed_bonus || 0) > 0 && (
                  <span className="px-2 py-1 rounded bg-green-500/20 text-green-400">
                    +{result.speed_bonus} speed
                  </span>
                )}
                {(result.cost_efficiency_bonus || 0) > 0 && (
                  <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-400">
                    +{result.cost_efficiency_bonus} cost efficient
                  </span>
                )}
                {(result.overengineering_penalty || 0) > 0 && (
                  <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">
                    -{result.overengineering_penalty} overengineered
                  </span>
                )}
                {(result.trap_penalty || 0) > 0 && (
                  <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400">
                    -{result.trap_penalty} suboptimal choice
                  </span>
                )}
                {(result.missed_requirement_penalty || 0) > 0 && (
                  <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">
                    -{result.missed_requirement_penalty} missed requirements
                  </span>
                )}
              </div>
            </div>
            
            {/* Trap Services Used - Key Learning */}
            {result.trap_services_used && result.trap_services_used.length > 0 && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-orange-400 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Suboptimal Choices (Trap Services)
                </h4>
                <div className="space-y-2">
                  {result.trap_services_used.map((trap: { service_id: string; why_suboptimal: string; penalty: number }, i: number) => {
                    const svc = AWS_SERVICES.find(s => s.id === trap.service_id);
                    return (
                      <div key={i} className="flex items-start gap-3 p-2 rounded bg-slate-900/50">
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {svc && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: svc.color }} />}
                          <span className="text-sm font-medium text-orange-400">{svc?.shortName || trap.service_id}</span>
                          <span className="text-xs text-red-400">-{trap.penalty}pts</span>
                        </div>
                        <p className="text-xs text-slate-400">{trap.why_suboptimal}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Learning Point */}
            {result.learning_point && (
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-cyan-400 mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Key Takeaway
                </h4>
                <p className="text-sm text-slate-300">{result.learning_point}</p>
              </div>
            )}
            
            {/* Requirement Analysis */}
            {result.requirement_analysis && result.requirement_analysis.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-slate-400 mb-3">Requirement Analysis</h4>
                <div className="space-y-2">
                  {result.requirement_analysis.map((analysis: { 
                    category: string; 
                    description: string; 
                    priority: string; 
                    met: boolean;
                    status?: string;
                    your_services?: string[];
                    recommended?: string[];
                    missing?: string[];
                  }, i: number) => (
                    <div 
                      key={i}
                      className={cn(
                        "p-3 rounded-lg",
                        analysis.met ? "bg-green-500/10" : 
                        analysis.status === "partial" ? "bg-amber-500/10" : "bg-red-500/10"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                          analysis.met ? "bg-green-500/20 text-green-400" : 
                          analysis.status === "partial" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
                        )}>
                          {analysis.met ? <Check className="w-3 h-3" /> : 
                           analysis.status === "partial" ? <AlertTriangle className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "text-xs px-1.5 py-0.5 rounded uppercase font-medium",
                              analysis.priority === "critical" ? "bg-red-500/20 text-red-400" : "bg-slate-700 text-slate-400"
                            )}>
                              {analysis.priority}
                            </span>
                            <span className="text-xs text-slate-500 capitalize">{analysis.category}</span>
                            {analysis.status === "partial" && (
                              <span className="text-xs text-amber-400">Incomplete</span>
                            )}
                          </div>
                          <p className={cn(
                            "text-sm mb-2",
                            analysis.met ? "text-green-400" : 
                            analysis.status === "partial" ? "text-amber-400" : "text-red-400"
                          )}>
                            {analysis.description}
                          </p>
                          
                          {/* Show services used for this requirement */}
                          {analysis.your_services && analysis.your_services.length > 0 && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-500">Your services:</span>
                              <div className="flex flex-wrap gap-1">
                                {analysis.your_services.map((svcId: string) => {
                                  const svc = AWS_SERVICES.find(s => s.id === svcId);
                                  return svc ? (
                                    <span key={svcId} className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                                      {svc.shortName}
                                    </span>
                                  ) : (
                                    <span key={svcId} className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                                      {svcId}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Show missing services for this requirement */}
                          {analysis.missing && analysis.missing.length > 0 && (
                            <div className="flex items-center gap-2 text-xs mt-1">
                              <span className="text-red-400">Missing:</span>
                              <div className="flex flex-wrap gap-1">
                                {analysis.missing.map((svcId: string) => {
                                  const svc = AWS_SERVICES.find(s => s.id === svcId);
                                  return svc ? (
                                    <span key={svcId} className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                                      {svc.shortName}
                                    </span>
                                  ) : (
                                    <span key={svcId} className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                                      {svcId}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing & Extra Services */}
            {(result.missing_services?.length > 0 || result.extra_services?.length > 0) && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                {result.missing_services?.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Missing Services
                    </h4>
                    <div className="space-y-1">
                      {result.missing_services.map((svcId: string) => {
                        const svc = AWS_SERVICES.find(s => s.id === svcId);
                        return svc ? (
                          <div key={svcId} className="flex items-center gap-2 text-xs text-slate-400">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: svc.color }} />
                            <span>{svc.shortName}</span>
                          </div>
                        ) : (
                          <div key={svcId} className="text-xs text-slate-500">{svcId}</div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {result.extra_services?.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Unnecessary Services
                    </h4>
                    <div className="space-y-1">
                      {result.extra_services.map((svcId: string) => {
                        const svc = AWS_SERVICES.find(s => s.id === svcId);
                        return svc ? (
                          <div key={svcId} className="flex items-center gap-2 text-xs text-slate-400">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: svc.color }} />
                            <span>{svc.shortName}</span>
                          </div>
                        ) : (
                          <div key={svcId} className="text-xs text-slate-500">{svcId}</div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Optimal Solution */}
            {!result.is_optimal && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-medium text-slate-400 mb-2">Optimal Solution</h4>
                <div className="flex flex-wrap gap-2">
                  {result.optimal_solution.map((svcId: string) => {
                    const svc = AWS_SERVICES.find(s => s.id === svcId);
                    return svc ? (
                      <div key={svcId} className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: svc.color }} />
                        <span className="text-xs text-slate-300">{svc.shortName}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex gap-4 justify-center">
              <Button onClick={startRound} className="bg-cyan-600 hover:bg-cyan-700 gap-2">
                <RotateCcw className="w-4 h-4" />
                Next Round
              </Button>
              <Link href="/game">
                <Button variant="outline" className="gap-2">
                  <Home className="w-4 h-4" />
                  Back to Games
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
