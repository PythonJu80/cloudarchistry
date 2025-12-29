import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface ToggleActionRequest {
  planId: string;
  weekNumber?: number;
  actionId: string;
  actionType?: "action" | "milestone";
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ToggleActionRequest = await req.json();
    const { planId, actionId, actionType = "action" } = body;

    if (!planId || !actionId) {
      return NextResponse.json(
        { error: "planId and actionId are required" },
        { status: 400 }
      );
    }

    const profileId = session.user.academyProfileId;

    const plan = await prisma.studyPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (plan.profileId !== profileId) {
      return NextResponse.json(
        { error: "You do not have access to this plan" },
        { status: 403 }
      );
    }

    const progressData = (plan.progressData as {
      completedActions?: string[];
      completedMilestones?: string[];
    }) || {};

    const arrayKey = actionType === "milestone" ? "completedMilestones" : "completedActions";
    const currentArray = progressData[arrayKey] || [];
    const isCompleted = currentArray.includes(actionId);
    
    let newArray: string[];
    if (isCompleted) {
      newArray = currentArray.filter((id: string) => id !== actionId);
    } else {
      newArray = [...currentArray, actionId];
    }

    const newProgressData = {
      ...progressData,
      [arrayKey]: newArray,
    };

    await prisma.studyPlan.update({
      where: { id: planId },
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
