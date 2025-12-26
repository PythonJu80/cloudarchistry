"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bug,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Activity,
  Shield,
  DollarSign as CostIcon,
  Zap,
  Network,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

// Dynamically import DiagramMessage to avoid SSR issues with React Flow
const DiagramMessage = dynamic(
  () => import("@/components/chat/diagram-message").then((mod) => mod.DiagramMessage),
  { ssr: false, loading: () => <div className="h-[400px] bg-muted/50 rounded-xl animate-pulse" /> }
);

// Fun AWS tips and quotes for loading screen
const AWS_TIPS = [
  { tip: "S3 was the first AWS service launched in 2006", emoji: "📦" },
  { tip: "Lambda functions can run for up to 15 minutes", emoji: "⚡" },
  { tip: "AWS has 30+ regions worldwide", emoji: "🌍" },
  { tip: "DynamoDB can handle 10 trillion requests per day", emoji: "🚀" },
  { tip: "CloudFront has 400+ edge locations globally", emoji: "🌐" },
  { tip: "EC2 stands for Elastic Compute Cloud", emoji: "☁️" },
  { tip: "RDS supports 6 database engines", emoji: "🗄️" },
  { tip: "IAM policies follow least privilege principle", emoji: "🔐" },
  { tip: "VPC peering doesn't support transitive routing", emoji: "🔗" },
  { tip: "S3 offers 11 9's of durability (99.999999999%)", emoji: "💪" },
  { tip: "Aurora is 5x faster than standard MySQL", emoji: "⚡" },
  { tip: "EBS snapshots are stored in S3", emoji: "📸" },
  { tip: "Route 53 is named after DNS port 53", emoji: "🛣️" },
  { tip: "SNS can send 100k push notifications per second", emoji: "📱" },
  { tip: "SQS was launched before EC2!", emoji: "📬" },
  { tip: "Glacier retrieval can take 1-5 minutes with Expedited", emoji: "🧊" },
  { tip: "AWS Lambda was inspired by microservices", emoji: "🔬" },
  { tip: "CloudWatch can monitor on-prem servers too", emoji: "👁️" },
  { tip: "Security Groups are stateful, NACLs are stateless", emoji: "🛡️" },
  { tip: "You're becoming an AWS expert!", emoji: "🎓" },
  { tip: "Bug hunting sharpens your architecture skills", emoji: "🐛" },
  { tip: "Every bug you find makes you a better engineer", emoji: "💡" },
];

interface CloudWatchLog {
  timestamp: string;
  log_group: string;
  log_stream: string;
  message: string;
  level: string;
}

interface CloudWatchMetric {
  value: number;
  unit: string;
  alarm: boolean;
  threshold?: number;
}

interface ConfigRule {
  rule: string;
  status: string;
  resource?: string;
}

interface XRaySegment {
  name: string;
  duration: number;
  error: boolean;
  cause?: string;
}

interface XRayTrace {
  id: string;
  duration: number;
  segments: XRaySegment[];
}

interface CostItem {
  service: string;
  cost: number;
  trend: string;
}

interface AWSEnvironment {
  cloudwatch_logs: CloudWatchLog[];
  cloudwatch_metrics: Record<string, CloudWatchMetric>;
  vpc_flow_logs: string[];
  iam_policies: Record<string, Record<string, unknown>>;
  cost_data: {
    daily_cost: number;
    monthly_projection?: number;
    top_services: CostItem[];
  };
  xray_traces: XRayTrace[];
  config_compliance: ConfigRule[];
}

interface DiagramNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data: Record<string, unknown>;
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
}

interface Challenge {
  challenge_id: string;
  diagram: {
    nodes: DiagramNode[];
    edges: DiagramEdge[];
  };
  description: string;
  aws_environment: AWSEnvironment;
  difficulty: string;
  bounty_value: number;
  time_limit: number;
  bug_count: number;
}

interface BugClaim {
  targetId: string;
  bugType: string;
  severity: string;
  claim: string;
  evidence: string[];
  confidence: number;
}

interface ValidationResult {
  correct: boolean;
  points: number;
  bug_id?: string;
  explanation?: string;
  fix_suggestion?: string;
  pushback?: string;
  hint?: string;
}

type TabType = "logs" | "metrics" | "vpc" | "iam" | "cost" | "xray" | "config";

export default function BugBountyPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [score, setScore] = useState(0);
  const [bugsFound, setBugsFound] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>("logs");
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimForm, setClaimForm] = useState<BugClaim>({
    targetId: "",
    bugType: "security",
    severity: "medium",
    claim: "",
    evidence: [],
    confidence: 50,
  });
  const [validationHistory, setValidationHistory] = useState<ValidationResult[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [foundBugIds, setFoundBugIds] = useState<Set<string>>(new Set());
  const [claimFeedback, setClaimFeedback] = useState<ValidationResult | null>(null);
  const [diagramFullscreen, setDiagramFullscreen] = useState(false);
  const [revealedBugs, setRevealedBugs] = useState<Array<{
    id: string;
    type: string;
    severity: string;
    location: string;
    description: string;
    fix_suggestion: string;
  }> | null>(null);

  const fetchChallenge = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/gaming/bug-bounty/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to generate challenge",
          variant: "destructive",
        });
        return;
      }

      const data = await response.json();
      setChallenge(data.challenge);
      setTimeRemaining(data.challenge.time_limit);
      setScore(0);
      setBugsFound(0);
      setValidationHistory([]);
      setGameOver(false);
      setRevealedBugs(null);
      setFoundBugIds(new Set());
    } catch (error) {
      console.error("Failed to fetch challenge:", error);
      toast({
        title: "Error",
        description: "Failed to load challenge",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);

  useEffect(() => {
    if (!challenge || gameOver || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [challenge, gameOver, timeRemaining]);

  // ESC key to exit fullscreen diagram
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && diagramFullscreen) {
        setDiagramFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [diagramFullscreen]);

  const handleSubmitClaim = async () => {
    if (!challenge || !claimForm.targetId || !claimForm.claim) {
      toast({
        title: "Incomplete Claim",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Prevent double-submission
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/gaming/bug-bounty/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challenge_id,
          targetId: claimForm.targetId,
          bugType: claimForm.bugType,
          severity: claimForm.severity,
          claim: claimForm.claim,
          evidence: claimForm.evidence,
          confidence: claimForm.confidence,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to validate claim");
      }

      const data = await response.json();
      const result = data.validation;

      if (!result) {
        throw new Error("Invalid response from server");
      }

      // Check if this bug was already found (prevent duplicate scoring)
      if (result.correct && result.bug_id && foundBugIds.has(result.bug_id)) {
        setClaimFeedback({
          correct: false,
          points: 0,
          pushback: "You've already identified this bug! Look for other issues in the architecture.",
        });
        return;
      }

      // Store result for history (game over report)
      setValidationHistory((prev) => [...prev, result]);

      if (result.correct) {
        // Track found bug to prevent duplicates
        if (result.bug_id) {
          setFoundBugIds((prev) => new Set(prev).add(result.bug_id));
        }
        setScore((prev) => prev + result.points);
        setBugsFound((prev) => prev + 1);
      } else {
        setScore((prev) => Math.max(0, prev + result.points));
      }

      // Show feedback in modal instead of toast
      setClaimFeedback(result);

    } catch (error) {
      console.error("Failed to validate claim:", error);
      setClaimFeedback({
        correct: false,
        points: 0,
        pushback: error instanceof Error ? error.message : "Failed to validate claim. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseClaimModal = () => {
    setShowClaimModal(false);
    setClaimFeedback(null);
    setClaimForm({
      targetId: "",
      bugType: "security",
      severity: "medium",
      claim: "",
      evidence: [],
      confidence: 50,
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const [loadingTipIndex, setLoadingTipIndex] = useState(0);

  // Rotate tips every 5 seconds during loading
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setLoadingTipIndex((prev) => (prev + 1) % AWS_TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isLoading]);

  if (isLoading || !challenge) {
    const currentTip = AWS_TIPS[loadingTipIndex];
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center overflow-hidden relative">
        {/* Floating background icons */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[10%] left-[15%] text-4xl opacity-20 animate-pulse">☁️</div>
          <div className="absolute top-[20%] right-[20%] text-3xl opacity-15 animate-bounce" style={{ animationDuration: '3s' }}>🔐</div>
          <div className="absolute bottom-[30%] left-[10%] text-5xl opacity-10 animate-pulse" style={{ animationDelay: '1s' }}>📦</div>
          <div className="absolute bottom-[15%] right-[15%] text-4xl opacity-20 animate-bounce" style={{ animationDuration: '4s' }}>⚡</div>
          <div className="absolute top-[40%] left-[5%] text-3xl opacity-15 animate-pulse" style={{ animationDelay: '0.5s' }}>🛡️</div>
          <div className="absolute top-[60%] right-[8%] text-4xl opacity-10 animate-bounce" style={{ animationDuration: '2.5s' }}>🚀</div>
        </div>
        
        {/* Main content */}
        <div className="text-center max-w-lg px-6 z-10">
          <div className="relative mb-8">
            <Loader2 className="w-16 h-16 text-purple-400 animate-spin mx-auto" />
          </div>
          <p className="text-white font-medium text-lg mb-8">Generating Bug Bounty Challenge...</p>
          
          {/* Animated tip */}
          <div 
            key={loadingTipIndex}
            className="animate-in fade-in zoom-in duration-500"
          >
            <p className="text-5xl mb-4">{currentTip.emoji}</p>
            <p className="text-purple-300 text-lg font-medium">{currentTip.tip}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/game">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Bug className="w-6 h-6 text-purple-400" />
                <h1 className="text-xl font-bold">Bug Bounty</h1>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <span className={cn(
                  "font-mono text-lg",
                  timeRemaining < 60 && "text-red-400 animate-pulse"
                )}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                <span className="font-bold text-lg">{score}</span>
              </div>
              <div className="flex items-center gap-2">
                <Bug className="w-5 h-5 text-purple-400" />
                <span className="font-bold">{bugsFound}/{challenge.bug_count}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Use Case Description - On top */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-white/10 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold">Use Case</h2>
          </div>
          <div className="text-white/80 whitespace-pre-line text-sm leading-relaxed max-h-[250px] overflow-y-auto">
            {challenge.description}
          </div>
        </div>

        {/* Architecture Diagram - Below use case */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-white/10 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold">Architecture</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDiagramFullscreen(true)}
                title="Fullscreen (ESC to exit)"
              >
                <Maximize2 className="w-4 h-4 mr-2" />
                Fullscreen
              </Button>
              <Button
                size="sm"
                variant="default"
                className="bg-gradient-to-r from-purple-600 to-pink-600"
                onClick={() => {
                  setShowClaimModal(true);
                  setClaimForm((prev) => ({ ...prev, targetId: "architecture" }));
                }}
              >
                <Bug className="w-4 h-4 mr-2" />
                Flag Bug
              </Button>
            </div>
          </div>
          <div className="h-[500px] bg-gray-950 rounded-lg border border-white/5 overflow-hidden">
            <DiagramMessage 
              diagram={challenge.diagram}
            />
          </div>
        </div>

        {/* AWS Environment Tabs */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-white/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-bold">AWS Environment</h2>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {[
              { id: "logs" as TabType, label: "CloudWatch Logs", icon: FileText },
              { id: "metrics" as TabType, label: "Metrics", icon: Activity },
              { id: "vpc" as TabType, label: "VPC Flow", icon: Network },
              { id: "iam" as TabType, label: "IAM", icon: Shield },
              { id: "cost" as TabType, label: "Cost", icon: CostIcon },
              { id: "xray" as TabType, label: "X-Ray", icon: Zap },
              { id: "config" as TabType, label: "Config", icon: CheckCircle },
            ].map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2"
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-gray-950 rounded-lg p-4 h-[400px] overflow-y-auto font-mono text-sm">
            {activeTab === "logs" && (
              <div className="space-y-2">
                {challenge.aws_environment.cloudwatch_logs.map((log, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-2 rounded border-l-4",
                      log.level === "ERROR" && "bg-red-950/30 border-red-500",
                      log.level === "WARN" && "bg-yellow-950/30 border-yellow-500",
                      log.level === "INFO" && "bg-blue-950/30 border-blue-500"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white/40 text-xs">{log.timestamp}</span>
                      <span className={cn(
                        "text-xs font-bold",
                        log.level === "ERROR" && "text-red-400",
                        log.level === "WARN" && "text-yellow-400",
                        log.level === "INFO" && "text-blue-400"
                      )}>
                        {log.level}
                      </span>
                    </div>
                    <div className="text-white/60 text-xs mb-1">{log.log_group}</div>
                    <div className="text-white/90">{log.message}</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "metrics" && (
              <div className="space-y-3">
                {Object.entries(challenge.aws_environment.cloudwatch_metrics).map(([key, metric]) => (
                  <div
                    key={key}
                    className={cn(
                      "p-3 rounded border",
                      metric.alarm ? "bg-red-950/30 border-red-500" : "bg-gray-800/50 border-white/10"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white">{key}</span>
                      {metric.alarm && (
                        <span className="text-red-400 text-xs font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          ALARM
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-white">{metric.value}</span>
                      <span className="text-white/60">{metric.unit}</span>
                      {metric.threshold && (
                        <span className="text-white/40 text-sm">
                          Threshold: {metric.threshold}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "vpc" && (
              <div className="space-y-1">
                {challenge.aws_environment.vpc_flow_logs.map((log, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-2 rounded text-xs",
                      log.includes("REJECT") ? "bg-red-950/30 text-red-300" : "bg-gray-800/50 text-white/60"
                    )}
                  >
                    {log}
                  </div>
                ))}
              </div>
            )}

            {activeTab === "iam" && (
              <div className="space-y-4">
                {Object.entries(challenge.aws_environment.iam_policies).map(([key, policy]) => (
                  <div key={key} className="bg-gray-800/50 p-3 rounded border border-white/10">
                    <div className="font-bold text-white mb-2">{key}</div>
                    <pre className="text-xs text-white/70 overflow-x-auto">
                      {JSON.stringify(policy, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "cost" && (
              <div className="space-y-4">
                <div className="bg-gray-800/50 p-4 rounded border border-white/10">
                  <div className="text-white/60 text-sm mb-1">Daily Cost</div>
                  <div className="text-3xl font-bold text-green-400">
                    ${challenge.aws_environment.cost_data.daily_cost.toFixed(2)}
                  </div>
                  {challenge.aws_environment.cost_data.monthly_projection && (
                    <div className="text-white/40 text-sm mt-1">
                      Monthly: ${challenge.aws_environment.cost_data.monthly_projection.toFixed(2)}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {challenge.aws_environment.cost_data.top_services.map((item, i) => (
                    <div key={i} className="bg-gray-800/50 p-3 rounded flex items-center justify-between">
                      <span className="text-white">{item.service}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white">${item.cost.toFixed(2)}</span>
                        {item.trend && (
                          <span className={cn(
                            "text-sm",
                            item.trend.startsWith("+") ? "text-red-400" : "text-green-400"
                          )}>
                            {item.trend}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "xray" && (
              <div className="space-y-4">
                {challenge.aws_environment.xray_traces.map((trace, i) => (
                  <div key={i} className="bg-gray-800/50 p-3 rounded border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white/60 text-sm">Trace ID: {trace.id}</span>
                      <span className="text-white font-bold">{trace.duration.toFixed(2)}s</span>
                    </div>
                    <div className="space-y-2">
                      {trace.segments.map((segment, j) => (
                        <div
                          key={j}
                          className={cn(
                            "p-2 rounded flex items-center justify-between",
                            segment.error ? "bg-red-950/30 border border-red-500" : "bg-gray-900/50"
                          )}
                        >
                          <span className="text-white">{segment.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-white/60 text-sm">{segment.duration.toFixed(2)}s</span>
                            {segment.error && (
                              <span className="text-red-400 text-xs">{segment.cause}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "config" && (
              <div className="space-y-2">
                {challenge.aws_environment.config_compliance.map((rule, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-3 rounded border flex items-center justify-between",
                      rule.status === "NON_COMPLIANT"
                        ? "bg-red-950/30 border-red-500"
                        : "bg-green-950/30 border-green-500"
                    )}
                  >
                    <div>
                      <div className="text-white font-medium">{rule.rule}</div>
                      {rule.resource && (
                        <div className="text-white/40 text-sm">{rule.resource}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {rule.status === "COMPLIANT" ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                      <span className={cn(
                        "text-sm font-bold",
                        rule.status === "COMPLIANT" ? "text-green-400" : "text-red-400"
                      )}>
                        {rule.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Claim Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-white/20 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">
                {claimFeedback ? "Claim Feedback" : "Submit Bug Claim"}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseClaimModal}
                disabled={isSubmitting}
              >
                <XCircle className="w-5 h-5" />
              </Button>
            </div>

            {/* Show feedback after submission */}
            {claimFeedback ? (
              <div className="space-y-4">
                {/* Feedback Header */}
                <div className={cn(
                  "p-4 rounded-lg border-2",
                  claimFeedback.correct
                    ? "bg-green-950/40 border-green-500"
                    : "bg-amber-950/40 border-amber-500"
                )}>
                  <div className="flex items-center gap-3 mb-3">
                    {claimFeedback.correct ? (
                      <CheckCircle className="w-8 h-8 text-green-400" />
                    ) : (
                      <AlertTriangle className="w-8 h-8 text-amber-400" />
                    )}
                    <div>
                      <h4 className="text-lg font-bold">
                        {claimFeedback.correct ? "Bug Confirmed!" : "Not Quite..."}
                      </h4>
                      <span className={cn(
                        "text-sm font-medium",
                        claimFeedback.points > 0 ? "text-green-400" : 
                        claimFeedback.points < 0 ? "text-red-400" : "text-gray-400"
                      )}>
                        {claimFeedback.points > 0 ? "+" : ""}{claimFeedback.points} points
                      </span>
                    </div>
                  </div>

                  {/* AI Feedback Message */}
                  <div className="text-white/90 leading-relaxed">
                    {claimFeedback.correct ? (
                      <p>{claimFeedback.explanation}</p>
                    ) : (
                      <p>{claimFeedback.pushback}</p>
                    )}
                  </div>
                </div>

                {/* Hint for incorrect claims - guides thinking without giving answer */}
                {!claimFeedback.correct && claimFeedback.hint && (
                  <div className="bg-blue-950/30 border border-blue-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-400 text-lg">💡</span>
                      <div>
                        <p className="text-blue-300 font-medium text-sm mb-1">Hint</p>
                        <p className="text-blue-200/80 text-sm">{claimFeedback.hint}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Continue button */}
                <div className="pt-4">
                  <Button
                    onClick={handleCloseClaimModal}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                  >
                    Continue Hunting
                  </Button>
                </div>
              </div>
            ) : (
              /* Claim Form - shown before submission */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Target</label>
                  <input
                    type="text"
                    value={claimForm.targetId}
                    onChange={(e) => setClaimForm({ ...claimForm, targetId: e.target.value })}
                    className="w-full bg-gray-800 border border-white/20 rounded px-3 py-2 text-white"
                    placeholder="node_id or description or log reference"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Bug Type</label>
                    <select
                      value={claimForm.bugType}
                      onChange={(e) => setClaimForm({ ...claimForm, bugType: e.target.value })}
                      className="w-full bg-gray-800 border border-white/20 rounded px-3 py-2 text-white"
                      disabled={isSubmitting}
                    >
                      <option value="security">Security</option>
                      <option value="reliability">Reliability</option>
                      <option value="performance">Performance</option>
                      <option value="cost">Cost</option>
                      <option value="compliance">Compliance</option>
                      <option value="mismatch">Mismatch</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Severity</label>
                    <select
                      value={claimForm.severity}
                      onChange={(e) => setClaimForm({ ...claimForm, severity: e.target.value })}
                      className="w-full bg-gray-800 border border-white/20 rounded px-3 py-2 text-white"
                      disabled={isSubmitting}
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Claim Description</label>
                  <textarea
                    value={claimForm.claim}
                    onChange={(e) => setClaimForm({ ...claimForm, claim: e.target.value })}
                    className="w-full bg-gray-800 border border-white/20 rounded px-3 py-2 text-white h-24"
                    placeholder="Describe the bug you found..."
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Confidence: {claimForm.confidence}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={claimForm.confidence}
                    onChange={(e) => setClaimForm({ ...claimForm, confidence: parseInt(e.target.value) })}
                    className="w-full"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleSubmitClaim}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      "Submit Claim"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCloseClaimModal}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Diagram Modal */}
      {diagramFullscreen && challenge && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gray-900/80 border-b border-white/10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-bold">Architecture Diagram</h2>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-white/60">
                  <Clock className="w-4 h-4" />
                  <span className={timeRemaining < 60 ? "text-red-400 font-bold" : ""}>
                    {formatTime(timeRemaining)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-white/60">
                  <Bug className="w-4 h-4" />
                  <span>{bugsFound}/{challenge.bug_count}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowClaimModal(true);
                  setClaimForm((prev) => ({ ...prev, targetId: "architecture" }));
                }}
              >
                <Bug className="w-4 h-4 mr-2" />
                Flag Bug
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDiagramFullscreen(false)}
                title="Exit fullscreen (ESC)"
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Diagram - takes remaining space */}
          <div className="flex-1 overflow-hidden">
            <DiagramMessage 
              diagram={challenge.diagram}
            />
          </div>
          
          {/* Footer hint */}
          <div className="p-2 bg-gray-900/80 border-t border-white/10 text-center">
            <span className="text-gray-500 text-xs">Press ESC to exit fullscreen</span>
          </div>
        </div>
      )}

      {/* Game Over Screen - Combined stats and revealed bugs */}
      {gameOver && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-lg border border-white/20 p-6 max-w-2xl w-full my-8">
            {/* Header with score */}
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold mb-2">
                {bugsFound === challenge?.bug_count ? "🎉 All Bugs Found!" : "Time's Up!"}
              </h2>
              <div className="text-5xl font-bold text-purple-400 mb-1">{score}</div>
              <div className="text-white/60 text-sm">Final Score</div>
            </div>
            
            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span>Bugs Found</span>
                <span className={bugsFound === challenge?.bug_count ? "text-green-400" : "text-yellow-400"}>
                  {bugsFound}/{challenge?.bug_count}
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all ${bugsFound === challenge?.bug_count ? "bg-green-500" : "bg-purple-500"}`}
                  style={{ width: `${challenge?.bug_count ? (bugsFound / challenge.bug_count) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Your Claims Report */}
            {validationHistory.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-blue-400" />
                  Your Claims ({validationHistory.length})
                </h3>
                <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2">
                  {validationHistory.map((result, i) => (
                    <div
                      key={i}
                      className={cn(
                        "p-3 rounded-lg border",
                        result.correct
                          ? "bg-green-950/30 border-green-500/30"
                          : "bg-red-950/30 border-red-500/30"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {result.correct ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                          <span className="font-medium text-sm text-white">
                            {result.correct ? "Bug Found" : "Incorrect"}
                          </span>
                        </div>
                        <span className={cn(
                          "text-sm font-bold",
                          result.points > 0 ? "text-green-400" : "text-red-400"
                        )}>
                          {result.points > 0 ? "+" : ""}{result.points} pts
                        </span>
                      </div>
                      <p className="text-white/70 text-xs">
                        {result.explanation || result.pushback}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Revealed bugs section - collapsible */}
            {revealedBugs ? (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Bug className="w-5 h-5 text-purple-400" />
                    All Hidden Bugs ({revealedBugs.length})
                  </h3>
                  <button
                    onClick={() => setRevealedBugs(null)}
                    className="text-gray-400 hover:text-white text-sm"
                  >
                    Hide
                  </button>
                </div>
                <p className="text-gray-400 text-xs mb-4">
                  Study these to improve your bug hunting skills!
                </p>
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                  {revealedBugs.map((bug, index) => (
                    <div 
                      key={bug.id} 
                      className={`p-3 rounded-lg border ${
                        bug.severity === "critical" ? "bg-red-500/10 border-red-500/30" :
                        bug.severity === "high" ? "bg-orange-500/10 border-orange-500/30" :
                        bug.severity === "medium" ? "bg-yellow-500/10 border-yellow-500/30" :
                        "bg-blue-500/10 border-blue-500/30"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-white/60 text-xs">#{index + 1}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            bug.severity === "critical" ? "bg-red-500/20 text-red-400" :
                            bug.severity === "high" ? "bg-orange-500/20 text-orange-400" :
                            bug.severity === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-blue-500/20 text-blue-400"
                          }`}>
                            {bug.severity.toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
                            {bug.type}
                          </span>
                        </div>
                        <span className="text-gray-500 text-xs">@ {bug.location}</span>
                      </div>
                      <p className="text-white text-sm font-medium mb-2">{bug.description}</p>
                      <div className="bg-black/30 rounded p-2">
                        <p className="text-green-400 text-xs font-medium mb-1">Fix:</p>
                        <p className="text-gray-300 text-xs">{bug.fix_suggestion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Show hint and reveal button when bugs not yet revealed */
              bugsFound < (challenge?.bug_count || 0) && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                  <p className="text-yellow-400 font-semibold text-sm mb-1">
                    {(challenge?.bug_count || 0) - bugsFound} bugs remaining
                  </p>
                  <p className="text-gray-400 text-xs mb-3">
                    Try again to find them all, or reveal the answers to learn what you missed.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/gaming/bug-bounty/reveal?challengeId=${challenge?.challenge_id}`);
                        const data = await res.json();
                        if (data.bugs) {
                          setRevealedBugs(data.bugs);
                        }
                      } catch (e) {
                        console.error("Failed to reveal bugs:", e);
                        toast({
                          title: "Error",
                          description: "Failed to reveal bugs",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10"
                  >
                    Reveal All Bugs
                  </Button>
                </div>
              )
            )}
            
            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              {bugsFound < (challenge?.bug_count || 0) && !revealedBugs && (
                <Button 
                  onClick={() => {
                    setGameOver(false);
                    setTimeRemaining(challenge?.time_limit || 600);
                  }} 
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  Try Again (Resume)
                </Button>
              )}
              <Button 
                onClick={() => {
                  setRevealedBugs(null);
                  fetchChallenge();
                }} 
                variant={bugsFound === challenge?.bug_count || revealedBugs ? "default" : "outline"}
                className="w-full"
              >
                New Scenario
              </Button>
              <Link href="/game" className="w-full">
                <Button variant="ghost" className="w-full text-gray-400">
                  Exit to Hub
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
