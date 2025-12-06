import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import crypto from "crypto";

/**
 * GET /api/versus - Get user's active and recent matches
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get matches where user is player1 or player2
    const matches = await prisma.versusMatch.findMany({
      where: {
        OR: [
          { player1Id: academyUser.id },
          { player2Id: academyUser.id },
        ],
      },
      include: {
        player1: {
          select: { id: true, name: true, username: true },
        },
        player2: {
          select: { id: true, name: true, username: true },
        },
        challenge: {
          select: { id: true, title: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Separate active and completed
    const activeMatches = matches.filter((m: { status: string }) => ["pending", "active"].includes(m.status));
    const recentMatches = matches.filter((m: { status: string }) => m.status === "completed").slice(0, 10);

    return NextResponse.json({ activeMatches, recentMatches });
  } catch (error) {
    console.error("Error fetching versus matches:", error);
    return NextResponse.json({ error: "Failed to fetch matches" }, { status: 500 });
  }
}

/**
 * POST /api/versus - Create a new versus match (challenge someone)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { opponentId, challengeId, matchType = "quiz" } = body;

    if (!opponentId) {
      return NextResponse.json({ error: "Opponent is required" }, { status: 400 });
    }

    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true, name: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (academyUser.id === opponentId) {
      return NextResponse.json({ error: "You can't challenge yourself" }, { status: 400 });
    }

    // Verify opponent exists and is in same team
    const opponent = await prisma.academyUser.findUnique({
      where: { id: opponentId },
      select: { id: true, name: true },
    });

    if (!opponent) {
      return NextResponse.json({ error: "Opponent not found" }, { status: 404 });
    }

    // Generate match code for joining
    const matchCode = crypto.randomBytes(8).toString("hex");

    // Create the match
    const match = await prisma.versusMatch.create({
      data: {
        matchCode,
        player1Id: academyUser.id,
        player2Id: opponentId,
        challengeId: challengeId || null,
        matchType,
        status: "pending",
      },
      include: {
        player1: {
          select: { id: true, name: true, username: true },
        },
        player2: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    return NextResponse.json({ match });
  } catch (error) {
    console.error("Error creating versus match:", error);
    return NextResponse.json({ error: "Failed to create match" }, { status: 500 });
  }
}
