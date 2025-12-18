import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "http://10.121.19.210:1027";

/**
 * POST /api/gaming/architect-arena/audit - Submit puzzle for AI audit
 * 
 * Calls /api/learning/audit-diagram on the Learning Agent.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const body = await req.json();

    // Get AI config
    const aiConfig = await getAiConfigForRequest(profileId);
    if (!aiConfig) {
      return NextResponse.json(
        { error: "OpenAI API key required" },
        { status: 402 }
      );
    }

    console.log(`[Architect Arena Audit] Auditing puzzle: ${body.puzzle_title}`);

    // Call the Architect Arena specific audit endpoint (judges PLACEMENT, not presence)
    const response = await fetch(
      `${LEARNING_AGENT_URL}/api/architect-arena/audit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzle_title: body.puzzle_title,
          puzzle_brief: body.puzzle_brief,
          expected_hierarchy: body.expected_hierarchy || {},
          expected_connections: body.expected_connections || [],
          nodes: body.nodes || [],
          connections: body.connections || [],
          openai_api_key: aiConfig.key,
          preferred_model: aiConfig.preferredModel,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Architect Arena Audit] Learning agent error:", errorText);
      return NextResponse.json(
        { error: "Failed to audit puzzle" },
        { status: 500 }
      );
    }

    const result = await response.json();

    console.log(`[Architect Arena Audit] Score: ${result.score}`);

    return NextResponse.json({
      score: result.score || 0,
      correct: result.correct || [],
      missing: result.missing || [],
      suggestions: result.suggestions || [],
      feedback: result.feedback || "",
    });
  } catch (error) {
    console.error("[Architect Arena Audit] Error:", error);
    return NextResponse.json(
      { error: "Failed to audit puzzle." },
      { status: 500 }
    );
  }
}
