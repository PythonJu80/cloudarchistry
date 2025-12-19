import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";

const DRAWING_AGENT_URL = process.env.DRAWING_AGENT_URL || "http://10.121.19.210:6098";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const aiConfig = await getAiConfigForRequest(profileId);

    const body = await req.json();
    const {
      challengeId,
      targetId,
      bugType,
      severity,
      claim,
      evidence,
      confidence,
    } = body;

    if (!challengeId || !targetId || !bugType || !severity || !claim) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const response = await fetch(`${DRAWING_AGENT_URL}/bug-bounty/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challenge_id: challengeId,
        target_id: targetId,
        bug_type: bugType,
        severity,
        claim,
        evidence: evidence || [],
        confidence: confidence || 50,
        openai_api_key: aiConfig?.key,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Bug Bounty] Validation error:", errorText);
      return NextResponse.json(
        { error: "Failed to validate claim" },
        { status: 500 }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      validation: result,
    });
  } catch (error) {
    console.error("[Bug Bounty Validate] Error:", error);
    return NextResponse.json(
      { error: "Failed to validate claim." },
      { status: 500 }
    );
  }
}
