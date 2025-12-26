"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trophy, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecentBadge {
  id: string;
  slug: string;
  name: string;
  icon: string;
  rarity: string;
  unlockedAt: string;
}

interface BadgeStats {
  total: number;
  unlocked: number;
  percentage: number;
}

const rarityColors: Record<string, string> = {
  common: "border-slate-500/50 bg-slate-500/10",
  uncommon: "border-green-500/50 bg-green-500/10",
  rare: "border-blue-500/50 bg-blue-500/10",
  epic: "border-purple-500/50 bg-purple-500/10",
  legendary: "border-amber-500/50 bg-amber-500/10 animate-pulse",
};

export function BadgesWidget() {
  const [stats, setStats] = useState<BadgeStats | null>(null);
  const [recentBadges, setRecentBadges] = useState<RecentBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    try {
      const res = await fetch("/api/gaming/badges");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setRecentBadges(data.recentUnlocks || []);
      }
    } catch (error) {
      console.error("Failed to fetch badges:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 rounded-xl border border-border/50 bg-card/50">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl border border-border/50 bg-card/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold">Badges</h3>
            {stats && (
              <p className="text-sm text-muted-foreground">
                {stats.unlocked}/{stats.total} unlocked
              </p>
            )}
          </div>
        </div>
        <Link
          href="/badges"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View all
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Progress bar */}
      {stats && (
        <div className="mb-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
              style={{ width: `${stats.percentage}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {stats.percentage}% complete
          </p>
        </div>
      )}

      {/* Recent badges */}
      {recentBadges.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Recent Unlocks
          </p>
          <div className="flex gap-2 flex-wrap">
            {recentBadges.slice(0, 5).map((badge) => (
              <div
                key={badge.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
                  rarityColors[badge.rarity] || rarityColors.common
                )}
                title={`${badge.name} - ${new Date(badge.unlockedAt).toLocaleDateString()}`}
              >
                <span className="text-lg">{badge.icon}</span>
                <span className="text-sm font-medium">{badge.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Play games to earn badges!
        </p>
      )}
    </div>
  );
}
