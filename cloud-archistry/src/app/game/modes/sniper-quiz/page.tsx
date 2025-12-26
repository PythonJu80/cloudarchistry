"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Target,
  Crosshair,
  Zap,
  Trophy,
  Flame,
  Eye,
  RotateCcw,
  Home,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Bullet trail animation component
const BulletTrail = ({ 
  startX, 
  startY, 
  endX, 
  endY, 
  onComplete 
}: { 
  startX: number; 
  startY: number; 
  endX: number; 
  endY: number; 
  onComplete: () => void;
}) => {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const duration = 150; // ms
    const start = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);
      
      if (p < 1) {
        requestAnimationFrame(animate);
      } else {
        onComplete();
      }
    };
    
    requestAnimationFrame(animate);
  }, [onComplete]);
  
  const currentX = startX + (endX - startX) * progress;
  const currentY = startY + (endY - startY) * progress;
  
  return (
    <div className="fixed inset-0 pointer-events-none z-[60]">
      {/* Bullet */}
      <div 
        className="absolute w-3 h-3 bg-yellow-400 rounded-full shadow-lg shadow-yellow-500/50"
        style={{ 
          left: currentX, 
          top: currentY,
          transform: "translate(-50%, -50%)",
        }}
      />
      {/* Trail */}
      <svg className="absolute inset-0 w-full h-full">
        <line
          x1={startX}
          y1={startY}
          x2={currentX}
          y2={currentY}
          stroke="rgba(250, 204, 21, 0.6)"
          strokeWidth="2"
          strokeDasharray="4 2"
        />
      </svg>
    </div>
  );
};

interface Question {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  topic: string;
  difficulty: string;
  points: number;
}

interface GameState {
  status: "ready" | "playing" | "finished";
  currentQuestion: number;
  score: number;
  streak: number;
  bestStreak: number;
  bulletTimeRemaining: number;
  answers: Array<{
    questionIndex: number;
    selectedIndex: number | null;
    correct: boolean;
    points: number;
    usedBulletTime: boolean;
  }>;
  eliminatedOption: number | null; // For bullet time
}

// Point values for each question (escalating)
const QUESTION_POINTS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export default function SniperQuizPage() {
  const router = useRouter();
  const { status: authStatus } = useSession();
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState<GameState>({
    status: "ready",
    currentQuestion: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    bulletTimeRemaining: 3,
    answers: [],
    eliminatedOption: null,
  });
  
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);
  const [lockedOn, setLockedOn] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<{ correct: boolean; points: number } | null>(null);
  const [scopePosition, setScopePosition] = useState({ x: 50, y: 50 });
  const [bulletFiring, setBulletFiring] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [impactEffect, setImpactEffect] = useState<{ x: number; y: number; hit: boolean } | null>(null);
  const targetRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Fetch questions
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gaming/sniper-quiz/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 10 }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions);
      }
    } catch (err) {
      console.error("Failed to fetch questions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (authStatus === "authenticated") {
      fetchQuestions();
    }
  }, [authStatus, router, fetchQuestions]);

  // Track mouse for scope effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      setScopePosition({ x, y });
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Lock on effect when hovering
  useEffect(() => {
    if (hoveredOption !== null) {
      const timer = setTimeout(() => setLockedOn(true), 300);
      return () => clearTimeout(timer);
    } else {
      setLockedOn(false);
    }
  }, [hoveredOption]);

  const startGame = () => {
    setGameState({
      status: "playing",
      currentQuestion: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      bulletTimeRemaining: 3,
      answers: [],
      eliminatedOption: null,
    });
  };

  const useBulletTime = () => {
    if (gameState.bulletTimeRemaining <= 0 || gameState.eliminatedOption !== null) return;
    
    const currentQ = questions[gameState.currentQuestion];
    // Find a wrong answer to eliminate (not the correct one)
    const wrongIndices = currentQ.options
      .map((_, i) => i)
      .filter(i => i !== currentQ.correctIndex);
    
    const randomWrong = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
    
    setGameState(prev => ({
      ...prev,
      bulletTimeRemaining: prev.bulletTimeRemaining - 1,
      eliminatedOption: randomWrong,
    }));
  };

  const fireShot = (selectedIndex: number, event: React.MouseEvent) => {
    if (showResult || gameState.status !== "playing" || bulletFiring) return;
    if (selectedIndex === gameState.eliminatedOption) return;
    
    const currentQ = questions[gameState.currentQuestion];
    const isCorrect = selectedIndex === currentQ.correctIndex;
    const basePoints = QUESTION_POINTS[gameState.currentQuestion];
    
    // Get target position for bullet animation
    const targetEl = targetRefs.current[selectedIndex];
    const targetRect = targetEl?.getBoundingClientRect();
    const endX = targetRect ? targetRect.left + targetRect.width / 2 : event.clientX;
    const endY = targetRect ? targetRect.top + targetRect.height / 2 : event.clientY;
    
    // Fire bullet from bottom center of screen
    setBulletFiring({
      startX: window.innerWidth / 2,
      startY: window.innerHeight - 50,
      endX,
      endY,
    });
    
    // Calculate points
    let points = 0;
    if (isCorrect) {
      points = basePoints;
      if (gameState.eliminatedOption !== null) {
        points = Math.floor(points * 0.75);
      }
      if (gameState.streak >= 2) {
        points = Math.floor(points * 1.5);
      }
    }
    
    const newStreak = isCorrect ? gameState.streak + 1 : 0;
    const newBestStreak = Math.max(gameState.bestStreak, newStreak);
    
    const answer = {
      questionIndex: gameState.currentQuestion,
      selectedIndex,
      correct: isCorrect,
      points,
      usedBulletTime: gameState.eliminatedOption !== null,
    };
    
    // Show impact effect after bullet arrives
    setTimeout(() => {
      setBulletFiring(null);
      setImpactEffect({ x: endX, y: endY, hit: isCorrect });
      setLastResult({ correct: isCorrect, points });
      setShowResult(true);
      
      // Update game state
      setGameState(prev => ({
        ...prev,
        score: prev.score + points,
        streak: newStreak,
        bestStreak: newBestStreak,
        answers: [...prev.answers, answer],
        eliminatedOption: null,
      }));
    }, 150);
    
    // Move to next question or finish
    setTimeout(() => {
      setShowResult(false);
      setLastResult(null);
      setHoveredOption(null);
      setImpactEffect(null);
      
      if (gameState.currentQuestion >= questions.length - 1) {
        setGameState(prev => ({ ...prev, status: "finished" }));
        submitScore();
      } else {
        setGameState(prev => ({
          ...prev,
          currentQuestion: prev.currentQuestion + 1,
        }));
      }
    }, 1500);
  };

  const submitScore = async () => {
    try {
      await fetch("/api/gaming/sniper-quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: gameState.score,
          answers: gameState.answers,
          perfectGame: gameState.answers.every(a => a.correct),
        }),
      });
    } catch (err) {
      console.error("Failed to submit score:", err);
    }
  };

  const restartGame = () => {
    fetchQuestions();
    setGameState({
      status: "ready",
      currentQuestion: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      bulletTimeRemaining: 3,
      answers: [],
      eliminatedOption: null,
    });
  };

  if (loading || authStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Crosshair className="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Loading targets...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[gameState.currentQuestion];
  const isPerfectSoFar = gameState.answers.every(a => a.correct);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden relative">
      {/* Sci-fi shooting range backdrop */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{ backgroundImage: "url('/empty-dark-room-modern-futuristic-sci-fi-background-3d-illustration.jpg')" }}
      />
      <div className="fixed inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
      {/* Firing Range Background */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,0,0,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,0,0,0.3) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
          }}
        />
        {/* Distance markers */}
        <div className="absolute bottom-20 left-0 right-0 flex justify-around text-red-900/30 text-xs font-mono">
          <span>10m</span>
          <span>25m</span>
          <span>50m</span>
          <span>75m</span>
          <span>100m</span>
        </div>
      </div>
      
      {/* Scope overlay effect */}
      {gameState.status === "playing" && (
        <div 
          className="fixed inset-0 pointer-events-none z-50 opacity-20"
          style={{
            background: `radial-gradient(circle at ${scopePosition.x}% ${scopePosition.y}%, transparent 80px, rgba(0,0,0,0.9) 250px)`,
          }}
        />
      )}
      
      {/* Sniper Scope Crosshair */}
      {gameState.status === "playing" && (
        <div 
          className="fixed pointer-events-none z-[55]"
          style={{ 
            left: `${scopePosition.x}%`, 
            top: `${scopePosition.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Outer ring */}
          <div className="w-16 h-16 border-2 border-red-500/40 rounded-full" />
          {/* Inner crosshairs */}
          <div className="absolute top-1/2 left-0 w-4 h-px bg-red-500/60 -translate-y-1/2" />
          <div className="absolute top-1/2 right-0 w-4 h-px bg-red-500/60 -translate-y-1/2" />
          <div className="absolute left-1/2 top-0 w-px h-4 bg-red-500/60 -translate-x-1/2" />
          <div className="absolute left-1/2 bottom-0 w-px h-4 bg-red-500/60 -translate-x-1/2" />
          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>
      )}

      {/* Header */}
      <nav className="relative z-50 border-b border-red-900/30 bg-black/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/game" className="flex items-center gap-2 text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            <span>Exit</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-yellow-500">
              <Trophy className="w-4 h-4" />
              <span className="font-bold">{gameState.score}</span>
            </div>
            
            {gameState.status === "playing" && (
              <>
                <div className="flex items-center gap-1">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i < gameState.bulletTimeRemaining ? "bg-cyan-400" : "bg-gray-700"
                      }`}
                    />
                  ))}
                </div>
                
                {gameState.streak >= 2 && (
                  <div className="flex items-center gap-1 text-orange-500">
                    <Flame className="w-4 h-4" />
                    <span className="text-sm font-bold">{gameState.streak}x</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Ready State */}
        {gameState.status === "ready" && (
          <div className="text-center py-20">
            <div className="relative inline-block mb-8">
              <Target className="w-32 h-32 text-red-500 mx-auto" />
              <div className="absolute inset-0 animate-ping">
                <Target className="w-32 h-32 text-red-500/30 mx-auto" />
              </div>
            </div>
            
            <h1 className="text-5xl font-black mb-4">
              <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                SNIPER QUIZ
              </span>
            </h1>
            
            <p className="text-gray-400 text-lg mb-8 max-w-md mx-auto">
              One shot. One chance. No second guessing.
              <br />
              <span className="text-red-400">Precision is everything.</span>
            </p>
            
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8 text-sm">
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                <Target className="w-6 h-6 text-red-500 mx-auto mb-2" />
                <p className="text-gray-400">10 Targets</p>
              </div>
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                <Zap className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                <p className="text-gray-400">3 Bullet Time</p>
              </div>
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                <Flame className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                <p className="text-gray-400">Streak Bonus</p>
              </div>
            </div>
            
            <Button
              size="lg"
              onClick={startGame}
              className="bg-red-600 hover:bg-red-500 text-white font-bold text-xl px-12 py-6 rounded-xl"
            >
              <Crosshair className="w-6 h-6 mr-2" />
              TAKE AIM
            </Button>
          </div>
        )}

        {/* Playing State - Firing Range */}
        {gameState.status === "playing" && currentQuestion && (
          <div className="py-4 relative">
            {/* Bullet Animation */}
            {bulletFiring && (
              <BulletTrail
                startX={bulletFiring.startX}
                startY={bulletFiring.startY}
                endX={bulletFiring.endX}
                endY={bulletFiring.endY}
                onComplete={() => {}}
              />
            )}
            
            {/* Impact Effect */}
            {impactEffect && (
              <div 
                className="fixed z-[70] pointer-events-none"
                style={{ left: impactEffect.x, top: impactEffect.y, transform: "translate(-50%, -50%)" }}
              >
                {impactEffect.hit ? (
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-green-500/30 animate-ping" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                        <span className="text-white text-xl">✓</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-red-500/30 animate-ping" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <X className="w-10 h-10 text-red-500" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* HUD - Top */}
            <div className="flex items-center justify-between mb-4 px-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-red-500 font-mono">
                  TARGET {gameState.currentQuestion + 1}/{questions.length}
                </div>
                {gameState.streak >= 2 && (
                  <div className="flex items-center gap-1 text-orange-500 animate-pulse">
                    <Flame className="w-4 h-4" />
                    <span className="text-sm font-bold">{gameState.streak}x STREAK</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 bg-black/50 px-3 py-1 rounded border border-yellow-500/30">
                <span className="text-yellow-500 font-bold text-lg">
                  {QUESTION_POINTS[gameState.currentQuestion]}
                </span>
                <span className="text-yellow-500/70 text-xs">PTS</span>
              </div>
            </div>
            
            {/* Progress bar - ammo style */}
            <div className="flex gap-1 mb-6 px-4">
              {[...Array(questions.length)].map((_, i) => (
                <div 
                  key={i}
                  className={`h-2 flex-1 rounded-sm transition-all ${
                    i < gameState.currentQuestion 
                      ? gameState.answers[i]?.correct 
                        ? "bg-green-500" 
                        : "bg-red-500"
                      : i === gameState.currentQuestion
                        ? "bg-yellow-500 animate-pulse"
                        : "bg-gray-800"
                  }`}
                />
              ))}
            </div>

            {/* Question - Holographic Display */}
            <div className="relative mb-6 mx-4">
              <div className="relative bg-black/40 backdrop-blur-md border border-cyan-500/30 rounded-lg p-5">
                {/* Topic tag */}
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-black/60 border border-cyan-500/40 rounded text-[10px] text-cyan-400 font-mono uppercase tracking-wider">
                  {currentQuestion.topic}
                </div>
                
                <h2 className="text-lg font-medium text-center text-white leading-relaxed">
                  {currentQuestion.question}
                </h2>
              </div>
            </div>

            {/* Shooting Range with Perspective */}
            <div className="relative mt-16" style={{ perspective: "1000px" }}>
              {/* Distance marker - subtle */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-4 px-3 py-0.5 text-[10px] text-red-500/40 font-mono z-10">
                50m
              </div>
              
              {/* All 4 Targets in a row at 50m - at the back wall */}
              <div 
                className="flex justify-center items-start gap-10 px-4 pt-2 pb-24"
                style={{ 
                  transform: "rotateX(3deg) translateY(40px) scale(0.85)",
                  transformOrigin: "center bottom",
                }}
              >
                {currentQuestion.options.map((option, idx) => {
                  const isEliminated = idx === gameState.eliminatedOption;
                  const isHovered = hoveredOption === idx;
                  const isCorrect = idx === currentQuestion.correctIndex;
                  const wasSelected = gameState.answers[gameState.answers.length - 1]?.selectedIndex === idx;
                  
                  return (
                    <button
                      key={idx}
                      ref={el => { targetRefs.current[idx] = el; }}
                      disabled={showResult || isEliminated || !!bulletFiring}
                      onClick={(e) => fireShot(idx, e)}
                      onMouseEnter={() => !isEliminated && !bulletFiring && setHoveredOption(idx)}
                      onMouseLeave={() => setHoveredOption(null)}
                      className={`
                        group relative flex flex-col items-center transition-all duration-300
                        ${isEliminated ? "opacity-20 cursor-not-allowed" : "cursor-crosshair"}
                        ${isHovered && !showResult ? "scale-110 z-10" : ""}
                      `}
                    >
                      {/* Target with stand - fixed height container */}
                      <div className="relative flex flex-col items-center">
                    
                      {/* The Circular Target - all same size at 50m, fixed position */}
                      <div className={`
                        relative w-20 h-20 rounded-full transition-all duration-300 flex-shrink-0
                        ${showResult && isCorrect 
                          ? "shadow-[0_0_40px_rgba(34,197,94,0.6)]" 
                          : showResult && wasSelected && !isCorrect
                            ? "shadow-[0_0_40px_rgba(239,68,68,0.6)]"
                            : isHovered && !showResult
                              ? "shadow-[0_0_30px_rgba(239,68,68,0.4)]"
                              : ""
                        }
                      `}>
                        {/* Outer ring - white */}
                        <div className={`
                          absolute inset-0 rounded-full border-[3px] transition-colors
                          ${showResult && isCorrect ? "border-green-400 bg-green-500/10" : ""}
                          ${showResult && wasSelected && !isCorrect ? "border-red-400 bg-red-500/10" : ""}
                          ${!showResult ? "border-white/80 bg-white/5" : ""}
                          ${isEliminated ? "border-gray-600" : ""}
                        `} />
                        
                        {/* Ring 2 - black */}
                        <div className={`
                          absolute inset-[5px] rounded-full border-[2px] transition-colors
                          ${showResult && isCorrect ? "border-green-500" : ""}
                          ${showResult && wasSelected && !isCorrect ? "border-red-500" : ""}
                          ${!showResult ? "border-gray-900" : ""}
                        `} />
                        
                        {/* Ring 3 - blue */}
                        <div className={`
                          absolute inset-[10px] rounded-full border-[2px] transition-colors
                          ${showResult && isCorrect ? "border-green-400" : ""}
                          ${showResult && wasSelected && !isCorrect ? "border-red-400" : ""}
                          ${!showResult ? "border-blue-500" : ""}
                        `} />
                        
                        {/* Ring 4 - red */}
                        <div className={`
                          absolute inset-[16px] rounded-full border-[2px] transition-colors
                          ${showResult && isCorrect ? "border-green-500" : ""}
                          ${showResult && wasSelected && !isCorrect ? "border-red-500" : ""}
                          ${!showResult ? "border-red-500" : ""}
                        `} />
                        
                        {/* Bullseye - yellow/gold center */}
                        <div className={`
                          absolute inset-[24px] rounded-full transition-all
                          ${showResult && isCorrect ? "bg-green-500" : ""}
                          ${showResult && wasSelected && !isCorrect ? "bg-red-500" : ""}
                          ${!showResult ? "bg-yellow-500" : ""}
                          ${isHovered && !showResult ? "animate-pulse" : ""}
                        `}>
                          {/* Letter in center */}
                          <span className={`
                            absolute inset-0 flex items-center justify-center font-black text-xs
                            ${showResult ? "text-white" : "text-black"}
                          `}>
                            {String.fromCharCode(65 + idx)}
                          </span>
                        </div>
                        
                        {/* Hit marker overlay */}
                        {showResult && isCorrect && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-green-400 rounded-full animate-ping" />
                          </div>
                        )}
                        
                        {/* Miss X overlay */}
                        {showResult && wasSelected && !isCorrect && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <X className="w-12 h-12 text-red-500 stroke-[3]" />
                          </div>
                        )}
                        
                        {/* Crosshair on hover */}
                        {isHovered && lockedOn && !showResult && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Crosshair className="w-8 h-8 text-red-500 animate-pulse" />
                          </div>
                        )}
                        
                        {/* Eliminated overlay */}
                        {isEliminated && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
                            <span className="text-cyan-400 text-[8px] font-bold">OUT</span>
                          </div>
                        )}
                      </div>
                      
                        {/* Target post/stand - holographic, extends to floor */}
                        <div className="w-px h-24 bg-gradient-to-b from-cyan-500/40 via-cyan-500/20 to-transparent" />
                      </div>
                      
                      {/* Answer text - positioned way below at the "floor" level */}
                      <div 
                        className={`
                          absolute left-1/2
                          px-4 py-2 rounded text-center text-sm min-w-[90px] max-w-[150px] transition-all backdrop-blur-sm
                          ${showResult && isCorrect 
                            ? "bg-green-500/20 text-green-300 border border-green-500/40 shadow-lg shadow-green-500/20" 
                            : showResult && wasSelected && !isCorrect
                              ? "bg-red-500/20 text-red-300 border border-red-500/40 shadow-lg shadow-red-500/20"
                              : isHovered && !showResult
                                ? "bg-cyan-500/20 text-white border border-cyan-400/50 shadow-lg shadow-cyan-500/20"
                                : "bg-black/60 text-gray-100 border border-cyan-500/30"
                          }
                        `}
                        style={{ 
                          transform: "translateX(-50%) scale(1.15)",
                          top: "180px"
                        }}
                      >
                        {option}
                      </div>
                    </button>
                );
              })}
              </div>
            </div>

            {/* Bullet Time Button */}
            {gameState.bulletTimeRemaining > 0 && gameState.eliminatedOption === null && !showResult && (
              <div className="text-center mt-20">
                <button
                  onClick={useBulletTime}
                  className="px-5 py-2.5 bg-black/40 backdrop-blur-sm border border-cyan-500/40 rounded text-cyan-400 text-sm hover:bg-cyan-500/20 hover:border-cyan-400 transition-all flex items-center gap-2 mx-auto"
                >
                  <Eye className="w-4 h-4" />
                  <span>Bullet Time ({gameState.bulletTimeRemaining} left) - Eliminates 1 wrong answer</span>
                </button>
                <p className="text-[10px] text-cyan-500/40 mt-2">Costs 25% of question points</p>
              </div>
            )}

            {/* Result overlay */}
            {showResult && lastResult && (
              <div className={`
                fixed inset-0 z-[80] flex items-center justify-center pointer-events-none
                ${lastResult.correct ? "bg-green-900/40" : "bg-red-900/40"}
              `}>
                <div className="text-center animate-in zoom-in-50 duration-200">
                  {lastResult.correct ? (
                    <>
                      <div className="relative mb-4">
                        <Target className="w-24 h-24 text-green-500 mx-auto" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-4 h-4 bg-green-400 rounded-full animate-ping" />
                        </div>
                      </div>
                      <p className="text-5xl font-black text-green-400 tracking-wider">HEADSHOT!</p>
                      <p className="text-3xl text-green-300 font-bold mt-2">+{lastResult.points}</p>
                    </>
                  ) : (
                    <>
                      <div className="relative mb-4">
                        <Target className="w-24 h-24 text-red-500/50 mx-auto" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <X className="w-16 h-16 text-red-500" />
                        </div>
                      </div>
                      <p className="text-5xl font-black text-red-400 tracking-wider">MISSED!</p>
                      <p className="text-xl text-red-300/70 mt-2">Target got away</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Finished State */}
        {gameState.status === "finished" && (
          <div className="text-center py-12">
            <div className="relative w-32 h-32 mx-auto mb-6">
              {isPerfectSoFar ? (
                <>
                  <Trophy className="w-32 h-32 text-yellow-500" />
                  <div className="absolute inset-0 animate-ping">
                    <Trophy className="w-32 h-32 text-yellow-500/30" />
                  </div>
                </>
              ) : gameState.score > 300 ? (
                <Target className="w-32 h-32 text-green-500" />
              ) : (
                <Target className="w-32 h-32 text-gray-500" />
              )}
            </div>
            
            <h1 className="text-4xl font-black mb-2">
              {isPerfectSoFar ? (
                <span className="text-yellow-400">PERFECT GAME!</span>
              ) : gameState.score > 300 ? (
                <span className="text-green-400">NICE SHOOTING!</span>
              ) : (
                <span className="text-gray-400">MISSION COMPLETE</span>
              )}
            </h1>
            
            <p className="text-6xl font-black text-yellow-500 mb-8">
              {gameState.score}
              {isPerfectSoFar && <span className="text-2xl ml-2">x2 = {gameState.score * 2}</span>}
            </p>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                <p className="text-3xl font-bold text-green-400">
                  {gameState.answers.filter(a => a.correct).length}
                </p>
                <p className="text-sm text-gray-500">Hits</p>
              </div>
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                <p className="text-3xl font-bold text-red-400">
                  {gameState.answers.filter(a => !a.correct).length}
                </p>
                <p className="text-sm text-gray-500">Misses</p>
              </div>
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                <p className="text-3xl font-bold text-orange-400">
                  {gameState.bestStreak}
                </p>
                <p className="text-sm text-gray-500">Best Streak</p>
              </div>
            </div>
            
            {/* Accuracy */}
            <div className="max-w-md mx-auto mb-8">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Accuracy</span>
                <span className="text-white font-bold">
                  {Math.round((gameState.answers.filter(a => a.correct).length / gameState.answers.length) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-500 to-green-500"
                  style={{ 
                    width: `${(gameState.answers.filter(a => a.correct).length / gameState.answers.length) * 100}%` 
                  }}
                />
              </div>
            </div>
            
            {/* Actions */}
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
                onClick={restartGame}
                className="bg-red-600 hover:bg-red-500 gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
