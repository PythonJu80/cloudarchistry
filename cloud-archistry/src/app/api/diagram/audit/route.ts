import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { 
  auditDiagram, 
  getPlacementRulesForAudit,
  type DiagramAuditResult,
} from "@/lib/aws-placement-rules";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || process.env.NEXT_PUBLIC_LEARNING_AGENT_URL || "https://cloudarchistry.com";

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
 * Audits the user's diagram using the placement rules engine.
 * Can optionally call Learning Agent for additional AI-powered feedback.
 * 
 * SINGLE SOURCE OF TRUTH: Uses aws-placement-rules.ts for validation,
 * ensuring consistency between real-time UI tips and audit results.
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

    // =========================================
    // LOCAL AUDIT using aws-placement-rules.ts
    // This is the SINGLE SOURCE OF TRUTH
    // =========================================
    
    // Convert nodes to the format expected by auditDiagram
    const placementNodes = nodes.map((n) => ({
      id: n.id,
      type: n.type,
      data: {
        serviceId: n.type, // Use type as serviceId for now
        label: n.label,
      },
      parentId: n.parentId,
    }));
    
    // Convert connections to edges format
    const edges = connections.map((c, idx) => ({
      id: `edge-${idx}`,
      source: c.from,
      target: c.to,
    }));
    
    // Run local audit with placement rules
    const localAudit = auditDiagram(placementNodes, edges);
    
    // Get placement rules for reference (can be sent to Learning Agent if needed)
    const placementRules = getPlacementRulesForAudit();
    
    // =========================================
    // OPTIONAL: Call Learning Agent for AI feedback
    // Uses the SAME rules from aws-placement-rules.ts
    // =========================================
    let aiEnhancedFeedback: string | null = null;
    
    try {
      const response = await fetch(`${LEARNING_AGENT_URL}/api/learning/audit-diagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: nodes.map((n) => ({
            id: n.id,
            type: n.type,
            label: n.label,
            config: n.config,
            parent_id: n.parentId,
            position: n.position,
          })),
          connections: connections.map((c) => ({
            from: c.from,
            to: c.to,
          })),
          challenge_id: challengeId,
          challenge_title: challengeTitle,
          challenge_brief: challengeBrief,
          expected_services: [],
          // Send the CORRECT rules from aws-placement-rules.ts
          available_services: placementRules.services.map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            scope: s.scope,
            can_connect_to: s.canConnectTo,
            must_be_inside: s.mustBeInside,
            is_container: s.isContainer,
            is_vpc_resource: s.isVpcResource,
            eni_info: s.eniInfo,
          })),
          // Also send edge types for relationship validation
          edge_types: {
            attachment: placementRules.edgeTypes.attachment,
            endpoint: placementRules.edgeTypes.endpoint,
            data_flow: placementRules.edgeTypes.dataFlow,
          },
          session_id: sessionId,
          // Include local audit results for context
          local_audit: {
            score: localAudit.score,
            max_score: localAudit.maxScore,
            placement_issues: localAudit.placementIssues,
            connection_issues: localAudit.connectionIssues,
          },
        }),
      });

      if (response.ok) {
        const aiResult = await response.json();
        aiEnhancedFeedback = aiResult.feedback;
      }
    } catch (aiError) {
      console.warn("Learning Agent unavailable, using local audit only:", aiError);
    }

    // =========================================
    // Return combined result
    // Local audit is authoritative, AI feedback is supplementary
    // =========================================
    return NextResponse.json({
      success: true,
      audit: {
        score: localAudit.score,
        maxScore: localAudit.maxScore,
        isComplete: localAudit.missing.length === 0,
        isValid: localAudit.isValid,
        correct: localAudit.correct,
        incorrect: localAudit.incorrect,
        missing: localAudit.missing,
        suggestions: localAudit.suggestions,
        placementIssues: localAudit.placementIssues,
        connectionIssues: localAudit.connectionIssues,
        patterns: localAudit.patterns,
        feedback: aiEnhancedFeedback || generateLocalFeedback(localAudit),
      },
      sessionId: sessionId,
      // Include rule source for transparency
      ruleSource: "aws-placement-rules.ts",
    });

  } catch (error) {
    console.error("Diagram audit error:", error);
    return NextResponse.json(
      { error: "Failed to audit diagram", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Generate feedback text from local audit results
 */
function generateLocalFeedback(audit: DiagramAuditResult): string {
  const parts: string[] = [];
  
  // Score summary
  const percentage = audit.maxScore > 0 ? Math.round((audit.score / audit.maxScore) * 100) : 0;
  parts.push(`Score: ${audit.score}/${audit.maxScore} (${percentage}%)`);
  
  // Placement issues
  if (audit.placementIssues.length > 0) {
    parts.push(`\n\n⚠️ Placement Issues (${audit.placementIssues.length}):`);
    audit.placementIssues.slice(0, 3).forEach(issue => {
      parts.push(`- ${issue.issue}`);
    });
    if (audit.placementIssues.length > 3) {
      parts.push(`- ...and ${audit.placementIssues.length - 3} more`);
    }
  }
  
  // Connection issues
  if (audit.connectionIssues.length > 0) {
    parts.push(`\n\n🔗 Connection Issues (${audit.connectionIssues.length}):`);
    audit.connectionIssues.slice(0, 3).forEach(issue => {
      parts.push(`- ${issue.issue}`);
    });
  }
  
  // Patterns detected
  if (audit.patterns.ha.detected) {
    parts.push(`\n\n✅ ${audit.patterns.ha.message}`);
  }
  if (audit.patterns.security.detected) {
    parts.push(`\n\n✅ ${audit.patterns.security.message}`);
  }
  
  // Suggestions
  if (audit.suggestions.length > 0) {
    parts.push(`\n\n💡 Suggestions:`);
    audit.suggestions.forEach(s => parts.push(`- ${s}`));
  }
  
  return parts.join("");
}
