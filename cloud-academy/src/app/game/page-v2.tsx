"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Swords,
  Gamepad2,
  Zap,
  Trophy,
  Users,
  Play,
  Crown,
  Flame,
  Timer,
  Volume2,
  VolumeX,
  ChevronDown,
  Menu,
  X,
  Star,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import {
  GAME_MODES,
  type Team,
  type TeamMember,
  type Match,
  type GameProfile,
  type LeaderboardEntry,
} from "./types";

// =============================================================================
// IMMERSIVE FULL-SCREEN GAMING EXPERIENCE - 2025 STYLE
// =============================================================================

// Cinematic video-like background with noise and grain
const CinematicBackground = () => (
  <div className="fixed inset-0 z-0">
    {/* Base gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0f0a15] to-[#0a0f0a]" />
    
    {/* Animated color washes */}
    <div className="absolute inset-0 overflow-hidden">
      <div 
        className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2 opacity-30"
        style={{
          background: `
            radial-gradient(ellipse 50% 50% at 20% 20%, rgba(239, 68, 68, 0.3) 0%, transparent 50%),
            radial-gradient(ellipse 40% 40% at 80% 30%, rgba(249, 115, 22, 0.2) 0%, transparent 50%),
            radial-gradient(ellipse 60% 60% at 50% 80%, rgba(139, 92, 246, 0.2) 0%, transparent 50%)
          `,
          animation: 'colorWash 20s ease-in-out infinite',
        }}
      />
    </div>
    
    {/* Film grain overlay */}
    <div 
      className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }}
    />
    
    {/* Vignette */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_0%,rgba(0,0,0,0.6)_100%)]" />
    
    <style jsx>{`
      @keyframes colorWash {
        0%, 100% { transform: translate(0, 0) rotate(0deg); }
        33% { transform: translate(5%, 5%) rotate(2deg); }
        66% { transform: translate(-5%, 3%) rotate(-2deg); }
      }
    `}</style>
  </div>
);

// Floating minimal header
const MinimalHeader = ({ 
  gameProfile, 
  soundEnabled, 
  onSoundToggle,
  onMenuOpen,
}: { 
  gameProfile: GameProfile | null;
  soundEnabled: boolean;
  onSoundToggle: () => void;
  onMenuOpen: () => void;
}) => (
  <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
    <div className="flex items-center justify-between">
      {/* Left - Back */}
      <Link 
        href="/dashboard" 
        className="flex items-center gap-2 text-white/50 hover:text-white transition-colors group"
      >
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">Exit</span>
      </Link>

      {/* Center - Logo (appears on scroll or always subtle) */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
        <Gamepad2 className="w-5 h-5 text-red-500" />
        <span className="text-sm font-black tracking-widest text-white/80">ARENA</span>
      </div>

      {/* Right - Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onSoundToggle}
          className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all hover:scale-105"
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-white/60" />
          ) : (
            <VolumeX className="w-4 h-4 text-white/40" />
          )}
        </button>
        
        {gameProfile && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm">
            <Crown className="w-4 h-4" style={{ color: gameProfile.rankColor }} />
            <span className="text-sm font-bold" style={{ color: gameProfile.rankColor }}>
              {gameProfile.rankFormatted}
            </span>
          </div>
        )}
        
        <button
          onClick={onMenuOpen}
          className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all hover:scale-105"
        >
          <Menu className="w-5 h-5 text-white/60" />
        </button>
      </div>
    </div>
  </header>
);

// Full-screen featured game hero
const ImmersiveHero = ({ onPlay }: { onPlay: () => void }) => {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  return (
    <div 
      className="relative h-[70vh] min-h-[500px] flex items-end overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Parallax background layers */}
      <div 
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{
          transform: `translate(${(mousePos.x - 0.5) * -20}px, ${(mousePos.y - 0.5) * -20}px) scale(1.1)`,
        }}
      >
        {/* Abstract geometric shapes */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 border border-red-500/20 rounded-full animate-spin-slow" style={{ animationDuration: '30s' }} />
        <div className="absolute top-1/3 right-1/3 w-64 h-64 border border-orange-500/20 rounded-full animate-spin-slow" style={{ animationDuration: '25s', animationDirection: 'reverse' }} />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 border border-yellow-500/10 rounded-full animate-spin-slow" style={{ animationDuration: '35s' }} />
      </div>

      {/* Giant floating icon with 3D effect */}
      <div 
        className="absolute right-[10%] top-1/2 -translate-y-1/2 transition-transform duration-300 ease-out"
        style={{
          transform: `translate(${(mousePos.x - 0.5) * 40}px, ${(mousePos.y - 0.5) * 40 - 50}%) rotateY(${(mousePos.x - 0.5) * 10}deg) rotateX(${(mousePos.y - 0.5) * -10}deg)`,
        }}
      >
        <div className="text-[250px] md:text-[350px] leading-none opacity-80 drop-shadow-2xl select-none">
          ⚔️
        </div>
        {/* Glow behind icon */}
        <div className="absolute inset-0 blur-[100px] bg-gradient-to-r from-red-500/30 to-orange-500/30 -z-10" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl px-8 md:px-16 pb-16 md:pb-24">
        {/* Live indicator */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 mb-6 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-sm font-medium text-green-400">LIVE</span>
          <span className="text-sm text-green-400/60">• 1,247 playing now</span>
        </div>

        {/* Title */}
        <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter mb-4">
          <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            QUIZ
          </span>
          <br />
          <span className="bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
            BATTLE
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-white/50 max-w-xl mb-8 leading-relaxed">
          Head-to-head AWS knowledge showdown. 
          <span className="text-white/80"> Race to buzz in first.</span>
        </p>

        {/* Stats */}
        <div className="flex items-center gap-8 mb-10">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-white/40" />
            <span className="text-white/60">1v1</span>
          </div>
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-white/40" />
            <span className="text-white/60">~5 min</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500/60" />
            <span className="text-white/60">+50 ELO</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-purple-500/60" />
            <span className="text-white/60">Ranked</span>
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-4">
          <Button
            onClick={onPlay}
            size="lg"
            className="relative overflow-hidden bg-white text-black hover:bg-white/90 font-black text-lg px-10 py-7 rounded-full group"
          >
            <span className="relative z-10 flex items-center gap-3">
              <Play className="w-6 h-6 fill-current" />
              PLAY NOW
            </span>
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white font-medium px-8 py-7 rounded-full"
          >
            Watch Matches
          </Button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
        <span className="text-xs text-white/30 uppercase tracking-widest">More Games</span>
        <ChevronDown className="w-5 h-5 text-white/30" />
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0a0a0f] to-transparent" />
      
      <style jsx>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow { animation: spin-slow linear infinite; }
      `}</style>
    </div>
  );
};

// Game card for the horizontal scroll
const GameCard = ({
  title,
  icon,
  description,
  gradient,
  isLive,
  comingSoon,
  players,
  onClick,
}: {
  title: string;
  icon: string;
  description: string;
  gradient: string;
  isLive?: boolean;
  comingSoon?: boolean;
  players: string;
  onClick?: () => void;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative flex-shrink-0 w-[300px] md:w-[400px] aspect-[4/5] rounded-3xl overflow-hidden cursor-pointer group ${
        comingSoon ? 'opacity-50' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={!comingSoon ? onClick : undefined}
    >
      {/* Background gradient */}
      <div 
        className="absolute inset-0 transition-transform duration-700 group-hover:scale-110"
        style={{ background: gradient }}
      />
      
      {/* Overlay pattern */}
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.5)_100%)]" />
      
      {/* Noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Icon */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] md:text-[150px] transition-all duration-500 ${
        isHovered ? 'scale-125 -rotate-12' : ''
      }`}>
        {icon}
      </div>

      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col justify-end p-6 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
        {/* Status */}
        <div className="flex items-center gap-2 mb-3">
          {isLive && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/20 border border-green-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-bold text-green-400 uppercase">Live</span>
            </span>
          )}
          {comingSoon && (
            <span className="px-2 py-1 rounded-full bg-white/10 border border-white/20">
              <span className="text-[10px] font-bold text-white/60 uppercase">Coming Soon</span>
            </span>
          )}
          <span className="text-[10px] text-white/40 flex items-center gap-1">
            <Users className="w-3 h-3" />
            {players}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-2xl md:text-3xl font-black text-white mb-2">{title}</h3>
        
        {/* Description */}
        <p className="text-sm text-white/50 line-clamp-2">{description}</p>

        {/* Play button on hover */}
        <div className={`mt-4 transition-all duration-300 ${isHovered && !comingSoon ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <Button className="w-full bg-white text-black hover:bg-white/90 font-bold rounded-full">
            <Play className="w-4 h-4 mr-2 fill-current" />
            Play Now
          </Button>
        </div>
      </div>
    </div>
  );
};

// Horizontal scrolling game selector
const GameSelector = () => {
  const otherGames = GAME_MODES.filter(m => m.slug !== "quiz_battle");

  return (
    <section className="relative py-16 px-8 md:px-16">
      {/* Section header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-2">More Games</h2>
          <p className="text-white/40">Choose your battlefield</p>
        </div>
        <div className="flex items-center gap-2 text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm">{GAME_MODES.filter(m => m.isLive).length} Live</span>
        </div>
      </div>

      {/* Horizontal scroll container */}
      <div className="flex gap-6 overflow-x-auto pb-6 -mx-8 px-8 scrollbar-hide">
        {otherGames.map((game) => (
          <GameCard
            key={game.slug}
            title={game.title}
            icon={game.icon}
            description={game.description}
            gradient={game.gradient}
            isLive={game.isLive}
            comingSoon={game.comingSoon}
            players={game.players}
            onClick={() => {}}
          />
        ))}
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </section>
  );
};

// Live activity bar at bottom
const LiveActivityBar = () => {
  const activities = useMemo(() => [
    { user: "CloudMaster99", action: "won", game: "Quiz Battle", result: "+52 ELO" },
    { user: "AWSNinja", action: "started", game: "Lightning Round", result: "" },
    { user: "ServerlessKing", action: "achieved", game: "10 Win Streak", result: "🔥" },
    { user: "LambdaQueen", action: "won", game: "Quiz Battle", result: "+48 ELO" },
  ], []);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/50 backdrop-blur-xl border-t border-white/5">
      <div className="flex items-center h-12 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...activities, ...activities].map((activity, i) => (
            <div key={i} className="flex items-center gap-3 mx-8">
              <Zap className="w-3 h-3 text-yellow-400" />
              <span className="text-sm">
                <span className="text-cyan-400 font-medium">{activity.user}</span>
                <span className="text-white/40"> {activity.action} </span>
                <span className="text-white/80">{activity.game}</span>
                {activity.result && <span className="text-green-400 ml-2">{activity.result}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee { animation: marquee 25s linear infinite; }
      `}</style>
    </div>
  );
};

// Slide-out stats panel
const StatsPanel = ({ 
  isOpen, 
  onClose, 
  gameProfile,
  leaderboard,
}: { 
  isOpen: boolean; 
  onClose: () => void;
  gameProfile: GameProfile | null;
  leaderboard: LeaderboardEntry[];
}) => (
  <>
    {/* Backdrop */}
    <div 
      className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
    />
    
    {/* Panel */}
    <div className={`fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-[#0a0a0f]/95 backdrop-blur-xl border-l border-white/10 transition-transform duration-500 ease-out ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <h2 className="text-xl font-black text-white">Your Stats</h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <X className="w-5 h-5 text-white/60" />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-80px)]">
        {gameProfile && (
          <>
            {/* Rank card */}
            <div 
              className="p-6 rounded-2xl border-2"
              style={{ 
                borderColor: gameProfile.rankColor,
                background: `linear-gradient(135deg, ${gameProfile.rankColor}20, transparent)`,
              }}
            >
              <div className="flex items-center gap-4">
                <Crown className="w-12 h-12" style={{ color: gameProfile.rankColor }} />
                <div>
                  <p className="text-3xl font-black" style={{ color: gameProfile.rankColor }}>
                    {gameProfile.rankFormatted}
                  </p>
                  <p className="text-white/40">{gameProfile.elo} ELO</p>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/5">
                <TrendingUp className="w-5 h-5 text-green-400 mb-2" />
                <p className="text-2xl font-black text-green-400">{gameProfile.winRate}%</p>
                <p className="text-xs text-white/40 uppercase">Win Rate</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5">
                <Trophy className="w-5 h-5 text-blue-400 mb-2" />
                <p className="text-2xl font-black text-white">
                  {gameProfile.totalWins}-{gameProfile.totalLosses}
                </p>
                <p className="text-xs text-white/40 uppercase">Record</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5">
                <Flame className="w-5 h-5 text-orange-400 mb-2" />
                <p className="text-2xl font-black text-orange-400">{gameProfile.winStreak}</p>
                <p className="text-xs text-white/40 uppercase">Streak</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5">
                <Star className="w-5 h-5 text-purple-400 mb-2" />
                <p className="text-2xl font-black text-purple-400">{gameProfile.totalPoints.toLocaleString()}</p>
                <p className="text-xs text-white/40 uppercase">Points</p>
              </div>
            </div>
          </>
        )}

        {/* Leaderboard */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4">Global Rankings</h3>
          <div className="space-y-2">
            {leaderboard.slice(0, 10).map((entry, i) => (
              <div 
                key={i}
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  entry.isCurrentUser ? 'bg-cyan-500/20 border border-cyan-500/30' : 'bg-white/5'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                  entry.rank === 1 ? 'bg-yellow-500 text-black' :
                  entry.rank === 2 ? 'bg-gray-400 text-black' :
                  entry.rank === 3 ? 'bg-orange-500 text-black' :
                  'bg-white/10 text-white/60'
                }`}>
                  {entry.rank === 1 ? '👑' : entry.rank}
                </div>
                <span className="flex-1 text-white/80">{entry.displayName}</span>
                <span className="text-white/40 font-mono text-sm">{entry.elo}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function GameModePage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { toast } = useToast();
  
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [statsPanelOpen, setStatsPanelOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<{ activeMatches: Match[]; recentMatches: Match[] }>({
    activeMatches: [],
    recentMatches: [],
  });
  const [loading, setLoading] = useState(true);
  const [gameProfile, setGameProfile] = useState<GameProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [teamsRes, matchesRes, profileRes, leaderboardRes] = await Promise.all([
        fetch("/api/team"),
        fetch("/api/versus"),
        fetch("/api/gaming/profile"),
        fetch("/api/gaming/leaderboard?limit=10"),
      ]);

      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData.teams || []);
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
  }, []);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (authStatus === "authenticated") {
      fetchData();
    }
  }, [authStatus, router, fetchData]);

  if (loading || authStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-2 border-white/10 rounded-full" />
            <div className="absolute inset-0 border-2 border-transparent border-t-red-500 rounded-full animate-spin" />
            <Gamepad2 className="absolute inset-0 m-auto w-8 h-8 text-red-500" />
          </div>
          <p className="text-white/40 text-sm uppercase tracking-widest">Loading Arena</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <CinematicBackground />
      
      <MinimalHeader 
        gameProfile={gameProfile}
        soundEnabled={soundEnabled}
        onSoundToggle={() => setSoundEnabled(!soundEnabled)}
        onMenuOpen={() => setStatsPanelOpen(true)}
      />

      <main className="relative z-10 pb-16">
        <ImmersiveHero onPlay={() => {/* TODO: matchmaking */}} />
        <GameSelector />
      </main>

      <LiveActivityBar />
      
      <StatsPanel 
        isOpen={statsPanelOpen}
        onClose={() => setStatsPanelOpen(false)}
        gameProfile={gameProfile}
        leaderboard={leaderboard}
      />
    </div>
  );
}
