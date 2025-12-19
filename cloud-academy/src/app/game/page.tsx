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
  Sparkles,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import { PlayerStatsSidebar } from "./components";
import {
  GAME_MODES,
  type GameModeSlug,
  type Team,
  type TeamMember,
  type Match,
  type GameProfile,
  type LeaderboardEntry,
} from "./types";

// Animated grid background
const AnimatedGrid = () => (
  <div className="absolute inset-0 overflow-hidden opacity-20">
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `
          linear-gradient(rgba(239, 68, 68, 0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(239, 68, 68, 0.1) 1px, transparent 1px)
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

// Floating orbs with parallax effect
const FloatingOrbs = () => {
  const orbs = useMemo(() => [
    { color: "#ef4444", size: 800, x: -20, y: -20, duration: 25 },
    { color: "#f97316", size: 600, x: 80, y: 60, duration: 30 },
    { color: "#8b5cf6", size: 500, x: 50, y: 30, duration: 20 },
    { color: "#06b6d4", size: 400, x: 20, y: 70, duration: 35 },
    { color: "#22c55e", size: 300, x: 70, y: 10, duration: 28 },
  ], []);

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
        @keyframes float4 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(40px, 30px) scale(0.95); } }
      `}</style>
    </div>
  );
};

// Scan line effect
const ScanLines = () => (
  <div
    className="absolute inset-0 pointer-events-none opacity-[0.03]"
    style={{
      background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)",
    }}
  />
);

// Game carousel configuration - which games to feature
const FEATURED_GAMES = GAME_MODES.filter(m => m.isLive);

// Carousel slide for a single game
const CarouselSlide = ({ 
  game, 
  onPlay,
  isActive 
}: { 
  game: typeof GAME_MODES[0]; 
  onPlay: () => void;
  isActive: boolean;
}) => {
  const [glitch, setGlitch] = useState(false);
  
  // Generate stable random player count (lazy initializer runs once)
  const [playerCount] = useState(() => Math.floor(Math.random() * 200 + 50));

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 150);
    }, 5000);
    return () => clearInterval(interval);
  }, [isActive]);

  // Extract gradient colors for glow effect
  const gradientMatch = game.gradient.match(/#[a-fA-F0-9]{6}/g);
  const glowColors = gradientMatch ? gradientMatch.join(', ') : '#ef4444, #f97316';

  return (
    <div className="relative group cursor-pointer w-full" onClick={onPlay}>
      {/* Massive glow effect */}
      <div 
        className="absolute -inset-4 rounded-3xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500 animate-pulse" 
        style={{ background: `linear-gradient(to right, ${glowColors})` }}
      />
      
      {/* Card */}
      <div 
        className="relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br from-gray-900 via-gray-900"
        style={{ borderColor: gradientMatch?.[0] ? `${gradientMatch[0]}80` : '#ef444480' }}
      >
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZjAwMDAiIG9wYWNpdHk9Ii4xIi8+PC9nPjwvc3ZnPg==')] animate-spin-slow" style={{ animationDuration: '60s' }} />
        </div>

        {/* Gradient overlay based on game */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{ background: game.gradient }}
        />

        <div className="relative p-8 flex items-center gap-8">
          {/* Left: Icon and info */}
          <div className="flex-1">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/50 mb-4">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Live Now</span>
              <span className="text-xs text-green-400/70">• {playerCount} playing</span>
            </div>

            {/* Title with glitch effect */}
            <h2 className={`text-5xl md:text-6xl font-black mb-3 ${glitch ? 'animate-glitch' : ''}`}>
              <span 
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: game.gradient }}
              >
                {game.title.toUpperCase()}
              </span>
            </h2>
            <style jsx>{`
              @keyframes glitch {
                0% { transform: translate(0); }
                20% { transform: translate(-2px, 2px); }
                40% { transform: translate(-2px, -2px); }
                60% { transform: translate(2px, 2px); }
                80% { transform: translate(2px, -2px); }
                100% { transform: translate(0); }
              }
              .animate-glitch { animation: glitch 0.15s ease-in-out; }
            `}</style>

            <p className="text-gray-400 text-lg mb-6 max-w-md">
              {game.description}
            </p>

            {/* Stats row */}
            <div className="flex items-center gap-6 mb-6">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-gray-400">{game.players}</span>
              </div>
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-gray-400">~5 min</span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-gray-400">+50 ELO</span>
              </div>
            </div>

            {/* CTA Button */}
            <Button
              size="lg"
              className="relative overflow-hidden text-white font-black text-xl px-10 py-6 rounded-xl group/btn"
              style={{ background: game.gradient }}
            >
              <span className="relative z-10 flex items-center gap-3">
                <Play className="w-6 h-6 fill-current" />
                PLAY NOW
              </span>
              {/* Shine effect */}
              <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </Button>
          </div>

          {/* Right: Large animated icon */}
          <div className="hidden lg:block relative">
            {/* Pulsing ring behind icon */}
            <div 
              className="absolute inset-0 m-auto w-32 h-32 rounded-full animate-pulse-ring"
              style={{ background: `radial-gradient(circle, ${gradientMatch?.[0] || '#ef4444'}40 0%, transparent 70%)` }}
            />
            {/* Rotating orbit */}
            <div className="absolute inset-0 animate-orbit">
              <div 
                className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
                style={{ backgroundColor: gradientMatch?.[0] || '#ef4444', boxShadow: `0 0 10px ${gradientMatch?.[0] || '#ef4444'}` }}
              />
            </div>
            {/* Main icon with 3D hover effect */}
            <div className="text-[150px] leading-none animate-float-3d group-hover:scale-110 transition-transform duration-300">{game.icon}</div>
            {/* Sparkle effects */}
            <div className="absolute top-4 right-4 animate-sparkle">✨</div>
            <div className="absolute bottom-8 left-2 animate-sparkle-delayed">⭐</div>
            {/* Floating particles around icon */}
            <div 
              className="absolute top-0 right-0 w-4 h-4 rounded-full animate-ping" 
              style={{ backgroundColor: gradientMatch?.[0] || '#ef4444' }}
            />
            <div 
              className="absolute bottom-10 left-0 w-3 h-3 rounded-full animate-ping" 
              style={{ backgroundColor: gradientMatch?.[1] || '#f97316', animationDelay: '0.5s' }}
            />
            <div 
              className="absolute top-20 right-10 w-2 h-2 rounded-full animate-ping" 
              style={{ backgroundColor: gradientMatch?.[0] || '#fbbf24', animationDelay: '1s' }}
            />
            {/* Electric bolts */}
            <div className="absolute -left-4 top-1/2 text-2xl animate-zap">⚡</div>
            <div className="absolute -right-2 top-1/3 text-xl animate-zap-delayed">⚡</div>
            <style jsx>{`
              @keyframes float-3d {
                0%, 100% { transform: translateY(0) rotate(-5deg) scale(1); }
                25% { transform: translateY(-15px) rotate(0deg) scale(1.05); }
                50% { transform: translateY(-25px) rotate(5deg) scale(1.1); }
                75% { transform: translateY(-10px) rotate(2deg) scale(1.05); }
              }
              .animate-float-3d { animation: float-3d 4s ease-in-out infinite; }
              
              @keyframes orbit {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              .animate-orbit { animation: orbit 8s linear infinite; }
              
              @keyframes pulse-ring {
                0%, 100% { transform: scale(1); opacity: 0.5; }
                50% { transform: scale(1.3); opacity: 0.2; }
              }
              .animate-pulse-ring { animation: pulse-ring 2s ease-in-out infinite; }
              
              @keyframes sparkle {
                0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
                50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
              }
              .animate-sparkle { animation: sparkle 2s ease-in-out infinite; }
              .animate-sparkle-delayed { animation: sparkle 2s ease-in-out infinite 0.5s; }
              
              @keyframes zap {
                0%, 100% { opacity: 0; transform: translateX(0) scale(0.8); }
                10%, 30% { opacity: 1; transform: translateX(5px) scale(1.2); }
                20% { opacity: 0.5; transform: translateX(-3px) scale(1); }
              }
              .animate-zap { animation: zap 3s ease-in-out infinite; }
              .animate-zap-delayed { animation: zap 3s ease-in-out infinite 1.5s; }
            `}</style>
          </div>
        </div>
      </div>
    </div>
  );
};

// Game carousel component
const GameCarousel = ({ 
  onPlayQuizBattle,
  onNavigateToMode 
}: { 
  onPlayQuizBattle: () => void;
  onNavigateToMode: (slug: GameModeSlug) => void;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-advance carousel every 4 seconds
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % FEATURED_GAMES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + FEATURED_GAMES.length) % FEATURED_GAMES.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % FEATURED_GAMES.length);
  };

  const handlePlay = (game: typeof GAME_MODES[0]) => {
    if (game.slug === 'quiz_battle') {
      onPlayQuizBattle();
    } else {
      onNavigateToMode(game.slug);
    }
  };

  const currentGame = FEATURED_GAMES[currentIndex];

  return (
    <div 
      className="relative mb-8"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Carousel container */}
      <div className="relative overflow-hidden">
        <div 
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {FEATURED_GAMES.map((game, index) => (
            <div key={game.slug} className="w-full flex-shrink-0">
              <CarouselSlide 
                game={game} 
                onPlay={() => handlePlay(game)}
                isActive={index === currentIndex}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation arrows */}
      <button
        onClick={goToPrev}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 border border-white/20 transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
        style={{ opacity: isPaused ? 1 : 0 }}
      >
        <ChevronLeft className="w-6 h-6 text-white" />
      </button>
      <button
        onClick={goToNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 border border-white/20 transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
        style={{ opacity: isPaused ? 1 : 0 }}
      >
        <ChevronRight className="w-6 h-6 text-white" />
      </button>

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {FEATURED_GAMES.map((game, index) => (
          <button
            key={game.slug}
            onClick={() => goToSlide(index)}
            className={`relative h-2 rounded-full transition-all duration-300 ${
              index === currentIndex 
                ? 'w-8' 
                : 'w-2 hover:bg-white/50'
            }`}
            style={{
              background: index === currentIndex ? currentGame.gradient : 'rgba(255,255,255,0.3)'
            }}
          >
            {/* Progress bar for active slide */}
            {index === currentIndex && !isPaused && (
              <div 
                className="absolute inset-0 rounded-full bg-white/30 origin-left"
                style={{ 
                  animation: 'progress 4s linear',
                }}
              />
            )}
          </button>
        ))}
      </div>

      <style jsx>{`
        @keyframes progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
};

// Game mode card with heavy animations
const GameModeCard = ({
  title,
  icon,
  description,
  players,
  isLive,
  comingSoon,
  gradient,
  onClick,
  index,
}: {
  title: string;
  icon: string;
  description: string;
  players: string;
  isLive?: boolean;
  comingSoon?: boolean;
  gradient: string;
  onClick?: () => void;
  index: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative group cursor-pointer transition-all duration-500 ${comingSoon ? 'opacity-50' : ''}`}
      style={{ animationDelay: `${index * 100}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={!comingSoon ? onClick : undefined}
    >
      {/* Glow on hover */}
      <div
        className={`absolute -inset-1 rounded-2xl blur-xl transition-all duration-500 ${
          isHovered && !comingSoon ? 'opacity-60 scale-105' : 'opacity-0 scale-100'
        }`}
        style={{ background: gradient }}
      />

      {/* Card */}
      <div className={`relative h-full rounded-xl border overflow-hidden transition-all duration-300 ${
        comingSoon
          ? 'bg-gray-900/30 border-gray-800'
          : 'bg-gray-900/80 border-gray-700 hover:border-gray-500 hover:scale-[1.02]'
      }`}>
        {/* Animated gradient overlay */}
        {!comingSoon && (
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-500"
            style={{ background: gradient }}
          />
        )}

        {/* Shine sweep effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden">
          <div
            className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }}
          />
        </div>

        <div className="relative p-5">
          {/* Status badges */}
          <div className="absolute top-3 right-3 flex gap-2">
            {isLive && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/50">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-bold text-green-400">LIVE</span>
              </div>
            )}
            {comingSoon && (
              <div className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/50">
                <span className="text-[10px] font-bold text-purple-400">SOON</span>
              </div>
            )}
          </div>

          {/* Icon */}
          <div className={`text-5xl mb-3 transition-transform duration-300 ${isHovered && !comingSoon ? 'scale-110 -rotate-6' : ''}`}>
            {icon}
          </div>

          {/* Title */}
          <h3 className="font-black text-white text-lg mb-1">{title}</h3>

          {/* Description */}
          <p className="text-gray-500 text-xs mb-3 line-clamp-2">{description}</p>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-600 flex items-center gap-1">
              <Users className="w-3 h-3" />
              {players}
            </span>
            {!comingSoon && (
              <button 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all duration-300 ${
                  isHovered 
                    ? 'bg-white text-black scale-105' 
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                <Play className="w-3 h-3 fill-current" />
                Play
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Activity type for ticker
interface TickerActivity {
  user: string;
  action: string;
  game: string;
  points: string;
}

// Live activity ticker - fetches real users from database
const LiveActivityTicker = () => {
  const [activities, setActivities] = useState<TickerActivity[]>([
    { user: "Loading...", action: "joining", game: "Arena", points: "" },
  ]);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch("/api/gaming/activity-ticker");
        if (res.ok) {
          const data = await res.json();
          if (data.activities && data.activities.length > 0) {
            setActivities(data.activities);
          }
        }
      } catch (error) {
        console.error("Failed to fetch activity ticker:", error);
      }
    };

    fetchActivities();
    // Refresh every 30 seconds
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative overflow-hidden py-3 border-y border-white/5 bg-black/30 backdrop-blur-sm">
      <div className="flex animate-marquee whitespace-nowrap">
        {[...activities, ...activities].map((activity, i) => (
          <div key={i} className="flex items-center gap-2 mx-8">
            <Zap className="w-3 h-3 text-yellow-400" />
            <span className="text-xs">
              <span className="text-cyan-400 font-bold">{activity.user}</span>
              <span className="text-gray-500"> {activity.action} </span>
              <span className="text-white">{activity.game}</span>
              {activity.points && <span className="text-green-400 ml-1">{activity.points}</span>}
            </span>
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee { animation: marquee 30s linear infinite; }
      `}</style>
    </div>
  );
};

export default function GameModePage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { toast } = useToast();
  const [soundEnabled, setSoundEnabled] = useState(true);

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
  const [showChallengeModal, setShowChallengeModal] = useState(false);

  const fetchData = useCallback(async () => {
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
  }, [session?.user?.email]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (authStatus === "authenticated") {
      fetchData();
    }
  }, [authStatus, router, fetchData]);

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
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            {/* Outer ring */}
            <div className="absolute inset-0 border-4 border-red-500/20 rounded-full" />
            {/* Spinning ring */}
            <div className="absolute inset-0 border-4 border-transparent border-t-red-500 rounded-full animate-spin" />
            {/* Inner pulse */}
            <div className="absolute inset-4 bg-red-500/20 rounded-full animate-pulse" />
            {/* Icon */}
            <Gamepad2 className="absolute inset-0 m-auto w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">LOADING ARENA</h2>
          <p className="text-gray-500 animate-pulse">Preparing your battlefield...</p>
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

  // Separate featured game from others
  const otherGames = GAME_MODES.filter(m => m.slug !== "quiz_battle");

  const navigateToMode = (slug: GameModeSlug) => {
    if (slug === "service_sniper") {
      router.push("/game/modes/service-sniper");
    } else if (slug === "hot_streak") {
      router.push("/game/modes/hot-streak");
    } else if (slug === "cloud_tycoon") {
      router.push("/game/modes/cloud-tycoon");
    } else if (slug === "service_slots") {
      router.push("/game/modes/service-slots");
    } else if (slug === "speed_deploy") {
      router.push("/game/modes/speed-deploy");
    } else if (slug === "architect_arena") {
      router.push("/game/modes/architect-arena/lobby");
    } else if (slug === "ticking_bomb") {
      router.push("/game/modes/ticking-bomb");
    } else if (slug === "bug_bounty") {
      router.push("/game/modes/bug-bounty/lobby");
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-hidden">
      {/* Layered animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <FloatingOrbs />
        <AnimatedGrid />
        <ScanLines />
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#050508_70%)]" />
      </div>

      {/* Header */}
      <header className="relative z-20 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-white hover:text-gray-400 transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Exit Arena</span>
          </Link>

          {/* Center Logo */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-lg blur-lg opacity-50 animate-pulse" />
              <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                ARENA
              </h1>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-gray-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-gray-600" />
              )}
            </button>
            {gameProfile && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
                <Crown className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-bold text-yellow-400">{gameProfile.rankFormatted}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Live Activity Ticker */}
      <LiveActivityTicker />

      {/* Main Content */}
      <div className="relative z-10 flex">
        {/* Left: Main content area */}
        <main className="flex-1 overflow-y-auto px-6 py-8 max-h-[calc(100vh-120px)]">
          {/* Incoming Challenge Alert */}
          {incomingChallenges.length > 0 && (
            <div className="mb-8 relative animate-pulse">
              <div className="absolute -inset-2 bg-red-500/30 rounded-2xl blur-xl" />
              <div className="relative bg-gradient-to-r from-red-500/20 to-orange-500/20 border-2 border-red-500 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-red-500/30 flex items-center justify-center animate-bounce">
                      <Swords className="w-7 h-7 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-red-400 flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        INCOMING CHALLENGE!
                      </h3>
                      <p className="text-gray-400">
                        <span className="text-white font-bold">{incomingChallenges[0].player1.name || incomingChallenges[0].player1.username}</span> wants to battle
                      </p>
                    </div>
                  </div>
                  <Link href={`/game/${incomingChallenges[0].matchCode}`}>
                    <Button size="lg" className="bg-red-500 hover:bg-red-400 text-white font-black gap-2 px-8">
                      <Swords className="w-5 h-5" />
                      ACCEPT BATTLE
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Featured Game Carousel */}
          <GameCarousel 
            onPlayQuizBattle={() => setShowChallengeModal(true)} 
            onNavigateToMode={navigateToMode}
          />

          {/* Challenge Modal */}
          {showChallengeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              {/* Backdrop */}
              <div 
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => setShowChallengeModal(false)}
              />
              
              {/* Modal */}
              <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                {/* Close button */}
                <button 
                  onClick={() => setShowChallengeModal(false)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="text-center mb-6">
                  <div className="text-5xl mb-3">⚔️</div>
                  <h3 className="text-2xl font-black bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                    QUIZ BATTLE
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">Choose your opponent</p>
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
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-800/50 border border-gray-700 hover:border-red-500/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold">
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
                          onClick={() => {
                            handleChallenge(opponent.id);
                            setShowChallengeModal(false);
                          }}
                          disabled={challenging === opponent.id}
                          className="bg-red-500 hover:bg-red-400 text-white font-bold gap-2"
                        >
                          {challenging === opponent.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Swords className="w-4 h-4" />
                          )}
                          Fight!
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

          {/* Other Game Modes */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                MORE GAME MODES
              </h2>
              <div className="flex items-center gap-2 text-green-400 text-xs">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span>{GAME_MODES.filter(m => m.isLive).length} Live</span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {otherGames.map((mode) => (
                <GameModeCard
                  key={mode.slug}
                  title={mode.title}
                  icon={mode.icon}
                  description={mode.description}
                  players={mode.players}
                  isLive={mode.isLive}
                  comingSoon={mode.comingSoon}
                  gradient={mode.gradient}
                  index={0}
                  onClick={mode.isLive ? () => navigateToMode(mode.slug) : undefined}
                />
              ))}
            </div>
          </div>
        </main>

        {/* Right: Stats Sidebar */}
        <PlayerStatsSidebar
          gameProfile={gameProfile}
          pendingChallenges={pendingChallenges}
          opponents={opponents}
          recentMatches={matches.recentMatches}
          leaderboard={leaderboard}
          myUserId={myUserId}
          challenging={challenging}
          onChallenge={handleChallenge}
        />
      </div>
    </div>
  );
}
