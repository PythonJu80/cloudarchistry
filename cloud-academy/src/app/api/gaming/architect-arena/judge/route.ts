import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { DiagramData } from "@/components/diagram";

interface JudgeRequestBody {
  puzzleId: string;
  puzzleTitle?: string;
  puzzleBrief?: string;
  targetScore?: number;
  allowedServices?: string[];
  diagram: DiagramData;
  targetDiagram?: DiagramData | null;
  lastAudit?: unknown;
  previousScore?: number;
}

interface ComparisonResult {
  missingServices: string[];
  extraServices: string[];
  missingConnections: string[];
  extraConnections: string[];
}

const PERFECT_THRESHOLD = 85;
const CLOSE_THRESHOLD = 60;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: JudgeRequestBody = await request.json();
    if (!body?.diagram || !body.diagram.nodes?.length) {
      return NextResponse.json(
        { error: "Diagram data is required" },
        { status: 400 }
      );
    }

    const auditResult = await auditDiagram(request, {
      nodes: body.diagram.nodes,
      edges: body.diagram.edges ?? [],
      puzzleId: body.puzzleId,
      puzzleTitle: body.puzzleTitle,
      puzzleBrief: body.puzzleBrief,
      allowedServices: body.allowedServices,
    });

    const score = auditResult.score ?? 0;
    const verdict = score >= PERFECT_THRESHOLD ? "perfect" : score >= CLOSE_THRESHOLD ? "close" : "retry";
    const message =
      verdict === "perfect"
        ? "Beautiful work. The Learning Agent considers this solution production-ready."
        : verdict === "close"
        ? "You're close! Tweak placements and connections to tighten the architecture."
        : "Audit flagged gaps in the solution. Review the feedback and iterate.";

    const comparison = diffDiagrams(body.diagram, body.targetDiagram);
    const responsePayload = {
      verdict,
      message,
      audit: auditResult,
      comparison,
      scoreDelta: typeof body.previousScore === "number" ? score - body.previousScore : undefined,
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("Architect Arena judge error:", error);
    return NextResponse.json(
      { error: "Failed to judge diagram" },
      { status: 500 }
    );
  }
}

async function auditDiagram(
  request: NextRequest,
  params: {
    nodes: DiagramData["nodes"];
    edges: DiagramData["edges"];
    puzzleId?: string;
    puzzleTitle?: string;
    puzzleBrief?: string;
    allowedServices?: string[];
  }
) {
  const payload = {
    nodes: params.nodes?.map((node) => ({
      id: node.id,
      type: node.data?.serviceId || node.type,
      label: node.data?.label,
      config: node.data?.config,
      parentId: node.parentId,
      position: node.position,
    })) ?? [],
    connections:
      params.edges?.map((edge) => ({
        from: edge.source,
        to: edge.target,
      })) ?? [],
    challengeId: params.puzzleId,
    challengeTitle: params.puzzleTitle,
    challengeBrief: params.puzzleBrief,
    expectedServices: params.allowedServices ?? [],
  };

  const origin = request.nextUrl?.origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const auditResponse = await fetch(`${origin}/api/diagram/audit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
    },
    body: JSON.stringify(payload),
  });

  if (!auditResponse.ok) {
    const errorPayload = await auditResponse.json().catch(() => ({}));
    throw new Error(errorPayload?.error || "Audit endpoint failed");
  }

  const auditJson = await auditResponse.json();
  return auditJson.audit ?? auditJson;
}

function diffDiagrams(userDiagram?: DiagramData | null, targetDiagram?: DiagramData | null): ComparisonResult {
  const userServices = new Set<string>();
  const targetServices = new Set<string>();

  userDiagram?.nodes?.forEach((node) => {
    const key = normalizeService(node.data?.serviceId, node.data?.label, node.type);
    if (key) userServices.add(key);
  });

  targetDiagram?.nodes?.forEach((node) => {
    const key = normalizeService(node.data?.serviceId, node.data?.label, node.type);
    if (key) targetServices.add(key);
  });

  const missingServices = [...targetServices].filter((service) => !userServices.has(service));
  const extraServices = [...userServices].filter((service) => !targetServices.has(service));

  const userEdges = new Set<string>(
    (userDiagram?.edges ?? []).map((edge) => `${edge.source}->${edge.target}`)
  );
  const targetEdges = new Set<string>(
    (targetDiagram?.edges ?? []).map((edge) => `${edge.source}->${edge.target}`)
  );

  const missingConnections = [...targetEdges].filter((edge) => !userEdges.has(edge));
  const extraConnections = [...userEdges].filter((edge) => !targetEdges.has(edge));

  return {
    missingServices,
    extraServices,
    missingConnections,
    extraConnections,
  };
}

function normalizeService(
  serviceId?: string,
  label?: string,
  fallbackType?: string
): string | null {
  if (serviceId) return serviceId.toLowerCase();
  if (label) return label.toLowerCase();
  if (fallbackType) return fallbackType.toLowerCase();
  return null;
}
