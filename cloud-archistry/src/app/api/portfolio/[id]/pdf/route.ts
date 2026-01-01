import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { PortfolioPDF, PortfolioPDFData } from "@/lib/portfolio/pdf-template";
import React from "react";

interface DiagramNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    serviceId: string;
    label: string;
    sublabel?: string;
    color: string;
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
}

interface Portfolio {
  id: string;
  title: string;
  description: string | null;
  companyName: string | null;
  industry: string | null;
  businessUseCase: string | null;
  problemStatement: string | null;
  solutionSummary: string | null;
  awsServices: string[];
  keyDecisions: string[];
  complianceAchieved: string[];
  challengeScore: number;
  maxScore: number;
  completionTimeMinutes: number;
  createdAt: Date;
  isExample: boolean;
  profileId: string | null;
  architectureDiagram: { nodes: DiagramNode[]; edges: DiagramEdge[] } | null;
  // New fields for stage completion data
  challengeProgressId: string | null;
}

/**
 * GET /api/portfolio/[id]/pdf
 * 
 * Generates and returns the PDF for a portfolio
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch portfolio from database using parameterized query
    const portfolios = await prisma.$queryRaw<Portfolio[]>`
      SELECT 
        id,
        title,
        description,
        "companyName",
        industry,
        "businessUseCase",
        "problemStatement",
        "solutionSummary",
        "awsServices",
        "keyDecisions",
        "complianceAchieved",
        "challengeScore",
        "maxScore",
        "completionTimeMinutes",
        "createdAt",
        "isExample",
        "profileId",
        "architectureDiagram",
        "challengeProgressId"
      FROM "AcademyPortfolio"
      WHERE id = ${id}
      LIMIT 1
    `;

    if (portfolios.length === 0) {
      return NextResponse.json(
        { error: "Portfolio not found" },
        { status: 404 }
      );
    }

    const portfolio = portfolios[0];

    // Fetch challenge progress data for stage completion info
    let auditScore: number | null = null;
    let auditPassed = false;
    let proficiencyTest: PortfolioPDFData["proficiencyTest"] = null;
    let cliObjectives: PortfolioPDFData["cliObjectives"] = null;

    // For example portfolios, use hardcoded example data
    if (portfolio.isExample) {
      auditScore = 92;
      auditPassed = true;
      proficiencyTest = {
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
      };
      cliObjectives = {
        completedCount: 3,
        totalCount: 3,
        earnedPoints: 45,
        totalPoints: 45,
        objectives: [
          { description: "Create an Application Load Balancer with health checks", completed: true, service: "ELB" },
          { description: "Configure Auto Scaling group with scaling policies", completed: true, service: "Auto Scaling" },
          { description: "Set up RDS Multi-AZ deployment", completed: true, service: "RDS" }
        ]
      };
    } else if (portfolio.challengeProgressId) {
      const progressData = await prisma.challengeProgress.findUnique({
        where: { id: portfolio.challengeProgressId },
        select: { solution: true },
      });

      if (progressData?.solution) {
        const solution = progressData.solution as {
          auditScore?: number;
          auditPassed?: boolean;
          proficiencyTest?: {
            score: number;
            summary: string;
            strengths: string[];
            areasForImprovement: string[];
          };
          cliObjectives?: {
            objectives: Array<{ description: string; completed: boolean; service: string; points: number }>;
            totalPoints: number;
            earnedPoints: number;
          };
        };

        auditScore = solution.auditScore ?? null;
        auditPassed = solution.auditPassed ?? false;

        if (solution.proficiencyTest) {
          proficiencyTest = {
            score: solution.proficiencyTest.score,
            summary: solution.proficiencyTest.summary || "",
            strengths: solution.proficiencyTest.strengths || [],
            areasForImprovement: solution.proficiencyTest.areasForImprovement || [],
          };
        }

        if (solution.cliObjectives?.objectives) {
          const objectives = solution.cliObjectives.objectives;
          cliObjectives = {
            completedCount: objectives.filter(o => o.completed).length,
            totalCount: objectives.length,
            earnedPoints: solution.cliObjectives.earnedPoints || 0,
            totalPoints: solution.cliObjectives.totalPoints || 0,
            objectives: objectives.map(o => ({
              description: o.description,
              completed: o.completed,
              service: o.service,
            })),
          };
        }
      }
    }

    // Prepare PDF data - pass raw diagram data directly
    const pdfData: PortfolioPDFData = {
      title: portfolio.title,
      companyName: portfolio.companyName || "Unknown Company",
      industry: portfolio.industry || "Technology",
      businessUseCase: portfolio.businessUseCase || "",
      problemStatement: portfolio.problemStatement || "",
      solutionSummary: portfolio.solutionSummary || "",
      awsServices: portfolio.awsServices || [],
      keyDecisions: portfolio.keyDecisions || [],
      complianceAchieved: portfolio.complianceAchieved || [],
      challengeScore: portfolio.challengeScore,
      maxScore: portfolio.maxScore,
      completionTimeMinutes: portfolio.completionTimeMinutes,
      createdAt: portfolio.createdAt.toISOString(),
      architectureDiagram: portfolio.architectureDiagram,
      // Stage completion data
      auditScore,
      auditPassed,
      proficiencyTest,
      cliObjectives,
    };

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      React.createElement(PortfolioPDF, { data: pdfData })
    );

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${portfolio.title.replace(/[^a-zA-Z0-9]/g, "-")}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
