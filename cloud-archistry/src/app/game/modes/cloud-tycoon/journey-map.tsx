"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check, MapPin, Flag } from "lucide-react";
import { Business } from "./types";

interface JourneyMapProps {
  businesses: Business[];
  currentIndex: number;
  completedIds: Set<string>;
  onBusinessClick: (business: Business, index: number) => void;
}

// Waypoint positions for a winding GPS-style path
const WAYPOINTS = [
  { x: 8, y: 85 },   // Start bottom-left
  { x: 20, y: 65 },
  { x: 35, y: 45 },
  { x: 25, y: 25 },
  { x: 45, y: 15 },
  { x: 60, y: 30 },
  { x: 55, y: 55 },
  { x: 70, y: 70 },
  { x: 85, y: 50 },
  { x: 92, y: 20 },  // End top-right (destination)
];

export function JourneyMap({ 
  businesses, 
  currentIndex, 
  completedIds, 
  onBusinessClick 
}: JourneyMapProps) {
  // Generate SVG path that goes exactly through each waypoint
  const generatePath = () => {
    if (businesses.length === 0) return "";
    
    const points = businesses.map((_, i) => {
      const wp = WAYPOINTS[i] || WAYPOINTS[WAYPOINTS.length - 1];
      return wp;
    });
    
    if (points.length < 2) return "";
    
    // Use Catmull-Rom to cubic bezier conversion for smooth path through all points
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      
      // Catmull-Rom to Bezier control points
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    
    return path;
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-slate-950 overflow-hidden">
      {/* Dark map background with street grid */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(90deg, rgba(30, 41, 59, 0.3) 1px, transparent 1px),
            linear-gradient(rgba(30, 41, 59, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(30, 41, 59, 0.15) 1px, transparent 1px),
            linear-gradient(rgba(30, 41, 59, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: "100px 100px, 100px 100px, 20px 20px, 20px 20px",
        }}
      />
      
      {/* Subtle glow areas */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-green-500/5 rounded-full blur-3xl" />

      {/* SVG for the route path */}
      <svg 
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Glow filter */}
          <filter id="routeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.8" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background path (gray, dashed for incomplete) */}
        <path
          d={generatePath()}
          fill="none"
          stroke="rgba(71, 85, 105, 0.5)"
          strokeWidth="0.4"
          strokeDasharray="1 0.5"
          strokeLinecap="round"
        />
        
        {/* Completed path (orange/amber glow) */}
        {currentIndex > 0 && (
          <motion.path
            d={generatePath()}
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="0.6"
            strokeLinecap="round"
            filter="url(#routeGlow)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: currentIndex / Math.max(businesses.length - 1, 1) }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        )}
        
        {/* Gradient for completed path */}
        <defs>
          <linearGradient id="routeGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
      </svg>

      {/* START Marker - positioned to the left of first waypoint */}
      {businesses.length > 0 && (
        <motion.div
          className="absolute"
          style={{
            left: `${WAYPOINTS[0].x - 5}%`,
            top: `${WAYPOINTS[0].y}%`,
            transform: "translate(-50%, -50%)",
          }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-green-500 rounded-lg shadow-lg shadow-green-500/30">
              <span className="text-xs font-bold text-white tracking-wider">START</span>
            </div>
            <div className="w-4 h-0.5 bg-green-500/50" />
          </div>
        </motion.div>
      )}

      {/* FINISH Marker - positioned below last waypoint */}
      {businesses.length > 0 && (
        <motion.div
          className="absolute"
          style={{
            left: `${WAYPOINTS[Math.min(businesses.length - 1, WAYPOINTS.length - 1)].x}%`,
            top: `${WAYPOINTS[Math.min(businesses.length - 1, WAYPOINTS.length - 1)].y + 10}%`,
            transform: "translate(-50%, -50%)",
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-3 bg-amber-500/50" />
            <div className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg shadow-lg shadow-amber-500/30 flex items-center gap-1.5">
              <Flag className="w-3 h-3 text-white" />
              <span className="text-xs font-bold text-white tracking-wider">FINISH</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Business waypoints */}
      {businesses.map((business, index) => {
        const wp = WAYPOINTS[index] || WAYPOINTS[WAYPOINTS.length - 1];
        const isCompleted = completedIds.has(business.id);
        const isCurrent = index === currentIndex;
        const isLocked = index > currentIndex && !isCompleted;
        const isStart = index === 0;
        const isFinish = index === businesses.length - 1;
        
        return (
          <motion.div
            key={business.id}
            className="absolute"
            style={{
              left: `${wp.x}%`,
              top: `${wp.y}%`,
              transform: "translate(-50%, -50%)",
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.08, type: "spring", stiffness: 200 }}
          >
            <button
              onClick={() => !isLocked && onBusinessClick(business, index)}
              disabled={isLocked}
              className={cn(
                "relative group",
                isLocked && "cursor-not-allowed"
              )}
            >
              {/* Pulse for current location */}
              {isCurrent && !isCompleted && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-amber-500/40"
                  style={{ width: 60, height: 60, marginLeft: -14, marginTop: -14 }}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
              
              {/* Glow ring for start/finish */}
              {(isStart || isFinish) && !isCompleted && (
                <motion.div
                  className={cn(
                    "absolute inset-0 rounded-full",
                    isStart ? "bg-green-500/20" : "bg-amber-500/20"
                  )}
                  style={{ width: 48, height: 48, marginLeft: -8, marginTop: -8 }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              )}
              
              {/* Waypoint marker */}
              <div
                className={cn(
                  "relative flex flex-col items-center",
                )}
              >
                {/* Pin/marker */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-lg transition-transform",
                    isCompleted 
                      ? "bg-green-500 shadow-green-500/50"
                      : isCurrent
                        ? "bg-amber-500 shadow-amber-500/50 scale-110"
                        : isFinish
                          ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-400/50"
                          : isStart
                            ? "bg-green-500 shadow-green-500/50"
                            : isLocked
                              ? "bg-slate-700 opacity-50"
                              : "bg-cyan-500 shadow-cyan-500/50",
                    !isLocked && "group-hover:scale-110",
                    (isStart || isFinish) && !isCompleted && "w-10 h-10"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : isFinish ? (
                    <Flag className="w-4 h-4 text-white" />
                  ) : isStart && isCurrent ? (
                    <MapPin className="w-4 h-4 text-white" />
                  ) : isStart ? (
                    <span className="text-lg">🚀</span>
                  ) : isCurrent ? (
                    <MapPin className="w-4 h-4 text-white" />
                  ) : (
                    <span className="text-sm">{business.icon}</span>
                  )}
                </div>
                
                {/* Label card */}
                <div
                  className={cn(
                    "mt-1 px-2 py-1 rounded-lg text-center min-w-[80px] transition-all",
                    isCompleted 
                      ? "bg-green-500/20 border border-green-500/40"
                      : isCurrent
                        ? "bg-amber-500/20 border border-amber-500/40"
                        : isFinish
                          ? "bg-amber-500/20 border border-amber-500/40"
                          : isStart
                            ? "bg-green-500/20 border border-green-500/40"
                            : isLocked
                              ? "bg-slate-800/50 border border-slate-700/50 opacity-50"
                              : "bg-cyan-500/20 border border-cyan-500/40",
                    !isLocked && "group-hover:scale-105"
                  )}
                >
                  <p className={cn(
                    "text-[10px] font-semibold truncate max-w-[70px]",
                    isCompleted ? "text-green-400" 
                      : isCurrent ? "text-amber-400" 
                      : isFinish ? "text-amber-400"
                      : isStart ? "text-green-400"
                      : isLocked ? "text-slate-500" 
                      : "text-cyan-400"
                  )}>
                    {business.business_name.split(" ")[0]}
                  </p>
                  <p className={cn(
                    "text-[9px]",
                    isCompleted ? "text-green-400/70" : "text-slate-500"
                  )}>
                    ${(business.contract_value / 1000).toFixed(0)}K
                  </p>
                </div>
              </div>
            </button>
          </motion.div>
        );
      })}
      
    </div>
  );
}
