import { NextRequest, NextResponse } from "next/server";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "http://10.121.19.210:1027";

/**
 * POST /api/proficiency-test/start
 * 
 * Start a proficiency test conversation.
 * The agent analyzes the user's work and initiates a conversation
 * asking them to explain their architectural decisions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${LEARNING_AGENT_URL}/api/proficiency-test/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challenge_id: body.challengeId,
        challenge_title: body.challengeTitle,
        challenge_description: body.challengeDescription,
        challenge_brief: body.challengeBrief,
        success_criteria: body.successCriteria || [],
        aws_services: body.awsServices || [],
        diagram_data: body.diagramData,
        diagram_services: body.diagramServices,
        diagram_audit: body.diagramAudit,  // Full audit results: score, correct, missing, suggestions, feedback
        diagram_score: body.diagramScore,  // Placement score breakdown
        question_answers: body.questionAnswers,
        company_name: body.companyName,
        industry: body.industry,
        business_context: body.businessContext,
        user_level: body.userLevel || "intermediate",
        cert_code: body.certCode,
        previous_chat_history: body.previousChatHistory || [],  // General chat before proficiency test
        openai_api_key: body.openaiApiKey,
        preferred_model: body.preferredModel,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Proficiency Test Start] Learning Agent error:", errorText);
      return NextResponse.json(
        { error: "Failed to start proficiency test", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("[Proficiency Test Start] Error:", error);
    return NextResponse.json(
      { error: "Failed to start proficiency test", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
