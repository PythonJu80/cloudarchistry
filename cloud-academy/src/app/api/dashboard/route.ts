import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user profile with stats
    const profile = await prisma.academyUserProfile.findFirst({
      where: { academyUserId: userId },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get scenario attempts with challenge progress
    const scenarioAttempts = await prisma.scenarioAttempt.findMany({
      where: { profileId: profile.id },
      include: {
        scenario: {
          include: {
            location: true,
            challenges: true,
          },
        },
        challengeProgress: {
          include: {
            challenge: true,
          },
        },
      },
      orderBy: { lastActivityAt: "desc" },
      take: 10,
    });

    // Get location progress
    const locationProgress = await prisma.userLocationProgress.findMany({
      where: { profileId: profile.id },
      include: {
        location: true,
      },
      orderBy: { lastVisitedAt: "desc" },
    });

    // Calculate stats
    const totalChallenges = scenarioAttempts.reduce(
      (acc, attempt) => acc + attempt.challengeProgress.length,
      0
    );
    
    const completedChallenges = scenarioAttempts.reduce(
      (acc, attempt) =>
        acc + attempt.challengeProgress.filter((cp) => cp.status === "completed").length,
      0
    );
    
    const inProgressChallenges = scenarioAttempts.reduce(
      (acc, attempt) =>
        acc + attempt.challengeProgress.filter((cp) => cp.status === "in_progress").length,
      0
    );

    const pendingChallenges = scenarioAttempts.reduce(
      (acc, attempt) =>
        acc + attempt.challengeProgress.filter((cp) => cp.status === "available" || cp.status === "locked").length,
      0
    );

    // Get recent activity
    const recentActivity = await prisma.academyActivity.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Get flashcard progress
    const flashcardProgress = await prisma.flashcardUserProgress.findMany({
      where: { profileId: profile.id },
      include: {
        deck: {
          include: {
            scenario: {
              include: {
                location: true,
              },
            },
          },
        },
      },
    });

    // Get quiz attempts
    const quizAttempts = await prisma.quizAttempt.findMany({
      where: { profileId: profile.id },
      include: {
        quiz: {
          include: {
            scenario: {
              include: {
                location: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Get notes count
    const notesCount = await prisma.studyNotes.count({
      where: {
        isActive: true,
        OR: [
          { profileId: profile.id },
          { scenarioId: { not: null } },
        ],
      },
    });

    // Get flashcard decks count
    const flashcardDecksCount = await prisma.flashcardDeck.count({
      where: {
        isActive: true,
        OR: [
          { profileId: profile.id },
          { scenarioId: { not: null } },
        ],
      },
    });

    // Get quizzes count
    const quizzesCount = await prisma.quiz.count({
      where: {
        isActive: true,
        OR: [
          { profileId: profile.id },
          { scenarioId: { not: null } },
        ],
      },
    });

    // Format user journeys (scenarios in progress or completed) with full challenge data for modal
    const userJourneys = scenarioAttempts.map((attempt) => {
      // Sort challenges by orderIndex and map progress
      const sortedChallenges = [...attempt.scenario.challenges].sort((a, b) => a.orderIndex - b.orderIndex);
      
      // Full challenge data for the ChallengeWorkspaceModal
      const challenges = sortedChallenges.map((challenge) => {
        const progress = attempt.challengeProgress.find((cp) => cp.challengeId === challenge.id);
        return {
          id: challenge.id,
          title: challenge.title,
          description: challenge.description,
          difficulty: challenge.difficulty,
          points: challenge.points,
          orderIndex: challenge.orderIndex,
          estimatedMinutes: challenge.estimatedMinutes,
          awsServices: challenge.awsServices as string[],
          hints: challenge.hints as string[],
          successCriteria: challenge.successCriteria as string[],
          status: progress?.status || "locked",
          startedAt: progress?.startedAt,
          completedAt: progress?.completedAt,
          pointsEarned: progress?.pointsEarned || 0,
          hintsUsed: progress?.hintsUsed || 0,
          progressId: progress?.id,
        };
      });

      return {
        // Attempt data
        id: attempt.id,
        scenarioId: attempt.scenarioId,
        status: attempt.status,
        startedAt: attempt.startedAt,
        lastActivityAt: attempt.lastActivityAt,
        completedAt: attempt.completedAt,
        pointsEarned: attempt.pointsEarned,
        maxPoints: attempt.maxPoints,
        
        // Scenario data (for ChallengeWorkspaceModal)
        scenario: {
          id: attempt.scenario.id,
          title: attempt.scenario.title,
          description: attempt.scenario.description,
          difficulty: attempt.scenario.difficulty,
          companyInfo: attempt.scenario.companyInfo as Record<string, unknown>,
        },
        
        // Location data (for ChallengeWorkspaceModal)
        location: {
          id: attempt.scenario.location.id,
          name: attempt.scenario.location.name,
          company: attempt.scenario.location.company,
          icon: attempt.scenario.location.icon,
          slug: attempt.scenario.location.slug,
          lat: attempt.scenario.location.lat,
          lng: attempt.scenario.location.lng,
          country: attempt.scenario.location.country,
          industry: attempt.scenario.location.industry,
          difficulty: attempt.scenario.location.difficulty,
        },
        
        // Full challenges array for modal navigation
        challenges,
        
        // Stats for display
        totalChallenges: attempt.scenario.challenges.length,
        challengesCompleted: attempt.challengeProgress.filter((cp) => cp.status === "completed").length,
        progress: attempt.scenario.challenges.length > 0
          ? Math.round(
              (attempt.challengeProgress.filter((cp) => cp.status === "completed").length /
                attempt.scenario.challenges.length) *
                100
            )
          : 0,
      };
    });

    // Format challenge details
    const challengeDetails = scenarioAttempts.flatMap((attempt) =>
      attempt.challengeProgress.map((cp) => ({
        id: cp.id,
        challengeId: cp.challengeId,
        challengeTitle: cp.challenge.title,
        challengeDescription: cp.challenge.description,
        scenarioTitle: attempt.scenario.title,
        locationName: attempt.scenario.location.name,
        status: cp.status,
        pointsEarned: cp.pointsEarned,
        maxPoints: cp.challenge.points,
        hintsUsed: cp.hintsUsed,
        startedAt: cp.startedAt,
        completedAt: cp.completedAt,
        difficulty: cp.challenge.difficulty,
      }))
    );

    return NextResponse.json({
      profile: {
        id: profile.id,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        skillLevel: profile.skillLevel,
        subscriptionTier: profile.subscriptionTier,
        totalPoints: profile.totalPoints,
        level: profile.level,
        xp: profile.xp,
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
        challengesCompleted: profile.challengesCompleted,
        scenariosCompleted: profile.scenariosCompleted,
        locationsVisited: profile.locationsVisited,
        totalTimeMinutes: profile.totalTimeMinutes,
        hasAiAccess: profile.hasAiAccess,
        hasOpenAiKey: !!profile.openaiApiKey,
        openaiKeyLastFour: profile.openaiKeyLastFour,
      },
      stats: {
        totalChallenges,
        completedChallenges,
        inProgressChallenges,
        pendingChallenges,
        locationsVisited: locationProgress.length,
        scenariosStarted: scenarioAttempts.length,
        scenariosCompleted: scenarioAttempts.filter((a) => a.status === "completed").length,
      },
      userJourneys,
      challengeDetails,
      locationProgress: locationProgress.map((lp) => ({
        id: lp.id,
        locationId: lp.locationId,
        locationName: lp.location.name,
        locationCompany: lp.location.company,
        locationIcon: lp.location.icon,
        status: lp.status,
        totalPoints: lp.totalPoints,
        challengesCompleted: lp.challengesCompleted,
        totalChallenges: lp.totalChallenges,
        firstVisitedAt: lp.firstVisitedAt,
        lastVisitedAt: lp.lastVisitedAt,
      })),
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        type: a.type,
        data: a.data,
        createdAt: a.createdAt,
      })),
      flashcardProgress: flashcardProgress.map((fp) => ({
        id: fp.id,
        deckTitle: fp.deck.title,
        scenarioTitle: fp.deck.scenario.title,
        locationName: fp.deck.scenario.location.name,
        cardsStudied: fp.cardsStudied,
        cardsMastered: fp.cardsMastered,
        totalCards: fp.deck.totalCards,
        lastStudiedAt: fp.lastStudiedAt,
      })),
      quizAttempts: quizAttempts.map((qa) => ({
        id: qa.id,
        quizTitle: qa.quiz.title,
        scenarioTitle: qa.quiz.scenario?.title || "Certification Quiz",
        locationName: qa.quiz.scenario?.location?.name || "Certification Study",
        score: qa.score,
        passed: qa.passed,
        completedAt: qa.completedAt,
      })),
      notesCount,
      flashcardDecksCount,
      quizzesCount,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
