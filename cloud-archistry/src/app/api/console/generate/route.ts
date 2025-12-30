import { NextRequest, NextResponse } from "next/server";

const DRAWING_AGENT_URL = process.env.DRAWING_AGENT_URL || "http://localhost:6098";

/**
 * POST /api/console/generate
 * 
 * Generates realistic AWS console mock data for a challenge.
 * Proxies to the AWS Drawing Agent's console generator.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      challengeId,
      challengeTitle,
      challengeDescription,
      awsServices,
      successCriteria,
      companyName,
      industry,
      businessContext,
      region,
      openaiApiKey,
    } = body;

    if (!challengeId || !companyName) {
      return NextResponse.json(
        { error: "Missing required fields: challengeId, companyName" },
        { status: 400 }
      );
    }

    // Call the Drawing Agent's console generator
    const response = await fetch(`${DRAWING_AGENT_URL}/console/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challenge_id: challengeId,
        challenge_title: challengeTitle || "",
        challenge_description: challengeDescription || "",
        aws_services: awsServices || [],
        success_criteria: successCriteria || [],
        company_name: companyName,
        industry: industry || "Technology",
        business_context: businessContext || "",
        region: region || "eu-west-2",
        openai_api_key: openaiApiKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Console Generate] Drawing Agent error:", errorText);
      return NextResponse.json(
        { error: "Failed to generate console data", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("[Console Generate] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate console data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
