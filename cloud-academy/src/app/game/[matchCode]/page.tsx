"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSocket } from "@/hooks/use-socket";
import {
  Loader2,
  ArrowLeft,
  XCircle,
  Wifi,
  WifiOff,
  Trophy,
  Zap,
  MessageCircle,
  Send,
  Clock,
  CheckCircle,
  Crown,
  Users,
  Play,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// Import types from shared types file
import type { MatchData, QuestionData, ChatMessage, AnswerResult, QuestionRecap } from "../types";

export default function GameMatchPage() {
  const params = useParams();
  const router = useRouter();
  const matchCode = params.matchCode as string;
  const { status: authStatus } = useSession();
  const { toast } = useToast();

  const [match, setMatch] = useState<MatchData | null>(null);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Chat state
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Quiz state
  const [buzzing, setBuzzing] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [recap, setRecap] = useState<QuestionRecap[] | null>(null);
  const [showRecap, setShowRecap] = useState(false);
  
  // Connection status
  const [opponentOnline, setOpponentOnline] = useState(false);

  // Fetch match data
  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/versus/${matchCode}`);
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to load match");
        return;
      }
      
      // Redirect to game-specific PvP page based on matchType
      const gameRoutes: Record<string, string> = {
        speed_deploy: "speed-deploy",
        service_slots: "service-slots",
        architect_arena: "architect-arena",
        ticking_bomb: "ticking-bomb",
      };
      const matchType = data.match.matchType;
      if (matchType && matchType !== "quiz" && gameRoutes[matchType]) {
        router.replace(`/game/${gameRoutes[matchType]}/${matchCode}`);
        return;
      }
      
      setMatch(data.match);
      // Initialize chat messages from match data
      if (data.match.chatMessages) {
        setChatMessages(data.match.chatMessages);
      }
      // Get recap data for completed matches
      if (data.recap) {
        setRecap(data.recap);
      }
      setError(null);
    } catch {
      setError("Failed to load match");
    } finally {
      setLoading(false);
    }
  }, [matchCode, router]);

  // Fetch current question
  const fetchQuestion = useCallback(async () => {
    if (!match || match.status !== "active") return;
    
    try {
      const res = await fetch(`/api/versus/${matchCode}/questions`);
      const data = await res.json();
      
      if (res.ok) {
        setQuestion(data);
      }
    } catch (err) {
      console.error("Failed to fetch question:", err);
    }
  }, [match, matchCode]);

  // Socket event handlers
  const handleSocketChatMessage = useCallback((msg: ChatMessage) => {
    setChatMessages(prev => {
      // Avoid duplicates
      if (prev.some(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const handleSocketBuzz = useCallback((event: { playerId: string; playerName: string }) => {
    // Update question state with who buzzed
    setQuestion(prev => prev ? { ...prev, buzzedBy: event.playerId, canBuzz: false } : null);
  }, []);

  const handleSocketAnswerResult = useCallback((result: { playerId: string; correct: boolean; points: number; correctAnswer?: number }) => {
    // Show result overlay for the answering player
    if (match && result.playerId === match.myPlayerId) {
      setLastResult({
        correct: result.correct,
        points: result.points,
        correctAnswer: result.correctAnswer || 0,
      });
      setShowResult(true);
      setTimeout(() => {
        setShowResult(false);
        setLastResult(null);
      }, 2000);
    }
    // Refresh match and question data
    fetchMatch();
    fetchQuestion();
  }, [match, fetchMatch, fetchQuestion]);

  const handleSocketScoreUpdate = useCallback((scores: { player1Score: number; player2Score: number }) => {
    setMatch(prev => prev ? { ...prev, player1Score: scores.player1Score, player2Score: scores.player2Score } : null);
  }, []);

  const handleSocketMatchStatus = useCallback((status: { status: string; winnerId?: string }) => {
    setMatch(prev => prev ? { ...prev, status: status.status, winnerId: status.winnerId || null } : null);
  }, []);

  const handleSocketNewQuestion = useCallback((questionData: unknown) => {
    setQuestion(questionData as QuestionData);
  }, []);

  const handleSocketRoomUpdate = useCallback((update: { players: Array<{ userId: string }>; playerCount: number }) => {
    // Check if opponent is online
    if (match) {
      const opponentId = match.isPlayer1 ? match.player2.id : match.player1.id;
      setOpponentOnline(update.players.some(p => p.userId === opponentId));
    }
  }, [match]);

  const handleSocketPlayerDisconnected = useCallback((data: { userId: string }) => {
    if (match) {
      const opponentId = match.isPlayer1 ? match.player2.id : match.player1.id;
      if (data.userId === opponentId) {
        setOpponentOnline(false);
      }
    }
  }, [match]);

  // Initialize socket connection
  const {
    isConnected,
    sendChatMessage: socketSendChat,
    buzz: socketBuzz,
    submitAnswerResult,
    updateScores,
    sendNextQuestion,
    updateMatchStatus,
  } = useSocket({
    matchCode,
    userId: match?.myPlayerId || "",
    userName: match?.isPlayer1 
      ? (match?.player1.name || match?.player1.username || "Player 1")
      : (match?.player2.name || match?.player2.username || "Player 2"),
    onChatMessage: handleSocketChatMessage,
    onPlayerBuzzed: handleSocketBuzz,
    onAnswerResult: handleSocketAnswerResult,
    onScoreUpdate: handleSocketScoreUpdate,
    onMatchStatus: handleSocketMatchStatus,
    onNewQuestion: handleSocketNewQuestion,
    onRoomUpdate: handleSocketRoomUpdate,
    onPlayerDisconnected: handleSocketPlayerDisconnected,
  });

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

  // WebSocket handles real-time updates - no polling needed
  // Manual refresh available via fetchMatch/fetchQuestion if socket disconnects
  useEffect(() => {
    // When socket reconnects, refresh data
    if (isConnected && match) {
      fetchMatch();
      if (match.status === "active") {
        fetchQuestion();
      }
    }
  }, [isConnected, match?.status, fetchMatch, fetchQuestion]);

  // Fetch question when match becomes active and show notification
  const [prevStatus, setPrevStatus] = useState<string | null>(null);
  useEffect(() => {
    if (match?.status === "active") {
      fetchQuestion();
      // Show toast when transitioning from pending to active
      if (prevStatus === "pending") {
        toast({
          title: "⚔️ Battle Started!",
          description: "Your opponent accepted. Let's go!",
        });
      }
    }
    if (match?.status) {
      setPrevStatus(match.status);
    }
  }, [match?.status, fetchQuestion, prevStatus, toast]);

  // Auto-refresh when question says complete but match status hasn't updated
  useEffect(() => {
    if (question?.complete && match?.status === "active") {
      // Match should be completed, refresh to get updated status
      const timeout = setTimeout(() => {
        fetchMatch();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [question?.complete, match?.status, fetchMatch]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Failed to decline:", err);
    }
  };

  // Generate questions and start
  const handleStartQuiz = async () => {
    try {
      const res = await fetch(`/api/versus/${matchCode}/questions`, {
        method: "POST",
      });
      
      if (res.ok) {
        fetchMatch();
        fetchQuestion();
      }
    } catch (err) {
      console.error("Failed to start quiz:", err);
    }
  };

  // Send chat message - now via WebSocket!
  const handleSendChat = () => {
    if (!chatMessage.trim()) return;
    
    // Send via WebSocket for instant delivery
    socketSendChat(chatMessage);
    setChatMessage("");
    
    // Also persist to database in background
    fetch(`/api/versus/${matchCode}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        action: "chat", 
        data: { message: chatMessage } 
      }),
    }).catch(err => console.error("Failed to persist chat:", err));
  };

  // Buzz in - now via WebSocket for instant response!
  const handleBuzz = async () => {
    if (buzzing || !question?.canBuzz) return;
    
    setBuzzing(true);
    
    // Send buzz via WebSocket immediately
    socketBuzz();
    
    // Also persist to database
    try {
      await fetch(`/api/versus/${matchCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "buzz" }),
      });
    } catch (err) {
      console.error("Failed to persist buzz:", err);
    } finally {
      setBuzzing(false);
    }
  };

  // Submit answer
  const handleAnswer = async (answerIndex: number) => {
    if (answering) return;
    
    setAnswering(true);
    try {
      const res = await fetch(`/api/versus/${matchCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "answer", 
          data: { answerIndex } 
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Broadcast result via WebSocket
        submitAnswerResult(data.result.correct, data.result.points, data.result.correctAnswer);
        
        // Update scores via WebSocket
        if (data.match) {
          updateScores(data.match.player1Score, data.match.player2Score);
        }
        
        // Show result locally
        setLastResult(data.result);
        setShowResult(true);
        
        // If there's a next question, broadcast it
        if (data.nextQuestion) {
          sendNextQuestion(data.nextQuestion);
        }
        
        // If match is complete, broadcast status
        if (data.match?.status === "completed") {
          updateMatchStatus("completed", data.match.winnerId);
        }
        
        // Hide result after 2 seconds
        setTimeout(() => {
          setShowResult(false);
          setLastResult(null);
          fetchMatch();
          fetchQuestion();
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to answer:", err);
    } finally {
      setAnswering(false);
    }
  };
  
  // Handle pass (skip on pass-back)
  const handlePass = async () => {
    if (answering) return;
    
    setAnswering(true);
    try {
      const res = await fetch(`/api/versus/${matchCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pass" }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Show result with correct answer
        setLastResult({
          correct: false,
          points: 0,
          correctAnswer: data.result.correctAnswer,
          explanation: data.result.explanation,
          passed: true,
          opponentAnswer: data.result.opponentAnswer,
        });
        setShowResult(true);
        
        // Hide result after 3 seconds (longer to read explanation)
        setTimeout(() => {
          setShowResult(false);
          setLastResult(null);
          fetchMatch();
          fetchQuestion();
        }, 3000);
      }
    } catch (err) {
      console.error("Failed to pass:", err);
    } finally {
      setAnswering(false);
    }
  };
  
  // Suppress unused variable warnings - these are used in socket callbacks
  void updateScores;
  void sendNextQuestion;
  void updateMatchStatus;
  void submitAnswerResult;

  if (loading || authStatus === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading match...</p>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Match Not Found</h2>
            <p className="text-muted-foreground mb-4">{error || "This match doesn't exist or you don't have access."}</p>
            <Link href="/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isMyTurn = question?.buzzedBy === match.myPlayerId;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Link>
          
          <div className="flex items-center gap-2">
            {/* Connection indicator */}
            <div className={`flex items-center gap-1 text-xs ${isConnected ? "text-green-500" : "text-red-500"}`}>
              {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isConnected ? "Live" : "Reconnecting..."}
            </div>
            <Badge variant={match.status === "active" ? "default" : "secondary"}>
              {match.status === "pending" && "Waiting..."}
              {match.status === "active" && "LIVE"}
              {match.status === "completed" && "Finished"}
              {match.status === "cancelled" && "Cancelled"}
            </Badge>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4">
        {/* Scoreboard */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Player 1 (You or Opponent) */}
          <Card className={`${match.isPlayer1 ? "ring-2 ring-primary" : ""}`}>
            <CardContent className="pt-4 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <p className="font-semibold truncate">
                {match.player1.name || match.player1.username || "Player 1"}
                {match.isPlayer1 && " (You)"}
              </p>
              <p className="text-3xl font-bold text-blue-500 mt-2">{match.player1Score}</p>
              {match.winnerId === match.player1.id && (
                <Crown className="w-6 h-6 text-yellow-500 mx-auto mt-2" />
              )}
            </CardContent>
          </Card>

          {/* VS / Status */}
          <Card className="flex items-center justify-center">
            <CardContent className="text-center py-4">
              {match.status === "active" && question && !question.complete && (
                <>
                  <p className="text-sm text-muted-foreground">Question</p>
                  <p className="text-2xl font-bold">{question.questionNumber}/{question.totalQuestions}</p>
                </>
              )}
              {match.status === "pending" && (
                <p className="text-xl font-bold text-muted-foreground">VS</p>
              )}
              {match.status === "completed" && (
                <>
                  <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">
                    {match.winnerId === match.myPlayerId ? "You Win!" : 
                     match.winnerId ? "You Lose" : "Draw!"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Player 2 */}
          <Card className={`${!match.isPlayer1 ? "ring-2 ring-primary" : ""}`}>
            <CardContent className="pt-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-2">
                <Users className="w-6 h-6 text-red-500" />
              </div>
              <p className="font-semibold truncate">
                {match.player2.name || match.player2.username || "Player 2"}
                {!match.isPlayer1 && " (You)"}
              </p>
              <p className="text-3xl font-bold text-red-500 mt-2">{match.player2Score}</p>
              {match.winnerId === match.player2.id && (
                <Crown className="w-6 h-6 text-yellow-500 mx-auto mt-2" />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Game Area */}
          <div className="lg:col-span-2 space-y-4">
            {/* Pending State - Waiting for acceptance */}
            {match.status === "pending" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    {match.isPlayer1 ? "Waiting for opponent..." : "You've been challenged!"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {match.isPlayer1 ? (
                    <p className="text-muted-foreground">
                      Waiting for {match.opponent.name || match.opponent.username} to accept the challenge.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-muted-foreground">
                        {match.player1.name || match.player1.username} wants to battle you in a Quiz!
                      </p>
                      <div className="flex gap-3">
                        <Button onClick={handleAccept} className="gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Accept Challenge
                        </Button>
                        <Button variant="outline" onClick={handleDecline} className="gap-2">
                          <X className="w-4 h-4" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Active - Quiz in progress */}
            {match.status === "active" && (
              <>
                {/* No questions yet - Start button */}
                {(!match.matchState?.questions || match.matchState.questions.length === 0) && match.isPlayer1 && (
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <Play className="w-12 h-12 text-primary mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Ready to Start?</h3>
                      <p className="text-muted-foreground mb-4">
                        Click below to generate questions and begin the quiz battle!
                      </p>
                      <Button onClick={handleStartQuiz} size="lg" className="gap-2">
                        <Zap className="w-5 h-5" />
                        Start Quiz!
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Waiting for player 1 to start */}
                {(!match.matchState?.questions || match.matchState.questions.length === 0) && !match.isPlayer1 && (
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Get Ready!</h3>
                      <p className="text-muted-foreground">
                        Waiting for {match.player1.name || match.player1.username} to start the quiz...
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Question Display */}
                {question && !question.complete && (
                  <Card className="relative overflow-hidden">
                    {/* Result Overlay */}
                    {showResult && lastResult && (
                      <div className={`absolute inset-0 z-10 flex items-center justify-center ${
                        lastResult.correct ? "bg-green-500/90" : 
                        lastResult.passedTo ? "bg-yellow-500/90" : "bg-red-500/90"
                      }`}>
                        <div className="text-center text-white p-6">
                          {lastResult.correct ? (
                            <>
                              <CheckCircle className="w-16 h-16 mx-auto mb-2" />
                              <p className="text-2xl font-bold">Correct!</p>
                              <p className="text-xl">+{lastResult.points} points</p>
                              {lastResult.explanation && (
                                <p className="text-sm mt-3 opacity-90 max-w-md">{lastResult.explanation}</p>
                              )}
                            </>
                          ) : lastResult.passedTo ? (
                            <>
                              <XCircle className="w-16 h-16 mx-auto mb-2" />
                              <p className="text-2xl font-bold">Wrong! Passed to opponent</p>
                              <p className="text-lg">{lastResult.points} points</p>
                              <p className="text-sm mt-2 opacity-80">They get a chance to steal!</p>
                            </>
                          ) : lastResult.passed ? (
                            <>
                              <X className="w-16 h-16 mx-auto mb-2" />
                              <p className="text-2xl font-bold">Passed</p>
                              <p className="text-lg mt-2">
                                Correct answer: {question?.options[lastResult.correctAnswer || 0]}
                              </p>
                              {lastResult.explanation && (
                                <p className="text-sm mt-3 opacity-90 max-w-md">{lastResult.explanation}</p>
                              )}
                            </>
                          ) : (
                            <>
                              <XCircle className="w-16 h-16 mx-auto mb-2" />
                              <p className="text-2xl font-bold">Wrong!</p>
                              <p className="text-xl">{lastResult.points} points</p>
                              {lastResult.correctAnswer !== undefined && (
                                <p className="text-lg mt-2">
                                  Correct: {question?.options[lastResult.correctAnswer]}
                                </p>
                              )}
                              {lastResult.explanation && (
                                <p className="text-sm mt-3 opacity-90 max-w-md">{lastResult.explanation}</p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{question.topic}</Badge>
                        <span className="text-sm text-muted-foreground">
                          Q{question.questionNumber} of {question.totalQuestions}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <p className="text-lg font-medium">{question.question}</p>

                      {/* Buzz Button */}
                      {question.canBuzz && (
                        <div className="text-center">
                          <Button
                            size="lg"
                            onClick={handleBuzz}
                            disabled={buzzing}
                            className="w-32 h-32 rounded-full text-2xl font-bold bg-red-500 hover:bg-red-600 animate-pulse"
                          >
                            {buzzing ? <Loader2 className="w-8 h-8 animate-spin" /> : "BUZZ!"}
                          </Button>
                          <p className="text-sm text-muted-foreground mt-2">
                            First to buzz gets to answer!
                          </p>
                        </div>
                      )}

                      {/* Pass-back: Question passed to me - show opponent's wrong answer */}
                      {question.passedToMe && (
                        <div className="space-y-4">
                          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 text-center">
                            <p className="text-lg font-semibold text-yellow-500">
                              🎯 Steal opportunity!
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {match.opponent.name || match.opponent.username} got it wrong. 
                              {question.opponentAnswer !== null && question.opponentAnswer !== undefined && (
                                <span className="block mt-1">
                                  They picked: <span className="font-semibold text-red-400">
                                    {String.fromCharCode(65 + question.opponentAnswer)}. {question.options[question.opponentAnswer]}
                                  </span>
                                </span>
                              )}
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-3">
                            {question.options.map((option, idx) => (
                              <Button
                                key={idx}
                                variant="outline"
                                className={`text-left justify-start h-auto py-3 px-4 ${
                                  idx === question.opponentAnswer ? "border-red-500/50 bg-red-500/10 line-through opacity-60" : ""
                                }`}
                                onClick={() => handleAnswer(idx)}
                                disabled={answering || idx === question.opponentAnswer}
                              >
                                <span className="font-bold mr-3">{String.fromCharCode(65 + idx)}.</span>
                                {option}
                                {idx === question.opponentAnswer && (
                                  <span className="ml-auto text-red-400 text-xs">Their wrong answer</span>
                                )}
                              </Button>
                            ))}
                          </div>
                          
                          <div className="flex gap-3 justify-center">
                            <Button 
                              variant="outline" 
                              onClick={handlePass}
                              disabled={answering}
                              className="gap-2"
                            >
                              <X className="w-4 h-4" />
                              Pass (Skip)
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Waiting for opponent on pass-back */}
                      {question.passedToOpponent && (
                        <div className="py-8 text-center">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-yellow-500" />
                          <p className="text-lg font-semibold text-yellow-500">
                            You got it wrong! 😬
                          </p>
                          <p className="text-muted-foreground">
                            {match.opponent.name || match.opponent.username} gets a chance to steal...
                          </p>
                        </div>
                      )}

                      {/* Someone buzzed (original flow) */}
                      {question.buzzedBy && !question.passedToMe && !question.passedToOpponent && (
                        <div className="text-center">
                          {isMyTurn ? (
                            <div className="space-y-4">
                              <p className="text-lg font-semibold text-green-500">
                                ⚡ You buzzed first! Answer now!
                              </p>
                              <div className="grid grid-cols-1 gap-3">
                                {question.options.map((option, idx) => (
                                  <Button
                                    key={idx}
                                    variant="outline"
                                    className="text-left justify-start h-auto py-3 px-4"
                                    onClick={() => handleAnswer(idx)}
                                    disabled={answering}
                                  >
                                    <span className="font-bold mr-3">{String.fromCharCode(65 + idx)}.</span>
                                    {option}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="py-8">
                              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-yellow-500" />
                              <p className="text-lg font-semibold text-yellow-500">
                                {match.opponent.name || match.opponent.username} buzzed first!
                              </p>
                              <p className="text-muted-foreground">Waiting for their answer...</p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Quiz Complete - refresh to get final results */}
                {question?.complete && (
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                      <h3 className="text-2xl font-bold mb-2">Quiz Complete!</h3>
                      <p className="text-muted-foreground mb-4">Calculating final scores...</p>
                      <Button 
                        variant="default" 
                        onClick={() => fetchMatch()}
                      >
                        View Results
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Completed State */}
            {match.status === "completed" && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold mb-2">
                      {match.winnerId === match.myPlayerId ? "🎉 Victory!" : 
                       match.winnerId ? "Better luck next time!" : "It's a Draw!"}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Final Score: {match.player1Score} - {match.player2Score}
                    </p>
                    <div className="flex gap-3 justify-center mb-4">
                      <Link href="/game">
                        <Button variant="outline">Back to Arena</Button>
                      </Link>
                      <Button className="gap-2">
                        <Zap className="w-4 h-4" />
                        Rematch
                      </Button>
                    </div>
                    {recap && recap.length > 0 && (
                      <Button 
                        variant="ghost" 
                        onClick={() => setShowRecap(!showRecap)}
                        className="text-sm"
                      >
                        {showRecap ? "Hide" : "Show"} Question Recap ({recap.length} questions)
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Question Recap */}
                {showRecap && recap && recap.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">📝 Question Recap</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {recap.map((q, idx) => {
                        const myAnswer = match.isPlayer1 ? q.player1Answer : q.player2Answer;
                        const opponentAnswer = match.isPlayer1 ? q.player2Answer : q.player1Answer;
                        const iGotItRight = q.answeredCorrectly === match.myPlayerId;
                        const opponentGotItRight = q.answeredCorrectly && q.answeredCorrectly !== match.myPlayerId;
                        
                        return (
                          <div key={idx} className="border-b border-border pb-4 last:border-0">
                            <div className="flex items-start justify-between mb-2">
                              <Badge variant="outline" className="text-xs">{q.topic}</Badge>
                              <span className="text-xs text-muted-foreground">Q{q.questionNumber}</span>
                            </div>
                            
                            <p className="font-medium mb-3">{q.question}</p>
                            
                            <div className="grid grid-cols-1 gap-2 mb-3">
                              {q.options.map((opt, optIdx) => {
                                const isCorrect = optIdx === q.correctAnswer;
                                const isMyAnswer = optIdx === myAnswer;
                                const isOpponentAnswer = optIdx === opponentAnswer;
                                
                                return (
                                  <div 
                                    key={optIdx}
                                    className={`p-2 rounded text-sm flex items-center justify-between ${
                                      isCorrect ? "bg-green-500/20 border border-green-500/50" :
                                      isMyAnswer && !isCorrect ? "bg-red-500/20 border border-red-500/50" :
                                      "bg-muted/50"
                                    }`}
                                  >
                                    <span>
                                      <span className="font-bold mr-2">{String.fromCharCode(65 + optIdx)}.</span>
                                      {opt}
                                    </span>
                                    <span className="flex gap-2 text-xs">
                                      {isCorrect && <span className="text-green-500">✓ Correct</span>}
                                      {isMyAnswer && <span className={isCorrect ? "text-green-500" : "text-red-500"}>You</span>}
                                      {isOpponentAnswer && <span className={isCorrect ? "text-green-500" : "text-red-500"}>Them</span>}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {q.explanation && (
                              <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded">
                                💡 {q.explanation}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              {iGotItRight && <span className="text-green-500">You got this right! +{q.pointsAwarded}</span>}
                              {opponentGotItRight && <span className="text-yellow-500">Opponent got this one</span>}
                              {!q.answeredCorrectly && <span className="text-gray-500">Nobody got this one</span>}
                              {q.passedTo && <span>• Passed after wrong answer</span>}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* Chat Sidebar */}
          <div className="lg:col-span-1">
            <Card className="h-[500px] flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Live Chat
                  </span>
                  {opponentOnline && (
                    <span className="flex items-center gap-1 text-xs text-green-500">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Online
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-2 mb-3">
                  {chatMessages.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No messages yet. Say hi! 👋
                    </p>
                  )}
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-2 rounded-lg text-sm ${
                        msg.playerId === match.myPlayerId
                          ? "bg-primary/20 ml-4"
                          : "bg-muted mr-4"
                      }`}
                    >
                      <p className="font-medium text-xs text-muted-foreground mb-1">
                        {msg.playerId === match.myPlayerId ? "You" : msg.playerName}
                      </p>
                      <p>{msg.message}</p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                    disabled={!isConnected}
                  />
                  <Button size="icon" onClick={handleSendChat} disabled={!isConnected || !chatMessage.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
