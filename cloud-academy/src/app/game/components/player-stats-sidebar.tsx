"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Crown,
  Users,
  Clock,
  Trophy,
  Globe,
  ChevronRight,
  Loader2,
  Swords,
  Flame,
  TrendingUp,
  Star,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  elo: number;
  rankName: string;
  rankColor: string;
  winRate: number;
  isCurrentUser: boolean;
}

interface Opponent {
  id: string;
  name: string | null;
  username: string | null;
  email: string;
  teamName: string;
}

interface PlayerStatsSidebarProps {
  gameProfile: GameProfile | null;
  pendingChallenges: Match[];
  opponents: Opponent[];
  recentMatches: Match[];
  leaderboard: LeaderboardEntry[];
  myUserId: string | null;
  challenging: string | null;
  onChallenge: (opponentId: string) => void;
}

// Animated stat card
const AnimatedStatCard = ({
  value,
  label,
  color,
  icon: Icon,
  trend,
}: {
  value: string | number;
  label: string;
  color: string;
  icon: React.ElementType;
  trend?: "up" | "down" | null;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow on hover */}
      <div
        className={`absolute -inset-0.5 rounded-xl blur-md transition-opacity duration-300 ${isHovered ? "opacity-40" : "opacity-0"}`}
        style={{ background: color }}
      />
      <div className="relative bg-gray-900/80 border border-gray-800 rounded-xl p-3 text-center hover:border-gray-600 transition-all duration-300 overflow-hidden">
        {/* Animated background gradient */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500"
          style={{ background: `linear-gradient(135deg, ${color}, transparent)` }}
        />
        
        {/* Icon floating in corner */}
        <Icon
          className={`absolute top-2 right-2 w-3 h-3 transition-all duration-300 ${isHovered ? "scale-125 rotate-12" : ""}`}
          style={{ color }}
        />
        
        <p className="text-2xl font-black relative" style={{ color }}>{value}</p>
        <p className="text-[9px] text-gray-500 uppercase tracking-wider relative">{label}</p>
        
        {trend && (
          <div className={`absolute bottom-1 right-1 ${trend === "up" ? "text-green-400" : "text-red-400"}`}>
            <TrendingUp className={`w-3 h-3 ${trend === "down" ? "rotate-180" : ""}`} />
          </div>
        )}
      </div>
    </div>
  );
};

// Rank display with animation
const RankDisplay = ({ profile }: { profile: GameProfile }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Calculate progress to next rank (mock - would need real data)
  const progressToNext = 65;

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated glow */}
      <div
        className="absolute -inset-2 rounded-2xl blur-xl opacity-50 animate-pulse"
        style={{ background: `linear-gradient(135deg, ${profile.rankColor}, ${profile.rankColor}50)` }}
      />
      
      {/* Main card */}
      <div
        className="relative overflow-hidden rounded-xl border-2 p-4"
        style={{
          borderColor: profile.rankColor,
          background: `linear-gradient(135deg, ${profile.rankColor}20, transparent, ${profile.rankColor}10)`,
        }}
      >
        {/* Animated shine effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden">
          <div
            className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }}
          />
        </div>

        {/* Content */}
        <div className="relative flex items-center gap-4">
          {/* Rank icon with animation */}
          <div className="relative">
            <div
              className={`transition-transform duration-300 ${isHovered ? "scale-110 rotate-6" : ""}`}
            >
              <Crown className="w-10 h-10" style={{ color: profile.rankColor }} />
            </div>
            {/* Sparkle particles */}
            {isHovered && (
              <>
                <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-yellow-400 animate-ping" />
                <Star className="absolute -bottom-1 -left-1 w-2 h-2 text-yellow-400 animate-pulse" />
              </>
            )}
          </div>

          <div className="flex-1">
            <p className="text-2xl font-black tracking-tight" style={{ color: profile.rankColor }}>
              {profile.rankFormatted}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{profile.elo} ELO</span>
              <span className="text-[10px] text-gray-600">•</span>
              <span className="text-[10px] text-gray-500">Top 15%</span>
            </div>
          </div>

          {/* Mini trophy for high ranks */}
          {profile.rankTier >= 3 && (
            <Trophy className="w-5 h-5 text-yellow-500 animate-bounce" style={{ animationDuration: "2s" }} />
          )}
        </div>

        {/* Progress bar to next rank */}
        <div className="mt-3 relative">
          <div className="flex items-center justify-between text-[9px] text-gray-500 mb-1">
            <span>Progress to next rank</span>
            <span>{progressToNext}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${progressToNext}%`,
                background: `linear-gradient(90deg, ${profile.rankColor}, ${profile.rankColor}80)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};


export function PlayerStatsSidebar({
  gameProfile,
  pendingChallenges,
  opponents,
  recentMatches,
  leaderboard,
  myUserId,
  challenging,
  onChallenge,
}: PlayerStatsSidebarProps) {
  return (
    <aside className="border-l border-white/5 bg-black/50 backdrop-blur-xl overflow-y-auto max-h-[calc(100dvh-120px)]" style={{ width: 'clamp(256px, 22vw, 384px)' }}>
      <div className="p-4 space-y-4">
        {/* Rank Display */}
        {gameProfile && <RankDisplay profile={gameProfile} />}

        {/* Stats Grid - Animated */}
        {gameProfile && (
          <div className="grid grid-cols-2 gap-2">
            <AnimatedStatCard
              value={`${gameProfile.winRate}%`}
              label="Win Rate"
              color="#22c55e"
              icon={TrendingUp}
              trend={gameProfile.winRate > 50 ? "up" : "down"}
            />
            <AnimatedStatCard
              value={`${gameProfile.totalWins}-${gameProfile.totalLosses}`}
              label="Record"
              color="#3b82f6"
              icon={Trophy}
            />
            <AnimatedStatCard
              value={gameProfile.winStreak}
              label="Streak"
              color={gameProfile.winStreak >= 3 ? "#f97316" : "#6b7280"}
              icon={Flame}
            />
            <AnimatedStatCard
              value={gameProfile.totalPoints.toLocaleString()}
              label="Points"
              color="#a855f7"
              icon={Star}
            />
          </div>
        )}

        {/* Pending Challenges */}
        {pendingChallenges.length > 0 && (
          <div className="relative overflow-hidden rounded-xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-transparent p-3">
            <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-500/10 rounded-full blur-2xl" />
            <h3 className="text-xs font-black text-yellow-400 flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 animate-pulse" />
              AWAITING RESPONSE
            </h3>
            {pendingChallenges.map((match) => (
              <Link key={match.id} href={`/game/${match.matchCode}`}>
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-yellow-500/10 transition-colors group">
                  <span className="text-xs text-gray-300">vs {match.player2.name || match.player2.username}</span>
                  <Badge className="text-yellow-400 bg-yellow-500/20 border-yellow-500/30 text-[10px] group-hover:scale-105 transition-transform">
                    Pending
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Quick Challenge */}
        <div className="relative overflow-hidden rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-transparent p-3">
          <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/10 rounded-full blur-2xl" />
          <h3 className="text-xs font-black flex items-center gap-2 mb-3 text-cyan-400">
            <Users className="w-4 h-4" />
            QUICK CHALLENGE
          </h3>
          {opponents.length === 0 ? (
            <div className="text-center py-4">
              <Users className="w-6 h-6 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-xs">No teammates online</p>
              <Link href="/cohort">
                <Button variant="ghost" size="sm" className="mt-2 text-[10px] text-cyan-400">
                  Invite Friends
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {opponents.slice(0, 3).map((opponent) => (
                <div
                  key={opponent.id}
                  className="flex items-center justify-between p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center font-bold text-xs">
                        {(opponent.name || opponent.username || "?")[0].toUpperCase()}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-gray-900" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-white">{opponent.name || opponent.username}</span>
                      <p className="text-[9px] text-gray-500">Online</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => onChallenge(opponent.id)}
                    disabled={challenging === opponent.id}
                    size="sm"
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold text-[10px] h-7 px-3 group-hover:scale-105 transition-transform"
                  >
                    {challenging === opponent.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Swords className="w-3 h-3 mr-1" />
                        Fight
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Matches */}
        {recentMatches.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-3">
            <h3 className="text-xs font-black flex items-center gap-2 mb-3 text-gray-300">
              <Trophy className="w-4 h-4 text-yellow-500" />
              RECENT BATTLES
            </h3>
            <div className="space-y-2">
              {recentMatches.slice(0, 5).map((match) => {
                const isWinner =
                  match.player1Score > match.player2Score
                    ? match.player1.id === myUserId
                    : match.player2.id === myUserId;

                return (
                  <div
                    key={match.id}
                    className={`flex items-center justify-between p-2 rounded-lg transition-all hover:scale-[1.02] ${
                      isWinner
                        ? "bg-green-500/10 border border-green-500/20"
                        : "bg-red-500/10 border border-red-500/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        isWinner ? "bg-green-500/30" : "bg-red-500/30"
                      }`}>
                        {isWinner ? (
                          <Trophy className="w-3 h-3 text-green-400" />
                        ) : (
                          <Swords className="w-3 h-3 text-red-400" />
                        )}
                      </div>
                      <span className="text-xs text-gray-300">
                        vs{" "}
                        {match.player1.id === myUserId
                          ? match.player2.name || match.player2.username
                          : match.player1.name || match.player1.username}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500">
                        {match.player1Score}-{match.player2Score}
                      </span>
                      <Badge
                        className={`text-[10px] font-black ${
                          isWinner ? "bg-green-500/30 text-green-400" : "bg-red-500/30 text-red-400"
                        }`}
                      >
                        {isWinner ? "WIN" : "LOSS"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black flex items-center gap-2 text-gray-300">
              <Globe className="w-4 h-4 text-cyan-400" />
              GLOBAL RANKINGS
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] text-gray-400 hover:text-white h-5 px-1"
            >
              View All <ChevronRight className="w-3 h-3" />
            </Button>
          </div>

          {leaderboard.length === 0 ? (
            <div className="text-center py-6">
              <div className="relative inline-block">
                <Trophy className="w-10 h-10 text-gray-700 mx-auto" />
                <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-500/50 animate-pulse" />
              </div>
              <p className="text-gray-500 text-xs mt-2">No rankings yet</p>
              <p className="text-gray-600 text-[10px]">Be the first to compete!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {leaderboard.slice(0, 5).map((entry, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 p-2 rounded-lg transition-all hover:scale-[1.02] ${
                    entry.isCurrentUser
                      ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                      entry.rank === 1
                        ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black"
                        : entry.rank === 2
                          ? "bg-gradient-to-br from-gray-300 to-gray-500 text-black"
                          : entry.rank === 3
                            ? "bg-gradient-to-br from-orange-400 to-orange-600 text-black"
                            : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {entry.rank === 1 ? "👑" : entry.rank}
                  </div>
                  <span className={`text-xs flex-1 truncate ${entry.isCurrentUser ? "text-cyan-400 font-bold" : "text-gray-300"}`}>
                    {entry.displayName}
                    {entry.isCurrentUser && " (You)"}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">{entry.elo}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
