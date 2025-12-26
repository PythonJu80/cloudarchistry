"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Loader2,
  Trophy,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scoreboard } from "../../components/scoreboard";
import { ChatSidebar } from "../../components/chat-sidebar";

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

interface QuizBattleGameProps {
  match: MatchData;
  question: QuestionData | null;
  chatMessages: ChatMessage[];
  isConnected: boolean;
  opponentOnline: boolean;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
  onStartQuiz: () => Promise<void>;
  onBuzz: () => Promise<void>;
  onAnswer: (answerIndex: number) => Promise<void>;
  onSendChat: (message: string) => void;
  socketSendChat: (message: string) => void;
}

export function QuizBattleGame({
  match,
  question,
  chatMessages,
  isConnected,
  opponentOnline,
  onAccept,
  onDecline,
  onStartQuiz,
  onBuzz,
  onAnswer,
  onSendChat,
}: QuizBattleGameProps) {
  const [buzzing, setBuzzing] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [chatMessage, setChatMessage] = useState("");

  const handleBuzz = useCallback(async () => {
    if (buzzing || !question?.canBuzz) return;
    setBuzzing(true);
    try {
      await onBuzz();
    } finally {
      setBuzzing(false);
    }
  }, [buzzing, question?.canBuzz, onBuzz]);

  const handleAnswer = useCallback(
    async (answerIndex: number) => {
      if (answering) return;
      setAnswering(true);
      try {
        await onAnswer(answerIndex);
      } finally {
        setAnswering(false);
      }
    },
    [answering, onAnswer]
  );

  const handleSendChat = useCallback(() => {
    if (!chatMessage.trim()) return;
    onSendChat(chatMessage);
    setChatMessage("");
  }, [chatMessage, onSendChat]);

  const isMyTurn = question?.buzzedBy === match.myPlayerId;
  const opponentBuzzed = question?.buzzedBy && question.buzzedBy !== match.myPlayerId;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Game Area */}
      <div className="lg:col-span-2 space-y-4">
        {/* Scoreboard */}
        <Scoreboard
          player1={match.player1}
          player2={match.player2}
          player1Score={match.player1Score}
          player2Score={match.player2Score}
          isPlayer1={match.isPlayer1}
          winnerId={match.winnerId}
          myPlayerId={match.myPlayerId}
          status={match.status}
          currentQuestion={question?.questionNumber}
          totalQuestions={question?.totalQuestions}
        />

        {/* Pending State - Waiting for acceptance */}
        {match.status === "pending" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Clock className="w-5 h-5" />
                {match.isPlayer1 ? "Waiting for opponent..." : "You've been challenged!"}
              </div>
            </CardHeader>
            <CardContent>
              {match.isPlayer1 ? (
                <p className="text-muted-foreground">
                  Waiting for {match.opponent.name || match.opponent.username} to accept the
                  challenge.
                </p>
              ) : (
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    {match.player1.name || match.player1.username} wants to battle you in a Quiz!
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={onAccept} className="gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Accept Challenge
                    </Button>
                    <Button variant="outline" onClick={onDecline} className="gap-2">
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
            {(!match.matchState?.questions || match.matchState.questions.length === 0) &&
              match.isPlayer1 && (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <Play className="w-12 h-12 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Ready to Start?</h3>
                    <p className="text-muted-foreground mb-4">
                      Click below to generate questions and begin the quiz battle!
                    </p>
                    <Button onClick={onStartQuiz} size="lg" className="gap-2">
                      <Zap className="w-5 h-5" />
                      Start Quiz!
                    </Button>
                  </CardContent>
                </Card>
              )}

            {/* Waiting for player 1 to start */}
            {(!match.matchState?.questions || match.matchState.questions.length === 0) &&
              !match.isPlayer1 && (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Get Ready!</h3>
                    <p className="text-muted-foreground">
                      Waiting for {match.player1.name || match.player1.username} to start the
                      quiz...
                    </p>
                  </CardContent>
                </Card>
              )}

            {/* Question Display */}
            {question && !question.complete && (
              <Card className="relative overflow-hidden">
                {/* Result Overlay */}
                {showResult && lastResult && (
                  <div
                    className={`absolute inset-0 z-10 flex items-center justify-center ${
                      lastResult.correct ? "bg-green-500/90" : "bg-red-500/90"
                    }`}
                  >
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
                                <span className="font-bold mr-3">
                                  {String.fromCharCode(65 + idx)}.
                                </span>
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
                {match.winnerId === match.myPlayerId
                  ? "🎉 Victory!"
                  : match.winnerId
                    ? "Better luck next time!"
                    : "It's a Draw!"}
              </h3>
              <p className="text-muted-foreground mb-6">
                Final Score: {match.player1Score} - {match.player2Score}
              </p>
              <div className="flex gap-3 justify-center">
                <Link href="/game">
                  <Button variant="outline">Back to Arena</Button>
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
        <ChatSidebar
          messages={chatMessages}
          myPlayerId={match.myPlayerId}
          opponentOnline={opponentOnline}
          isConnected={isConnected}
          chatMessage={chatMessage}
          onChatMessageChange={setChatMessage}
          onSendMessage={handleSendChat}
        />
      </div>
    </div>
  );
}
