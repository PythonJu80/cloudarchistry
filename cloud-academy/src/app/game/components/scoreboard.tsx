"use client";

import { Users, Crown, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Player {
  id: string;
  name: string | null;
  username: string | null;
  email: string;
}

interface ScoreboardProps {
  player1: Player;
  player2: Player;
  player1Score: number;
  player2Score: number;
  isPlayer1: boolean;
  winnerId: string | null;
  myPlayerId: string;
  status: string;
  currentQuestion?: number;
  totalQuestions?: number;
}

export function Scoreboard({
  player1,
  player2,
  player1Score,
  player2Score,
  isPlayer1,
  winnerId,
  myPlayerId,
  status,
  currentQuestion,
  totalQuestions,
}: ScoreboardProps) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {/* Player 1 */}
      <Card className={`${isPlayer1 ? "ring-2 ring-primary" : ""}`}>
        <CardContent className="pt-4 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
            <Users className="w-6 h-6 text-blue-500" />
          </div>
          <p className="font-semibold truncate">
            {player1.name || player1.username || "Player 1"}
            {isPlayer1 && " (You)"}
          </p>
          <p className="text-3xl font-bold text-blue-500 mt-2">{player1Score}</p>
          {winnerId === player1.id && <Crown className="w-6 h-6 text-yellow-500 mx-auto mt-2" />}
        </CardContent>
      </Card>

      {/* VS / Status */}
      <Card className="flex items-center justify-center">
        <CardContent className="text-center py-4">
          {status === "active" && currentQuestion && totalQuestions && (
            <>
              <p className="text-sm text-muted-foreground">Question</p>
              <p className="text-2xl font-bold">
                {currentQuestion}/{totalQuestions}
              </p>
            </>
          )}
          {status === "pending" && <p className="text-xl font-bold text-muted-foreground">VS</p>}
          {status === "completed" && (
            <>
              <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm font-medium">
                {winnerId === myPlayerId ? "You Win!" : winnerId ? "You Lose" : "Draw!"}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Player 2 */}
      <Card className={`${!isPlayer1 ? "ring-2 ring-primary" : ""}`}>
        <CardContent className="pt-4 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-2">
            <Users className="w-6 h-6 text-red-500" />
          </div>
          <p className="font-semibold truncate">
            {player2.name || player2.username || "Player 2"}
            {!isPlayer1 && " (You)"}
          </p>
          <p className="text-3xl font-bold text-red-500 mt-2">{player2Score}</p>
          {winnerId === player2.id && <Crown className="w-6 h-6 text-yellow-500 mx-auto mt-2" />}
        </CardContent>
      </Card>
    </div>
  );
}
