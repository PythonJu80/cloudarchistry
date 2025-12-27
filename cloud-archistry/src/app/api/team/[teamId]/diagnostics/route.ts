import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/team/[teamId]/diagnostics
 * Fetch diagnostics/stats for all team members
 * Only accessible by team owner/admin (tutors)
 * Uses AcademyTeam and AcademyTeamMember - team-based logic
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

    // Get user's academy user ID (same pattern as stats/route.ts)
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is a member of this team and has admin/owner role
    const membership = await prisma.academyTeamMember.findFirst({
      where: {
        teamId,
        academyUserId: academyUser.id,
      },
      select: {
        role: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this team" }, { status: 403 });
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
      return NextResponse.json({ error: "Only tutors (owner/admin) can view team diagnostics" }, { status: 403 });
    }

    // Get all team members with their stats (team-based data)
    const teamMembers = await prisma.academyTeamMember.findMany({
      where: { teamId },
      include: {
        academyUser: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            profile: {
              select: {
                id: true,
                displayName: true,
                skillLevel: true,
                targetCertification: true,
                level: true,
                xp: true,
                totalPoints: true,
                currentStreak: true,
                challengesCompleted: true,
                scenariosCompleted: true,
              },
            },
          },
        },
      },
      orderBy: { pointsContributed: "desc" },
    });

    // Build member diagnostics from team member data
    const memberDiagnostics = await Promise.all(
      teamMembers.map(async (member) => {
        const profileId = member.academyUser?.profile?.id;
        
        // Fetch latest diagnostics if profile exists
        let latestDiagnostics = null;
        let diagnosticsHistory: Array<{
          id: string;
          overallReadiness: number;
          readinessLabel: string;
          createdAt: Date;
        }> = [];

        if (profileId) {
          try {
            const diagnostics = await prisma.learnerDiagnostics.findMany({
              where: { profileId },
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                id: true,
                overallReadiness: true,
                readinessLabel: true,
                summary: true,
                strengths: true,
                weaknesses: true,
                recommendations: true,
                encouragement: true,
                nextMilestone: true,
                daysToMilestone: true,
                createdAt: true,
              },
            });

            if (diagnostics.length > 0) {
              latestDiagnostics = diagnostics[0];
              diagnosticsHistory = diagnostics.map((d) => ({
                id: d.id,
                overallReadiness: d.overallReadiness,
                readinessLabel: d.readinessLabel,
                createdAt: d.createdAt,
              }));
            }
          } catch {
            // LearnerDiagnostics table might not exist yet
          }
        }

        return {
          memberId: member.id,
          academyUserId: member.academyUserId,
          role: member.role,
          // Team-specific stats
          pointsContributed: member.pointsContributed,
          challengesCompleted: member.challengesCompleted,
          joinedAt: member.joinedAt,
          // User info
          user: {
            name: member.academyUser?.name || member.academyUser?.username || "Unknown",
            email: member.academyUser?.email,
          },
          // Profile info (if available)
          profile: member.academyUser?.profile
            ? {
                displayName: member.academyUser.profile.displayName,
                skillLevel: member.academyUser.profile.skillLevel,
                targetCertification: member.academyUser.profile.targetCertification,
                level: member.academyUser.profile.level,
                xp: member.academyUser.profile.xp,
                totalPoints: member.academyUser.profile.totalPoints,
                currentStreak: member.academyUser.profile.currentStreak,
              }
            : null,
          latestDiagnostics,
          diagnosticsHistory,
        };
      })
    );

    // Calculate team-wide stats
    const membersWithDiagnostics = memberDiagnostics.filter((m) => m.latestDiagnostics);
    const avgReadiness = membersWithDiagnostics.length > 0
      ? Math.round(
          membersWithDiagnostics.reduce((sum, m) => sum + (m.latestDiagnostics?.overallReadiness || 0), 0) /
            membersWithDiagnostics.length
        )
      : 0;

    const readinessDistribution = {
      examReady: membersWithDiagnostics.filter((m) => m.latestDiagnostics?.readinessLabel === "Exam Ready").length,
      almostReady: membersWithDiagnostics.filter((m) => m.latestDiagnostics?.readinessLabel === "Almost Ready").length,
      gettingThere: membersWithDiagnostics.filter((m) => m.latestDiagnostics?.readinessLabel === "Getting There").length,
      notReady: membersWithDiagnostics.filter((m) => m.latestDiagnostics?.readinessLabel === "Not Ready").length,
    };

    // Team totals
    const teamTotals = {
      totalPoints: teamMembers.reduce((sum, m) => sum + m.pointsContributed, 0),
      totalChallengesCompleted: teamMembers.reduce((sum, m) => sum + m.challengesCompleted, 0),
    };

    return NextResponse.json({
      success: true,
      teamStats: {
        totalMembers: teamMembers.length,
        membersWithDiagnostics: membersWithDiagnostics.length,
        avgReadiness,
        readinessDistribution,
        ...teamTotals,
      },
      members: memberDiagnostics,
    });
  } catch (error) {
    console.error("Error fetching team diagnostics:", error);
    return NextResponse.json(
      { error: "Failed to fetch team diagnostics" },
      { status: 500 }
    );
  }
}
