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

// POST - Generate a new quiz from user's certification/telemetry (same pattern as flashcards)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const body = await request.json();
    const { questionCount = 10 } = body;

    // Get AI config
    const aiConfig = await getAiConfigForRequest(profileId);
    if (!aiConfig) {
      return NextResponse.json(
        {
          error: "OpenAI API key required",
          message: "Add an API key in Settings to generate quizzes.",
          action: "configure_api_key",
        },
        { status: 402 }
      );
    }

    // Get user profile with telemetry data
    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: profileId },
      select: {
        skillLevel: true,
        targetCertification: true,
        challengesCompleted: true,
        scenariosCompleted: true,
        totalPoints: true,
        level: true,
      },
    });

    if (!profile?.targetCertification) {
      return NextResponse.json(
        {
          error: "No target certification set",
          message: "Please set your target AWS certification in Settings before generating quizzes.",
          action: "set_certification",
        },
        { status: 400 }
      );
    }

    // Build telemetry summary for AI context
    const telemetrySummary = {
      skillLevel: profile.skillLevel,
      targetCertification: profile.targetCertification,
      challengesCompleted: profile.challengesCompleted,
      scenariosCompleted: profile.scenariosCompleted,
      totalPoints: profile.totalPoints,
      level: profile.level,
    };

    // Call learning agent to generate quiz
    const response = await fetch(
      `${LEARNING_AGENT_URL}/api/learning/generate-quiz`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certification_code: profile.targetCertification,
          user_level: profile.skillLevel || "intermediate",
          telemetry: telemetrySummary,
          options: { question_count: questionCount },
          openai_api_key: aiConfig.key,
          preferred_model: aiConfig.preferredModel,
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

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Quiz generation failed" },
        { status: 500 }
      );
    }

    // Save the quiz to our database (same pattern as flashcards)
    const quizData = result.quiz;
    const newQuiz = await prisma.quiz.create({
      data: {
        profileId,
        certificationCode: profile.targetCertification,
        title: quizData.title || `${profile.targetCertification} Practice Quiz`,
        description: quizData.description || "AI-generated certification quiz",
        quizType: "certification",
        questionCount: quizData.questions?.length || 0,
        generatedBy: "ai",
        aiModel: aiConfig.preferredModel || "gpt-4o",
        questions: {
          create: (quizData.questions || []).map((q: {
            question: string;
            question_type?: string;
            options?: { id: string; text: string; is_correct: boolean }[];
            explanation?: string;
            difficulty?: string;
            points?: number;
            aws_services?: string[];
            tags?: string[];
          }, index: number) => ({
            question: q.question,
            questionType: q.question_type || "multiple_choice",
            options: q.options || [],
            explanation: q.explanation || "",
            difficulty: q.difficulty || "medium",
            points: q.points || 10,
            awsServices: q.aws_services || [],
            tags: q.tags || [],
            orderIndex: index,
          })),
        },
      },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      quiz: {
        id: newQuiz.id,
        title: newQuiz.title,
        description: newQuiz.description,
        questionCount: newQuiz.questionCount,
        quizType: newQuiz.quizType,
        certificationCode: newQuiz.certificationCode,
        questions: newQuiz.questions,
      },
    });
  } catch (error) {
    console.error("Error generating quiz:", error);
    return NextResponse.json(
      { error: "Failed to generate quiz" },
      { status: 500 }
    );
  }
}
