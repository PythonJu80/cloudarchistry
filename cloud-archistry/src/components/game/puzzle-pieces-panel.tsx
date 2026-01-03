"use client";

/**
 * Puzzle Pieces Panel for Architect Arena
 * 
 * Displays puzzle pieces grouped by category in a collapsible sidebar.
 * Users drag pieces from this panel onto the React Flow canvas.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Server,
  Database,
  HardDrive,
  Globe,
  Shield,
  Network,
  Layers,
  Container,
  Zap,
  Box,
  Key,
  Users,
  Workflow,
  BarChart3,
  Bell,
  Activity,
  Settings,
  Boxes,
  Cloud,
} from "lucide-react";

// Types matching the backend puzzle
interface PuzzlePiece {
  id: string;
  service_id: string;
  label: string;
  sublabel?: string;
  hint?: string;
  required: boolean;
  category: string;
}

// Category display info
const CATEGORY_INFO: Record<string, { name: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  // AWS Boundaries & Actors
  boundaries: { name: "AWS Boundaries", color: "#232F3E", icon: Cloud },
  actors: { name: "External Actors", color: "#64748b", icon: Users },
  // Services
  networking: { name: "Networking", color: "#3b82f6", icon: Network },
  compute: { name: "Compute", color: "#f97316", icon: Server },
  containers: { name: "Containers", color: "#8b5cf6", icon: Container },
  database: { name: "Database", color: "#6366f1", icon: Database },
  storage: { name: "Storage", color: "#22c55e", icon: HardDrive },
  security: { name: "Security", color: "#ef4444", icon: Shield },
  integration: { name: "Integration", color: "#ec4899", icon: Workflow },
  analytics: { name: "Analytics", color: "#eab308", icon: BarChart3 },
  management: { name: "Management", color: "#64748b", icon: Settings },
  devops: { name: "DevOps", color: "#14b8a6", icon: Boxes },
};

// Icon mapping for services
const serviceIconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  // AWS Boundaries
  "aws-cloud": Cloud,
  "region": Globe,
  "availability-zone": Layers,
  // Networking
  "vpc": Network,
  "subnet-public": Layers,
  "subnet-private": Layers,
  "security-group": Shield,
  "internet-gateway": Globe,
  "nat-gateway": Network,
  "alb": Boxes,
  "nlb": Boxes,
  "route53": Globe,
  "cloudfront": Globe,
  // Compute
  "ec2": Server,
  "auto-scaling": Boxes,
  "lambda": Zap,
  "ebs": HardDrive,
  "efs": HardDrive,
  // Containers
  "ecs": Container,
  "eks": Container,
  "fargate": Container,
  "ecr": Box,
  // Database
  "rds": Database,
  "aurora": Database,
  "dynamodb": Database,
  "elasticache": Database,
  "redshift": Database,
  // Storage
  "s3": HardDrive,
  "glacier": HardDrive,
  // Security
  "iam": Users,
  "kms": Key,
  "secrets-manager": Key,
  "cognito": Users,
  "waf": Shield,
  "guardduty": Shield,
  // Integration
  "api-gateway": Workflow,
  "eventbridge": Activity,
  "sns": Bell,
  "sqs": Box,
  "step-functions": Workflow,
  // Management
  "cloudwatch": BarChart3,
  "cloudtrail": Activity,
  "systems-manager": Settings,
  "config": Settings,
};

// Emoji icons for general icons (external actors) - rendered as text, not Lucide icons
const ICON_EMOJIS: Record<string, string> = {
  "icon-user": "👤",
  "icon-users": "👥",
  "icon-mobile": "📱",
  "icon-laptop": "💻",
  "icon-desktop": "🖥️",
  "icon-internet": "🌐",
  "icon-cloud": "☁️",
  "icon-corporate": "🏢",
  "icon-onprem": "🏭",
  "icon-server": "🗄️",
  "icon-database": "💾",
  "icon-security": "🔒",
};

interface PuzzlePiecesPanelProps {
  pieces: PuzzlePiece[];
  placedPieceIds: Set<string>;
  onDragStart: (event: React.DragEvent, piece: PuzzlePiece) => void;
}

export function PuzzlePiecesPanel({ pieces, placedPieceIds, onDragStart }: PuzzlePiecesPanelProps) {
  // Group pieces by category
  const piecesByCategory = pieces.reduce((acc, piece) => {
    const cat = piece.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(piece);
    return acc;
  }, {} as Record<string, PuzzlePiece[]>);

  // All categories expanded by default
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(piecesByCategory))
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Count placed vs total
  const placedCount = placedPieceIds.size;
  const totalCount = pieces.length;

  return (
    <div className="flex flex-col h-full bg-slate-900/50">
      {/* Header */}
      <div className="p-3 border-b border-slate-800">
        <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-1">Puzzle Pieces</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">
            {placedCount} / {totalCount} placed
          </span>
          <div className="h-1.5 w-20 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-cyan-500 transition-all duration-300"
              style={{ width: `${(placedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Pieces by Category */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(piecesByCategory).map(([category, categoryPieces]) => {
          const catInfo = CATEGORY_INFO[category] || { 
            name: category.charAt(0).toUpperCase() + category.slice(1), 
            color: "#64748b",
            icon: Box 
          };
          const CategoryIcon = catInfo.icon;
          const isExpanded = expandedCategories.has(category);
          const placedInCategory = categoryPieces.filter(p => placedPieceIds.has(p.id)).length;

          return (
            <div key={category} className="border-b border-slate-800/50">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800/50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                )}
                <CategoryIcon className="w-4 h-4 text-cyan-400" />
                <span className="flex-1 text-left text-xs font-medium text-slate-300">
                  {catInfo.name}
                </span>
                <span className="text-[10px] text-slate-500">
                  {placedInCategory}/{categoryPieces.length}
                </span>
              </button>

              {/* Category Pieces */}
              {isExpanded && (
                <div className="px-2 pb-2 space-y-1">
                  {categoryPieces.map((piece) => {
                    const isPlaced = placedPieceIds.has(piece.id);
                    const ServiceIcon = serviceIconMap[piece.service_id] || Box;
                    const isEmojiIcon = piece.service_id.startsWith("icon-");
                    const emojiIcon = isEmojiIcon ? ICON_EMOJIS[piece.service_id] : null;

                    return (
                      <div
                        key={piece.id}
                        draggable={!isPlaced}
                        onDragStart={(e) => !isPlaced && onDragStart(e, piece)}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-md transition-all",
                          isPlaced
                            ? "bg-slate-800/30 opacity-50 cursor-not-allowed"
                            : "bg-slate-800/50 hover:bg-slate-700 cursor-grab active:cursor-grabbing hover:scale-[1.02]"
                        )}
                      >
                        {!isPlaced && (
                          <GripVertical className="w-3 h-3 text-slate-600 shrink-0" />
                        )}
                        <div
                          className={cn(
                            "w-7 h-7 rounded flex items-center justify-center shrink-0",
                            isPlaced ? "bg-slate-700/50" : "bg-slate-700"
                          )}
                          style={{ borderLeft: `3px solid ${catInfo.color}` }}
                        >
                          {emojiIcon ? (
                            <span className="text-base">{emojiIcon}</span>
                          ) : (
                            <ServiceIcon 
                              className={cn(
                                "w-4 h-4",
                                isPlaced ? "text-slate-500" : "text-cyan-400"
                              )}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-xs truncate",
                            isPlaced ? "text-slate-500 line-through" : "text-slate-200"
                          )}>
                            {piece.label}
                          </p>
                          {piece.hint && !isPlaced && (
                            <p className="text-[10px] text-slate-500 truncate">
                              {piece.hint}
                            </p>
                          )}
                        </div>
                        {piece.required && !isPlaced && (
                          <span className="text-[9px] text-amber-400 bg-amber-400/10 px-1 py-0.5 rounded shrink-0">
                            REQ
                          </span>
                        )}
                        {isPlaced && (
                          <span className="text-[9px] text-green-400">✓</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="p-2 border-t border-slate-800 bg-slate-900/80">
        <p className="text-[10px] text-slate-500 text-center">
          Drag pieces onto the canvas to build your architecture
        </p>
      </div>
    </div>
  );
}
