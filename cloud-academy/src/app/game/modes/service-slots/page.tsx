"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { 
  ArrowLeft, 
  Loader2, 
  DollarSign,
  Trophy,
  Flame,
  Volume2,
  VolumeX,
  Zap,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AWS_SERVICES, AWS_CATEGORY_COLORS, type AWSService } from "@/lib/aws-services";

// =============================================================================
// TYPES
// =============================================================================

interface SlotService {
  service_id: string;
  service_name: string;
  category: string;
}

interface AnswerOption {
  id: string;
  text: string;
  is_correct: boolean;
  explanation: string;
}

interface Challenge {
  id: string;
  services: SlotService[];
  pattern_name: string;
  pattern_description: string;
  options: AnswerOption[];
  difficulty: string;
  base_payout: number;
}

interface GameState {
  balance: number;
  totalWinnings: number;
  currentStreak: number;
  bestStreak: number;
  gamesPlayed: number;
  gamesWon: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = "service-slots-state";
const DEFAULT_BET = 100;
const MIN_BET = 50;
const MAX_BET = 500;
const STARTING_BALANCE = 1000;

const DIFFICULTY_COLORS = {
  easy: "text-green-400 bg-green-500/20 border-green-500/30",
  medium: "text-amber-400 bg-amber-500/20 border-amber-500/30",
  hard: "text-red-400 bg-red-500/20 border-red-500/30",
};

// AWS Brand Colors
const AWS_ORANGE = "#FF9900";
const AWS_DARK = "#232F3E";

// =============================================================================
// STORAGE HELPERS
// =============================================================================

function getDefaultGameState(): GameState {
  return {
    balance: STARTING_BALANCE,
    totalWinnings: 0,
    currentStreak: 0,
    bestStreak: 0,
    gamesPlayed: 0,
    gamesWon: 0,
  };
}

// Load from localStorage as fallback/cache
function loadLocalGameState(): GameState {
  if (typeof window === "undefined") {
    return getDefaultGameState();
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load local game state:", e);
  }
  
  return getDefaultGameState();
}

// Save to localStorage (for quick access) and database (for persistence)
async function saveGameState(state: GameState) {
  if (typeof window === "undefined") return;
  
  // Save to localStorage immediately
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
  
  // Save to database in background
  try {
    await fetch("/api/gaming/slots/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  } catch (e) {
    console.error("Failed to save to database:", e);
  }
}

// Load from database (primary) with localStorage fallback
async function loadGameStateFromDB(): Promise<GameState> {
  try {
    const response = await fetch("/api/gaming/slots/state");
    if (response.ok) {
      const data = await response.json();
      // Also update localStorage cache
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
      return data;
    }
  } catch (e) {
    console.error("Failed to load from database:", e);
  }
  
  // Fallback to localStorage
  return loadLocalGameState();
}

// =============================================================================
// SLOT MACHINE HANDLE COMPONENT
// =============================================================================

function SlotHandle({ 
  onPull, 
  disabled,
  isSpinning 
}: { 
  onPull: () => void; 
  disabled: boolean;
  isSpinning: boolean;
}) {
  const controls = useAnimation();
  const [isPulling, setIsPulling] = useState(false);
  
  const handlePull = async () => {
    if (disabled || isPulling) return;
    
    setIsPulling(true);
    
    // Animate handle down
    await controls.start({
      y: 80,
      transition: { duration: 0.3, ease: "easeOut" }
    });
    
    // Trigger the spin
    onPull();
    
    // Wait a moment then spring back
    await new Promise(resolve => setTimeout(resolve, 300));
    
    await controls.start({
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 15 }
    });
    
    setIsPulling(false);
  };

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Glow effect behind lever */}
      <motion.div
        className="absolute -inset-4 rounded-full blur-xl"
        style={{ background: 'radial-gradient(circle, rgba(255,0,0,0.3) 0%, transparent 70%)' }}
        animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      
      {/* Chrome lever housing - BIGGER */}
      <div 
        className="w-10 h-52 rounded-full relative"
        style={{ 
          background: `linear-gradient(90deg, #5a4a3a 0%, #C0A060 20%, #FFD700 50%, #C0A060 80%, #5a4a3a 100%)`,
          boxShadow: '0 8px 30px rgba(0,0,0,0.6), inset 0 3px 6px rgba(255,255,255,0.4), 0 0 40px rgba(255,215,0,0.3)'
        }}
      >
        {/* Inner track groove */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-3 bottom-3 w-4 rounded-full"
          style={{
            background: 'linear-gradient(90deg, #0a0a0a, #222, #0a0a0a)',
            boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.9)'
          }}
        />

        {/* Handle arm - moves up and down */}
        <motion.div
          animate={controls}
          style={{ 
            position: 'absolute',
            top: '12px',
            left: '50%',
            marginLeft: '-6px',
            zIndex: 10
          }}
          className="cursor-pointer"
          onClick={handlePull}
        >
          {/* Chrome shaft - THICKER */}
          <div 
            className="w-3 h-28 rounded-full"
            style={{ 
              background: `linear-gradient(90deg, #666 0%, #aaa 25%, #eee 50%, #aaa 75%, #666 100%)`,
              boxShadow: '0 6px 15px rgba(0,0,0,0.5)'
            }}
          />
          
          {/* Big red ball grip - BIGGER & SHINIER */}
          <motion.div 
            className="w-16 h-16 rounded-full -ml-[26px] -mt-2 flex items-center justify-center"
            style={{ 
              background: `radial-gradient(circle at 30% 30%, #ff6666 0%, #ff0000 40%, #cc0000 70%, #880000 100%)`,
              boxShadow: `
                0 8px 30px rgba(255,0,0,0.6), 
                0 0 60px rgba(255,0,0,0.4),
                inset 0 -6px 15px rgba(0,0,0,0.4), 
                inset 0 6px 15px rgba(255,255,255,0.4)
              `,
              border: '4px solid #660000'
            }}
            whileHover={{ scale: disabled ? 1 : 1.15, boxShadow: '0 8px 40px rgba(255,0,0,0.8), 0 0 80px rgba(255,0,0,0.5)' }}
            whileTap={{ scale: disabled ? 1 : 0.9 }}
          >
            {isSpinning ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-6 h-6 text-white drop-shadow-lg" />
              </motion.div>
            ) : (
              <div className="w-3 h-3 rounded-full bg-white/40" />
            )}
          </motion.div>
        </motion.div>
      </div>
      
      {/* Pull instruction - MORE PROMINENT */}
      {!disabled && !isSpinning && (
        <motion.div 
          className="mt-4 text-center"
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <motion.p 
            className="text-sm text-yellow-300 font-black tracking-widest drop-shadow-lg"
            animate={{ opacity: [0.6, 1, 0.6], textShadow: ['0 0 10px #ffd700', '0 0 20px #ffd700', '0 0 10px #ffd700'] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ⬇ PULL ⬇
          </motion.p>
        </motion.div>
      )}
    </div>
  );
}

// =============================================================================
// SLOT REEL COMPONENT (Vertical spinning)
// =============================================================================

function SlotReel({ 
  service, 
  isSpinning, 
  delay = 0,
  reelIndex = 0,
}: { 
  service: SlotService | null;
  isSpinning: boolean;
  delay?: number;
  reelIndex?: number;
}) {
  const [spinningService, setSpinningService] = useState<AWSService | null>(null);
  const [isReelSpinning, setIsReelSpinning] = useState(false);
  
  // Get color for service
  const getServiceColor = (svc: SlotService | AWSService | null) => {
    if (!svc) return "#64748b";
    const category = svc.category as keyof typeof AWS_CATEGORY_COLORS;
    return AWS_CATEGORY_COLORS[category] || "#64748b";
  };
  
  // Find full service info
  const fullService = service 
    ? AWS_SERVICES.find(s => s.id === service.service_id) ?? null
    : null;

  useEffect(() => {
    if (!isSpinning) {
      return;
    }
    
    // Start spinning after delay
    const startTimeout = setTimeout(() => {
      setIsReelSpinning(true);
      
      // Rapidly cycle through random services
      const interval = setInterval(() => {
        const randomService = AWS_SERVICES[Math.floor(Math.random() * AWS_SERVICES.length)];
        setSpinningService(randomService);
      }, 80);
      
      // Stop after spin duration (staggered by reel index)
      const spinDuration = 1500 + reelIndex * 500;
      const stopTimeout = setTimeout(() => {
        clearInterval(interval);
        setIsReelSpinning(false);
      }, spinDuration);
      
      return () => {
        clearInterval(interval);
        clearTimeout(stopTimeout);
      };
    }, delay);
    
    return () => {
      clearTimeout(startTimeout);
    };
  }, [isSpinning, delay, reelIndex]);

  // Show spinning service while spinning, otherwise show the actual service
  const currentService = isReelSpinning ? spinningService : fullService;
  const color = getServiceColor(currentService);

  return (
    <div className="relative">
      {/* Glow behind reel when not spinning */}
      {!isReelSpinning && currentService && (
        <motion.div
          className="absolute -inset-2 rounded-2xl blur-lg -z-10"
          style={{ background: `${color}40` }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      
      {/* BIGGER Golden reel frame */}
      <div 
        className="relative w-40 h-48 rounded-2xl"
        style={{
          background: `linear-gradient(180deg, #FFE55C 0%, #FFD700 15%, #DAA520 50%, #FFD700 85%, #FFE55C 100%)`,
          boxShadow: `
            0 10px 40px rgba(0,0,0,0.5),
            0 0 60px rgba(255,215,0,0.3),
            inset 0 3px 6px rgba(255,255,255,0.6),
            inset 0 -3px 6px rgba(0,0,0,0.3)
          `,
          padding: '8px'
        }}
      >
        {/* Inner reel window - BIGGER */}
        <div
          className="relative w-full h-full rounded-xl overflow-hidden"
          style={{
            background: `linear-gradient(180deg, #fffff0 0%, #ffffff 50%, #fffff0 100%)`,
            boxShadow: `
              inset 0 6px 20px rgba(0,0,0,0.25),
              inset 0 -6px 20px rgba(0,0,0,0.15)
            `,
            border: '4px solid #B8860B'
          }}
        >
        {/* Glass shine effect */}
        <div 
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.2) 25%, transparent 50%)'
          }}
        />
        
        {/* Spinning blur overlay with more energy */}
        {isReelSpinning && (
          <motion.div 
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, rgba(255,215,0,0.4) 0%, rgba(255,255,255,0.1) 50%, rgba(255,215,0,0.4) 100%)',
            }}
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 0.2, repeat: Infinity }}
          />
        )}
        
        {/* Reel content - BIGGER */}
        <div className="flex flex-col items-center justify-center h-full p-3">
          {currentService ? (
            <motion.div
              key={currentService.id}
              initial={{ scale: 0.5, opacity: 0, y: isReelSpinning ? -30 : 0 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.12, type: "spring", stiffness: 500 }}
              className="flex flex-col items-center text-center"
            >
              {/* BIG BOLD symbol */}
              <motion.div 
                className="w-20 h-20 rounded-xl flex items-center justify-center mb-2 relative"
                style={{ 
                  background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
                  boxShadow: `
                    0 6px 20px ${color}80, 
                    0 0 40px ${color}40,
                    inset 0 2px 4px rgba(255,255,255,0.4),
                    inset 0 -2px 4px rgba(0,0,0,0.2)
                  `
                }}
                animate={!isReelSpinning ? {
                  scale: [1, 1.08, 1],
                  boxShadow: [
                    `0 6px 20px ${color}80, 0 0 40px ${color}40`,
                    `0 8px 30px ${color}aa, 0 0 60px ${color}60`,
                    `0 6px 20px ${color}80, 0 0 40px ${color}40`
                  ]
                } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <span className="text-4xl font-black text-white drop-shadow-lg" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                  {currentService.shortName?.charAt(0) || currentService.name.charAt(0)}
                </span>
              </motion.div>
              
              {/* Service name - bolder */}
              <span className="text-sm font-black text-gray-800 leading-tight drop-shadow-sm">
                {currentService.shortName || currentService.name}
              </span>
            </motion.div>
          ) : (
            <motion.div 
              className="text-gray-300 text-6xl font-black"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              ?
            </motion.div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function ServiceSlotsPage() {
  // Game state - start with localStorage for instant display, then sync with DB
  const [gameState, setGameState] = useState<GameState>(getDefaultGameState);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Current round state
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [challengeQueue, setChallengeQueue] = useState<Challenge[]>([]); // Pre-generated challenges
  const [isLoading, setIsLoading] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [result, setResult] = useState<{
    correct: boolean;
    winnings: number;
    explanation: string;
  } | null>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false); // Background fetch flag
  
  // Betting
  const [betAmount, setBetAmount] = useState(DEFAULT_BET);
  
  // Sound
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Error state
  const [error, setError] = useState<string | null>(null);

  // Initialize - load from localStorage first (fast), then sync with database
  useEffect(() => {
    // Load localStorage immediately for fast initial render
    const localState = loadLocalGameState();
    setGameState(localState);
    
    // Then fetch from database and update if different
    loadGameStateFromDB().then((dbState) => {
      setGameState(dbState);
      setIsInitialized(true);
    });
  }, []);

  // Save state on change (debounced to avoid too many DB writes)
  useEffect(() => {
    if (isInitialized) {
      saveGameState(gameState);
    }
  }, [gameState, isInitialized]);

  // Fetch a single challenge from API
  const fetchSingleChallenge = useCallback(async (): Promise<Challenge | null> => {
    try {
      const response = await fetch("/api/gaming/slots/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate challenge");
      }
      
      return await response.json();
    } catch (err) {
      console.error("Failed to fetch challenge:", err);
      return null;
    }
  }, []);

  // Background fetch more challenges when queue is low
  const fetchMoreChallenges = useCallback(async (count: number = 5) => {
    if (isFetchingMore) return;
    setIsFetchingMore(true);
    
    try {
      const promises = Array(count).fill(null).map(() => fetchSingleChallenge());
      const results = await Promise.all(promises);
      const validChallenges = results.filter((c): c is Challenge => c !== null);
      
      setChallengeQueue(prev => [...prev, ...validChallenges]);
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, fetchSingleChallenge]);

  // Generate new challenge - uses queue if available, otherwise fetches
  const generateChallenge = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setChallenge(null);
    setShowOptions(false);
    setSelectedOption(null);
    setResult(null);
    
    try {
      // Try to use queued challenge first
      if (challengeQueue.length > 0) {
        const [nextChallenge, ...remaining] = challengeQueue;
        setChallenge(nextChallenge);
        setChallengeQueue(remaining);
        
        // If queue is getting low (2 or less), fetch more in background
        if (remaining.length <= 2 && !isFetchingMore) {
          fetchMoreChallenges(5);
        }
      } else {
        // No queued challenges, fetch one directly
        const data = await fetchSingleChallenge();
        if (data) {
          setChallenge(data);
          // Also start fetching more in background
          fetchMoreChallenges(5);
        } else {
          throw new Error("Failed to generate challenge");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load challenge");
    } finally {
      setIsLoading(false);
    }
  }, [challengeQueue, isFetchingMore, fetchSingleChallenge, fetchMoreChallenges]);

  // Handle spin
  const handleSpin = async () => {
    if (!challenge || isSpinning || gameState.balance < betAmount) return;
    
    // Deduct bet
    setGameState(prev => ({
      ...prev,
      balance: prev.balance - betAmount,
    }));
    
    setIsSpinning(true);
    setShowOptions(false);
    setResult(null);
    
    // Wait for spin animation
    setTimeout(() => {
      setIsSpinning(false);
      setShowOptions(true);
    }, 2500);
  };

  // Handle answer selection
  const handleAnswer = async (optionId: string) => {
    if (!challenge || selectedOption) return;
    
    setSelectedOption(optionId);
    
    try {
      const response = await fetch("/api/gaming/slots/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: challenge.id,
          services: challenge.services,
          pattern_name: challenge.pattern_name,
          options: challenge.options,
          difficulty: challenge.difficulty,
          base_payout: challenge.base_payout,
          selected_option_id: optionId,
          bet_amount: betAmount,
        }),
      });
      
      const data = await response.json();
      
      setResult({
        correct: data.correct,
        winnings: data.winnings,
        explanation: data.explanation,
      });
      
      // Update game state
      setGameState(prev => {
        const newStreak = data.correct ? prev.currentStreak + 1 : 0;
        return {
          ...prev,
          balance: prev.balance + (data.correct ? data.winnings : 0),
          totalWinnings: prev.totalWinnings + (data.correct ? data.winnings - betAmount : -betAmount),
          currentStreak: newStreak,
          bestStreak: Math.max(prev.bestStreak, newStreak),
          gamesPlayed: prev.gamesPlayed + 1,
          gamesWon: prev.gamesWon + (data.correct ? 1 : 0),
        };
      });
    } catch (err) {
      console.error("Validation error:", err);
    }
  };

  // Reset balance (when broke)
  const resetBalance = () => {
    setGameState(prev => ({
      ...prev,
      balance: STARTING_BALANCE,
      currentStreak: 0,
    }));
    setChallenge(null);
  };

  // Streak multiplier
  const streakMultiplier = gameState.currentStreak >= 5 ? 3 : 
                          gameState.currentStreak >= 4 ? 2.5 :
                          gameState.currentStreak >= 3 ? 2 :
                          gameState.currentStreak >= 2 ? 1.5 : 1;

  return (
    <div 
      className="min-h-screen text-white overflow-hidden"
      style={{ 
        background: `radial-gradient(ellipse at center top, ${AWS_DARK} 0%, #0a0f14 50%, #050709 100%)`
      }}
    >
      {/* DRAMATIC Casino lighting effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Central spotlight burst behind machine */}
        <motion.div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px]"
          style={{
            background: 'radial-gradient(circle, rgba(255,215,0,0.4) 0%, rgba(255,153,0,0.2) 30%, transparent 70%)',
          }}
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.6, 0.9, 0.6]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Rotating light rays */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px]"
          style={{
            background: `conic-gradient(from 0deg, transparent, rgba(255,215,0,0.1) 10%, transparent 20%, transparent, rgba(255,153,0,0.1) 60%, transparent 70%)`,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Floating sparkles */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: i % 2 === 0 ? '#FFD700' : '#FF9900',
              boxShadow: `0 0 10px ${i % 2 === 0 ? '#FFD700' : '#FF9900'}`,
              left: `${10 + (i * 7)}%`,
              top: `${20 + (i % 4) * 20}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 2 + (i % 3),
              repeat: Infinity,
              delay: i * 0.3,
            }}
          />
        ))}
        
        {/* Corner glows */}
        <div 
          className="absolute -top-20 -left-20 w-80 h-80 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #FFD700, transparent)' }}
        />
        <div 
          className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #FF9900, transparent)' }}
        />
        <div 
          className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-96 h-40 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(ellipse, #FFD700, transparent)' }}
        />
      </div>

      {/* Header - Compact */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-md border-b border-orange-500/20">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/game">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-orange-400">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${AWS_ORANGE}, #cc7a00)` }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
                AWS Service Slots
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Streak */}
            {gameState.currentStreak > 0 && (
              <motion.div 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(249,115,22,0.3), rgba(234,88,12,0.2))',
                  border: '1px solid rgba(249,115,22,0.5)'
                }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-bold text-orange-400">{gameState.currentStreak}</span>
                {streakMultiplier > 1 && (
                  <span className="text-xs text-orange-300">({streakMultiplier}x)</span>
                )}
              </motion.div>
            )}
            
            {/* Balance */}
            <div 
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg"
              style={{ 
                background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(22,163,74,0.1))',
                border: '1px solid rgba(34,197,94,0.4)'
              }}
            >
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-base font-bold text-green-400">
                {gameState.balance.toLocaleString()}
              </span>
            </div>
            
            {/* Sound toggle */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="text-slate-400 hover:text-orange-400"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16 pb-4 px-4 min-h-screen flex flex-col items-center justify-center">
        
        {/* Welcome / No Challenge State */}
        {!challenge && !isLoading && !error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            {/* Mini slot machine preview */}
            <div 
              className="w-32 h-32 mx-auto mb-6 rounded-2xl flex items-center justify-center"
              style={{ 
                background: `linear-gradient(180deg, ${AWS_DARK}, #0f1419)`,
                border: `3px solid ${AWS_ORANGE}40`,
                boxShadow: `0 0 40px ${AWS_ORANGE}30`
              }}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-16 h-16 text-orange-400" />
              </motion.div>
            </div>
            
            <h2 
              className="text-4xl font-bold mb-4 bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 bg-clip-text text-transparent"
            >
              AWS Service Slots
            </h2>
            <p className="text-slate-400 max-w-md mx-auto mb-8">
              Spin the reels, land on 3 AWS services, and identify the architecture pattern. 
              Win big if you know your AWS!
            </p>
            
            {/* Stats */}
            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">${gameState.balance.toLocaleString()}</p>
                <p className="text-xs text-slate-500">Balance</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-400">{gameState.bestStreak}</p>
                <p className="text-xs text-slate-500">Best Streak</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-cyan-400">
                  {gameState.gamesPlayed > 0 
                    ? Math.round((gameState.gamesWon / gameState.gamesPlayed) * 100) 
                    : 0}%
                </p>
                <p className="text-xs text-slate-500">Win Rate</p>
              </div>
            </div>
            
            <Button 
              onClick={generateChallenge}
              size="lg"
              className="gap-2 text-lg px-10 py-6 text-white font-bold"
              style={{ 
                background: `linear-gradient(135deg, ${AWS_ORANGE}, #cc7a00)`,
                boxShadow: `0 4px 20px ${AWS_ORANGE}50`
              }}
            >
              <Zap className="w-5 h-5" />
              Start Playing
            </Button>
          </motion.div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="w-16 h-16 text-orange-400" />
            </motion.div>
            <p className="text-slate-400 mt-4">Loading challenge...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={generateChallenge}>Try Again</Button>
          </div>
        )}

        {/* SLOT MACHINE CABINET */}
        {challenge && !isLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center w-full max-w-3xl"
          >
            {/* EPIC Golden Slot Machine Cabinet */}
            <div className="relative">
              {/* Glow behind entire machine */}
              <motion.div
                className="absolute -inset-8 rounded-[40px] blur-2xl -z-10"
                style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.5) 0%, rgba(255,153,0,0.3) 40%, transparent 70%)' }}
                animate={{ opacity: [0.6, 1, 0.6], scale: [0.98, 1.02, 0.98] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              
              <div 
                className="relative rounded-3xl"
                style={{ 
                  background: `linear-gradient(180deg, #FFE55C 0%, #FFD700 10%, #DAA520 30%, #B8860B 50%, #DAA520 70%, #FFD700 90%, #FFE55C 100%)`,
                  padding: '16px',
                  boxShadow: `
                    0 30px 80px rgba(0,0,0,0.7), 
                    0 0 120px rgba(255,215,0,0.4),
                    inset 0 2px 4px rgba(255,255,255,0.6),
                    inset 0 -2px 4px rgba(0,0,0,0.3)
                  `
                }}
              >
                {/* Inner cabinet body - DEEP RED */}
                <div 
                  className="rounded-2xl p-6 relative overflow-hidden"
                  style={{ 
                    background: `linear-gradient(180deg, #a01010 0%, #8B0000 20%, #660000 50%, #4a0000 80%, #330000 100%)`,
                    boxShadow: 'inset 0 6px 30px rgba(255,100,100,0.15), inset 0 -6px 30px rgba(0,0,0,0.6)'
                  }}
                >
                  {/* Decorative corner accents */}
                  <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-yellow-400/50 rounded-tl-lg" />
                  <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-yellow-400/50 rounded-tr-lg" />
                  <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-yellow-400/50 rounded-bl-lg" />
                  <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-yellow-400/50 rounded-br-lg" />
                  
                  {/* JACKPOT Marquee with lights */}
                  <div className="relative mb-6">
                    {/* Light bulbs row - TOP */}
                    <div className="flex justify-center gap-3 mb-3">
                      {[...Array(16)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="w-4 h-4 rounded-full"
                          style={{ 
                            background: `radial-gradient(circle at 30% 30%, ${i % 3 === 0 ? '#ffff88' : i % 3 === 1 ? '#ff8844' : '#ff4444'}, ${i % 3 === 0 ? '#ffcc00' : i % 3 === 1 ? '#ff6600' : '#cc0000'})`,
                            boxShadow: `0 0 15px ${i % 3 === 0 ? '#ffff00' : i % 3 === 1 ? '#ff6600' : '#ff0000'}, 0 0 30px ${i % 3 === 0 ? '#ffff0066' : i % 3 === 1 ? '#ff660066' : '#ff000066'}`
                          }}
                          animate={{ 
                            opacity: [1, 0.3, 1],
                            scale: [1, 0.9, 1]
                          }}
                          transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.08 }}
                        />
                      ))}
                    </div>
                    
                    {/* Main title banner - BIGGER */}
                    <motion.div 
                      className="text-center py-4 px-12 rounded-xl mx-auto relative"
                      style={{ 
                        background: 'linear-gradient(180deg, #FFE55C 0%, #FFD700 30%, #FFA500 100%)',
                        boxShadow: '0 8px 30px rgba(255,165,0,0.6), inset 0 3px 6px rgba(255,255,255,0.6), inset 0 -3px 6px rgba(0,0,0,0.2)'
                      }}
                      animate={{ boxShadow: ['0 8px 30px rgba(255,165,0,0.6)', '0 8px 50px rgba(255,165,0,0.9)', '0 8px 30px rgba(255,165,0,0.6)'] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <h2 className="text-3xl font-black tracking-widest" style={{ color: '#8B0000', textShadow: '0 2px 0 rgba(255,255,255,0.3)' }}>
                        ★ AWS JACKPOT ★
                      </h2>
                      <div className="flex items-center justify-center gap-6 mt-2">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-sm font-black",
                          DIFFICULTY_COLORS[challenge.difficulty as keyof typeof DIFFICULTY_COLORS] || DIFFICULTY_COLORS.medium
                        )}>
                          {challenge.difficulty.toUpperCase()}
                        </span>
                        <span className="text-red-900 text-lg font-black">
                          💰 {challenge.base_payout}x PAYOUT 💰
                        </span>
                      </div>
                    </motion.div>
                  </div>

                  {/* Main display area with reels and handle */}
                  <div className="flex items-center gap-8">
                    {/* Reels container - CHUNKY golden frame */}
                    <div 
                      className="flex-1 rounded-2xl p-4"
                      style={{ 
                        background: 'linear-gradient(180deg, #DAA520 0%, #B8860B 30%, #8B6914 50%, #B8860B 70%, #DAA520 100%)',
                        boxShadow: 'inset 0 3px 6px rgba(255,255,255,0.4), inset 0 -3px 6px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5)'
                      }}
                    >
                      {/* Inner dark display - deeper */}
                      <div 
                        className="rounded-xl p-5"
                        style={{
                          background: 'linear-gradient(180deg, #12121f 0%, #0a0a12 50%, #050508 100%)',
                          boxShadow: 'inset 0 8px 30px rgba(0,0,0,0.9), inset 0 -4px 20px rgba(0,0,0,0.5)'
                        }}
                      >
                        {/* Reels */}
                        <div className="flex justify-center items-center gap-5">
                          {challenge.services.map((service, index) => (
                            <SlotReel
                              key={`${challenge.id}-${index}`}
                              service={showOptions || result ? service : null}
                              isSpinning={isSpinning}
                              delay={index * 400}
                              reelIndex={index}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Handle */}
                    <div className="flex items-center">
                      <SlotHandle 
                        onPull={handleSpin}
                        disabled={gameState.balance < betAmount || isSpinning || showOptions || !!result}
                        isSpinning={isSpinning}
                      />
                    </div>
                  </div>
                
                {/* Bottom coin tray area with betting controls */}
                <div 
                  className="mt-4 rounded-lg p-3"
                  style={{
                    background: 'linear-gradient(180deg, #2a2a2a, #1a1a1a)',
                    boxShadow: 'inset 0 4px 15px rgba(0,0,0,0.6)'
                  }}
                >
                  {/* Betting controls - below reels */}
                  {!showOptions && !result && !isSpinning && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center gap-6"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-yellow-400 text-sm font-bold">BET:</span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBetAmount(Math.max(MIN_BET, betAmount - 50))}
                            disabled={betAmount <= MIN_BET}
                            className="w-8 h-8 p-0 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20"
                          >
                            -
                          </Button>
                          <span 
                            className="w-24 text-center text-xl font-bold px-3 py-1 rounded-lg"
                            style={{ 
                              background: 'linear-gradient(180deg, #228B22, #006400)',
                              color: '#90EE90',
                              border: '2px solid #32CD32'
                            }}
                          >
                            ${betAmount}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBetAmount(Math.min(MAX_BET, gameState.balance, betAmount + 50))}
                            disabled={betAmount >= MAX_BET || betAmount >= gameState.balance}
                            className="w-8 h-8 p-0 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20"
                          >
                            +
                          </Button>
                        </div>
                      </div>
                      
                      <Button
                        onClick={handleSpin}
                        disabled={gameState.balance < betAmount}
                        size="lg"
                        className="gap-2 text-lg px-8 font-bold text-white rounded-full"
                        style={{ 
                          background: 'linear-gradient(180deg, #22c55e, #16a34a)',
                          boxShadow: '0 4px 20px rgba(34,197,94,0.5), inset 0 2px 4px rgba(255,255,255,0.3)'
                        }}
                      >
                        <Sparkles className="w-5 h-5" />
                        SPIN
                      </Button>
                      
                      {gameState.balance < MIN_BET && (
                        <div className="text-center">
                          <p className="text-red-400 text-sm mb-1">Out of money!</p>
                          <Button variant="outline" size="sm" onClick={resetBalance}>
                            Get $1,000 Bonus
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
            </div>

            {/* Answer Options - Below the slot machine */}
            <AnimatePresence>
              {showOptions && !result && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full mt-6 px-4"
                >
                  <p className="text-center text-lg text-slate-300 mb-4">
                    What architecture pattern do these services represent?
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3 max-w-3xl mx-auto">
                    {challenge.options.map((option, idx) => (
                      <motion.button
                        key={option.id}
                        initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={() => handleAnswer(option.id)}
                        disabled={!!selectedOption}
                        className={cn(
                          "p-4 rounded-xl text-left transition-all",
                          "hover:scale-[1.02]",
                          selectedOption === option.id
                            ? "ring-2 ring-orange-500"
                            : ""
                        )}
                        style={{ 
                          background: selectedOption === option.id 
                            ? `linear-gradient(135deg, ${AWS_ORANGE}30, ${AWS_ORANGE}10)`
                            : `linear-gradient(135deg, ${AWS_DARK}, #0f1419)`,
                          border: `2px solid ${selectedOption === option.id ? AWS_ORANGE : AWS_ORANGE + '30'}`,
                          boxShadow: selectedOption === option.id 
                            ? `0 0 20px ${AWS_ORANGE}30`
                            : 'none'
                        }}
                      >
                        <span 
                          className="inline-block w-7 h-7 rounded-full text-center leading-7 font-bold mr-2 text-sm"
                          style={{ 
                            background: `linear-gradient(135deg, ${AWS_ORANGE}, #cc7a00)`,
                            color: 'white'
                          }}
                        >
                          {option.id.toUpperCase()}
                        </span>
                        <span className="text-white font-medium">{option.text}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result - Below the slot machine */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="w-full max-w-2xl mt-6 p-6 rounded-2xl text-center"
                  style={{ 
                    background: result.correct 
                      ? 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(22,163,74,0.1))'
                      : 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.1))',
                    border: `2px solid ${result.correct ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`,
                    boxShadow: result.correct 
                      ? '0 0 40px rgba(34,197,94,0.2)'
                      : '0 0 40px rgba(239,68,68,0.2)'
                  }}
                >
                  <motion.div 
                    className="text-6xl mb-3"
                    animate={result.correct ? { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] } : {}}
                    transition={{ duration: 0.5 }}
                  >
                    {result.correct ? "🎉" : "😢"}
                  </motion.div>
                  <h3 className={cn(
                    "text-3xl font-black mb-2",
                    result.correct ? "text-green-400" : "text-red-400"
                  )}>
                    {result.correct ? "JACKPOT!" : "Not quite..."}
                  </h3>
                  <motion.p 
                    className={cn(
                      "text-4xl font-black mb-4",
                      result.winnings >= 0 ? "text-green-400" : "text-red-400"
                    )}
                    animate={result.correct ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    {result.winnings >= 0 ? "+" : ""}{result.winnings.toLocaleString()}
                  </motion.p>
                  
                  <p className="text-slate-300 mb-1">
                    <strong>Pattern:</strong> {challenge.pattern_name}
                  </p>
                  <p className="text-slate-400 text-sm mb-4">
                    {result.explanation}
                  </p>
                  
                  <Button
                    onClick={generateChallenge}
                    size="lg"
                    className="gap-2 font-bold text-white"
                    style={{ 
                      background: `linear-gradient(135deg, ${AWS_ORANGE}, #cc7a00)`,
                      boxShadow: `0 4px 20px ${AWS_ORANGE}40`
                    }}
                  >
                    <Zap className="w-5 h-5" />
                    Spin Again
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* Stats Footer - Minimal */}
      <footer className="fixed bottom-0 left-0 right-0 bg-black/70 backdrop-blur-md border-t border-orange-500/20 py-2">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-slate-500">Best:</span>
            <span className="font-bold text-orange-400">{gameState.bestStreak}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Games:</span>
            <span className="font-bold text-slate-300">{gameState.gamesPlayed}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Win Rate:</span>
            <span className="font-bold text-slate-300">
              {gameState.gamesPlayed > 0 
                ? Math.round((gameState.gamesWon / gameState.gamesPlayed) * 100) 
                : 0}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-green-400" />
            <span className="text-slate-500">P/L:</span>
            <span className={cn(
              "font-bold",
              gameState.totalWinnings >= 0 ? "text-green-400" : "text-red-400"
            )}>
              {gameState.totalWinnings >= 0 ? "+" : ""}{gameState.totalWinnings.toLocaleString()}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
