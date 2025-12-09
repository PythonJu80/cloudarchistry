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

    let match = await prisma.versusMatch.findUnique({
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

    // Auto-fix: If match is "active" but all questions answered, mark as completed
    if (match.status === "active" && match.currentQuestion >= match.totalQuestions) {
      // Determine winner
      let winnerId = null;
      if (match.player1Score > match.player2Score) {
        winnerId = match.player1Id;
      } else if (match.player2Score > match.player1Score) {
        winnerId = match.player2Id;
      }
      
      // Update the match status
      const updatedMatch = await prisma.versusMatch.update({
        where: { matchCode },
        data: {
          status: "completed",
          completedAt: new Date(),
          winnerId,
        },
        include: {
          player1: { select: { id: true, name: true, username: true, email: true } },
          player2: { select: { id: true, name: true, username: true, email: true } },
          challenge: { select: { id: true, title: true, description: true, difficulty: true, points: true } },
        },
      });
      
      // Use the updated match
      match = updatedMatch;
    }

    // If match is completed, include full recap data
    const matchState = match.matchState as {
      questions?: Array<{
        question: string;
        options: string[];
        correctIndex: number;
        topic?: string;
        explanation?: string;
      }>;
      questionHistory?: Array<{
        questionIndex: number;
        player1Answer: number | null;
        player2Answer: number | null;
        buzzedBy: string | null;
        passedTo: string | null;
        answeredCorrectly: string | null;
        pointsAwarded: number;
      }>;
      passedTo?: string;
      firstAnswer?: number;
    } || {};

    let recap = null;
    if (match.status === "completed" && matchState.questions && matchState.questionHistory) {
      recap = matchState.questions.map((q, idx) => {
        const history = matchState.questionHistory?.[idx];
        return {
          questionNumber: idx + 1,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctIndex,
          correctAnswerText: q.options[q.correctIndex],
          topic: q.topic || "AWS",
          explanation: q.explanation || null,
          player1Answer: history?.player1Answer ?? null,
          player2Answer: history?.player2Answer ?? null,
          buzzedBy: history?.buzzedBy || null,
          passedTo: history?.passedTo || null,
          answeredCorrectly: history?.answeredCorrectly || null,
          pointsAwarded: history?.pointsAwarded || 0,
        };
      });
    }

    return NextResponse.json({
      match: {
        ...match,
        myPlayerId,
        isPlayer1,
        myScore: isPlayer1 ? match.player1Score : match.player2Score,
        opponentScore: isPlayer1 ? match.player2Score : match.player1Score,
        opponent: isPlayer1 ? match.player2 : match.player1,
        // Include pass-back state for UI
        passedTo: matchState.passedTo || null,
        opponentAnswer: matchState.firstAnswer ?? null,
      },
      recap, // Full question recap for completed matches
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
        // Player 2 declines OR Player 1 cancels their own pending challenge
        if (!isPlayer2 && !isPlayer1) {
          return NextResponse.json({ error: "You are not part of this match" }, { status: 403 });
        }
        
        // Player 1 can only cancel if match is still pending
        if (isPlayer1 && match.status !== "pending") {
          return NextResponse.json({ error: "Can only cancel pending challenges" }, { status: 400 });
        }

        const updated = await prisma.versusMatch.update({
          where: { matchCode },
          data: { status: "cancelled" },
        });

        return NextResponse.json({ 
          match: updated, 
          message: isPlayer1 ? "Challenge cancelled" : "Match declined" 
        });
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
        // Submit answer after buzzing (or after pass-back)
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
            topic?: string;
            explanation?: string;
          }>;
          currentQuestionBuzz?: string;
          passedTo?: string; // Player who gets the pass-back
          firstAnswerBy?: string; // Who answered first (for display)
          firstAnswer?: number; // What they answered (for display)
          questionHistory?: Array<{
            questionIndex: number;
            player1Answer: number | null;
            player2Answer: number | null;
            buzzedBy: string | null;
            passedTo: string | null;
            answeredCorrectly: string | null; // playerId who got it right
            pointsAwarded: number;
          }>;
        } || {};

        // Check if this is a pass-back situation or original buzz
        const isPassBack = matchState.passedTo === academyUser.id;
        const originalBuzzer = matchState.currentQuestionBuzz;
        
        // Verify this player can answer (either buzzed or got pass-back)
        if (!isPassBack && originalBuzzer !== academyUser.id) {
          return NextResponse.json({ error: "You didn't buzz first!" }, { status: 400 });
        }

        const questions = matchState.questions || [];
        const currentQ = questions[match.currentQuestion];
        
        if (!currentQ) {
          return NextResponse.json({ error: "No current question" }, { status: 400 });
        }

        const isCorrect = answerIndex === currentQ.correctIndex;
        
        // Points: +100 for correct, -50 for wrong on buzz, 0 for wrong on pass-back
        let points = 0;
        if (isCorrect) {
          points = isPassBack ? 50 : 100; // Less points for pass-back steal
        } else if (!isPassBack) {
          points = -50; // Penalty only for original buzzer
        }

        // Update scores
        let newPlayer1Score = match.player1Score;
        let newPlayer2Score = match.player2Score;
        if (isPlayer1) {
          newPlayer1Score += points;
        } else {
          newPlayer2Score += points;
        }

        // Update question history for recap
        const questionHistory = matchState.questionHistory || [];
        const currentHistory = questionHistory[match.currentQuestion] || {
          questionIndex: match.currentQuestion,
          player1Answer: null,
          player2Answer: null,
          buzzedBy: null,
          passedTo: null,
          answeredCorrectly: null,
          pointsAwarded: 0,
        };

        // Record this player's answer
        if (isPlayer1) {
          currentHistory.player1Answer = answerIndex;
        } else {
          currentHistory.player2Answer = answerIndex;
        }

        if (!currentHistory.buzzedBy) {
          currentHistory.buzzedBy = originalBuzzer || null;
        }

        // Handle wrong answer - pass to opponent
        if (!isCorrect && !isPassBack) {
          // First player got it wrong - pass to opponent
          const opponentId = isPlayer1 ? match.player2Id : match.player1Id;
          
          currentHistory.passedTo = opponentId;
          questionHistory[match.currentQuestion] = currentHistory;

          const updated = await prisma.versusMatch.update({
            where: { matchCode },
            data: {
              player1Score: newPlayer1Score,
              player2Score: newPlayer2Score,
              matchState: {
                ...matchState,
                passedTo: opponentId,
                firstAnswerBy: academyUser.id,
                firstAnswer: answerIndex,
                questionHistory,
              },
            },
          });

          return NextResponse.json({
            match: updated,
            result: {
              correct: false,
              points,
              passedTo: opponentId,
              yourAnswer: answerIndex,
              // Don't reveal correct answer yet - opponent gets a chance
            },
          });
        }

        // Either correct answer OR wrong on pass-back - move to next question
        if (isCorrect) {
          currentHistory.answeredCorrectly = academyUser.id;
          currentHistory.pointsAwarded = points;
        }
        questionHistory[match.currentQuestion] = currentHistory;

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
              currentQuestionBuzz: null,
              passedTo: null,
              firstAnswerBy: null,
              firstAnswer: null,
              questionHistory,
            },
          },
        });

        return NextResponse.json({
          match: updated,
          result: {
            correct: isCorrect,
            points,
            correctAnswer: currentQ.correctIndex,
            explanation: currentQ.explanation || null,
            yourAnswer: answerIndex,
            opponentAnswer: isPassBack ? matchState.firstAnswer : null,
          },
        });
      }

      case "pass": {
        // Player passes/skips their turn (only valid on pass-back)
        if (match.status !== "active") {
          return NextResponse.json({ error: "Match is not active" }, { status: 400 });
        }

        const passMatchState = match.matchState as {
          questions?: Array<{
            question: string;
            options: string[];
            correctIndex: number;
            explanation?: string;
          }>;
          passedTo?: string;
          firstAnswerBy?: string;
          firstAnswer?: number;
          questionHistory?: Array<{
            questionIndex: number;
            player1Answer: number | null;
            player2Answer: number | null;
            buzzedBy: string | null;
            passedTo: string | null;
            answeredCorrectly: string | null;
            pointsAwarded: number;
          }>;
        } || {};

        // Can only pass if it was passed to you
        if (passMatchState.passedTo !== academyUser.id) {
          return NextResponse.json({ error: "You can only pass on a pass-back" }, { status: 400 });
        }

        const passQuestions = passMatchState.questions || [];
        const passCurrentQ = passQuestions[match.currentQuestion];

        // Update history - nobody got it right
        const passHistory = passMatchState.questionHistory || [];
        const passCurrentHistory = passHistory[match.currentQuestion] || {
          questionIndex: match.currentQuestion,
          player1Answer: null,
          player2Answer: null,
          buzzedBy: null,
          passedTo: null,
          answeredCorrectly: null,
          pointsAwarded: 0,
        };
        passCurrentHistory.answeredCorrectly = null; // Nobody got it
        passHistory[match.currentQuestion] = passCurrentHistory;

        const passNextQuestion = match.currentQuestion + 1;
        const passIsComplete = passNextQuestion >= match.totalQuestions;

        let passWinnerId = null;
        if (passIsComplete) {
          if (match.player1Score > match.player2Score) {
            passWinnerId = match.player1Id;
          } else if (match.player2Score > match.player1Score) {
            passWinnerId = match.player2Id;
          }
        }

        const passUpdated = await prisma.versusMatch.update({
          where: { matchCode },
          data: {
            currentQuestion: passNextQuestion,
            status: passIsComplete ? "completed" : "active",
            completedAt: passIsComplete ? new Date() : null,
            winnerId: passWinnerId,
            matchState: {
              ...passMatchState,
              currentQuestionBuzz: null,
              passedTo: null,
              firstAnswerBy: null,
              firstAnswer: null,
              questionHistory: passHistory,
            },
          },
        });

        return NextResponse.json({
          match: passUpdated,
          result: {
            passed: true,
            correctAnswer: passCurrentQ?.correctIndex,
            explanation: passCurrentQ?.explanation || null,
            opponentAnswer: passMatchState.firstAnswer,
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
