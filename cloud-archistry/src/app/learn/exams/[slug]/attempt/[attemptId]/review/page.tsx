"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Trophy,
  Target,
  Clock,
  BookOpen,
  ExternalLink,
  Filter,
  ArrowLeft,
  RotateCcw,
  Home,
  TrendingUp,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Question {
  id: string;
  questionText: string;
  questionType: string;
  selectCount: number;
  scenario: string | null;
  options: { id: string; text: string }[];
  correctAnswers: string[];
  explanation: string;
  whyCorrect: string | null;
  whyWrong: Record<string, string>;
  domain: string;
  subdomain: string | null;
  awsServices: string[];
  difficulty: string;
  referenceLinks: { title: string; url: string }[];
}

interface ReviewItem {
  index: number;
  question: Question;
  userAnswer: {
    selectedOptions: string[];
    isCorrect: boolean;
    isPartiallyCorrect: boolean;
    timeSpentSeconds: number;
    wasFlagged: boolean;
  } | null;
  wasAnswered: boolean;
}

interface Attempt {
  id: string;
  status: string;
  score: number;
  passed: boolean;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  domainScores: Record<string, { correct: number; total: number; percentage: number }>;
  timeSpentSeconds: number;
  completedAt: string;
  pointsEarned: number;
}

interface Exam {
  id: string;
  title: string;
  shortTitle: string | null;
  passingScore: number;
  domains: { id: string; name: string; weight: number }[];
}

export default function ExamReviewPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const attemptId = params.attemptId as string;

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ReviewItem[]>([]);
  const [incorrectQuestions, setIncorrectQuestions] = useState<ReviewItem[]>([]);
  const [byDomain, setByDomain] = useState<Record<string, ReviewItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "incorrect" | "correct">("all");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchReview();
  }, [attemptId]);

  const fetchReview = async () => {
    try {
      const res = await fetch(`/api/exams/attempt/${attemptId}/review`);
      if (res.ok) {
        const data = await res.json();
        setAttempt(data.attempt);
        setExam(data.exam);
        setQuestions(data.questions);
        setIncorrectQuestions(data.incorrectQuestions);
        setByDomain(data.byDomain);
      } else if (res.status === 404) {
        router.push(`/exams/${slug}`);
      }
    } catch (error) {
      console.error("Failed to fetch review:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const filteredQuestions = filter === "all" 
    ? questions 
    : filter === "incorrect"
      ? questions.filter(q => !q.userAnswer?.isCorrect)
      : questions.filter(q => q.userAnswer?.isCorrect);

  const currentQuestion = filteredQuestions[currentIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading review...</p>
        </div>
      </div>
    );
  }

  if (!attempt || !exam) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Review not found</h2>
          <Link href={`/exams/${slug}`}>
            <Button>Back to Exam</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link 
            href={`/exams/${slug}`}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Exam</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <Link href={`/exams/${slug}`}>
              <Button variant="outline" size="sm" className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Try Again
              </Button>
            </Link>
            <Link href="/exams">
              <Button variant="outline" size="sm" className="gap-2">
                <Home className="w-4 h-4" />
                All Exams
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Results Summary */}
        <div className="mb-8">
          <div className={`p-8 rounded-2xl ${
            attempt.passed 
              ? "bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30" 
              : "bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/30"
          }`}>
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Score Circle */}
              <div className="relative w-40 h-40 shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-muted/30"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${(attempt.score / 100) * 440} 440`}
                    className={attempt.passed ? "text-green-500" : "text-red-500"}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold">{attempt.score}%</span>
                  <span className="text-sm text-muted-foreground">Score</span>
                </div>
              </div>

              {/* Result Details */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                  {attempt.passed ? (
                    <>
                      <Trophy className="w-8 h-8 text-green-400" />
                      <h1 className="text-3xl font-bold text-green-400">Congratulations!</h1>
                    </>
                  ) : (
                    <>
                      <Target className="w-8 h-8 text-amber-400" />
                      <h1 className="text-3xl font-bold">Keep Practicing!</h1>
                    </>
                  )}
                </div>
                
                <p className="text-muted-foreground mb-4">
                  {attempt.passed 
                    ? `You passed the ${exam.title} practice exam!`
                    : `You need ${exam.passingScore}% to pass. You scored ${attempt.score}%.`}
                </p>

                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span>{attempt.correctCount} correct</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-400" />
                    <span>{attempt.incorrectCount} incorrect</span>
                  </div>
                  {attempt.unansweredCount > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-muted-foreground" />
                      <span>{attempt.unansweredCount} unanswered</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <span>{formatTime(attempt.timeSpentSeconds)}</span>
                  </div>
                </div>

                {attempt.pointsEarned > 0 && (
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
                    <Award className="w-5 h-5" />
                    <span className="font-medium">+{attempt.pointsEarned} points earned!</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Domain Breakdown */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Domain Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(attempt.domainScores).map(([domain, scores]) => (
                <div key={domain}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{domain}</span>
                    <span className={`text-sm font-bold ${
                      scores.percentage >= exam.passingScore 
                        ? "text-green-400" 
                        : scores.percentage >= 50
                          ? "text-amber-400"
                          : "text-red-400"
                    }`}>
                      {scores.correct}/{scores.total} ({scores.percentage}%)
                    </span>
                  </div>
                  <Progress 
                    value={scores.percentage} 
                    className={`h-2 ${
                      scores.percentage >= exam.passingScore 
                        ? "[&>div]:bg-green-500" 
                        : scores.percentage >= 50
                          ? "[&>div]:bg-amber-500"
                          : "[&>div]:bg-red-500"
                    }`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Question Review */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Question Review
              </CardTitle>
              
              <div className="flex items-center gap-2">
                <Button
                  variant={filter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setFilter("all"); setCurrentIndex(0); }}
                >
                  All ({questions.length})
                </Button>
                <Button
                  variant={filter === "incorrect" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setFilter("incorrect"); setCurrentIndex(0); }}
                  className={filter === "incorrect" ? "" : "text-red-400"}
                >
                  Incorrect ({incorrectQuestions.length})
                </Button>
                <Button
                  variant={filter === "correct" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setFilter("correct"); setCurrentIndex(0); }}
                  className={filter === "correct" ? "" : "text-green-400"}
                >
                  Correct ({attempt.correctCount})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredQuestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No questions match this filter.
              </div>
            ) : currentQuestion ? (
              <div>
                {/* Question Navigation */}
                <div className="flex items-center justify-between mb-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                    disabled={currentIndex === 0}
                    className="gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  
                  <span className="text-sm text-muted-foreground">
                    Question {currentIndex + 1} of {filteredQuestions.length}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentIndex(Math.min(filteredQuestions.length - 1, currentIndex + 1))}
                    disabled={currentIndex === filteredQuestions.length - 1}
                    className="gap-2"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Question Content */}
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{currentQuestion.question.domain}</Badge>
                    <Badge variant="outline">{currentQuestion.question.difficulty}</Badge>
                    {currentQuestion.userAnswer?.isCorrect ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Correct
                      </Badge>
                    ) : currentQuestion.wasAnswered ? (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <XCircle className="w-3 h-3 mr-1" />
                        Incorrect
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Unanswered
                      </Badge>
                    )}
                  </div>

                  {/* Scenario */}
                  {currentQuestion.question.scenario && (
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {currentQuestion.question.scenario}
                      </p>
                    </div>
                  )}

                  {/* Question */}
                  <p className="text-lg leading-relaxed whitespace-pre-wrap">
                    {currentQuestion.question.questionText}
                  </p>

                  {/* Options */}
                  <div className="space-y-3">
                    {(currentQuestion.question.options as { id: string; text: string }[]).map((option) => {
                      const isCorrect = (currentQuestion.question.correctAnswers as string[]).includes(option.id);
                      const isSelected = currentQuestion.userAnswer?.selectedOptions?.includes(option.id);
                      
                      return (
                        <div
                          key={option.id}
                          className={`p-4 rounded-lg border-2 ${
                            isCorrect
                              ? "border-green-500 bg-green-500/10"
                              : isSelected
                                ? "border-red-500 bg-red-500/10"
                                : "border-border"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                              isCorrect
                                ? "border-green-500 bg-green-500 text-white"
                                : isSelected
                                  ? "border-red-500 bg-red-500 text-white"
                                  : "border-muted-foreground"
                            }`}>
                              {isCorrect ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : isSelected ? (
                                <XCircle className="w-4 h-4" />
                              ) : (
                                <span className="text-xs font-medium">{option.id}</span>
                              )}
                            </div>
                            <div className="flex-1">
                              <span>{option.text}</span>
                              
                              {/* Why wrong explanation */}
                              {isSelected && !isCorrect && currentQuestion.question.whyWrong?.[option.id] && (
                                <p className="mt-2 text-sm text-red-400">
                                  ❌ {currentQuestion.question.whyWrong[option.id]}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  <div className="p-6 rounded-lg bg-primary/5 border border-primary/20">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-primary" />
                      Explanation
                    </h4>
                    <p className="text-muted-foreground whitespace-pre-wrap mb-4">
                      {currentQuestion.question.explanation}
                    </p>
                    
                    {currentQuestion.question.whyCorrect && (
                      <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                        <p className="text-sm text-green-400">
                          ✅ <strong>Why correct:</strong> {currentQuestion.question.whyCorrect}
                        </p>
                      </div>
                    )}
                    
                    {/* AWS Services */}
                    {currentQuestion.question.awsServices?.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground mb-2">AWS Services:</p>
                        <div className="flex flex-wrap gap-2">
                          {(currentQuestion.question.awsServices as string[]).map((service) => (
                            <Badge key={service} variant="outline">
                              {service}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Reference Links */}
                    {currentQuestion.question.referenceLinks?.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground mb-2">Learn more:</p>
                        <div className="space-y-1">
                          {(currentQuestion.question.referenceLinks as { title: string; url: string }[]).map((link, i) => (
                            <a
                              key={i}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                              <ExternalLink className="w-4 h-4" />
                              {link.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
