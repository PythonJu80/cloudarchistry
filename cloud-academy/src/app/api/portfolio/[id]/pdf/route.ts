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
        "architectureDiagram"
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
