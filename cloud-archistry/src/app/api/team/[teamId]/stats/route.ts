import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/team/[teamId]/stats - Get aggregated team statistics
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = params;

    // Get user's academy user ID
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is a member of this team
    const membership = await prisma.academyTeamMember.findFirst({
      where: {
        teamId,
        academyUserId: academyUser.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this team" },
        { status: 403 }
      );
    }

    // Get team with basic info
    const team = await prisma.academyTeam.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        totalPoints: true,
        level: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Get member count
    const memberCount = await prisma.academyTeamMember.count({
      where: { teamId },
    });

    // Get challenge attempt stats
    const [completedChallenges, inProgressChallenges] = await Promise.all([
      prisma.teamChallengeAttempt.count({
        where: { teamId, status: "completed" },
      }),
      prisma.teamChallengeAttempt.count({
        where: { teamId, status: "in_progress" },
      }),
    ]);

    // Calculate total points from completed challenges
    const challengePoints = await prisma.teamChallengeAttempt.aggregate({
      where: { teamId, status: "completed" },
      _sum: { totalPoints: true },
    });

    // Get top contributors (members with most points)
    const topContributors = await prisma.academyTeamMember.findMany({
      where: { teamId },
      include: {
        academyUser: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
      orderBy: { pointsContributed: "desc" },
      take: 5,
    });

    // Get recent activity (last 10)
    const recentActivity = await prisma.teamActivity.findMany({
      where: { teamId },
      include: {
        academyUser: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Calculate average score from completed challenges
    const avgScore = completedChallenges > 0
      ? (challengePoints._sum.totalPoints || 0) / completedChallenges
      : 0;

    return NextResponse.json({
      stats: {
        teamId: team.id,
        teamName: team.name,
        totalPoints: team.totalPoints + (challengePoints._sum.totalPoints || 0),
        level: team.level,
        memberCount,
        challengesCompleted: completedChallenges,
        challengesInProgress: inProgressChallenges,
        averageScore: Math.round(avgScore * 100) / 100,
        topContributors: topContributors.map((m) => ({
          academyUserId: m.academyUserId,
          displayName: m.academyUser?.name || m.academyUser?.username || "Unknown",
          points: m.pointsContributed,
          challengesCompleted: m.challengesCompleted,
        })),
        recentActivity: recentActivity.map((a) => ({
          id: a.id,
          teamId: a.teamId,
          academyUserId: a.academyUserId,
          activityType: a.activityType,
          pointsEarned: a.pointsEarned,
          title: a.title,
          description: a.description,
          metadata: a.metadata,
          createdAt: a.createdAt.toISOString(),
          user: a.academyUser,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching team stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch team stats" },
      { status: 500 }
    );
  }
}
