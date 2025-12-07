"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Loader2,
  Zap,
  ArrowLeft,
  Users,
  Swords,
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  Globe,
  TrendingUp,
  Flame,
  Target,
  ChevronRight,
  Lock,
  Sparkles,
  Crown,
  Play,
  Gamepad2,
  Volume2,
  Star,
  Bolt,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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

interface Match {
  id: string;
  matchCode: string;
  status: string;
  player1Score: number;
  player2Score: number;
  player1: { id: string; name: string | null; username: string | null };
  player2: { id: string; name: string | null; username: string | null };
  createdAt: string;
}

interface GameProfile {
  elo: number;
  rank: string;
  rankTier: number;
  rankFormatted: string;
  rankColor: string;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  winStreak: number;
  bestWinStreak: number;
  winRate: number;
  totalPoints: number;
  countryCode: string | null;
}

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  elo: number;
  rankName: string;
  rankColor: string;
  winRate: number;
  isCurrentUser: boolean;
}

// Animated background particles
const ParticleField = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-white/20 rounded-full animate-pulse"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${2 + Math.random() * 3}s`,
          }}
        />
      ))}
    </div>
  );
};

// Glowing orb effect
const GlowOrb = ({ color, size, top, left, delay = 0 }: { color: string; size: number; top: string; left: string; delay?: number }) => (
  <div
    className="absolute rounded-full blur-3xl animate-pulse opacity-30"
    style={{
      background: color,
      width: size,
      height: size,
      top,
      left,
      animationDelay: `${delay}s`,
      animationDuration: '4s',
    }}
  />
);

// Game card with casino-style hover effects
const GameCard = ({ 
  title, 
  icon, 
  description, 
  players, 
  isLive, 
  comingSoon, 
  gradient,
  onClick,
  featured = false,
}: {
  title: string;
  icon: string;
  description: string;
  players: string;
  isLive?: boolean;
  comingSoon?: boolean;
  gradient: string;
  onClick?: () => void;
  featured?: boolean;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div
      className={`relative group cursor-pointer transition-all duration-500 ${featured ? 'col-span-2 row-span-2' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={!comingSoon ? onClick : undefined}
    >
      {/* Glow effect on hover */}
      <div 
        className={`absolute -inset-1 rounded-2xl blur-xl transition-opacity duration-500 ${isHovered && !comingSoon ? 'opacity-60' : 'opacity-0'}`}
        style={{ background: gradient }}
      />
      
      {/* Card */}
      <div className={`relative h-full rounded-2xl border overflow-hidden transition-all duration-300 ${
        comingSoon 
          ? 'bg-gray-900/50 border-gray-800 opacity-60' 
          : 'bg-gray-900/80 border-gray-700 hover:border-gray-500'
      }`}>
        {/* Animated gradient overlay */}
        {!comingSoon && (
          <div 
            className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500"
            style={{ background: `linear-gradient(135deg, ${gradient})` }}
          />
        )}
        
        {/* Shine effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
          <div 
            className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }}
          />
        </div>
        
        {/* Content */}
        <div className={`relative p-6 h-full flex flex-col ${featured ? 'justify-between' : ''}`}>
          {/* Status badges */}
          <div className="absolute top-4 right-4 flex gap-2">
            {isLive && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/20 border border-green-500/50">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-bold text-green-400">LIVE</span>
              </div>
            )}
            {comingSoon && (
              <div className="px-2 py-1 rounded-full bg-purple-500/20 border border-purple-500/50">
                <span className="text-xs font-bold text-purple-400">COMING SOON</span>
              </div>
            )}
          </div>
          
          {/* Icon with glow */}
          <div className="relative mb-4">
            <div 
              className={`text-6xl ${featured ? 'text-8xl' : ''} transition-transform duration-300 ${isHovered && !comingSoon ? 'scale-110' : ''}`}
              style={{ 
                filter: isHovered && !comingSoon ? `drop-shadow(0 0 20px ${gradient.split(',')[0]?.replace('linear-gradient(135deg, ', '') || '#fff'})` : 'none'
              }}
            >
              {icon}
            </div>
          </div>
          
          {/* Title */}
          <h3 className={`font-black text-white mb-2 ${featured ? 'text-3xl' : 'text-xl'}`}>
            {title}
          </h3>
          
          {/* Description */}
          <p className={`text-gray-400 mb-4 ${featured ? 'text-base' : 'text-sm'}`}>
            {description}
          </p>
          
          {/* Footer */}
          <div className="mt-auto flex items-center justify-between">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Users className="w-3 h-3" />
              {players}
            </span>
            
            {!comingSoon ? (
              <Button 
                size={featured ? "default" : "sm"}
                className={`gap-2 font-bold transition-all duration-300 ${
                  featured 
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-white px-8' 
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <Play className="w-4 h-4" />
                {featured ? 'PLAY NOW' : 'Play'}
              </Button>
            ) : (
              <Lock className="w-5 h-5 text-gray-600" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Rank badge with glow
const RankBadge = ({ rank, color, elo }: { rank: string; color: string; elo: number }) => (
  <div className="relative group">
    <div 
      className="absolute -inset-2 rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition-opacity"
      style={{ background: color }}
    />
    <div 
      className="relative px-4 py-2 rounded-xl border-2 flex items-center gap-3"
      style={{ 
        borderColor: color,
        background: `linear-gradient(135deg, ${color}20, transparent)`
      }}
    >
      <Crown className="w-6 h-6" style={{ color }} />
      <div>
        <p className="font-black text-lg" style={{ color }}>{rank}</p>
        <p className="text-xs text-gray-400">{elo} ELO</p>
      </div>
    </div>
  </div>
);

// Stat card with animated counter
const StatCard = ({ 
  label, 
  value, 
  icon: Icon, 
  color,
  subValue,
}: { 
  label: string; 
  value: string | number; 
  icon: React.ElementType; 
  color: string;
  subValue?: string;
}) => (
  <div className="relative group">
    <div 
      className="absolute -inset-0.5 rounded-xl blur opacity-0 group-hover:opacity-40 transition-opacity duration-300"
      style={{ background: color }}
    />
    <div className="relative bg-gray-900/80 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
    </div>
  </div>
);

export default function GameModePage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { toast } = useToast();

  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<{ activeMatches: Match[]; recentMatches: Match[] }>({
    activeMatches: [],
    recentMatches: [],
  });
  const [loading, setLoading] = useState(true);
  const [challenging, setChallenging] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [gameProfile, setGameProfile] = useState<GameProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (authStatus === "authenticated") {
      fetchData();
    }
  }, [authStatus, router]);

  const fetchData = async () => {
    try {
      const [teamsRes, matchesRes, profileRes, leaderboardRes] = await Promise.all([
        fetch("/api/team"),
        fetch("/api/versus"),
        fetch("/api/gaming/profile"),
        fetch("/api/gaming/leaderboard?limit=5"),
      ]);

      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData.teams || []);
        for (const team of teamsData.teams || []) {
          const myMember = team.members.find(
            (m: TeamMember) => m.academyUser?.email === session?.user?.email
          );
          if (myMember?.academyUser?.id) {
            setMyUserId(myMember.academyUser.id);
            break;
          }
        }
      }

      if (matchesRes.ok) {
        const matchesData = await matchesRes.json();
        setMatches(matchesData);
      }

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setGameProfile(profileData.profile);
      }

      if (leaderboardRes.ok) {
        const leaderboardData = await leaderboardRes.json();
        setLeaderboard(leaderboardData.leaderboard || []);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChallenge = async (opponentId: string) => {
    setChallenging(opponentId);
    try {
      const res = await fetch("/api/versus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opponentId, matchType: "quiz" }),
      });
      const data = await res.json();
      if (res.ok && data.match) {
        toast({
          title: "⚔️ Challenge Sent!",
          description: data.emailSent ? `Email sent to opponent!` : "Match created!",
        });
        setTimeout(() => router.push(`/game/${data.match.matchCode}`), 1000);
      }
    } catch (err) {
      console.error("Failed to create challenge:", err);
    } finally {
      setChallenging(null);
    }
  };

  if (loading || authStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            <Gamepad2 className="absolute inset-0 m-auto w-6 h-6 text-red-500" />
          </div>
          <p className="text-gray-400 mt-4 animate-pulse">Loading Arena...</p>
        </div>
      </div>
    );
  }

  const opponents = teams.flatMap(team => 
    team.members
      .filter(m => m.academyUser && m.academyUser.id !== myUserId)
      .map(m => ({ ...m.academyUser!, teamName: team.name }))
  );

  const incomingChallenges = matches.activeMatches.filter(m => m.player2.id === myUserId && m.status === "pending");
  const pendingChallenges = matches.activeMatches.filter(m => m.player1.id === myUserId && m.status === "pending");

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <ParticleField />
        <GlowOrb color="#ef4444" size={600} top="-10%" left="-10%" delay={0} />
        <GlowOrb color="#f97316" size={500} top="60%" left="80%" delay={2} />
        <GlowOrb color="#8b5cf6" size={400} top="30%" left="50%" delay={1} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0f]/50 to-[#0a0a0f]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Exit</span>
          </Link>
          
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl blur-lg opacity-50 animate-pulse" />
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                <Gamepad2 className="w-7 h-7 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                ARENA
              </h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em]">CloudAcademy Gaming</p>
            </div>
          </div>

          {/* Right side - empty now, rank is in sidebar */}
          <div className="w-32" />
        </div>
      </header>

      {/* Main Content - Fixed Sidebar Layout */}
      <div className="relative z-10 flex h-[calc(100vh-80px)]">
        {/* Left: Scrollable Game Modes */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {/* Incoming Challenges Alert - Sticky at top */}
          {incomingChallenges.length > 0 && (
            <div className="mb-6 relative">
              <div className="absolute -inset-1 bg-red-500/30 rounded-2xl blur-xl animate-pulse" />
              <div className="relative bg-red-500/10 border-2 border-red-500/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center animate-bounce">
                      <Swords className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <h3 className="font-black text-red-400">INCOMING CHALLENGE!</h3>
                      <p className="text-xs text-gray-400">{incomingChallenges[0].player1.name || incomingChallenges[0].player1.username} wants to battle</p>
                    </div>
                  </div>
                  <Link href={`/game/${incomingChallenges[0].matchCode}`}>
                    <Button className="bg-red-500 hover:bg-red-400 text-white font-bold gap-2 animate-pulse">
                      <Swords className="w-4 h-4" />
                      ACCEPT
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Game Modes Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black flex items-center gap-2">
              <Swords className="w-6 h-6 text-red-500" />
              GAME MODES
            </h2>
            <div className="flex items-center gap-2 text-green-400 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>5 Live</span>
            </div>
          </div>

          {/* Game Modes Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <GameCard
              title="Quiz Battle"
              icon="⚔️"
              description="Head-to-head AWS knowledge showdown. Race to buzz in first!"
              players="1v1"
              isLive
              gradient="linear-gradient(135deg, #ef4444, #f97316)"
              onClick={() => {}}
            />
            <GameCard
              title="Service Slots"
              icon="🎰"
              description="Spin to match 3 AWS services that work together. Jackpot!"
              players="Solo"
              isLive
              gradient="linear-gradient(135deg, #fbbf24, #f59e0b)"
            />
            <GameCard
              title="Lightning Round"
              icon="⚡"
              description="60 seconds. Answer as many as you can. Pure speed!"
              players="Solo"
              isLive
              gradient="linear-gradient(135deg, #facc15, #eab308)"
            />
            <GameCard
              title="Hot Streak"
              icon="🔥"
              description="Build your streak! Multipliers increase with each correct answer."
              players="Solo"
              isLive
              gradient="linear-gradient(135deg, #f97316, #dc2626)"
            />
            <GameCard
              title="Sniper Quiz"
              icon="🎯"
              description="One shot, high stakes. Big points or nothing. No pressure..."
              players="Solo"
              isLive
              gradient="linear-gradient(135deg, #10b981, #059669)"
            />
            <GameCard
              title="Speed Deploy"
              icon="🏎️"
              description="Race to deploy the correct architecture faster than your opponent!"
              players="1v1"
              gradient="linear-gradient(135deg, #3b82f6, #1d4ed8)"
            />
            <GameCard
              title="Cloud Tycoon"
              icon="💰"
              description="Build & manage infrastructure. Earn virtual millions."
              players="Solo"
              comingSoon
              gradient="linear-gradient(135deg, #22c55e, #16a34a)"
            />
            <GameCard
              title="Architecture Poker"
              icon="🃏"
              description="Build the best 'hand' of services for each scenario."
              players="2-6"
              comingSoon
              gradient="linear-gradient(135deg, #8b5cf6, #7c3aed)"
            />
            <GameCard
              title="Ticking Bomb"
              icon="💣"
              description="Hot potato! Answer before time runs out or pass the bomb!"
              players="2-8 Party"
              comingSoon
              gradient="linear-gradient(135deg, #ef4444, #b91c1c)"
            />
            <GameCard
              title="Tournament"
              icon="🏆"
              description="Bracket-style elimination. Fight your way to the championship!"
              players="8-64"
              comingSoon
              gradient="linear-gradient(135deg, #f59e0b, #d97706)"
            />
            <GameCard
              title="Daily Jackpot"
              icon="🎲"
              description="One chance per day. Massive prize pool. Don't miss out!"
              players="Global"
              comingSoon
              gradient="linear-gradient(135deg, #ec4899, #db2777)"
            />
            <GameCard
              title="Architect Arena"
              icon="🏗️"
              description="Design architectures under pressure. AI judges your solution."
              players="1v1"
              comingSoon
              gradient="linear-gradient(135deg, #06b6d4, #0891b2)"
            />
          </div>
        </main>

        {/* Right: Fixed Sidebar */}
        <aside className="w-80 xl:w-96 border-l border-white/5 bg-black/30 backdrop-blur-xl overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Stats Section - Always visible */}
            <div className="space-y-3">
              {/* Rank Card */}
              {gameProfile && (
                <div className="relative">
                  <div 
                    className="absolute -inset-1 rounded-xl blur-lg opacity-40"
                    style={{ background: gameProfile.rankColor }}
                  />
                  <div 
                    className="relative p-4 rounded-xl border-2 flex items-center gap-4"
                    style={{ 
                      borderColor: gameProfile.rankColor,
                      background: `linear-gradient(135deg, ${gameProfile.rankColor}15, transparent)`
                    }}
                  >
                    <Crown className="w-8 h-8" style={{ color: gameProfile.rankColor }} />
                    <div>
                      <p className="text-2xl font-black" style={{ color: gameProfile.rankColor }}>
                        {gameProfile.rankFormatted}
                      </p>
                      <p className="text-xs text-gray-400">{gameProfile.elo} Elo</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Stats Grid */}
              {gameProfile && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-center">
                    <p className="text-lg font-black text-green-400">{gameProfile.winRate}%</p>
                    <p className="text-[10px] text-gray-500 uppercase">Win Rate</p>
                  </div>
                  <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-center">
                    <p className="text-lg font-black">
                      <span className="text-green-400">{gameProfile.totalWins}</span>
                      <span className="text-gray-600">-</span>
                      <span className="text-red-400">{gameProfile.totalLosses}</span>
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase">Record</p>
                  </div>
                  <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-center">
                    <p className="text-lg font-black text-orange-400">{gameProfile.winStreak}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Streak</p>
                  </div>
                  <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-center">
                    <p className="text-lg font-black text-purple-400">{gameProfile.totalPoints.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Points</p>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-white/5" />

            {/* Pending Challenges */}
            {pendingChallenges.length > 0 && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3">
                <h3 className="text-xs font-bold text-yellow-400 flex items-center gap-2 mb-2">
                  <Clock className="w-3 h-3" />
                  AWAITING RESPONSE
                </h3>
                {pendingChallenges.map((match) => (
                  <Link key={match.id} href={`/game/${match.matchCode}`}>
                    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-yellow-500/10 transition-colors">
                      <span className="text-xs">vs {match.player2.name || match.player2.username}</span>
                      <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 text-[10px]">Pending</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Challenge Teammates */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
              <h3 className="text-xs font-bold flex items-center gap-2 mb-2">
                <Users className="w-3 h-3 text-cyan-400" />
                QUICK CHALLENGE
              </h3>
              {opponents.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-2">No teammates</p>
              ) : (
                <div className="space-y-1">
                  {opponents.slice(0, 3).map((opponent) => (
                    <div key={opponent.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center font-bold text-[10px]">
                          {(opponent.name || opponent.username || "?")[0].toUpperCase()}
                        </div>
                        <span className="text-xs">{opponent.name || opponent.username}</span>
                      </div>
                      <Button
                        onClick={() => handleChallenge(opponent.id)}
                        disabled={challenging === opponent.id}
                        size="sm"
                        className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-[10px] h-6 px-2"
                      >
                        {challenging === opponent.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "⚔️"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Matches */}
            {matches.recentMatches.length > 0 && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
                <h3 className="text-xs font-bold flex items-center gap-2 mb-2">
                  <Trophy className="w-3 h-3 text-yellow-400" />
                  RECENT
                </h3>
                <div className="space-y-1">
                  {matches.recentMatches.slice(0, 3).map((match) => {
                    const isWinner = match.player1Score > match.player2Score 
                      ? match.player1.id === myUserId
                      : match.player2.id === myUserId;

                    return (
                      <div key={match.id} className={`flex items-center justify-between p-2 rounded-lg ${
                        isWinner ? "bg-green-500/10" : "bg-red-500/10"
                      }`}>
                        <span className="text-xs truncate flex-1">
                          vs {match.player1.id === myUserId 
                            ? (match.player2.name || match.player2.username) 
                            : (match.player1.name || match.player1.username)}
                        </span>
                        <Badge className={`text-[10px] ${isWinner ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {isWinner ? "W" : "L"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Leaderboard */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold flex items-center gap-2">
                  <Globe className="w-3 h-3 text-cyan-400" />
                  LEADERBOARD
                </h3>
                <Button variant="ghost" size="sm" className="text-[10px] text-gray-400 hover:text-white h-5 px-1">
                  All <ChevronRight className="w-3 h-3" />
                </Button>
              </div>

              {leaderboard.length === 0 ? (
                <div className="text-center py-4">
                  <Trophy className="w-6 h-6 text-gray-600 mx-auto mb-1" />
                  <p className="text-gray-500 text-xs">No rankings yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {leaderboard.slice(0, 5).map((entry, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 p-2 rounded-lg ${
                        entry.isCurrentUser ? "bg-cyan-500/10 border border-cyan-500/30" : "hover:bg-white/5"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${
                        entry.rank === 1 ? "bg-yellow-500 text-black" :
                        entry.rank === 2 ? "bg-gray-400 text-black" :
                        entry.rank === 3 ? "bg-orange-500 text-black" :
                        "bg-gray-800 text-gray-400"
                      }`}>
                        {entry.rank}
                      </div>
                      <span className="text-xs flex-1 truncate">{entry.displayName}</span>
                      <span className="text-[10px] text-gray-500">{entry.elo}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
