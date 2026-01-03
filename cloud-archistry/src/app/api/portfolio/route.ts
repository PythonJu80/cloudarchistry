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
  thumbnailUrl: string | null;
  pdfUrl: string | null;
  generatedAt: Date | null;
  createdAt: Date;
  technicalHighlights?: string[];
}

// Example technical highlights for the example portfolio - professional accomplishments, not test scores
const EXAMPLE_PORTFOLIO_DATA = {
  technicalHighlights: [
    "Implemented multi-AZ Application Load Balancer with custom health checks and connection draining for zero-downtime deployments",
    "Configured Auto Scaling groups with target tracking policies based on CPU utilization and request count metrics",
    "Deployed RDS PostgreSQL with Multi-AZ standby, automated backups, and encryption at rest using AWS KMS",
    "Established VPC architecture with public/private subnet separation and NAT Gateway for secure outbound traffic",
    "Integrated AWS WAF with CloudFront distribution to protect against common web exploits and DDoS attacks"
  ]
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
        "architectureDiagram",
        "technicalHighlights"
      FROM "AcademyPortfolio"
      WHERE "isExample" = true 
         OR (${profileId}::text IS NOT NULL AND "profileId" = ${profileId})
      ORDER BY "isExample" DESC, "createdAt" DESC
    `;

    // Add example technical highlights to example portfolios
    const enrichedPortfolios = portfolios.map((p: Portfolio) => {
      if (p.isExample) {
        return {
          ...p,
          ...EXAMPLE_PORTFOLIO_DATA,
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
