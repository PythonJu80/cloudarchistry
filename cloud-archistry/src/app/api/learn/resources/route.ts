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
