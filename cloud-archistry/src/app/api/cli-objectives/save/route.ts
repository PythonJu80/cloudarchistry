import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface CLIObjective {
  id: string;
  description: string;
  command_pattern: string;
  example_command: string;
  hint?: string;
  points: number;
  service: string;
  completed: boolean;
}

interface CLIHistoryEntry {
  type: string;
  content: string;
  timestamp: string;
}

interface SaveRequest {
  attemptId: string;
  challengeId: string;
  objectives: CLIObjective[];
  contextMessage: string;
  totalPoints: number;
  earnedPoints: number;
  commandHistory?: CLIHistoryEntry[]; // CLI command and chat history for portfolio
}

/**
 * POST /api/cli-objectives/save
 * 
 * Save CLI objectives to challenge progress for persistence.
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

    const body: SaveRequest = await request.json();
    const { attemptId, challengeId, objectives, contextMessage, totalPoints, earnedPoints, commandHistory } = body;

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

    // Get existing progress
    const existingProgress = await prisma.challengeProgress.findUnique({
      where: {
        attemptId_challengeId: {
          attemptId,
          challengeId,
        },
      },
    });

    // Merge CLI objectives into existing solution
    const existingSolution = (existingProgress?.solution as Record<string, unknown>) || {};
    const updatedSolution = JSON.parse(JSON.stringify({
      ...existingSolution,
      cliObjectives: {
        objectives,
        contextMessage,
        totalPoints,
        earnedPoints,
        commandHistory: commandHistory || [], // Store CLI command history for portfolio
        lastUpdated: new Date().toISOString(),
      },
    }));

    // Upsert the progress
    await prisma.challengeProgress.upsert({
      where: {
        attemptId_challengeId: {
          attemptId,
          challengeId,
        },
      },
      update: {
        solution: updatedSolution,
      },
      create: {
        attemptId,
        challengeId,
        status: "in_progress",
        startedAt: new Date(),
        solution: updatedSolution,
      },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[CLI Objectives Save] Error:", error);
    return NextResponse.json(
      { error: "Failed to save CLI objectives", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
