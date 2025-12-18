import { NextRequest, NextResponse } from "next/server";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "http://10.121.19.210:1027";

export async function POST(request: NextRequest) {
  try {
    // Validation is a simple comparison, no auth needed
    const body = await request.json();

    // Validation doesn't need AI - just pass through
    const response = await fetch(`${LEARNING_AGENT_URL}/api/tycoon/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || "Validation failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Tycoon validate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
