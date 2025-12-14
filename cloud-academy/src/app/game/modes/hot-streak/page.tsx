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
  const isHot = temperature >= 70;
  const isWarm = temperature >= 40;
  
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Tier Label with Glow */}
      <div className={`text-lg font-black flex items-center gap-2 ${isHot ? 'animate-pulse' : ''}`}>
        <span className={`${tier.color} drop-shadow-lg`}>{tier.name}</span>
        {multiplier > 1 && (
          <span className="text-yellow-400 text-sm font-bold bg-yellow-400/20 px-2 py-0.5 rounded-full">
            ×{multiplier}
          </span>
        )}
      </div>
      
      {/* Main Thermometer */}
      <div className="relative">
        {/* Glow Effect */}
        {isHot && (
          <div 
            className="absolute inset-0 blur-xl opacity-60 rounded-full animate-pulse"
            style={{ 
              background: 'radial-gradient(circle, #ef4444 0%, transparent 70%)',
              transform: 'scale(1.5)',
            }}
          />
        )}
        
        {/* Thermometer Body */}
        <div className="relative w-16 h-72 bg-gradient-to-b from-gray-900 to-gray-800 rounded-full border-4 border-gray-600 overflow-hidden shadow-2xl">
          {/* Glass Reflection */}
          <div className="absolute top-0 left-1 w-3 h-full bg-gradient-to-b from-white/10 to-transparent rounded-full" />
          
          {/* Mercury/Fill */}
          <div 
            className="absolute bottom-0 left-1 right-1 transition-all duration-500 ease-out rounded-b-full"
            style={{ 
              height: `${Math.max(temperature, 5)}%`,
              background: isHot 
                ? 'linear-gradient(to top, #dc2626, #ef4444, #f97316, #fbbf24)' 
                : isWarm 
                  ? 'linear-gradient(to top, #ea580c, #f97316, #fbbf24)' 
                  : 'linear-gradient(to top, #1d4ed8, #3b82f6, #60a5fa)',
              boxShadow: isHot 
                ? '0 0 30px rgba(239, 68, 68, 0.8), inset 0 0 20px rgba(255, 255, 255, 0.3)' 
                : isWarm 
                  ? '0 0 20px rgba(249, 115, 22, 0.6), inset 0 0 15px rgba(255, 255, 255, 0.2)' 
                  : '0 0 15px rgba(59, 130, 246, 0.5), inset 0 0 10px rgba(255, 255, 255, 0.2)',
            }}
          >
            {/* Bubbles Animation for Hot */}
            {isHot && (
              <>
                <div className="absolute bottom-4 left-2 w-2 h-2 bg-yellow-300/60 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <div className="absolute bottom-8 right-2 w-1.5 h-1.5 bg-orange-300/60 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                <div className="absolute bottom-12 left-3 w-1 h-1 bg-red-300/60 rounded-full animate-bounce" style={{ animationDelay: '0.6s' }} />
              </>
            )}
          </div>
          
          {/* Temperature Marks */}
          <div className="absolute inset-0 flex flex-col justify-between py-4 px-1">
            {[100, 75, 50, 25].map((mark) => (
              <div key={mark} className="flex items-center justify-between w-full">
                <div className="w-3 h-1 bg-gray-500/50 rounded" />
                <span className="text-[10px] text-gray-500 font-mono">{mark}</span>
                <div className="w-3 h-1 bg-gray-500/50 rounded" />
              </div>
            ))}
          </div>
        </div>
        
        {/* Bulb at Bottom */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-gradient-to-b from-gray-800 to-gray-900 border-4 border-gray-600 flex items-center justify-center shadow-2xl overflow-hidden">
          <div 
            className={`w-14 h-14 rounded-full transition-all duration-500 ${isHot ? 'animate-pulse' : ''}`}
            style={{ 
              background: isHot 
                ? 'radial-gradient(circle, #fbbf24, #f97316, #dc2626)' 
                : isWarm 
                  ? 'radial-gradient(circle, #fbbf24, #f97316, #ea580c)' 
                  : 'radial-gradient(circle, #93c5fd, #3b82f6, #1d4ed8)',
              boxShadow: isHot 
                ? '0 0 40px rgba(239, 68, 68, 0.9), inset 0 0 20px rgba(255, 255, 255, 0.4)' 
                : isWarm 
                  ? '0 0 25px rgba(249, 115, 22, 0.7), inset 0 0 15px rgba(255, 255, 255, 0.3)' 
                  : '0 0 15px rgba(59, 130, 246, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.2)',
            }}
          />
        </div>
      </div>
      
      {/* Temperature Reading */}
      <div className={`text-4xl font-black mt-8 ${isHot ? 'animate-pulse' : ''}`}>
        <span 
          className={tier.color}
          style={{ 
            textShadow: isHot 
              ? '0 0 20px rgba(239, 68, 68, 0.8)' 
              : isWarm 
                ? '0 0 15px rgba(249, 115, 22, 0.6)' 
                : '0 0 10px rgba(59, 130, 246, 0.5)',
          }}
        >
          {Math.round(temperature)}°
        </span>
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
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-[#0a0a0a] to-gray-950" />
        
        {/* Heat glow from bottom */}
        <div 
          className="absolute inset-x-0 bottom-0 transition-all duration-700 ease-out"
          style={{ 
            height: `${Math.min(gameState.temperature * 0.8, 80)}%`,
            background: gameState.temperature >= 70
              ? 'radial-gradient(ellipse at bottom, rgba(239, 68, 68, 0.4) 0%, rgba(249, 115, 22, 0.2) 30%, transparent 70%)'
              : gameState.temperature >= 40
                ? 'radial-gradient(ellipse at bottom, rgba(249, 115, 22, 0.3) 0%, rgba(234, 88, 12, 0.15) 30%, transparent 70%)'
                : 'radial-gradient(ellipse at bottom, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.1) 30%, transparent 70%)',
          }}
        />
        
        {/* Floating fire particles when hot */}
        {gameState.temperature >= 50 && gameState.status === "playing" && (
          <>
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full opacity-60"
                style={{
                  left: `${10 + (i * 7)}%`,
                  bottom: '-10px',
                  background: gameState.temperature >= 70 
                    ? `radial-gradient(circle, ${['#fbbf24', '#f97316', '#ef4444'][i % 3]}, transparent)`
                    : `radial-gradient(circle, ${['#f97316', '#ea580c', '#dc2626'][i % 3]}, transparent)`,
                  animation: `floatUp ${3 + (i % 3)}s ease-out infinite`,
                  animationDelay: `${i * 0.3}s`,
                  filter: 'blur(1px)',
                }}
              />
            ))}
          </>
        )}
        
        {/* Intense flames when blazing */}
        {gameState.temperature >= 70 && gameState.status === "playing" && (
          <>
            {[...Array(8)].map((_, i) => (
              <div
                key={`flame-${i}`}
                className="absolute w-4 h-8 opacity-40"
                style={{
                  left: `${5 + (i * 12)}%`,
                  bottom: '0',
                  background: 'linear-gradient(to top, #ef4444, #f97316, #fbbf24, transparent)',
                  borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                  animation: `flicker ${0.5 + (i % 3) * 0.2}s ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.1}s`,
                  filter: 'blur(2px)',
                }}
              />
            ))}
          </>
        )}
        
        {/* Ember particles for inferno */}
        {gameState.temperature >= 90 && gameState.status === "playing" && (
          <>
            {[...Array(20)].map((_, i) => (
              <div
                key={`ember-${i}`}
                className="absolute w-1 h-1 bg-yellow-400 rounded-full"
                style={{
                  left: `${(i * 5) % 100}%`,
                  bottom: '-5px',
                  animation: `ember ${2 + (i % 3)}s ease-out infinite`,
                  animationDelay: `${(i * 0.15)}s`,
                  boxShadow: '0 0 6px #fbbf24, 0 0 12px #f97316',
                }}
              />
            ))}
          </>
        )}
        
        {/* Vignette overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
      </div>
      
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 0.6; }
          50% { opacity: 0.8; }
          100% { transform: translateY(-400px) scale(0.3); opacity: 0; }
        }
        @keyframes flicker {
          0% { transform: scaleY(1) scaleX(1); opacity: 0.4; }
          100% { transform: scaleY(1.3) scaleX(0.8); opacity: 0.6; }
        }
        @keyframes ember {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: 1; }
          100% { transform: translateY(-300px) translateX(30px) scale(0); opacity: 0; }
        }
      `}</style>

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
