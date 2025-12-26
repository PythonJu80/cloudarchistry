"use client";

/**
 * Architect Arena Lobby
 * 
 * Construction-themed lobby where users select difficulty before starting the game.
 * Links to the actual game page with difficulty passed as query param.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Clock,
  Loader2,
  Zap,
  Target,
  Brain,
  Rocket,
  Play,
  CheckCircle2,
  Hammer,
  Wrench,
  HardHat,
  Building2,
  Server,
  Cloud,
  Database,
  Shield,
  Construction,
  Cog,
  Network,
  Box,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Difficulty = "easy" | "medium" | "hard" | "expert";

const DIFFICULTY_CONFIG: Record<Difficulty, {
  label: string;
  time: number;
  description: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
}> = {
  easy: {
    label: "Easy",
    time: 300,
    description: "Clear requirements, common patterns, logical service groupings",
    icon: <Zap className="w-6 h-6" />,
    color: "text-green-400",
    gradient: "from-green-600 to-emerald-600",
  },
  medium: {
    label: "Medium",
    time: 420,
    description: "Nuanced requirements, some ambiguous decisions to make",
    icon: <Target className="w-6 h-6" />,
    color: "text-blue-400",
    gradient: "from-blue-600 to-cyan-600",
  },
  hard: {
    label: "Hard",
    time: 600,
    description: "Complex dependencies, security-first, multi-AZ considerations",
    icon: <Brain className="w-6 h-6" />,
    color: "text-purple-400",
    gradient: "from-purple-600 to-pink-600",
  },
  expert: {
    label: "Expert",
    time: 900,
    description: "Enterprise scenarios, DR patterns, cost vs performance trade-offs",
    icon: <Rocket className="w-6 h-6" />,
    color: "text-orange-400",
    gradient: "from-orange-600 to-red-600",
  },
};

const SKILL_PIECE_COUNT: Record<string, number> = {
  beginner: 10,
  intermediate: 20,
  advanced: 30,
  expert: 40,
};

export default function ArchitectArenaLobby() {
  const router = useRouter();
  const { status: authStatus } = useSession();
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("medium");
  const [userSkillLevel, setUserSkillLevel] = useState<string>("intermediate");

  // Fetch user's skill level on mount
  useEffect(() => {
    if (authStatus === "authenticated") {
      fetch("/api/profile")
        .then((res) => res.json())
        .then((data) => {
          if (data.skillLevel) {
            setUserSkillLevel(data.skillLevel);
          }
        })
        .catch(() => {});
    }
  }, [authStatus]);

  const startGame = () => {
    router.push(`/game/modes/architect-arena?difficulty=${selectedDifficulty}`);
  };

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
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden relative">
      {/* Animated Construction Site Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        
        {/* Full City Skyline at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-72">
          {/* Far left buildings */}
          <div className="absolute bottom-0 left-0 w-8 h-20 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-sm opacity-30" />
          <div className="absolute bottom-0 left-[2%] w-12 h-36 bg-gradient-to-t from-slate-800 to-slate-600 rounded-t-sm opacity-40">
            <div className="absolute inset-x-1 top-2 grid grid-cols-2 gap-1">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-1.5 bg-cyan-400/20 rounded-sm animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
              ))}
            </div>
          </div>
          <div className="absolute bottom-0 left-[5%] w-16 h-44 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-sm opacity-45">
            <div className="absolute inset-x-1 top-2 grid grid-cols-3 gap-1">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="h-2 bg-blue-400/25 rounded-sm animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
          <div className="absolute bottom-0 left-[9%] w-10 h-28 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-sm opacity-35" />
          <div className="absolute bottom-0 left-[12%] w-20 h-56 bg-gradient-to-t from-slate-800 to-slate-600 rounded-t-sm opacity-50">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-5 bg-red-500/50 animate-pulse" />
            <div className="absolute inset-x-2 top-6 grid grid-cols-4 gap-1">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="h-2 bg-purple-400/20 rounded-sm animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
          <div className="absolute bottom-0 left-[17%] w-8 h-24 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-sm opacity-35" />
          <div className="absolute bottom-0 left-[20%] w-14 h-40 bg-gradient-to-t from-slate-800 to-slate-600 rounded-t-sm opacity-45">
            <div className="absolute inset-x-1 top-3 grid grid-cols-3 gap-1">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="h-2 bg-green-400/20 rounded-sm" style={{ opacity: i % 2 === 0 ? 1 : 0.3 }} />
              ))}
            </div>
          </div>
          <div className="absolute bottom-0 left-[24%] w-12 h-32 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-sm opacity-40" />
          
          {/* Center-left tall building */}
          <div className="absolute bottom-0 left-[28%] w-24 h-64 bg-gradient-to-t from-slate-800 to-slate-600 rounded-t-sm opacity-50">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-8 bg-red-500/50 animate-pulse" />
            <div className="absolute inset-x-2 top-10 grid grid-cols-5 gap-1">
              {[...Array(25)].map((_, i) => (
                <div key={i} className="h-2 bg-yellow-400/20 rounded-sm" style={{ opacity: i % 2 === 0 ? 1 : 0.3 }} />
              ))}
            </div>
          </div>
          <div className="absolute bottom-0 left-[35%] w-10 h-28 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-sm opacity-35" />
          
          {/* Construction crane */}
          <div className="absolute bottom-0 left-[38%]">
            <div className="w-4 h-80 bg-gradient-to-t from-yellow-600 to-yellow-500 opacity-70">
              <div className="absolute inset-0 flex flex-col justify-evenly">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-px bg-yellow-800/50" />
                ))}
              </div>
            </div>
            <div className="absolute bottom-72 left-0 w-44 h-3 bg-yellow-500/70 origin-left" style={{ transform: "rotate(-3deg)" }}>
              <div className="absolute right-4 top-full w-px h-20 bg-slate-400/50" />
              <div className="absolute right-2 top-[calc(100%+5rem)] w-8 h-10 border-2 border-cyan-400/40 bg-cyan-500/15 animate-pulse" />
            </div>
            <div className="absolute bottom-72 right-full w-16 h-3 bg-yellow-500/70" />
            <div className="absolute bottom-64 right-[calc(100%+0.75rem)] w-5 h-8 bg-slate-600/70" />
          </div>
          
          {/* Center buildings */}
          <div className="absolute bottom-0 left-[44%] w-14 h-36 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-sm opacity-40">
            <div className="absolute inset-x-1 top-2 grid grid-cols-3 gap-1">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="h-2 bg-cyan-400/25 rounded-sm animate-pulse" style={{ animationDelay: `${i * 0.25}s` }} />
              ))}
            </div>
          </div>
          <div className="absolute bottom-0 left-[48%] w-18 h-48 bg-gradient-to-t from-slate-800 to-slate-600 rounded-t-sm opacity-45">
            <div className="absolute inset-x-2 top-4 grid grid-cols-4 gap-1">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="h-2 bg-blue-400/20 rounded-sm animate-pulse" style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
          </div>
          <div className="absolute bottom-0 left-[53%] w-10 h-24 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-sm opacity-35" />
          <div className="absolute bottom-0 left-[56%] w-16 h-52 bg-gradient-to-t from-slate-800 to-slate-600 rounded-t-sm opacity-50">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-6 bg-red-500/60 animate-pulse" />
            <div className="absolute inset-x-2 top-8 grid grid-cols-3 gap-1">
              {[...Array(15)].map((_, i) => (
                <div key={i} className="h-2 bg-purple-400/25 rounded-sm" style={{ opacity: i % 3 === 0 ? 1 : 0.25 }} />
              ))}
            </div>
          </div>
          
          {/* Right side buildings */}
          <div className="absolute bottom-0 right-[38%] w-12 h-32 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-sm opacity-40" />
          <div className="absolute bottom-0 right-[34%] w-20 h-44 bg-gradient-to-t from-slate-800 to-slate-600 rounded-t-sm opacity-45">
            <div className="absolute inset-x-2 top-4 grid grid-cols-4 gap-1">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="h-2 bg-green-400/20 rounded-sm animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </div>
          <div className="absolute bottom-0 right-[29%] w-10 h-28 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-sm opacity-35" />
          <div className="absolute bottom-0 right-[25%] w-16 h-56 bg-gradient-to-t from-slate-800 to-slate-600 rounded-t-sm opacity-50">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-7 bg-red-500/50 animate-pulse" />
            <div className="absolute inset-x-2 top-9 grid grid-cols-3 gap-1">
              {[...Array(18)].map((_, i) => (
                <div key={i} className="h-2 bg-yellow-400/25 rounded-sm" style={{ opacity: i % 2 === 0 ? 1 : 0.3 }} />
              ))}
            </div>
          </div>
          <div className="absolute bottom-0 right-[20%] w-14 h-36 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-sm opacity-40">
            <div className="absolute inset-x-1 top-3 grid grid-cols-3 gap-1">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="h-2 bg-cyan-400/20 rounded-sm animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
          <div className="absolute bottom-0 right-[15%] w-10 h-24 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-sm opacity-35" />
          <div className="absolute bottom-0 right-[11%] w-18 h-48 bg-gradient-to-t from-slate-800 to-slate-600 rounded-t-sm opacity-45">
            <div className="absolute inset-x-2 top-4 grid grid-cols-4 gap-1">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="h-2 bg-blue-400/25 rounded-sm animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
          <div className="absolute bottom-0 right-[6%] w-14 h-40 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-sm opacity-40">
            <div className="absolute inset-x-1 top-3 grid grid-cols-3 gap-1">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="h-2 bg-purple-400/20 rounded-sm" style={{ opacity: i % 2 === 0 ? 1 : 0.25 }} />
              ))}
            </div>
          </div>
          <div className="absolute bottom-0 right-[2%] w-12 h-32 bg-gradient-to-t from-slate-800 to-slate-600 rounded-t-sm opacity-45" />
          <div className="absolute bottom-0 right-0 w-8 h-20 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-sm opacity-30" />
        </div>
        
        {/* Floating AWS service icons - staggered animations */}
        <div className="absolute top-[10%] left-[5%] animate-bounce" style={{ animationDuration: "3s" }}>
          <div className="w-12 h-12 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center backdrop-blur-sm">
            <Server className="w-6 h-6 text-orange-400/60" />
          </div>
        </div>
        <div className="absolute top-[15%] right-[8%] animate-bounce" style={{ animationDuration: "4s", animationDelay: "1s" }}>
          <div className="w-14 h-14 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center backdrop-blur-sm">
            <Database className="w-7 h-7 text-blue-400/60" />
          </div>
        </div>
        <div className="absolute top-[35%] left-[8%] animate-bounce" style={{ animationDuration: "3.5s", animationDelay: "0.5s" }}>
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center backdrop-blur-sm">
            <Cloud className="w-5 h-5 text-purple-400/60" />
          </div>
        </div>
        <div className="absolute top-[25%] right-[15%] animate-bounce" style={{ animationDuration: "4.5s", animationDelay: "2s" }}>
          <div className="w-16 h-16 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center backdrop-blur-sm">
            <Shield className="w-8 h-8 text-green-400/60" />
          </div>
        </div>
        <div className="absolute top-[45%] left-[3%] animate-bounce" style={{ animationDuration: "2.5s", animationDelay: "1.5s" }}>
          <div className="w-11 h-11 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center backdrop-blur-sm">
            <Network className="w-5 h-5 text-cyan-400/60" />
          </div>
        </div>
        <div className="absolute top-[40%] right-[5%] animate-bounce" style={{ animationDuration: "3.8s", animationDelay: "0.8s" }}>
          <div className="w-13 h-13 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center backdrop-blur-sm">
            <Box className="w-6 h-6 text-yellow-400/60" />
          </div>
        </div>
        
        {/* Animated connection lines */}
        <svg className="absolute inset-0 w-full h-full opacity-30">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="1" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lineGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
              <stop offset="50%" stopColor="#8b5cf6" stopOpacity="1" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="10%" y1="20%" x2="40%" y2="35%" stroke="url(#lineGradient)" strokeWidth="1" strokeDasharray="10 20">
            <animate attributeName="stroke-dashoffset" from="0" to="60" dur="3s" repeatCount="indefinite" />
          </line>
          <line x1="60%" y1="15%" x2="90%" y2="40%" stroke="url(#lineGradient2)" strokeWidth="1" strokeDasharray="15 25">
            <animate attributeName="stroke-dashoffset" from="0" to="80" dur="4s" repeatCount="indefinite" />
          </line>
          <line x1="5%" y1="45%" x2="35%" y2="30%" stroke="url(#lineGradient)" strokeWidth="1" strokeDasharray="8 15">
            <animate attributeName="stroke-dashoffset" from="0" to="46" dur="2.5s" repeatCount="indefinite" />
          </line>
          <line x1="65%" y1="25%" x2="95%" y2="45%" stroke="url(#lineGradient2)" strokeWidth="1" strokeDasharray="12 18">
            <animate attributeName="stroke-dashoffset" from="0" to="60" dur="3.5s" repeatCount="indefinite" />
          </line>
        </svg>
        
        {/* Particle sparkles */}
        <div className="absolute top-[20%] left-[20%] w-1 h-1 bg-cyan-400 rounded-full animate-ping opacity-60" style={{ animationDuration: "2s" }} />
        <div className="absolute top-[30%] right-[25%] w-1 h-1 bg-purple-400 rounded-full animate-ping opacity-60" style={{ animationDuration: "2.5s", animationDelay: "0.5s" }} />
        <div className="absolute top-[15%] left-[60%] w-1 h-1 bg-blue-400 rounded-full animate-ping opacity-60" style={{ animationDuration: "3s", animationDelay: "1s" }} />
        <div className="absolute top-[50%] right-[10%] w-1 h-1 bg-green-400 rounded-full animate-ping opacity-60" style={{ animationDuration: "2.2s", animationDelay: "0.3s" }} />
        <div className="absolute top-[40%] left-[15%] w-1 h-1 bg-yellow-400 rounded-full animate-ping opacity-60" style={{ animationDuration: "2.8s", animationDelay: "0.8s" }} />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-6">
        <div className="max-w-4xl w-full">
          {/* Header with construction crane emoji */}
          <div className="text-center mb-8">
            <div className="inline-block mb-4 relative">
              <span className="text-7xl animate-bounce" style={{ animationDuration: "2s" }}>🏗️</span>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-2 bg-cyan-500/20 rounded-full blur-md" />
            </div>
            <h1 className="text-5xl font-black bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-3 tracking-tight">
              Architect Arena
            </h1>
            <p className="text-slate-400 text-lg">Build AWS architectures against the clock</p>
          </div>

          {/* How to Play - Construction Zone */}
          <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <HardHat className="w-5 h-5 text-yellow-400" />
              Construction Zone
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-xl transition-transform hover:scale-105 hover:border-cyan-500/40">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <Hammer className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm mb-1">Drag & Drop</p>
                  <p className="text-slate-400 text-xs leading-relaxed">Position AWS services to build your architecture</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-xl transition-transform hover:scale-105 hover:border-purple-500/40">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Wrench className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm mb-1">Connect Services</p>
                  <p className="text-slate-400 text-xs leading-relaxed">Wire up data flow and dependencies</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-xl transition-transform hover:scale-105 hover:border-green-500/40">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm mb-1">Submit Blueprint</p>
                  <p className="text-slate-400 text-xs leading-relaxed">AI inspector reviews your build</p>
                </div>
              </div>
            </div>
          </div>

          {/* User Skill Level Info */}
          <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-500/30 rounded-2xl p-5 mb-6 flex items-center justify-between backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center border border-cyan-500/30">
                <Construction className="w-7 h-7 text-cyan-400" />
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider">Your Build Level</p>
                <p className="text-white font-bold text-xl capitalize">{userSkillLevel}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-xs uppercase tracking-wider">Components</p>
              <div className="flex items-baseline gap-1">
                <p className="text-cyan-400 font-black text-3xl">{SKILL_PIECE_COUNT[userSkillLevel] || 20}</p>
                <p className="text-slate-500 text-sm">pieces</p>
              </div>
            </div>
          </div>

          {/* Difficulty Selection */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white mb-4 text-center flex items-center justify-center gap-2">
              <Cog className="w-5 h-5 text-slate-400 animate-spin" style={{ animationDuration: "8s" }} />
              Select Challenge Difficulty
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, typeof DIFFICULTY_CONFIG[Difficulty]][]).map(
                ([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedDifficulty(key)}
                    className={cn(
                      "relative p-4 rounded-xl border-2 transition-all duration-300 text-left group",
                      selectedDifficulty === key
                        ? `border-transparent bg-gradient-to-br ${config.gradient} shadow-lg scale-105`
                        : "border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/50"
                    )}
                  >
                    <div className={cn(
                      "mb-2 transition-colors",
                      selectedDifficulty === key ? "text-white" : config.color
                    )}>
                      {config.icon}
                    </div>
                    <h3 className={cn(
                      "font-bold text-lg mb-1",
                      selectedDifficulty === key ? "text-white" : "text-slate-200"
                    )}>
                      {config.label}
                    </h3>
                    <p className={cn(
                      "text-xs mb-3 line-clamp-2",
                      selectedDifficulty === key ? "text-white/80" : "text-slate-400"
                    )}>
                      {config.description}
                    </p>
                    <div className={cn(
                      "flex items-center gap-3 text-xs",
                      selectedDifficulty === key ? "text-white/90" : "text-slate-500"
                    )}>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Math.floor(config.time / 60)} min
                      </span>
                    </div>
                    {selectedDifficulty === key && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Start Button */}
          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/game")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Hub
            </Button>
            <Button
              onClick={startGame}
              size="lg"
              className={cn(
                "gap-2 px-8 text-lg font-semibold transition-all duration-300",
                `bg-gradient-to-r ${DIFFICULTY_CONFIG[selectedDifficulty].gradient}`,
                "hover:scale-105 hover:shadow-lg"
              )}
            >
              <Play className="w-5 h-5" />
              Start Building
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
