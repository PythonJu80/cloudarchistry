import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";
import { prisma } from "@/lib/db";

const LEARNING_AGENT_URL = process.env.NEXT_PUBLIC_LEARNING_AGENT_URL!;

// GET - List all quizzes for the user's profile
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's profile
    const profile = await prisma.academyUserProfile.findFirst({
      where: { academyUserId: session.user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get optional scenario filter
    const { searchParams } = new URL(request.url);
    const scenarioId = searchParams.get("scenarioId");

    // Fetch quizzes
    const whereClause: { scenarioId?: string } = {};
    if (scenarioId) {
      whereClause.scenarioId = scenarioId;
    }

    const quizzes = await prisma.quiz.findMany({
      where: whereClause,
      include: {
        questions: {
          select: {
            id: true,
            question: true,
            questionType: true,
            difficulty: true,
            points: true,
          },
        },
        _count: {
          select: { attempts: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get user's attempts for each quiz
    const quizIds = quizzes.map((q) => q.id);
    const userAttempts = await prisma.quizAttempt.findMany({
      where: {
        profileId: profile.id,
        quizId: { in: quizIds },
      },
      orderBy: { completedAt: "desc" },
    });

    // Map attempts to quizzes
    const attemptsByQuiz = userAttempts.reduce((acc, attempt) => {
      if (!acc[attempt.quizId]) {
        acc[attempt.quizId] = [];
      }
      acc[attempt.quizId].push(attempt);
      return acc;
    }, {} as Record<string, typeof userAttempts>);

    const quizzesWithAttempts = quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      quizType: quiz.quizType,
      passingScore: quiz.passingScore,
      questionCount: quiz.questionCount,
      estimatedMinutes: Math.ceil(quiz.questionCount * 1.5),
      createdAt: quiz.createdAt,
      questions: quiz.questions,
      totalAttempts: quiz._count.attempts,
      userAttempts: attemptsByQuiz[quiz.id] || [],
      bestScore: attemptsByQuiz[quiz.id]?.[0]
        ? Math.max(...attemptsByQuiz[quiz.id].map((a) => a.score))
        : null,
      hasPassed: attemptsByQuiz[quiz.id]?.some((a) => a.passed) || false,
    }));

    return NextResponse.json({ quizzes: quizzesWithAttempts });
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quizzes" },
      { status: 500 }
    );
  }
}

// POST - Generate a new quiz
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { questionCount = 10, scenarioId } = body;

    if (!scenarioId) {
      return NextResponse.json(
        { error: "Scenario ID is required" },
        { status: 400 }
      );
    }

    // Get user's profile
    const profile = await prisma.academyUserProfile.findFirst({
      where: { academyUserId: session.user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get AI config for BYOK
    const aiConfig = await getAiConfigForRequest(session.user.id);

    // Call learning agent to generate quiz
    const response = await fetch(
      `${LEARNING_AGENT_URL}/api/learning/generate-quiz`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_id: scenarioId,
          content_type: "quiz",
          user_level: profile.skillLevel || "intermediate",
          persona_id: profile.targetCertification || "solutions-architect",
          options: {
            question_count: questionCount,
          },
          openai_api_key: aiConfig?.key,
          preferred_model: aiConfig?.preferredModel,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Learning agent error:", errorText);
      return NextResponse.json(
        { error: "Failed to generate quiz" },
        { status: 500 }
      );
    }

    const result = await response.json();

    if (!result.success || !result.quiz_id) {
      return NextResponse.json(
        { error: result.error || "Quiz generation failed" },
        { status: 500 }
      );
    }

    // Fetch the created quiz
    const quiz = await prisma.quiz.findUnique({
      where: { id: result.quiz_id },
      include: {
        questions: true,
      },
    });

    return NextResponse.json({
      success: true,
      quiz,
    });
  } catch (error) {
    console.error("Error generating quiz:", error);
    return NextResponse.json(
      { error: "Failed to generate quiz" },
      { status: 500 }
    );
  }
}
