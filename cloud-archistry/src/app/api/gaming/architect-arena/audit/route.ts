import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";
import { prisma } from "@/lib/db";
import { recordSoloGame, updateGameModeStats } from "@/lib/gaming/stats";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || process.env.NEXT_PUBLIC_LEARNING_AGENT_URL || "https://cloudarchistry.com";

/**
 * POST /api/gaming/architect-arena/audit - Submit puzzle for AI audit
 * 
 * Calls /api/learning/audit-diagram on the Learning Agent.
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

    // Call the Architect Arena specific audit endpoint (judges PLACEMENT, not presence)
    const response = await fetch(
      `${LEARNING_AGENT_URL}/api/architect-arena/audit`,
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
      console.error("[Architect Arena Audit] Learning agent error:", errorText);
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

      // Update Architect Arena specific stats
      const profile = await prisma.gameProfile.findUnique({
        where: { userId: academyUser.id },
      });

      const currentStats = (profile?.architectArenaStats as Record<string, unknown>) || {};
      const gamesPlayed = ((currentStats.gamesPlayed as number) || 0) + 1;
      const gamesWon = ((currentStats.gamesWon as number) || 0) + (won ? 1 : 0);
      const highScore = Math.max((currentStats.highScore as number) || 0, score);
      const totalScore = ((currentStats.totalScore as number) || 0) + score;

      await updateGameModeStats(academyUser.id, "architect_arena", {
        gamesPlayed,
        gamesWon,
        highScore,
        totalScore,
        avgScore: Math.round(totalScore / gamesPlayed),
        lastScore: score,
        lastPlayed: new Date().toISOString(),
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
