import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/versus/[matchCode] - Get match details and state
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { matchCode: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { matchCode } = params;

    const match = await prisma.versusMatch.findUnique({
      where: { matchCode },
      include: {
        player1: {
          select: { id: true, name: true, username: true, email: true },
        },
        player2: {
          select: { id: true, name: true, username: true, email: true },
        },
        challenge: {
          select: { 
            id: true, 
            title: true, 
            description: true,
            difficulty: true,
            points: true,
          },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Get current user's academy ID
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is part of this match
    const isPlayer = match.player1Id === academyUser.id || match.player2Id === academyUser.id;
    if (!isPlayer) {
      return NextResponse.json({ error: "You are not part of this match" }, { status: 403 });
    }

    // Determine which player the current user is
    const myPlayerId = academyUser.id;
    const isPlayer1 = match.player1Id === myPlayerId;

    return NextResponse.json({
      match: {
        ...match,
        myPlayerId,
        isPlayer1,
        myScore: isPlayer1 ? match.player1Score : match.player2Score,
        opponentScore: isPlayer1 ? match.player2Score : match.player1Score,
        opponent: isPlayer1 ? match.player2 : match.player1,
      },
    });
  } catch (error) {
    console.error("Error fetching match:", error);
    return NextResponse.json({ error: "Failed to fetch match" }, { status: 500 });
  }
}

/**
 * PATCH /api/versus/[matchCode] - Update match state (accept, start, answer, chat)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { matchCode: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { matchCode } = params;
    const body = await req.json();
    const { action, data } = body;

    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true, name: true, username: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const match = await prisma.versusMatch.findUnique({
      where: { matchCode },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const isPlayer1 = match.player1Id === academyUser.id;
    const isPlayer2 = match.player2Id === academyUser.id;

    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ error: "You are not part of this match" }, { status: 403 });
    }

    switch (action) {
      case "accept": {
        // Player 2 accepts the challenge
        if (!isPlayer2) {
          return NextResponse.json({ error: "Only the challenged player can accept" }, { status: 403 });
        }
        if (match.status !== "pending") {
          return NextResponse.json({ error: "Match is not pending" }, { status: 400 });
        }

        const updated = await prisma.versusMatch.update({
          where: { matchCode },
          data: { status: "active", startedAt: new Date() },
        });

        return NextResponse.json({ match: updated, message: "Match started!" });
      }

      case "decline": {
        // Player 2 declines
        if (!isPlayer2) {
          return NextResponse.json({ error: "Only the challenged player can decline" }, { status: 403 });
        }

        const updated = await prisma.versusMatch.update({
          where: { matchCode },
          data: { status: "cancelled" },
        });

        return NextResponse.json({ match: updated, message: "Match declined" });
      }

      case "chat": {
        // Add chat message
        const { message } = data;
        if (!message || typeof message !== "string") {
          return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        const currentMessages = (match.chatMessages as Array<{
          id: string;
          playerId: string;
          playerName: string;
          message: string;
          timestamp: string;
        }>) || [];

        const newMessage = {
          id: `msg_${Date.now()}`,
          playerId: academyUser.id,
          playerName: academyUser.name || academyUser.username || "Player",
          message: message.slice(0, 500), // Limit message length
          timestamp: new Date().toISOString(),
        };

        const updated = await prisma.versusMatch.update({
          where: { matchCode },
          data: {
            chatMessages: [...currentMessages, newMessage],
          },
        });

        return NextResponse.json({ 
          match: updated, 
          newMessage,
        });
      }

      case "buzz": {
        // Player buzzes in for current question
        if (match.status !== "active") {
          return NextResponse.json({ error: "Match is not active" }, { status: 400 });
        }

        const matchState = match.matchState as {
          questions?: Array<{
            question: string;
            options: string[];
            correctIndex: number;
          }>;
          currentQuestionBuzz?: string;
          answers?: Record<string, { answer: number; correct: boolean; time: number }[]>;
        } || {};

        // Check if someone already buzzed for this question
        if (matchState.currentQuestionBuzz) {
          return NextResponse.json({ error: "Someone already buzzed!" }, { status: 400 });
        }

        const updated = await prisma.versusMatch.update({
          where: { matchCode },
          data: {
            matchState: {
              ...matchState,
              currentQuestionBuzz: academyUser.id,
              buzzTime: Date.now(),
            },
          },
        });

        return NextResponse.json({ 
          match: updated, 
          buzzedBy: academyUser.id,
        });
      }

      case "answer": {
        // Submit answer after buzzing
        if (match.status !== "active") {
          return NextResponse.json({ error: "Match is not active" }, { status: 400 });
        }

        const { answerIndex } = data;
        if (typeof answerIndex !== "number") {
          return NextResponse.json({ error: "Answer index is required" }, { status: 400 });
        }

        const matchState = match.matchState as {
          questions?: Array<{
            question: string;
            options: string[];
            correctIndex: number;
          }>;
          currentQuestionBuzz?: string;
          answers?: Record<string, { questionIndex: number; answer: number; correct: boolean; points: number }[]>;
        } || {};

        // Verify this player buzzed
        if (matchState.currentQuestionBuzz !== academyUser.id) {
          return NextResponse.json({ error: "You didn't buzz first!" }, { status: 400 });
        }

        const questions = matchState.questions || [];
        const currentQ = questions[match.currentQuestion];
        
        if (!currentQ) {
          return NextResponse.json({ error: "No current question" }, { status: 400 });
        }

        const isCorrect = answerIndex === currentQ.correctIndex;
        const points = isCorrect ? 100 : -50; // Penalty for wrong answer after buzz

        // Update scores
        const newPlayer1Score = isPlayer1 
          ? match.player1Score + points 
          : match.player1Score;
        const newPlayer2Score = isPlayer2 
          ? match.player2Score + points 
          : match.player2Score;

        // Track answer
        const answers = matchState.answers || {};
        const playerAnswers = answers[academyUser.id] || [];
        playerAnswers.push({
          questionIndex: match.currentQuestion,
          answer: answerIndex,
          correct: isCorrect,
          points,
        });
        answers[academyUser.id] = playerAnswers;

        // Move to next question
        const nextQuestion = match.currentQuestion + 1;
        const isComplete = nextQuestion >= match.totalQuestions;

        // Determine winner if complete
        let winnerId = null;
        if (isComplete) {
          if (newPlayer1Score > newPlayer2Score) {
            winnerId = match.player1Id;
          } else if (newPlayer2Score > newPlayer1Score) {
            winnerId = match.player2Id;
          }
          // null = draw
        }

        const updated = await prisma.versusMatch.update({
          where: { matchCode },
          data: {
            player1Score: newPlayer1Score,
            player2Score: newPlayer2Score,
            currentQuestion: nextQuestion,
            status: isComplete ? "completed" : "active",
            completedAt: isComplete ? new Date() : null,
            winnerId,
            matchState: {
              ...matchState,
              currentQuestionBuzz: null, // Reset buzz for next question
              answers,
            },
          },
        });

        return NextResponse.json({
          match: updated,
          result: {
            correct: isCorrect,
            points,
            correctAnswer: currentQ.correctIndex,
          },
        });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error updating match:", error);
    return NextResponse.json({ error: "Failed to update match" }, { status: 500 });
  }
}
