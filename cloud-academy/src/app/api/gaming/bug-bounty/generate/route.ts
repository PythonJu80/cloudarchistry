import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";
import { prisma } from "@/lib/db";

const DRAWING_AGENT_URL = process.env.DRAWING_AGENT_URL || "http://10.121.19.210:6098";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const body = await req.json();

    const aiConfig = await getAiConfigForRequest(profileId);
    if (!aiConfig) {
      return NextResponse.json(
        {
          error: "OpenAI API key required",
          message: "Add an API key in Settings to play Bug Bounty.",
          action: "configure_api_key",
        },
        { status: 402 }
      );
    }

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
          message: "Please set your target AWS certification in Settings.",
          action: "set_certification",
        },
        { status: 400 }
      );
    }

    const difficulty = body.difficulty || profile.skillLevel || "intermediate";
    const scenarioType = body.scenarioType || "ecommerce";

    const response = await fetch(`${DRAWING_AGENT_URL}/bug-bounty/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        difficulty,
        certification_code: profile.targetCertification,
        scenario_type: scenarioType,
        openai_api_key: aiConfig.key,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Bug Bounty] Drawing agent error:", errorText);
      return NextResponse.json(
        { error: "Failed to generate challenge" },
        { status: 500 }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      challenge: result,
      certification: profile.targetCertification,
      skillLevel: profile.skillLevel,
    });
  } catch (error) {
    console.error("[Bug Bounty Generate] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate challenge." },
      { status: 500 }
    );
  }
}
