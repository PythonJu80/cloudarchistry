"use client";

import { cn } from "@/lib/utils";

interface BadgeCardProps {
  name: string;
  description: string;
  icon: string;
  rarity: string;
  unlocked: boolean;
  unlockedAt?: string | null;
  showDescription?: boolean;
  size?: "sm" | "md" | "lg";
}

const rarityColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  common: {
    bg: "bg-slate-500/20",
    border: "border-slate-500/50",
    text: "text-slate-300",
    glow: "",
  },
  uncommon: {
    bg: "bg-green-500/20",
    border: "border-green-500/50",
    text: "text-green-400",
    glow: "shadow-green-500/20",
  },
  rare: {
    bg: "bg-blue-500/20",
    border: "border-blue-500/50",
    text: "text-blue-400",
    glow: "shadow-blue-500/30",
  },
  epic: {
    bg: "bg-purple-500/20",
    border: "border-purple-500/50",
    text: "text-purple-400",
    glow: "shadow-purple-500/40",
  },
  legendary: {
    bg: "bg-amber-500/20",
    border: "border-amber-500/50",
    text: "text-amber-400",
    glow: "shadow-amber-500/50",
  },
};

const sizeClasses = {
  sm: "w-12 h-12 text-xl",
  md: "w-16 h-16 text-2xl",
  lg: "w-20 h-20 text-3xl",
};

export function BadgeCard({
  name,
  description,
  icon,
  rarity,
  unlocked,
  unlockedAt,
  showDescription = true,
  size = "md",
}: BadgeCardProps) {
  const colors = rarityColors[rarity] || rarityColors.common;

  return (
    <div
      className={cn(
        "flex flex-col items-center p-3 rounded-xl border transition-all",
        unlocked
          ? `${colors.bg} ${colors.border} ${colors.glow} shadow-lg`
          : "bg-slate-900/50 border-slate-800 opacity-50 grayscale"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full border-2 mb-2",
          sizeClasses[size],
          unlocked ? `${colors.border} ${colors.bg}` : "border-slate-700 bg-slate-800"
        )}
      >
        <span className={unlocked ? "" : "opacity-30"}>{icon}</span>
      </div>
      <p
        className={cn(
          "font-semibold text-sm text-center",
          unlocked ? colors.text : "text-slate-500"
        )}
      >
        {name}
      </p>
      {showDescription && (
        <p className="text-xs text-slate-500 text-center mt-1 line-clamp-2">
          {description}
        </p>
      )}
      {unlocked && unlockedAt && (
        <p className="text-[10px] text-slate-600 mt-1">
          {new Date(unlockedAt).toLocaleDateString()}
        </p>
      )}
      {!unlocked && (
        <p className="text-[10px] text-slate-600 mt-1">🔒 Locked</p>
      )}
    </div>
  );
}
