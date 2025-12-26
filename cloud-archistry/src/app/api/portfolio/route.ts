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
}

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

    return NextResponse.json({
      portfolios,
      count: portfolios.length,
      hasUserPortfolios: portfolios.some((p: Portfolio) => !p.isExample),
    });

  } catch (error) {
    console.error("Fetch portfolios error:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolios" },
      { status: 500 }
    );
  }
}
