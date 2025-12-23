import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";
import { prisma } from "@/lib/db";

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
    
    // Get AI config (returns empty key - backend uses .env)
    const aiConfig = await getAiConfigForRequest(session.user.academyProfileId);
    
    // Get user's learning profile with stats and recent activity
    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: session.user.academyProfileId },
      select: {
        skillLevel: true,
        targetCertification: true,
        displayName: true,
        // Stats
        totalPoints: true,
        level: true,
        challengesCompleted: true,
        scenariosCompleted: true,
        currentStreak: true,
        // Recent scenario attempts (last 5)
        scenarioAttempts: {
          take: 5,
          orderBy: { startedAt: "desc" },
          select: {
            status: true,
            pointsEarned: true,
            scenario: {
              select: {
                title: true,
                difficulty: true,
                // Get AWS services from challenges
                challenges: {
                  select: {
                    awsServices: true,
                  },
                },
              },
            },
          },
        },
        // Recent quiz attempts (last 5)
        quizAttempts: {
          take: 5,
          orderBy: { startedAt: "desc" },
          select: {
            score: true,
            passed: true,
            quiz: {
              select: {
                title: true,
                quizType: true,
              },
            },
          },
        },
        // Exam attempts (practice exams)
        examAttempts: {
          take: 5,
          orderBy: { startedAt: "desc" },
          select: {
            score: true,
            passed: true,
            domainScores: true,
            exam: {
              select: {
                title: true,
                certificationCode: true,
              },
            },
          },
        },
        // Flashcard progress
        flashcardProgress: {
          take: 10,
          orderBy: { lastStudiedAt: "desc" },
          select: {
            cardsStudied: true,
            cardsMastered: true,
            totalReviews: true,
            deck: {
              select: {
                title: true,
              },
            },
          },
        },
        // CLI proficiency
        cliProficiency: {
          select: {
            totalCommands: true,
            correctCommands: true,
            accuracy: true,
            serviceStats: true,
            cliLevel: true,
            commandsMastered: true,
          },
        },
        // Location progress (world map)
        locationProgress: {
          take: 5,
          orderBy: { lastVisitedAt: "desc" },
          select: {
            status: true,
            challengesCompleted: true,
            totalChallenges: true,
            totalPoints: true,
            location: {
              select: {
                name: true,
                industry: true,
              },
            },
          },
        },
      },
    });
    
    // Build learner context summary for the agent
    type ScenarioAttempt = NonNullable<typeof profile>["scenarioAttempts"][number];
    type QuizAttempt = NonNullable<typeof profile>["quizAttempts"][number];
    type ExamAttempt = NonNullable<typeof profile>["examAttempts"][number];
    type FlashcardProgress = NonNullable<typeof profile>["flashcardProgress"][number];
    type LocationProgress = NonNullable<typeof profile>["locationProgress"][number];
    
    const recentScenarios = profile?.scenarioAttempts?.map((a: ScenarioAttempt) => {
      const services: string[] = [];
      a.scenario?.challenges?.forEach((c) => {
        if (Array.isArray(c.awsServices)) {
          services.push(...(c.awsServices as string[]));
        }
      });
      return {
        title: a.scenario?.title,
        difficulty: a.scenario?.difficulty,
        status: a.status,
        points: a.pointsEarned,
        services: [...new Set(services)],
      };
    }) || [];
    
    const recentQuizzes = profile?.quizAttempts?.map((a: QuizAttempt) => ({
      title: a.quiz?.title,
      type: a.quiz?.quizType,
      score: a.score,
      passed: a.passed,
    })) || [];
    
    // Exam attempts with domain scores
    const examAttempts = profile?.examAttempts?.map((a: ExamAttempt) => ({
      exam: a.exam?.title,
      certification: a.exam?.certificationCode,
      score: a.score,
      passed: a.passed,
      domain_scores: a.domainScores,
    })) || [];
    
    // Flashcard study progress
    const flashcardStudy = profile?.flashcardProgress?.map((p: FlashcardProgress) => ({
      deck: p.deck?.title,
      cards_studied: p.cardsStudied,
      cards_mastered: p.cardsMastered,
      total_reviews: p.totalReviews,
    })) || [];
    
    // CLI proficiency
    const cliSkills = profile?.cliProficiency ? {
      level: profile.cliProficiency.cliLevel,
      accuracy: profile.cliProficiency.accuracy,
      commands_mastered: profile.cliProficiency.commandsMastered,
      total_commands: profile.cliProficiency.totalCommands,
      service_stats: profile.cliProficiency.serviceStats,
    } : null;
    
    // Location/company progress
    const locationProgress = profile?.locationProgress?.map((p: LocationProgress) => ({
      company: p.location?.name,
      industry: p.location?.industry,
      status: p.status,
      challenges_completed: p.challengesCompleted,
      total_challenges: p.totalChallenges,
      points: p.totalPoints,
    })) || [];
    
    // Extract AWS services the learner has practiced
    const practicedServices = new Set<string>();
    recentScenarios.forEach((s) => {
      if (Array.isArray(s.services)) {
        s.services.forEach((svc: string) => practicedServices.add(svc));
      }
    });
    
    const body = await request.json();
    
    const requestBody = {
      ...body,
      openai_api_key: aiConfig?.key,
      preferred_model: aiConfig?.preferredModel,
      context: {
        ...body.context,
        // Basic profile
        skill_level: profile?.skillLevel || "intermediate",
        target_certification: profile?.targetCertification,
        user_name: profile?.displayName,
        // Stats
        stats: {
          level: profile?.level || 1,
          total_points: profile?.totalPoints || 0,
          challenges_completed: profile?.challengesCompleted || 0,
          scenarios_completed: profile?.scenariosCompleted || 0,
          current_streak: profile?.currentStreak || 0,
        },
        // Recent activity
        recent_scenarios: recentScenarios.slice(0, 3),
        recent_quizzes: recentQuizzes.slice(0, 3),
        // Practice exam attempts with domain scores (weak areas)
        exam_attempts: examAttempts.slice(0, 3),
        // Flashcard study progress
        flashcard_study: flashcardStudy.slice(0, 5),
        // CLI proficiency
        cli_skills: cliSkills,
        // Companies/locations explored
        locations_explored: locationProgress.slice(0, 3),
        // Services they've practiced
        practiced_services: Array.from(practicedServices),
      },
    };
    
    const response = await fetch(`${LEARNING_AGENT_URL}/api/learning/chat`, {
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
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to get coaching response" },
      { status: 500 }
    );
  }
}
