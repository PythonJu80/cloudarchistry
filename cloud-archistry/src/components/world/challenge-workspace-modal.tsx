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
  ChevronRight,
  Lightbulb,
  HelpCircle,
  MessageCircle,
  AlertCircle,
  Trophy,
  Clock,
  RotateCcw,
  PenTool,
  Sparkles,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import type { DiagramData, AuditResult } from "@/components/diagram";
import { Terminal } from "lucide-react";
import { createInitialScore, type DiagramScore } from "@/lib/aws-placement-rules";

// Dynamically import CLISimulator (AI-powered sandbox terminal)
const CLISimulator = dynamic(
  () => import("@/components/diagram").then((mod) => mod.CLISimulator),
  { 
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      </div>
    ),
  }
);

// Dynamically import DiagramCanvas to avoid SSR issues with React Flow
const DiagramCanvas = dynamic(
  () => import("@/components/diagram").then((mod) => mod.DiagramCanvas),
  { 
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="text-center text-slate-500">
          <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
          <p className="text-sm">Loading diagram canvas...</p>
        </div>
      </div>
    ),
  }
);

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
  const [isChatOpen] = useState(true); // Chat always available in workspace mode
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Workspace mode: 4 stages - questions, drawing, chat, cli
  const [workspaceMode, setWorkspaceMode] = useState<"questions" | "drawing" | "chat" | "cli">("questions");
  
  // Stage completion tracking
  const [hasChatCompleted, setHasChatCompleted] = useState(false);
  const [hasCLICompleted, setHasCLICompleted] = useState(false);
  
  // Proficiency Test state
  const [proficiencyTestId, setProficiencyTestId] = useState<string | null>(null);
  const [proficiencyQuestionsAsked, setProficiencyQuestionsAsked] = useState(0);
  const [proficiencyReadyToEvaluate, setProficiencyReadyToEvaluate] = useState(false);
  const [proficiencyResult, setProficiencyResult] = useState<{
    score: number;
    summary: string;
    strengths: string[];
    areasForImprovement: string[];
  } | null>(null);
  const [isProficiencyStarted, setIsProficiencyStarted] = useState(false);
  
  // CLI Objectives state
  const [cliObjectives, setCliObjectives] = useState<Array<{
    id: string;
    description: string;
    command_pattern: string;
    example_command: string;
    hint?: string;
    points: number;
    service: string;
    completed: boolean;
  }>>([]);
  const [cliContextMessage, setCliContextMessage] = useState<string>("");
  const [cliTotalPoints, setCliTotalPoints] = useState(0);
  const [cliEarnedPoints, setCliEarnedPoints] = useState(0);
  
  // AWS Console mock data for CLI page
  const [consoleData, setConsoleData] = useState<{
    account_id: string;
    account_alias: string;
    region: string;
    recently_visited: Array<{ name: string; color: string; abbr: string }>;
    resource_counts: Record<string, number>;
    cost_current_month: number;
    cost_forecast: number;
    cost_trend: number[];
    health_open_issues: number;
    health_scheduled_changes: number;
  } | null>(null);
  
  // Diagram state
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
  const [diagramSessionId, setDiagramSessionId] = useState<string | undefined>();
  const [lastAuditResult, setLastAuditResult] = useState<AuditResult | null>(null);
  const [challengeProgressId, setChallengeProgressId] = useState<string | null>(null);
  const [diagramScore, setDiagramScore] = useState<DiagramScore>(createInitialScore());
  

  // Hint state per question
  const [revealedQuestionHints, setRevealedQuestionHints] = useState<Set<string>>(new Set());

  // Drawing audit pass state
  const [hasDrawingPassed, setHasDrawingPassed] = useState(false);
  const [showDrawingCelebration, setShowDrawingCelebration] = useState(false);
  const AUDIT_PASS_THRESHOLD = 70; // Minimum audit score to pass drawing

  // Load existing progress from database
  const loadExistingProgress = useCallback(async () => {
    if (!attemptId || !challenge?.id) return null;
    
    try {
      const response = await fetch(
        `/api/challenge/progress?attemptId=${attemptId}&challengeId=${challenge.id}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.exists && data.progress) {
          const progress = data.progress;
          // Store the progress ID for tip jar functionality
          if (progress.id) {
            setChallengeProgressId(progress.id);
          }
          
          const solutionData = progress.solution;
          const savedDiagramScore = solutionData?.diagramScore || progress.diagramScore || null;
          const savedDiagramData = solutionData?.diagramData || progress.diagramData || null;
          const savedAuditPassed = solutionData?.auditPassed || false;

          if (savedDiagramScore) {
            setDiagramScore(savedDiagramScore);
          }
          if (savedDiagramData) {
            setDiagramData(savedDiagramData);
          }
          if (savedAuditPassed) {
            setHasDrawingPassed(true);
          }

          if (solutionData) {
            return progress;
          }
        }
      }
    } catch (err) {
      console.error("Failed to load existing progress:", err);
    }
    return null;
  }, [attemptId, challenge?.id, setChallengeProgressId, setDiagramScore, setDiagramData]);

  // Fetch questions when modal opens or challenge changes
  const fetchQuestions = useCallback(async () => {
    if (!challenge?.id) return;
    
    setIsLoadingQuestions(true);
    setQuestionsError(null);
    
    try {
      // First check the challenge status - if locked, show error
      const statusResponse = await fetch(
        `/api/challenge/progress?attemptId=${attemptId}&challengeId=${challenge.id}`
      );
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.exists && statusData.progress?.status === "locked") {
          setQuestionsError("This challenge is locked. Complete the previous challenge first.");
          setIsLoadingQuestions(false);
          return;
        }
      }
      
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
        
        // Restore diagram data/score if present
        if (saved.diagramData || existingProgress.diagramData) {
          setDiagramData(saved.diagramData || existingProgress.diagramData);
        }
        if (saved.diagramScore || existingProgress.diagramScore) {
          setDiagramScore(saved.diagramScore || existingProgress.diagramScore);
        }
        
        setIsLoadingQuestions(false);
        return;
      }
      
      // No saved progress - generate new questions via Next.js proxy
      const response = await fetch('/api/challenge/questions', {
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
          question_count: 10,
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
            const saveResponse = await fetch("/api/challenge/progress", {
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
            if (!saveResponse.ok) {
              console.error("Failed to save questions - response not ok:", await saveResponse.text());
            }
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
  }, [challenge, scenario, companyInfo, userLevel, certCode, industry, attemptId, challengeProgressId, loadExistingProgress]);

  useEffect(() => {
    if (isOpen && challenge?.id) {
      // Reset state for new challenge
      setQuestionsData(null);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setEarnedPoints(0);
      setRevealedQuestionHints(new Set());
      setMessages([]);
      setChallengeProgressId(null);
      setDiagramData(null);
      setDiagramScore(createInitialScore());
      setHasDrawingPassed(false);
      setShowDrawingCelebration(false);
      setLastAuditResult(null);
      setHasChatCompleted(false);
      setHasCLICompleted(false);
      setWorkspaceMode("questions");
      setConsoleData(null);
      // Reset proficiency test state
      setProficiencyTestId(null);
      setProficiencyQuestionsAsked(0);
      setProficiencyReadyToEvaluate(false);
      setProficiencyResult(null);
      setIsProficiencyStarted(false);
      // Reset CLI objectives state
      setCliObjectives([]);
      setCliContextMessage("");
      setCliTotalPoints(0);
      setCliEarnedPoints(0);
      fetchQuestions();
      fetchConsoleData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, challenge?.id]);

  // Fetch AWS console mock data for CLI page
  const fetchConsoleData = useCallback(async () => {
    if (!challenge?.id || !scenario?.company_name) return;
    
    try {
      const response = await fetch("/api/console/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          challengeTitle: challenge.title,
          challengeDescription: challenge.description,
          awsServices: challenge.aws_services_relevant,
          successCriteria: challenge.success_criteria,
          companyName: scenario.company_name,
          industry: industry || companyInfo?.industry || "Technology",
          businessContext: scenario.business_context,
          region: "eu-west-2",
          openaiApiKey: apiKey,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.console_data) {
          setConsoleData(data.console_data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch console data:", err);
    }
  }, [challenge, scenario, industry, companyInfo, apiKey]);

  // Start proficiency test - agent initiates conversation about user's work
  const startProficiencyTest = useCallback(async () => {
    if (!challenge?.id || !scenario?.company_name || isProficiencyStarted) return;
    
    setIsChatLoading(true);
    setIsProficiencyStarted(true);
    
    try {
      // Extract services from diagram
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const diagramServices = (diagramData?.nodes as any[])
        ?.filter((n) => !["vpc", "subnet", "availabilityZone"].includes(n.type))
        .map((n) => n.data?.label)
        .filter(Boolean) || [];
      
      const response = await fetch("/api/proficiency-test/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          challengeTitle: challenge.title,
          challengeDescription: challenge.description,
          challengeBrief: questionsData?.brief || "",
          successCriteria: challenge.success_criteria,
          awsServices: challenge.aws_services_relevant,
          diagramData: diagramData,
          diagramServices: diagramServices,
          questionAnswers: Object.entries(answers).map(([qId, ans]) => ({
            questionId: qId,
            isCorrect: ans.isCorrect,
          })),
          companyName: scenario.company_name,
          industry: industry || companyInfo?.industry || "Technology",
          businessContext: scenario.business_context,
          userLevel: "intermediate",
          // Pass existing chat history so agent can consider it in the proficiency test
          previousChatHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
          })),
          openaiApiKey: apiKey,
          preferredModel: preferredModel,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProficiencyTestId(data.test_id);
          setProficiencyQuestionsAsked(data.questions_asked || 1);
          
          // Add agent's initial message - preserve existing chat history
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: data.initial_message,
            timestamp: new Date(),
          };
          // Keep existing messages and add the proficiency test start message
          setMessages(prev => [...prev, assistantMessage]);
        }
      }
    } catch (err) {
      console.error("Failed to start proficiency test:", err);
    } finally {
      setIsChatLoading(false);
    }
  }, [challenge, scenario, industry, companyInfo, apiKey, preferredModel, diagramData, questionsData, answers, isProficiencyStarted]);

  // Continue proficiency test conversation
  const sendProficiencyMessage = useCallback(async () => {
    if (!inputValue.trim() || isChatLoading || !isProficiencyStarted) return;
    
    const userMessage: ChatMessage = {
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsChatLoading(true);
    
    try {
      // Extract services from diagram
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const diagramServices = (diagramData?.nodes as any[])
        ?.filter((n) => !["vpc", "subnet", "availabilityZone"].includes(n.type))
        .map((n) => n.data?.label)
        .filter(Boolean) || [];
      
      const response = await fetch("/api/proficiency-test/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          challengeTitle: challenge.title,
          challengeDescription: challenge.description,
          challengeBrief: questionsData?.brief || "",
          successCriteria: challenge.success_criteria,
          awsServices: challenge.aws_services_relevant,
          diagramData: diagramData,
          diagramServices: diagramServices,
          companyName: scenario.company_name,
          industry: industry || companyInfo?.industry || "Technology",
          businessContext: scenario.business_context,
          userLevel: "intermediate",
          chatHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
          })),
          userMessage: inputValue.trim(),
          questionsAsked: proficiencyQuestionsAsked,
          openaiApiKey: apiKey,
          preferredModel: preferredModel,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProficiencyQuestionsAsked(data.questions_asked);
          setProficiencyReadyToEvaluate(data.ready_to_evaluate);
          
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: data.agent_response,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          
          // If ready to evaluate, trigger evaluation
          if (data.ready_to_evaluate) {
            evaluateProficiencyTest();
          }
        }
      }
    } catch (err) {
      console.error("Failed to continue proficiency test:", err);
    } finally {
      setIsChatLoading(false);
    }
  }, [inputValue, isChatLoading, isProficiencyStarted, challenge, scenario, industry, companyInfo, apiKey, preferredModel, diagramData, questionsData, messages, proficiencyQuestionsAsked]);

  // Evaluate proficiency test and get final score
  const evaluateProficiencyTest = useCallback(async () => {
    if (!challenge?.id || !scenario?.company_name) return;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const diagramServices = (diagramData?.nodes as any[])
        ?.filter((n) => !["vpc", "subnet", "availabilityZone"].includes(n.type))
        .map((n) => n.data?.label)
        .filter(Boolean) || [];
      
      const response = await fetch("/api/proficiency-test/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          challengeTitle: challenge.title,
          successCriteria: challenge.success_criteria,
          awsServices: challenge.aws_services_relevant,
          diagramServices: diagramServices,
          companyName: scenario.company_name,
          industry: industry || companyInfo?.industry || "Technology",
          chatHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
          })),
          openaiApiKey: apiKey,
          preferredModel: preferredModel,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProficiencyResult({
            score: data.score,
            summary: data.summary,
            strengths: data.strengths || [],
            areasForImprovement: data.areas_for_improvement || [],
          });
          
          // Mark chat as completed if score >= 70
          if (data.score >= 70) {
            setHasChatCompleted(true);
          }
        }
      }
    } catch (err) {
      console.error("Failed to evaluate proficiency test:", err);
    }
  }, [challenge, scenario, industry, companyInfo, apiKey, preferredModel, diagramData, messages]);

  // Fetch CLI objectives for the challenge
  const fetchCliObjectives = useCallback(async () => {
    if (!challenge?.id || !scenario?.company_name || cliObjectives.length > 0) return;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const diagramServices = (diagramData?.nodes as any[])
        ?.filter((n) => !["vpc", "subnet", "availabilityZone"].includes(n.type))
        .map((n) => n.data?.label)
        .filter(Boolean) || [];
      
      const response = await fetch("/api/cli-objectives/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          challengeTitle: challenge.title,
          challengeDescription: challenge.description,
          successCriteria: challenge.success_criteria,
          awsServicesRelevant: challenge.aws_services_relevant,
          companyName: scenario.company_name,
          industry: industry || companyInfo?.industry || "Technology",
          businessContext: scenario.business_context,
          diagramData: diagramData,
          diagramServices: diagramServices,
          userLevel: "intermediate",
          objectiveCount: 3,
          openaiApiKey: apiKey,
          preferredModel: preferredModel,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCliObjectives(data.objectives.map((obj: { id: string; description: string; command_pattern: string; example_command: string; hint?: string; points: number; service: string }) => ({
            ...obj,
            completed: false,
          })));
          setCliContextMessage(data.context_message);
          setCliTotalPoints(data.total_points);
        }
      }
    } catch (err) {
      console.error("Failed to fetch CLI objectives:", err);
    }
  }, [challenge, scenario, industry, companyInfo, apiKey, preferredModel, diagramData, cliObjectives.length]);

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
      // Extract services from diagram for full context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const diagramServices = (diagramData?.nodes as any[])
        ?.filter((n) => !["vpc", "subnet", "availabilityZone"].includes(n.type))
        .map((n) => n.data?.label)
        .filter(Boolean) || [];

      const response = await fetch('/api/chat', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: inputValue.trim(),
          challenge_id: challenge.id,
          context: {
            // Challenge details
            challenge_title: challenge.title,
            challenge_description: challenge.description,
            challenge_brief: questionsData?.brief || "",
            success_criteria: challenge.success_criteria,
            aws_services_relevant: challenge.aws_services_relevant,
            // Business context
            company_name: scenario.company_name,
            industry: industry || companyInfo?.industry || "Technology",
            business_context: scenario.business_context,
            // User context
            user_level: userLevel,
            // User's current work
            diagram_services: diagramServices,
            diagram_node_count: diagramData?.nodes?.length || 0,
            questions_answered: Object.values(answers).filter(a => a.isSubmitted).length,
            questions_total: questionsData?.questions?.length || 0,
            current_question: questionsData?.questions[currentQuestionIndex]?.question,
            // Scores
            drawing_passed: hasDrawingPassed,
            last_audit_score: lastAuditResult?.score,
          },
          chat_history: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
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

        // Check if challenge should be marked complete:
        // All 4 stages: questions + drawing + chat + CLI
        const shouldComplete = allAnswered && hasDrawingPassed && hasChatCompleted && hasCLICompleted;
        
        await fetch("/api/challenge/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            challengeId: challenge.id,
            answers: answersToSave,
            totalPointsEarned: newEarnedPoints,
            hintsUsed: revealedQuestionHints.size,
            isComplete: shouldComplete,
            diagramData: diagramData,
            diagramScore: diagramScore,
            questionsData: allAnswered ? {
              brief: questionsData?.brief,
              questions: questionsData?.questions,
              totalPoints: questionsData?.total_points,
              estimatedTimeMinutes: questionsData?.estimated_time_minutes,
            } : undefined,
            // Proficiency test results
            proficiencyTest: proficiencyResult ? {
              chatHistory: messages.map(m => ({
                role: m.role,
                content: m.content,
                timestamp: m.timestamp.toISOString(),
              })),
              score: proficiencyResult.score,
              summary: proficiencyResult.summary,
              strengths: proficiencyResult.strengths,
              areasForImprovement: proficiencyResult.areasForImprovement,
              completedAt: new Date().toISOString(),
            } : undefined,
            // CLI test results
            cliTest: cliObjectives.length > 0 ? {
              objectives: cliObjectives,
              completedObjectives: cliObjectives.filter(o => o.completed).length,
              totalObjectives: cliObjectives.length,
              score: cliObjectives.length > 0 
                ? Math.round((cliObjectives.filter(o => o.completed).length / cliObjectives.length) * 100)
                : 0,
              earnedPoints: cliEarnedPoints,
              totalPoints: cliTotalPoints,
              completedAt: hasCLICompleted ? new Date().toISOString() : undefined,
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

  // User level color indicator
  const userLevelColor = {
    beginner: "text-green-400 bg-green-500/20",
    intermediate: "text-amber-400 bg-amber-500/20",
    advanced: "text-orange-400 bg-orange-500/20",
    expert: "text-red-400 bg-red-500/20",
  }[userLevel] || "text-amber-400 bg-amber-500/20";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="!grid-cols-1 !max-w-none !w-[calc(100vw-2rem)] !h-[calc(100vh-2rem)] !top-4 !left-4 !translate-x-0 !translate-y-0 p-0 gap-0 bg-slate-950 border border-slate-800 overflow-hidden !flex !flex-col z-[100] [&>button]:hidden"
        aria-describedby={undefined}
      >
        <VisuallyHidden>
          <DialogTitle>{challenge.title} - Challenge Workspace</DialogTitle>
        </VisuallyHidden>
        {/* Header */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900 shrink-0 w-full">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon-sm" onClick={onClose} className="shrink-0">
              <X className="w-4 h-4" />
            </Button>
            <span className={cn("text-xs px-2 py-0.5 rounded shrink-0", userLevelColor)}>
              {userLevel}
            </span>
            {questionsData && (
              <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" />
                ~{questionsData.estimated_time_minutes} min
              </span>
            )}
            <span className="text-sm font-medium text-slate-200 truncate">{challenge.title}</span>
          </div>
          
          {/* Mode Toggle - 4 Stages in Header */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            <Button
              variant={workspaceMode === "questions" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-7 px-3 text-xs gap-1.5",
                allQuestionsAnswered && "text-green-400"
              )}
              onClick={() => setWorkspaceMode("questions")}
            >
              {allQuestionsAnswered ? <CheckCircle2 className="w-3.5 h-3.5" /> : <HelpCircle className="w-3.5 h-3.5" />}
              Questions
            </Button>
            <Button
              variant={workspaceMode === "drawing" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-7 px-3 text-xs gap-1.5",
                hasDrawingPassed && "text-green-400"
              )}
              onClick={() => setWorkspaceMode("drawing")}
            >
              {hasDrawingPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <PenTool className="w-3.5 h-3.5" />}
              Drawing
            </Button>
            <Button
              variant={workspaceMode === "chat" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-7 px-3 text-xs gap-1.5",
                hasChatCompleted && "text-green-400"
              )}
              onClick={() => setWorkspaceMode("chat")}
            >
              {hasChatCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <MessageCircle className="w-3.5 h-3.5" />}
              Chat
            </Button>
            <Button
              variant={workspaceMode === "cli" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-7 px-3 text-xs gap-1.5",
                hasCLICompleted && "text-green-400"
              )}
              onClick={() => setWorkspaceMode("cli")}
            >
              {hasCLICompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Terminal className="w-3.5 h-3.5" />}
              CLI
            </Button>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-cyan-500/10 border border-cyan-500/30">
              <Trophy className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-sm font-medium text-cyan-400">{earnedPoints}</span>
              <span className="text-xs text-slate-500">/ {questionsData?.total_points || challenge.points} pts</span>
            </div>
            {lastAuditResult && (
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium shrink-0",
                  lastAuditResult.score >= 80
                    ? "border-green-500/50 bg-green-500/10 text-green-300"
                    : lastAuditResult.score >= 50
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                      : "border-red-500/50 bg-red-500/10 text-red-300"
                )}
                title="Latest diagram audit score"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {lastAuditResult.score}/100
              </div>
            )}
          </div>
        </div>

        {/* Main workspace area */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Main content area - Brief always visible, then Questions OR Drawing */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
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
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Brief Section - Always Visible */}
                <div className="shrink-0 border-b border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-medium text-slate-300">Challenge Brief</h3>
                    <div className="flex gap-1">
                      {challenge.aws_services_relevant.slice(0, 6).map((service, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 text-[10px]">
                          {service}
                        </span>
                      ))}
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
                  <div className="flex-1 overflow-y-auto p-3">
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
                      <p className="text-base text-slate-200 mb-4 leading-relaxed">
                        {currentQuestion.question}
                      </p>

                      {/* Options */}
                      {currentQuestion.options && (
                        <div className="space-y-2 mb-4">
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
                                  "w-full text-left px-3 py-2.5 rounded-lg border transition-all",
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
                        <div className="space-y-3">
                          {/* Explanation */}
                          <div className={cn(
                            "p-3 rounded-lg border",
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

                {/* DRAWING MODE - Full React Flow Diagram Canvas */}
                {workspaceMode === "drawing" && (
                  <div className="flex-1 overflow-hidden relative">
                    {/* Drawing Pass Celebration Overlay */}
                    {showDrawingCelebration && (
                      <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
                        <div className="text-center max-w-md p-8 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-green-500/30 shadow-2xl">
                          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center animate-pulse">
                            <Trophy className="w-12 h-12 text-white" />
                          </div>
                          <h3 className="text-2xl font-bold text-white mb-2">🎉 Drawing Passed!</h3>
                          <p className="text-lg text-green-400 font-medium mb-4">
                            Score: {lastAuditResult?.score}/100
                          </p>
                          <p className="text-sm text-slate-400 mb-6">
                            {allQuestionsAnswered 
                              ? "All questions answered! Challenge complete! 🚀"
                              : `Complete ${questionsData?.questions.filter(q => !answers[q.id]?.isSubmitted).length || 0} more question${(questionsData?.questions.filter(q => !answers[q.id]?.isSubmitted).length || 0) === 1 ? '' : 's'} to finish this challenge.`
                            }
                          </p>
                          <div className="flex gap-3 justify-center">
                            <Button 
                              variant="outline" 
                              onClick={() => setShowDrawingCelebration(false)}
                              className="gap-2"
                            >
                              Continue Drawing
                            </Button>
                            {!allQuestionsAnswered && (
                              <Button 
                                onClick={() => {
                                  setShowDrawingCelebration(false);
                                  setWorkspaceMode("questions");
                                }}
                                className="gap-2 bg-cyan-500 hover:bg-cyan-600"
                              >
                                Answer Questions
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            )}
                            {allQuestionsAnswered && onNextChallenge && challengeIndex < totalChallenges - 1 && (
                              <Button 
                                onClick={onNextChallenge}
                                className="gap-2 bg-green-500 hover:bg-green-600"
                              >
                                Next Challenge
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <DiagramCanvas
                      initialData={diagramData || undefined}
                      initialScore={diagramScore}
                      challengeContext={{
                        challengeId: challenge.id,
                        challengeTitle: challenge.title,
                        challengeBrief: questionsData?.brief || challenge.description,
                        awsServices: challenge.aws_services_relevant,
                      }}
                      challengeProgressId={challengeProgressId || undefined}
                      sessionId={diagramSessionId}
                      onSave={async (data, score) => {
                        setDiagramData(data);
                        setDiagramScore(score);
                        // Also save to challenge progress
                        if (attemptId && challenge.id) {
                          // Build answers array from current state
                          const answersArray = Object.entries(answers)
                            .filter(([, state]) => state.isSubmitted)
                            .map(([questionId, state]) => ({
                              questionId,
                              selectedOptionId: state.selectedOptionId,
                              isCorrect: state.isCorrect || false,
                              pointsEarned: state.isCorrect ? 20 : 0,
                              hintUsed: revealedQuestionHints.has(questionId),
                              answeredAt: new Date().toISOString(),
                            }));
                          
                          // Check if challenge should be marked complete:
                          // All 4 stages: questions + drawing + chat + CLI
                          const allQuestionsAnsweredNow = questionsData?.questions.every(q => answers[q.id]?.isSubmitted) || false;
                          const shouldComplete = allQuestionsAnsweredNow && hasDrawingPassed && hasChatCompleted && hasCLICompleted;
                          
                          const response = await fetch("/api/challenge/progress", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              attemptId,
                              challengeId: challenge.id,
                              answers: answersArray,
                              totalPointsEarned: earnedPoints,
                              hintsUsed: revealedQuestionHints.size,
                              isComplete: shouldComplete,
                              diagramData: data,
                              diagramScore: score,
                              questionsData: questionsData ? {
                                brief: questionsData.brief,
                                questions: questionsData.questions,
                                totalPoints: questionsData.total_points,
                                estimatedTimeMinutes: questionsData.estimated_time_minutes,
                              } : undefined,
                            }),
                          });
                          
                          // Store the progress ID if we get it back
                          if (response.ok) {
                            const result = await response.json();
                            if (result.progressId && !challengeProgressId) {
                              setChallengeProgressId(result.progressId);
                            }
                          }
                        }
                      }}
                      onScoreChange={(score) => setDiagramScore(score)}
                      onAuditComplete={async (result) => {
                        setLastAuditResult(result);
                        // Update session ID for continuity
                        if (!diagramSessionId) {
                          setDiagramSessionId(`diagram-${challenge.id}-${Date.now()}`);
                        }
                        
                        // Check if audit score passes threshold
                        if (result.score >= AUDIT_PASS_THRESHOLD && !hasDrawingPassed) {
                          setHasDrawingPassed(true);
                          setShowDrawingCelebration(true);
                          
                          // Save the passing audit result to database
                          if (attemptId && challenge.id) {
                            const answersArray = Object.entries(answers)
                              .filter(([, state]) => state.isSubmitted)
                              .map(([questionId, state]) => ({
                                questionId,
                                selectedOptionId: state.selectedOptionId,
                                isCorrect: state.isCorrect || false,
                                pointsEarned: state.isCorrect ? 20 : 0,
                                hintUsed: revealedQuestionHints.has(questionId),
                                answeredAt: new Date().toISOString(),
                              }));
                            
                            // Check if all questions are also answered
                            const allQuestionsAnsweredNow = questionsData?.questions.every(q => answers[q.id]?.isSubmitted) || false;
                            const shouldComplete = allQuestionsAnsweredNow && hasChatCompleted && hasCLICompleted; // All 4 stages complete
                            
                            await fetch("/api/challenge/progress", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                attemptId,
                                challengeId: challenge.id,
                                answers: answersArray,
                                totalPointsEarned: earnedPoints,
                                hintsUsed: revealedQuestionHints.size,
                                isComplete: shouldComplete,
                                diagramData,
                                diagramScore,
                                auditScore: result.score,
                                auditPassed: true,
                                questionsData: questionsData ? {
                                  brief: questionsData.brief,
                                  questions: questionsData.questions,
                                  totalPoints: questionsData.total_points,
                                  estimatedTimeMinutes: questionsData.estimated_time_minutes,
                                } : undefined,
                              }),
                            });
                          }
                        }
                      }}
                    />
                  </div>
                )}

                {/* CHAT MODE - Proficiency Test with AI coach */}
                {workspaceMode === "chat" && (
                  <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/50">
                    {/* Proficiency Result Display */}
                    {proficiencyResult && (
                      <div className="p-4 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700">
                        <div className="max-w-3xl mx-auto">
                          <div className="flex items-center gap-4 mb-3">
                            <div className={cn(
                              "w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold",
                              proficiencyResult.score >= 70 ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"
                            )}>
                              {proficiencyResult.score}
                            </div>
                            <div>
                              <h3 className="text-lg font-medium text-white">Proficiency Assessment</h3>
                              <p className="text-sm text-slate-400">{proficiencyResult.summary}</p>
                            </div>
                          </div>
                          {proficiencyResult.strengths.length > 0 && (
                            <div className="mb-2">
                              <span className="text-xs text-green-400 font-medium">Strengths: </span>
                              <span className="text-xs text-slate-300">{proficiencyResult.strengths.join(", ")}</span>
                            </div>
                          )}
                          {proficiencyResult.areasForImprovement.length > 0 && (
                            <div>
                              <span className="text-xs text-amber-400 font-medium">Areas to improve: </span>
                              <span className="text-xs text-slate-300">{proficiencyResult.areasForImprovement.join(", ")}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex-1 p-4 overflow-y-auto">
                      {messages.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                          <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                          <h3 className="text-lg font-medium text-slate-300 mb-2">Chat with Sophia</h3>
                          <p className="text-sm mb-6 max-w-md mx-auto">
                            Ask questions about the challenge, get help with your architecture, or discuss AWS best practices.
                          </p>
                          <div className="max-w-md mx-auto space-y-2">
                            {[
                              "Help me understand the business requirements",
                              "What AWS services should I consider?",
                              "Review my architecture approach",
                              "Explain the compliance requirements"
                            ].map((suggestion) => (
                              <button
                                key={suggestion}
                                onClick={() => {
                                  setInputValue(suggestion);
                                  setTimeout(() => sendMessage(), 100);
                                }}
                                className="block w-full text-sm px-4 py-3 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300 transition-colors text-left"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 max-w-3xl mx-auto">
                          {/* Show proficiency test indicator if started */}
                          {isProficiencyStarted && !proficiencyResult && (
                            <div className="text-center py-2 px-4 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs">
                              📝 Proficiency Test in Progress - Sophia is evaluating your understanding
                            </div>
                          )}
                          {messages.map((msg, i) => (
                            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                              <div className={cn(
                                "max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap",
                                msg.role === "user" 
                                  ? "bg-cyan-500/20 text-cyan-100 rounded-br-sm" 
                                  : "bg-slate-800 text-slate-200 rounded-bl-sm"
                              )}>
                                {msg.content}
                              </div>
                            </div>
                          ))}
                          {isChatLoading && (
                            <div className="flex justify-start">
                              <div className="bg-slate-800 rounded-xl px-4 py-3">
                                <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                              </div>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>
                      )}
                    </div>

                    <div className="p-4 border-t border-slate-800 shrink-0 bg-slate-900">
                      <div className="flex gap-3 max-w-3xl mx-auto">
                        <Input
                          ref={inputRef}
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (isProficiencyStarted ? sendProficiencyMessage() : sendMessage())}
                          placeholder={isProficiencyStarted ? "Explain your reasoning..." : "Ask Sophia anything about this challenge..."}
                          className="h-11 text-sm bg-slate-800 border-slate-700"
                          disabled={hasChatCompleted}
                        />
                        <Button
                          size="icon"
                          onClick={isProficiencyStarted ? sendProficiencyMessage : sendMessage}
                          disabled={!inputValue.trim() || isChatLoading || hasChatCompleted}
                          className="h-11 w-11 bg-cyan-500 hover:bg-cyan-600"
                        >
                          <Send className="w-5 h-5" />
                        </Button>
                      </div>
                      
                      {/* Take Proficiency Test button - show when not started and has some chat history */}
                      {!isProficiencyStarted && !proficiencyResult && (
                        <div className="mt-3 text-center">
                          <Button
                            size="sm"
                            onClick={startProficiencyTest}
                            disabled={isChatLoading}
                            className="bg-purple-500 hover:bg-purple-600 gap-2"
                          >
                            {isChatLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Target className="w-4 h-4" />
                            )}
                            Take Proficiency Test
                          </Button>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Sophia will review your chat history and ask you to explain your architecture
                          </p>
                        </div>
                      )}
                      
                      {proficiencyReadyToEvaluate && !proficiencyResult && (
                        <div className="mt-3 text-center">
                          <Button
                            size="sm"
                            onClick={evaluateProficiencyTest}
                            disabled={isChatLoading}
                            className="bg-green-500 hover:bg-green-600 gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Get Assessment
                          </Button>
                        </div>
                      )}
                      {hasChatCompleted && (
                        <p className="mt-3 text-center text-sm text-green-400">
                          ✓ Proficiency test completed
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* CLI MODE - AWS Console-like interface */}
                {workspaceMode === "cli" && (
                  <div className="flex-1 flex flex-col overflow-hidden bg-[#232f3e]">
                    {/* AWS Console Header */}
                    <div className="h-10 bg-[#232f3e] border-b border-slate-700 flex items-center px-3 shrink-0">
                      <div className="flex items-center gap-3">
                        {/* AWS Logo */}
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 bg-[#ff9900] rounded flex items-center justify-center">
                            <span className="text-[10px] font-bold text-black">aws</span>
                          </div>
                          <span className="text-xs text-slate-400">Console</span>
                        </div>
                        {/* Service breadcrumb */}
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-slate-500">Services</span>
                          <ChevronRight className="w-3 h-3 text-slate-600" />
                          <span className="text-white font-medium">CloudShell</span>
                        </div>
                      </div>
                      <div className="flex-1" />
                      {/* Right side - Region & Account */}
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700/50 text-slate-300">
                          <span>{consoleData?.region || "eu-west-2"}</span>
                          <ChevronRight className="w-3 h-3 rotate-90" />
                        </div>
                        <div className="text-slate-400">
                          {consoleData?.account_alias || scenario.company_name?.replace(/\s+/g, '-').toLowerCase() + '-account' || 'demo-account'}
                        </div>
                      </div>
                    </div>

                    {/* Console Dashboard Area */}
                    <div className="flex-1 flex overflow-hidden">
                      {/* Left sidebar - Services */}
                      <div className="w-48 bg-[#1a242f] border-r border-slate-700 p-3 shrink-0 overflow-y-auto">
                        <h4 className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                          Recently Visited
                        </h4>
                        <div className="space-y-1">
                          {(consoleData?.recently_visited || challenge.aws_services_relevant.slice(0, 6).map(s => ({ name: s, color: "#FF9900", abbr: s.substring(0, 2).toUpperCase() }))).map((service, i) => (
                            <div 
                              key={i}
                              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-700/50 cursor-pointer"
                            >
                              <div 
                                className="w-5 h-5 rounded flex items-center justify-center"
                                style={{ backgroundColor: service.color }}
                              >
                                <span className="text-[8px] font-bold text-white">
                                  {service.abbr}
                                </span>
                              </div>
                              {service.name}
                            </div>
                          ))}
                        </div>

                        <h4 className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-4 mb-2">
                          Environment
                        </h4>
                        <div className="space-y-2 text-[10px] text-slate-400">
                          <div className="flex justify-between">
                            <span>Region</span>
                            <span className="text-cyan-400">{consoleData?.region || "eu-west-2"}</span>
                          </div>
                          {consoleData?.resource_counts ? (
                            Object.entries(consoleData.resource_counts).slice(0, 4).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span>{key}</span>
                                <span className={value > 0 ? "text-green-400" : "text-amber-400"}>{value}</span>
                              </div>
                            ))
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span>VPCs</span>
                                <span className="text-green-400">2</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Subnets</span>
                                <span className="text-green-400">4</span>
                              </div>
                              <div className="flex justify-between">
                                <span>EC2 Instances</span>
                                <span className="text-amber-400">0</span>
                              </div>
                            </>
                          )}
                        </div>

                        <h4 className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-4 mb-2">
                          Cost & Usage
                        </h4>
                        <div className="bg-slate-800/50 rounded p-2">
                          <div className="text-lg font-bold text-green-400">
                            ${consoleData?.cost_current_month?.toFixed(2) || "0.00"}
                          </div>
                          <div className="text-[10px] text-slate-500">Current month</div>
                          <div className="mt-2 h-8 flex items-end gap-0.5">
                            {(consoleData?.cost_trend || [20, 35, 15, 45, 30, 25, 40]).map((h, i) => {
                              const maxVal = Math.max(...(consoleData?.cost_trend || [45]));
                              const heightPercent = maxVal > 0 ? (h / maxVal) * 100 : h;
                              return (
                                <div 
                                  key={i} 
                                  className="flex-1 bg-cyan-500/30 rounded-t"
                                  style={{ height: `${heightPercent}%` }}
                                />
                              );
                            })}
                          </div>
                        </div>

                        {/* AWS Health */}
                        <h4 className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-4 mb-2">
                          AWS Health
                        </h4>
                        <div className="space-y-1 text-[10px]">
                          <div className="flex justify-between text-slate-400">
                            <span>Open issues</span>
                            <span className={consoleData?.health_open_issues === 0 ? "text-green-400" : "text-red-400"}>
                              {consoleData?.health_open_issues ?? 0}
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>Scheduled</span>
                            <span className={consoleData?.health_scheduled_changes === 0 ? "text-green-400" : "text-amber-400"}>
                              {consoleData?.health_scheduled_changes ?? 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Main content - CloudShell Terminal + Objectives */}
                      <div className="flex-1 flex flex-col">
                        {/* Objectives Panel */}
                        {cliObjectives.length > 0 && (
                          <div className="bg-[#1a242f] border-b border-slate-700 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-medium text-slate-300">CLI Objectives</h4>
                              <span className="text-[10px] text-slate-500">
                                {cliObjectives.filter(o => o.completed).length}/{cliObjectives.length} completed • {cliEarnedPoints}/{cliTotalPoints} pts
                              </span>
                            </div>
                            {cliContextMessage && (
                              <p className="text-[10px] text-slate-400 mb-2">{cliContextMessage}</p>
                            )}
                            <div className="space-y-1.5">
                              {cliObjectives.map((obj, i) => (
                                <div 
                                  key={obj.id}
                                  className={cn(
                                    "flex items-start gap-2 p-2 rounded text-xs",
                                    obj.completed ? "bg-green-500/10 border border-green-500/30" : "bg-slate-800/50"
                                  )}
                                >
                                  <div className={cn(
                                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                                    obj.completed ? "bg-green-500 text-white" : "bg-slate-700 text-slate-400"
                                  )}>
                                    {obj.completed ? <CheckCircle2 className="w-3 h-3" /> : <span>{i + 1}</span>}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={cn("text-slate-300", obj.completed && "line-through opacity-60")}>
                                      {obj.description}
                                    </p>
                                    {!obj.completed && obj.hint && (
                                      <p className="text-[10px] text-slate-500 mt-0.5">💡 {obj.hint}</p>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-500 shrink-0">{obj.points} pts</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Load objectives button if none loaded */}
                        {cliObjectives.length === 0 && (
                          <div className="bg-[#1a242f] border-b border-slate-700 p-3">
                            <Button
                              size="sm"
                              onClick={fetchCliObjectives}
                              className="w-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30"
                            >
                              <Target className="w-4 h-4 mr-2" />
                              Load CLI Objectives
                            </Button>
                          </div>
                        )}

                        {/* CloudShell header */}
                        <div className="h-9 bg-[#0f1419] border-b border-slate-700 flex items-center px-3 shrink-0">
                          <div className="flex items-center gap-2">
                            <Terminal className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium text-white">CloudShell</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                              Simulated
                            </span>
                          </div>
                          <div className="flex-1" />
                          <div className="text-[10px] text-slate-500">
                            {scenario.company_name} • {industry || 'Technology'}
                          </div>
                        </div>

                        {/* Terminal */}
                        <CLISimulator
                          className="flex-1"
                          challengeContext={{
                            id: challenge.id,
                            title: challenge.title,
                            description: challenge.description,
                            aws_services: challenge.aws_services_relevant,
                            success_criteria: challenge.success_criteria,
                          }}
                          companyName={scenario.company_name}
                          industry={industry || (companyInfo?.industry as string) || "Technology"}
                          businessContext={scenario.business_context}
                          apiKey={apiKey}
                          preferredModel={preferredModel}
                          onCommandExecuted={async (cmd: string, output: string) => {
                            console.log(`[CLI Simulator] ${cmd}`, output);
                            
                            // Validate command against objectives
                            if (cliObjectives.length > 0 && !hasCLICompleted) {
                              try {
                                const response = await fetch("/api/cli-objectives/validate", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    command: cmd,
                                    commandOutput: output,
                                    objectives: cliObjectives.filter(o => !o.completed),
                                    openaiApiKey: apiKey,
                                    preferredModel: preferredModel,
                                  }),
                                });
                                
                                if (response.ok) {
                                  const data = await response.json();
                                  if (data.success && data.objective_id) {
                                    // Mark objective as completed
                                    setCliObjectives(prev => prev.map(obj => 
                                      obj.id === data.objective_id 
                                        ? { ...obj, completed: true }
                                        : obj
                                    ));
                                    setCliEarnedPoints(prev => prev + data.points_earned);
                                    
                                    // Check if all objectives completed
                                    const updatedObjectives = cliObjectives.map(obj => 
                                      obj.id === data.objective_id ? { ...obj, completed: true } : obj
                                    );
                                    if (updatedObjectives.every(obj => obj.completed)) {
                                      setHasCLICompleted(true);
                                    }
                                  }
                                }
                              } catch (err) {
                                console.error("Failed to validate CLI command:", err);
                              }
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* CLI Completion indicator */}
                    {hasCLICompleted && (
                      <div className="p-2 bg-green-500/10 border-t border-green-500/30 text-center">
                        <p className="text-sm text-green-400">✓ CLI objectives completed ({cliEarnedPoints}/{cliTotalPoints} points)</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right side removed - Chat and CLI now in main workspace */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
