import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";

const LEARNING_AGENT_URL = process.env.NEXT_PUBLIC_LEARNING_AGENT_URL!;

/**
 * POST /api/versus/[matchCode]/speed-deploy - Handle Speed Deploy match actions
 * Actions: start (generate brief), submit (submit architecture)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { matchCode: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { matchCode } = params;
    const body = await req.json();
    const { action, services, timeRemaining } = body;

    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true, name: true, username: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const match = await prisma.versusMatch.findUnique({
      where: { matchCode },
      include: {
        player1: { select: { id: true, name: true, username: true } },
        player2: { select: { id: true, name: true, username: true } },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (match.matchType !== "speed_deploy") {
      return NextResponse.json({ error: "This is not a Speed Deploy match" }, { status: 400 });
    }

    const isPlayer1 = match.player1Id === academyUser.id;
    const isPlayer2 = match.player2Id === academyUser.id;

    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ error: "You are not part of this match" }, { status: 403 });
    }

    switch (action) {
      case "start": {
        // Only player 1 can start the game
        if (!isPlayer1) {
          return NextResponse.json({ error: "Only the challenger can start the game" }, { status: 403 });
        }

        if (match.status !== "active") {
          return NextResponse.json({ error: "Match is not active" }, { status: 400 });
        }

        const matchState = match.matchState as Record<string, unknown> || {};
        if (matchState.brief) {
          return NextResponse.json({ error: "Game already started" }, { status: 400 });
        }

        // Get user's profile for certification and skill level
        const profile = await prisma.academyUserProfile.findFirst({
          where: { academyUserId: academyUser.id },
          select: { 
            skillLevel: true,
            targetCertification: true,
          },
        });

        // Get API key for AI generation
        const aiConfig = await getAiConfigForRequest(session.user.academyProfileId || session.user.id);
        if (!aiConfig) {
          return NextResponse.json(
            { error: "Please configure your OpenAI API key in Settings" },
            { status: 402 }
          );
        }

        // Generate brief from learning agent
        const briefResponse = await fetch(`${LEARNING_AGENT_URL}/api/speed-deploy/brief/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_level: profile?.skillLevel || "intermediate",
            cert_code: profile?.targetCertification || "SAA-C03",
            difficulty: null, // Random
            openai_api_key: aiConfig.key,
            preferred_model: aiConfig.preferredModel,
          }),
        });

        if (!briefResponse.ok) {
          const error = await briefResponse.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.detail || "Failed to generate brief" },
            { status: briefResponse.status }
          );
        }

        const brief = await briefResponse.json();

        // Update match with brief
        const updated = await prisma.versusMatch.update({
          where: { matchCode },
          data: {
            matchState: {
              ...matchState,
              brief,
              player1Services: null,
              player2Services: null,
              player1Submitted: false,
              player2Submitted: false,
              player1TimeRemaining: null,
              player2TimeRemaining: null,
            },
          },
        });

        return NextResponse.json({ match: updated, brief });
      }

      case "submit": {
        // Submit architecture
        if (match.status !== "active") {
          return NextResponse.json({ error: "Match is not active" }, { status: 400 });
        }

        const submitMatchState = match.matchState as {
          brief?: {
            id: string;
            client_name: string;
            industry: string;
            requirements: Array<{ category: string; description: string; priority: string }>;
            available_services: string[];
            optimal_solution: string[];
            acceptable_solutions: string[][];
            trap_services?: Array<{ service_id: string; why_suboptimal: string; penalty: number }>;
            time_limit: number;
            difficulty: string;
            max_score: number;
            learning_point?: string;
          };
          player1Services?: string[] | null;
          player2Services?: string[] | null;
          player1Submitted?: boolean;
          player2Submitted?: boolean;
          player1TimeRemaining?: number | null;
          player2TimeRemaining?: number | null;
          player1Score?: number;
          player2Score?: number;
        } || {};

        if (!submitMatchState.brief) {
          return NextResponse.json({ error: "Game not started yet" }, { status: 400 });
        }

        // Check if already submitted
        if (isPlayer1 && submitMatchState.player1Submitted) {
          return NextResponse.json({ error: "You already submitted" }, { status: 400 });
        }
        if (isPlayer2 && submitMatchState.player2Submitted) {
          return NextResponse.json({ error: "You already submitted" }, { status: 400 });
        }

        // Record submission
        const newMatchState = { ...submitMatchState };
        if (isPlayer1) {
          newMatchState.player1Services = services || [];
          newMatchState.player1Submitted = true;
          newMatchState.player1TimeRemaining = timeRemaining || 0;
        } else {
          newMatchState.player2Services = services || [];
          newMatchState.player2Submitted = true;
          newMatchState.player2TimeRemaining = timeRemaining || 0;
        }

        // Check if both players have submitted
        const bothSubmitted = newMatchState.player1Submitted && newMatchState.player2Submitted;

        if (bothSubmitted) {
          // Validate both submissions and calculate scores
          const brief = submitMatchState.brief;
          
          // Validate player 1
          const p1Response = await fetch(`${LEARNING_AGENT_URL}/api/speed-deploy/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              brief_id: brief.id,
              client_name: brief.client_name,
              industry: brief.industry,
              requirements: brief.requirements,
              available_services: brief.available_services,
              optimal_solution: brief.optimal_solution,
              acceptable_solutions: brief.acceptable_solutions,
              trap_services: brief.trap_services || [],
              time_limit: brief.time_limit,
              difficulty: brief.difficulty,
              max_score: brief.max_score,
              learning_point: brief.learning_point || "",
              submitted_services: newMatchState.player1Services || [],
              time_remaining: newMatchState.player1TimeRemaining || 0,
            }),
          });
          const p1Result = await p1Response.json();

          // Validate player 2
          const p2Response = await fetch(`${LEARNING_AGENT_URL}/api/speed-deploy/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              brief_id: brief.id,
              client_name: brief.client_name,
              industry: brief.industry,
              requirements: brief.requirements,
              available_services: brief.available_services,
              optimal_solution: brief.optimal_solution,
              acceptable_solutions: brief.acceptable_solutions,
              trap_services: brief.trap_services || [],
              time_limit: brief.time_limit,
              difficulty: brief.difficulty,
              max_score: brief.max_score,
              learning_point: brief.learning_point || "",
              submitted_services: newMatchState.player2Services || [],
              time_remaining: newMatchState.player2TimeRemaining || 0,
            }),
          });
          const p2Result = await p2Response.json();

          const player1Score = p1Result.score || 0;
          const player2Score = p2Result.score || 0;

          // Determine winner
          let winnerId = null;
          if (player1Score > player2Score) {
            winnerId = match.player1Id;
          } else if (player2Score > player1Score) {
            winnerId = match.player2Id;
          }

          // Update match with final scores
          const finalMatch = await prisma.versusMatch.update({
            where: { matchCode },
            data: {
              player1Score,
              player2Score,
              status: "completed",
              completedAt: new Date(),
              winnerId,
              matchState: {
                ...newMatchState,
                player1Result: p1Result,
                player2Result: p2Result,
              },
            },
          });

          return NextResponse.json({ 
            match: finalMatch, 
            completed: true,
            myResult: isPlayer1 ? p1Result : p2Result,
          });
        }

        // Only one player submitted - update and wait
        const updated = await prisma.versusMatch.update({
          where: { matchCode },
          data: {
            matchState: newMatchState,
          },
        });

        return NextResponse.json({ 
          match: updated, 
          submitted: true,
          waitingForOpponent: true,
        });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Speed Deploy match error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
