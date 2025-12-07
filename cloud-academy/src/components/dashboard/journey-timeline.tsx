"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  PlayCircle,
  Lock,
  Trophy,
  ChevronDown,
  MapPin,
  Plane,
  Star,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Dynamically import ChallengeWorkspaceModal to avoid SSR issues
const ChallengeWorkspaceModal = dynamic(
  () => import("@/components/world/challenge-workspace-modal").then(mod => mod.ChallengeWorkspaceModal),
  { ssr: false }
);

interface ChallengeData {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  points: number;
  orderIndex: number;
  estimatedMinutes: number;
  awsServices: string[];
  hints: string[];
  successCriteria: string[];
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  pointsEarned: number;
  hintsUsed: number;
  progressId: string | null;
}

interface Journey {
  id: string;
  scenarioId: string;
  status: string;
  startedAt: string;
  lastActivityAt: string;
  completedAt: string | null;
  pointsEarned: number;
  maxPoints: number;
  scenario: {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    companyInfo: Record<string, unknown>;
  };
  location: {
    id: string;
    name: string;
    company: string;
    icon: string;
    slug: string;
    lat: number;
    lng: number;
    country: string | null;
    industry: string;
    difficulty: string;
  };
  challenges: ChallengeData[];
  totalChallenges: number;
  challengesCompleted: number;
  progress: number;
}

interface JourneyTimelineProps {
  journeys: Journey[];
  apiKey?: string;
  preferredModel?: string;
  onRefresh?: () => void;
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Get country code for flag display
function getCountryCode(country: string | null): string {
  if (!country) return "un"; // UN flag as fallback
  // Map common country names to ISO codes
  const countryMap: Record<string, string> = {
    "Spain": "es", "ES": "es",
    "United States": "us", "USA": "us", "US": "us",
    "United Kingdom": "gb", "UK": "gb", "GB": "gb",
    "Germany": "de", "DE": "de",
    "France": "fr", "FR": "fr",
    "Japan": "jp", "JP": "jp",
    "Australia": "au", "AU": "au",
    "Singapore": "sg", "SG": "sg",
    "India": "in", "IN": "in",
    "Brazil": "br", "BR": "br",
    "Canada": "ca", "CA": "ca",
    "Netherlands": "nl", "NL": "nl",
    "Switzerland": "ch", "CH": "ch",
    "Ireland": "ie", "IE": "ie",
    "Sweden": "se", "SE": "se",
    "UAE": "ae", "AE": "ae",
    "China": "cn", "CN": "cn",
    "South Korea": "kr", "KR": "kr",
    "Mexico": "mx", "MX": "mx",
  };
  return countryMap[country] || country.toLowerCase().slice(0, 2);
}

// Visual journey path component - like a game map
function JourneyPath({ 
  journey, 
  onChallengeClick 
}: { 
  journey: Journey;
  onChallengeClick: (index: number) => void;
}) {
  const challenges = journey.challenges || [];
  const currentIndex = challenges.findIndex(
    (c: ChallengeData) => c.status === "in_progress" || c.status === "available"
  );
  const countryCode = getCountryCode(journey.location.country);
  
  return (
    <div className="relative py-6 overflow-x-auto">
      {/* Horizontal scrollable path */}
      <div className="flex items-center gap-0 min-w-max px-4">
        {/* Start marker with country flag */}
        <div className="flex flex-col items-center mr-3">
          <div className="relative">
            {/* Pulsing background */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 rounded-full bg-green-500"
            />
            {/* Flag container */}
            <div className="relative w-12 h-12 rounded-full bg-slate-800 border-2 border-green-500 flex items-center justify-center shadow-lg shadow-green-500/30 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={`https://flagcdn.com/w40/${countryCode}.png`}
                alt={journey.location.country || "Location"}
                className="w-7 h-5 object-cover rounded-sm"
                onError={(e) => {
                  // Fallback to icon if flag fails to load
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          </div>
          <span className="text-[10px] text-green-400 mt-1 font-medium">START</span>
        </div>

        {challenges.map((challenge: ChallengeData, index: number) => {
          const isCompleted = challenge.status === "completed";
          const isCurrent = challenge.status === "in_progress" || 
            (challenge.status === "available" && index === currentIndex);
          const isLocked = challenge.status === "locked";
          const isClickable = !isLocked;

          return (
            <div key={challenge.id} className="flex items-center">
              {/* Path segment */}
              <div className="relative w-12 h-1">
                {/* Background path */}
                <div className="absolute inset-0 bg-muted-foreground/20 rounded-full" />
                {/* Completed path overlay */}
                {isCompleted && (
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                  />
                )}
                {/* Animated dashes for current path */}
                {isCurrent && (
                  <motion.div
                    animate={{ x: [0, 12] }}
                    transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
                    className="absolute inset-0 overflow-hidden rounded-full"
                  >
                    <div className="w-24 h-full flex gap-1.5">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="w-1.5 h-full bg-amber-400 rounded-full" />
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Checkpoint marker */}
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => isClickable && onChallengeClick(index)}
                      disabled={!isClickable}
                      className={cn(
                        "relative focus:outline-none",
                        isClickable ? "cursor-pointer" : "cursor-not-allowed"
                      )}
                    >
                      <motion.div
                        whileHover={isClickable ? { scale: 1.1 } : {}}
                        whileTap={isClickable ? { scale: 0.95 } : {}}
                        className="relative"
                      >
                        {/* Pulsing ring for current */}
                        {isCurrent && (
                          <motion.div
                            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="absolute inset-0 rounded-full bg-amber-500"
                          />
                        )}
                        
                        {/* Checkpoint circle */}
                        <div className={cn(
                          "relative w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold text-sm",
                          isCompleted && "bg-green-500 border-green-400 text-white",
                          isCurrent && "bg-amber-500 border-amber-400 text-white",
                          isLocked && "bg-muted border-muted-foreground/30 text-muted-foreground"
                        )}>
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : isCurrent ? (
                            <span>{index + 1}</span>
                          ) : (
                            <Lock className="w-4 h-4" />
                          )}
                        </div>

                        {/* Points badge for completed */}
                        {isCompleted && challenge.pointsEarned > 0 && (
                          <div className="absolute -top-2 -right-2 flex items-center gap-0.5 bg-yellow-500 text-yellow-900 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            {challenge.pointsEarned}
                          </div>
                        )}
                      </motion.div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="bottom" 
                    className="max-w-xs p-3 bg-popover/95 backdrop-blur"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-sm leading-tight">
                          {challenge.title}
                        </h4>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px] shrink-0",
                            challenge.difficulty === "beginner" && "text-green-400 border-green-500/30",
                            challenge.difficulty === "intermediate" && "text-amber-400 border-amber-500/30",
                            challenge.difficulty === "advanced" && "text-orange-400 border-orange-500/30",
                            challenge.difficulty === "expert" && "text-red-400 border-red-500/30"
                          )}
                        >
                          {challenge.difficulty}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {challenge.description}
                      </p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          ⏱️ {challenge.estimatedMinutes}m
                        </span>
                        <span className="flex items-center gap-1 text-amber-400 font-medium">
                          <Trophy className="w-3 h-3" />
                          {challenge.points} pts
                        </span>
                      </div>
                      {challenge.awsServices?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {challenge.awsServices.slice(0, 3).map((svc: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {svc}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {isClickable && (
                        <button
                          onClick={() => onChallengeClick(index)}
                          className="pt-1 text-[10px] text-cyan-400 font-medium hover:text-cyan-300 hover:underline transition-colors cursor-pointer"
                        >
                          Click to {isCurrent ? "continue" : "view"} challenge →
                        </button>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        })}

        {/* Final path to finish */}
        <div className="relative w-12 h-1">
          <div className="absolute inset-0 bg-muted-foreground/20 rounded-full" />
          {journey.status === "completed" && (
            <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-yellow-400 rounded-full" />
          )}
        </div>

        {/* Finish marker */}
        <div className="flex flex-col items-center ml-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center border-2",
            journey.status === "completed" 
              ? "bg-yellow-500 border-yellow-400 text-white" 
              : "bg-muted border-muted-foreground/30 text-muted-foreground"
          )}>
            <Trophy className="w-5 h-5" />
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">FINISH</span>
        </div>
      </div>
    </div>
  );
}

function JourneyCard({ 
  journey,
  apiKey,
  preferredModel,
  onRefresh,
}: { 
  journey: Journey;
  apiKey?: string;
  preferredModel?: string;
  onRefresh?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedChallengeIndex, setSelectedChallengeIndex] = useState<number | null>(null);
  const hasTimeline = journey.challenges && journey.challenges.length > 0;
  
  // Find current challenge index
  const currentChallengeIndex = journey.challenges?.findIndex(
    (c: ChallengeData) => c.status === "in_progress" || c.status === "available"
  ) ?? 0;

  const handleChallengeClick = (index: number) => {
    setSelectedChallengeIndex(index);
  };

  const handleCloseModal = () => {
    setSelectedChallengeIndex(null);
    onRefresh?.();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl bg-gradient-to-br from-slate-900/80 to-slate-800/40 border border-border/50 overflow-hidden"
      >
        {/* Journey Header */}
        <div 
          className="p-4 cursor-pointer hover:bg-background/30 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ 
                  scale: journey.status === "in_progress" ? [1, 1.1, 1] : 1,
                }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-3xl"
              >
                {journey.location.icon}
              </motion.div>
              <div>
                <h4 className="font-bold text-base leading-tight">{journey.scenario.title}</h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {journey.location.company} • {journey.location.name}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs",
                  journey.status === "in_progress" 
                    ? "text-amber-400 border-amber-400/30 bg-amber-500/10" 
                    : "text-green-400 border-green-400/30 bg-green-500/10"
                )}
              >
                {journey.status === "in_progress" ? (
                  <><PlayCircle className="w-3 h-3 mr-1" /> In Progress</>
                ) : (
                  <><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</>
                )}
              </Badge>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              </motion.div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Flag className="w-3 h-3 text-amber-400" />
              {journey.challengesCompleted}/{journey.totalChallenges} checkpoints
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="w-3 h-3 text-yellow-400" />
              {journey.pointsEarned} pts
            </span>
            <span>Last active {formatTimeAgo(journey.lastActivityAt)}</span>
          </div>
        </div>

        {/* Journey Path Timeline */}
        <AnimatePresence>
          {isExpanded && hasTimeline && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden border-t border-border/30"
            >
              {/* Visual path */}
              <div className="bg-gradient-to-b from-slate-900/50 to-transparent">
                <JourneyPath 
                  journey={journey} 
                  onChallengeClick={handleChallengeClick}
                />
              </div>

              {/* Continue button */}
              {currentChallengeIndex >= 0 && journey.challenges[currentChallengeIndex] && (
                <div className="px-4 pb-4">
                  <Button 
                    onClick={() => handleChallengeClick(currentChallengeIndex)}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/25"
                  >
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Continue Journey
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Challenge Workspace Modal */}
      {selectedChallengeIndex !== null && journey.challenges[selectedChallengeIndex] && (
        <ChallengeWorkspaceModal
          isOpen={selectedChallengeIndex !== null}
          onClose={handleCloseModal}
          challenge={{
            id: journey.challenges[selectedChallengeIndex].id,
            title: journey.challenges[selectedChallengeIndex].title,
            description: journey.challenges[selectedChallengeIndex].description,
            difficulty: journey.challenges[selectedChallengeIndex].difficulty,
            points: journey.challenges[selectedChallengeIndex].points,
            hints: journey.challenges[selectedChallengeIndex].hints,
            success_criteria: journey.challenges[selectedChallengeIndex].successCriteria,
            aws_services_relevant: journey.challenges[selectedChallengeIndex].awsServices,
            estimated_time_minutes: journey.challenges[selectedChallengeIndex].estimatedMinutes,
          }}
          scenario={{
            scenario_title: journey.scenario.title,
            scenario_description: journey.scenario.description,
            business_context: journey.scenario.description,
            company_name: journey.location.company,
          }}
          companyInfo={journey.scenario.companyInfo}
          challengeIndex={selectedChallengeIndex}
          totalChallenges={journey.challenges.length}
          onNextChallenge={() => {
            if (selectedChallengeIndex < journey.challenges.length - 1) {
              setSelectedChallengeIndex(selectedChallengeIndex + 1);
            }
          }}
          onPrevChallenge={() => {
            if (selectedChallengeIndex > 0) {
              setSelectedChallengeIndex(selectedChallengeIndex - 1);
            }
          }}
          apiKey={apiKey}
          preferredModel={preferredModel}
          userLevel={journey.scenario.difficulty}
          industry={journey.location.industry}
          scenarioId={journey.scenarioId}
          attemptId={journey.id}
        />
      )}
    </>
  );
}

export function JourneyTimeline({ journeys, apiKey, preferredModel, onRefresh }: JourneyTimelineProps) {
  const activeJourneys = journeys.filter(j => j.status === "in_progress");
  
  if (activeJourneys.length === 0) {
    return (
      <div className="text-center py-12">
        <motion.div
          animate={{ 
            y: [0, -10, 0],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ repeat: Infinity, duration: 3 }}
        >
          <Plane className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        </motion.div>
        <h3 className="text-lg font-semibold mb-2">No Active Journeys</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Start exploring the world map to begin your cloud architecture journey!
        </p>
        <Link href="/world">
          <Button className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
            <MapPin className="w-4 h-4 mr-2" />
            Explore World Map
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeJourneys.slice(0, 3).map((journey) => (
        <JourneyCard 
          key={journey.id} 
          journey={journey}
          apiKey={apiKey}
          preferredModel={preferredModel}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}
