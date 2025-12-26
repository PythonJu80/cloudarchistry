"use client";

import { useMemo } from "react";

// Pre-generate particle positions for stable rendering
const generateParticles = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: i,
    left: (i * 17 + 7) % 100, // Deterministic spread
    top: (i * 23 + 11) % 100,
    delay: (i * 0.06) % 3,
    duration: 2 + (i % 3),
  }));

// Animated background particles for arena atmosphere
export function ParticleField() {
  const particles = useMemo(() => generateParticles(50), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-1 h-1 bg-white/20 rounded-full animate-pulse"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

// Glowing orb effect for background ambiance
export function GlowOrb({
  color,
  size,
  top,
  left,
  delay = 0,
}: {
  color: string;
  size: number;
  top: string;
  left: string;
  delay?: number;
}) {
  return (
    <div
      className="absolute rounded-full blur-3xl animate-pulse opacity-30"
      style={{
        background: color,
        width: size,
        height: size,
        top,
        left,
        animationDelay: `${delay}s`,
        animationDuration: "4s",
      }}
    />
  );
}
