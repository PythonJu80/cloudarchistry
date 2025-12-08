"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  Clock,
  Trophy,
  Target,
  TrendingUp,
  ChevronRight,
  ArrowLeft,
  Play,
  Eye,
  BarChart3,
  CheckCircle,
  XCircle,
  Loader2,
  GraduationCap,
  Calendar,
  Timer,
  Zap,
  Lock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface Exam {
  id: string;
  slug: string;
  title: string;
  shortTitle: string | null;
  certificationCode: string;
  description: string;
  questionCount: number;
  timeLimit: number;
  passingScore: number;
  totalQuestions: number;
  domains: { id: string; name: string; weight: number }[];
  isFree: boolean;
  requiredTier: string;
  icon: string;
  color: string;
  difficulty: string;
  totalAttempts: number;
  avgScore: number;
  passRate: number;
  hasAccess: boolean;
}

interface Attempt {
  id: string;
  mode: string;
  status: string;
  score: number | null;
  passed: boolean | null;
  correctCount: number;
  incorrectCount: number;
  timeSpentSeconds: number;
  startedAt: string;
  completedAt: string | null;
  domainScores: Record<string, { correct: number; total: number; percentage: number }>;
}

interface Analytics {
  totalAttempts: number;
  bestScore: number;
  avgScore: number;
  passCount: number;
  domainPerformance: Record<string, { attempts: number; avgScore: number }>;
  weakDomains: string[];
  readinessScore: number;
}

const difficultyColors: Record<string, { bg: string; text: string }> = {
  foundational: { bg: "bg-green-500/10", text: "text-green-400" },
  associate: { bg: "bg-blue-500/10", text: "text-blue-400" },
  professional: { bg: "bg-purple-500/10", text: "text-purple-400" },
  specialty: { bg: "bg-orange-500/10", text: "text-orange-400" },
};

export default function ExamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const slug = params.slug as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [inProgressAttempt, setInProgressAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"timed" | "review">("timed");

  useEffect(() => {
    if (slug) {
      fetchExamDetails();
    }
  }, [slug]);

  const fetchExamDetails = async () => {
    try {
      const res = await fetch(`/api/exams/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setExam(data.exam);
        setAttempts(data.userAttempts || []);
        setAnalytics(data.analytics);
        setInProgressAttempt(data.inProgressAttempt);
      } else if (res.status === 404) {
        router.push("/exams");
      }
    } catch (error) {
      console.error("Failed to fetch exam:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = async () => {
    if (!session?.user) {
      router.push("/login");
      return;
    }

    setStarting(true);
    try {
      const res = await fetch(`/api/exams/${slug}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selectedMode }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/exams/${slug}/attempt/${data.attempt.id}`);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to start exam");
      }
    } catch (error) {
      console.error("Failed to start exam:", error);
    } finally {
      setStarting(false);
      setShowStartDialog(false);
    }
  };

  const handleResumeExam = () => {
    if (inProgressAttempt) {
      router.push(`/exams/${slug}/attempt/${inProgressAttempt.id}`);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading exam details...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Exam not found</h2>
          <Link href="/exams">
            <Button>Back to Exams</Button>
          </Link>
        </div>
      </div>
    );
  }

  const colors = difficultyColors[exam.difficulty] || difficultyColors.associate;
  const domains = (exam.domains || []) as { id: string; name: string; weight: number }[];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/exams" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Exams</span>
          </Link>
          
          <div className="flex items-center gap-3">
            {inProgressAttempt ? (
              <Button onClick={handleResumeExam} className="gap-2">
                <Play className="w-4 h-4" />
                Resume Exam
              </Button>
            ) : exam.hasAccess ? (
              <Button onClick={() => setShowStartDialog(true)} className="gap-2">
                <Play className="w-4 h-4" />
                Start Exam
              </Button>
            ) : (
              <Button variant="outline" disabled className="gap-2">
                <Lock className="w-4 h-4" />
                Upgrade to Access
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Exam Header */}
            <div className="flex items-start gap-4">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                style={{ backgroundColor: `${exam.color}20` }}
              >
                {exam.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={`${colors.bg} ${colors.text}`}>
                    {exam.difficulty.charAt(0).toUpperCase() + exam.difficulty.slice(1)}
                  </Badge>
                  {exam.isFree && (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-400">
                      Free
                    </Badge>
                  )}
                </div>
                <h1 className="text-2xl font-bold mb-1">{exam.title}</h1>
                <p className="text-muted-foreground">{exam.certificationCode}</p>
              </div>
            </div>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">About This Exam</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">{exam.description}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <BookOpen className="w-5 h-5 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold">{exam.questionCount}</p>
                    <p className="text-xs text-muted-foreground">Questions</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <Clock className="w-5 h-5 mx-auto mb-2 text-blue-400" />
                    <p className="text-2xl font-bold">{exam.timeLimit}</p>
                    <p className="text-xs text-muted-foreground">Minutes</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <Target className="w-5 h-5 mx-auto mb-2 text-green-400" />
                    <p className="text-2xl font-bold">{exam.passingScore}%</p>
                    <p className="text-xs text-muted-foreground">To Pass</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <BarChart3 className="w-5 h-5 mx-auto mb-2 text-purple-400" />
                    <p className="text-2xl font-bold">{exam.passRate}%</p>
                    <p className="text-xs text-muted-foreground">Pass Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Domains */}
            {domains.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Exam Domains</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {domains.map((domain, index) => (
                      <div key={domain.id || index}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{domain.name}</span>
                          <span className="text-sm text-muted-foreground">{domain.weight}%</span>
                        </div>
                        <Progress value={domain.weight} className="h-2" />
                        
                        {/* Show user's performance if available */}
                        {analytics?.domainPerformance?.[domain.name] && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Your avg: {Math.round(analytics.domainPerformance[domain.name].avgScore)}%
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Attempts */}
            {attempts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Your Attempts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {attempts.map((attempt) => (
                      <div 
                        key={attempt.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            attempt.passed 
                              ? "bg-green-500/20 text-green-400" 
                              : attempt.status === "completed"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-muted text-muted-foreground"
                          }`}>
                            {attempt.passed ? (
                              <CheckCircle className="w-5 h-5" />
                            ) : attempt.status === "completed" ? (
                              <XCircle className="w-5 h-5" />
                            ) : (
                              <Timer className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {attempt.score !== null ? `${attempt.score}%` : "In Progress"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(attempt.startedAt)} • {attempt.mode} mode
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {attempt.status === "completed" && (
                            <div className="text-right text-sm">
                              <p className="text-green-400">{attempt.correctCount} correct</p>
                              <p className="text-muted-foreground text-xs">
                                {formatTime(attempt.timeSpentSeconds)}
                              </p>
                            </div>
                          )}
                          
                          {attempt.status === "completed" ? (
                            <Link href={`/exams/${slug}/attempt/${attempt.id}/review`}>
                              <Button variant="outline" size="sm" className="gap-1">
                                <Eye className="w-4 h-4" />
                                Review
                              </Button>
                            </Link>
                          ) : (
                            <Link href={`/exams/${slug}/attempt/${attempt.id}`}>
                              <Button size="sm" className="gap-1">
                                <Play className="w-4 h-4" />
                                Resume
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Readiness Score */}
            {analytics && (
              <Card className="border-primary/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    Readiness Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-4">
                    <div className="relative w-32 h-32 mx-auto">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="12"
                          fill="none"
                          className="text-muted"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="12"
                          fill="none"
                          strokeDasharray={`${(analytics.readinessScore / 100) * 352} 352`}
                          className={
                            analytics.readinessScore >= exam.passingScore
                              ? "text-green-500"
                              : analytics.readinessScore >= 50
                                ? "text-amber-500"
                                : "text-red-500"
                          }
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold">{analytics.readinessScore}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-center text-sm text-muted-foreground mb-4">
                    {analytics.readinessScore >= exam.passingScore
                      ? "You're ready to pass!"
                      : `Need ${exam.passingScore - analytics.readinessScore}% more to be ready`}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{analytics.totalAttempts}</p>
                      <p className="text-xs text-muted-foreground">Attempts</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-400">{analytics.bestScore}%</p>
                      <p className="text-xs text-muted-foreground">Best Score</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Weak Areas */}
            {analytics?.weakDomains && analytics.weakDomains.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-amber-400" />
                    Focus Areas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    These domains need more practice:
                  </p>
                  <div className="space-y-2">
                    {analytics.weakDomains.map((domain, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 text-amber-400"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span className="text-sm">{domain}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {inProgressAttempt ? (
                  <Button onClick={handleResumeExam} className="w-full gap-2">
                    <Play className="w-4 h-4" />
                    Resume In-Progress Exam
                  </Button>
                ) : (
                  <Button 
                    onClick={() => setShowStartDialog(true)} 
                    className="w-full gap-2"
                    disabled={!exam.hasAccess}
                  >
                    <Play className="w-4 h-4" />
                    Start New Exam
                  </Button>
                )}
                
                {attempts.length > 0 && (
                  <Link href={`/exams/${slug}/attempt/${attempts[0].id}/review`}>
                    <Button variant="outline" className="w-full gap-2">
                      <Eye className="w-4 h-4" />
                      Review Last Attempt
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Start Exam Dialog */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Practice Exam</DialogTitle>
            <DialogDescription>
              Choose how you want to take this exam
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <RadioGroup value={selectedMode} onValueChange={(v) => setSelectedMode(v as "timed" | "review")}>
              <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="timed" id="timed" />
                <Label htmlFor="timed" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Timer className="w-4 h-4 text-primary" />
                    <span className="font-medium">Timed Mode</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Simulate the real exam with a {exam.timeLimit}-minute time limit. 
                    See explanations after you submit.
                  </p>
                </Label>
              </div>
              
              <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:bg-muted/50 cursor-pointer mt-3">
                <RadioGroupItem value="review" id="review" />
                <Label htmlFor="review" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-4 h-4 text-green-400" />
                    <span className="font-medium">Review Mode</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No time limit. See the correct answer and explanation immediately after each question.
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartExam} disabled={starting} className="gap-2">
              {starting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Exam
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
