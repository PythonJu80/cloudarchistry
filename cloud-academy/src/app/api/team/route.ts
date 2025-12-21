import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    // Check subscription tier
    if (!academyUser.profile || !["team", "enterprise"].includes(academyUser.profile.subscriptionTier)) {
      return NextResponse.json(
        { error: "Team features require a Team or Enterprise subscription" },
        { status: 403 }
      );
    }

    // Generate slug
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    // Create team with user as owner
    const team = await prisma.academyTeam.create({
      data: {
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        createdBy: academyUser.id,
        academyTenantId: academyUser.tenantId,
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

    return NextResponse.json({ team });
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }
}
