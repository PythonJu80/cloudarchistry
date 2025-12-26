import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { DiagramScore } from "@/lib/aws-placement-rules";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "https://cloudarchistry.com";
const DRAWING_AGENT_URL = process.env.DRAWING_AGENT_URL || "https://cloudarchistry.com";

interface DiagramNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    serviceId?: string;
    label?: string;
    sublabel?: string;
    color?: string;
    subnetType?: "public" | "private";
  };
  parentId?: string;
  width?: number;
  height?: number;
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  animated?: boolean;
}

interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/**
 * Trigger portfolio generation after scenario completion
 * Calls Learning Agent for text content and Drawing Agent for diagram enhancement
 * Saves combined result to AcademyPortfolio table
 */
async function triggerPortfolioGeneration(attemptId: string): Promise<void> {
  try {
    // Fetch the completed scenario attempt with all related data
    const attempt = await prisma.scenarioAttempt.findFirst({
      where: {
        id: attemptId,
        status: "completed",
      },
      include: {
        profile: true,
        scenario: {
          include: {
            location: true,
            challenges: {
              orderBy: { orderIndex: "asc" },
            },
          },
        },
        challengeProgress: {
          include: {
            challenge: true,
          },
          orderBy: {
            challenge: { orderIndex: "asc" },
          },
        },
      },
    });

    if (!attempt) {
      console.error("[Portfolio Generation] Attempt not found:", attemptId);
      return;
    }

    const profileId = attempt.profileId;

    // Check if portfolio already exists
    const existingPortfolio = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "AcademyPortfolio" 
      WHERE "scenarioAttemptId" = ${attemptId}
      LIMIT 1
    `;

    if (existingPortfolio.length > 0) {
      console.log("[Portfolio Generation] Portfolio already exists for attempt:", attemptId);
      return;
    }

    // Get AI config
    const aiConfig = await getAiConfigForRequest(profileId);

    const scenario = attempt.scenario;
    const location = scenario.location;

    // Find the best diagram from challenge progress
    let bestDiagram: DiagramData | null = null;
    let bestDiagramNodeCount = 0;
    const totalCLIProgress = {
      commandsRun: [] as Array<{ command: string; isCorrect?: boolean }>,
      totalCommands: 0,
      correctCommands: 0,
      syntaxErrors: 0,
      resourcesCreated: {} as Record<string, string[]>,
      objectivesCompleted: [] as string[],
      cliScore: 0,
    };

    for (const progress of attempt.challengeProgress) {
      const solution = progress.solution as {
        diagramData?: DiagramData;
        diagramScore?: { total: number };
        cliProgress?: typeof totalCLIProgress;
      } | null;

      if (solution?.diagramData?.nodes) {
        const nodeCount = solution.diagramData.nodes.length;
        if (nodeCount > bestDiagramNodeCount) {
          bestDiagram = solution.diagramData;
          bestDiagramNodeCount = nodeCount;
        }
      }

      // Aggregate CLI progress
      if (solution?.cliProgress) {
        const cli = solution.cliProgress;
        totalCLIProgress.totalCommands += cli.totalCommands || 0;
        totalCLIProgress.correctCommands += cli.correctCommands || 0;
        totalCLIProgress.syntaxErrors += cli.syntaxErrors || 0;
        if (cli.commandsRun) {
          totalCLIProgress.commandsRun.push(...cli.commandsRun);
        }
        if (cli.objectivesCompleted) {
          totalCLIProgress.objectivesCompleted.push(...cli.objectivesCompleted);
        }
        if (cli.resourcesCreated) {
          for (const [service, ids] of Object.entries(cli.resourcesCreated)) {
            if (!totalCLIProgress.resourcesCreated[service]) {
              totalCLIProgress.resourcesCreated[service] = [];
            }
            totalCLIProgress.resourcesCreated[service].push(...ids);
          }
        }
        totalCLIProgress.cliScore = Math.max(totalCLIProgress.cliScore, cli.cliScore || 0);
      }
    }

    // Build context objects
    const scenarioContext = {
      scenarioTitle: scenario.title,
      scenarioDescription: scenario.description,
      businessContext: scenario.businessContext,
      technicalRequirements: (scenario.technicalRequirements as string[]) || [],
      complianceRequirements: (scenario.complianceRequirements as string[]) || [],
      constraints: (scenario.constraints as string[]) || [],
      learningObjectives: (scenario.learningObjectives as string[]) || [],
      challengeTitle: attempt.challengeProgress[0]?.challenge?.title || "",
      challengeDescription: attempt.challengeProgress[0]?.challenge?.description || "",
      successCriteria: (attempt.challengeProgress[0]?.challenge?.successCriteria as string[]) || [],
      awsServices: scenario.challenges.flatMap(c => (c.awsServices as string[]) || []),
    };

    const locationContext = {
      slug: location?.slug || "",
      name: location?.name || "",
      company: location?.company || "",
      industry: location?.industry || "",
      compliance: (location?.compliance as string[]) || [],
    };

    // Calculate metrics
    const startTime = attempt.startedAt?.getTime() || Date.now();
    const endTime = attempt.completedAt?.getTime() || Date.now();
    const completionTimeMinutes = Math.round((endTime - startTime) / 60000);
    const totalHintsUsed = attempt.challengeProgress.reduce((sum, p) => sum + (p.hintsUsed || 0), 0);

    // Step 1: Call Learning Agent for text content
    console.log("[Portfolio Generation] Calling Learning Agent...");
    let learningAgentContent: {
      title?: string;
      solutionSummary?: string;
      keyDecisions?: string[];
      complianceAchieved?: string[];
      awsServicesUsed?: string[];
    } | null = null;

    try {
      const learningResponse = await fetch(`${LEARNING_AGENT_URL}/api/learning/generate-portfolio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          scenarioAttemptId: attemptId,
          challengeProgressId: attempt.challengeProgress[0]?.id,
          diagram: bestDiagram,
          cliProgress: totalCLIProgress.totalCommands > 0 ? totalCLIProgress : null,
          scenarioContext,
          locationContext,
          challengeScore: attempt.pointsEarned,
          maxScore: attempt.maxPoints || scenario.challenges.reduce((sum, c) => sum + (c.points || 0), 0),
          completionTimeMinutes,
          hintsUsed: totalHintsUsed,
          skillLevel: attempt.profile?.skillLevel || "intermediate",
          openai_api_key: aiConfig?.key || "",
          preferred_model: aiConfig?.preferredModel || "gpt-4o",
        }),
      });

      if (learningResponse.ok) {
        const data = await learningResponse.json();
        if (data.success && data.content) {
          learningAgentContent = data.content;
          console.log("[Portfolio Generation] Learning Agent content received");
        }
      } else {
        console.error("[Portfolio Generation] Learning Agent error:", await learningResponse.text());
      }
    } catch (error) {
      console.error("[Portfolio Generation] Learning Agent call failed:", error);
    }

    // Step 2: Call Drawing Agent to enhance diagram
    let enhancedDiagram = bestDiagram;

    if (bestDiagram && bestDiagram.nodes.length > 0) {
      console.log("[Portfolio Generation] Calling Drawing Agent...");
      try {
        const drawingResponse = await fetch(`${DRAWING_AGENT_URL}/portfolio/enhance-diagram`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            diagram: bestDiagram,
            scenario_context: scenarioContext,
            location_context: locationContext,
            openai_api_key: aiConfig?.key || "",
          }),
        });

        if (drawingResponse.ok) {
          const data = await drawingResponse.json();
          if (data.success && data.enhanced_diagram) {
            enhancedDiagram = data.enhanced_diagram;
            console.log("[Portfolio Generation] Drawing Agent enhancement received");
          }
        } else {
          console.error("[Portfolio Generation] Drawing Agent error:", await drawingResponse.text());
        }
      } catch (error) {
        console.error("[Portfolio Generation] Drawing Agent call failed:", error);
      }
    }

    // Step 3: Extract AWS services from diagram if not from Learning Agent
    const awsServices = learningAgentContent?.awsServicesUsed || 
      extractServicesFromDiagram(enhancedDiagram) ||
      scenarioContext.awsServices;

    // Step 4: Save to AcademyPortfolio
    console.log("[Portfolio Generation] Saving portfolio to database...");

    await prisma.$queryRaw`
      INSERT INTO "AcademyPortfolio" (
        id,
        "profileId",
        title,
        description,
        status,
        type,
        "isExample",
        "companyName",
        industry,
        "locationName",
        "businessUseCase",
        "problemStatement",
        "solutionSummary",
        "awsServices",
        "keyDecisions",
        "complianceAchieved",
        "challengeScore",
        "maxScore",
        "completionTimeMinutes",
        "hintsUsed",
        "scenarioAttemptId",
        "challengeProgressId",
        "locationSlug",
        "architectureDiagram",
        "generatedAt",
        "createdAt",
        "updatedAt"
      ) VALUES (
        gen_random_uuid(),
        ${profileId},
        ${learningAgentContent?.title || `${locationContext.company} Architecture Portfolio`},
        ${scenario.description},
        'ready',
        'generated',
        false,
        ${locationContext.company},
        ${locationContext.industry},
        ${location?.name || null},
        ${scenarioContext.businessContext},
        ${scenario.description},
        ${learningAgentContent?.solutionSummary || null},
        ${JSON.stringify(awsServices)}::jsonb,
        ${JSON.stringify(learningAgentContent?.keyDecisions || [])}::jsonb,
        ${JSON.stringify(learningAgentContent?.complianceAchieved || scenarioContext.complianceRequirements)}::jsonb,
        ${attempt.pointsEarned},
        ${attempt.maxPoints || 0},
        ${completionTimeMinutes},
        ${totalHintsUsed},
        ${attemptId},
        ${attempt.challengeProgress[0]?.id || null},
        ${location?.slug || null},
        ${enhancedDiagram ? JSON.stringify(enhancedDiagram) : null}::jsonb,
        NOW(),
        NOW(),
        NOW()
      )
    `;

    console.log("[Portfolio Generation] Portfolio created successfully for attempt:", attemptId);

  } catch (error) {
    console.error("[Portfolio Generation] Failed:", error);
    throw error;
  }
}

/**
 * Extract AWS service names from diagram nodes
 */
function extractServicesFromDiagram(diagram: DiagramData | null): string[] {
  if (!diagram?.nodes) return [];
  
  const services: string[] = [];
  for (const node of diagram.nodes as DiagramNode[]) {
    if (node.type === "vpc" || node.type === "subnet") continue;
    const label = node.data?.label;
    if (label && !services.includes(label)) {
      services.push(label);
    }
  }
  return services;
}

interface QuestionAnswer {
  questionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean;
  pointsEarned: number;
  hintUsed: boolean;
  answeredAt: string;
}


interface ProgressUpdate {
  attemptId: string;
  challengeId: string;
  answers: QuestionAnswer[];
  totalPointsEarned: number;
  hintsUsed: number;
  isComplete: boolean;
  questionsData?: {
    brief: string;
    questions: unknown[];
    totalPoints: number;
    estimatedTimeMinutes: number;
  };
  diagramData?: DiagramData;
  diagramScore?: DiagramScore;
}

/**
 * POST /api/challenge/progress
 * 
 * Saves challenge progress (answers, points, completion status)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to save progress" },
        { status: 401 }
      );
    }

    const body: ProgressUpdate = await request.json();
    const { 
      attemptId, 
      challengeId, 
      answers, 
      totalPointsEarned, 
      hintsUsed, 
      isComplete,
      questionsData,
      diagramData,
      diagramScore,
    } = body;

    if (!attemptId || !challengeId) {
      return NextResponse.json(
        { error: "Missing attemptId or challengeId" },
        { status: 400 }
      );
    }

    // Verify the attempt belongs to this user
    const attempt = await prisma.scenarioAttempt.findFirst({
      where: {
        id: attemptId,
        profileId: session.user.academyProfileId,
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Attempt not found or unauthorized" },
        { status: 404 }
      );
    }

    // Prepare solution JSON - Prisma needs it as a plain object
    const solutionData = JSON.parse(JSON.stringify({
      answers,
      questionsData,
      diagramData,  // Include diagram data in solution
      diagramScore,
      lastUpdated: new Date().toISOString(),
    }));

    const feedbackData = isComplete ? JSON.parse(JSON.stringify({
      completed: true,
      score: totalPointsEarned,
      totalQuestions: answers.length,
      correctAnswers: answers.filter(a => a.isCorrect).length,
    })) : undefined;

    // Update ChallengeProgress
    const progress = await prisma.challengeProgress.upsert({
      where: {
        attemptId_challengeId: {
          attemptId,
          challengeId,
        },
      },
      update: {
        status: isComplete ? "completed" : "in_progress",
        completedAt: isComplete ? new Date() : null,
        pointsEarned: totalPointsEarned,
        hintsUsed: hintsUsed,
        attemptsCount: { increment: isComplete ? 1 : 0 },
        solution: solutionData,
        feedback: feedbackData,
      },
      create: {
        attemptId,
        challengeId,
        status: isComplete ? "completed" : "in_progress",
        startedAt: new Date(),
        completedAt: isComplete ? new Date() : null,
        pointsEarned: totalPointsEarned,
        hintsUsed: hintsUsed,
        attemptsCount: isComplete ? 1 : 0,
        solution: solutionData,
      },
    });

    // If complete, unlock next challenge and update attempt totals
    if (isComplete) {
      // Get all challenges for this scenario to find the next one
      const allProgress = await prisma.challengeProgress.findMany({
        where: { attemptId },
        include: { challenge: true },
        orderBy: { challenge: { orderIndex: "asc" } },
      });

      const currentIndex = allProgress.findIndex(p => p.challengeId === challengeId);
      const nextProgress = allProgress[currentIndex + 1];

      // Unlock next challenge if exists and still locked
      if (nextProgress && nextProgress.status === "locked") {
        await prisma.challengeProgress.update({
          where: { id: nextProgress.id },
          data: {
            status: "unlocked",
            unlockedAt: new Date(),
          },
        });
      }

      // Update ScenarioAttempt totals
      const totalEarned = allProgress.reduce((sum, p) => sum + p.pointsEarned, 0);
      const allComplete = allProgress.every(p => 
        p.challengeId === challengeId ? isComplete : p.status === "completed"
      );

      await prisma.scenarioAttempt.update({
        where: { id: attemptId },
        data: {
          pointsEarned: totalEarned + totalPointsEarned,
          lastActivityAt: new Date(),
          status: allComplete ? "completed" : "in_progress",
          completedAt: allComplete ? new Date() : null,
        },
      });

      // Update user profile if scenario complete
      if (allComplete) {
        await prisma.academyUserProfile.update({
          where: { id: session.user.academyProfileId },
          data: {
            totalPoints: { increment: totalEarned + totalPointsEarned },
            xp: { increment: Math.floor((totalEarned + totalPointsEarned) / 10) },
            challengesCompleted: { increment: allProgress.length },
            scenariosCompleted: { increment: 1 },
            lastActivityDate: new Date(),
          },
        });

        // Trigger portfolio generation in background (fire and forget)
        // This calls Learning Agent + Drawing Agent and saves to AcademyPortfolio
        triggerPortfolioGeneration(attemptId).catch((err) => {
          console.error("[Challenge Progress] Portfolio generation failed:", err);
        });
      } else {
        // Just update for challenge completion
        await prisma.academyUserProfile.update({
          where: { id: session.user.academyProfileId },
          data: {
            totalPoints: { increment: totalPointsEarned },
            xp: { increment: Math.floor(totalPointsEarned / 10) },
            challengesCompleted: { increment: 1 },
            lastActivityDate: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      progressId: progress.id,
      status: progress.status,
      pointsEarned: progress.pointsEarned,
    });

  } catch (error) {
    console.error("Save progress error:", error);
    return NextResponse.json(
      { error: "Failed to save progress", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/challenge/progress?attemptId=xxx&challengeId=xxx
 * 
 * Loads existing progress for a challenge
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const attemptId = searchParams.get("attemptId");
    const challengeId = searchParams.get("challengeId");

    if (!attemptId || !challengeId) {
      return NextResponse.json(
        { error: "Missing attemptId or challengeId" },
        { status: 400 }
      );
    }

    // Verify the attempt belongs to this user
    const attempt = await prisma.scenarioAttempt.findFirst({
      where: {
        id: attemptId,
        profileId: session.user.academyProfileId,
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Attempt not found or unauthorized" },
        { status: 404 }
      );
    }

    const progress = await prisma.challengeProgress.findUnique({
      where: {
        attemptId_challengeId: {
          attemptId,
          challengeId,
        },
      },
    });

    if (!progress) {
      return NextResponse.json({
        exists: false,
        progress: null,
      });
    }

    // Extract diagramData from solution if present
    const solution = progress.solution as { diagramData?: DiagramData; diagramScore?: DiagramScore; answers?: QuestionAnswer[] } | null;
    
    return NextResponse.json({
      exists: true,
      progress: {
        id: progress.id,
        status: progress.status,
        pointsEarned: progress.pointsEarned,
        hintsUsed: progress.hintsUsed,
        attemptsCount: progress.attemptsCount,
        solution: progress.solution,
        diagramData: solution?.diagramData || null,  // Extract for easy access
        diagramScore: solution?.diagramScore || null,
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
      },
    });

  } catch (error) {
    console.error("Load progress error:", error);
    return NextResponse.json(
      { error: "Failed to load progress" },
      { status: 500 }
    );
  }
}
