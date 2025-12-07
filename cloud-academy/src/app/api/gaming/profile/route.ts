import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRankFromElo, formatRank, calculateWinRate } from "@/lib/gaming/elo";

/**
 * GET /api/gaming/profile - Get current user's gaming profile
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get academy user
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email },
      select: { id: true, name: true, username: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get or create game profile
    let gameProfile = await prisma.gameProfile.findUnique({
      where: { userId: academyUser.id },
    });

    if (!gameProfile) {
      // Create new profile with defaults
      gameProfile = await prisma.gameProfile.create({
        data: {
          userId: academyUser.id,
          displayName: academyUser.name || academyUser.username,
        },
      });
    }

    // Calculate derived stats
    const rankInfo = getRankFromElo(gameProfile.elo);
    const winRate = calculateWinRate(gameProfile.totalWins, gameProfile.totalGames);

    return NextResponse.json({
      profile: {
        ...gameProfile,
        rankFormatted: formatRank(rankInfo.rank, rankInfo.tier),
        rankColor: rankInfo.color,
        winRate,
      },
    });
  } catch (error) {
    console.error("Error fetching game profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

/**
 * PATCH /api/gaming/profile - Update gaming profile settings
 */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { displayName, countryCode, preferredRegion, preferredMode } = body;

    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updatedProfile = await prisma.gameProfile.upsert({
      where: { userId: academyUser.id },
      update: {
        ...(displayName !== undefined && { displayName }),
        ...(countryCode !== undefined && { countryCode }),
        ...(preferredRegion !== undefined && { preferredRegion }),
        ...(preferredMode !== undefined && { preferredMode }),
      },
      create: {
        userId: academyUser.id,
        displayName,
        countryCode,
        preferredRegion: preferredRegion || "auto",
        preferredMode: preferredMode || "ranked",
      },
    });

    return NextResponse.json({ profile: updatedProfile });
  } catch (error) {
    console.error("Error updating game profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
