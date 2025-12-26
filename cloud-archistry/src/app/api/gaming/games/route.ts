import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Default game types to seed if none exist
const DEFAULT_GAME_TYPES = [
  {
    slug: "quiz_battle",
    name: "Quiz Battle",
    description: "Head-to-head AWS knowledge quiz. Race to buzz in first and answer correctly. 10 questions, fastest brain wins!",
    icon: "⚔️",
    minPlayers: 2,
    maxPlayers: 2,
    isTeamGame: false,
    hasRanked: true,
    hasCasual: true,
    hasPractice: true,
    isActive: true,
    isBeta: false,
    comingSoon: false,
  },
  {
    slug: "survival",
    name: "Survival Mode",
    description: "How long can you last? Endless AWS questions with 3 lives. Compete for the highest score on the global leaderboard.",
    icon: "🔥",
    minPlayers: 1,
    maxPlayers: 1,
    isTeamGame: false,
    hasRanked: false,
    hasCasual: true,
    hasPractice: false,
    isActive: true,
    isBeta: false,
    comingSoon: false,
  },
  {
    slug: "architect_arena",
    name: "Architect Arena",
    description: "Design AWS architectures under pressure. AI judges your solution on best practices, cost, and scalability.",
    icon: "🏗️",
    minPlayers: 1,
    maxPlayers: 2,
    isTeamGame: false,
    hasRanked: true,
    hasCasual: true,
    hasPractice: true,
    isActive: false,
    isBeta: true,
    comingSoon: true,
  },
  {
    slug: "service_scramble",
    name: "Service Scramble",
    description: "Speed matching game! Drag AWS services to their correct use cases. Fastest time wins.",
    icon: "🧩",
    minPlayers: 1,
    maxPlayers: 2,
    isTeamGame: false,
    hasRanked: true,
    hasCasual: true,
    hasPractice: true,
    isActive: false,
    isBeta: false,
    comingSoon: true,
  },
  {
    slug: "bomb_defusal",
    name: "Bomb Defusal",
    description: "Co-op challenge! Work together to fix broken architectures before time runs out. Communication is key!",
    icon: "💣",
    minPlayers: 2,
    maxPlayers: 4,
    isTeamGame: true,
    hasRanked: false,
    hasCasual: true,
    hasPractice: true,
    isActive: false,
    isBeta: false,
    comingSoon: true,
  },
];

/**
 * GET /api/gaming/games - Get all available game types
 */
export async function GET() {
  try {
    // Check if game types exist, seed if not
    const existingCount = await prisma.gameType.count();
    
    if (existingCount === 0) {
      // Seed default game types
      await prisma.gameType.createMany({
        data: DEFAULT_GAME_TYPES,
      });
    }

    // Fetch all game types with stats
    const gameTypes = await prisma.gameType.findMany({
      orderBy: [
        { isActive: "desc" },
        { comingSoon: "asc" },
        { name: "asc" },
      ],
    });

    // Get online player counts (simplified - just count recent matches)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const gamesWithStats = await Promise.all(
      gameTypes.map(async (game) => {
        // Count active matches for this game type
        const activeMatches = await prisma.gameMatch.count({
          where: {
            gameTypeId: game.id,
            status: "active",
          },
        });

        // Estimate online players (2 per active match for 1v1 games)
        const estimatedOnline = activeMatches * game.maxPlayers;

        return {
          ...game,
          activePlayers: estimatedOnline,
          activeMatches,
        };
      })
    );

    return NextResponse.json({ games: gamesWithStats });
  } catch (error) {
    console.error("Error fetching game types:", error);
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}
