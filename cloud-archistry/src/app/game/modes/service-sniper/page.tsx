"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Target,
  Crosshair,
  Trophy,
  Flame,
  RotateCcw,
  Home,
  X,
  Check,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AWS_SERVICES } from "@/lib/aws-services";

// Use all real AWS services from the registry
const REAL_AWS_SERVICES = AWS_SERVICES.map(s => ({
  id: s.id,
  name: s.name,
  shortName: s.shortName,
  color: s.color,
}));

// Fake AWS Services (convincing but not real) - expanded list
const FAKE_AWS_SERVICES = [
  { id: "fake1", name: "AWS CloudMagic", shortName: "CloudMagic", color: "#8C4FFF" },
  { id: "fake2", name: "Amazon DataStream Pro", shortName: "DataStream Pro", color: "#3B48CC" },
  { id: "fake3", name: "AWS ServerlessDB", shortName: "ServerlessDB", color: "#3B48CC" },
  { id: "fake4", name: "Amazon QuickScale", shortName: "QuickScale", color: "#ED7100" },
  { id: "fake5", name: "AWS ContainerHub", shortName: "ContainerHub", color: "#ED7100" },
  { id: "fake6", name: "Amazon FlexCompute", shortName: "FlexCompute", color: "#ED7100" },
  { id: "fake7", name: "AWS InstaCache", shortName: "InstaCache", color: "#3B48CC" },
  { id: "fake8", name: "Amazon StreamFlow", shortName: "StreamFlow", color: "#8C4FFF" },
  { id: "fake9", name: "AWS AutoDeploy", shortName: "AutoDeploy", color: "#3F8624" },
  { id: "fake10", name: "Amazon CloudSync", shortName: "CloudSync", color: "#8C4FFF" },
  { id: "fake11", name: "AWS DataVault", shortName: "DataVault", color: "#3F8624" },
  { id: "fake12", name: "Amazon NetBridge", shortName: "NetBridge", color: "#8C4FFF" },
  { id: "fake13", name: "AWS SecureZone", shortName: "SecureZone", color: "#DD344C" },
  { id: "fake14", name: "Amazon QueryPro", shortName: "QueryPro", color: "#8C4FFF" },
  { id: "fake15", name: "AWS FlowManager", shortName: "FlowManager", color: "#E7157B" },
  { id: "fake16", name: "Amazon EdgeCache", shortName: "EdgeCache", color: "#8C4FFF" },
  { id: "fake17", name: "AWS MicroLambda", shortName: "MicroLambda", color: "#ED7100" },
  { id: "fake18", name: "Amazon TableStore", shortName: "TableStore", color: "#3B48CC" },
  { id: "fake19", name: "AWS LogStream", shortName: "LogStream", color: "#E7157B" },
  { id: "fake20", name: "Amazon IdentityHub", shortName: "IdentityHub", color: "#DD344C" },
  { id: "fake21", name: "AWS QuickDeploy", shortName: "QuickDeploy", color: "#3F8624" },
  { id: "fake22", name: "Amazon ServerMesh", shortName: "ServerMesh", color: "#ED7100" },
  { id: "fake23", name: "AWS DataLake Pro", shortName: "DataLake Pro", color: "#8C4FFF" },
  { id: "fake24", name: "Amazon AutoScale Plus", shortName: "AutoScale Plus", color: "#ED7100" },
  { id: "fake25", name: "AWS CloudBridge", shortName: "CloudBridge", color: "#8C4FFF" },
  { id: "fake26", name: "Amazon SecureVault", shortName: "SecureVault", color: "#DD344C" },
  { id: "fake27", name: "AWS FastCache", shortName: "FastCache", color: "#3B48CC" },
  { id: "fake28", name: "Amazon StreamDB", shortName: "StreamDB", color: "#3B48CC" },
  { id: "fake29", name: "AWS NetFlow", shortName: "NetFlow", color: "#8C4FFF" },
  { id: "fake30", name: "Amazon ComputeX", shortName: "ComputeX", color: "#ED7100" },
  { id: "fake31", name: "AWS DataSync Pro", shortName: "DataSync Pro", color: "#3F8624" },
  { id: "fake32", name: "Amazon CloudStore", shortName: "CloudStore", color: "#3F8624" },
  { id: "fake33", name: "AWS APIConnect", shortName: "APIConnect", color: "#E7157B" },
  { id: "fake34", name: "Amazon LogAnalyzer", shortName: "LogAnalyzer", color: "#E7157B" },
  { id: "fake35", name: "AWS IdentityGuard", shortName: "IdentityGuard", color: "#DD344C" },
  { id: "fake36", name: "Amazon QueuePro", shortName: "QueuePro", color: "#E7157B" },
  { id: "fake37", name: "AWS ContainerX", shortName: "ContainerX", color: "#ED7100" },
  { id: "fake38", name: "Amazon GraphDB", shortName: "GraphDB", color: "#3B48CC" },
  { id: "fake39", name: "AWS EventFlow", shortName: "EventFlow", color: "#E7157B" },
  { id: "fake40", name: "Amazon CodeRunner", shortName: "CodeRunner", color: "#ED7100" },
];

interface ActiveTarget {
  id: string;
  service: typeof REAL_AWS_SERVICES[0];
  isReal: boolean;
  x: number; // percentage
  y: number; // percentage
  spawnTime: number;
  lifetime: number; // ms before disappearing
  hit: boolean;
  hitAccuracy?: number; // 0-1, center = 1
}

interface GameState {
  status: "ready" | "playing" | "finished";
  score: number;
  streak: number;
  bestStreak: number;
  hits: number;
  misses: number;
  falsePositives: number; // Shot a fake service
  missed: number; // Let a real service escape
  timeRemaining: number;
  targetsSpawned: number;
}

const GAME_DURATION = 60; // seconds
const TARGET_LIFETIME_MIN = 2500; // ms
const TARGET_LIFETIME_MAX = 4500; // ms
const SPAWN_INTERVAL_MIN = 800; // ms
const SPAWN_INTERVAL_MAX = 1800; // ms
const MAX_ACTIVE_TARGETS = 5;

// Scoring
const POINTS_BULLSEYE = 100; // Center hit on real service
const POINTS_GOOD_HIT = 75; // Good hit on real service
const POINTS_EDGE_HIT = 50; // Edge hit on real service
const POINTS_MISS_FAKE = 25; // Correctly ignored a fake
const PENALTY_SHOOT_FAKE = -50; // Shot a fake service
const PENALTY_MISS_REAL = -25; // Let a real service escape

export default function ServiceSniperPage() {
  const router = useRouter();
  const { status: authStatus } = useSession();
  
  const [gameState, setGameState] = useState<GameState>({
    status: "ready",
    score: 0,
    streak: 0,
    bestStreak: 0,
    hits: 0,
    misses: 0,
    falsePositives: 0,
    missed: 0,
    timeRemaining: GAME_DURATION,
    targetsSpawned: 0,
  });
  
  const [activeTargets, setActiveTargets] = useState<ActiveTarget[]>([]);
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 });
  const [muzzleFlash, setMuzzleFlash] = useState(false);
  const [lastHit, setLastHit] = useState<{ x: number; y: number; points: number; type: "hit" | "miss" | "fake" } | null>(null);
  const [usedServices, setUsedServices] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState(0);
  
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track mouse position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (gameAreaRef.current) {
        const rect = gameAreaRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setCursorPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
      }
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Spawn targets
  const spawnTarget = useCallback(() => {
    if (activeTargets.length >= MAX_ACTIVE_TARGETS) return;
    
    // 60% real, 40% fake
    const isReal = Math.random() < 0.6;
    const servicePool = isReal ? REAL_AWS_SERVICES : FAKE_AWS_SERVICES;
    
    // Pick a service not recently used
    let service;
    let attempts = 0;
    do {
      service = servicePool[Math.floor(Math.random() * servicePool.length)];
      attempts++;
    } while (usedServices.has(service.id) && attempts < 10);
    
    // Mark as used (clear after 5 services)
    setUsedServices(prev => {
      const newSet = new Set(prev);
      newSet.add(service.id);
      if (newSet.size > 5) {
        const first = newSet.values().next().value;
        if (first) newSet.delete(first);
      }
      return newSet;
    });
    
    // Find a position that doesn't overlap with existing targets
    // Minimum distance between targets (percentage of screen)
    const MIN_DISTANCE = 15;
    let x = 0;
    let y = 0;
    let positionAttempts = 0;
    const maxPositionAttempts = 20;
    
    do {
      x = 10 + Math.random() * 80;
      y = 15 + Math.random() * 60;
      positionAttempts++;
      
      // Check distance from all active targets
      const tooClose = activeTargets.some(target => {
        const dx = x - target.x;
        const dy = y - target.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < MIN_DISTANCE;
      });
      
      if (!tooClose) break;
    } while (positionAttempts < maxPositionAttempts);
    
    // If we couldn't find a good spot after max attempts, skip this spawn
    if (positionAttempts >= maxPositionAttempts && activeTargets.length > 0) {
      return;
    }
    
    const lifetime = TARGET_LIFETIME_MIN + Math.random() * (TARGET_LIFETIME_MAX - TARGET_LIFETIME_MIN);
    
    const newTarget: ActiveTarget = {
      id: `target_${Date.now()}_${Math.random()}`,
      service,
      isReal,
      x,
      y,
      spawnTime: Date.now(),
      lifetime,
      hit: false,
    };
    
    setActiveTargets(prev => [...prev, newTarget]);
    setGameState(prev => ({ ...prev, targetsSpawned: prev.targetsSpawned + 1 }));
  }, [activeTargets.length, usedServices]);

  // Update current time for animations
  useEffect(() => {
    if (gameState.status !== "playing") return;
    
    const timeUpdate = setInterval(() => {
      setCurrentTime(Date.now());
    }, 100);
    
    return () => clearInterval(timeUpdate);
  }, [gameState.status]);

  // Handle target expiration
  useEffect(() => {
    if (gameState.status !== "playing") return;
    
    const checkExpired = setInterval(() => {
      const now = Date.now();
      setActiveTargets(prev => {
        const expired = prev.filter(t => !t.hit && now - t.spawnTime > t.lifetime);
        const remaining = prev.filter(t => t.hit || now - t.spawnTime <= t.lifetime);
        
        // Penalize for letting real services escape
        expired.forEach(t => {
          if (t.isReal) {
            setGameState(gs => ({
              ...gs,
              score: Math.max(0, gs.score + PENALTY_MISS_REAL),
              missed: gs.missed + 1,
              streak: 0,
            }));
          } else {
            // Bonus for correctly ignoring fake
            setGameState(gs => ({
              ...gs,
              score: gs.score + POINTS_MISS_FAKE,
            }));
          }
        });
        
        return remaining;
      });
    }, 100);
    
    return () => clearInterval(checkExpired);
  }, [gameState.status]);

  // Game timer
  useEffect(() => {
    if (gameState.status !== "playing") return;
    
    gameTimerRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.timeRemaining <= 1) {
          return { ...prev, timeRemaining: 0, status: "finished" };
        }
        return { ...prev, timeRemaining: prev.timeRemaining - 1 };
      });
    }, 1000);
    
    return () => {
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    };
  }, [gameState.status]);

  // Spawn timer
  useEffect(() => {
    if (gameState.status !== "playing") return;
    
    const scheduleSpawn = () => {
      const delay = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
      spawnTimerRef.current = setTimeout(() => {
        spawnTarget();
        scheduleSpawn();
      }, delay);
    };
    
    // Initial spawn
    spawnTarget();
    scheduleSpawn();
    
    return () => {
      if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    };
  }, [gameState.status, spawnTarget]);

  // Handle shooting
  const handleShoot = (e: React.MouseEvent) => {
    if (gameState.status !== "playing") return;
    
    // Muzzle flash effect
    setMuzzleFlash(true);
    setTimeout(() => setMuzzleFlash(false), 100);
    
    const rect = gameAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Check if we hit any target
    let hitTarget: ActiveTarget | null = null;
    let hitAccuracy = 0;
    
    for (const target of activeTargets) {
      if (target.hit) continue;
      
      // Target is ~12% of screen width (bigger targets)
      const targetRadius = 6;
      const dx = clickX - target.x;
      const dy = clickY - target.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < targetRadius) {
        hitTarget = target;
        hitAccuracy = 1 - (distance / targetRadius); // 1 = center, 0 = edge
        break;
      }
    }
    
    if (hitTarget) {
      // Mark as hit
      setActiveTargets(prev => 
        prev.map(t => t.id === hitTarget!.id ? { ...t, hit: true, hitAccuracy } : t)
      );
      
      // Remove after animation
      setTimeout(() => {
        setActiveTargets(prev => prev.filter(t => t.id !== hitTarget!.id));
      }, 500);
      
      if (hitTarget.isReal) {
        // Good hit!
        let points = POINTS_EDGE_HIT;
        if (hitAccuracy > 0.8) points = POINTS_BULLSEYE;
        else if (hitAccuracy > 0.5) points = POINTS_GOOD_HIT;
        
        // Streak bonus
        const newStreak = gameState.streak + 1;
        if (newStreak >= 3) {
          points = Math.floor(points * (1 + newStreak * 0.1));
        }
        
        setGameState(prev => ({
          ...prev,
          score: prev.score + points,
          hits: prev.hits + 1,
          streak: newStreak,
          bestStreak: Math.max(prev.bestStreak, newStreak),
        }));
        
        setLastHit({ x: clickX, y: clickY, points, type: "hit" });
      } else {
        // Shot a fake!
        setGameState(prev => ({
          ...prev,
          score: Math.max(0, prev.score + PENALTY_SHOOT_FAKE),
          falsePositives: prev.falsePositives + 1,
          streak: 0,
        }));
        
        setLastHit({ x: clickX, y: clickY, points: PENALTY_SHOOT_FAKE, type: "fake" });
      }
    } else {
      // Missed everything
      setGameState(prev => ({
        ...prev,
        misses: prev.misses + 1,
        streak: 0,
      }));
      
      setLastHit({ x: clickX, y: clickY, points: 0, type: "miss" });
    }
    
    // Clear hit indicator
    setTimeout(() => setLastHit(null), 800);
  };

  const startGame = () => {
    setGameState({
      status: "playing",
      score: 0,
      streak: 0,
      bestStreak: 0,
      hits: 0,
      misses: 0,
      falsePositives: 0,
      missed: 0,
      timeRemaining: GAME_DURATION,
      targetsSpawned: 0,
    });
    setActiveTargets([]);
    setUsedServices(new Set());
  };

  const restartGame = () => {
    startGame();
  };

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Crosshair className="w-16 h-16 text-green-500 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Loading range...</p>
        </div>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const accuracy = gameState.hits + gameState.misses + gameState.falsePositives > 0
    ? Math.round((gameState.hits / (gameState.hits + gameState.misses + gameState.falsePositives)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden relative select-none">
      {/* Background - Shooting Range */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-50"
        style={{ backgroundImage: "url('/empty-dark-room-modern-futuristic-sci-fi-background-3d-illustration.jpg')" }}
      />
      <div className="fixed inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/70" />
      
      {/* Range lane markers */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-amber-900/30 to-transparent" />
        {[...Array(5)].map((_, i) => (
          <div 
            key={i}
            className="absolute bottom-4 text-amber-500/40 text-xs font-mono"
            style={{ left: `${15 + i * 17.5}%` }}
          >
            {(i + 1) * 10}m
          </div>
        ))}
      </div>

      {/* Header */}
      <nav className="relative z-50 border-b border-green-900/30 bg-black/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/game" className="flex items-center gap-2 text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            <span>Exit Range</span>
          </Link>
          
          <div className="flex items-center gap-6">
            {gameState.status === "playing" && (
              <>
                <div className="flex items-center gap-2 text-amber-400">
                  <Clock className="w-4 h-4" />
                  <span className="font-mono font-bold text-xl">{gameState.timeRemaining}s</span>
                </div>
                
                {gameState.streak >= 3 && (
                  <div className="flex items-center gap-1 text-orange-500 animate-pulse">
                    <Flame className="w-5 h-5" />
                    <span className="font-bold">{gameState.streak}x</span>
                  </div>
                )}
              </>
            )}
            
            <div className="flex items-center gap-2 text-yellow-500">
              <Trophy className="w-5 h-5" />
              <span className="font-bold text-xl">{gameState.score}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Game Area */}
      <main className="relative z-10 h-[calc(100vh-56px)]">
        {/* Ready State */}
        {gameState.status === "ready" && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="relative inline-block mb-8">
                <Target className="w-32 h-32 text-green-500 mx-auto" />
                <div className="absolute inset-0 animate-ping">
                  <Target className="w-32 h-32 text-green-500/30 mx-auto" />
                </div>
              </div>
              
              <h1 className="text-5xl font-black mb-4">
                <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                  SERVICE SNIPER
                </span>
              </h1>
              
              <p className="text-gray-400 text-lg mb-2 max-w-md mx-auto">
                Shoot <span className="text-green-400 font-bold">REAL</span> AWS services.
                <br />
                Avoid the <span className="text-red-400 font-bold">FAKES</span>.
              </p>
              <p className="text-gray-500 text-sm mb-8">
                Targets appear and disappear - be quick and accurate!
              </p>
              
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8 text-sm">
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                  <p className="text-gray-400">60 Seconds</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <Target className="w-6 h-6 text-green-400 mx-auto mb-2" />
                  <p className="text-gray-400">Hit Real Services</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <X className="w-6 h-6 text-red-400 mx-auto mb-2" />
                  <p className="text-gray-400">Ignore Fakes</p>
                </div>
              </div>
              
              <Button
                size="lg"
                onClick={startGame}
                className="bg-green-600 hover:bg-green-500 text-white font-bold text-xl px-12 py-6 rounded-xl"
              >
                <Crosshair className="w-6 h-6 mr-2" />
                START RANGE
              </Button>
            </div>
          </div>
        )}

        {/* Playing State */}
        {gameState.status === "playing" && (
          <div 
            ref={gameAreaRef}
            className="relative w-full h-full cursor-crosshair"
            onClick={handleShoot}
          >
            {/* Custom crosshair */}
            <div 
              className="fixed pointer-events-none z-50 transition-transform duration-75"
              style={{ 
                left: `${cursorPos.x}%`, 
                top: `calc(56px + ${cursorPos.y}% * (100vh - 56px) / 100vh)`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className={`relative ${muzzleFlash ? "scale-125" : ""} transition-transform duration-75`}>
                <div className="w-8 h-8 border-2 border-green-400/80 rounded-full" />
                <div className="absolute top-1/2 left-0 w-2 h-0.5 bg-green-400/80 -translate-y-1/2" />
                <div className="absolute top-1/2 right-0 w-2 h-0.5 bg-green-400/80 -translate-y-1/2" />
                <div className="absolute left-1/2 top-0 w-0.5 h-2 bg-green-400/80 -translate-x-1/2" />
                <div className="absolute left-1/2 bottom-0 w-0.5 h-2 bg-green-400/80 -translate-x-1/2" />
                <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-green-400 rounded-full -translate-x-1/2 -translate-y-1/2" />
              </div>
            </div>
            
            {/* Muzzle flash overlay */}
            {muzzleFlash && (
              <div className="fixed inset-0 bg-yellow-500/10 pointer-events-none z-40" />
            )}
            
            {/* Active Targets */}
            {activeTargets.map(target => {
              const elapsed = currentTime - target.spawnTime;
              const remaining = target.lifetime - elapsed;
              const urgency = remaining < 1000;
              
              return (
                <div
                  key={target.id}
                  className={`absolute transition-all duration-300 ${
                    target.hit 
                      ? "scale-150 opacity-0" 
                      : urgency 
                        ? "animate-pulse" 
                        : "animate-in zoom-in-50"
                  }`}
                  style={{
                    left: `${target.x}%`,
                    top: `${target.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  {/* Target board */}
                  <div className={`
                    relative w-32 h-36 flex flex-col items-center
                    ${target.hit && target.isReal ? "text-green-400" : ""}
                    ${target.hit && !target.isReal ? "text-red-400" : ""}
                  `}>
                    {/* Circular target */}
                    <div className={`
                      relative w-24 h-24 rounded-full border-4 flex items-center justify-center
                      transition-colors duration-200
                      ${target.hit 
                        ? target.isReal 
                          ? "border-green-400 bg-green-500/30" 
                          : "border-red-400 bg-red-500/30"
                        : `border-white/80 bg-black/60`
                      }
                      ${urgency && !target.hit ? "border-amber-400" : ""}
                    `}>
                      {/* Inner rings */}
                      <div className={`absolute inset-3 rounded-full border-2 ${
                        target.hit ? "border-current/50" : "border-gray-400/50"
                      }`} />
                      <div className={`absolute inset-6 rounded-full border-2 ${
                        target.hit ? "border-current/50" : "border-gray-500/50"
                      }`} />
                      {/* Center dot */}
                      <div className={`w-3 h-3 rounded-full ${
                        target.hit 
                          ? target.isReal ? "bg-green-400" : "bg-red-400"
                          : "bg-amber-400"
                      }`} />
                      
                      {/* Hit indicator */}
                      {target.hit && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {target.isReal ? (
                            <Check className="w-10 h-10 text-green-400" />
                          ) : (
                            <X className="w-10 h-10 text-red-400" />
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Service name plate */}
                    <div className={`
                      mt-2 px-4 py-1.5 rounded text-sm font-bold text-center whitespace-nowrap
                      ${target.hit 
                        ? target.isReal 
                          ? "bg-green-500/30 text-green-300 border border-green-500/50" 
                          : "bg-red-500/30 text-red-300 border border-red-500/50"
                        : "bg-black/70 text-white border border-gray-600"
                      }
                    `}>
                      {target.service.shortName}
                    </div>
                    
                    {/* Time remaining bar */}
                    {!target.hit && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-100 ${
                            urgency ? "bg-red-500" : "bg-green-500"
                          }`}
                          style={{ 
                            width: `${Math.max(0, (remaining / target.lifetime) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Hit feedback */}
            {lastHit && (
              <div 
                className="fixed pointer-events-none z-60 animate-in zoom-in-50 fade-out duration-500"
                style={{ 
                  left: `${lastHit.x}%`, 
                  top: `calc(56px + ${lastHit.y}% * (100vh - 56px) / 100vh)`,
                  transform: "translate(-50%, -100%)",
                }}
              >
                <div className={`
                  px-3 py-1 rounded-full font-bold text-lg
                  ${lastHit.type === "hit" ? "bg-green-500/80 text-white" : ""}
                  ${lastHit.type === "fake" ? "bg-red-500/80 text-white" : ""}
                  ${lastHit.type === "miss" ? "bg-gray-500/80 text-white" : ""}
                `}>
                  {lastHit.type === "hit" && `+${lastHit.points}`}
                  {lastHit.type === "fake" && `FAKE! ${lastHit.points}`}
                  {lastHit.type === "miss" && "MISS"}
                </div>
              </div>
            )}
            
            {/* HUD - Bottom */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-8 bg-black/60 backdrop-blur-sm px-6 py-3 rounded-xl border border-gray-700">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{gameState.hits}</p>
                <p className="text-xs text-gray-500">Hits</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{gameState.falsePositives}</p>
                <p className="text-xs text-gray-500">False +</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-400">{gameState.missed}</p>
                <p className="text-xs text-gray-500">Escaped</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-400">{gameState.bestStreak}</p>
                <p className="text-xs text-gray-500">Best Streak</p>
              </div>
            </div>
            
            {/* Instructions reminder */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center">
              <p className="text-sm text-gray-400">
                <span className="text-green-400">●</span> Shoot real AWS services | 
                <span className="text-red-400 ml-2">●</span> Don&apos;t shoot fakes
              </p>
            </div>
          </div>
        )}

        {/* Finished State */}
        {gameState.status === "finished" && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="relative w-32 h-32 mx-auto mb-6">
                {gameState.score >= 1500 ? (
                  <>
                    <Trophy className="w-32 h-32 text-yellow-500" />
                    <div className="absolute inset-0 animate-ping">
                      <Trophy className="w-32 h-32 text-yellow-500/30" />
                    </div>
                  </>
                ) : gameState.score >= 800 ? (
                  <Target className="w-32 h-32 text-green-500" />
                ) : (
                  <Target className="w-32 h-32 text-gray-500" />
                )}
              </div>
              
              <h1 className="text-4xl font-black mb-2">
                {gameState.score >= 1500 ? (
                  <span className="text-yellow-400">SHARPSHOOTER!</span>
                ) : gameState.score >= 800 ? (
                  <span className="text-green-400">NICE SHOOTING!</span>
                ) : (
                  <span className="text-gray-400">RANGE COMPLETE</span>
                )}
              </h1>
              
              <p className="text-6xl font-black text-yellow-500 mb-8">
                {gameState.score}
              </p>
              
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 max-w-xl mx-auto mb-8">
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <p className="text-3xl font-bold text-green-400">{gameState.hits}</p>
                  <p className="text-sm text-gray-500">Hits</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <p className="text-3xl font-bold text-red-400">{gameState.falsePositives}</p>
                  <p className="text-sm text-gray-500">False Positives</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <p className="text-3xl font-bold text-amber-400">{gameState.missed}</p>
                  <p className="text-sm text-gray-500">Escaped</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <p className="text-3xl font-bold text-orange-400">{gameState.bestStreak}</p>
                  <p className="text-sm text-gray-500">Best Streak</p>
                </div>
              </div>
              
              {/* Accuracy */}
              <div className="max-w-md mx-auto mb-8">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Accuracy</span>
                  <span className="text-white font-bold">{accuracy}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                    style={{ width: `${accuracy}%` }}
                  />
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={() => router.push("/game")}
                  className="gap-2"
                >
                  <Home className="w-4 h-4" />
                  Back to Arena
                </Button>
                <Button
                  onClick={restartGame}
                  className="bg-green-600 hover:bg-green-500 gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
