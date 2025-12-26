import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";

const DRAWING_AGENT_URL = process.env.DRAWING_AGENT_URL || "https://cloudarchistry.com";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const body = await req.json();

    // Get AI config (optional - will use .env if not provided)
    const aiConfig = await getAiConfigForRequest(profileId);

    const { diagram, scenario_context, location_context } = body;

    if (!diagram || !diagram.nodes) {
      return NextResponse.json(
        { error: "Diagram with nodes required" },
        { status: 400 }
      );
    }

    const response = await fetch(`${DRAWING_AGENT_URL}/portfolio/enhance-diagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        diagram,
        scenario_context,
        location_context,
        openai_api_key: aiConfig?.key,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Portfolio Enhance] Drawing agent error:", errorText);
      return NextResponse.json(
        { error: "Failed to enhance diagram", detail: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Portfolio Enhance] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
