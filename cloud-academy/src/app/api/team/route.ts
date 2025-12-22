import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTeamLimits } from "@/lib/academy/services/subscription";
import { checkRateLimit, RATE_LIMITS } from "@/lib/academy/services/rate-limit";

/**
 * GET /api/team - Get user's teams and team they're a member of
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's academy user ID
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get teams user is a member of
    const memberships = await prisma.academyTeamMember.findMany({
      where: { academyUserId: academyUser.id },
      include: {
        team: {
          include: {
            members: {
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
            },
            invites: {
              where: {
                usedAt: null,
                expiresAt: { gt: new Date() },
              },
              select: {
                id: true,
                email: true,
                code: true,
                role: true,
                expiresAt: true,
                createdAt: true,
              },
            },
            _count: {
              select: { 
                members: true,
                attempts: true,
              },
            },
          },
        },
      },
    });

    const teams = memberships.map((m) => ({
      ...m.team,
      myRole: m.role,
      memberCount: m.team._count.members,
      activeChallenges: m.team._count.attempts,
    }));

    return NextResponse.json({ teams });
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
}

/**
 * POST /api/team - Create a new team
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: "Team name must be at least 2 characters" }, { status: 400 });
    }

    // Get user's academy user and profile
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      include: {
        profile: true,
      },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Rate limiting: 5 team creations per hour per user
    const rateLimitKey = `team-create:${academyUser.id}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS.TEAM_CREATE);
    
    if (!rateLimit.allowed) {
      const resetInMinutes = Math.ceil((rateLimit.resetAt - Date.now()) / 60000);
      return NextResponse.json(
        { 
          error: `Rate limit exceeded. You can create more teams in ${resetInMinutes} minute${resetInMinutes !== 1 ? 's' : ''}.`,
          resetAt: rateLimit.resetAt,
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.TEAM_CREATE.maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          },
        }
      );
    }

    // Check subscription tier - tutors can create cohorts
    if (!academyUser.profile || !["tutor", "team", "pro", "enterprise"].includes(academyUser.profile.subscriptionTier)) {
      return NextResponse.json(
        { error: "Cohort creation requires a Tutor, Team, Pro, or Enterprise subscription" },
        { status: 403 }
      );
    }

    // Check team limits based on subscription tier
    const teamLimits = getTeamLimits(academyUser.profile.subscriptionTier as "free" | "learner" | "tutor" | "pro" | "team");
    
    if (teamLimits.maxTeams === 0) {
      return NextResponse.json(
        { error: "Your subscription tier does not allow creating teams" },
        { status: 403 }
      );
    }

    // Check if user has reached team creation limit
    if (teamLimits.maxTeams > 0) {
      const existingTeamsCount = await prisma.academyTeam.count({
        where: { createdBy: academyUser.id },
      });

      if (existingTeamsCount >= teamLimits.maxTeams) {
        return NextResponse.json(
          { error: `You have reached your team limit (${teamLimits.maxTeams} teams). Upgrade to create more teams.` },
          { status: 403 }
        );
      }
    }

    // Generate slug with better randomness
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const slug = `${baseSlug}-${randomSuffix}`;

    // Create team with user as owner and set maxMembers based on tier
    const team = await prisma.academyTeam.create({
      data: {
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        createdBy: academyUser.id,
        academyTenantId: academyUser.tenantId,
        maxMembers: teamLimits.maxMembersPerTeam,
        members: {
          create: {
            academyUserId: academyUser.id,
            role: "owner",
          },
        },
      },
      include: {
        members: {
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
        },
      },
    });

    // Create audit log for team creation
    if (academyUser.profile?.id) {
      await prisma.academyActivity.create({
        data: {
          academyTenantId: academyUser.tenantId,
          profileId: academyUser.profile.id,
          teamId: team.id,
          type: "team_created",
          data: {
            teamId: team.id,
            teamName: team.name,
            teamSlug: team.slug,
            maxMembers: teamLimits.maxMembersPerTeam,
            subscriptionTier: academyUser.profile.subscriptionTier,
          },
          visibility: "tenant",
        },
      }).catch(err => {
        // Don't fail the request if activity logging fails
        console.error("Failed to log team creation activity:", err);
      });
    }

    return NextResponse.json({ 
      team,
      limits: {
        maxMembers: teamLimits.maxMembersPerTeam,
        canInviteMembers: teamLimits.canInviteMembers,
      },
    });
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }
}
