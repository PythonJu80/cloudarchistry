import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "http://10.121.19.210:1027";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to use AI features" },
        { status: 401 }
      );
    }
    
    // Get API key and preferred model from user's settings - no fallback
    const aiConfig = await getAiConfigForRequest(session.user.academyProfileId);
    if (!aiConfig) {
      return NextResponse.json(
        { 
          error: "OpenAI API key required",
          message: "Please configure your OpenAI API key in Settings to use AI features.",
          action: "configure_api_key",
          settingsUrl: "/dashboard/settings"
        },
        { status: 402 }
      );
    }
    
    const body = await request.json();
    
    // Pass the API key and preferred model to the learning agent
    const requestBody = {
      ...body,
      openai_api_key: aiConfig.key,
      preferred_model: aiConfig.preferredModel,
    };
    
    const response = await fetch(`${LEARNING_AGENT_URL}/generate-scenario`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Learning agent error: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Scenario generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate scenario" },
      { status: 500 }
    );
  }
}
