import { NextRequest, NextResponse } from "next/server";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "http://10.121.19.210:1027";

/**
 * POST /api/proficiency-test/evaluate
 * 
 * Evaluate the proficiency test and generate final score/summary.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${LEARNING_AGENT_URL}/api/proficiency-test/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challenge_id: body.challengeId,
        challenge_title: body.challengeTitle,
        success_criteria: body.successCriteria || [],
        aws_services: body.awsServices || [],
        diagram_services: body.diagramServices,
        company_name: body.companyName,
        industry: body.industry,
        chat_history: body.chatHistory || [],
        openai_api_key: body.openaiApiKey,
        preferred_model: body.preferredModel,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Proficiency Test Evaluate] Learning Agent error:", errorText);
      return NextResponse.json(
        { error: "Failed to evaluate proficiency test", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("[Proficiency Test Evaluate] Error:", error);
    return NextResponse.json(
      { error: "Failed to evaluate proficiency test", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
