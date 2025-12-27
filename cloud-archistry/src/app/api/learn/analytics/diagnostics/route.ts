import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "http://learning-agent:8000";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all analytics data (same as GET endpoint)
    const [
      profile,
      tenant,
      scenarioAttempts,
      challengeProgress,
      learningChats,
      , // activities - not used
      recentScenarioAttempts,
      flashcardProgress,
      quizAttempts,
    ] = await Promise.all([
      prisma.academyUserProfile.findUnique({
        where: { id: profileId },
        select: {
          displayName: true,
          skillLevel: true,
          targetCertification: true,
          totalPoints: true,
          level: true,
          xp: true,
          currentStreak: true,
          longestStreak: true,
          challengesCompleted: true,
          scenariosCompleted: true,
          totalTimeMinutes: true,
          subscriptionTier: true,
          lastActivityDate: true,
          achievements: true,
          createdAt: true,
          openaiApiKey: true,
          preferredModel: true,
          academyTenantId: true,
        },
      }),

      // Get tenant for API key fallback
      prisma.academyTenant.findFirst({
        where: {
          users: {
            some: {
              profile: {
                id: profileId,
              },
            },
          },
        },
        select: {
          openaiApiKey: true,
          preferredModel: true,
        },
      }),

      prisma.scenarioAttempt.findMany({
        where: { profileId },
        select: {
          id: true,
          status: true,
          pointsEarned: true,
          maxPoints: true,
          activeTimeMinutes: true,
          startedAt: true,
          completedAt: true,
          scenario: {
            select: {
              title: true,
              difficulty: true,
              location: {
                select: {
                  company: true,
                  industry: true,
                },
              },
            },
          },
        },
        orderBy: { startedAt: "desc" },
      }),

      prisma.challengeProgress.findMany({
        where: { attempt: { profileId } },
        select: {
          status: true,
          pointsEarned: true,
          hintsUsed: true,
          attemptsCount: true,
          timeSpentMinutes: true,
          startedAt: true,
          completedAt: true,
          feedback: true,
          challenge: {
            select: {
              title: true,
              difficulty: true,
              points: true,
              awsServices: true,
            },
          },
        },
      }),

      prisma.learningChat.findMany({
        where: { profileId },
        select: {
          title: true,
          keywords: true,
          topicsDiscussed: true,
          questionsAsked: true,
          lastMessageAt: true,
        },
        orderBy: { lastMessageAt: "desc" },
        take: 10,
      }),

      prisma.academyActivity.findMany({
        where: { profileId },
        select: {
          type: true,
          data: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),

      prisma.scenarioAttempt.findMany({
        where: {
          profileId,
          startedAt: { gte: thirtyDaysAgo },
        },
        select: {
          startedAt: true,
          status: true,
          pointsEarned: true,
        },
        orderBy: { startedAt: "asc" },
      }),

      // Flashcard progress (deck-level)
      prisma.flashcardUserProgress.findMany({
        where: { profileId },
        select: {
          cardsStudied: true,
          cardsMastered: true,
          totalReviews: true,
          totalTimeMinutes: true,
          lastStudiedAt: true,
          currentStreak: true,
          deck: {
            select: {
              title: true,
              certificationCode: true,
            },
          },
        },
      }),

      // Quiz attempts
      prisma.quizAttempt.findMany({
        where: { profileId },
        select: {
          score: true,
          totalQuestions: true,
          questionsCorrect: true,
          timeSpentSeconds: true,
          completedAt: true,
          passed: true,
          status: true,
          quiz: {
            select: {
              title: true,
              certificationCode: true,
            },
          },
        },
        orderBy: { completedAt: "desc" },
      }),
    ]);

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Calculate analytics (same logic as GET endpoint)
    const completedChallenges = challengeProgress.filter((cp) => cp.status === "completed");
    const totalChallenges = challengeProgress.length;
    const completionRate = totalChallenges > 0
      ? Math.round((completedChallenges.length / totalChallenges) * 100)
      : 0;

    const scoresWithMax = completedChallenges
      .filter((cp) => cp.challenge.points > 0)
      .map((cp) => (cp.pointsEarned / cp.challenge.points) * 100);
    const avgScore = scoresWithMax.length > 0
      ? Math.round(scoresWithMax.reduce((a, b) => a + b, 0) / scoresWithMax.length)
      : 0;

    const totalHintsUsed = challengeProgress.reduce((sum, cp) => sum + cp.hintsUsed, 0);
    const avgHintsPerChallenge = completedChallenges.length > 0
      ? Math.round((totalHintsUsed / completedChallenges.length) * 10) / 10
      : 0;

    // AWS Services practiced
    const serviceCount: Record<string, number> = {};
    for (const cp of completedChallenges) {
      const services = Array.isArray(cp.challenge.awsServices)
        ? cp.challenge.awsServices
        : [];
      for (const service of services) {
        if (typeof service === "string") {
          serviceCount[service] = (serviceCount[service] || 0) + 1;
        }
      }
    }
    const topServices = Object.entries(serviceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([service, count]) => ({ service, count }));

    // Difficulty breakdown
    const difficultyStats: Record<string, { total: number; completed: number; avgScore: number }> = {};
    for (const cp of challengeProgress) {
      const diff = cp.challenge.difficulty || "unknown";
      if (!difficultyStats[diff]) {
        difficultyStats[diff] = { total: 0, completed: 0, avgScore: 0 };
      }
      difficultyStats[diff].total++;
      if (cp.status === "completed") {
        difficultyStats[diff].completed++;
        if (cp.challenge.points > 0) {
          const score = (cp.pointsEarned / cp.challenge.points) * 100;
          difficultyStats[diff].avgScore += score;
        }
      }
    }
    for (const diff of Object.keys(difficultyStats)) {
      if (difficultyStats[diff].completed > 0) {
        difficultyStats[diff].avgScore = Math.round(
          difficultyStats[diff].avgScore / difficultyStats[diff].completed
        );
      }
    }

    // Industry exposure
    const industryCount: Record<string, number> = {};
    for (const sa of scenarioAttempts) {
      const industry = sa.scenario?.location?.industry || "Unknown";
      industryCount[industry] = (industryCount[industry] || 0) + 1;
    }
    const industryBreakdown = Object.entries(industryCount)
      .sort((a, b) => b[1] - a[1])
      .map(([industry, count]) => ({ industry, count }));

    // Learning chat topics
    const allKeywords: string[] = [];
    let totalQuestions = 0;
    for (const chat of learningChats) {
      if (Array.isArray(chat.keywords)) {
        allKeywords.push(...(chat.keywords as string[]));
      }
      totalQuestions += chat.questionsAsked;
    }
    const keywordCount: Record<string, number> = {};
    for (const kw of allKeywords) {
      keywordCount[kw] = (keywordCount[kw] || 0) + 1;
    }
    const topKeywords = Object.entries(keywordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));

    // Activity timeline
    const activityByDay: Record<string, { attempts: number; completed: number; points: number }> = {};
    for (const sa of recentScenarioAttempts) {
      const day = sa.startedAt.toISOString().split("T")[0];
      if (!activityByDay[day]) {
        activityByDay[day] = { attempts: 0, completed: 0, points: 0 };
      }
      activityByDay[day].attempts++;
      if (sa.status === "completed") {
        activityByDay[day].completed++;
        activityByDay[day].points += sa.pointsEarned;
      }
    }
    const activityTimeline = Object.entries(activityByDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, stats]) => ({ date, ...stats }));

    // Recent scenarios
    const recentScenarios = scenarioAttempts.slice(0, 5).map((sa) => ({
      title: sa.scenario?.title || "Unknown",
      status: sa.status,
      pointsEarned: sa.pointsEarned,
      maxPoints: sa.maxPoints,
      difficulty: sa.scenario?.difficulty || "unknown",
      company: sa.scenario?.location?.company || "Unknown",
      industry: sa.scenario?.location?.industry || "Unknown",
    }));

    // Scenario stats
    const completedScenarios = scenarioAttempts.filter((sa) => sa.status === "completed");
    const scenarioCompletionRate = scenarioAttempts.length > 0
      ? Math.round((completedScenarios.length / scenarioAttempts.length) * 100)
      : 0;

    // Achievements count
    const achievements = Array.isArray(profile.achievements) ? profile.achievements : [];

    // Flashcard stats
    const totalCardsStudied = flashcardProgress.reduce((sum, fp) => sum + fp.cardsStudied, 0);
    const totalCardsMastered = flashcardProgress.reduce((sum, fp) => sum + fp.cardsMastered, 0);
    const totalFlashcardReviews = flashcardProgress.reduce((sum, fp) => sum + fp.totalReviews, 0);
    const flashcardTimeMinutes = flashcardProgress.reduce((sum, fp) => sum + fp.totalTimeMinutes, 0);
    const flashcardMasteryRate = totalCardsStudied > 0
      ? Math.round((totalCardsMastered / totalCardsStudied) * 100)
      : 0;

    // Quiz stats
    const completedQuizzes = quizAttempts.filter((qa) => qa.status === "completed");
    const passedQuizzes = completedQuizzes.filter((qa) => qa.passed);
    const quizPassRate = completedQuizzes.length > 0
      ? Math.round((passedQuizzes.length / completedQuizzes.length) * 100)
      : 0;
    const avgQuizScore = completedQuizzes.length > 0
      ? Math.round(completedQuizzes.reduce((sum, qa) => sum + qa.score, 0) / completedQuizzes.length)
      : 0;
    const totalQuizQuestions = completedQuizzes.reduce((sum, qa) => sum + qa.totalQuestions, 0);
    const totalQuizCorrect = completedQuizzes.reduce((sum, qa) => sum + qa.questionsCorrect, 0);
    const quizAccuracy = totalQuizQuestions > 0
      ? Math.round((totalQuizCorrect / totalQuizQuestions) * 100)
      : 0;

    // Get decrypted API key using the service
    const { getDecryptedApiKey } = await import("@/lib/academy/services/api-keys");
    const apiKey = await getDecryptedApiKey(profileId);

    // Fetch previous diagnostics for context (agent can see progress over time)
    let previousDiagnostics: Array<{
      createdAt: Date;
      overallReadiness: number;
      readinessLabel: string;
      summary: string | null;
      strengths: unknown;
      weaknesses: unknown;
    }> = [];
    try {
      previousDiagnostics = await prisma.learnerDiagnostics.findMany({
        where: { profileId },
        orderBy: { createdAt: "desc" },
        take: 3, // Last 3 for context
        select: {
          createdAt: true,
          overallReadiness: true,
          readinessLabel: true,
          summary: true,
          strengths: true,
          weaknesses: true,
        },
      });
    } catch {
      // Table might not exist yet, ignore
    }

    // Build request for Learning Agent
    const diagnosticsRequest = {
      profile_id: profileId,
      display_name: profile.displayName,
      skill_level: profile.skillLevel,
      target_certification: profile.targetCertification,
      subscription_tier: profile.subscriptionTier,
      total_points: profile.totalPoints,
      level: profile.level,
      xp: profile.xp,
      current_streak: profile.currentStreak,
      longest_streak: profile.longestStreak,
      achievements_count: achievements.length,
      challenges_total: totalChallenges,
      challenges_completed: completedChallenges.length,
      challenges_completion_rate: completionRate,
      challenges_avg_score: avgScore,
      challenges_hints_used: totalHintsUsed,
      challenges_avg_hints: avgHintsPerChallenge,
      difficulty_breakdown: difficultyStats,
      scenarios_total: scenarioAttempts.length,
      scenarios_completed: completedScenarios.length,
      scenarios_completion_rate: scenarioCompletionRate,
      top_services: topServices,
      industry_breakdown: industryBreakdown,
      chat_sessions: learningChats.length,
      questions_asked: totalQuestions,
      top_keywords: topKeywords,
      total_time_minutes: profile.totalTimeMinutes || 0,
      avg_time_per_scenario: completedScenarios.length > 0
        ? Math.round(completedScenarios.reduce((sum, sa) => sum + sa.activeTimeMinutes, 0) / completedScenarios.length)
        : 0,
      activity_timeline: activityTimeline,
      recent_scenarios: recentScenarios,
      previous_diagnostics: previousDiagnostics.map((d) => ({
        date: d.createdAt.toISOString(),
        readiness: d.overallReadiness,
        label: d.readinessLabel,
        summary: d.summary,
      })),
      // Flashcard stats
      flashcards_studied: totalCardsStudied,
      flashcards_mastered: totalCardsMastered,
      flashcard_reviews: totalFlashcardReviews,
      flashcard_time_minutes: flashcardTimeMinutes,
      flashcard_mastery_rate: flashcardMasteryRate,
      // Quiz stats
      quizzes_attempted: quizAttempts.length,
      quizzes_completed: completedQuizzes.length,
      quizzes_passed: passedQuizzes.length,
      quiz_pass_rate: quizPassRate,
      quiz_avg_score: avgQuizScore,
      quiz_accuracy: quizAccuracy,
      openai_api_key: apiKey || undefined,
      preferred_model: profile.preferredModel || tenant?.preferredModel || undefined,
    };

    // Call Learning Agent
    const response = await fetch(`${LEARNING_AGENT_URL}/api/learning/generate-diagnostics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(diagnosticsRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Learning Agent error:", errorText);
      
      if (response.status === 402) {
        return NextResponse.json(
          { error: "OpenAI API key required. Please add your API key in Settings." },
          { status: 402 }
        );
      }
      
      return NextResponse.json(
        { error: `Diagnostics generation failed: ${errorText}` },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Save diagnostics to database
    if (result.success && result.diagnostics) {
      try {
        const diag = result.diagnostics;
        await prisma.learnerDiagnostics.create({
          data: {
            profileId,
            overallReadiness: diag.overall_readiness || 0,
            readinessLabel: diag.readiness_label || "Not Ready",
            targetCertification: profile.targetCertification,
            summary: diag.summary,
            strengths: diag.strengths || [],
            weaknesses: diag.weaknesses || [],
            domainScores: diag.domain_scores || {},
            patterns: diag.patterns || [],
            recommendations: diag.recommendations || [],
            encouragement: diag.encouragement,
            nextMilestone: diag.next_milestone,
            daysToMilestone: diag.days_to_milestone,
            statsSnapshot: {
              totalPoints: profile.totalPoints,
              level: profile.level,
              challengesCompleted: completedChallenges.length,
              scenariosCompleted: completedScenarios.length,
              avgScore,
              currentStreak: profile.currentStreak,
            },
          },
        });
      } catch (saveError) {
        console.error("Failed to save diagnostics to DB:", saveError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Diagnostics endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to generate diagnostics" },
      { status: 500 }
    );
  }
}

// GET - Fetch diagnostics history
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;

    const diagnostics = await prisma.learnerDiagnostics.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
      take: 10, // Last 10 diagnostics
      select: {
        id: true,
        overallReadiness: true,
        readinessLabel: true,
        targetCertification: true,
        summary: true,
        strengths: true,
        weaknesses: true,
        domainScores: true,
        patterns: true,
        recommendations: true,
        encouragement: true,
        nextMilestone: true,
        daysToMilestone: true,
        statsSnapshot: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ diagnostics });
  } catch (error) {
    console.error("Diagnostics history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch diagnostics history" },
      { status: 500 }
    );
  }
}
