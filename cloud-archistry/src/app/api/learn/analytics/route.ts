import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all data in parallel
    const [
      profile,
      scenarioAttempts,
      challengeProgress,
      learningChats,
      activities,
      recentScenarioAttempts,
    ] = await Promise.all([
      // User profile with stats
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
        },
      }),

      // All scenario attempts for this user
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

      // Challenge progress
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

      // Learning chat sessions
      prisma.learningChat.findMany({
        where: { profileId },
        select: {
          title: true,
          keywords: true,
          topicsDiscussed: true,
          questionsAsked: true,
          lastMessageAt: true,
          messages: true,
        },
        orderBy: { lastMessageAt: "desc" },
        take: 10,
      }),

      // Activity feed
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

      // Recent scenario attempts (last 30 days) for trend analysis
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
    ]);

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Calculate analytics

    // 1. Challenge completion stats
    const completedChallenges = challengeProgress.filter((cp) => cp.status === "completed");
    const totalChallenges = challengeProgress.length;
    const completionRate = totalChallenges > 0 
      ? Math.round((completedChallenges.length / totalChallenges) * 100) 
      : 0;

    // 2. Average score
    const scoresWithMax = completedChallenges
      .filter((cp) => cp.challenge.points > 0)
      .map((cp) => (cp.pointsEarned / cp.challenge.points) * 100);
    const avgScore = scoresWithMax.length > 0
      ? Math.round(scoresWithMax.reduce((a, b) => a + b, 0) / scoresWithMax.length)
      : 0;

    // 3. Hints usage
    const totalHintsUsed = challengeProgress.reduce((sum, cp) => sum + cp.hintsUsed, 0);
    const avgHintsPerChallenge = completedChallenges.length > 0
      ? Math.round((totalHintsUsed / completedChallenges.length) * 10) / 10
      : 0;

    // 4. AWS Services practiced
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

    // 5. Difficulty breakdown
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
    // Calculate averages
    for (const diff of Object.keys(difficultyStats)) {
      if (difficultyStats[diff].completed > 0) {
        difficultyStats[diff].avgScore = Math.round(
          difficultyStats[diff].avgScore / difficultyStats[diff].completed
        );
      }
    }

    // 6. Industry exposure
    const industryCount: Record<string, number> = {};
    for (const sa of scenarioAttempts) {
      const industry = sa.scenario?.location?.industry || "Unknown";
      industryCount[industry] = (industryCount[industry] || 0) + 1;
    }
    const industryBreakdown = Object.entries(industryCount)
      .sort((a, b) => b[1] - a[1])
      .map(([industry, count]) => ({ industry, count }));

    // 7. Learning chat topics (what user struggles with)
    const allKeywords: string[] = [];
    const allTopics: string[] = [];
    let totalQuestions = 0;
    for (const chat of learningChats) {
      if (Array.isArray(chat.keywords)) {
        allKeywords.push(...(chat.keywords as string[]));
      }
      if (Array.isArray(chat.topicsDiscussed)) {
        allTopics.push(...(chat.topicsDiscussed as string[]));
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

    // 8. Activity over time (last 30 days)
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

    // 9. Recent scenario attempts
    const recentAttempts = scenarioAttempts.slice(0, 5).map((sa) => ({
      title: sa.scenario?.title || "Unknown",
      status: sa.status,
      pointsEarned: sa.pointsEarned,
      maxPoints: sa.maxPoints,
      difficulty: sa.scenario?.difficulty || "unknown",
      company: sa.scenario?.location?.company || "Unknown",
      industry: sa.scenario?.location?.industry || "Unknown",
      startedAt: sa.startedAt,
      completedAt: sa.completedAt,
    }));

    // 10. Scenario completion stats
    const completedScenarios = scenarioAttempts.filter((sa) => sa.status === "completed");
    const scenarioCompletionRate = scenarioAttempts.length > 0
      ? Math.round((completedScenarios.length / scenarioAttempts.length) * 100)
      : 0;

    // 11. Time spent analysis
    const totalTimeMinutes = profile.totalTimeMinutes || 0;
    const avgTimePerScenario = completedScenarios.length > 0
      ? Math.round(completedScenarios.reduce((sum, sa) => sum + sa.activeTimeMinutes, 0) / completedScenarios.length)
      : 0;

    // 12. Achievements
    const achievements = Array.isArray(profile.achievements) ? profile.achievements : [];

    return NextResponse.json({
      // Profile summary
      profile: {
        displayName: profile.displayName,
        skillLevel: profile.skillLevel,
        targetCertification: profile.targetCertification,
        subscriptionTier: profile.subscriptionTier,
        memberSince: profile.createdAt,
        lastActive: profile.lastActivityDate,
      },

      // Gamification stats
      gamification: {
        totalPoints: profile.totalPoints,
        level: profile.level,
        xp: profile.xp,
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
        achievementsCount: achievements.length,
      },

      // Challenge analytics
      challenges: {
        total: totalChallenges,
        completed: completedChallenges.length,
        completionRate,
        avgScore,
        totalHintsUsed,
        avgHintsPerChallenge,
        difficultyBreakdown: difficultyStats,
      },

      // Scenario analytics
      scenarios: {
        total: scenarioAttempts.length,
        completed: completedScenarios.length,
        completionRate: scenarioCompletionRate,
        recentAttempts,
      },

      // Skills & Services
      skills: {
        topServices,
        industryBreakdown,
      },

      // Learning insights
      learning: {
        totalChatSessions: learningChats.length,
        totalQuestionsAsked: totalQuestions,
        topKeywords,
        recentChats: learningChats.slice(0, 5).map((c) => ({
          title: c.title,
          questionsAsked: c.questionsAsked,
          lastMessageAt: c.lastMessageAt,
        })),
      },

      // Time analytics
      time: {
        totalMinutes: totalTimeMinutes,
        avgTimePerScenario,
      },

      // Activity timeline
      activityTimeline,

      // Recent activities
      recentActivities: activities.slice(0, 10).map((a) => ({
        type: a.type,
        data: a.data,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error("Learn analytics GET failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
