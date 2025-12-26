import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordSoloGame, updateGameModeStats } from "@/lib/gaming/stats";

/**
 * POST /api/gaming/tycoon/complete - Record Cloud Tycoon journey completion
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { revenue, perfectMatches, useCasesCompleted } = body;

    // Get academy user
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Points = revenue earned
    const pointsEarned = revenue;

    // Record game completion
    await recordSoloGame(
      academyUser.id,
      "cloud_tycoon",
      pointsEarned,
      true
    );

    // Update Cloud Tycoon specific stats
    const profile = await prisma.gameProfile.findUnique({
      where: { userId: academyUser.id },
    });

    const currentStats = (profile?.cloudTycoonStats as Record<string, unknown>) || {};
    const journeysCompleted = ((currentStats.journeysCompleted as number) || 0) + 1;
    const totalEarnings = ((currentStats.totalEarnings as number) || 0) + revenue;
    const totalPerfectMatches = ((currentStats.perfectMatches as number) || 0) + perfectMatches;
    const totalUseCases = ((currentStats.totalUseCases as number) || 0) + useCasesCompleted;

    await updateGameModeStats(academyUser.id, "cloud_tycoon", {
      journeysCompleted,
      totalEarnings,
      perfectMatches: totalPerfectMatches,
      totalUseCases,
      lifetimeRevenue: totalEarnings,
      lastRevenue: revenue,
      lastPlayed: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      pointsEarned,
      stats: {
        journeysCompleted,
        totalEarnings,
        perfectMatches: totalPerfectMatches,
        totalUseCases,
      },
    });
  } catch (error) {
    console.error("Error recording Tycoon completion:", error);
    return NextResponse.json({ error: "Failed to record game" }, { status: 500 });
  }
}
