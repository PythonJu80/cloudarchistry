import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Default state for new players
const DEFAULT_STATE = {
  balance: 1000,
  totalWinnings: 0,
  currentStreak: 0,
  bestStreak: 0,
  gamesPlayed: 0,
  gamesWon: 0,
};

// GET - Load game state from database
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get or create game profile
    let gameProfile = await prisma.gameProfile.findUnique({
      where: { userId: session.user.id },
      select: { serviceSlotsStats: true },
    });

    if (!gameProfile) {
      // Create game profile if doesn't exist
      gameProfile = await prisma.gameProfile.create({
        data: {
          userId: session.user.id,
          serviceSlotsStats: DEFAULT_STATE,
        },
        select: { serviceSlotsStats: true },
      });
    }

    // Parse the JSON stats
    const stats = gameProfile.serviceSlotsStats as Record<string, unknown>;
    
    // Merge with defaults in case of missing fields
    const state = {
      ...DEFAULT_STATE,
      ...stats,
    };

    return NextResponse.json(state);
  } catch (error) {
    console.error("Load slots state error:", error);
    return NextResponse.json(
      { error: "Failed to load game state" },
      { status: 500 }
    );
  }
}

// POST - Save game state to database
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Get previous state to calculate XP delta
    const existingProfile = await prisma.gameProfile.findUnique({
      where: { userId: session.user.id },
      select: { serviceSlotsStats: true },
    });
    const prevStats = (existingProfile?.serviceSlotsStats as Record<string, number>) || {};
    const prevGamesWon = prevStats.gamesWon || 0;
    
    // Validate the state
    const state = {
      balance: typeof body.balance === "number" ? body.balance : DEFAULT_STATE.balance,
      totalWinnings: typeof body.totalWinnings === "number" ? body.totalWinnings : 0,
      currentStreak: typeof body.currentStreak === "number" ? body.currentStreak : 0,
      bestStreak: typeof body.bestStreak === "number" ? body.bestStreak : 0,
      gamesPlayed: typeof body.gamesPlayed === "number" ? body.gamesPlayed : 0,
      gamesWon: typeof body.gamesWon === "number" ? body.gamesWon : 0,
    };

    // Calculate new wins since last save
    const newWins = Math.max(0, state.gamesWon - prevGamesWon);
    
    // Upsert game profile with new stats
    await prisma.gameProfile.upsert({
      where: { userId: session.user.id },
      update: { 
        serviceSlotsStats: state,
        lastPlayedAt: new Date(),
        // Add points for wins (10 points per correct answer)
        totalPoints: { increment: newWins * 10 },
      },
      create: {
        userId: session.user.id,
        serviceSlotsStats: state,
        lastPlayedAt: new Date(),
        totalPoints: newWins * 10,
      },
    });

    // Also update AcademyUserProfile XP (same pattern as quiz submit)
    if (newWins > 0 && session.user.academyProfileId) {
      await prisma.academyUserProfile.update({
        where: { id: session.user.academyProfileId },
        data: {
          xp: { increment: newWins * 10 },
          totalPoints: { increment: newWins * 10 },
        },
      });
    }

    return NextResponse.json({ success: true, xpEarned: newWins * 10 });
  } catch (error) {
    console.error("Save slots state error:", error);
    return NextResponse.json(
      { error: "Failed to save game state" },
      { status: 500 }
    );
  }
}
