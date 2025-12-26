"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Clock,
  BookOpen,
  CheckCircle,
  AlertCircle,
  Loader2,
  Send,
  Grid3X3,
  X,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Question {
  id: string;
  questionText: string;
  questionType: string;
  selectCount: number;
  scenario: string | null;
  options: { id: string; text: string }[];
  domain: string;
  // These are only available in review mode after answering
  correctAnswers?: string[];
  explanation?: string;
  whyCorrect?: string;
  whyWrong?: Record<string, string>;
}

interface Exam {
  id: string;
  title: string;
  shortTitle: string | null;
  timeLimit: number;
  passingScore: number;
  questionCount: number;
}

interface Attempt {
  id: string;
  status: string;
  mode: string;
  currentIndex: number;
  totalQuestions: number;
  timeSpentSeconds: number;
  timeRemaining: number | null;
  startedAt: string;
  flaggedQuestions: string[];
}

export default function ExamAttemptPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const attemptId = params.attemptId as string;

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [answeredMap, setAnsweredMap] = useState<Record<string, { selected: string[]; flagged: boolean }>>({});
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch attempt data
  const fetchAttempt = useCallback(async () => {
    try {
      const res = await fetch(`/api/exams/attempt/${attemptId}`);
      if (res.ok) {
        const data = await res.json();
        setAttempt(data.attempt);
        setExam(data.exam);
        setCurrentQuestion(data.currentQuestion);
        setQuestionIds(data.questionIds);
        setAnsweredMap(data.answeredMap);
        
        // Set initial selected options from saved answer
        const currentQId = data.questionIds[data.attempt.currentIndex];
        if (data.answeredMap[currentQId]) {
          setSelectedOptions(data.answeredMap[currentQId].selected);
        } else {
          setSelectedOptions([]);
        }
        
        // Set time remaining for timed mode
        if (data.attempt.mode === "timed" && data.attempt.timeRemaining !== null) {
          setTimeRemaining(data.attempt.timeRemaining);
        }
        
        setQuestionStartTime(Date.now());
      } else if (res.status === 404) {
        router.push(`/exams/${slug}`);
      }
    } catch (error) {
      console.error("Failed to fetch attempt:", error);
    } finally {
      setLoading(false);
    }
  }, [attemptId, slug, router]);

  useEffect(() => {
    fetchAttempt();
  }, [fetchAttempt]);

  // Timer for timed mode
  useEffect(() => {
    if (attempt?.mode === "timed" && timeRemaining !== null && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          
          // Show warning at 5 minutes
          if (prev === 300) {
            setShowTimeWarning(true);
          }
          
          // Auto-submit at 0
          if (prev <= 1) {
            handleSubmit(true);
            return 0;
          }
          
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [attempt?.mode, timeRemaining]);

  // Save answer
  const saveAnswer = async (questionId: string, options: string[], flagged?: boolean) => {
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
    
    try {
      await fetch(`/api/exams/attempt/${attemptId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          selectedOptions: options,
          timeSpentSeconds: timeSpent,
          flagged,
        }),
      });
      
      // Update local state
      setAnsweredMap((prev) => ({
        ...prev,
        [questionId]: { selected: options, flagged: flagged ?? prev[questionId]?.flagged ?? false },
      }));
    } catch (error) {
      console.error("Failed to save answer:", error);
    }
  };

  // Navigate to question
  const navigateToQuestion = async (index: number) => {
    if (!attempt || !currentQuestion) return;
    
    setSaving(true);
    
    // Save current answer first
    if (selectedOptions.length > 0) {
      await saveAnswer(currentQuestion.id, selectedOptions);
    }
    
    // Update current index
    try {
      const res = await fetch(`/api/exams/attempt/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentIndex: index,
          timeRemaining,
        }),
      });
      
      if (res.ok) {
        // Refetch to get new question
        await fetchAttempt();
      }
    } catch (error) {
      console.error("Failed to navigate:", error);
    } finally {
      setSaving(false);
      setShowNavigator(false);
    }
  };

  // Toggle option selection
  const toggleOption = (optionId: string) => {
    if (!currentQuestion) return;
    
    if (currentQuestion.questionType === "single" || currentQuestion.selectCount === 1) {
      setSelectedOptions([optionId]);
    } else {
      // Multi-select
      if (selectedOptions.includes(optionId)) {
        setSelectedOptions(selectedOptions.filter((id) => id !== optionId));
      } else if (selectedOptions.length < currentQuestion.selectCount) {
        setSelectedOptions([...selectedOptions, optionId]);
      }
    }
  };

  // Toggle flag
  const toggleFlag = async () => {
    if (!currentQuestion || !attempt) return;
    
    const currentFlagged = answeredMap[currentQuestion.id]?.flagged ?? false;
    const newFlagged = !currentFlagged;
    
    await saveAnswer(currentQuestion.id, selectedOptions, newFlagged);
  };

  // Submit exam
  const handleSubmit = async (timedOut = false) => {
    setSubmitting(true);
    
    // Save current answer first
    if (currentQuestion && selectedOptions.length > 0) {
      await saveAnswer(currentQuestion.id, selectedOptions);
    }
    
    try {
      const totalTimeSpent = exam 
        ? (exam.timeLimit * 60) - (timeRemaining ?? 0)
        : attempt?.timeSpentSeconds ?? 0;
      
      const res = await fetch(`/api/exams/attempt/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeSpentSeconds: totalTimeSpent,
          timedOut,
        }),
      });
      
      if (res.ok) {
        router.push(`/exams/${slug}/attempt/${attemptId}/review`);
      }
    } catch (error) {
      console.error("Failed to submit:", error);
    } finally {
      setSubmitting(false);
      setShowSubmitDialog(false);
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (!attempt || !exam || !currentQuestion) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Exam not found</h2>
          <Link href={`/exams/${slug}`}>
            <Button>Back to Exam</Button>
          </Link>
        </div>
      </div>
    );
  }

  const currentIndex = attempt.currentIndex;
  const totalQuestions = questionIds.length;
  const answeredCount = Object.keys(answeredMap).filter(
    (id) => answeredMap[id].selected.length > 0
  ).length;
  const flaggedCount = Object.values(answeredMap).filter((a) => a.flagged).length;
  const isFlagged = answeredMap[currentQuestion.id]?.flagged ?? false;
  const progress = ((currentIndex + 1) / totalQuestions) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-semibold">{exam.shortTitle || exam.title}</span>
            <Badge variant="outline">
              {currentIndex + 1} / {totalQuestions}
            </Badge>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Timer */}
            {attempt.mode === "timed" && timeRemaining !== null && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                timeRemaining <= 300 
                  ? "bg-red-500/10 text-red-400" 
                  : "bg-muted"
              }`}>
                <Timer className="w-4 h-4" />
                <span className="font-mono font-medium">{formatTime(timeRemaining)}</span>
              </div>
            )}
            
            {/* Navigator toggle */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowNavigator(true)}
              className="gap-2"
            >
              <Grid3X3 className="w-4 h-4" />
              <span className="hidden sm:inline">Navigator</span>
            </Button>
            
            {/* Submit */}
            <Button 
              onClick={() => setShowSubmitDialog(true)}
              size="sm"
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Submit</span>
            </Button>
          </div>
        </div>
        
        {/* Progress bar */}
        <Progress value={progress} className="h-1 rounded-none" />
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        <Card className="mb-6">
          <CardContent className="p-6">
            {/* Question header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{currentQuestion.domain}</Badge>
                {currentQuestion.questionType === "multiple" && (
                  <Badge variant="outline">Select {currentQuestion.selectCount}</Badge>
                )}
              </div>
              <Button
                variant={isFlagged ? "default" : "outline"}
                size="sm"
                onClick={toggleFlag}
                className={`gap-2 ${isFlagged ? "bg-amber-500 hover:bg-amber-600" : ""}`}
              >
                <Flag className="w-4 h-4" />
                {isFlagged ? "Flagged" : "Flag"}
              </Button>
            </div>

            {/* Scenario */}
            {currentQuestion.scenario && (
              <div className="mb-6 p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {currentQuestion.scenario}
                </p>
              </div>
            )}

            {/* Question text */}
            <div className="mb-6">
              <p className="text-lg leading-relaxed whitespace-pre-wrap">
                {currentQuestion.questionText}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {(currentQuestion.options as { id: string; text: string }[]).map((option) => {
                const isSelected = selectedOptions.includes(option.id);
                
                return (
                  <button
                    key={option.id}
                    onClick={() => toggleOption(option.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground"
                      }`}>
                        {isSelected && <CheckCircle className="w-4 h-4" />}
                        {!isSelected && <span className="text-xs font-medium">{option.id}</span>}
                      </div>
                      <span className="flex-1">{option.text}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigateToQuestion(currentIndex - 1)}
            disabled={currentIndex === 0 || saving}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          
          <div className="text-sm text-muted-foreground">
            {answeredCount} of {totalQuestions} answered
            {flaggedCount > 0 && ` • ${flaggedCount} flagged`}
          </div>
          
          {currentIndex < totalQuestions - 1 ? (
            <Button
              onClick={() => navigateToQuestion(currentIndex + 1)}
              disabled={saving}
              className="gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={() => setShowSubmitDialog(true)}
              className="gap-2"
            >
              Review & Submit
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </main>

      {/* Question Navigator Dialog */}
      <Dialog open={showNavigator} onOpenChange={setShowNavigator}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Question Navigator</DialogTitle>
            <DialogDescription>
              Click a question to jump to it. {answeredCount} of {totalQuestions} answered.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-10 gap-2 py-4">
            {questionIds.map((qId, index) => {
              const isAnswered = answeredMap[qId]?.selected?.length > 0;
              const isFlagged = answeredMap[qId]?.flagged;
              const isCurrent = index === currentIndex;
              
              return (
                <button
                  key={qId}
                  onClick={() => navigateToQuestion(index)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-all relative ${
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isAnswered
                        ? "bg-green-500/20 text-green-400 border border-green-500/50"
                        : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {index + 1}
                  {isFlagged && (
                    <Flag className="w-3 h-3 absolute -top-1 -right-1 text-amber-400" />
                  )}
                </button>
              );
            })}
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/50" />
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted" />
              <span>Unanswered</span>
            </div>
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-amber-400" />
              <span>Flagged</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Exam?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4">
                <p>Are you sure you want to submit your exam?</p>
                
                <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-400">{answeredCount}</p>
                    <p className="text-xs text-muted-foreground">Answered</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-muted-foreground">
                      {totalQuestions - answeredCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Unanswered</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-400">{flaggedCount}</p>
                    <p className="text-xs text-muted-foreground">Flagged</p>
                  </div>
                </div>
                
                {totalQuestions - answeredCount > 0 && (
                  <p className="text-amber-400 text-sm">
                    ⚠️ You have {totalQuestions - answeredCount} unanswered question(s).
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Exam</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Exam
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Time Warning Dialog */}
      <AlertDialog open={showTimeWarning} onOpenChange={setShowTimeWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-400">
              <Timer className="w-5 h-5" />
              5 Minutes Remaining!
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have 5 minutes left to complete your exam. 
              The exam will be automatically submitted when time runs out.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
