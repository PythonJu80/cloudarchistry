import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";

const LEARNING_AGENT_URL = process.env.NEXT_PUBLIC_LEARNING_AGENT_URL!;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Get API key and preferred model from user's settings
    const aiConfig = await getAiConfigForRequest(session.user.academyProfileId || session.user.id);
    if (!aiConfig) {
      return NextResponse.json(
        { error: "Please configure your OpenAI API key in Settings" },
        { status: 402 }
      );
    }

    // Call learning agent
    const response = await fetch(`${LEARNING_AGENT_URL}/api/tycoon/journey/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        openai_api_key: aiConfig.key,
        preferred_model: aiConfig.preferredModel,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || "Failed to generate journey" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Tycoon journey error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
