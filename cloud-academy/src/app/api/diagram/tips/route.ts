import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/diagram/tips
 * 
 * Get all audit tips for a specific challenge progress.
 * Query params: challengeProgressId (required), includeDismissed (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to view tips" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const challengeProgressId = searchParams.get("challengeProgressId");
    const includeDismissed = searchParams.get("includeDismissed") === "true";

    if (!challengeProgressId) {
      return NextResponse.json(
        { error: "challengeProgressId is required" },
        { status: 400 }
      );
    }

    const tips = await prisma.diagramAuditTip.findMany({
      where: {
        challengeProgressId,
        profileId: session.user.academyProfileId,
        ...(includeDismissed ? {} : { isDismissed: false }),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      tips,
      count: tips.length,
    });

  } catch (error) {
    console.error("Error fetching diagram tips:", error);
    return NextResponse.json(
      { error: "Failed to fetch tips" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/diagram/tips
 * 
 * Create new audit tips from an audit result.
 * Body: { challengeProgressId, auditResult, diagramSnapshot? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to save tips" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { challengeProgressId, auditResult, diagramSnapshot } = body;

    if (!challengeProgressId || !auditResult) {
      return NextResponse.json(
        { error: "challengeProgressId and auditResult are required" },
        { status: 400 }
      );
    }

    // Verify the challenge progress belongs to this user
    const progress = await prisma.challengeProgress.findFirst({
      where: {
        id: challengeProgressId,
        attempt: {
          profileId: session.user.academyProfileId,
        },
      },
    });

    if (!progress) {
      return NextResponse.json(
        { error: "Challenge progress not found or access denied" },
        { status: 404 }
      );
    }

    // Create tips from the audit result
    const tipsToCreate: Array<{
      challengeProgressId: string;
      profileId: string;
      auditScore: number;
      category: string;
      content: string;
      diagramSnapshot: unknown;
      awsServicesInvolved: string[];
    }> = [];

    const { score, correct, missing, suggestions, feedback } = auditResult;

    // Add "correct" items as tips
    if (correct && Array.isArray(correct)) {
      correct.forEach((item: string) => {
        tipsToCreate.push({
          challengeProgressId,
          profileId: session.user.academyProfileId!,
          auditScore: score,
          category: "correct",
          content: item,
          diagramSnapshot: diagramSnapshot || null,
          awsServicesInvolved: [],
        });
      });
    }

    // Add "missing" items as tips
    if (missing && Array.isArray(missing)) {
      missing.forEach((item: string) => {
        tipsToCreate.push({
          challengeProgressId,
          profileId: session.user.academyProfileId!,
          auditScore: score,
          category: "missing",
          content: item,
          diagramSnapshot: diagramSnapshot || null,
          awsServicesInvolved: [],
        });
      });
    }

    // Add "suggestions" as tips
    if (suggestions && Array.isArray(suggestions)) {
      suggestions.forEach((item: string) => {
        tipsToCreate.push({
          challengeProgressId,
          profileId: session.user.academyProfileId!,
          auditScore: score,
          category: "suggestion",
          content: item,
          diagramSnapshot: diagramSnapshot || null,
          awsServicesInvolved: [],
        });
      });
    }

    // Add overall feedback as a tip
    if (feedback && typeof feedback === "string") {
      tipsToCreate.push({
        challengeProgressId,
        profileId: session.user.academyProfileId!,
        auditScore: score,
        category: "feedback",
        content: feedback,
        diagramSnapshot: diagramSnapshot || null,
        awsServicesInvolved: [],
      });
    }

    // Bulk create tips
    const createdTips = await prisma.diagramAuditTip.createMany({
      data: tipsToCreate,
    });

    return NextResponse.json({
      success: true,
      created: createdTips.count,
    });

  } catch (error) {
    console.error("Error creating diagram tips:", error);
    return NextResponse.json(
      { error: "Failed to save tips" },
      { status: 500 }
    );
  }
}
