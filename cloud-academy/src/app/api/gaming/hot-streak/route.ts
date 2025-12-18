import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";
import { prisma } from "@/lib/db";

// Learning Agent URL
const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "http://10.121.19.210:1027";

/**
 * POST /api/gaming/hot-streak - Generate AI questions for Hot Streak
 * 
 * Calls /api/gaming/hot-streak/generate on the Learning Agent.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const body = await req.json();
    const count = Math.min(body.count || 25, 50);
    const excludeIds = body.excludeIds || [];

    // Get AI config
    const aiConfig = await getAiConfigForRequest(profileId);
    if (!aiConfig) {
      return NextResponse.json(
        {
          error: "OpenAI API key required",
          message: "Add an API key in Settings to play Hot Streak.",
          action: "configure_api_key",
        },
        { status: 402 }
      );
    }

    // Get user profile
    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: profileId },
      select: {
        skillLevel: true,
        targetCertification: true,
      },
    });

    if (!profile?.targetCertification) {
      return NextResponse.json(
        {
          error: "No target certification set",
          message: "Please set your target AWS certification in Settings before playing.",
          action: "set_certification",
        },
        { status: 400 }
      );
    }

    console.log(`[Hot Streak] Generating ${count} questions for:`, {
      skillLevel: profile.skillLevel,
      targetCertification: profile.targetCertification,
      excludeCount: excludeIds.length,
    });

    // Call the Learning Agent endpoint
    const response = await fetch(
      `${LEARNING_AGENT_URL}/api/gaming/hot-streak/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certification_code: profile.targetCertification,
          user_level: profile.skillLevel || "intermediate",
          options: { 
            question_count: count,
            exclude_ids: excludeIds,
          },
          openai_api_key: aiConfig.key,
          preferred_model: aiConfig.preferredModel,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Hot Streak] Learning agent error:", errorText);
      return NextResponse.json(
        { error: "Failed to generate questions" },
        { status: 500 }
      );
    }

    const result = await response.json();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Question generation failed" },
        { status: 500 }
      );
    }

    // Transform to frontend format
    const questions = result.questions.map((q: {
      id: string;
      question: string;
      options: string[];
      correct_index: number;
      topic: string;
      difficulty: string;
      explanation?: string;
    }) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correctIndex: q.correct_index,
      topic: q.topic,
      difficulty: q.difficulty,
      explanation: q.explanation,
    }));

    console.log(`[Hot Streak] Generated ${questions.length} AI questions for cert: ${profile.targetCertification}`);

    return NextResponse.json({ 
      questions,
      source: "ai",
      certification: profile.targetCertification,
      skillLevel: profile.skillLevel,
      topics_covered: result.topics_covered || [],
    });
  } catch (error) {
    console.error("[Hot Streak] Error generating questions:", error);
    return NextResponse.json({ 
      error: "Failed to generate questions.",
    }, { status: 500 });
  }
}
