import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface Portfolio {
  id: string;
  title: string;
  companyName: string | null;
  industry: string | null;
  challengeScore: number;
  maxScore: number;
  awsServices: string[];
  isExample: boolean;
}

/**
 * GET /api/portfolio/[id]/thumbnail
 * 
 * Returns an SVG thumbnail for the portfolio
 * This is a simple server-rendered SVG that looks like a PDF preview
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
        "companyName",
        industry,
        "challengeScore",
        "maxScore",
        "awsServices",
        "isExample"
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
    const scorePercent = Math.round((portfolio.challengeScore / portfolio.maxScore) * 100);
    const services = (portfolio.awsServices || []).slice(0, 4);

    // Generate SVG thumbnail that looks like a mini PDF
    const svg = `
<svg width="200" height="260" viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f8fafc;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.1"/>
    </filter>
  </defs>
  
  <!-- Paper background -->
  <rect x="10" y="10" width="180" height="240" rx="4" fill="url(#bg)" filter="url(#shadow)" stroke="#e2e8f0" stroke-width="1"/>
  
  <!-- Purple header bar -->
  <rect x="10" y="10" width="180" height="4" rx="4" fill="#8b5cf6"/>
  
  <!-- Badge -->
  <rect x="20" y="24" width="80" height="14" rx="2" fill="#f3e8ff"/>
  <text x="24" y="34" font-family="system-ui, sans-serif" font-size="7" fill="#7c3aed" font-weight="600">AWS PORTFOLIO</text>
  
  <!-- Title -->
  <text x="20" y="56" font-family="system-ui, sans-serif" font-size="10" fill="#0f172a" font-weight="700">
    ${escapeXml(truncate(portfolio.title, 22))}
  </text>
  ${portfolio.title.length > 22 ? `<text x="20" y="68" font-family="system-ui, sans-serif" font-size="10" fill="#0f172a" font-weight="700">${escapeXml(truncate(portfolio.title.slice(22), 22))}</text>` : ''}
  
  <!-- Company -->
  <text x="20" y="${portfolio.title.length > 22 ? 82 : 72}" font-family="system-ui, sans-serif" font-size="8" fill="#64748b">
    ${escapeXml(portfolio.companyName || '')} • ${escapeXml(portfolio.industry || '')}
  </text>
  
  <!-- Score box -->
  <rect x="20" y="${portfolio.title.length > 22 ? 92 : 82}" width="50" height="35" rx="4" fill="#f8fafc"/>
  <text x="45" y="${portfolio.title.length > 22 ? 112 : 102}" font-family="system-ui, sans-serif" font-size="14" fill="#0f172a" font-weight="700" text-anchor="middle">${scorePercent}%</text>
  <text x="45" y="${portfolio.title.length > 22 ? 122 : 112}" font-family="system-ui, sans-serif" font-size="6" fill="#64748b" text-anchor="middle">SCORE</text>
  
  <!-- Points box -->
  <rect x="75" y="${portfolio.title.length > 22 ? 92 : 82}" width="50" height="35" rx="4" fill="#f8fafc"/>
  <text x="100" y="${portfolio.title.length > 22 ? 112 : 102}" font-family="system-ui, sans-serif" font-size="14" fill="#0f172a" font-weight="700" text-anchor="middle">${portfolio.challengeScore}</text>
  <text x="100" y="${portfolio.title.length > 22 ? 122 : 112}" font-family="system-ui, sans-serif" font-size="6" fill="#64748b" text-anchor="middle">POINTS</text>
  
  <!-- AWS Services section -->
  <text x="20" y="${portfolio.title.length > 22 ? 148 : 138}" font-family="system-ui, sans-serif" font-size="8" fill="#0f172a" font-weight="600">AWS Services</text>
  
  <!-- Service tags -->
  ${services.map((service, i) => `
    <rect x="${20 + (i % 2) * 80}" y="${(portfolio.title.length > 22 ? 154 : 144) + Math.floor(i / 2) * 18}" width="75" height="14" rx="2" fill="#fff7ed"/>
    <text x="${24 + (i % 2) * 80}" y="${(portfolio.title.length > 22 ? 164 : 154) + Math.floor(i / 2) * 18}" font-family="system-ui, sans-serif" font-size="7" fill="#c2410c">${escapeXml(truncate(service, 12))}</text>
  `).join('')}
  
  <!-- Footer line -->
  <line x1="20" y1="230" x2="180" y2="230" stroke="#e2e8f0" stroke-width="1"/>
  <text x="20" y="242" font-family="system-ui, sans-serif" font-size="6" fill="#94a3b8">Cloud Archistry Portfolio</text>
  
  ${portfolio.isExample ? `
  <!-- Example badge -->
  <rect x="130" y="14" width="50" height="14" rx="2" fill="#fef3c7"/>
  <text x="155" y="24" font-family="system-ui, sans-serif" font-size="7" fill="#b45309" font-weight="600" text-anchor="middle">EXAMPLE</text>
  ` : ''}
</svg>`;

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Thumbnail generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate thumbnail" },
      { status: 500 }
    );
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 2) + "..";
}
