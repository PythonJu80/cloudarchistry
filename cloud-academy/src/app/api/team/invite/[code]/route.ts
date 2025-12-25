import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/team/invite/[code] - Get invite details (for preview before accepting)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;

    const invite = await prisma.academyTeamInvite.findUnique({
      where: { code },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            description: true,
            avatarUrl: true,
            _count: {
              select: { members: true },
            },
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.usedAt) {
      return NextResponse.json({ error: "This invite has already been used" }, { status: 400 });
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "This invite has expired" }, { status: 400 });
    }

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        team: {
          id: invite.team.id,
          name: invite.team.name,
          description: invite.team.description,
          avatarUrl: invite.team.avatarUrl,
          memberCount: invite.team._count.members,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching invite:", error);
    return NextResponse.json({ error: "Failed to fetch invite" }, { status: 500 });
  }
}

/**
 * POST /api/team/invite/[code] - Accept invite and join team
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = params;

    // Get user's academy user and profile
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      include: { profile: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check subscription tier - learners and tutors can join teams
    if (!academyUser.profile || !["learner", "tutor"].includes(academyUser.profile.subscriptionTier)) {
      return NextResponse.json(
        { error: "You need a valid subscription to join teams" },
        { status: 403 }
      );
    }

    // Get the invite
    const invite = await prisma.academyTeamInvite.findUnique({
      where: { code },
      include: { team: true },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.usedAt) {
      return NextResponse.json({ error: "This invite has already been used" }, { status: 400 });
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "This invite has expired" }, { status: 400 });
    }

    // Check if invite email matches (if specified)
    console.log('[INVITE ACCEPT] Invite email:', invite.email, 'Session email:', session.user.email);
    if (invite.email && invite.email.toLowerCase() !== session.user.email?.toLowerCase()) {
      console.log('[INVITE ACCEPT] Email mismatch - rejecting');
      return NextResponse.json(
        { error: "This invite was sent to a different email address" },
        { status: 403 }
      );
    }
    console.log('[INVITE ACCEPT] Email validation passed');

    // Check if already a member
    const existingMember = await prisma.academyTeamMember.findFirst({
      where: {
        teamId: invite.teamId,
        academyUserId: academyUser.id,
      },
    });

    if (existingMember) {
      return NextResponse.json({ error: "You are already a member of this team" }, { status: 400 });
    }

    // Check team capacity
    const memberCount = await prisma.academyTeamMember.count({
      where: { teamId: invite.teamId },
    });

    if (memberCount >= invite.team.maxMembers) {
      return NextResponse.json(
        { error: "This team has reached its maximum capacity" },
        { status: 400 }
      );
    }

    // Accept invite - create membership and mark invite as used
    const [membership] = await prisma.$transaction([
      prisma.academyTeamMember.create({
        data: {
          teamId: invite.teamId,
          academyUserId: academyUser.id,
          role: invite.role,
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      prisma.academyTeamInvite.update({
        where: { id: invite.id },
        data: {
          usedAt: new Date(),
          usedBy: academyUser.id,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      team: membership.team,
      role: membership.role,
    });
  } catch (error) {
    console.error("Error accepting invite:", error);
    return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
  }
}
