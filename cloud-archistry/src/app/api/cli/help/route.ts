import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || process.env.NEXT_PUBLIC_LEARNING_AGENT_URL || "https://cloudarchistry.com";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to use CLI help" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const response = await fetch(`${LEARNING_AGENT_URL}/api/learning/cli-help`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Learning Agent cli-help error:", errorText);
      return NextResponse.json(
        { error: "Failed to get CLI help" },
        { status: 500 }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error("CLI help error:", error);
    return NextResponse.json(
      { error: "Failed to get CLI help", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
