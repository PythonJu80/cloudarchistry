"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Flame,
  Trophy,
  RotateCcw,
  Home,
  Clock,
  Zap,
  Check,
  X,
  Thermometer,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Question {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  topic?: string;
  difficulty?: string;
  explanation?: string;
}

interface GameState {
  status: "ready" | "playing" | "finished";
  score: number;
  streak: number;
  bestStreak: number;
  temperature: number;
  questionsAnswered: number;
  correctAnswers: number;
  currentMultiplier: number;
}

const GAME_DURATION = 60;
const BASE_POINTS = 100;
const TEMP_GAIN = 15;
const TEMP_LOSS = 25;
const TEMP_DECAY = 2;

function getMultiplier(temp: number): number {
  if (temp >= 90) return 5;
  if (temp >= 70) return 3;
  if (temp >= 50) return 2;
  if (temp >= 30) return 1.5;
  return 1;
}

function getTempTier(temp: number): { name: string; color: string } {
  if (temp >= 90) return { name: "🔥 INFERNO 🔥", color: "text-red-400" };
  if (temp >= 70) return { name: "🔥 BLAZING", color: "text-orange-400" };
  if (temp >= 50) return { name: "HOT", color: "text-yellow-400" };
  if (temp >= 30) return { name: "WARM", color: "text-amber-400" };
  return { name: "COLD", color: "text-blue-400" };
}

function ThermometerDisplay({ temperature, multiplier }: { temperature: number; multiplier: number }) {
  const tier = getTempTier(temperature);
  
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-sm font-bold flex items-center gap-1">
        <span className={tier.color}>{tier.name}</span>
        {multiplier > 1 && <span className="text-yellow-400 text-xs">×{multiplier}</span>}
      </div>
      <div className="relative w-8 h-48 bg-gray-800 rounded-full border-2 border-gray-600 overflow-hidden">
        <div 
          className="absolute bottom-0 left-0 right-0 transition-all duration-300 rounded-b-full"
          style={{ 
            height: `${temperature}%`,
            background: temperature >= 70 
              ? 'linear-gradient(to top, #ef4444, #f97316, #eab308)' 
              : temperature >= 40 
                ? 'linear-gradient(to top, #f97316, #eab308)' 
                : 'linear-gradient(to top, #3b82f6, #60a5fa)',
          }}
        />
        <div className="absolute inset-0 flex flex-col justify-between py-2">
          {[100, 75, 50, 25, 0].map((mark) => (
            <div key={mark} className="flex items-center justify-end pr-1">
              <div className="w-2 h-0.5 bg-gray-500" />
            </div>
          ))}
        </div>
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center">
          <div 
            className="w-6 h-6 rounded-full transition-colors duration-300"
            style={{ backgroundColor: temperature >= 70 ? '#ef4444' : temperature >= 40 ? '#f97316' : '#3b82f6' }}
          />
        </div>
      </div>
      <div className="text-2xl font-black mt-4">
        <span className={tier.color}>{Math.round(temperature)}°</span>
      </div>
    </div>
  );
}

export default function HotStreakPage() {
  const router = useRouter();
  const { status: authStatus } = useSession();
  
  const [gameState, setGameState] = useState<GameState>({
    status: "ready",
    score: 0,
    streak: 0,
    bestStreak: 0,
    temperature: 0,
    questionsAnswered: 0,
    correctAnswers: 0,
    currentMultiplier: 1,
  });
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [gameTimeLeft, setGameTimeLeft] = useState(GAME_DURATION);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tempDecayRef = useRef<NodeJS.Timeout | null>(null);

  const currentQuestion = questions[currentQuestionIndex];

  const fetchQuestions = useCallback(async (count: number = 20, excludeIds: string[] = []): Promise<Question[]> => {
    try {
      const response = await fetch("/api/gaming/hot-streak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, excludeIds }),
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.questions.map((q: {
          id: string;
          question: string;
          options: string[];
          correctIndex: number;
          topic?: string;
          difficulty?: string;
          explanation?: string;
        }) => ({
          id: q.id,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          topic: q.topic,
          difficulty: q.difficulty,
          explanation: q.explanation,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch questions:", error);
    }
    return [];
  }, []);

  const startGame = useCallback(async () => {
    setIsLoading(true);
    setCurrentQuestionIndex(0);
    setGameTimeLeft(GAME_DURATION);
    setSelectedAnswer(null);
    setShowResult(false);
    setAnsweredIds(new Set());
    setGameState({
      status: "playing",
      score: 0,
      streak: 0,
      bestStreak: 0,
      temperature: 20,
      questionsAnswered: 0,
      correctAnswers: 0,
      currentMultiplier: 1,
    });
    
    const newQuestions = await fetchQuestions(25);
    if (newQuestions.length === 0) {
      alert("Failed to load AI questions. Please ensure you have an API key configured in Settings and the Learning Agent is running.");
      setGameState(prev => ({ ...prev, status: "ready" }));
      setIsLoading(false);
      return;
    }
    setQuestions(newQuestions);
    setIsLoading(false);
  }, [fetchQuestions]);

  const handleAnswer = useCallback((answerIndex: number) => {
    if (showResult || selectedAnswer !== null || !currentQuestion) return;
    
    setSelectedAnswer(answerIndex);
    const correct = answerIndex === currentQuestion.correctIndex;
    setIsCorrect(correct);
    setShowResult(true);
    
    setAnsweredIds(prev => new Set(prev).add(currentQuestion.id));
    
    setGameState(prev => {
      const newStreak = correct ? prev.streak + 1 : 0;
      const newTemp = correct 
        ? Math.min(100, prev.temperature + TEMP_GAIN + (newStreak * 2))
        : Math.max(0, prev.temperature - TEMP_LOSS);
      const multiplier = getMultiplier(newTemp);
      const points = correct ? Math.floor(BASE_POINTS * multiplier) : 0;
      
      return {
        ...prev,
        score: prev.score + points,
        streak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
        temperature: newTemp,
        questionsAnswered: prev.questionsAnswered + 1,
        correctAnswers: prev.correctAnswers + (correct ? 1 : 0),
        currentMultiplier: multiplier,
      };
    });
    
    setTimeout(() => {
      if (currentQuestionIndex >= questions.length - 3) {
        fetchQuestions(15, Array.from(answeredIds)).then(moreQuestions => {
          if (moreQuestions.length > 0) {
            setQuestions(prev => [...prev, ...moreQuestions]);
          }
        });
      }
      
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }, 800);
  }, [showResult, selectedAnswer, currentQuestion, currentQuestionIndex, questions.length, answeredIds, fetchQuestions]);

  useEffect(() => {
    if (gameState.status !== "playing" || isLoading) return;
    
    gameTimerRef.current = setInterval(() => {
      setGameTimeLeft(prev => {
        if (prev <= 1) {
          setGameState(p => ({ ...p, status: "finished" }));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    };
  }, [gameState.status, isLoading]);

  useEffect(() => {
    if (gameState.status !== "playing" || isLoading || showResult) return;
    
    tempDecayRef.current = setInterval(() => {
      setGameState(prev => ({
        ...prev,
        temperature: Math.max(0, prev.temperature - TEMP_DECAY),
        currentMultiplier: getMultiplier(Math.max(0, prev.temperature - TEMP_DECAY)),
      }));
    }, 1000);
    
    return () => {
      if (tempDecayRef.current) clearInterval(tempDecayRef.current);
    };
  }, [gameState.status, isLoading, showResult]);

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Flame className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Igniting...</p>
        </div>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const tempTier = getTempTier(gameState.temperature);
  const accuracy = gameState.questionsAnswered > 0
    ? Math.round((gameState.correctAnswers / gameState.questionsAnswered) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden relative">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-orange-950/30 via-transparent to-transparent" />
        {gameState.temperature >= 30 && (
          <div 
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-orange-600/20 via-red-600/10 to-transparent transition-all duration-500"
            style={{ height: `${Math.min(gameState.temperature * 0.6, 60)}%` }}
          />
        )}
        {gameState.temperature >= 70 && (
          <div 
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-yellow-500/20 via-orange-500/10 to-transparent animate-pulse"
            style={{ height: `${Math.min(gameState.temperature * 0.4, 40)}%` }}
          />
        )}
      </div>

      <nav className="relative z-50 border-b border-orange-900/30 bg-black/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/game" className="flex items-center gap-2 text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            <span>Exit</span>
          </Link>
          
          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-2 font-mono text-xl font-bold ${
              gameTimeLeft <= 10 ? "text-red-500 animate-pulse" : "text-white"
            }`}>
              <Clock className="w-5 h-5" />
              <span>{gameTimeLeft}s</span>
            </div>
            
            {gameState.streak > 0 && (
              <div className="flex items-center gap-1 text-orange-500">
                <Flame className={`w-5 h-5 ${gameState.streak >= 4 ? "animate-pulse" : ""}`} />
                <span className="font-bold">{gameState.streak}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-yellow-500">
              <Trophy className="w-5 h-5" />
              <span className="font-bold text-xl">{gameState.score}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {gameState.status === "ready" && (
          <div className="flex items-center justify-center min-h-[70vh]">
            <div className="text-center">
              <div className="relative inline-block mb-8">
                <Thermometer className="w-32 h-32 text-orange-500 mx-auto" />
                <div className="absolute inset-0 animate-ping">
                  <Thermometer className="w-32 h-32 text-orange-500/30 mx-auto" />
                </div>
              </div>
              
              <h1 className="text-5xl font-black mb-4">
                <span className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                  HOT STREAK
                </span>
              </h1>
              
              <p className="text-gray-400 text-lg mb-2 max-w-md mx-auto">
                60 seconds. Answer fast. Build heat.
                <br />
                Higher temperature = bigger multipliers!
              </p>
              <p className="text-gray-500 text-sm mb-8">
                Questions tailored to your certification level.
              </p>
              
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8 text-sm">
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                  <p className="text-gray-400">60 Seconds</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <Thermometer className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                  <p className="text-gray-400">Build Heat</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <Zap className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
                  <p className="text-gray-400">Up to 5×</p>
                </div>
              </div>
              
              <Button
                size="lg"
                onClick={startGame}
                className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold text-xl px-12 py-6 rounded-xl"
              >
                <Flame className="w-6 h-6 mr-2" />
                START STREAK
              </Button>
            </div>
          </div>
        )}

        {gameState.status === "playing" && isLoading && (
          <div className="flex items-center justify-center min-h-[70vh]">
            <div className="text-center">
              <Flame className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-pulse" />
              <p className="text-gray-400">Generating questions for your level...</p>
            </div>
          </div>
        )}

        {gameState.status === "playing" && !isLoading && currentQuestion && (
          <div className="flex gap-8">
            <div className="hidden md:block">
              <ThermometerDisplay 
                temperature={gameState.temperature} 
                multiplier={gameState.currentMultiplier}
              />
            </div>
            
            <div className="flex-1 space-y-4">
              <div className="md:hidden">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-bold ${tempTier.color}`}>{tempTier.name}</span>
                  {gameState.currentMultiplier > 1 && (
                    <span className="text-yellow-400 text-sm">×{gameState.currentMultiplier}</span>
                  )}
                </div>
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-300 rounded-full"
                    style={{ 
                      width: `${gameState.temperature}%`,
                      background: gameState.temperature >= 70 
                        ? 'linear-gradient(to right, #ef4444, #f97316, #eab308)' 
                        : gameState.temperature >= 40 
                          ? 'linear-gradient(to right, #f97316, #eab308)' 
                          : 'linear-gradient(to right, #3b82f6, #60a5fa)',
                    }}
                  />
                </div>
              </div>
              
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>Question {gameState.questionsAnswered + 1}</span>
                <span>Streak: {gameState.streak}</span>
              </div>
              
              <div className="bg-gray-900/80 border border-gray-700 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-center mb-6">
                  {currentQuestion.question}
                </h2>
                
                <div className="grid grid-cols-1 gap-3">
                  {currentQuestion.options.map((option, index) => {
                    const isSelected = selectedAnswer === index;
                    const isCorrectAnswer = index === currentQuestion.correctIndex;
                    const showCorrectStyle = showResult && isCorrectAnswer;
                    const showWrongStyle = showResult && isSelected && !isCorrectAnswer;
                    
                    return (
                      <button
                        key={index}
                        onClick={() => handleAnswer(index)}
                        disabled={showResult}
                        className={`
                          relative p-4 rounded-xl border-2 text-left font-medium transition-all duration-200
                          ${!showResult && !isSelected ? "border-gray-700 bg-gray-800/50 hover:border-orange-500 hover:bg-gray-800" : ""}
                          ${isSelected && !showResult ? "border-orange-500 bg-orange-500/20" : ""}
                          ${showCorrectStyle ? "border-green-500 bg-green-500/20" : ""}
                          ${showWrongStyle ? "border-red-500 bg-red-500/20" : ""}
                          ${showResult && !isSelected && !isCorrectAnswer ? "opacity-50" : ""}
                        `}
                      >
                        <span className="block">{option}</span>
                        {showCorrectStyle && (
                          <Check className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-green-500" />
                        )}
                        {showWrongStyle && (
                          <X className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-red-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {showResult && (
                  <div className={`mt-6 text-center text-xl font-bold ${isCorrect ? "text-green-400" : "text-red-400"}`}>
                    {isCorrect ? (
                      <span className="flex items-center justify-center gap-2">
                        <Check className="w-6 h-6" />
                        +{Math.floor(BASE_POINTS * gameState.currentMultiplier)} points!
                        {gameState.currentMultiplier > 1 && (
                          <span className="text-yellow-400 text-sm">(×{gameState.currentMultiplier})</span>
                        )}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <X className="w-6 h-6" />
                        Temperature dropped!
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {gameState.status === "finished" && (
          <div className="flex items-center justify-center min-h-[70vh]">
            <div className="text-center">
              <div className="relative w-32 h-32 mx-auto mb-6">
                {gameState.bestStreak >= 10 ? (
                  <>
                    <Trophy className="w-32 h-32 text-yellow-500" />
                    <div className="absolute inset-0 animate-ping">
                      <Trophy className="w-32 h-32 text-yellow-500/30" />
                    </div>
                  </>
                ) : gameState.bestStreak >= 5 ? (
                  <Flame className="w-32 h-32 text-orange-500" />
                ) : (
                  <Flame className="w-32 h-32 text-gray-500" />
                )}
              </div>
              
              <h1 className="text-4xl font-black mb-2">
                {gameState.bestStreak >= 10 ? (
                  <span className="text-yellow-400">LEGENDARY RUN!</span>
                ) : gameState.bestStreak >= 5 ? (
                  <span className="text-orange-400">GREAT STREAK!</span>
                ) : (
                  <span className="text-gray-400">TIME UP!</span>
                )}
              </h1>
              
              <p className="text-6xl font-black text-yellow-500 mb-8">
                {gameState.score}
              </p>
              
              <div className="grid grid-cols-4 gap-4 max-w-xl mx-auto mb-8">
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <p className="text-3xl font-bold text-orange-400">{gameState.bestStreak}</p>
                  <p className="text-sm text-gray-500">Best Streak</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <p className="text-3xl font-bold text-green-400">{gameState.correctAnswers}</p>
                  <p className="text-sm text-gray-500">Correct</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <p className="text-3xl font-bold text-blue-400">{gameState.questionsAnswered}</p>
                  <p className="text-sm text-gray-500">Questions</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <p className="text-3xl font-bold text-purple-400">{accuracy}%</p>
                  <p className="text-sm text-gray-500">Accuracy</p>
                </div>
              </div>
              
              <div className="flex gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={() => router.push("/game")}
                  className="gap-2"
                >
                  <Home className="w-4 h-4" />
                  Back to Arena
                </Button>
                <Button
                  onClick={startGame}
                  className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
