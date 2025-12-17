import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";
import { prisma } from "@/lib/db";

interface QuestionFromAPI {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  topic: string;
  difficulty: string;
  explanation: string;
}

const LEARNING_AGENT_URL = process.env.NEXT_PUBLIC_LEARNING_AGENT_URL!;

// Generate questions for a Ticking Bomb game
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const body = await req.json();

    // Get AI config (user's API key)
    const aiConfig = await getAiConfigForRequest(profileId);
    if (!aiConfig) {
      return NextResponse.json(
        {
          error: "OpenAI API key required",
          message: "Add an API key in Settings to play.",
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
          message: "Please set your target AWS certification in Settings.",
          action: "set_certification",
        },
        { status: 400 }
      );
    }

    // Call Learning Agent
    const response = await fetch(
      `${LEARNING_AGENT_URL}/api/gaming/ticking-bomb/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certification_code: profile.targetCertification,
          user_level: profile.skillLevel || "intermediate",
          options: { question_count: body.count || 30 },
          openai_api_key: aiConfig.key,
          preferred_model: aiConfig.preferredModel,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Ticking Bomb] Learning agent error:", errorText);
      return NextResponse.json(
        { error: "Failed to generate questions" },
        { status: 500 }
      );
    }

    const result = await response.json();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Generation failed" },
        { status: 500 }
      );
    }

    // Transform to frontend format (correct_index -> correctIndex)
    const questions = result.questions.map((q: QuestionFromAPI) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correctIndex: q.correct_index,
      topic: q.topic,
      difficulty: q.difficulty,
      explanation: q.explanation,
    }));

    return NextResponse.json({
      questions,
      source: "ai",
      certification: profile.targetCertification,
      skillLevel: profile.skillLevel,
    });
  } catch (error) {
    console.error("[Ticking Bomb] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate questions." },
      { status: 500 }
    );
  }
}
