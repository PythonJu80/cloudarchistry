import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordSoloGame, updateGameModeStats } from "@/lib/gaming/stats";

/**
 * POST /api/gaming/hot-streak/complete - Record Hot Streak game completion
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { score, correctAnswers, totalQuestions, timeElapsed: _timeElapsed } = body;

    // Get academy user
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Calculate points (10 points per correct answer)
    const pointsEarned = correctAnswers * 10;

    // Record game completion in GameProfile
    await recordSoloGame(
      academyUser.id,
      "hot_streak",
      pointsEarned,
      true // Hot Streak is always a "win" since it's solo
    );

    // Update Hot Streak specific stats
    const profile = await prisma.gameProfile.findUnique({
      where: { userId: academyUser.id },
    });

    const currentStats = (profile?.hotStreakStats as Record<string, unknown>) || {};
    const gamesPlayed = ((currentStats.gamesPlayed as number) || 0) + 1;
    const highScore = Math.max((currentStats.highScore as number) || 0, score);
    const totalCorrect = ((currentStats.totalCorrect as number) || 0) + correctAnswers;
    const totalQuestionsSeen = ((currentStats.totalQuestions as number) || 0) + totalQuestions;

    await updateGameModeStats(academyUser.id, "hot_streak", {
      gamesPlayed,
      highScore,
      totalCorrect,
      totalQuestions: totalQuestionsSeen,
      lastScore: score,
      lastPlayed: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      pointsEarned,
      stats: {
        gamesPlayed,
        highScore,
        totalCorrect,
        totalQuestions: totalQuestionsSeen,
      },
    });
  } catch (error) {
    console.error("Error recording Hot Streak completion:", error);
    return NextResponse.json({ error: "Failed to record game" }, { status: 500 });
  }
}
