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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ReactFlow, Background, BackgroundVariant, Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";

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

interface Challenge {
  challenge_id: string;
  diagram: {
    nodes: Node[];
    edges: Edge[];
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
  const [, setSelectedNode] = useState<string | null>(null);
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

  const fetchChallenge = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/gaming/bug-bounty/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: "intermediate" }),
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

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
    setClaimForm((prev) => ({ ...prev, targetId: node.id }));
  }, []);

  const handleSubmitClaim = async () => {
    if (!challenge || !claimForm.targetId || !claimForm.claim) {
      toast({
        title: "Incomplete Claim",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

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

      const data = await response.json();
      const result = data.validation;

      setValidationHistory((prev) => [...prev, result]);

      if (result.correct) {
        setScore((prev) => prev + result.points);
        setBugsFound((prev) => prev + 1);
        toast({
          title: "Bug Found! 🎉",
          description: `+${result.points} points! ${result.explanation}`,
        });
      } else {
        setScore((prev) => Math.max(0, prev + result.points));
        toast({
          title: "Incorrect",
          description: result.pushback || "That's not a bug",
          variant: "destructive",
        });
      }

      setShowClaimModal(false);
      setClaimForm({
        targetId: "",
        bugType: "security",
        severity: "medium",
        claim: "",
        evidence: [],
        confidence: 50,
      });
    } catch (error) {
      console.error("Failed to validate claim:", error);
      toast({
        title: "Error",
        description: "Failed to validate claim",
        variant: "destructive",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading || !challenge) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-white/60">Generating Bug Bounty Challenge...</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Use Case Description */}
          <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-white/10 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold">Use Case</h2>
            </div>
            <div className="text-white/80 whitespace-pre-line text-sm leading-relaxed">
              {challenge.description}
            </div>
          </div>

          {/* Architecture Diagram */}
          <div className="bg-black/40 backdrop-blur-sm rounded-lg border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-bold">Architecture</h2>
              </div>
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
            </div>
            <div className="h-[400px] bg-gray-950 rounded-lg border border-white/5">
              <ReactFlow
                nodes={challenge.diagram.nodes}
                edges={challenge.diagram.edges}
                onNodeClick={handleNodeClick}
                fitView
              >
                <Background variant={BackgroundVariant.Dots} />
              </ReactFlow>
            </div>
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
                        <span className={cn(
                          "text-sm",
                          item.trend.startsWith("+") ? "text-red-400" : "text-green-400"
                        )}>
                          {item.trend}
                        </span>
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

        {/* Validation History */}
        {validationHistory.length > 0 && (
          <div className="mt-6 bg-black/40 backdrop-blur-sm rounded-lg border border-white/10 p-6">
            <h3 className="text-lg font-bold mb-4">Claim History</h3>
            <div className="space-y-2">
              {validationHistory.map((result, i) => (
                <div
                  key={i}
                  className={cn(
                    "p-3 rounded border flex items-start gap-3",
                    result.correct
                      ? "bg-green-950/30 border-green-500"
                      : "bg-red-950/30 border-red-500"
                  )}
                >
                  {result.correct ? (
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white">
                        {result.correct ? "Bug Found!" : "Incorrect"}
                      </span>
                      <span className={cn(
                        "font-bold",
                        result.points > 0 ? "text-green-400" : "text-red-400"
                      )}>
                        {result.points > 0 ? "+" : ""}{result.points} pts
                      </span>
                    </div>
                    <div className="text-white/80 text-sm">
                      {result.explanation || result.pushback}
                    </div>
                    {result.fix_suggestion && (
                      <div className="text-blue-400 text-sm mt-1">
                        💡 {result.fix_suggestion}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Claim Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-white/20 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Submit Bug Claim</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClaimModal(false)}
              >
                <XCircle className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Target</label>
                <input
                  type="text"
                  value={claimForm.targetId}
                  onChange={(e) => setClaimForm({ ...claimForm, targetId: e.target.value })}
                  className="w-full bg-gray-800 border border-white/20 rounded px-3 py-2 text-white"
                  placeholder="node_id or description or log reference"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Bug Type</label>
                  <select
                    value={claimForm.bugType}
                    onChange={(e) => setClaimForm({ ...claimForm, bugType: e.target.value })}
                    className="w-full bg-gray-800 border border-white/20 rounded px-3 py-2 text-white"
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
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSubmitClaim}
                  className="flex-1"
                >
                  Submit Claim
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowClaimModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameOver && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-white/20 p-8 max-w-md w-full text-center">
            <h2 className="text-3xl font-bold mb-4">Time&apos;s Up!</h2>
            <div className="text-6xl font-bold text-purple-400 mb-2">{score}</div>
            <div className="text-white/60 mb-6">Final Score</div>
            <div className="text-lg mb-6">
              Bugs Found: {bugsFound}/{challenge.bug_count}
            </div>
            <div className="flex gap-3">
              <Button onClick={fetchChallenge} className="flex-1">
                New Challenge
              </Button>
              <Link href="/game" className="flex-1">
                <Button variant="outline" className="w-full">
                  Exit
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
