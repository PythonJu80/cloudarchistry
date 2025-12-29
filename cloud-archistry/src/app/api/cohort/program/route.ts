import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET - Fetch cohort program for a team
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 });
    }

    // Get academy user
    const academyUser = await prisma.academyUser.findUnique({
      where: { email: session.user.email },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify user is a member of this team
    const teamMember = await prisma.academyTeamMember.findFirst({
      where: {
        academyUserId: academyUser.id,
        teamId,
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "You are not a member of this cohort" },
        { status: 403 }
      );
    }

    // Get the active program for this team
    const program = await prisma.cohortProgram.findFirst({
      where: {
        teamId,
        status: "active",
      },
      orderBy: {
        generatedAt: "desc",
      },
    });

    // Get archived programs for this team
    const archivedPrograms = await prisma.cohortProgram.findMany({
      where: {
        teamId,
        status: "archived",
      },
      orderBy: {
        generatedAt: "desc",
      },
      select: {
        id: true,
        title: true,
        outcome: true,
        durationWeeks: true,
        sessionsPerWeek: true,
        weeklyHours: true,
        skillLevel: true,
        targetCertification: true,
        generatedAt: true,
      },
    });

    if (!program) {
      return NextResponse.json({ program: null, archivedPrograms });
    }

    // Merge progress data with program data
    const programData = program.programData as Record<string, unknown>;
    const progressData = program.progressData as {
      completedActions?: string[];
      completedMilestones?: string[];
      completedDeliverables?: string[];
    };

    // Apply completion status to actions
    const weeks = (programData.weeks as Array<Record<string, unknown>>) || [];
    for (const week of weeks) {
      const actions = (week.actions as Array<Record<string, unknown>>) || [];
      for (const action of actions) {
        action.completed = progressData.completedActions?.includes(action.id as string) || false;
      }
      const checkpoint = week.checkpoint as Record<string, unknown> | undefined;
      if (checkpoint) {
        checkpoint.completed = progressData.completedActions?.includes(checkpoint.id as string) || false;
      }
    }

    // Apply completion status to milestones
    const milestones = (programData.milestones as Array<Record<string, unknown>>) || [];
    for (const milestone of milestones) {
      milestone.completed = progressData.completedMilestones?.includes(milestone.id as string) || false;
    }

    // Apply completion status to capstone deliverables
    const capstone = programData.capstone as Record<string, unknown> | undefined;
    if (capstone) {
      const deliverables = (capstone.deliverables as Array<Record<string, unknown>>) || [];
      for (const deliverable of deliverables) {
        deliverable.completed = progressData.completedDeliverables?.includes(deliverable.id as string) || false;
      }
    }

    return NextResponse.json({
      program: {
        id: program.id,
        teamId: program.teamId,
        title: program.title,
        outcome: program.outcome,
        duration: program.durationWeeks, // Frontend expects 'duration', DB has 'durationWeeks'
        durationWeeks: program.durationWeeks,
        sessionsPerWeek: program.sessionsPerWeek,
        weeklyHours: program.weeklyHours,
        skillLevel: program.skillLevel,
        level: program.skillLevel, // Frontend also uses 'level'
        targetCertification: program.targetCertification,
        status: program.status,
        generatedAt: program.generatedAt,
        ...programData,
      },
      archivedPrograms,
    });
  } catch (error) {
    console.error("Cohort program fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
