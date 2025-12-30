import { NextRequest, NextResponse } from "next/server";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "http://localhost:1027";

/**
 * POST /api/cli-objectives/validate
 * 
 * Validate if a CLI command completes an objective.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${LEARNING_AGENT_URL}/api/cli-objectives/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: body.command,
        command_output: body.commandOutput,
        objectives: body.objectives || [],
        openai_api_key: body.openaiApiKey,
        preferred_model: body.preferredModel,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[CLI Objectives Validate] Learning Agent error:", errorText);
      return NextResponse.json(
        { error: "Failed to validate CLI command", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("[CLI Objectives Validate] Error:", error);
    return NextResponse.json(
      { error: "Failed to validate CLI command", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
