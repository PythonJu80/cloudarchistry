import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/team/[teamId]/activity - Get team activity feed
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
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

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

    // Get team activities
    const activities = await prisma.teamActivity.findMany({
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
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const totalCount = await prisma.teamActivity.count({
      where: { teamId },
    });

    return NextResponse.json({
      activities: activities.map((a) => ({
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
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + activities.length < totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching team activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch team activity" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/team/[teamId]/activity - Create a team activity entry
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = params;
    const body = await req.json();
    const { activityType, title, description, pointsEarned = 0, metadata = {} } = body;

    if (!activityType || !title) {
      return NextResponse.json(
        { error: "activityType and title are required" },
        { status: 400 }
      );
    }

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

    // Create activity
    const activity = await prisma.teamActivity.create({
      data: {
        teamId,
        academyUserId: academyUser.id,
        activityType,
        title,
        description,
        pointsEarned,
        metadata,
      },
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
    });

    return NextResponse.json({
      activity: {
        id: activity.id,
        teamId: activity.teamId,
        academyUserId: activity.academyUserId,
        activityType: activity.activityType,
        pointsEarned: activity.pointsEarned,
        title: activity.title,
        description: activity.description,
        metadata: activity.metadata,
        createdAt: activity.createdAt.toISOString(),
        user: activity.academyUser,
      },
    });
  } catch (error) {
    console.error("Error creating team activity:", error);
    return NextResponse.json(
      { error: "Failed to create team activity" },
      { status: 500 }
    );
  }
}
