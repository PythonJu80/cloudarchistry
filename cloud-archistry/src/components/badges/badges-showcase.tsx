"use client";

import { useState, useEffect } from "react";
import { Loader2, Trophy, Award } from "lucide-react";
import { BadgeCard } from "./badge-card";
import { cn } from "@/lib/utils";

interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  category: string;
  pointsReward: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

interface BadgesData {
  badges: Badge[];
  byCategory: Record<string, Badge[]>;
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
  recentUnlocks: Array<{
    id: string;
    slug: string;
    name: string;
    icon: string;
    rarity: string;
    unlockedAt: string;
  }>;
}

const categoryLabels: Record<string, string> = {
  general: "General",
  quiz_battle: "Quiz Battle",
  hot_streak: "Hot Streak",
  service_sniper: "Service Sniper",
  service_slots: "Service Slots",
  speed_deploy: "Speed Deploy",
  cloud_tycoon: "Cloud Tycoon",
  bug_bounty: "Bug Bounty",
  architect_arena: "Architect Arena",
  learning: "Learning",
  challenges: "Challenges",
  streaks: "Streaks",
  milestones: "Milestones",
  special: "Special",
};

const rarityOrder = ["common", "uncommon", "rare", "epic", "legendary"];

export function BadgesShowcase() {
  const [data, setData] = useState<BadgesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");

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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load badges
      </div>
    );
  }

  const categories = Object.keys(data.byCategory);
  const displayBadges =
    activeCategory === "all"
      ? data.badges
      : data.byCategory[activeCategory] || [];

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Badges</h2>
            <p className="text-sm text-muted-foreground">
              {data.stats.unlocked} of {data.stats.total} unlocked ({data.stats.percentage}%)
            </p>
          </div>
        </div>

        {/* Rarity breakdown */}
        <div className="hidden md:flex items-center gap-4 text-sm">
          <span className="text-slate-400">{data.stats.byRarity.common} Common</span>
          <span className="text-green-400">{data.stats.byRarity.uncommon} Uncommon</span>
          <span className="text-blue-400">{data.stats.byRarity.rare} Rare</span>
          <span className="text-purple-400">{data.stats.byRarity.epic} Epic</span>
          <span className="text-amber-400">{data.stats.byRarity.legendary} Legendary</span>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveCategory("all")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            activeCategory === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80 text-muted-foreground"
          )}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              activeCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
          >
            {categoryLabels[cat] || cat}
          </button>
        ))}
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {displayBadges
          .sort((a, b) => {
            // Sort: unlocked first, then by rarity
            if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
            return rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity);
          })
          .map((badge) => (
            <BadgeCard
              key={badge.id}
              name={badge.name}
              description={badge.description}
              icon={badge.icon}
              rarity={badge.rarity}
              unlocked={badge.unlocked}
              unlockedAt={badge.unlockedAt}
            />
          ))}
      </div>

      {displayBadges.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No badges in this category yet</p>
        </div>
      )}
    </div>
  );
}
