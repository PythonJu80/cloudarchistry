import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/game/sniper-quiz/submit - Submit Sniper Quiz score
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { score, answers, perfectGame } = body;

    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Calculate final score (2x bonus for perfect game)
    const finalScore = perfectGame ? score * 2 : score;
    const accuracy = answers.filter((a: { correct: boolean }) => a.correct).length / answers.length;

    // Update gaming profile
    const existingProfile = await prisma.gamingProfile.findUnique({
      where: { academyUserId: academyUser.id },
    });

    if (existingProfile) {
      // Update stats
      const currentStats = (existingProfile.gameStats as Record<string, unknown>) || {};
      const sniperStats = (currentStats.sniperQuiz as Record<string, number>) || {
        gamesPlayed: 0,
        totalScore: 0,
        highScore: 0,
        perfectGames: 0,
        totalHits: 0,
        totalShots: 0,
      };

      await prisma.gamingProfile.update({
        where: { academyUserId: academyUser.id },
        data: {
          totalPoints: existingProfile.totalPoints + finalScore,
          gameStats: {
            ...currentStats,
            sniperQuiz: {
              gamesPlayed: sniperStats.gamesPlayed + 1,
              totalScore: sniperStats.totalScore + finalScore,
              highScore: Math.max(sniperStats.highScore, finalScore),
              perfectGames: sniperStats.perfectGames + (perfectGame ? 1 : 0),
              totalHits: sniperStats.totalHits + answers.filter((a: { correct: boolean }) => a.correct).length,
              totalShots: sniperStats.totalShots + answers.length,
            },
          },
        },
      });
    } else {
      // Create new profile
      await prisma.gamingProfile.create({
        data: {
          academyUserId: academyUser.id,
          totalPoints: finalScore,
          gameStats: {
            sniperQuiz: {
              gamesPlayed: 1,
              totalScore: finalScore,
              highScore: finalScore,
              perfectGames: perfectGame ? 1 : 0,
              totalHits: answers.filter((a: { correct: boolean }) => a.correct).length,
              totalShots: answers.length,
            },
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      finalScore,
      accuracy: Math.round(accuracy * 100),
      perfectGame,
    });
  } catch (error) {
    console.error("Error submitting sniper quiz score:", error);
    return NextResponse.json({ error: "Failed to submit score" }, { status: 500 });
  }
}
