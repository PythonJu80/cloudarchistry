import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface Portfolio {
  id: string;
  title: string;
  description: string | null;
  status: string;
  type: string;
  isExample: boolean;
  companyName: string | null;
  industry: string | null;
  locationName: string | null;
  awsServices: string[];
  challengeScore: number;
  maxScore: number;
  completionTimeMinutes: number;
  thumbnailUrl: string | null;
  pdfUrl: string | null;
  generatedAt: Date | null;
  createdAt: Date;
  // Stage completion data
  auditScore?: number | null;
  auditPassed?: boolean;
  proficiencyTest?: {
    score: number;
    summary: string;
    strengths: string[];
    areasForImprovement: string[];
  } | null;
  cliObjectives?: {
    completedCount: number;
    totalCount: number;
    earnedPoints: number;
    totalPoints: number;
    objectives: Array<{ description: string; completed: boolean; service: string }>;
  } | null;
}

// Example stage completion data for the example portfolio
const EXAMPLE_STAGE_DATA = {
  auditScore: 92,
  auditPassed: true,
  proficiencyTest: {
    score: 88,
    summary: "Demonstrated strong understanding of AWS architecture patterns and best practices for high-availability e-commerce platforms.",
    strengths: [
      "Excellent grasp of multi-AZ deployment strategies",
      "Strong understanding of load balancing and auto-scaling",
      "Good knowledge of database replication and failover",
      "Clear articulation of security best practices"
    ],
    areasForImprovement: [
      "Consider exploring AWS Global Accelerator for global traffic management",
      "Could benefit from deeper knowledge of cost optimization strategies"
    ]
  },
  cliObjectives: {
    completedCount: 3,
    totalCount: 3,
    earnedPoints: 45,
    totalPoints: 45,
    objectives: [
      { description: "Create an Application Load Balancer with health checks", completed: true, service: "ELB" },
      { description: "Configure Auto Scaling group with scaling policies", completed: true, service: "Auto Scaling" },
      { description: "Set up RDS Multi-AZ deployment", completed: true, service: "RDS" }
    ]
  }
};

/**
 * GET /api/portfolio
 * 
 * Fetches user's portfolios + the example portfolio that all users see
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const profileId = session?.user?.academyProfileId || null;

    // Use parameterized query to prevent SQL injection
    const portfolios = await prisma.$queryRaw<Portfolio[]>`
      SELECT 
        id,
        title,
        description,
        status,
        type,
        "isExample",
        "companyName",
        industry,
        "locationName",
        "awsServices",
        "challengeScore",
        "maxScore",
        "completionTimeMinutes",
        "thumbnailUrl",
        "pdfUrl",
        "generatedAt",
        "createdAt",
        "businessUseCase",
        "problemStatement",
        "solutionSummary",
        "keyDecisions",
        "complianceAchieved",
        "architectureDiagram"
      FROM "AcademyPortfolio"
      WHERE "isExample" = true 
         OR (${profileId}::text IS NOT NULL AND "profileId" = ${profileId})
      ORDER BY "isExample" DESC, "createdAt" DESC
    `;

    // Add example stage completion data to example portfolios
    const enrichedPortfolios = portfolios.map((p: Portfolio) => {
      if (p.isExample) {
        return {
          ...p,
          ...EXAMPLE_STAGE_DATA,
        };
      }
      return p;
    });

    return NextResponse.json({
      portfolios: enrichedPortfolios,
      count: enrichedPortfolios.length,
      hasUserPortfolios: enrichedPortfolios.some((p: Portfolio) => !p.isExample),
    });

  } catch (error) {
    console.error("Fetch portfolios error:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolios" },
      { status: 500 }
    );
  }
}
