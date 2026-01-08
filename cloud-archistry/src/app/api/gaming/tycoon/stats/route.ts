import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/gaming/tycoon/stats - Save Cloud Tycoon earnings to database
 * Body: { totalEarnings: number, journeysCompleted: number, perfectMatches: number }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the academy user
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { totalEarnings, journeysCompleted, perfectMatches } = body;

    // Get or create game profile
    let gameProfile = await prisma.gameProfile.findUnique({
      where: { userId: academyUser.id },
    });

    if (!gameProfile) {
      gameProfile = await prisma.gameProfile.create({
        data: {
          userId: academyUser.id,
          cloudTycoonStats: {
            totalEarnings: totalEarnings || 0,
            journeysCompleted: journeysCompleted || 0,
            perfectMatches: perfectMatches || 0,
            lifetimeRevenue: totalEarnings || 0,
          },
        },
      });
    } else {
      // Update existing profile - merge with existing stats
      const existingStats = (gameProfile.cloudTycoonStats as any) || {};
      const updatedStats = {
        totalEarnings: totalEarnings || existingStats.totalEarnings || 0,
        journeysCompleted: (journeysCompleted || 0) + (existingStats.journeysCompleted || 0),
        perfectMatches: (perfectMatches || 0) + (existingStats.perfectMatches || 0),
        lifetimeRevenue: (totalEarnings || 0) + (existingStats.lifetimeRevenue || 0),
      };

      gameProfile = await prisma.gameProfile.update({
        where: { userId: academyUser.id },
        data: { cloudTycoonStats: updatedStats },
      });
    }

    return NextResponse.json({
      success: true,
      stats: gameProfile.cloudTycoonStats,
    });
  } catch (error) {
    console.error("Error saving Cloud Tycoon stats:", error);
    return NextResponse.json(
      { error: "Failed to save stats" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/gaming/tycoon/stats - Get Cloud Tycoon stats from database
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const gameProfile = await prisma.gameProfile.findUnique({
      where: { userId: academyUser.id },
      select: { cloudTycoonStats: true },
    });

    const stats = (gameProfile?.cloudTycoonStats as any) || {
      totalEarnings: 0,
      journeysCompleted: 0,
      perfectMatches: 0,
      lifetimeRevenue: 0,
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Error fetching Cloud Tycoon stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
