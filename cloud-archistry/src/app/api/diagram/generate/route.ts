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

    const { description, difficulty } = body;

    if (!description) {
      return NextResponse.json(
        { error: "Description required" },
        { status: 400 }
      );
    }

    const response = await fetch(`${DRAWING_AGENT_URL}/diagrams/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        difficulty: difficulty || "intermediate",
        openai_api_key: aiConfig?.key,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Diagram Generate] Drawing agent error:", errorText);
      return NextResponse.json(
        { error: "Failed to generate diagram", detail: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Diagram Generate] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
