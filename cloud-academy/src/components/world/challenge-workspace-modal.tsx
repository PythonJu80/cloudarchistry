"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  X, 
  Send, 
  Loader2, 
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  HelpCircle,
  MessageCircle,
  PanelRightClose,
  AlertCircle,
  Trophy,
  Clock,
  RotateCcw,
  PenTool,
  Move,
  Square,
  Server,
  Database,
  Cloud,
  Shield,
  ZoomIn,
  ZoomOut,
  Trash2,
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  points: number;
  hints: string[];
  success_criteria: string[];
  aws_services_relevant: string[];
  estimated_time_minutes: number;
}

interface ChallengeWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenge: Challenge;
  scenario: {
    scenario_title: string;
    scenario_description: string;
    business_context: string;
    company_name: string;
  };
  companyInfo: Record<string, unknown>;
  challengeIndex: number;
  totalChallenges: number;
  onNextChallenge?: () => void;
  onPrevChallenge?: () => void;
  apiKey?: string | null;
  preferredModel?: string | null;
  certCode?: string;
  userLevel?: string;
  industry?: string;
  // Database IDs for persistence
  scenarioId?: string;
  attemptId?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface QuestionOption {
  id: string;
  text: string;
  is_correct: boolean;
}

interface ChallengeQuestion {
  id: string;
  question: string;
  question_type: string;
  options: QuestionOption[] | null;
  correct_answer: string;
  explanation: string;
  hint: string | null;
  points: number;
  aws_services: string[];
  difficulty: string;
}

interface ChallengeQuestionsData {
  challenge_id: string;
  challenge_title: string;
  brief: string;
  questions: ChallengeQuestion[];
  total_points: number;
  estimated_time_minutes: number;
}

interface AnswerState {
  selectedOptionId: string | null;
  isSubmitted: boolean;
  isCorrect: boolean | null;
  showExplanation: boolean;
}

export function ChallengeWorkspaceModal({
  isOpen,
  onClose,
  challenge,
  scenario,
  companyInfo,
  challengeIndex,
  totalChallenges,
  onNextChallenge,
  onPrevChallenge,
  apiKey,
  preferredModel,
  certCode,
  userLevel = "intermediate",
  industry,
  attemptId,
}: ChallengeWorkspaceModalProps) {
  // Questions state
  const [questionsData, setQuestionsData] = useState<ChallengeQuestionsData | null>(null);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [earnedPoints, setEarnedPoints] = useState(0);
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Workspace mode: questions or drawing (brief always visible)
  const [workspaceMode, setWorkspaceMode] = useState<"questions" | "drawing">("questions");
  const [selectedTool, setSelectedTool] = useState<"select" | "vpc" | "ec2" | "rds" | "s3" | "lambda">("select");

  // Hint state per question
  const [revealedQuestionHints, setRevealedQuestionHints] = useState<Set<string>>(new Set());

  // Load existing progress from database
  const loadExistingProgress = useCallback(async () => {
    if (!attemptId || !challenge?.id) return null;
    
    try {
      const response = await fetch(
        `/api/challenge/progress?attemptId=${attemptId}&challengeId=${challenge.id}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.exists && data.progress?.solution) {
          return data.progress;
        }
      }
    } catch (err) {
      console.error("Failed to load existing progress:", err);
    }
    return null;
  }, [attemptId, challenge?.id]);

  // Fetch questions when modal opens or challenge changes
  const fetchQuestions = useCallback(async () => {
    if (!challenge?.id) return;
    
    setIsLoadingQuestions(true);
    setQuestionsError(null);
    
    try {
      // First check if we have existing progress with saved questions
      const existingProgress = await loadExistingProgress();
      
      if (existingProgress?.solution?.questionsData?.questions) {
        // Restore from saved progress
        const saved = existingProgress.solution;
        setQuestionsData({
          challenge_id: challenge.id,
          challenge_title: challenge.title,
          brief: saved.questionsData.brief,
          questions: saved.questionsData.questions,
          total_points: saved.questionsData.totalPoints,
          estimated_time_minutes: saved.questionsData.estimatedTimeMinutes,
        });
        
        // Restore answer states
        const restoredAnswers: Record<string, AnswerState> = {};
        saved.questionsData.questions.forEach((q: ChallengeQuestion) => {
          const savedAnswer = saved.answers?.find((a: { questionId: string }) => a.questionId === q.id);
          restoredAnswers[q.id] = {
            selectedOptionId: savedAnswer?.selectedOptionId || null,
            isSubmitted: !!savedAnswer?.selectedOptionId,
            isCorrect: savedAnswer?.isCorrect || null,
            showExplanation: !!savedAnswer?.selectedOptionId,
          };
        });
        setAnswers(restoredAnswers);
        setEarnedPoints(existingProgress.pointsEarned || 0);
        
        // Restore hints used
        const hintsSet = new Set<string>();
        saved.answers?.forEach((a: { questionId: string; hintUsed: boolean }) => {
          if (a.hintUsed) hintsSet.add(a.questionId);
        });
        setRevealedQuestionHints(hintsSet);
        
        setIsLoadingQuestions(false);
        return;
      }
      
      // No saved progress - generate new questions
      const learningAgentUrl = process.env.NEXT_PUBLIC_LEARNING_AGENT_URL || "http://localhost:1027";
      const response = await fetch(`${learningAgentUrl}/api/learning/challenge-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge: {
            id: challenge.id,
            title: challenge.title,
            description: challenge.description,
            hints: challenge.hints,
            success_criteria: challenge.success_criteria,
            aws_services_relevant: challenge.aws_services_relevant,
          },
          company_name: scenario.company_name,
          industry: industry || (companyInfo?.industry as string) || "Technology",
          business_context: scenario.business_context,
          user_level: userLevel,
          cert_code: certCode,
          question_count: 5,
          openai_api_key: apiKey,
          preferred_model: preferredModel,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate questions: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        const newQuestionsData = {
          challenge_id: data.challenge_id,
          challenge_title: data.challenge_title,
          brief: data.brief,
          questions: data.questions,
          total_points: data.total_points,
          estimated_time_minutes: data.estimated_time_minutes,
        };
        setQuestionsData(newQuestionsData);
        
        // Initialize answer states
        const initialAnswers: Record<string, AnswerState> = {};
        data.questions.forEach((q: ChallengeQuestion) => {
          initialAnswers[q.id] = {
            selectedOptionId: null,
            isSubmitted: false,
            isCorrect: null,
            showExplanation: false,
          };
        });
        setAnswers(initialAnswers);
        
        // IMMEDIATELY save the generated questions to the database
        // so they can be retrieved when resuming
        if (attemptId && challenge?.id) {
          try {
            await fetch("/api/challenge/progress", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                attemptId,
                challengeId: challenge.id,
                answers: [], // No answers yet
                totalPointsEarned: 0,
                hintsUsed: 0,
                isComplete: false,
                questionsData: {
                  brief: data.brief,
                  questions: data.questions,
                  totalPoints: data.total_points,
                  estimatedTimeMinutes: data.estimated_time_minutes,
                },
              }),
            });
          } catch (saveErr) {
            console.error("Failed to save generated questions:", saveErr);
          }
        }
      } else {
        throw new Error(data.error || "Failed to generate questions");
      }
    } catch (err) {
      console.error("Failed to fetch questions:", err);
      setQuestionsError(err instanceof Error ? err.message : "Failed to load questions");
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [challenge, scenario, companyInfo, userLevel, certCode, industry, apiKey, preferredModel, loadExistingProgress, attemptId]);

  useEffect(() => {
    if (isOpen && challenge?.id) {
      // Reset state for new challenge
      setQuestionsData(null);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setEarnedPoints(0);
      setRevealedQuestionHints(new Set());
      setMessages([]);
      fetchQuestions();
    }
  }, [isOpen, challenge?.id, fetchQuestions]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isChatOpen]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isChatLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsChatLoading(true);

    try {
      const learningAgentUrl = process.env.NEXT_PUBLIC_LEARNING_AGENT_URL || "http://localhost:1027";
      const response = await fetch(`${learningAgentUrl}/api/learning/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: inputValue.trim(),
          challenge_id: challenge.id,
          context: {
            challenge_title: challenge.title,
            company_name: scenario.company_name,
            business_context: scenario.business_context,
            current_question: questionsData?.questions[currentQuestionIndex]?.question,
          },
          openai_api_key: apiKey,
          preferred_model: preferredModel,
        }),
      });

      const data = await response.json();
      
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.response || "I'm having trouble responding. Please try again.",
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, I couldn't connect to the coaching service. Please try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const selectOption = (questionId: string, optionId: string) => {
    if (answers[questionId]?.isSubmitted) return;
    
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        selectedOptionId: optionId,
      },
    }));
  };

  const submitAnswer = async (question: ChallengeQuestion) => {
    const answer = answers[question.id];
    if (!answer?.selectedOptionId || answer.isSubmitted) return;

    const selectedOption = question.options?.find(o => o.id === answer.selectedOptionId);
    const isCorrect = selectedOption?.is_correct || false;
    const pointsForQuestion = isCorrect ? question.points : 0;

    // Update local state
    const newEarnedPoints = earnedPoints + pointsForQuestion;
    if (isCorrect) {
      setEarnedPoints(newEarnedPoints);
    }

    const updatedAnswers = {
      ...answers,
      [question.id]: {
        ...answers[question.id],
        isSubmitted: true,
        isCorrect,
        showExplanation: true,
      },
    };
    setAnswers(updatedAnswers);

    // Check if all questions are now answered
    const allAnswered = questionsData?.questions.every(q => 
      q.id === question.id ? true : updatedAnswers[q.id]?.isSubmitted
    ) || false;

    // Save progress to database
    if (attemptId && challenge.id) {
      try {
        const answersToSave = questionsData?.questions.map(q => ({
          questionId: q.id,
          selectedOptionId: q.id === question.id 
            ? answer.selectedOptionId 
            : updatedAnswers[q.id]?.selectedOptionId || null,
          isCorrect: q.id === question.id 
            ? isCorrect 
            : updatedAnswers[q.id]?.isCorrect || false,
          pointsEarned: q.id === question.id 
            ? pointsForQuestion 
            : (updatedAnswers[q.id]?.isCorrect ? q.points : 0),
          hintUsed: revealedQuestionHints.has(q.id),
          answeredAt: new Date().toISOString(),
        })).filter(a => a.selectedOptionId !== null) || [];

        await fetch("/api/challenge/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            challengeId: challenge.id,
            answers: answersToSave,
            totalPointsEarned: newEarnedPoints,
            hintsUsed: revealedQuestionHints.size,
            isComplete: allAnswered,
            questionsData: allAnswered ? {
              brief: questionsData?.brief,
              questions: questionsData?.questions,
              totalPoints: questionsData?.total_points,
              estimatedTimeMinutes: questionsData?.estimated_time_minutes,
            } : undefined,
          }),
        });
      } catch (err) {
        console.error("Failed to save progress:", err);
        // Don't block the UI - progress saving is best-effort
      }
    }
  };

  const revealQuestionHint = (questionId: string) => {
    setRevealedQuestionHints(prev => new Set(prev).add(questionId));
  };

  const resetChallenge = () => {
    setCurrentQuestionIndex(0);
    setEarnedPoints(0);
    setRevealedQuestionHints(new Set());
    if (questionsData) {
      const resetAnswers: Record<string, AnswerState> = {};
      questionsData.questions.forEach((q) => {
        resetAnswers[q.id] = {
          selectedOptionId: null,
          isSubmitted: false,
          isCorrect: null,
          showExplanation: false,
        };
      });
      setAnswers(resetAnswers);
    }
  };

  const currentQuestion = questionsData?.questions[currentQuestionIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const allQuestionsAnswered = questionsData?.questions.every(q => answers[q.id]?.isSubmitted) || false;
  const correctCount = Object.values(answers).filter(a => a.isCorrect).length;

  const difficultyColor = {
    beginner: "text-green-400 bg-green-500/20",
    intermediate: "text-amber-400 bg-amber-500/20",
    advanced: "text-orange-400 bg-orange-500/20",
    expert: "text-red-400 bg-red-500/20",
  }[challenge.difficulty] || "text-gray-400 bg-gray-500/20";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-[95vw] w-[1400px] h-[90vh] p-0 gap-0 bg-slate-950 border border-slate-800 overflow-hidden flex flex-col z-[100] [&>button]:hidden"
        aria-describedby={undefined}
      >
        <VisuallyHidden>
          <DialogTitle>{challenge.title} - Challenge Workspace</DialogTitle>
        </VisuallyHidden>
        {/* Header */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{challengeIndex + 1}/{totalChallenges}</span>
              <span className={cn("text-xs px-2 py-0.5 rounded", difficultyColor)}>
                {challenge.difficulty}
              </span>
              {questionsData && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ~{questionsData.estimated_time_minutes} min
                </span>
              )}
            </div>
            <span className="text-sm font-medium text-slate-200">{challenge.title}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-cyan-500/10 border border-cyan-500/30">
              <Trophy className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-cyan-400">{earnedPoints}</span>
              <span className="text-xs text-slate-500">/ {questionsData?.total_points || challenge.points} pts</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={onPrevChallenge} disabled={challengeIndex === 0} className="h-8 w-8">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onNextChallenge} disabled={challengeIndex === totalChallenges - 1} className="h-8 w-8">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main workspace area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main content area - Brief always visible, then Questions OR Drawing */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Loading State */}
            {isLoadingQuestions && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-cyan-400" />
                  <p className="text-sm text-slate-400">Generating challenge questions...</p>
                  <p className="text-xs text-slate-500 mt-1">Tailoring to {scenario.company_name}</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {questionsError && (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
                  <p className="text-sm text-red-400 mb-4">{questionsError}</p>
                  <Button onClick={fetchQuestions} variant="outline" className="gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {/* Questions Content */}
            {questionsData && !isLoadingQuestions && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Brief Section - Always Visible */}
                <div className="shrink-0 border-b border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-slate-300">Challenge Brief</h3>
                      <div className="flex gap-1">
                        {challenge.aws_services_relevant.slice(0, 4).map((service, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 text-[10px]">
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>
                    {/* Mode Toggle */}
                    <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
                      <Button
                        variant={workspaceMode === "questions" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 px-3 text-xs gap-1.5"
                        onClick={() => setWorkspaceMode("questions")}
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        Questions
                      </Button>
                      <Button
                        variant={workspaceMode === "drawing" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 px-3 text-xs gap-1.5"
                        onClick={() => setWorkspaceMode("drawing")}
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        Drawing
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">
                    {questionsData.brief}
                  </p>
                </div>

                {/* QUESTIONS MODE */}
                {workspaceMode === "questions" && (
                  <>
                    {/* Question Progress */}
                    <div className="shrink-0 px-4 py-2 border-b border-slate-800 bg-slate-900/30">
                  <div className="flex items-center gap-2">
                    {questionsData.questions.map((q, i) => (
                      <button
                        key={q.id}
                        onClick={() => setCurrentQuestionIndex(i)}
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                          i === currentQuestionIndex && "ring-2 ring-cyan-400",
                          answers[q.id]?.isSubmitted
                            ? answers[q.id]?.isCorrect
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                            : i === currentQuestionIndex
                              ? "bg-cyan-500/20 text-cyan-400"
                              : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                        )}
                      >
                        {answers[q.id]?.isSubmitted ? (
                          answers[q.id]?.isCorrect ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <X className="w-4 h-4" />
                          )
                        ) : (
                          i + 1
                        )}
                      </button>
                    ))}
                    <span className="ml-auto text-xs text-slate-500">
                      {correctCount}/{questionsData.questions.length} correct
                    </span>
                  </div>
                </div>

                {/* Current Question */}
                {currentQuestion && (
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-2xl mx-auto">
                      {/* Question Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            {currentQuestion.question_type.replace("_", " ")}
                          </span>
                          <span className="text-xs text-cyan-400">+{currentQuestion.points} pts</span>
                        </div>
                        {currentQuestion.aws_services.length > 0 && (
                          <div className="flex gap-1">
                            {currentQuestion.aws_services.map((svc, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">
                                {svc}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Question Text */}
                      <p className="text-lg text-slate-200 mb-6 leading-relaxed">
                        {currentQuestion.question}
                      </p>

                      {/* Options */}
                      {currentQuestion.options && (
                        <div className="space-y-3 mb-6">
                          {currentQuestion.options.map((option) => {
                            const isSelected = currentAnswer?.selectedOptionId === option.id;
                            const isSubmitted = currentAnswer?.isSubmitted;
                            const showCorrect = isSubmitted && option.is_correct;
                            const showWrong = isSubmitted && isSelected && !option.is_correct;

                            return (
                              <button
                                key={option.id}
                                onClick={() => selectOption(currentQuestion.id, option.id)}
                                disabled={isSubmitted}
                                className={cn(
                                  "w-full text-left p-4 rounded-lg border transition-all",
                                  !isSubmitted && isSelected && "border-cyan-500 bg-cyan-500/10",
                                  !isSubmitted && !isSelected && "border-slate-700 bg-slate-800/50 hover:border-slate-600",
                                  showCorrect && "border-green-500 bg-green-500/10",
                                  showWrong && "border-red-500 bg-red-500/10",
                                  isSubmitted && !showCorrect && !showWrong && "border-slate-700 bg-slate-800/30 opacity-50"
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={cn(
                                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                                    !isSubmitted && isSelected && "border-cyan-500 bg-cyan-500",
                                    !isSubmitted && !isSelected && "border-slate-600",
                                    showCorrect && "border-green-500 bg-green-500",
                                    showWrong && "border-red-500 bg-red-500"
                                  )}>
                                    {(isSelected || showCorrect) && (
                                      showWrong ? (
                                        <X className="w-3 h-3 text-white" />
                                      ) : (
                                        <CheckCircle2 className="w-3 h-3 text-white" />
                                      )
                                    )}
                                  </div>
                                  <span className={cn(
                                    "text-sm",
                                    showCorrect && "text-green-400",
                                    showWrong && "text-red-400",
                                    !showCorrect && !showWrong && "text-slate-300"
                                  )}>
                                    {option.text}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Hint */}
                      {currentQuestion.hint && !currentAnswer?.isSubmitted && (
                        <div className="mb-4">
                          {revealedQuestionHints.has(currentQuestion.id) ? (
                            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                              <div className="flex items-center gap-2 mb-1">
                                <Lightbulb className="w-4 h-4 text-amber-400" />
                                <span className="text-xs font-medium text-amber-400">Hint</span>
                              </div>
                              <p className="text-sm text-amber-200">{currentQuestion.hint}</p>
                            </div>
                          ) : (
                            <button
                              onClick={() => revealQuestionHint(currentQuestion.id)}
                              className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300"
                            >
                              <Lightbulb className="w-3 h-3" />
                              Need a hint?
                            </button>
                          )}
                        </div>
                      )}

                      {/* Submit / Explanation */}
                      {!currentAnswer?.isSubmitted ? (
                        <Button
                          onClick={() => submitAnswer(currentQuestion)}
                          disabled={!currentAnswer?.selectedOptionId}
                          className="w-full bg-cyan-500 hover:bg-cyan-600"
                        >
                          Submit Answer
                        </Button>
                      ) : (
                        <div className="space-y-4">
                          {/* Explanation */}
                          <div className={cn(
                            "p-4 rounded-lg border",
                            currentAnswer.isCorrect
                              ? "bg-green-500/10 border-green-500/30"
                              : "bg-red-500/10 border-red-500/30"
                          )}>
                            <div className="flex items-center gap-2 mb-2">
                              {currentAnswer.isCorrect ? (
                                <>
                                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                                  <span className="font-medium text-green-400">Correct! +{currentQuestion.points} pts</span>
                                </>
                              ) : (
                                <>
                                  <X className="w-5 h-5 text-red-400" />
                                  <span className="font-medium text-red-400">Incorrect</span>
                                </>
                              )}
                            </div>
                            <p className="text-sm text-slate-300">{currentQuestion.explanation}</p>
                          </div>

                          {/* Next Question */}
                          {currentQuestionIndex < questionsData.questions.length - 1 ? (
                            <Button
                              onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                              className="w-full"
                              variant="outline"
                            >
                              Next Question
                              <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                          ) : allQuestionsAnswered && (
                            <div className="text-center p-6 rounded-lg bg-slate-800/50 border border-slate-700">
                              <Trophy className="w-12 h-12 mx-auto mb-3 text-amber-400" />
                              <h3 className="text-lg font-medium text-slate-200 mb-1">Challenge Complete!</h3>
                              <p className="text-sm text-slate-400 mb-4">
                                You scored {earnedPoints} out of {questionsData.total_points} points
                                ({correctCount}/{questionsData.questions.length} correct)
                              </p>
                              <div className="flex gap-3 justify-center">
                                <Button variant="outline" onClick={resetChallenge} className="gap-2">
                                  <RotateCcw className="w-4 h-4" />
                                  Try Again
                                </Button>
                                {onNextChallenge && challengeIndex < totalChallenges - 1 && (
                                  <Button onClick={onNextChallenge} className="gap-2 bg-cyan-500 hover:bg-cyan-600">
                                    Next Challenge
                                    <ChevronRight className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                  </>
                )}

                {/* DRAWING MODE */}
                {workspaceMode === "drawing" && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Drawing Toolbar */}
                    <div className="shrink-0 flex items-center gap-1 p-2 border-b border-slate-800 bg-slate-950/50">
                      <Button
                        variant={selectedTool === "select" ? "secondary" : "ghost"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedTool("select")}
                        title="Select & Move"
                      >
                        <Move className="w-4 h-4" />
                      </Button>
                      <div className="w-px h-6 bg-slate-700 mx-1" />
                      <Button
                        variant={selectedTool === "vpc" ? "secondary" : "ghost"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedTool("vpc")}
                        title="VPC"
                      >
                        <Square className="w-4 h-4 text-purple-400" />
                      </Button>
                      <Button
                        variant={selectedTool === "ec2" ? "secondary" : "ghost"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedTool("ec2")}
                        title="EC2 Instance"
                      >
                        <Server className="w-4 h-4 text-orange-400" />
                      </Button>
                      <Button
                        variant={selectedTool === "rds" ? "secondary" : "ghost"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedTool("rds")}
                        title="RDS Database"
                      >
                        <Database className="w-4 h-4 text-blue-400" />
                      </Button>
                      <Button
                        variant={selectedTool === "s3" ? "secondary" : "ghost"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedTool("s3")}
                        title="S3 Bucket"
                      >
                        <Cloud className="w-4 h-4 text-green-400" />
                      </Button>
                      <Button
                        variant={selectedTool === "lambda" ? "secondary" : "ghost"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedTool("lambda")}
                        title="Lambda Function"
                      >
                        <Globe className="w-4 h-4 text-amber-400" />
                      </Button>
                      <div className="flex-1" />
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Zoom In">
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Zoom Out">
                        <ZoomOut className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" title="Clear Canvas">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Canvas Area */}
                    <div className="flex-1 relative bg-slate-950 overflow-hidden">
                      {/* Grid background */}
                      <div 
                        className="absolute inset-0 opacity-20"
                        style={{
                          backgroundImage: `
                            linear-gradient(to right, #334155 1px, transparent 1px),
                            linear-gradient(to bottom, #334155 1px, transparent 1px)
                          `,
                          backgroundSize: "20px 20px",
                        }}
                      />
                      
                      {/* Canvas placeholder */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-slate-500">
                          <Shield className="w-16 h-16 mx-auto mb-4 opacity-30" />
                          <p className="text-lg font-medium mb-2">Architecture Canvas</p>
                          <p className="text-sm">Design your solution by dragging AWS components</p>
                          <p className="text-xs mt-2 text-slate-600">Use the toolbar above to add services</p>
                        </div>
                      </div>
                    </div>

                    {/* Relevant Services Footer */}
                    <div className="shrink-0 p-3 border-t border-slate-800 bg-slate-900/50">
                      <p className="text-xs text-slate-500 mb-2">Suggested services for this challenge:</p>
                      <div className="flex flex-wrap gap-2">
                        {challenge.aws_services_relevant?.map((service, i) => (
                          <span key={i} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer transition-colors">
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right side - Collapsible Chat */}
          <div className={cn(
            "flex flex-col border-l border-slate-800 transition-all duration-300 overflow-hidden",
            isChatOpen ? "w-[340px] bg-slate-900" : "w-12 bg-slate-950"
          )}>
            {/* Chat toggle / header */}
            <div className="h-12 flex items-center justify-between px-3 border-b border-slate-800 shrink-0">
              {isChatOpen ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-medium">Sophia</span>
                    <span className="text-xs text-slate-500">AI Coach</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsChatOpen(false)}>
                    <PanelRightClose className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 mx-auto"
                  onClick={() => setIsChatOpen(true)}
                >
                  <MessageCircle className="w-5 h-5 text-cyan-400" />
                </Button>
              )}
            </div>

            {/* Chat content */}
            {isChatOpen && (
              <>
                <div className="flex-1 p-3 overflow-y-auto">
                  {messages.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">Need help?</p>
                      <p className="text-xs mt-1">Ask me anything about this challenge!</p>
                      <div className="mt-4 space-y-2">
                        {["Explain this question", "What AWS services should I use?", "Give me a hint"].map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => {
                              setInputValue(suggestion);
                              setTimeout(() => sendMessage(), 100);
                            }}
                            className="block w-full text-xs px-3 py-2 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((msg, i) => (
                        <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                            msg.role === "user" ? "bg-cyan-500/20 text-cyan-100" : "bg-slate-800 text-slate-200"
                          )}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {isChatLoading && (
                        <div className="flex justify-start">
                          <div className="bg-slate-800 rounded-lg px-3 py-2">
                            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-slate-800 shrink-0">
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      placeholder="Ask Sophia..."
                      className="h-9 text-sm bg-slate-800 border-slate-700"
                    />
                    <Button
                      size="icon"
                      onClick={sendMessage}
                      disabled={!inputValue.trim() || isChatLoading}
                      className="h-9 w-9 bg-cyan-500 hover:bg-cyan-600"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
