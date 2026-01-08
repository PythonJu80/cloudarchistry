import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRankFromElo, formatRank, calculateWinRate } from "@/lib/gaming/elo";

/**
 * GET /api/gaming/leaderboard - Get leaderboard data
 * Query params:
 *   - type: "global" | "weekly" | "friends" (default: global)
 *   - limit: number (default: 50)
 *   - gameType: string (optional, filter by game)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    
    const type = searchParams.get("type") || "global";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const _gameType = searchParams.get("gameType");

    // Get current user for "friends" type and to show their rank
    let currentUserId: string | null = null;
    if (session?.user?.email) {
      const academyUser = await prisma.academyUser.findFirst({
        where: { email: session.user.email },
        select: { id: true },
      });
      currentUserId = academyUser?.id || null;
    }

    // Build query based on type
    let profiles;
    
    if (type === "friends" && currentUserId) {
      // Get user's team members
      const teamMembers = await prisma.academyTeamMember.findMany({
        where: { academyUserId: currentUserId },
        select: { team: { select: { members: { select: { academyUserId: true } } } } },
      });
      
      const friendIds = new Set<string>();
      friendIds.add(currentUserId);
      teamMembers.forEach(tm => {
        tm.team.members.forEach(m => {
          if (m.academyUserId) friendIds.add(m.academyUserId);
        });
      });

      profiles = await prisma.gameProfile.findMany({
        where: { userId: { in: Array.from(friendIds) } },
        orderBy: { elo: "desc" },
        take: limit,
        include: {
          user: { select: { username: true, name: true } },
        },
      });
    } else if (type === "weekly") {
      profiles = await prisma.gameProfile.findMany({
        where: { weeklyPoints: { gt: 0 } },
        orderBy: { weeklyPoints: "desc" },
        take: limit,
        include: {
          user: { select: { username: true, name: true } },
        },
      });
    } else {
      // Global leaderboard by Elo
      profiles = await prisma.gameProfile.findMany({
        where: { totalGames: { gt: 0 } },
        orderBy: { elo: "desc" },
        take: limit,
        include: {
          user: { select: { username: true, name: true } },
        },
      });
    }

    // Format leaderboard entries
    const leaderboard = profiles.map((profile, index) => {
      const rankInfo = getRankFromElo(profile.elo);
      return {
        rank: index + 1,
        odisplayName: profile.displayName || profile.user.name || profile.user.username,
        username: profile.user.username,
        avatarUrl: profile.avatarUrl,
        countryCode: profile.countryCode,
        elo: profile.elo,
        rankName: formatRank(rankInfo.rank, rankInfo.tier),
        rankColor: rankInfo.color,
        totalGames: profile.totalGames,
        wins: profile.totalWins,
        winRate: calculateWinRate(profile.totalWins, profile.totalGames),
        points: type === "weekly" ? profile.weeklyPoints : profile.totalPoints,
        isCurrentUser: profile.userId === currentUserId,
      };
    });

    // Get current user's rank if not in top results
    let currentUserRank = null;
    if (currentUserId) {
      const userProfile = await prisma.gameProfile.findUnique({
        where: { userId: currentUserId },
        include: { user: { select: { username: true, name: true } } },
      });

      if (userProfile && !leaderboard.some(e => e.isCurrentUser)) {
        // Count how many players are above this user
        const playersAbove = await prisma.gameProfile.count({
          where: { elo: { gt: userProfile.elo }, totalGames: { gt: 0 } },
        });

        const rankInfo = getRankFromElo(userProfile.elo);
        currentUserRank = {
          rank: playersAbove + 1,
          displayName: userProfile.displayName || userProfile.user.name || userProfile.user.username,
          username: userProfile.user.username,
          avatarUrl: userProfile.avatarUrl,
          countryCode: userProfile.countryCode,
          elo: userProfile.elo,
          rankName: formatRank(rankInfo.rank, rankInfo.tier),
          rankColor: rankInfo.color,
          totalGames: userProfile.totalGames,
          wins: userProfile.totalWins,
          winRate: calculateWinRate(userProfile.totalWins, userProfile.totalGames),
          points: userProfile.totalPoints,
          isCurrentUser: true,
        };
      }
    }

    // Get total player count
    const totalPlayers = await prisma.gameProfile.count({
      where: { totalGames: { gt: 0 } },
    });

    return NextResponse.json({
      leaderboard,
      currentUserRank,
      totalPlayers,
      type,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
