import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "https://cloudarchistry.com";
const _DRAWING_AGENT_URL = process.env.DRAWING_AGENT_URL || "https://cloudarchistry.com";

interface DiagramNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    serviceId?: string;
    label: string;
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

interface CLIProgressData {
  commandsRun?: Array<{
    command: string;
    timestamp?: string;
    exitCode?: number;
    isCorrect?: boolean;
    output?: string;
  }>;
  totalCommands?: number;
  correctCommands?: number;
  syntaxErrors?: number;
  resourcesCreated?: Record<string, string[]>;
  objectivesCompleted?: string[];
  cliScore?: number;
}

interface CLIObjective {
  id: string;
  description: string;
  command_pattern: string;
  example_command: string;
  hint?: string;
  points: number;
  service: string;
  completed: boolean;
}

interface CLIObjectivesData {
  objectives: CLIObjective[];
  contextMessage: string;
  totalPoints: number;
  earnedPoints: number;
  lastUpdated?: string;
}

interface ProficiencyTestData {
  chatHistory: Array<{ role: string; content: string; timestamp: string }>;
  score: number;
  summary: string;
  strengths: string[];
  areasForImprovement: string[];
  completedAt: string;
}

interface GeneratePortfolioRequest {
  attemptId: string;
}

/**
 * POST /api/portfolio/generate
 * 
 * Orchestrates portfolio generation by:
 * 1. Fetching scenario attempt data with all challenge progress
 * 2. Calling Learning Agent for AI-generated text content
 * 3. Calling Drawing Agent to enhance the architecture diagram
 * 4. Saving combined result to AcademyPortfolio table
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to generate portfolio" },
        { status: 401 }
      );
    }

    const profileId = session.user.academyProfileId;
    const body: GeneratePortfolioRequest = await request.json();
    const { attemptId } = body;

    if (!attemptId) {
      return NextResponse.json(
        { error: "Missing attemptId" },
        { status: 400 }
      );
    }

    // Get AI config for API calls
    const aiConfig = await getAiConfigForRequest(profileId);

    // Fetch the scenario attempt with all related data
    const attempt = await prisma.scenarioAttempt.findFirst({
      where: {
        id: attemptId,
        profileId: profileId,
        status: "completed",
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
      return NextResponse.json(
        { error: "Completed scenario attempt not found" },
        { status: 404 }
      );
    }

    // Check if portfolio already exists for this attempt
    const existingPortfolio = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "AcademyPortfolio" 
      WHERE "scenarioAttemptId" = ${attemptId}
      LIMIT 1
    `;

    if (existingPortfolio.length > 0) {
      return NextResponse.json({
        success: true,
        portfolioId: existingPortfolio[0].id,
        message: "Portfolio already exists for this scenario",
        alreadyExists: true,
      });
    }

    const scenario = attempt.scenario;
    const location = scenario.location;

    // Aggregate diagram data from all challenge progress
    // Use the most complete diagram (most nodes)
    let bestDiagram: DiagramData | null = null;
    let bestDiagramScore = 0;
    let bestAuditScore: number | null = null;
    let bestAuditPassed = false;
    let aggregatedProficiencyTest: ProficiencyTestData | null = null;
    let aggregatedCliObjectives: CLIObjectivesData | null = null;
    const totalCLIProgress: CLIProgressData = {
      commandsRun: [],
      totalCommands: 0,
      correctCommands: 0,
      syntaxErrors: 0,
      resourcesCreated: {},
      objectivesCompleted: [],
      cliScore: 0,
    };

    for (const progress of attempt.challengeProgress) {
      const solution = progress.solution as {
        diagramData?: DiagramData;
        diagramScore?: { total: number };
        auditScore?: number;
        auditPassed?: boolean;
        proficiencyTest?: ProficiencyTestData;
        cliObjectives?: CLIObjectivesData;
        cliProgress?: CLIProgressData;
      } | null;

      // Get best diagram
      if (solution?.diagramData?.nodes) {
        const nodeCount = solution.diagramData.nodes.length;
        if (nodeCount > bestDiagramScore) {
          bestDiagram = solution.diagramData;
          bestDiagramScore = nodeCount;
        }
      }

      // Get audit results (use highest score)
      if (solution?.auditScore !== undefined) {
        if (bestAuditScore === null || solution.auditScore > bestAuditScore) {
          bestAuditScore = solution.auditScore;
          bestAuditPassed = solution.auditPassed || false;
        }
      }

      // Get proficiency test results (use the one with highest score)
      if (solution?.proficiencyTest?.score !== undefined) {
        if (!aggregatedProficiencyTest || solution.proficiencyTest.score > aggregatedProficiencyTest.score) {
          aggregatedProficiencyTest = solution.proficiencyTest;
        }
      }

      // Get CLI objectives (aggregate all)
      if (solution?.cliObjectives?.objectives) {
        if (!aggregatedCliObjectives) {
          aggregatedCliObjectives = {
            objectives: [],
            contextMessage: solution.cliObjectives.contextMessage || "",
            totalPoints: 0,
            earnedPoints: 0,
          };
        }
        aggregatedCliObjectives.objectives.push(...solution.cliObjectives.objectives);
        aggregatedCliObjectives.totalPoints += solution.cliObjectives.totalPoints || 0;
        aggregatedCliObjectives.earnedPoints += solution.cliObjectives.earnedPoints || 0;
      }

      // Aggregate legacy CLI progress (for backwards compatibility)
      if (solution?.cliProgress) {
        const cli = solution.cliProgress;
        totalCLIProgress.totalCommands! += cli.totalCommands || 0;
        totalCLIProgress.correctCommands! += cli.correctCommands || 0;
        totalCLIProgress.syntaxErrors! += cli.syntaxErrors || 0;
        if (cli.commandsRun) {
          totalCLIProgress.commandsRun!.push(...cli.commandsRun);
        }
        if (cli.objectivesCompleted) {
          totalCLIProgress.objectivesCompleted!.push(...cli.objectivesCompleted);
        }
        if (cli.resourcesCreated) {
          for (const [service, ids] of Object.entries(cli.resourcesCreated)) {
            if (!totalCLIProgress.resourcesCreated![service]) {
              totalCLIProgress.resourcesCreated![service] = [];
            }
            totalCLIProgress.resourcesCreated![service].push(...ids);
          }
        }
        totalCLIProgress.cliScore = Math.max(totalCLIProgress.cliScore!, cli.cliScore || 0);
      }
    }

    // Build scenario context for Learning Agent
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

    // Build location context
    const locationContext = {
      slug: location?.slug || "",
      name: location?.name || "",
      company: location?.company || "",
      industry: location?.industry || "",
      compliance: (location?.compliance as string[]) || [],
    };

    // Calculate completion time
    const startTime = attempt.startedAt?.getTime() || Date.now();
    const endTime = attempt.completedAt?.getTime() || Date.now();
    const completionTimeMinutes = Math.round((endTime - startTime) / 60000);

    // Calculate total hints used
    const totalHintsUsed = attempt.challengeProgress.reduce(
      (sum, p) => sum + (p.hintsUsed || 0),
      0
    );

    // Step 1: Call Learning Agent for text content
    console.log("[Portfolio Generate] Calling Learning Agent...");
    let learningAgentContent = null;
    
    try {
      const learningResponse = await fetch(`${LEARNING_AGENT_URL}/api/learning/generate-portfolio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          scenarioAttemptId: attemptId,
          challengeProgressId: attempt.challengeProgress[0]?.id,
          diagram: bestDiagram,
          // Drawing audit results
          auditScore: bestAuditScore,
          auditPassed: bestAuditPassed,
          // Proficiency test results
          proficiencyTest: aggregatedProficiencyTest ? {
            score: aggregatedProficiencyTest.score,
            summary: aggregatedProficiencyTest.summary,
            strengths: aggregatedProficiencyTest.strengths,
            areasForImprovement: aggregatedProficiencyTest.areasForImprovement,
          } : null,
          // CLI objectives (new format)
          cliObjectives: aggregatedCliObjectives ? {
            objectives: aggregatedCliObjectives.objectives,
            totalPoints: aggregatedCliObjectives.totalPoints,
            earnedPoints: aggregatedCliObjectives.earnedPoints,
            completedCount: aggregatedCliObjectives.objectives.filter(o => o.completed).length,
          } : null,
          // Legacy CLI progress (for backwards compatibility)
          cliProgress: totalCLIProgress.totalCommands! > 0 ? totalCLIProgress : null,
          scenarioContext,
          locationContext,
          challengeScore: attempt.pointsEarned,
          maxScore: attempt.maxPoints || scenario.challenges.reduce((sum, c) => sum + (c.points || 0), 0),
          completionTimeMinutes,
          hintsUsed: totalHintsUsed,
          skillLevel: "intermediate",
          openai_api_key: aiConfig?.key || "",
          preferred_model: aiConfig?.preferredModel || "gpt-4o",
        }),
      });

      if (learningResponse.ok) {
        const learningData = await learningResponse.json();
        if (learningData.success && learningData.content) {
          learningAgentContent = learningData.content;
          console.log("[Portfolio Generate] Learning Agent content received");
        }
      } else {
        console.error("[Portfolio Generate] Learning Agent error:", await learningResponse.text());
      }
    } catch (error) {
      console.error("[Portfolio Generate] Learning Agent call failed:", error);
    }

    // Step 2: Use the user's actual diagram directly (no Drawing Agent enhancement needed)
    // The user's diagram already has proper positions, nodes, and edges from their work
    // Drawing Agent was generating a completely new diagram instead of enhancing, losing user's work
    const finalDiagram = bestDiagram;
    console.log("[Portfolio Generate] Using user's original diagram with", 
      finalDiagram?.nodes?.length || 0, "nodes and", 
      finalDiagram?.edges?.length || 0, "edges");

    // Step 3: Build final portfolio data
    const awsServices = learningAgentContent?.awsServicesUsed || 
      extractServicesFromDiagram(finalDiagram) ||
      scenarioContext.awsServices;

    const portfolioData = {
      title: learningAgentContent?.title || `${locationContext.company} Architecture Portfolio`,
      description: scenario.description,
      status: "ready",
      type: "generated",
      isExample: false,
      companyName: locationContext.company,
      industry: locationContext.industry,
      locationName: location?.name || null,
      businessUseCase: scenarioContext.businessContext,
      problemStatement: scenario.description,
      solutionSummary: learningAgentContent?.solutionSummary || null,
      awsServices: JSON.stringify(awsServices),
      keyDecisions: JSON.stringify(learningAgentContent?.keyDecisions || []),
      complianceAchieved: JSON.stringify(learningAgentContent?.complianceAchieved || scenarioContext.complianceRequirements),
      technicalHighlights: JSON.stringify(learningAgentContent?.technicalHighlights || []),
      challengeScore: attempt.pointsEarned,
      maxScore: attempt.maxPoints || 0,
      completionTimeMinutes,
      hintsUsed: totalHintsUsed,
      scenarioAttemptId: attemptId,
      challengeProgressId: attempt.challengeProgress[0]?.id || null,
      locationSlug: location?.slug || null,
      architectureDiagram: finalDiagram ? JSON.stringify(finalDiagram) : null,
      generatedAt: new Date(),
    };

    // Step 4: Save to database
    console.log("[Portfolio Generate] Saving to database...");
    
    const result = await prisma.$queryRaw<Array<{ id: string }>>`
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
        "technicalHighlights",
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
        ${portfolioData.title},
        ${portfolioData.description},
        ${portfolioData.status},
        ${portfolioData.type},
        ${portfolioData.isExample},
        ${portfolioData.companyName},
        ${portfolioData.industry},
        ${portfolioData.locationName},
        ${portfolioData.businessUseCase},
        ${portfolioData.problemStatement},
        ${portfolioData.solutionSummary},
        ${portfolioData.awsServices}::jsonb,
        ${portfolioData.keyDecisions}::jsonb,
        ${portfolioData.complianceAchieved}::jsonb,
        ${portfolioData.technicalHighlights}::jsonb,
        ${portfolioData.challengeScore},
        ${portfolioData.maxScore},
        ${portfolioData.completionTimeMinutes},
        ${portfolioData.hintsUsed},
        ${portfolioData.scenarioAttemptId},
        ${portfolioData.challengeProgressId},
        ${portfolioData.locationSlug},
        ${portfolioData.architectureDiagram}::jsonb,
        ${portfolioData.generatedAt},
        NOW(),
        NOW()
      )
      RETURNING id
    `;

    const portfolioId = result[0]?.id;

    console.log("[Portfolio Generate] Portfolio created:", portfolioId);

    return NextResponse.json({
      success: true,
      portfolioId,
      message: "Portfolio generated successfully",
      hasLearningContent: !!learningAgentContent,
      hasDiagram: !!finalDiagram,
    });

  } catch (error) {
    console.error("[Portfolio Generate] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate portfolio", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Extract AWS service names from diagram nodes
 */
function extractServicesFromDiagram(diagram: DiagramData | null): string[] {
  if (!diagram?.nodes) return [];
  
  const services: string[] = [];
  for (const node of diagram.nodes) {
    if (node.type === "vpc" || node.type === "subnet") continue;
    
    const label = node.data?.label;
    if (label && !services.includes(label)) {
      services.push(label);
    }
  }
  return services;
}
