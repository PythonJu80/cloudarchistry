import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/scenario/accept
 * 
 * Accepts a generated scenario:
 * 1. Creates or finds AcademyLocation
 * 2. Saves AcademyScenario with all challenges
 * 3. Creates ScenarioAttempt for the user
 * 
 * Returns the saved scenario ID and attempt ID for tracking progress
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to accept challenges" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      scenario, 
      companyInfo, 
      certCode, 
      userLevel = "intermediate",
      latitude,
      longitude,
      country,
      industry,
    } = body;

    if (!scenario || !companyInfo) {
      return NextResponse.json(
        { error: "Missing scenario or company info" },
        { status: 400 }
      );
    }

    // 1. Create or find AcademyLocation
    const locationSlug = `${(companyInfo.name as string).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    
    const location = await prisma.academyLocation.create({
      data: {
        slug: locationSlug,
        name: companyInfo.name as string,
        company: companyInfo.name as string,
        industry: industry || companyInfo.industry as string || "Technology",
        lat: latitude || 0,
        lng: longitude || 0,
        country: country || null,
        description: companyInfo.description as string || "",
        difficulty: userLevel,
      },
    });

    // 2. Calculate total points from challenges
    const challenges = scenario.challenges as Array<{
      id?: string;
      title: string;
      description: string;
      difficulty: string;
      points?: number;
      hints?: string[];
      success_criteria?: string[];
      aws_services_relevant?: string[];
      estimated_time_minutes?: number;
    }> || [];
    
    const totalPoints = challenges.reduce((sum, c) => sum + (c.points || 100), 0);
    const totalMinutes = challenges.reduce((sum, c) => sum + (c.estimated_time_minutes || 15), 0);

    // 3. Create AcademyScenario with challenges
    const savedScenario = await prisma.academyScenario.create({
      data: {
        locationId: location.id,
        title: scenario.scenario_title as string,
        description: scenario.scenario_description as string || "",
        businessContext: scenario.business_context as string || "",
        difficulty: scenario.difficulty as string || userLevel,
        technicalRequirements: scenario.technical_requirements || [],
        complianceRequirements: scenario.compliance_requirements || [],
        constraints: scenario.constraints || [],
        learningObjectives: scenario.learning_objectives || [],
        tags: [certCode, industry, userLevel].filter(Boolean),
        estimatedMinutes: totalMinutes,
        maxPoints: totalPoints,
        targetLevel: userLevel,
        companyInfo: companyInfo,
        generatedBy: "learning_agent_v1",
        challenges: {
          create: challenges.map((challenge, index) => ({
            title: challenge.title,
            description: challenge.description || "",
            difficulty: challenge.difficulty || userLevel,
            orderIndex: index,
            points: challenge.points || 100,
            hints: challenge.hints || [],
            successCriteria: challenge.success_criteria || [],
            awsServices: challenge.aws_services_relevant || [],
            estimatedMinutes: challenge.estimated_time_minutes || 15,
          })),
        },
      },
      include: {
        challenges: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    // 4. Create ScenarioAttempt for the user
    const attempt = await prisma.scenarioAttempt.create({
      data: {
        profileId: session.user.academyProfileId,
        scenarioId: savedScenario.id,
        status: "in_progress",
        maxPoints: totalPoints,
        metadata: {
          certCode,
          userLevel,
          acceptedAt: new Date().toISOString(),
        },
      },
    });

    // 5. Create ChallengeProgress records for each challenge (locked initially, first one unlocked)
    await prisma.challengeProgress.createMany({
      data: savedScenario.challenges.map((challenge: { id: string }, index: number) => ({
        attemptId: attempt.id,
        challengeId: challenge.id,
        status: index === 0 ? "unlocked" : "locked",
        unlockedAt: index === 0 ? new Date() : null,
      })),
    });

    // 6. Update user profile stats
    await prisma.academyUserProfile.update({
      where: { id: session.user.academyProfileId },
      data: {
        challengesStartedThisMonth: { increment: 1 },
        lastActivityDate: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      scenarioId: savedScenario.id,
      attemptId: attempt.id,
      locationId: location.id,
      challenges: savedScenario.challenges.map((c: { id: string; title: string; orderIndex: number; points: number }) => ({
        id: c.id,
        title: c.title,
        orderIndex: c.orderIndex,
        points: c.points,
      })),
    });

  } catch (error) {
    console.error("Accept scenario error:", error);
    return NextResponse.json(
      { error: "Failed to accept scenario", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
