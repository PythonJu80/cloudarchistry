"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { BadgeCard } from "@/components/badges";
import { Trophy, Medal, Crown, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserBadge {
  id: string;
  slug: string;
  name: string;
  icon: string;
  rarity: string;
  unlockedAt: string;
}

interface LeaderboardUser {
  id: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  badgeCount: number;
  badges: UserBadge[] | null;
  isCurrentUser: boolean;
}

interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  category: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

interface BadgesData {
  currentUser: {
    id: string;
    name: string | null;
    username: string | null;
    avatarUrl: string | null;
  };
  badges: Badge[];
  stats: {
    total: number;
    unlocked: number;
    percentage: number;
    byRarity: {
      common: number;
      uncommon: number;
      rare: number;
      epic: number;
      legendary: number;
    };
  };
  leaderboard: LeaderboardUser[];
}

const rarityColors: Record<string, string> = {
  common: "border-slate-500/50 bg-slate-500/10",
  uncommon: "border-green-500/50 bg-green-500/10",
  rare: "border-blue-500/50 bg-blue-500/10",
  epic: "border-purple-500/50 bg-purple-500/10",
  legendary: "border-amber-500/50 bg-amber-500/10",
};

export default function BadgesPage() {
  const [data, setData] = useState<BadgesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    try {
      const res = await fetch("/api/gaming/badges");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch badges:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar activePath="/badges" variant="transparent" />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar activePath="/badges" variant="transparent" />
        <div className="text-center pt-32 text-muted-foreground">
          Failed to load badges
        </div>
      </div>
    );
  }

  const currentUserEntry = data.leaderboard.find((u) => u.isCurrentUser);

  return (
    <div className="min-h-screen bg-background">
      <Navbar activePath="/badges" variant="transparent" />

      <main className="max-w-7xl mx-auto px-6 pt-24 pb-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Trophy className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Badge Leaderboard</h1>
            <p className="text-muted-foreground">
              See who has earned the most badges
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left: Current User Spotlight */}
          <div className="lg:col-span-1 space-y-6">
            {/* Your Stats Card */}
            <div className="p-6 rounded-2xl border-2 border-primary/50 bg-gradient-to-br from-primary/10 to-primary/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  {currentUserEntry?.avatarUrl ? (
                    <img
                      src={currentUserEntry.avatarUrl}
                      alt=""
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <User className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-lg">
                    {data.currentUser.name || data.currentUser.username || "You"}
                  </p>
                  <p className="text-sm text-muted-foreground">Your Progress</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl bg-background/50 text-center">
                  <p className="text-3xl font-bold text-primary">
                    {data.stats.unlocked}
                  </p>
                  <p className="text-xs text-muted-foreground">Badges Earned</p>
                </div>
                <div className="p-3 rounded-xl bg-background/50 text-center">
                  <p className="text-3xl font-bold text-amber-400">
                    {data.stats.percentage}%
                  </p>
                  <p className="text-xs text-muted-foreground">Complete</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="h-3 bg-background/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                    style={{ width: `${data.stats.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {data.stats.unlocked} / {data.stats.total} badges
                </p>
              </div>

              {/* Rarity breakdown */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  By Rarity
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.stats.byRarity.legendary > 0 && (
                    <span className="px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {data.stats.byRarity.legendary} Legendary
                    </span>
                  )}
                  {data.stats.byRarity.epic > 0 && (
                    <span className="px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      {data.stats.byRarity.epic} Epic
                    </span>
                  )}
                  {data.stats.byRarity.rare > 0 && (
                    <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      {data.stats.byRarity.rare} Rare
                    </span>
                  )}
                  {data.stats.byRarity.uncommon > 0 && (
                    <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                      {data.stats.byRarity.uncommon} Uncommon
                    </span>
                  )}
                  {data.stats.byRarity.common > 0 && (
                    <span className="px-2 py-1 rounded text-xs bg-slate-500/20 text-slate-400 border border-slate-500/30">
                      {data.stats.byRarity.common} Common
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Your Badges */}
            <div className="p-6 rounded-xl border border-border/50 bg-card/50">
              <h3 className="font-semibold mb-4">Your Badges</h3>
              {currentUserEntry?.badges && currentUserEntry.badges.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {currentUserEntry.badges.map((badge) => (
                    <div
                      key={badge.id}
                      className={cn(
                        "flex flex-col items-center p-2 rounded-lg border",
                        rarityColors[badge.rarity]
                      )}
                      title={badge.name}
                    >
                      <span className="text-2xl">{badge.icon}</span>
                      <span className="text-[10px] text-center mt-1 line-clamp-1">
                        {badge.name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Play games to earn badges!
                </p>
              )}
            </div>
          </div>

          {/* Right: Leaderboard */}
          <div className="lg:col-span-2">
            <div className="p-6 rounded-xl border border-border/50 bg-card/50">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Medal className="w-5 h-5 text-amber-400" />
                All Users
              </h3>

              <div className="space-y-3">
                {data.leaderboard.map((user, index) => {
                  const rank = index + 1;
                  const isTop3 = rank <= 3;

                  return (
                    <div
                      key={user.id}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border transition-all",
                        user.isCurrentUser
                          ? "border-primary/50 bg-primary/5"
                          : "border-border/50 bg-background/50 hover:bg-muted/30"
                      )}
                    >
                      {/* Rank */}
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                          rank === 1
                            ? "bg-gradient-to-br from-amber-400 to-yellow-500 text-black"
                            : rank === 2
                            ? "bg-gradient-to-br from-slate-300 to-slate-400 text-black"
                            : rank === 3
                            ? "bg-gradient-to-br from-amber-600 to-amber-700 text-white"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {isTop3 ? (
                          <Crown className="w-5 h-5" />
                        ) : (
                          rank
                        )}
                      </div>

                      {/* User info */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-semibold truncate",
                          user.isCurrentUser && "text-primary"
                        )}>
                          {user.name || user.username || "Anonymous"}
                          {user.isCurrentUser && (
                            <span className="ml-2 text-xs text-primary">(You)</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {user.badgeCount} badge{user.badgeCount !== 1 ? "s" : ""}
                        </p>
                      </div>

                      {/* Badges preview */}
                      <div className="hidden sm:flex items-center gap-1">
                        {user.badges ? (
                          <>
                            {user.badges.slice(0, 5).map((badge) => (
                              <div
                                key={badge.id}
                                className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center border",
                                  rarityColors[badge.rarity]
                                )}
                                title={badge.name}
                              >
                                <span className="text-sm">{badge.icon}</span>
                              </div>
                            ))}
                            {user.badges.length > 5 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                +{user.badges.length - 5}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No badges yet
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {data.leaderboard.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground">
                    No users found
                  </p>
                )}
              </div>
            </div>

            {/* All Available Badges */}
            <div className="mt-6 p-6 rounded-xl border border-border/50 bg-card/50">
              <h3 className="font-semibold mb-4">All Available Badges</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {data.badges.map((badge) => (
                  <BadgeCard
                    key={badge.id}
                    name={badge.name}
                    description={badge.description}
                    icon={badge.icon}
                    rarity={badge.rarity}
                    unlocked={badge.unlocked}
                    unlockedAt={badge.unlockedAt}
                    size="sm"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
