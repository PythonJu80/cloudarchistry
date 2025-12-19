"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSocket } from "@/hooks/use-socket";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ArrowLeft,
  Wifi,
  WifiOff,
  CheckCircle,
  Play,
  X,
  Skull,
  Target,
  Bomb,
  Volume2,
  VolumeX,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// =============================================================================
// TYPES
// =============================================================================

interface Player {
  id: string;
  name: string | null;
  username: string | null;
}

interface Question {
  id: string;
  question: string;
  options: string[];
  correctIndex?: number;
  topic: string;
  difficulty: string;
  explanation?: string;
}

interface MatchData {
  id: string;
  matchCode: string;
  player1: Player;
  player2: Player | null;
  player1Score: number;
  player2Score: number;
  status: string;
  matchType: string;
  myPlayerId: string;
  isPlayer1: boolean;
  myScore: number;
  opponentScore: number;
  opponent: Player | null;
  winnerId: string | null;
  matchState: {
    questions?: Question[];
    currentQuestion?: number;
    currentBombHolder?: string;
    fuseTime?: number;
    players?: Array<{
      id: string;
      name: string;
      isAlive: boolean;
      score: number;
      correctAnswers: number;
    }>;
  };
}

// =============================================================================
// ANIMATED BOMB COMPONENT
// =============================================================================

const TOTAL_FUSE = 10; // Total time in seconds
const VISIBLE_THRESHOLD = 10; // Show ticker from start (countdown from 10)

const AnimatedBomb = ({ fuseTime }: { fuseTime: number }) => {
  const showTicker = fuseTime <= VISIBLE_THRESHOLD;
  const isLow = fuseTime <= 5;
  const isCritical = fuseTime <= 3;

  return (
    <div className="relative">
      {showTicker ? (
        <>
          <div
            className={`absolute -inset-4 rounded-full blur-xl transition-all duration-300 ${
              isCritical
                ? "bg-red-500/60 animate-pulse"
                : isLow
                ? "bg-orange-500/40"
                : "bg-yellow-500/20"
            }`}
          />
          <div className="relative w-32 h-32">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full border-4 border-gray-600 shadow-2xl" />
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-3 h-12 bg-gradient-to-t from-gray-700 to-orange-400 rounded-t-full">
              <div
                className={`absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full ${
                  isCritical ? "bg-red-500" : "bg-orange-400"
                } animate-pulse shadow-lg shadow-orange-500`}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className={`text-3xl font-black ${
                  isCritical ? "text-red-400 animate-pulse" : isLow ? "text-orange-400" : "text-white"
                }`}
              >
                {Math.ceil(fuseTime)}
              </span>
            </div>
            {isCritical && (
              <div className="absolute -bottom-2 -right-2">
                <Skull className="w-8 h-8 text-red-500 animate-bounce" />
              </div>
            )}
          </div>
        </>
      ) : (
        /* Bomb without visible timer - just shows the bomb icon */
        <div className="relative w-32 h-32">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full border-4 border-gray-600 shadow-2xl" />
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-3 h-12 bg-gradient-to-t from-gray-700 to-orange-400 rounded-t-full">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-orange-400 animate-pulse shadow-lg shadow-orange-500" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl">💣</span>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// EXPLOSION OVERLAY
// =============================================================================

const ExplosionOverlay = ({ playerName }: { playerName: string }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
  >
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: [0, 1.5, 1] }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <div className="text-[200px] leading-none">💥</div>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-4xl font-black text-red-500 mt-4"
      >
        {playerName} EXPLODED!
      </motion.h2>
    </motion.div>
  </motion.div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function TickingBombMatchPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { toast } = useToast();
  const matchCode = params.matchCode as string;

  // Match state
  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Game state
  const [fuseTime, setFuseTime] = useState(TOTAL_FUSE);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [showExplosion, setShowExplosion] = useState(false);
  const [eliminatedPlayer, setEliminatedPlayer] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [showTargetSelect, setShowTargetSelect] = useState(false);
  const [bombIncoming, setBombIncoming] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [throwingBomb, setThrowingBomb] = useState(false);
  const [bombFlightTarget, setBombFlightTarget] = useState<string | null>(null);
  const [screenShake, setScreenShake] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState<Array<{ playerName: string; message: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(false);

  // Refs
  const fuseIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch match data
  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/versus/${matchCode}`);
      if (res.ok) {
        const data = await res.json();
        setMatch(data.match);
        
        if (data.match?.status === "active" && data.match?.matchState?.fuseTime) {
          setFuseTime(data.match.matchState.fuseTime);
        }
      } else if (res.status === 404) {
        toast({ title: "Match not found", variant: "destructive" });
        router.push("/game/modes/ticking-bomb");
      }
    } catch (error) {
      console.error("Failed to fetch match:", error);
    } finally {
      setLoading(false);
    }
  }, [matchCode, router, toast]);

  // Socket handlers
  const handleSocketMatchStatus = useCallback((status: { status: string; winnerId?: string }) => {
    if (status.status === "completed") {
      setShowResults(true);
      fetchMatch();
    }
  }, [fetchMatch]);

  const handleSocketScoreUpdate = useCallback(() => {
    fetchMatch();
  }, [fetchMatch]);

  const handleSocketRoomUpdate = useCallback(() => {
    fetchMatch();
  }, [fetchMatch]);

  const handleSocketMatchUpdate = useCallback((data: unknown) => {
    // When bomb is passed or game state changes, refresh immediately
    const updateData = data as { matchState?: unknown };
    if (updateData.matchState) {
      // Show bomb incoming alert if we're receiving the bomb
      const state = updateData.matchState as { currentBombHolder?: string };
      if (state.currentBombHolder === match?.myPlayerId) {
        // Screen shake effect
        setScreenShake(true);
        setTimeout(() => setScreenShake(false), 500);
        
        setBombIncoming(true);
        setTimeout(() => setBombIncoming(false), 3000); // Show for 3 seconds
      }
      fetchMatch();
    }
  }, [fetchMatch, match?.myPlayerId]);

  // Initialize socket
  const {
    isConnected,
    sendChatMessage,
    updateMatchStatus,
  } = useSocket({
    matchCode,
    userId: match?.myPlayerId || "",
    userName: match?.isPlayer1
      ? (match?.player1.name || match?.player1.username || "Player 1")
      : (match?.player2?.name || match?.player2?.username || "Player 2"),
    onMatchStatus: handleSocketMatchStatus,
    onScoreUpdate: handleSocketScoreUpdate,
    onRoomUpdate: handleSocketRoomUpdate,
    onMatchUpdate: handleSocketMatchUpdate,
    onChatMessage: (msg) => {
      setChatMessages((prev) => [...prev.slice(-49), { playerName: msg.playerName, message: msg.message }]);
    },
  });

  // Suppress unused variable warnings
  void updateMatchStatus;

  // Initial load
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (authStatus === "authenticated" && matchCode) {
      fetchMatch();
    }
  }, [authStatus, matchCode, router, fetchMatch]);

  // Poll for match updates when pending
  useEffect(() => {
    if (match?.status !== "pending") return;
    const pollInterval = setInterval(() => {
      fetchMatch();
    }, 2000);
    return () => clearInterval(pollInterval);
  }, [match?.status, fetchMatch]);

  // Poll when waiting for game to start
  useEffect(() => {
    if (match?.status !== "active" || match?.matchState?.questions) return;
    const pollInterval = setInterval(() => {
      fetchMatch();
    }, 2000);
    return () => clearInterval(pollInterval);
  }, [match?.status, match?.matchState?.questions, fetchMatch]);

  // Fuse timer
  const stopFuseTimer = useCallback(() => {
    if (fuseIntervalRef.current) {
      clearInterval(fuseIntervalRef.current);
      fuseIntervalRef.current = null;
    }
  }, []);

  const startFuseTimer = useCallback(() => {
    stopFuseTimer();
    fuseIntervalRef.current = setInterval(() => {
      setFuseTime((prev) => Math.max(0, prev - 0.1));
    }, 100);
  }, [stopFuseTimer]);

  // Start fuse when game is active
  useEffect(() => {
    if (match?.status === "active" && match?.matchState?.questions) {
      startFuseTimer();
    }
    return () => stopFuseTimer();
  }, [match?.status, match?.matchState?.questions, startFuseTimer, stopFuseTimer]);

  // Show results when completed
  useEffect(() => {
    if (match?.status === "completed" && !showResults) {
      setShowResults(true);
      stopFuseTimer();
    }
  }, [match?.status, showResults, stopFuseTimer]);

  // Accept match
  const handleAccept = async () => {
    try {
      const res = await fetch(`/api/versus/${matchCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (res.ok) {
        fetchMatch();
      }
    } catch (err) {
      console.error("Failed to accept:", err);
    }
  };

  // Decline match
  const handleDecline = async () => {
    try {
      const res = await fetch(`/api/versus/${matchCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });
      if (res.ok) {
        router.push("/game");
      }
    } catch (err) {
      console.error("Failed to decline:", err);
    }
  };

  // Start game (generate questions)
  const handleStartGame = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/versus/${matchCode}/ticking-bomb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (res.ok) {
        fetchMatch();
        toast({ title: "💣 Game Started!" });
      }
    } catch (err) {
      console.error("Failed to start game:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle answer
  const handleAnswer = async (answerIndex: number) => {
    if (answerLocked || match?.matchState?.currentBombHolder !== match?.myPlayerId) return;

    setSelectedAnswer(answerIndex);
    setAnswerLocked(true);

    const currentQ = match?.matchState?.questions?.[match?.matchState?.currentQuestion || 0];
    const isCorrect = currentQ?.correctIndex === answerIndex;

    if (isCorrect) {
      setAnswerFeedback('correct');
      setShowTargetSelect(true);
      toast({ title: "✅ Correct! Choose who to throw the bomb at!", description: "Click on a player to pass the bomb" });
    } else {
      setAnswerFeedback('wrong');
      toast({ title: "❌ Wrong Answer!", description: "Bomb stays with you. Moving to next question...", variant: "destructive" });
      
      // Wait 2 seconds to show the wrong answer feedback, then call API to move to next question
      setTimeout(async () => {
        try {
          const res = await fetch(`/api/versus/${matchCode}/ticking-bomb`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "wrong" }),
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data.gameOver) {
              setShowResults(true);
            }
            fetchMatch();
          }
        } catch (err) {
          console.error("Failed to submit wrong answer:", err);
        } finally {
          setAnswerLocked(false);
          setSelectedAnswer(null);
          setAnswerFeedback(null);
        }
      }, 2000);
    }
  };

  // Pass bomb - called when throw bomb button is clicked
  const handlePassBomb = async () => {
    if (!selectedTarget) return;

    // Start bomb throwing animation
    setThrowingBomb(true);
    setBombFlightTarget(selectedTarget);

    // Wait for animation to complete
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/versus/${matchCode}/ticking-bomb`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "pass",
            targetId: selectedTarget,
          }),
        });
        if (res.ok) {
          toast({ title: "💣 Bomb Passed!", description: "The bomb has been thrown!" });
          setShowTargetSelect(false);
          setSelectedTarget(null);
          setSelectedAnswer(null);
          setAnswerLocked(false);
          setAnswerFeedback(null);
          setFuseTime(TOTAL_FUSE);
          setThrowingBomb(false);
          setBombFlightTarget(null);
          fetchMatch();
        }
      } catch (err) {
        console.error("Failed to pass bomb:", err);
        toast({ title: "Error", description: "Failed to pass bomb. Try again.", variant: "destructive" });
        setThrowingBomb(false);
        setBombFlightTarget(null);
      }
    }, 800); // Animation duration
  };

  // Send chat
  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput.trim());
    setChatInput("");
  };

  // Loading state
  if (loading || authStatus === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading match...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Bomb className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Match Not Found</h2>
          <Link href="/game/modes/ticking-bomb">
            <Button>Back to Lobby</Button>
          </Link>
        </div>
      </div>
    );
  }

  const iHaveBomb = match.matchState?.currentBombHolder === match.myPlayerId;
  const currentQuestion = match.matchState?.questions?.[match.matchState?.currentQuestion || 0];
  const players = match.matchState?.players || [];
  const alivePlayers = players.filter((p) => p.isAlive);

  return (
    <div className={`min-h-screen bg-gray-950 text-white relative transition-transform duration-100 ${
      screenShake ? 'animate-shake' : ''
    }`}>
      {/* Explosion overlay */}
      <AnimatePresence>
        {showExplosion && eliminatedPlayer && (
          <ExplosionOverlay playerName={eliminatedPlayer} />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/game/modes/ticking-bomb"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Leave</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-2xl">💣</span>
            <span className="font-black text-lg bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
              TICKING BOMB
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection status */}
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-gray-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-gray-600" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* PENDING STATE - Waiting for opponent to accept */}
        {match.status === "pending" && (
          <div className="text-center max-w-md mx-auto">
            <div className="text-6xl mb-6">💣</div>
            <h1 className="text-3xl font-black mb-4">
              {match.isPlayer1 ? "Waiting for Opponent" : "You've Been Challenged!"}
            </h1>

            {match.isPlayer1 ? (
              <div>
                <p className="text-gray-400 mb-6">
                  Waiting for {match.player2?.name || match.player2?.username || "opponent"} to accept...
                </p>
                <Loader2 className="w-8 h-8 text-red-500 animate-spin mx-auto" />
              </div>
            ) : (
              <div>
                <p className="text-gray-400 mb-6">
                  {match.player1.name || match.player1.username} wants to play Ticking Bomb!
                </p>
                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={handleAccept}
                    className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Accept
                  </Button>
                  <Button variant="outline" onClick={handleDecline}>
                    <X className="w-5 h-5 mr-2" />
                    Decline
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ACTIVE STATE - Waiting for host to start */}
        {match.status === "active" && !match.matchState?.questions && (
          <div className="text-center max-w-md mx-auto">
            <div className="text-6xl mb-6">💣</div>
            <h1 className="text-3xl font-black mb-4">Ready to Play!</h1>

            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-2xl font-bold mb-2">
                  {(match.player1.name || match.player1.username || "P1")[0].toUpperCase()}
                </div>
                <p className="font-bold">{match.player1.name || match.player1.username}</p>
                {match.isPlayer1 && <span className="text-xs text-blue-400">(you)</span>}
              </div>

              <span className="text-2xl">⚔️</span>

              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl font-bold mb-2">
                  {(match.player2?.name || match.player2?.username || "P2")[0].toUpperCase()}
                </div>
                <p className="font-bold">{match.player2?.name || match.player2?.username}</p>
                {!match.isPlayer1 && <span className="text-xs text-blue-400">(you)</span>}
              </div>
            </div>

            {match.isPlayer1 ? (
              <Button
                onClick={handleStartGame}
                disabled={isGenerating}
                className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-xl px-8 py-6"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                    Generating Questions...
                  </>
                ) : (
                  <>
                    <Play className="w-6 h-6 mr-2" />
                    Start Game
                  </>
                )}
              </Button>
            ) : (
              <div>
                <Loader2 className="w-8 h-8 text-red-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Waiting for host to start...</p>
              </div>
            )}
          </div>
        )}

        {/* PLAYING STATE */}
        {match.status === "active" && match.matchState?.questions && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left: Players */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
                Players ({alivePlayers.length} alive)
              </h3>
              {players.map((player) => (
                <motion.div
                  key={player.id}
                  onClick={() => {
                    if (showTargetSelect && player.isAlive && player.id !== match.myPlayerId) {
                      setSelectedTarget(player.id);
                    }
                  }}
                  animate={{
                    scale: bombFlightTarget === player.id ? [1, 1.1, 1] : 1,
                  }}
                  transition={{
                    duration: 0.3,
                    repeat: bombFlightTarget === player.id ? 3 : 0
                  }}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    !player.isAlive
                      ? "bg-gray-900/50 border-gray-800 opacity-50"
                      : match.matchState?.currentBombHolder === player.id
                      ? "bg-red-500/20 border-red-500 shadow-lg shadow-red-500/30"
                      : selectedTarget === player.id
                      ? "bg-green-500/20 border-green-500 ring-2 ring-green-400"
                      : showTargetSelect && player.id !== match.myPlayerId
                      ? "bg-gray-800/50 border-gray-600 hover:border-yellow-500 cursor-pointer"
                      : player.id === match.myPlayerId
                      ? "bg-blue-500/20 border-blue-500"
                      : "bg-gray-800/50 border-gray-700"
                  }`}
                >
                  {match.matchState?.currentBombHolder === player.id && player.isAlive && (
                    <div className="absolute -top-3 -right-3 text-2xl animate-bounce">💣</div>
                  )}
                  {!player.isAlive && (
                    <div className="absolute -top-2 -right-2 text-2xl">💀</div>
                  )}
                  {showTargetSelect && player.isAlive && player.id !== match.myPlayerId && (
                    <div className="absolute -top-2 -left-2">
                      <Target className="w-5 h-5 text-yellow-400" />
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                        !player.isAlive
                          ? "bg-gray-700 text-gray-500"
                          : player.id === match.myPlayerId
                          ? "bg-blue-500 text-white"
                          : "bg-gradient-to-br from-purple-500 to-pink-500 text-white"
                      }`}
                    >
                      {player.name[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${!player.isAlive ? "text-gray-500 line-through" : "text-white"}`}>
                          {player.name}
                        </span>
                        {player.id === match.myPlayerId && <span className="text-xs text-blue-400">(you)</span>}
                      </div>
                      <div className="text-xs text-gray-500">
                        ✓ {player.correctAnswers} correct
                      </div>
                    </div>
                  </div>
                  
                  {/* Particle burst effect when bomb lands */}
                  <AnimatePresence>
                    {bombFlightTarget === player.id && (
                      <>
                        {[...Array(8)].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ 
                              x: 0, 
                              y: 0, 
                              scale: 1,
                              opacity: 1 
                            }}
                            animate={{ 
                              x: Math.cos((i * Math.PI * 2) / 8) * 100,
                              y: Math.sin((i * Math.PI * 2) / 8) * 100,
                              scale: 0,
                              opacity: 0
                            }}
                            transition={{ duration: 0.6 }}
                            className="absolute top-1/2 left-1/2 w-4 h-4 bg-orange-500 rounded-full"
                          />
                        ))}
                        <motion.div
                          initial={{ scale: 0, opacity: 1 }}
                          animate={{ scale: 3, opacity: 0 }}
                          transition={{ duration: 0.5 }}
                          className="absolute inset-0 bg-red-500/50 rounded-xl"
                        />
                      </>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              {/* Throw Bomb Button */}
              {showTargetSelect && selectedTarget && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-4"
                >
                  <Button
                    onClick={handlePassBomb}
                    className="w-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-400 hover:via-red-400 hover:to-pink-400 text-white font-black text-lg py-6 shadow-lg shadow-red-500/50 border-2 border-yellow-400"
                  >
                    <Target className="w-6 h-6 mr-2 animate-pulse" />
                    THROW BOMB!
                  </Button>
                </motion.div>
              )}
            </div>

            {/* Flying Bomb Animation */}
            <AnimatePresence>
              {throwingBomb && bombFlightTarget && (
                <motion.div
                  initial={{ 
                    x: 0, 
                    y: 0,
                    scale: 1,
                    opacity: 1
                  }}
                  animate={{ 
                    x: [0, 100, 200, 300, 400],
                    y: [0, -150, -200, -150, 0],
                    scale: [1, 1.5, 2, 1.5, 1],
                    rotate: [0, 180, 360, 540, 720],
                    opacity: [1, 1, 1, 1, 0]
                  }}
                  transition={{ 
                    duration: 0.8,
                    ease: "easeInOut"
                  }}
                  className="fixed top-1/2 left-1/4 z-50 pointer-events-none"
                >
                  <div className="relative">
                    {/* Bomb emoji with glow */}
                    <div className="text-8xl drop-shadow-2xl">💣</div>
                    {/* Trailing particles */}
                    <motion.div
                      animate={{
                        scale: [1, 2, 1],
                        opacity: [0.8, 0, 0.8]
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.3
                      }}
                      className="absolute inset-0 bg-orange-500/50 rounded-full blur-xl"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Center: Bomb & Question */}
            <div className="lg:col-span-2">
              {/* Bomb Incoming Alert */}
              <AnimatePresence>
                {bombIncoming && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0, y: -20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0, y: -20 }}
                    className="mb-6 p-6 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl border-4 border-yellow-400 shadow-2xl shadow-red-500/50"
                  >
                    <div className="text-center">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 0.5 }}
                        className="text-6xl mb-2"
                      >
                        💣
                      </motion.div>
                      <motion.h2
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="text-3xl font-black text-white uppercase tracking-wider"
                      >
                        BOMB INCOMING!
                      </motion.h2>
                      <p className="text-white/90 font-bold mt-2">You have the bomb! Answer quickly!</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-center mb-8">
                <AnimatedBomb fuseTime={fuseTime} />
              </div>

              <div className="text-center mb-6">
                {iHaveBomb ? (
                  <p className={`text-xl font-bold ${fuseTime <= 5 ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>
                    💣 YOU HAVE THE BOMB! {fuseTime <= 5 ? 'HURRY!' : 'Answer to throw it!'}
                  </p>
                ) : (
                  <p className="text-gray-400">
                    {players.find((p) => p.id === match.matchState?.currentBombHolder)?.name} has the bomb...
                  </p>
                )}
              </div>

              {currentQuestion && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-1 rounded bg-gray-800 text-xs text-gray-400">
                      {currentQuestion.topic}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        currentQuestion.difficulty === "hard"
                          ? "bg-red-500/20 text-red-400"
                          : currentQuestion.difficulty === "medium"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-green-500/20 text-green-400"
                      }`}
                    >
                      {currentQuestion.difficulty}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold mb-6">{currentQuestion.question}</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentQuestion.options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAnswer(idx)}
                        disabled={!iHaveBomb || answerLocked}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          selectedAnswer === idx && answerFeedback === 'correct'
                            ? "border-green-500 bg-green-500/20 ring-2 ring-green-400"
                            : selectedAnswer === idx && answerFeedback === 'wrong'
                            ? "border-red-500 bg-red-500/20 ring-2 ring-red-400"
                            : selectedAnswer === idx
                            ? "border-yellow-500 bg-yellow-500/20"
                            : iHaveBomb && !answerLocked
                            ? "border-gray-700 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800"
                            : "border-gray-800 bg-gray-900/50 opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <span className="font-bold text-gray-500 mr-2">
                          {String.fromCharCode(65 + idx)}.
                        </span>
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* COMPLETED STATE */}
        {match.status === "completed" && (
          <div className="text-center">
            <div className="mb-8">
              <div className="text-8xl mb-4">🏆</div>
              <h1 className="text-4xl font-black mb-2">
                {match.winnerId === match.myPlayerId ? "YOU WIN!" : "Game Over!"}
              </h1>
              <p className="text-gray-400">
                {match.winnerId === match.myPlayerId
                  ? "Last one standing!"
                  : `${players.find((p) => p.id === match.winnerId)?.name || "Someone"} wins!`}
              </p>
            </div>

            <div className="flex justify-center gap-4">
              <Link href="/game/modes/ticking-bomb">
                <Button variant="outline">Back to Lobby</Button>
              </Link>
              <Link href="/game">
                <Button className="bg-gradient-to-r from-red-500 to-orange-500">
                  Play Again
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Chat toggle */}
      <button
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-4 right-4 p-3 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors shadow-lg"
      >
        <Send className="w-5 h-5" />
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 right-4 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="p-3 border-b border-gray-800 font-bold">Chat</div>
            <div className="h-48 overflow-y-auto p-3 space-y-2">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className="text-sm">
                  <span className="font-bold text-blue-400">{msg.playerName}:</span>{" "}
                  <span className="text-gray-300">{msg.message}</span>
                </div>
              ))}
              {chatMessages.length === 0 && (
                <p className="text-gray-600 text-sm text-center">No messages yet</p>
              )}
            </div>
            <div className="p-3 border-t border-gray-800 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                placeholder="Type a message..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-600"
              />
              <Button size="sm" onClick={handleSendChat}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
