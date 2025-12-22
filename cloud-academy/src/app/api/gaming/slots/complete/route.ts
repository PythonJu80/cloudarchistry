import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordSoloGame, updateGameModeStats } from "@/lib/gaming/stats";

/**
 * POST /api/gaming/slots/complete - Record Service Slots game completion
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { won, winnings, betAmount } = body;

    // Get academy user
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Points earned = winnings (can be 0 or negative)
    const pointsEarned = Math.max(0, winnings);

    // Record game completion
    await recordSoloGame(
      academyUser.id,
      "service_slots",
      pointsEarned,
      won
    );

    // Update Service Slots specific stats
    const profile = await prisma.gameProfile.findUnique({
      where: { userId: academyUser.id },
    });

    const currentStats = (profile?.serviceSlotsStats as Record<string, unknown>) || {};
    const gamesPlayed = ((currentStats.gamesPlayed as number) || 0) + 1;
    const gamesWon = ((currentStats.gamesWon as number) || 0) + (won ? 1 : 0);
    const totalWinnings = ((currentStats.totalWinnings as number) || 0) + winnings;
    const balance = ((currentStats.balance as number) || 1000) + winnings - betAmount;
    const currentStreak = won ? ((currentStats.currentStreak as number) || 0) + 1 : 0;
    const bestStreak = Math.max((currentStats.bestStreak as number) || 0, currentStreak);

    await updateGameModeStats(academyUser.id, "service_slots", {
      gamesPlayed,
      gamesWon,
      totalWinnings,
      balance,
      currentStreak,
      bestStreak,
      lastPlayed: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      pointsEarned,
      stats: {
        gamesPlayed,
        gamesWon,
        totalWinnings,
        balance,
        currentStreak,
        bestStreak,
      },
    });
  } catch (error) {
    console.error("Error recording Slots completion:", error);
    return NextResponse.json({ error: "Failed to record game" }, { status: 500 });
  }
}
