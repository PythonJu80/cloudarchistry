"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ExternalLink,
  BookOpen,
  FileText,
  Layers,
  MessageSquare,
  Building2,
  Target,
  Clock,
  Zap,
  Play,
  Check,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChallengeWorkspaceModal } from "./challenge-workspace-modal";

interface LogEntry {
  type: "status" | "search" | "source" | "research" | "knowledge" | "complete" | "error";
  message?: string;
  similarity?: number;
  step?: number;
  total_steps?: number;
  url?: string;
  title?: string;
  company?: Record<string, unknown>;
  scenario?: Record<string, unknown>;
  company_info?: Record<string, unknown>;
  cert_code?: string;
  cert_name?: string;
  sources?: string[];
}

interface ScenarioGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  industry: string;
  certCode: string;
  certName: string;
  userLevel?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  apiKey?: string | null;
  preferredModel?: string | null;
  onQuiz?: (scenario: Record<string, unknown>, companyInfo: Record<string, unknown>) => void;
  onNotes?: (scenario: Record<string, unknown>, companyInfo: Record<string, unknown>) => void;
  onFlashcards?: (scenario: Record<string, unknown>, companyInfo: Record<string, unknown>) => void;
  onCoach?: (scenario: Record<string, unknown>, companyInfo: Record<string, unknown>) => void;
}

export function ScenarioGenerationModal({
  isOpen,
  onClose,
  businessName,
  industry,
  certCode,
  certName,
  userLevel = "intermediate",
  latitude,
  longitude,
  country,
  apiKey,
  preferredModel,
  onQuiz,
  onNotes,
  onFlashcards,
  onCoach,
}: ScenarioGenerationModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    scenario: Record<string, unknown>;
    companyInfo: Record<string, unknown>;
    certCode?: string;
    certName?: string;
  } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(5);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Challenge workspace state
  const [selectedChallengeIndex, setSelectedChallengeIndex] = useState<number | null>(null);
  const [showWorkspace, setShowWorkspace] = useState(false);
  
  // Accept challenge state
  const [isAccepting, setIsAccepting] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [acceptedData, setAcceptedData] = useState<{
    scenarioId: string;
    attemptId: string;
    challenges: Array<{ id: string; title: string; orderIndex: number; points: number }>;
  } | null>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (scrollRef.current) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [logs]);

  // Start generation when modal opens
  useEffect(() => {
    if (isOpen && !isGenerating && !isComplete) {
      startGeneration();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setLogs([]);
      setIsGenerating(false);
      setIsComplete(false);
      setError(null);
      setResult(null);
      setCurrentStep(0);
      setIsAccepting(false);
      setIsAccepted(false);
      setAcceptedData(null);
    }
  }, [isOpen]);

  // Accept challenge - save to database
  const acceptChallenge = async () => {
    if (!result || isAccepting || isAccepted) return;
    
    setIsAccepting(true);
    try {
      const response = await fetch("/api/scenario/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: result.scenario,
          companyInfo: result.companyInfo,
          certCode: certCode,
          userLevel: userLevel,
          latitude: latitude,
          longitude: longitude,
          country: country,
          industry: industry,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to accept challenge");
      }

      const data = await response.json();
      setAcceptedData(data);
      setIsAccepted(true);
    } catch (err) {
      console.error("Accept challenge error:", err);
      setError(err instanceof Error ? err.message : "Failed to accept challenge");
    } finally {
      setIsAccepting(false);
    }
  };

  const startGeneration = async () => {
    setIsGenerating(true);
    setError(null);
    setLogs([]);

    try {
      const response = await fetch('/api/scenario', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: businessName,
          industry: industry,
          cert_code: certCode,
          user_level: userLevel,
          latitude: latitude,
          longitude: longitude,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data: LogEntry = JSON.parse(line.slice(6));
              setLogs((prev) => [...prev, data]);

              if (data.step) setCurrentStep(data.step);
              if (data.total_steps) setTotalSteps(data.total_steps);

              if (data.type === "complete") {
                setIsComplete(true);
                setIsGenerating(false);
                setResult({
                  scenario: data.scenario as Record<string, unknown>,
                  companyInfo: data.company_info as Record<string, unknown>,
                  certCode: data.cert_code,
                  certName: data.cert_name,
                });
              }

              if (data.type === "error") {
                setError(data.message || "Unknown error");
                setIsGenerating(false);
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
      }
    } catch (err) {
      console.error("Generation failed:", err);
      setError(err instanceof Error ? err.message : "Failed to connect to learning agent");
      setIsGenerating(false);
    }
  };

  const progressPercent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isGenerating && <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />}
            {isComplete && <CheckCircle2 className="w-5 h-5 text-green-400" />}
            {error && <XCircle className="w-5 h-5 text-red-400" />}
            <span>
              {isGenerating && "Generating Challenge..."}
              {isComplete && "Challenge Ready!"}
              {error && "Generation Failed"}
              {!isGenerating && !isComplete && !error && "Starting..."}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        {isGenerating && (
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Logs View - shown during generation */}
        {!isComplete && (
          <div ref={scrollRef} className="flex-1 max-h-[400px] overflow-y-auto rounded-lg border border-border/50 bg-slate-900/50 p-4">
            <div className="space-y-2 font-mono text-sm">
              {logs.map((log, i) => (
                <div key={i} className={cn(
                  "flex items-start gap-2",
                  log.type === "error" && "text-red-400",
                  log.type === "status" && "text-cyan-400",
                  log.type === "search" && "text-yellow-400",
                  log.type === "source" && "text-green-400 pl-4",
                )}>
                  {log.type === "status" && <span>{log.message}</span>}
                  {log.type === "search" && <span>{log.message}</span>}
                  {log.type === "source" && (
                    <a 
                      href={log.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {log.title || log.url}
                    </a>
                  )}
                  {log.type === "knowledge" && (
                    <a 
                      href={log.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:underline text-purple-400"
                    >
                      <BookOpen className="w-3 h-3" />
                      AWS KB: {log.url?.split('/').pop()} ({log.similarity || 0} match)
                    </a>
                  )}
                  {log.type === "error" && <span>❌ {log.message}</span>}
                </div>
              ))}
              {isGenerating && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Processing...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results View - shown after completion */}
        {isComplete && result && (
          <div className="flex-1 space-y-4 overflow-y-auto">
            {/* Company Info */}
            <div className="rounded-lg border border-border/50 bg-slate-900/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Building2 className="w-5 h-5 text-cyan-400" />
                {result.companyInfo.name as string}
              </div>
              <p className="text-sm text-muted-foreground">
                {result.companyInfo.description as string}
              </p>
              <div className="flex flex-wrap gap-2">
                {(result.companyInfo.key_services as string[] || []).slice(0, 5).map((service, i) => (
                  <span key={i} className="px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs">
                    {service}
                  </span>
                ))}
              </div>
            </div>

            {/* Scenario Info */}
            <div className="rounded-lg border border-border/50 bg-slate-900/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Target className="w-5 h-5 text-amber-400" />
                {result.scenario.scenario_title as string}
              </div>
              <p className="text-sm text-muted-foreground">
                {result.scenario.scenario_description as string}
              </p>
              
              {/* Accept Challenge Button - Must accept before starting */}
              {!isAccepted && (
                <Button
                  onClick={acceptChallenge}
                  disabled={isAccepting}
                  className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium"
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Saving Challenge...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Accept Challenge
                    </>
                  )}
                </Button>
              )}

              {/* Challenges - Clickable only after accepting */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  Challenges
                  {isAccepted ? (
                    <span className="text-xs text-green-400">(click to start)</span>
                  ) : (
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Accept challenge first
                    </span>
                  )}
                </div>
                {(result.scenario.challenges as Array<{id: string; title: string; difficulty: string; points: number; description: string; hints: string[]; success_criteria: string[]; aws_services_relevant: string[]; estimated_time_minutes: number}> || []).map((challenge, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (!isAccepted) return;
                      setSelectedChallengeIndex(i);
                      setShowWorkspace(true);
                    }}
                    disabled={!isAccepted}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded border transition-all group",
                      isAccepted 
                        ? "bg-slate-800/50 hover:bg-slate-700/50 border-transparent hover:border-cyan-500/30 cursor-pointer"
                        : "bg-slate-800/30 border-slate-700/50 cursor-not-allowed opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                        isAccepted 
                          ? "bg-slate-700 group-hover:bg-cyan-500/20 group-hover:text-cyan-400"
                          : "bg-slate-800 text-slate-500"
                      )}>
                        {isAccepted ? i + 1 : <Lock className="w-3 h-3" />}
                      </div>
                      <div className="text-left">
                        <div className={cn(
                          "text-sm font-medium transition-colors",
                          isAccepted && "group-hover:text-cyan-400"
                        )}>{challenge.title}</div>
                        <div className="text-xs text-muted-foreground">{challenge.estimated_time_minutes || 15} min • +{challenge.points || 100} pts</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded",
                        challenge.difficulty === "beginner" && "bg-green-500/20 text-green-400",
                        challenge.difficulty === "intermediate" && "bg-yellow-500/20 text-yellow-400",
                        challenge.difficulty === "advanced" && "bg-orange-500/20 text-orange-400",
                        challenge.difficulty === "expert" && "bg-red-500/20 text-red-400",
                      )}>
                        {challenge.difficulty}
                      </span>
                      {isAccepted ? (
                        <Play className="w-4 h-4 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
                      ) : (
                        <Lock className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {result.scenario.estimated_total_time_minutes as number || 60} min
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="w-4 h-4" />
                  {result.scenario.difficulty as string}
                </div>
                {result.certName && (
                  <div className="flex items-center gap-1 text-cyan-400">
                    <Target className="w-4 h-4" />
                    {result.certName}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
            <p className="font-medium">Generation Failed</p>
            <p className="text-sm mt-1">{error}</p>
            <Button 
              variant="outline" 
              className="mt-3"
              onClick={() => {
                setError(null);
                startGeneration();
              }}
            >
              Try Again
            </Button>
          </div>
        )}
      </DialogContent>

      {/* Challenge Workspace Modal */}
      {result && selectedChallengeIndex !== null && isAccepted && acceptedData && (
        <ChallengeWorkspaceModal
          isOpen={showWorkspace}
          onClose={() => {
            setShowWorkspace(false);
            setSelectedChallengeIndex(null);
          }}
          challenge={{
            ...(result.scenario.challenges as Array<{
              id: string;
              title: string;
              description: string;
              difficulty: string;
              points: number;
              hints: string[];
              success_criteria: string[];
              aws_services_relevant: string[];
              estimated_time_minutes: number;
            }>)[selectedChallengeIndex],
            // Override with the saved challenge ID from database
            id: acceptedData.challenges[selectedChallengeIndex]?.id || "",
          }}
          scenario={{
            scenario_title: result.scenario.scenario_title as string,
            scenario_description: result.scenario.scenario_description as string,
            business_context: result.scenario.business_context as string,
            company_name: result.companyInfo.name as string,
          }}
          companyInfo={result.companyInfo}
          challengeIndex={selectedChallengeIndex}
          totalChallenges={(result.scenario.challenges as Array<unknown>)?.length || 0}
          onNextChallenge={() => {
            const challenges = result.scenario.challenges as Array<unknown>;
            if (selectedChallengeIndex < challenges.length - 1) {
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
          certCode={certCode}
          userLevel={userLevel}
          industry={industry}
          scenarioId={acceptedData.scenarioId}
          attemptId={acceptedData.attemptId}
        />
      )}
    </Dialog>
  );
}
