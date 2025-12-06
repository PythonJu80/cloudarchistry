import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";

const LEARNING_AGENT_URL = process.env.NEXT_PUBLIC_LEARNING_AGENT_URL || "http://localhost:1027";

interface DiagramNode {
  id: string;
  type: string;
  label?: string;
  config?: Record<string, unknown>;
  parentId?: string;  // Which container this node is inside
  position?: { x: number; y: number };
}

interface DiagramConnection {
  from: string;
  to: string;
}

interface AuditRequest {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  challengeId?: string;
  challengeTitle?: string;
  challengeBrief?: string;
  sessionId?: string;
}

/**
 * POST /api/diagram/audit
 * 
 * Sends the user's diagram to the Learning Agent for auditing.
 * Returns a score and feedback.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to audit diagrams" },
        { status: 401 }
      );
    }

    const body: AuditRequest = await request.json();
    const { nodes, connections, challengeId, challengeTitle, challengeBrief, sessionId } = body;

    if (!nodes || nodes.length === 0) {
      return NextResponse.json(
        { error: "No diagram nodes provided" },
        { status: 400 }
      );
    }

    // Get AI config (API key + model)
    const aiConfig = await getAiConfigForRequest(session.user.academyProfileId);
    
    if (!aiConfig?.key) {
      return NextResponse.json(
        { error: "Please configure your OpenAI API key in Settings" },
        { status: 402 }
      );
    }

    // Call the dedicated audit-diagram endpoint
    const response = await fetch(`${LEARNING_AGENT_URL}/api/learning/audit-diagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type,
          label: n.label,
          config: n.config,
          parent_id: n.parentId,  // Send parent for hierarchy analysis
          position: n.position,
        })),
        connections: connections.map((c) => ({
          from: c.from,
          to: c.to,
        })),
        challenge_id: challengeId,
        challenge_title: challengeTitle,
        challenge_brief: challengeBrief,
        expected_services: [], // Could be passed from challenge data
        session_id: sessionId,
        openai_api_key: aiConfig.key,
        preferred_model: aiConfig.preferredModel,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Learning Agent audit error:", errorText);
      return NextResponse.json(
        { error: "Failed to audit diagram" },
        { status: 500 }
      );
    }

    // The endpoint returns structured JSON directly
    const result = await response.json();

    return NextResponse.json({
      success: true,
      audit: {
        score: result.score,
        correct: result.correct,
        missing: result.missing,
        suggestions: result.suggestions,
        feedback: result.feedback,
      },
      sessionId: result.session_id,
    });

  } catch (error) {
    console.error("Diagram audit error:", error);
    return NextResponse.json(
      { error: "Failed to audit diagram", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
