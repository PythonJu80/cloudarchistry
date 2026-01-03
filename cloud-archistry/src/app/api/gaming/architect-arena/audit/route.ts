import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";
import { prisma } from "@/lib/db";
import { recordSoloGame } from "@/lib/gaming/stats";

// Use Drawing Agent for Architect Arena (has local AWS service knowledge base)
const DRAWING_AGENT_URL = process.env.DRAWING_AGENT_URL || process.env.NEXT_PUBLIC_DRAWING_AGENT_URL || "http://localhost:6098";

/**
 * POST /api/gaming/architect-arena/audit - Submit puzzle for AI audit
 * 
 * Calls /api/architect-arena/audit on the Drawing Agent.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const body = await req.json();

    // Get AI config (optional - will use .env if not provided)
    const aiConfig = await getAiConfigForRequest(profileId);

    console.log(`[Architect Arena Audit] Auditing puzzle: ${body.puzzle_title}`);
    console.log(`[Architect Arena Audit] Nodes received: ${body.nodes?.length || 0}`);
    console.log(`[Architect Arena Audit] Connections received: ${body.connections?.length || 0}`);
    console.log(`[Architect Arena Audit] Drawing Agent URL: ${DRAWING_AGENT_URL}`);

    // Call the Drawing Agent audit endpoint (judges PLACEMENT, not presence)
    const response = await fetch(
      `${DRAWING_AGENT_URL}/api/architect-arena/audit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzle_title: body.puzzle_title,
          puzzle_brief: body.puzzle_brief,
          expected_hierarchy: body.expected_hierarchy || {},
          expected_connections: body.expected_connections || [],
          nodes: body.nodes || [],
          connections: body.connections || [],
          openai_api_key: aiConfig?.key,
          preferred_model: aiConfig?.preferredModel,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Architect Arena Audit] Drawing agent error:", errorText);
      return NextResponse.json(
        { error: "Failed to audit puzzle" },
        { status: 500 }
      );
    }

    const result = await response.json();

    console.log(`[Architect Arena Audit] Score: ${result.score}`);

    // Record game completion stats
    const academyUser = await prisma.academyUser.findFirst({
      where: { 
        profile: { id: profileId }
      },
      select: { id: true },
    });

    if (academyUser) {
      const score = result.score || 0;
      const targetScore = body.target_score || 100;
      const won = score >= targetScore * 0.6; // 60% or higher is a win

      // Record game completion
      await recordSoloGame(
        academyUser.id,
        "architect_arena",
        score,
        won
      );

      // Update Architect Arena specific stats (uses arenaStats field in schema)
      const profile = await prisma.gameProfile.findUnique({
        where: { userId: academyUser.id },
      });

      const currentStats = (profile?.arenaStats as Record<string, unknown>) || {};
      const gamesPlayed = ((currentStats.gamesPlayed as number) || 0) + 1;
      const gamesWon = ((currentStats.gamesWon as number) || 0) + (won ? 1 : 0);
      const highScore = Math.max((currentStats.highScore as number) || 0, score);
      const totalScore = ((currentStats.totalScore as number) || 0) + score;

      // Update using arenaStats field (not architectArenaStats)
      await prisma.gameProfile.update({
        where: { userId: academyUser.id },
        data: {
          arenaStats: {
            gamesPlayed,
            gamesWon,
            highScore,
            totalScore,
            avgScore: Math.round(totalScore / gamesPlayed),
            lastScore: score,
            lastPlayed: new Date().toISOString(),
          },
        },
      });
    }

    return NextResponse.json({
      score: result.score || 0,
      correct: result.correct || [],
      missing: result.missing || [],
      suggestions: result.suggestions || [],
      feedback: result.feedback || "",
    });
  } catch (error) {
    console.error("[Architect Arena Audit] Error:", error);
    return NextResponse.json(
      { error: "Failed to audit puzzle." },
      { status: 500 }
    );
  }
}
