import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/learn/resources
 * Lightweight endpoint to fetch just the study guide resources
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ resources: [] });
    }

    const profileId = session.user.academyProfileId;

    // Fetch only the most recent study plan's resources
    const currentPlan = await prisma.studyPlan.findFirst({
      where: { profileId },
      orderBy: { generatedAt: "desc" },
      select: {
        planOutput: true,
      },
    });

    if (!currentPlan?.planOutput) {
      return NextResponse.json({ resources: [] });
    }

    const planData = currentPlan.planOutput as Record<string, unknown>;
    const resources = (planData.resources as Array<{ title: string; url: string; type: string }>) || [];

    return NextResponse.json({ resources });
  } catch (error) {
    console.error("Resources GET failed:", error);
    return NextResponse.json({ resources: [] });
  }
}

/**
 * DELETE /api/learn/resources
 * Delete a resource from the current study plan
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Fetch the most recent study plan
    const currentPlan = await prisma.studyPlan.findFirst({
      where: { profileId },
      orderBy: { generatedAt: "desc" },
    });

    if (!currentPlan?.planOutput) {
      return NextResponse.json({ error: "No study plan found" }, { status: 404 });
    }

    const planData = currentPlan.planOutput as Record<string, unknown>;
    const resources = (planData.resources as Array<{ title: string; url: string; type: string; description?: string }>) || [];

    // Filter out the resource with matching URL
    const updatedResources = resources.filter(r => r.url !== url);

    if (updatedResources.length === resources.length) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Update the plan with filtered resources
    await prisma.studyPlan.update({
      where: { id: currentPlan.id },
      data: {
        planOutput: {
          ...planData,
          resources: updatedResources,
        },
      },
    });

    return NextResponse.json({ success: true, resources: updatedResources });
  } catch (error) {
    console.error("Resources DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete resource" }, { status: 500 });
  }
}
