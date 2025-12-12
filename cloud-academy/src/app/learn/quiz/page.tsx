"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ListTodo,
  Sparkles,
  ChevronLeft,
  Check,
  X,
  Clock,
  Target,
  Trophy,
  Loader2,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface QuizOption {
  id: string;
  text: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  questionType: string;
  options: QuizOption[];
  difficulty: string;
  points: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  quizType: string;
  passingScore: number;
  questionCount: number;
  estimatedMinutes: number;
  questions: QuizQuestion[];
  userAttempts: { score: number; passed: boolean; completedAt: string }[];
  bestScore: number | null;
  hasPassed: boolean;
}

interface GradedAnswer {
  questionId: string;
  isCorrect: boolean;
  pointsEarned: number;
  correctOptions: string[];
  explanation: string;
}

interface QuizResult {
  score: number;
  passed: boolean;
  totalPoints: number;
  earnedPoints: number;
  correctCount: number;
  totalQuestions: number;
  gradedAnswers: GradedAnswer[];
}

export default function QuizPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Active quiz state
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [activeQuizQuestions, setActiveQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<Map<string, string[]>>(new Map());
  const [quizComplete, setQuizComplete] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [currentGradedAnswer, setCurrentGradedAnswer] = useState<GradedAnswer | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  
  const [error, setError] = useState<string | null>(null);

  // Fetch quizzes from API
  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/learn/quiz");
      if (response.ok) {
        const data = await response.json();
        setQuizzes(data.quizzes || []);
      }
    } catch (error) {
      console.error("Error fetching quizzes:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  // Generate quiz from certification (no scenario needed - same as flashcards)
  const handleGenerateQuiz = async () => {
    try {
      setGenerating(true);
      setError(null);
      
      const res = await fetch("/api/learn/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionCount: 10 }),
      });
      
      if (res.status === 402) {
        setError("Please configure your OpenAI API key in Settings to generate quizzes.");
        return;
      }
      
      if (res.status === 400) {
        const data = await res.json();
        if (data.action === "set_certification") {
          setError("Please set your target AWS certification in Settings before generating quizzes.");
          return;
        }
        throw new Error(data.error || "Failed to generate quiz");
      }
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate quiz");
      }
      
      await fetchQuizzes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate quiz");
    } finally {
      setGenerating(false);
    }
  };

  // Start a quiz (or resume if in-progress attempt exists)
  const startQuiz = async (quiz: Quiz) => {
    try {
      // Fetch full quiz with questions and check for existing attempt
      const response = await fetch(`/api/learn/quiz/${quiz.id}`);
      if (!response.ok) throw new Error("Failed to load quiz");
      
      const fullQuiz = await response.json();
      
      setActiveQuiz(quiz);
      setActiveQuizQuestions(fullQuiz.questions);
      
      // Resume from existing attempt if available
      if (fullQuiz.attemptId) {
        setAttemptId(fullQuiz.attemptId);
        setCurrentQuestionIndex(fullQuiz.resumeIndex || 0);
        // Restore previous answers
        const previousAnswers = new Map<string, string[]>();
        fullQuiz.questions.forEach((q: { id: string; previousAnswer?: { selectedOptions: string[] } }) => {
          if (q.previousAnswer) {
            previousAnswers.set(q.id, q.previousAnswer.selectedOptions);
          }
        });
        setAnswers(previousAnswers);
        setStartTime(fullQuiz.startedAt ? new Date(fullQuiz.startedAt).getTime() : Date.now());
      } else {
        setAttemptId(null);
        setCurrentQuestionIndex(0);
        setAnswers(new Map());
        setStartTime(Date.now());
      }
      
      setSelectedOptions([]);
      setShowResult(false);
      setQuizComplete(false);
      setQuizResult(null);
      setCurrentGradedAnswer(null);
    } catch (error) {
      console.error("Error starting quiz:", error);
      alert("Failed to load quiz");
    }
  };

  const currentQuestion = activeQuizQuestions[currentQuestionIndex];

  // Handle option selection
  const toggleOption = (optionId: string) => {
    if (showResult) return;
    
    if (currentQuestion?.questionType === "multi_select") {
      setSelectedOptions((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      setSelectedOptions([optionId]);
    }
  };

  // Submit current answer and get immediate feedback
  const submitAnswer = async () => {
    if (selectedOptions.length === 0 || !activeQuiz) return;
    
    try {
      // Record answer locally
      const newAnswers = new Map(answers);
      newAnswers.set(currentQuestion.id, selectedOptions);
      setAnswers(newAnswers);
      
      // Get grading for this question and save progress
      const response = await fetch(`/api/learn/quiz/${activeQuiz.id}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          selectedOptions,
          attemptId,
        }),
      });
      
      if (response.ok) {
        const graded = await response.json();
        setCurrentGradedAnswer(graded);
        // Store attemptId from first graded answer
        if (graded.attemptId && !attemptId) {
          setAttemptId(graded.attemptId);
        }
      }
      
      setShowResult(true);
    } catch (error) {
      console.error("Error grading answer:", error);
      setShowResult(true);
    }
  };

  // Move to next question
  const nextQuestion = () => {
    if (currentQuestionIndex < activeQuizQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOptions([]);
      setShowResult(false);
      setCurrentGradedAnswer(null);
    } else {
      // Submit quiz
      submitQuiz();
    }
  };

  // Submit entire quiz
  const submitQuiz = async () => {
    if (!activeQuiz) return;
    
    try {
      setSubmitting(true);
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      
      // Convert answers map to array
      const answersArray = Array.from(answers.entries()).map(([questionId, opts]) => ({
        questionId,
        selectedOptions: opts,
      }));

      const response = await fetch(`/api/learn/quiz/${activeQuiz.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: answersArray,
          timeSpentSeconds: timeSpent,
          attemptId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setQuizResult(result);
        setQuizComplete(true);
      } else {
        throw new Error("Failed to submit quiz");
      }
    } catch (error) {
      console.error("Error submitting quiz:", error);
      alert("Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  // Exit quiz
  const exitQuiz = () => {
    setActiveQuiz(null);
    setActiveQuizQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedOptions([]);
    setShowResult(false);
    setAnswers(new Map());
    setQuizComplete(false);
    setQuizResult(null);
    setCurrentGradedAnswer(null);
    fetchQuizzes(); // Refresh to show updated attempts
  };

  // Delete quiz
  const deleteQuiz = async (quizId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this quiz?")) return;
    
    try {
      const response = await fetch(`/api/learn/quiz/${quizId}`, { method: "DELETE" });
      if (response.ok) {
        await fetchQuizzes();
      }
    } catch (error) {
      console.error("Error deleting quiz:", error);
    }
  };

  // Quiz complete view
  if (activeQuiz && quizComplete && quizResult) {
    return (
      <div className="p-6">
        <div className="max-w-xl mx-auto text-center py-12">
          <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${
            quizResult.passed ? "bg-green-500/20" : "bg-red-500/20"
          }`}>
            <Trophy className={`w-10 h-10 ${
              quizResult.passed ? "text-green-400" : "text-red-400"
            }`} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
          <p className="text-muted-foreground mb-6">{activeQuiz.title}</p>
          
          <div className="p-6 rounded-xl bg-muted/30 border border-border/50 mb-6">
            <div className="text-4xl font-bold mb-2">{quizResult.score}%</div>
            <p className="text-muted-foreground">
              {quizResult.correctCount} of {quizResult.totalQuestions} correct
            </p>
            <p className="text-sm mt-2">
              {quizResult.earnedPoints} / {quizResult.totalPoints} points earned
            </p>
          </div>

          {quizResult.passed ? (
            <Badge className="bg-green-500/20 text-green-400 mb-6">Passed!</Badge>
          ) : (
            <Badge className="bg-red-500/20 text-red-400 mb-6">
              Need {activeQuiz.passingScore}% to pass
            </Badge>
          )}
          
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={exitQuiz}>
              Back to quizzes
            </Button>
            <Button onClick={() => startQuiz(activeQuiz)}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Active quiz view
  if (activeQuiz && currentQuestion) {
    const isOptionSelected = (optionId: string) => selectedOptions.includes(optionId);
    
    return (
      <div className="p-6">
        {/* Quiz Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={exitQuiz}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Exit quiz
            </Button>
            <div>
              <h2 className="font-semibold">{activeQuiz.title}</h2>
              <p className="text-sm text-muted-foreground">
                Question {currentQuestionIndex + 1} of {activeQuizQuestions.length}
              </p>
            </div>
          </div>
          <Progress 
            value={((currentQuestionIndex + 1) / activeQuizQuestions.length) * 100} 
            className="w-32 h-2" 
          />
        </div>

        {/* Question */}
        <div className="max-w-2xl mx-auto">
          <div className="p-6 rounded-xl bg-muted/30 border border-border/50 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline">{currentQuestion.difficulty}</Badge>
              <Badge variant="secondary">{currentQuestion.points} pts</Badge>
            </div>
            <p className="text-lg font-medium">{currentQuestion.question}</p>
          </div>

          {/* Options */}
          <div className="space-y-3 mb-6">
            {currentQuestion.options.map((option, index) => {
              let optionClass = "border-border/50 hover:border-primary/50";
              
              if (showResult && currentGradedAnswer) {
                const isCorrect = currentGradedAnswer.correctOptions.includes(option.id);
                const wasSelected = isOptionSelected(option.id);
                
                if (isCorrect) {
                  optionClass = "border-green-500 bg-green-500/10";
                } else if (wasSelected && !isCorrect) {
                  optionClass = "border-red-500 bg-red-500/10";
                }
              } else if (isOptionSelected(option.id)) {
                optionClass = "border-primary bg-primary/10";
              }
              
              return (
                <button
                  key={option.id}
                  onClick={() => toggleOption(option.id)}
                  disabled={showResult}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${optionClass}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-medium ${
                      showResult && currentGradedAnswer?.correctOptions.includes(option.id)
                        ? "border-green-500 text-green-400"
                        : showResult && isOptionSelected(option.id) && !currentGradedAnswer?.correctOptions.includes(option.id)
                        ? "border-red-500 text-red-400"
                        : isOptionSelected(option.id)
                        ? "border-primary text-primary"
                        : "border-border"
                    }`}>
                      {showResult && currentGradedAnswer?.correctOptions.includes(option.id) ? (
                        <Check className="w-4 h-4" />
                      ) : showResult && isOptionSelected(option.id) && !currentGradedAnswer?.correctOptions.includes(option.id) ? (
                        <X className="w-4 h-4" />
                      ) : (
                        String.fromCharCode(65 + index)
                      )}
                    </div>
                    <span>{option.text}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {showResult && currentGradedAnswer && (
            <div className={`p-4 rounded-xl mb-6 ${
              currentGradedAnswer.isCorrect 
                ? "bg-green-500/10 border border-green-500/30" 
                : "bg-amber-500/10 border border-amber-500/30"
            }`}>
              <p className="font-medium mb-1">
                {currentGradedAnswer.isCorrect ? "Correct!" : "Not quite right"}
              </p>
              <p className="text-sm text-muted-foreground">
                {currentGradedAnswer.explanation}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center">
            {!showResult ? (
              <Button onClick={submitAnswer} disabled={selectedOptions.length === 0}>
                Submit Answer
              </Button>
            ) : (
              <Button onClick={nextQuestion} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {currentQuestionIndex < activeQuizQuestions.length - 1 ? "Next Question" : "See Results"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Quiz list view
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Quiz</h1>
          <p className="text-muted-foreground">
            Test your knowledge with AI-generated quizzes
          </p>
        </div>
        <Button onClick={handleGenerateQuiz} disabled={generating}>
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Quiz
            </>
          )}
        </Button>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/50 bg-red-500/10 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-500">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
            Dismiss
          </Button>
        </div>
      )}

      {/* Quizzes Grid */}
      {quizzes.length === 0 ? (
        <div className="text-center py-20">
          <ListTodo className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No quizzes yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Generate quizzes from your completed scenarios to test your knowledge.
          </p>
          <Button onClick={handleGenerateQuiz} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Quiz
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="p-5 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <Badge variant="secondary">{quiz.quizType}</Badge>
                <div className="flex items-center gap-2">
                  {quiz.hasPassed && (
                    <Badge className="bg-green-500/20 text-green-400">Passed</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 h-8 w-8"
                    onClick={(e) => deleteQuiz(quiz.id, e)}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
              <h3 className="font-semibold mb-1">{quiz.title}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {quiz.description || "Test your AWS knowledge"}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    {quiz.questionCount}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    ~{quiz.estimatedMinutes}m
                  </div>
                </div>
                <Button size="sm" onClick={() => startQuiz(quiz)}>
                  {quiz.userAttempts.length > 0 ? "Retry" : "Start"}
                </Button>
              </div>
              {quiz.bestScore !== null && (
                <div className="mt-3 pt-3 border-t border-border/50 text-sm text-muted-foreground">
                  Best: {quiz.bestScore}% • {quiz.userAttempts.length} attempt{quiz.userAttempts.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
