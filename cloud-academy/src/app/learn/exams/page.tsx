"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  Clock,
  Trophy,
  Users,
  Lock,
  ChevronRight,
  Target,
  TrendingUp,
  CheckCircle,
  Loader2,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Navbar } from "@/components/navbar";

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
  userStats: {
    attempts: number;
    bestScore: number;
    passed: boolean;
  } | null;
}

const difficultyColors: Record<string, { bg: string; text: string; border: string }> = {
  foundational: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30" },
  associate: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
  professional: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30" },
  specialty: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
};

const tierLabels: Record<string, string> = {
  free: "Free",
  learner: "Learner",
  pro: "Pro",
  team: "Team",
};

export default function ExamsPage() {
  const { data: session, status: authStatus } = useSession();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const res = await fetch("/api/exams");
      if (res.ok) {
        const data = await res.json();
        setExams(data.exams || []);
      }
    } catch (error) {
      console.error("Failed to fetch exams:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredExams = exams.filter(exam => {
    if (filter === "all") return true;
    if (filter === "free") return exam.isFree;
    return exam.difficulty === filter;
  });

  const userPassedCount = exams.filter(e => e.userStats?.passed).length;
  const userAttemptedCount = exams.filter(e => e.userStats && e.userStats.attempts > 0).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading practice exams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar activePath="/exams" variant="transparent" />

      {/* Hero Section */}
      <section className="pt-24 pb-12 px-6 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">AWS Practice Exams</h1>
              <p className="text-muted-foreground">AWS Certification Exam Preparation</p>
            </div>
          </div>
          
          <p className="text-lg text-muted-foreground max-w-2xl mb-8">
            Prepare for your AWS certification with realistic practice exams. 
            Detailed explanations for every question help you understand the "why" behind each answer.
          </p>

          {/* Stats Cards */}
          {session?.user && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <BookOpen className="w-4 h-4" />
                    <span className="text-xs">Available</span>
                  </div>
                  <p className="text-2xl font-bold">{exams.length}</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Target className="w-4 h-4" />
                    <span className="text-xs">Attempted</span>
                  </div>
                  <p className="text-2xl font-bold">{userAttemptedCount}</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Trophy className="w-4 h-4 text-green-400" />
                    <span className="text-xs">Passed</span>
                  </div>
                  <p className="text-2xl font-bold text-green-400">{userPassedCount}</p>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs">Progress</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {exams.length > 0 ? Math.round((userPassedCount / exams.length) * 100) : 0}%
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "All Exams" },
              { value: "free", label: "Free" },
              { value: "foundational", label: "Foundational" },
              { value: "associate", label: "Associate" },
              { value: "professional", label: "Professional" },
              { value: "specialty", label: "Specialty" },
            ].map(({ value, label }) => (
              <Button
                key={value}
                variant={filter === value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Exam Grid */}
      <section className="px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          {filteredExams.length === 0 ? (
            <div className="text-center py-20">
              <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No exams found</h3>
              <p className="text-muted-foreground">
                {filter !== "all" 
                  ? "Try adjusting your filters" 
                  : "Practice exams will be available soon!"}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredExams.map((exam) => {
                const colors = difficultyColors[exam.difficulty] || difficultyColors.associate;
                
                return (
                  <Link key={exam.id} href={`/exams/${exam.slug}`}>
                    <Card className={`h-full bg-card/50 border-border/50 hover:border-primary/50 transition-all hover:scale-[1.02] cursor-pointer relative overflow-hidden ${
                      !exam.hasAccess ? "opacity-75" : ""
                    }`}>
                      {/* Locked overlay */}
                      {!exam.hasAccess && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center">
                          <div className="text-center">
                            <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Requires {tierLabels[exam.requiredTier]} tier
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Passed badge */}
                      {exam.userStats?.passed && (
                        <div className="absolute top-3 right-3 z-20">
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 border border-green-500/50">
                            <CheckCircle className="w-3 h-3 text-green-400" />
                            <span className="text-xs font-bold text-green-400">PASSED</span>
                          </div>
                        </div>
                      )}
                      
                      <CardContent className="p-6">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                              style={{ backgroundColor: `${exam.color}20` }}
                            >
                              {exam.icon}
                            </div>
                            <div>
                              <Badge className={`${colors.bg} ${colors.text} ${colors.border} border`}>
                                {exam.difficulty.charAt(0).toUpperCase() + exam.difficulty.slice(1)}
                              </Badge>
                            </div>
                          </div>
                          {exam.isFree && (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/30">
                              Free
                            </Badge>
                          )}
                        </div>
                        
                        {/* Title */}
                        <h3 className="text-lg font-semibold mb-1">{exam.title}</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {exam.certificationCode}
                        </p>
                        
                        {/* Description */}
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {exam.description}
                        </p>
                        
                        {/* Exam details */}
                        <div className="flex flex-wrap gap-3 mb-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4" />
                            {exam.questionCount} questions
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {exam.timeLimit} min
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="w-4 h-4" />
                            {exam.passingScore}% to pass
                          </span>
                        </div>
                        
                        {/* User stats or global stats */}
                        {exam.userStats ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Your best score</span>
                              <span className={`font-bold ${
                                exam.userStats.bestScore >= exam.passingScore 
                                  ? "text-green-400" 
                                  : "text-amber-400"
                              }`}>
                                {exam.userStats.bestScore}%
                              </span>
                            </div>
                            <Progress 
                              value={exam.userStats.bestScore} 
                              className="h-2"
                            />
                            <p className="text-xs text-muted-foreground">
                              {exam.userStats.attempts} attempt{exam.userStats.attempts !== 1 ? "s" : ""}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {exam.totalAttempts.toLocaleString()} attempts
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-4 h-4" />
                              {exam.passRate}% pass rate
                            </span>
                          </div>
                        )}
                        
                        {/* CTA */}
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <Button 
                            className="w-full gap-2" 
                            variant={exam.hasAccess ? "default" : "outline"}
                            disabled={!exam.hasAccess}
                          >
                            {exam.userStats?.passed ? (
                              <>
                                <Sparkles className="w-4 h-4" />
                                Practice Again
                              </>
                            ) : exam.userStats ? (
                              <>
                                <Target className="w-4 h-4" />
                                Continue Practicing
                              </>
                            ) : (
                              <>
                                <ChevronRight className="w-4 h-4" />
                                Start Practice
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">
            Why Practice With CloudArchistry?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Detailed Explanations</h3>
              <p className="text-muted-foreground">
                Every question includes comprehensive explanations for both correct and incorrect answers.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Domain-Based Practice</h3>
              <p className="text-muted-foreground">
                Focus on your weak areas with domain-specific practice sessions and analytics.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Progress Tracking</h3>
              <p className="text-muted-foreground">
                Track your readiness score and see your improvement over time with detailed analytics.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
