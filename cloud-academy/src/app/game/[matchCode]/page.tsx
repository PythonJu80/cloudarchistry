"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Loader2,
  Trophy,
  Zap,
  MessageCircle,
  Send,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Crown,
  Users,
  Play,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Player {
  id: string;
  name: string | null;
  username: string | null;
  email: string;
}

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: string;
}

interface MatchData {
  id: string;
  matchCode: string;
  player1: Player;
  player2: Player;
  player1Score: number;
  player2Score: number;
  status: string;
  matchType: string;
  currentQuestion: number;
  totalQuestions: number;
  chatMessages: ChatMessage[];
  myPlayerId: string;
  isPlayer1: boolean;
  myScore: number;
  opponentScore: number;
  opponent: Player;
  winnerId: string | null;
  matchState: {
    currentQuestionBuzz?: string;
    questions?: unknown[];
  };
}

interface QuestionData {
  questionNumber: number;
  totalQuestions: number;
  question: string;
  options: string[];
  topic: string;
  buzzedBy: string | null;
  canBuzz: boolean;
  complete?: boolean;
}

interface AnswerResult {
  correct: boolean;
  points: number;
  correctAnswer: number;
}

export default function GameMatchPage() {
  const params = useParams();
  const router = useRouter();
  const matchCode = params.matchCode as string;
  const { status: authStatus } = useSession();

  const [match, setMatch] = useState<MatchData | null>(null);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Chat state
  const [chatMessage, setChatMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Quiz state
  const [buzzing, setBuzzing] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Fetch match data
  const fetchMatch = async () => {
    try {
      const res = await fetch(`/api/versus/${matchCode}`);
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to load match");
        return;
      }
      
      setMatch(data.match);
      setError(null);
    } catch {
      setError("Failed to load match");
    } finally {
      setLoading(false);
    }
  };

  // Fetch current question
  const fetchQuestion = async () => {
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
  };

  // Initial load
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
      return;
    }
    
    if (authStatus === "authenticated" && matchCode) {
      fetchMatch();
    }
  }, [authStatus, matchCode, router]);

  // Poll for updates when match is active
  useEffect(() => {
    if (!match) return;
    
    const interval = setInterval(() => {
      fetchMatch();
      if (match.status === "active") {
        fetchQuestion();
      }
    }, 2000); // Poll every 2 seconds
    
    return () => clearInterval(interval);
  }, [match?.status, matchCode]);

  // Fetch question when match becomes active
  useEffect(() => {
    if (match?.status === "active") {
      fetchQuestion();
    }
  }, [match?.status]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [match?.chatMessages]);

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

  // Send chat message
  const handleSendChat = async () => {
    if (!chatMessage.trim() || sendingChat) return;
    
    setSendingChat(true);
    try {
      const res = await fetch(`/api/versus/${matchCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "chat", 
          data: { message: chatMessage } 
        }),
      });
      
      if (res.ok) {
        setChatMessage("");
        fetchMatch();
      }
    } catch (err) {
      console.error("Failed to send chat:", err);
    } finally {
      setSendingChat(false);
    }
  };

  // Buzz in
  const handleBuzz = async () => {
    if (buzzing || !question?.canBuzz) return;
    
    setBuzzing(true);
    try {
      const res = await fetch(`/api/versus/${matchCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "buzz" }),
      });
      
      if (res.ok) {
        fetchMatch();
        fetchQuestion();
      }
    } catch (err) {
      console.error("Failed to buzz:", err);
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
        setLastResult(data.result);
        setShowResult(true);
        
        // Hide result after 2 seconds and move to next question
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
  const opponentBuzzed = question?.buzzedBy && question.buzzedBy !== match.myPlayerId;

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
                        lastResult.correct ? "bg-green-500/90" : "bg-red-500/90"
                      }`}>
                        <div className="text-center text-white">
                          {lastResult.correct ? (
                            <>
                              <CheckCircle className="w-16 h-16 mx-auto mb-2" />
                              <p className="text-2xl font-bold">Correct!</p>
                              <p className="text-xl">+{lastResult.points} points</p>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-16 h-16 mx-auto mb-2" />
                              <p className="text-2xl font-bold">Wrong!</p>
                              <p className="text-xl">{lastResult.points} points</p>
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

                      {/* Someone buzzed */}
                      {question.buzzedBy && (
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

                {/* Quiz Complete */}
                {question?.complete && (
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                      <h3 className="text-2xl font-bold mb-2">Quiz Complete!</h3>
                      <p className="text-muted-foreground">Calculating final scores...</p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Completed State */}
            {match.status === "completed" && (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">
                    {match.winnerId === match.myPlayerId ? "🎉 Victory!" : 
                     match.winnerId ? "Better luck next time!" : "It's a Draw!"}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Final Score: {match.player1Score} - {match.player2Score}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Link href="/dashboard">
                      <Button variant="outline">Back to Dashboard</Button>
                    </Link>
                    <Button className="gap-2">
                      <Zap className="w-4 h-4" />
                      Rematch
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Chat Sidebar */}
          <div className="lg:col-span-1">
            <Card className="h-[500px] flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageCircle className="w-4 h-4" />
                  Live Chat
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-2 mb-3">
                  {match.chatMessages.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No messages yet. Say hi! 👋
                    </p>
                  )}
                  {match.chatMessages.map((msg) => (
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
                    disabled={sendingChat}
                  />
                  <Button size="icon" onClick={handleSendChat} disabled={sendingChat || !chatMessage.trim()}>
                    {sendingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
