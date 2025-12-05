import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/user/challenges
 * 
 * Fetches the user's accepted scenarios with their challenges and progress
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in" },
        { status: 401 }
      );
    }

    // Get all scenario attempts for this user with their scenarios and challenges
    const attempts = await prisma.scenarioAttempt.findMany({
      where: {
        profileId: session.user.academyProfileId,
      },
      include: {
        scenario: {
          include: {
            location: true,
            challenges: {
              orderBy: { orderIndex: "asc" },
            },
          },
        },
        challengeProgress: {
          orderBy: { challenge: { orderIndex: "asc" } },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    // Transform to a more usable format with full challenge data for resuming
    const userChallenges = attempts.map(attempt => ({
      id: attempt.id,
      scenarioId: attempt.scenarioId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      pointsEarned: attempt.pointsEarned,
      maxPoints: attempt.maxPoints,
      
      // Scenario info
      scenario: {
        id: attempt.scenario.id,
        title: attempt.scenario.title,
        description: attempt.scenario.description,
        difficulty: attempt.scenario.difficulty,
        estimatedMinutes: attempt.scenario.estimatedMinutes,
        companyInfo: attempt.scenario.companyInfo,
      },
      
      // Location info for map display
      location: {
        id: attempt.scenario.location.id,
        name: attempt.scenario.location.name,
        company: attempt.scenario.location.company,
        industry: attempt.scenario.location.industry,
        lat: attempt.scenario.location.lat,
        lng: attempt.scenario.location.lng,
        difficulty: attempt.scenario.location.difficulty,
      },
      
      // Full challenges data with progress (needed for resuming)
      challenges: attempt.scenario.challenges.map(challenge => {
        const progress = attempt.challengeProgress.find(p => p.challengeId === challenge.id);
        return {
          id: challenge.id,
          title: challenge.title,
          description: challenge.description,
          difficulty: challenge.difficulty,
          points: challenge.points,
          estimatedMinutes: challenge.estimatedMinutes,
          orderIndex: challenge.orderIndex,
          // Full challenge data for workspace modal
          hints: challenge.hints as string[] || [],
          successCriteria: challenge.successCriteria as string[] || [],
          awsServices: challenge.awsServices as string[] || [],
          // Progress
          status: progress?.status || "locked",
          pointsEarned: progress?.pointsEarned || 0,
          completedAt: progress?.completedAt,
        };
      }),
      
      // Summary stats
      challengesCompleted: attempt.challengeProgress.filter(p => p.status === "completed").length,
      totalChallenges: attempt.scenario.challenges.length,
    }));

    return NextResponse.json({
      success: true,
      challenges: userChallenges,
      count: userChallenges.length,
    });

  } catch (error) {
    console.error("Fetch user challenges error:", error);
    return NextResponse.json(
      { error: "Failed to fetch challenges" },
      { status: 500 }
    );
  }
}
