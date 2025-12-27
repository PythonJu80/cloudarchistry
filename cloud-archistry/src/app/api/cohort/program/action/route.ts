import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface ToggleActionRequest {
  programId: string;
  actionId: string;
  actionType: "action" | "milestone" | "deliverable" | "checkpoint";
}

// PATCH - Toggle action/milestone/deliverable completion
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ToggleActionRequest = await req.json();
    const { programId, actionId, actionType } = body;

    if (!programId || !actionId || !actionType) {
      return NextResponse.json(
        { error: "programId, actionId, and actionType are required" },
        { status: 400 }
      );
    }

    // Get academy user
    const academyUser = await prisma.academyUser.findUnique({
      where: { email: session.user.email },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the program
    const program = await prisma.cohortProgram.findUnique({
      where: { id: programId },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Verify user is a member of this team
    const teamMember = await prisma.academyTeamMember.findFirst({
      where: {
        academyUserId: academyUser.id,
        teamId: program.teamId,
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "You are not a member of this cohort" },
        { status: 403 }
      );
    }

    // Get current progress data
    const progressData = (program.progressData as {
      completedActions?: string[];
      completedMilestones?: string[];
      completedDeliverables?: string[];
    }) || {};

    // Determine which array to update based on action type
    let arrayKey: "completedActions" | "completedMilestones" | "completedDeliverables";
    switch (actionType) {
      case "milestone":
        arrayKey = "completedMilestones";
        break;
      case "deliverable":
        arrayKey = "completedDeliverables";
        break;
      case "action":
      case "checkpoint":
      default:
        arrayKey = "completedActions";
        break;
    }

    // Toggle the action
    const currentArray = progressData[arrayKey] || [];
    const isCompleted = currentArray.includes(actionId);
    
    let newArray: string[];
    if (isCompleted) {
      // Remove from completed
      newArray = currentArray.filter((id: string) => id !== actionId);
    } else {
      // Add to completed
      newArray = [...currentArray, actionId];
    }

    // Update the progress data
    const newProgressData = {
      ...progressData,
      [arrayKey]: newArray,
    };

    // Save to database
    await prisma.cohortProgram.update({
      where: { id: programId },
      data: {
        progressData: newProgressData,
      },
    });

    return NextResponse.json({
      success: true,
      actionId,
      completed: !isCompleted,
    });
  } catch (error) {
    console.error("Toggle action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
