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

interface PitchDeckSlide {
  badge: string;
  title: string;
  subtitle: string;
  content1: string;
  content2: string;
  content3: string;
  footer: string;
}

interface PitchDeckData {
  authorName: string;
  date: string;
  slides: PitchDeckSlide[];
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
  technicalHighlights: string[];
  createdAt: Date;
  isExample: boolean;
  profileId: string | null;
  architectureDiagram: { nodes: DiagramNode[]; edges: DiagramEdge[] } | null;
  pitchDeck: PitchDeckData | null;
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
        "technicalHighlights",
        "createdAt",
        "isExample",
        "profileId",
        "architectureDiagram",
        "pitchDeck"
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

    // For example portfolios, add example technical highlights if not in DB
    let technicalHighlights = portfolio.technicalHighlights || [];
    if (portfolio.isExample && technicalHighlights.length === 0) {
      technicalHighlights = [
        "Implemented multi-AZ Application Load Balancer with custom health checks and connection draining for zero-downtime deployments",
        "Configured Auto Scaling groups with target tracking policies based on CPU utilization and request count metrics",
        "Deployed RDS PostgreSQL with Multi-AZ standby, automated backups, and encryption at rest using AWS KMS",
        "Established VPC architecture with public/private subnet separation and NAT Gateway for secure outbound traffic",
        "Integrated AWS WAF with CloudFront distribution to protect against common web exploits and DDoS attacks"
      ];
    }
    
    // Prepare PDF data
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
      technicalHighlights,
      createdAt: portfolio.createdAt.toISOString(),
      architectureDiagram: portfolio.architectureDiagram,
      pitchDeck: portfolio.pitchDeck,
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
