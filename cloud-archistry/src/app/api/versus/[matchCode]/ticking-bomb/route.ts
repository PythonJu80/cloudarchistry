import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";
import { emitToMatch } from "@/lib/socket";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || process.env.NEXT_PUBLIC_LEARNING_AGENT_URL || "https://cloudarchistry.com";
const TOTAL_FUSE = 10; // Total fuse time in seconds

interface QuestionFromAPI {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  topic: string;
  difficulty: string;
  explanation: string;
}

/**
 * POST /api/versus/[matchCode]/ticking-bomb
 * Handle game actions: start, pass, explode
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ matchCode: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { matchCode } = await params;
    const body = await req.json();
    const { action } = body;

    // Get the academy user by email (consistent with other versus routes)
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true, name: true, username: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the match
    const match = await prisma.versusMatch.findUnique({
      where: { matchCode },
      include: {
        player1: { select: { id: true, name: true, username: true } },
        player2: { select: { id: true, name: true, username: true } },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const isPlayer1 = match.player1Id === academyUser.id;
    const isPlayer2 = match.player2Id === academyUser.id;

    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    }

    // Handle START action - generate questions and initialize game
    if (action === "start") {
      if (!isPlayer1) {
        return NextResponse.json({ error: "Only host can start" }, { status: 403 });
      }

      // Get AI config for question generation
      const aiConfig = await getAiConfigForRequest(academyUser.id);

      // Generate questions from learning agent
      const response = await fetch(`${LEARNING_AGENT_URL}/api/gaming/ticking-bomb/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openai_api_key: aiConfig?.key || null,
          preferred_model: aiConfig?.preferredModel || null,
          user_level: "intermediate",
          certification_code: "SAA",
          options: { question_count: 30 },
        }),
      });

      if (!response.ok) {
        return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 });
      }

      const result = await response.json();

      // Transform questions
      const questions = result.questions.map((q: QuestionFromAPI) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        correctIndex: q.correct_index,
        topic: q.topic,
        difficulty: q.difficulty,
        explanation: q.explanation,
      }));

      // Initialize game state
      const players = [
        {
          id: match.player1.id,
          name: match.player1.name || match.player1.username || "Player 1",
          isAlive: true,
          score: 0,
          correctAnswers: 0,
          questionsAnswered: 0,
        },
        {
          id: match.player2!.id,
          name: match.player2!.name || match.player2!.username || "Player 2",
          isAlive: true,
          score: 0,
          correctAnswers: 0,
          questionsAnswered: 0,
        },
      ];

      // Random starting player
      const startingPlayer = players[Math.floor(Math.random() * players.length)];

      const matchState = {
        questions,
        currentQuestion: 0,
        currentBombHolder: startingPlayer.id,
        fuseTime: TOTAL_FUSE,
        players,
      };

      // Update match
      await prisma.versusMatch.update({
        where: { matchCode },
        data: {
          matchState: matchState as object,
        },
      });

      // Notify all players that game has started
      emitToMatch(matchCode, "match-update", { matchState });

      return NextResponse.json({ success: true, matchState });
    }

    // Handle PASS action - pass bomb to another player
    if (action === "pass") {
      const { targetId } = body;

      if (!targetId) {
        return NextResponse.json({ error: "Target required" }, { status: 400 });
      }

      const currentState = match.matchState as {
        questions: Array<{ id: string; question: string; options: string[]; correctIndex: number; topic: string; difficulty: string }>;
        currentQuestion: number;
        currentBombHolder: string;
        fuseTime: number;
        players: Array<{ id: string; name: string; isAlive: boolean; score: number; correctAnswers: number; questionsAnswered: number }>;
      };

      if (!currentState) {
        return NextResponse.json({ error: "Game not started" }, { status: 400 });
      }

      // Verify current user has the bomb
      if (currentState.currentBombHolder !== academyUser.id) {
        return NextResponse.json({ error: "You don't have the bomb" }, { status: 400 });
      }

      // Update player stats - increment both correctAnswers and questionsAnswered
      const updatedPlayers = currentState.players.map((p) => {
        if (p.id === academyUser.id) {
          return { 
            ...p, 
            correctAnswers: p.correctAnswers + 1,
            questionsAnswered: (p.questionsAnswered || 0) + 1
          };
        }
        return p;
      });

      // Move to next question
      const nextQuestion = currentState.currentQuestion + 1;

      // Check if we've run out of questions
      if (nextQuestion >= currentState.questions.length) {
        // Game over - determine winner by most correct answers
        const winner = updatedPlayers.reduce((a, b) => 
          a.correctAnswers > b.correctAnswers ? a : b
        );

        await prisma.versusMatch.update({
          where: { matchCode },
          data: {
            status: "completed",
            winnerId: winner.id,
            completedAt: new Date(),
            matchState: {
              ...currentState,
              players: updatedPlayers,
              currentBombHolder: null,
            } as object,
          },
        });

        // Notify all players that game is over
        emitToMatch(matchCode, "match-status", { status: "completed", winnerId: winner.id });

        return NextResponse.json({ success: true, gameOver: true, winnerId: winner.id });
      }

      // Update match state
      const newState = {
        ...currentState,
        currentQuestion: nextQuestion,
        currentBombHolder: targetId,
        fuseTime: TOTAL_FUSE, // Reset to 60 seconds on throw
        players: updatedPlayers,
      };

      await prisma.versusMatch.update({
        where: { matchCode },
        data: { matchState: newState as object },
      });

      // Notify all players that bomb was passed
      emitToMatch(matchCode, "match-update", { matchState: newState });

      return NextResponse.json({ success: true, matchState: newState });
    }

    // Handle WRONG action - player got answer wrong, move to next question but keep bomb
    if (action === "wrong") {
      const currentState = match.matchState as {
        questions: Array<{ id: string; question: string; options: string[]; correctIndex: number; topic: string; difficulty: string }>;
        currentQuestion: number;
        currentBombHolder: string;
        fuseTime: number;
        players: Array<{ id: string; name: string; isAlive: boolean; score: number; correctAnswers: number; questionsAnswered: number }>;
      };

      if (!currentState) {
        return NextResponse.json({ error: "Game not started" }, { status: 400 });
      }

      // Verify current user has the bomb
      if (currentState.currentBombHolder !== academyUser.id) {
        return NextResponse.json({ error: "You don't have the bomb" }, { status: 400 });
      }

      // Increment questionsAnswered but not correctAnswers
      const updatedPlayers = currentState.players.map((p) => {
        if (p.id === academyUser.id) {
          return { 
            ...p, 
            questionsAnswered: (p.questionsAnswered || 0) + 1
          };
        }
        return p;
      });

      // Move to next question (no score update for wrong answer)
      const nextQuestion = currentState.currentQuestion + 1;

      // Check if we've run out of questions
      if (nextQuestion >= currentState.questions.length) {
        // Game over - determine winner by most correct answers
        const winner = updatedPlayers.reduce((a, b) => 
          a.correctAnswers > b.correctAnswers ? a : b
        );

        await prisma.versusMatch.update({
          where: { matchCode },
          data: {
            status: "completed",
            winnerId: winner.id,
            completedAt: new Date(),
            matchState: {
              ...currentState,
              players: updatedPlayers,
              currentBombHolder: null,
            } as object,
          },
        });

        // Notify all players that game is over
        emitToMatch(matchCode, "match-status", { status: "completed", winnerId: winner.id });

        return NextResponse.json({ success: true, gameOver: true, winnerId: winner.id });
      }

      // Update match state - move to next question, keep bomb with same player
      const newState = {
        ...currentState,
        players: updatedPlayers,
        currentQuestion: nextQuestion,
        // currentBombHolder stays the same
        // fuseTime stays the same (continues counting down)
      };

      await prisma.versusMatch.update({
        where: { matchCode },
        data: { matchState: newState as object },
      });

      // Notify all players that question changed
      emitToMatch(matchCode, "match-update", { matchState: newState });

      return NextResponse.json({ success: true, matchState: newState });
    }

    // Handle EXPLODE action - player ran out of time
    if (action === "explode") {
      const currentState = match.matchState as {
        questions: Array<{ id: string; question: string; options: string[]; correctIndex: number; topic: string; difficulty: string }>;
        currentQuestion: number;
        currentBombHolder: string;
        fuseTime: number;
        players: Array<{ id: string; name: string; isAlive: boolean; score: number; correctAnswers: number; questionsAnswered: number }>;
      };

      if (!currentState) {
        return NextResponse.json({ error: "Game not started" }, { status: 400 });
      }

      // Mark player as eliminated AND deduct 1 point (penalty for explosion)
      const updatedPlayers = currentState.players.map((p) => {
        if (p.id === academyUser.id) {
          return { 
            ...p, 
            isAlive: false,
            correctAnswers: Math.max(0, p.correctAnswers - 1), // Deduct 1 point, minimum 0
            questionsAnswered: (p.questionsAnswered || 0) + 1 // Count as a question faced
          };
        }
        return p;
      });

      const alivePlayers = updatedPlayers.filter((p) => p.isAlive);

      // Check if game over
      if (alivePlayers.length <= 1) {
        const winner = alivePlayers[0];

        await prisma.versusMatch.update({
          where: { matchCode },
          data: {
            status: "completed",
            winnerId: winner?.id || null,
            completedAt: new Date(),
            matchState: {
              ...currentState,
              players: updatedPlayers,
              currentBombHolder: null,
            } as object,
          },
        });

        // Notify all players that game is over
        emitToMatch(matchCode, "match-status", { status: "completed", winnerId: winner?.id });

        return NextResponse.json({ success: true, gameOver: true, winnerId: winner?.id });
      }

      // Pass bomb to random alive player
      const nextHolder = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];

      const newState = {
        ...currentState,
        currentQuestion: currentState.currentQuestion + 1,
        currentBombHolder: nextHolder.id,
        fuseTime: 15,
        players: updatedPlayers,
      };

      await prisma.versusMatch.update({
        where: { matchCode },
        data: { matchState: newState as object },
      });

      // Notify all players that bomb exploded and was passed
      emitToMatch(matchCode, "match-update", { matchState: newState });

      return NextResponse.json({ success: true, matchState: newState });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Ticking Bomb API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
