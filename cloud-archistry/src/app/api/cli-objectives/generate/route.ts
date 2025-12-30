import { NextRequest, NextResponse } from "next/server";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "http://localhost:1027";

/**
 * POST /api/cli-objectives/generate
 * 
 * Generate CLI objectives for a challenge based on the user's diagram.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${LEARNING_AGENT_URL}/api/cli-objectives/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challenge_id: body.challengeId,
        challenge_title: body.challengeTitle,
        challenge_description: body.challengeDescription,
        success_criteria: body.successCriteria || [],
        aws_services_relevant: body.awsServicesRelevant || [],
        company_name: body.companyName,
        industry: body.industry,
        business_context: body.businessContext,
        diagram_data: body.diagramData,
        diagram_services: body.diagramServices,
        user_level: body.userLevel || "intermediate",
        objective_count: body.objectiveCount || 3,
        openai_api_key: body.openaiApiKey,
        preferred_model: body.preferredModel,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[CLI Objectives Generate] Learning Agent error:", errorText);
      return NextResponse.json(
        { error: "Failed to generate CLI objectives", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("[CLI Objectives Generate] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate CLI objectives", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
