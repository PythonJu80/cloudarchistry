import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/versus/pending - Get pending challenges for current user
 * Returns only challenges where the current user is player2 and status is pending
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
      return NextResponse.json({ challenges: [] });
    }

    // Get pending challenges where user is the challenged player (player2)
    const challenges = await prisma.versusMatch.findMany({
      where: {
        player2Id: academyUser.id,
        status: "pending",
      },
      include: {
        player1: {
          select: { id: true, name: true, username: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5, // Limit to 5 most recent
    });

    return NextResponse.json({ challenges });
  } catch (error) {
    console.error("Error fetching pending challenges:", error);
    return NextResponse.json({ challenges: [] });
  }
}
