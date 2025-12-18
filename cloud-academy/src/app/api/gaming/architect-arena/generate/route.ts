import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";
import { prisma } from "@/lib/db";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "http://10.121.19.210:1027";

/**
 * POST /api/gaming/architect-arena/generate - Generate AI puzzle for Architect Arena
 * 
 * Calls /api/architect-arena/generate on the Learning Agent.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const body = await req.json().catch(() => ({}));

    // Get AI config
    const aiConfig = await getAiConfigForRequest(profileId);
    if (!aiConfig) {
      return NextResponse.json(
        {
          error: "OpenAI API key required",
          message: "Add an API key in Settings to play Architect Arena.",
          action: "configure_api_key",
        },
        { status: 402 }
      );
    }

    // Get user profile for certification and skill level
    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: profileId },
      select: {
        skillLevel: true,
        targetCertification: true,
      },
    });

    if (!profile?.targetCertification) {
      return NextResponse.json(
        {
          error: "No target certification set",
          message: "Please set your target AWS certification in Settings before playing.",
          action: "set_certification",
        },
        { status: 400 }
      );
    }

    console.log(`[Architect Arena] Generating puzzle for:`, {
      skillLevel: profile.skillLevel,
      targetCertification: profile.targetCertification,
      difficulty: body?.difficulty,
    });

    // Call the Learning Agent endpoint
    const response = await fetch(
      `${LEARNING_AGENT_URL}/api/architect-arena/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certification_code: profile.targetCertification,
          user_level: profile.skillLevel || "intermediate",
          options: { difficulty: body?.difficulty || null },
          openai_api_key: aiConfig.key,
          preferred_model: aiConfig.preferredModel,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Architect Arena] Learning agent error:", errorText);
      return NextResponse.json(
        { error: "Failed to generate puzzle" },
        { status: 500 }
      );
    }

    const result = await response.json();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Puzzle generation failed" },
        { status: 500 }
      );
    }

    console.log(`[Architect Arena] Generated puzzle: ${result.puzzle?.title}`);

    return NextResponse.json({
      success: true,
      puzzle: result.puzzle,
      certification: profile.targetCertification,
      skillLevel: profile.skillLevel,
    });
  } catch (error) {
    console.error("[Architect Arena] Error generating puzzle:", error);
    return NextResponse.json(
      { error: "Failed to generate puzzle." },
      { status: 500 }
    );
  }
}
