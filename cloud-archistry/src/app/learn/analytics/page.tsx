"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Target,
  Clock,
  Zap,
  BookOpen,
  MessageSquare,
  BarChart3,
  PieChart,
  Activity,
  Flame,
  Trophy,
  Brain,
  Layers,
  Sparkles,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Lightbulb,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

interface AnalyticsData {
  profile: {
    displayName: string | null;
    skillLevel: string;
    targetCertification: string | null;
    subscriptionTier: string;
    memberSince: string;
    lastActive: string | null;
  };
  gamification: {
    totalPoints: number;
    level: number;
    xp: number;
    currentStreak: number;
    longestStreak: number;
    achievementsCount: number;
  };
  challenges: {
    total: number;
    completed: number;
    completionRate: number;
    avgScore: number;
    totalHintsUsed: number;
    avgHintsPerChallenge: number;
    difficultyBreakdown: Record<string, { total: number; completed: number; avgScore: number }>;
  };
  scenarios: {
    total: number;
    completed: number;
    completionRate: number;
    recentAttempts: Array<{
      title: string;
      status: string;
      pointsEarned: number;
      maxPoints: number;
      difficulty: string;
      company: string;
      industry: string;
      startedAt: string;
      completedAt: string | null;
    }>;
  };
  skills: {
    topServices: Array<{ service: string; count: number }>;
    industryBreakdown: Array<{ industry: string; count: number }>;
  };
  learning: {
    totalChatSessions: number;
    totalQuestionsAsked: number;
    topKeywords: Array<{ keyword: string; count: number }>;
    recentChats: Array<{
      title: string;
      questionsAsked: number;
      lastMessageAt: string;
    }>;
  };
  time: {
    totalMinutes: number;
    avgTimePerScenario: number;
  };
  activityTimeline: Array<{
    date: string;
    attempts: number;
    completed: number;
    points: number;
  }>;
  recentActivities: Array<{
    type: string;
    data: unknown;
    createdAt: string;
  }>;
}

interface DiagnosticsData {
  summary: string;
  overall_readiness: number;
  readiness_label: string;
  strengths: Array<{
    area: string;
    confidence: string;
    evidence: string;
    aws_services: string[];
  }>;
  weaknesses: Array<{
    area: string;
    confidence: string;
    evidence: string;
    aws_services: string[];
  }>;
  domain_scores: Record<string, number>;
  patterns: Array<{
    pattern: string;
    insight: string;
    suggestion: string;
  }>;
  recommendations: Array<{
    priority: number;
    title: string;
    description: string;
    action_type: string;
    action_link: string;
    estimated_time: string;
    rationale: string;
  }>;
  encouragement: string;
  next_milestone: string;
  days_to_milestone?: number;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  
  // Diagnostics state
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  // Diagnostics history
  const [diagnosticsHistory, setDiagnosticsHistory] = useState<Array<{
    id: string;
    overallReadiness: number;
    readinessLabel: string;
    summary: string | null;
    createdAt: string;
  }>>([]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/learn/analytics");
      if (!res.ok) {
        throw new Error("Failed to fetch analytics");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load analytics", err);
      setError("Unable to load your analytics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    // Fetch diagnostics history
    fetch("/api/learn/analytics/diagnostics")
      .then((res) => res.json())
      .then((data) => {
        if (data.diagnostics) {
          setDiagnosticsHistory(data.diagnostics);
        }
      })
      .catch(() => {
        // Ignore errors - history is optional
      });
  }, [fetchAnalytics]);

  const generateDiagnostics = useCallback(async () => {
    setDiagnosticsLoading(true);
    setDiagnosticsError(null);
    setShowDiagnostics(true);
    try {
      const res = await fetch("/api/learn/analytics/diagnostics", {
        method: "POST",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate diagnostics");
      }
      const json = await res.json();
      if (json.success && json.diagnostics) {
        setDiagnostics(json.diagnostics);
      } else {
        throw new Error("Invalid diagnostics response");
      }
    } catch (err) {
      console.error("Failed to generate diagnostics", err);
      setDiagnosticsError(
        err instanceof Error ? err.message : "Unable to generate diagnostics. Please try again."
      );
    } finally {
      setDiagnosticsLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 blur-xl opacity-30 animate-pulse" />
            <Loader2 className="w-12 h-12 animate-spin text-emerald-400 mx-auto mb-4 relative" />
          </div>
          <p className="text-muted-foreground text-lg">Crunching your numbers...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <p className="text-muted-foreground text-lg">{error || "No data available"}</p>
          <Button onClick={fetchAnalytics} variant="outline" size="lg" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
        </motion.div>
      </div>
    );
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "in_progress":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  const maxServiceCount = Math.max(...data.skills.topServices.map((s) => s.count), 1);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-emerald-400" />
            Your Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Deep insights into your learning journey
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchAnalytics} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button
            onClick={generateDiagnostics}
            size="sm"
            className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white"
          >
            <Sparkles className="w-4 h-4" />
            AI Diagnostics
          </Button>
        </div>
      </motion.div>

      {/* Key Stats Grid */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={fadeInUp}>
          <Card className="border-white/10 bg-gradient-to-br from-emerald-950/50 to-slate-950/80">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm text-white/60">Total Points</p>
              </div>
              <p className="text-3xl font-bold text-white">{data.gamification.totalPoints.toLocaleString()}</p>
              <p className="text-sm text-white/40 mt-1">Level {data.gamification.level}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="border-white/10 bg-gradient-to-br from-amber-950/50 to-slate-950/80">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm text-white/60">Current Streak</p>
              </div>
              <p className="text-3xl font-bold text-white">{data.gamification.currentStreak} days</p>
              <p className="text-sm text-white/40 mt-1">Best: {data.gamification.longestStreak} days</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="border-white/10 bg-gradient-to-br from-cyan-950/50 to-slate-950/80">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm text-white/60">Avg Score</p>
              </div>
              <p className="text-3xl font-bold text-white">{data.challenges.avgScore}%</p>
              <p className="text-sm text-white/40 mt-1">{data.challenges.completed} challenges</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="border-white/10 bg-gradient-to-br from-violet-950/50 to-slate-950/80">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm text-white/60">Time Invested</p>
              </div>
              <p className="text-3xl font-bold text-white">{formatTime(data.time.totalMinutes)}</p>
              <p className="text-sm text-white/40 mt-1">~{formatTime(data.time.avgTimePerScenario)}/scenario</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Challenge Performance */}
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card className="border-white/10 bg-slate-950/80 h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="w-5 h-5 text-amber-400" />
                Challenge Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Completion Rate */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/60">Completion Rate</span>
                  <span className="font-medium text-white">{data.challenges.completionRate}%</span>
                </div>
                <Progress value={data.challenges.completionRate} className="h-2" />
                <p className="text-xs text-white/40 mt-1">
                  {data.challenges.completed} of {data.challenges.total} challenges completed
                </p>
              </div>

              {/* Difficulty Breakdown */}
              <div>
                <p className="text-sm text-white/60 mb-3">By Difficulty</p>
                <div className="space-y-3">
                  {Object.entries(data.challenges.difficultyBreakdown).map(([diff, stats]) => (
                    <div key={diff} className="flex items-center gap-3">
                      <Badge variant="outline" className="w-24 justify-center capitalize">
                        {diff}
                      </Badge>
                      <div className="flex-1">
                        <Progress 
                          value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} 
                          className="h-2" 
                        />
                      </div>
                      <span className="text-sm text-white/60 w-16 text-right">
                        {stats.completed}/{stats.total}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hints Usage */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  <Brain className="w-5 h-5 text-violet-400" />
                  <span className="text-sm text-white/70">Self-Sufficiency</span>
                </div>
                <div className="text-right">
                  <p className="font-medium text-white">{data.challenges.avgHintsPerChallenge} hints/challenge</p>
                  <p className="text-xs text-white/40">{data.challenges.totalHintsUsed} total hints used</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* AWS Services Practiced */}
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card className="border-white/10 bg-slate-950/80 h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="w-5 h-5 text-cyan-400" />
                AWS Services Practiced
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.skills.topServices.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-sm text-white/40">Complete challenges to see your service exposure</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.skills.topServices.map((item) => (
                    <div key={item.service} className="flex items-center gap-3">
                      <span className="text-sm text-white/80 w-40 truncate" title={item.service}>
                        {item.service}
                      </span>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                            style={{ width: `${(item.count / maxServiceCount) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-white/60 w-8 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Industry Exposure */}
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card className="border-white/10 bg-slate-950/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PieChart className="w-5 h-5 text-violet-400" />
                Industry Exposure
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.skills.industryBreakdown.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-sm text-white/40">Start scenarios to see industry breakdown</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.skills.industryBreakdown.map((item) => (
                    <Badge
                      key={item.industry}
                      variant="outline"
                      className="px-3 py-1.5 text-sm bg-white/5"
                    >
                      {item.industry}
                      <span className="ml-2 px-1.5 py-0.5 rounded-full bg-white/10 text-xs">
                        {item.count}
                      </span>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Learning Insights */}
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card className="border-white/10 bg-slate-950/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                Learning Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-2xl font-bold text-white">{data.learning.totalChatSessions}</p>
                  <p className="text-sm text-white/40">Chat Sessions</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-2xl font-bold text-white">{data.learning.totalQuestionsAsked}</p>
                  <p className="text-sm text-white/40">Questions Asked</p>
                </div>
              </div>

              {data.learning.topKeywords.length > 0 && (
                <div>
                  <p className="text-sm text-white/60 mb-2">Topics You&apos;ve Explored</p>
                  <div className="flex flex-wrap gap-2">
                    {data.learning.topKeywords.map((item) => (
                      <Badge
                        key={item.keyword}
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      >
                        {item.keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Scenarios */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible">
        <Card className="border-white/10 bg-slate-950/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="w-5 h-5 text-amber-400" />
              Recent Scenarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.scenarios.recentAttempts.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-sm text-white/40">No scenarios attempted yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.scenarios.recentAttempts.map((attempt, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{attempt.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-white/40">{attempt.company}</span>
                        <span className="text-white/20">•</span>
                        <span className="text-xs text-white/40">{attempt.industry}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">
                          {attempt.pointsEarned}/{attempt.maxPoints}
                        </p>
                        <p className="text-xs text-white/40">points</p>
                      </div>
                      <Badge className={getStatusColor(attempt.status)}>
                        {attempt.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Activity Timeline */}
      {data.activityTimeline.length > 0 && (
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card className="border-white/10 bg-slate-950/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                Activity Timeline (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-32">
                {data.activityTimeline.map((day) => {
                  const maxAttempts = Math.max(...data.activityTimeline.map((d) => d.attempts), 1);
                  const height = (day.attempts / maxAttempts) * 100;
                  return (
                    <div
                      key={day.date}
                      className="flex-1 flex flex-col items-center gap-1"
                      title={`${day.date}: ${day.attempts} attempts, ${day.completed} completed, ${day.points} points`}
                    >
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-cyan-600 to-cyan-400 transition-all hover:from-cyan-500 hover:to-cyan-300"
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-white/40">
                <span>{data.activityTimeline[0]?.date}</span>
                <span>{data.activityTimeline[data.activityTimeline.length - 1]?.date}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Profile Summary */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible">
        <Card className="border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/90">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-2xl font-bold text-white">
                  {data.profile.displayName?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">
                    {data.profile.displayName || "Learner"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="capitalize">
                      {data.profile.skillLevel}
                    </Badge>
                    {data.profile.targetCertification && (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                        Target: {data.profile.targetCertification}
                      </Badge>
                    )}
                    <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 capitalize">
                      {data.profile.subscriptionTier}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{data.gamification.achievementsCount}</p>
                  <p className="text-white/40">Achievements</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{data.scenarios.completed}</p>
                  <p className="text-white/40">Scenarios</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{data.challenges.completed}</p>
                  <p className="text-white/40">Challenges</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Diagnostics History */}
      {diagnosticsHistory.length > 0 && (
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card className="border-white/10 bg-slate-950/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-violet-400" />
                Your Progress Journey
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {diagnosticsHistory.slice(0, 5).map((diag, index) => (
                  <div
                    key={diag.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative w-12 h-12">
                        <svg className="w-12 h-12 transform -rotate-90">
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                            className="text-white/10"
                          />
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            stroke={
                              diag.overallReadiness >= 80
                                ? "#10b981"
                                : diag.overallReadiness >= 60
                                ? "#06b6d4"
                                : diag.overallReadiness >= 40
                                ? "#f59e0b"
                                : "#ef4444"
                            }
                            strokeWidth="4"
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={`${(diag.overallReadiness / 100) * 126} 126`}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                          {diag.overallReadiness}%
                        </span>
                      </div>
                      <div>
                        <Badge
                          className={`text-xs ${
                            diag.readinessLabel === "Exam Ready"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : diag.readinessLabel === "Almost Ready"
                              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                              : diag.readinessLabel === "Getting There"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                              : "bg-red-500/20 text-red-300 border-red-500/30"
                          }`}
                        >
                          {diag.readinessLabel}
                        </Badge>
                        {diag.summary && (
                          <p className="text-sm text-white/50 mt-1 line-clamp-1 max-w-md">
                            {diag.summary}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {index === 0 && diagnosticsHistory.length > 1 && (
                        <span
                          className={`text-xs font-medium ${
                            diag.overallReadiness > diagnosticsHistory[1].overallReadiness
                              ? "text-emerald-400"
                              : diag.overallReadiness < diagnosticsHistory[1].overallReadiness
                              ? "text-red-400"
                              : "text-white/40"
                          }`}
                        >
                          {diag.overallReadiness > diagnosticsHistory[1].overallReadiness
                            ? `+${diag.overallReadiness - diagnosticsHistory[1].overallReadiness}%`
                            : diag.overallReadiness < diagnosticsHistory[1].overallReadiness
                            ? `${diag.overallReadiness - diagnosticsHistory[1].overallReadiness}%`
                            : "No change"}
                        </span>
                      )}
                      <span className="text-xs text-white/40">
                        {new Date(diag.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* AI Diagnostics Modal */}
      <Dialog open={showDiagnostics} onOpenChange={setShowDiagnostics}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="w-6 h-6 text-violet-400" />
              AI Learning Diagnostics
            </DialogTitle>
          </DialogHeader>

          {diagnosticsLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 blur-xl opacity-30 animate-pulse" />
                <Loader2 className="w-12 h-12 animate-spin text-violet-400 relative" />
              </div>
              <p className="text-white/60 mt-4">Analyzing your learning journey...</p>
              <p className="text-white/40 text-sm mt-2">This may take a moment</p>
            </div>
          ) : diagnosticsError ? (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <p className="text-white/60 mt-4">{diagnosticsError}</p>
              <Button onClick={generateDiagnostics} variant="outline" className="mt-4 gap-2">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            </div>
          ) : diagnostics ? (
            <div className="space-y-6 py-4">
              {/* Readiness Score */}
              <div className="text-center p-6 rounded-xl bg-gradient-to-br from-violet-950/50 to-slate-900/50 border border-violet-500/20">
                <div className="relative inline-flex items-center justify-center w-32 h-32 mb-4">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-white/10"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="url(#gradient)"
                      strokeWidth="8"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${(diagnostics.overall_readiness / 100) * 352} 352`}
                    />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="absolute text-4xl font-bold text-white">
                    {diagnostics.overall_readiness}%
                  </span>
                </div>
                <Badge
                  className={`text-lg px-4 py-1 ${
                    diagnostics.readiness_label === "Exam Ready"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : diagnostics.readiness_label === "Almost Ready"
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                      : diagnostics.readiness_label === "Getting There"
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      : "bg-red-500/20 text-red-300 border-red-500/30"
                  }`}
                >
                  {diagnostics.readiness_label}
                </Badge>
                <p className="text-white/60 mt-4 max-w-xl mx-auto">{diagnostics.summary}</p>
              </div>

              {/* Encouragement */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/30 to-cyan-950/30 border border-emerald-500/20">
                <p className="text-emerald-300 italic">&ldquo;{diagnostics.encouragement}&rdquo;</p>
              </div>

              {/* Domain Scores */}
              {Object.keys(diagnostics.domain_scores).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-cyan-400" />
                    Exam Domain Readiness
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(diagnostics.domain_scores).map(([domain, score]) => (
                      <div key={domain}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-white/70">{domain}</span>
                          <span className="text-white font-medium">{score}%</span>
                        </div>
                        <Progress value={score} className="h-2" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths & Weaknesses */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    Strengths
                  </h3>
                  <div className="space-y-2">
                    {diagnostics.strengths.map((s, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20"
                      >
                        <p className="font-medium text-emerald-300">{s.area}</p>
                        <p className="text-sm text-white/50 mt-1">{s.evidence}</p>
                        {s.aws_services.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {s.aws_services.map((svc) => (
                              <Badge key={svc} variant="secondary" className="text-xs">
                                {svc}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Weaknesses */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-400" />
                    Areas to Improve
                  </h3>
                  <div className="space-y-2">
                    {diagnostics.weaknesses.map((w, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-red-950/30 border border-red-500/20"
                      >
                        <p className="font-medium text-red-300">{w.area}</p>
                        <p className="text-sm text-white/50 mt-1">{w.evidence}</p>
                        {w.aws_services.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {w.aws_services.map((svc) => (
                              <Badge key={svc} variant="secondary" className="text-xs">
                                {svc}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Learning Patterns */}
              {diagnostics.patterns.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-400" />
                    Learning Patterns
                  </h3>
                  <div className="space-y-2">
                    {diagnostics.patterns.map((p, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/20"
                      >
                        <p className="font-medium text-amber-300">{p.pattern}</p>
                        <p className="text-sm text-white/50 mt-1">{p.insight}</p>
                        <p className="text-sm text-amber-200/70 mt-1">💡 {p.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Target className="w-5 h-5 text-violet-400" />
                  Personalized Recommendations
                </h3>
                <div className="space-y-2">
                  {diagnostics.recommendations.map((r, i) => (
                    <Link
                      key={i}
                      href={r.action_link}
                      className="block p-4 rounded-lg bg-violet-950/30 border border-violet-500/20 hover:bg-violet-950/50 transition-colors group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-violet-500/30 text-violet-300 border-violet-500/30">
                              #{r.priority}
                            </Badge>
                            <p className="font-medium text-white group-hover:text-violet-300 transition-colors">
                              {r.title}
                            </p>
                          </div>
                          <p className="text-sm text-white/50 mt-1">{r.description}</p>
                          <p className="text-xs text-white/40 mt-2">{r.rationale}</p>
                        </div>
                        <div className="flex items-center gap-2 text-white/40">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm">{r.estimated_time}</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Next Milestone */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/30 to-violet-950/30 border border-cyan-500/20">
                <h3 className="text-sm font-medium text-white/60 mb-1">Next Milestone</h3>
                <p className="text-lg font-semibold text-white">{diagnostics.next_milestone}</p>
                {diagnostics.days_to_milestone && (
                  <p className="text-sm text-cyan-300 mt-1">
                    Target: {diagnostics.days_to_milestone} days
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
