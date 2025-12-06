import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface QuestionAnswer {
  questionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean;
  pointsEarned: number;
  hintUsed: boolean;
  answeredAt: string;
}

interface DiagramData {
  nodes: unknown[];
  edges: unknown[];
}

interface ProgressUpdate {
  attemptId: string;
  challengeId: string;
  answers: QuestionAnswer[];
  totalPointsEarned: number;
  hintsUsed: number;
  isComplete: boolean;
  questionsData?: {
    brief: string;
    questions: unknown[];
    totalPoints: number;
    estimatedTimeMinutes: number;
  };
  diagramData?: DiagramData;
}

/**
 * POST /api/challenge/progress
 * 
 * Saves challenge progress (answers, points, completion status)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to save progress" },
        { status: 401 }
      );
    }

    const body: ProgressUpdate = await request.json();
    const { 
      attemptId, 
      challengeId, 
      answers, 
      totalPointsEarned, 
      hintsUsed, 
      isComplete,
      questionsData,
      diagramData,
    } = body;

    if (!attemptId || !challengeId) {
      return NextResponse.json(
        { error: "Missing attemptId or challengeId" },
        { status: 400 }
      );
    }

    // Verify the attempt belongs to this user
    const attempt = await prisma.scenarioAttempt.findFirst({
      where: {
        id: attemptId,
        profileId: session.user.academyProfileId,
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Attempt not found or unauthorized" },
        { status: 404 }
      );
    }

    // Prepare solution JSON - Prisma needs it as a plain object
    const solutionData = JSON.parse(JSON.stringify({
      answers,
      questionsData,
      diagramData,  // Include diagram data in solution
      lastUpdated: new Date().toISOString(),
    }));

    const feedbackData = isComplete ? JSON.parse(JSON.stringify({
      completed: true,
      score: totalPointsEarned,
      totalQuestions: answers.length,
      correctAnswers: answers.filter(a => a.isCorrect).length,
    })) : undefined;

    // Update ChallengeProgress
    const progress = await prisma.challengeProgress.upsert({
      where: {
        attemptId_challengeId: {
          attemptId,
          challengeId,
        },
      },
      update: {
        status: isComplete ? "completed" : "in_progress",
        completedAt: isComplete ? new Date() : null,
        pointsEarned: totalPointsEarned,
        hintsUsed: hintsUsed,
        attemptsCount: { increment: isComplete ? 1 : 0 },
        solution: solutionData,
        feedback: feedbackData,
      },
      create: {
        attemptId,
        challengeId,
        status: isComplete ? "completed" : "in_progress",
        startedAt: new Date(),
        completedAt: isComplete ? new Date() : null,
        pointsEarned: totalPointsEarned,
        hintsUsed: hintsUsed,
        attemptsCount: isComplete ? 1 : 0,
        solution: solutionData,
      },
    });

    // If complete, unlock next challenge and update attempt totals
    if (isComplete) {
      // Get all challenges for this scenario to find the next one
      const allProgress = await prisma.challengeProgress.findMany({
        where: { attemptId },
        include: { challenge: true },
        orderBy: { challenge: { orderIndex: "asc" } },
      });

      const currentIndex = allProgress.findIndex(p => p.challengeId === challengeId);
      const nextProgress = allProgress[currentIndex + 1];

      // Unlock next challenge if exists and still locked
      if (nextProgress && nextProgress.status === "locked") {
        await prisma.challengeProgress.update({
          where: { id: nextProgress.id },
          data: {
            status: "unlocked",
            unlockedAt: new Date(),
          },
        });
      }

      // Update ScenarioAttempt totals
      const totalEarned = allProgress.reduce((sum, p) => sum + p.pointsEarned, 0);
      const allComplete = allProgress.every(p => 
        p.challengeId === challengeId ? isComplete : p.status === "completed"
      );

      await prisma.scenarioAttempt.update({
        where: { id: attemptId },
        data: {
          pointsEarned: totalEarned + totalPointsEarned,
          lastActivityAt: new Date(),
          status: allComplete ? "completed" : "in_progress",
          completedAt: allComplete ? new Date() : null,
        },
      });

      // Update user profile if scenario complete
      if (allComplete) {
        await prisma.academyUserProfile.update({
          where: { id: session.user.academyProfileId },
          data: {
            totalPoints: { increment: totalEarned + totalPointsEarned },
            xp: { increment: Math.floor((totalEarned + totalPointsEarned) / 10) },
            challengesCompleted: { increment: allProgress.length },
            scenariosCompleted: { increment: 1 },
            lastActivityDate: new Date(),
          },
        });
      } else {
        // Just update for challenge completion
        await prisma.academyUserProfile.update({
          where: { id: session.user.academyProfileId },
          data: {
            totalPoints: { increment: totalPointsEarned },
            xp: { increment: Math.floor(totalPointsEarned / 10) },
            challengesCompleted: { increment: 1 },
            lastActivityDate: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      progressId: progress.id,
      status: progress.status,
      pointsEarned: progress.pointsEarned,
    });

  } catch (error) {
    console.error("Save progress error:", error);
    return NextResponse.json(
      { error: "Failed to save progress", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/challenge/progress?attemptId=xxx&challengeId=xxx
 * 
 * Loads existing progress for a challenge
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const attemptId = searchParams.get("attemptId");
    const challengeId = searchParams.get("challengeId");

    if (!attemptId || !challengeId) {
      return NextResponse.json(
        { error: "Missing attemptId or challengeId" },
        { status: 400 }
      );
    }

    // Verify the attempt belongs to this user
    const attempt = await prisma.scenarioAttempt.findFirst({
      where: {
        id: attemptId,
        profileId: session.user.academyProfileId,
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Attempt not found or unauthorized" },
        { status: 404 }
      );
    }

    const progress = await prisma.challengeProgress.findUnique({
      where: {
        attemptId_challengeId: {
          attemptId,
          challengeId,
        },
      },
    });

    if (!progress) {
      return NextResponse.json({
        exists: false,
        progress: null,
      });
    }

    // Extract diagramData from solution if present
    const solution = progress.solution as { diagramData?: DiagramData; answers?: QuestionAnswer[] } | null;
    
    return NextResponse.json({
      exists: true,
      progress: {
        id: progress.id,
        status: progress.status,
        pointsEarned: progress.pointsEarned,
        hintsUsed: progress.hintsUsed,
        attemptsCount: progress.attemptsCount,
        solution: progress.solution,
        diagramData: solution?.diagramData || null,  // Extract for easy access
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
      },
    });

  } catch (error) {
    console.error("Load progress error:", error);
    return NextResponse.json(
      { error: "Failed to load progress" },
      { status: 500 }
    );
  }
}
