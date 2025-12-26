import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordSoloGame, updateGameModeStats } from "@/lib/gaming/stats";

/**
 * POST /api/gaming/sniper/complete - Record Service Sniper game completion
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { score, hits, misses, accuracy, timeElapsed } = body;

    // Get academy user
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Points = score from game
    const pointsEarned = score;

    // Record game completion
    await recordSoloGame(
      academyUser.id,
      "service_sniper",
      pointsEarned,
      true
    );

    // Update Service Sniper specific stats
    const profile = await prisma.gameProfile.findUnique({
      where: { userId: academyUser.id },
    });

    const currentStats = (profile?.serviceSniperStats as Record<string, unknown>) || {};
    const gamesPlayed = ((currentStats.gamesPlayed as number) || 0) + 1;
    const highScore = Math.max((currentStats.highScore as number) || 0, score);
    const totalHits = ((currentStats.totalHits as number) || 0) + hits;
    const totalMisses = ((currentStats.totalMisses as number) || 0) + misses;
    const bestAccuracy = Math.max((currentStats.bestAccuracy as number) || 0, accuracy);

    await updateGameModeStats(academyUser.id, "service_sniper", {
      gamesPlayed,
      highScore,
      totalHits,
      totalMisses,
      bestAccuracy,
      lastScore: score,
      lastPlayed: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      pointsEarned,
      stats: {
        gamesPlayed,
        highScore,
        totalHits,
        totalMisses,
        bestAccuracy,
      },
    });
  } catch (error) {
    console.error("Error recording Sniper completion:", error);
    return NextResponse.json({ error: "Failed to record game" }, { status: 500 });
  }
}
