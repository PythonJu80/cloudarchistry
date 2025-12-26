"use client";

import { useState } from "react";
import { Users, Play, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GameCardProps {
  title: string;
  icon: string;
  description: string;
  players: string;
  isLive?: boolean;
  comingSoon?: boolean;
  gradient: string;
  onClick?: () => void;
  featured?: boolean;
}

export function GameCard({
  title,
  icon,
  description,
  players,
  isLive,
  comingSoon,
  gradient,
  onClick,
  featured = false,
}: GameCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative group cursor-pointer transition-all duration-500 ${featured ? "col-span-2 row-span-2" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={!comingSoon ? onClick : undefined}
    >
      {/* Glow effect on hover */}
      <div
        className={`absolute -inset-1 rounded-2xl blur-xl transition-opacity duration-500 ${isHovered && !comingSoon ? "opacity-60" : "opacity-0"}`}
        style={{ background: gradient }}
      />

      {/* Card */}
      <div
        className={`relative h-full rounded-2xl border overflow-hidden transition-all duration-300 ${
          comingSoon
            ? "bg-gray-900/50 border-gray-800 opacity-60"
            : "bg-gray-900/80 border-gray-700 hover:border-gray-500"
        }`}
      >
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
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
            }}
          />
        </div>

        {/* Content */}
        <div className={`relative p-6 h-full flex flex-col ${featured ? "justify-between" : ""}`}>
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
              className={`text-6xl ${featured ? "text-8xl" : ""} transition-transform duration-300 ${isHovered && !comingSoon ? "scale-110" : ""}`}
              style={{
                filter:
                  isHovered && !comingSoon
                    ? `drop-shadow(0 0 20px ${gradient.split(",")[0]?.replace("linear-gradient(135deg, ", "") || "#fff"})`
                    : "none",
              }}
            >
              {icon}
            </div>
          </div>

          {/* Title */}
          <h3 className={`font-black text-white mb-2 ${featured ? "text-3xl" : "text-xl"}`}>
            {title}
          </h3>

          {/* Description */}
          <p className={`text-gray-400 mb-4 ${featured ? "text-base" : "text-sm"}`}>
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
                    ? "bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-white px-8"
                    : "bg-white/10 hover:bg-white/20 text-white"
                }`}
              >
                <Play className="w-4 h-4" />
                {featured ? "PLAY NOW" : "Play"}
              </Button>
            ) : (
              <Lock className="w-5 h-5 text-gray-600" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
