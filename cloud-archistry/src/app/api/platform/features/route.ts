import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/platform/features
 * Returns all platform features (games, learning tools, challenges) for use in cohort program generation.
 * The learning agent calls this to get accurate, up-to-date feature descriptions.
 */
export async function GET() {
  try {
    // Fetch active games from database
    const gameTypes = await prisma.gameType.findMany({
      where: {
        isActive: true,
      },
      select: {
        slug: true,
        name: true,
        description: true,
        icon: true,
        minPlayers: true,
        maxPlayers: true,
        isTeamGame: true,
      },
      orderBy: { name: "asc" },
    });

    // Format games with tutor-focused descriptions
    const games = gameTypes.map((game) => ({
      id: game.slug,
      name: game.name,
      icon: game.icon,
      description: game.description,
      playerMode: game.minPlayers === game.maxPlayers 
        ? (game.minPlayers === 1 ? "Solo" : `${game.minPlayers} players`)
        : `${game.minPlayers}-${game.maxPlayers} players`,
      isTeamGame: game.isTeamGame,
      route: `/game/modes/${game.slug.replace(/_/g, "-")}`,
      tutorTip: getTutorTip(game.slug),
    }));

    // Learning tools (these are hardcoded as they're core platform features)
    const learningTools = [
      {
        id: "flashcards",
        name: "Flashcards",
        icon: "🃏",
        description: "Spaced repetition flashcards for AWS services and concepts. Cards adapt to learner performance.",
        route: "/learn/flashcards",
        tutorTip: "Great for warm-ups (5-10 min). Race through cards as a group, or assign for independent review.",
      },
      {
        id: "quiz",
        name: "Topic Quizzes",
        icon: "📝",
        description: "Quick quizzes focused on specific AWS topics with instant feedback and explanations.",
        route: "/learn/quiz",
        tutorTip: "Perfect for end-of-session knowledge checks. Run as a group and discuss answers together.",
      },
      {
        id: "practice_exam",
        name: "Practice Exams",
        icon: "📋",
        description: "Full-length certification practice exams with detailed explanations for each answer.",
        route: "/learn/exams",
        tutorTip: "Use for exam prep weeks. Review missed questions together to identify knowledge gaps.",
      },
      {
        id: "study_notes",
        name: "Study Notes",
        icon: "📚",
        description: "Comprehensive notes on AWS services, organized by certification domain.",
        route: "/learn/notes",
        tutorTip: "Reference during explanations. Assign specific sections for pre-reading before sessions.",
      },
      {
        id: "cli_simulator",
        name: "CLI Simulator",
        icon: "💻",
        description: "Safe sandbox to practice AWS CLI commands without needing a real AWS account.",
        route: "/learn/cli",
        tutorTip: "Demo CLI commands here instead of real AWS. Learners can practice safely without cost concerns.",
      },
    ];

    // Challenges
    const challenges = [
      {
        id: "world_map",
        name: "World Map Challenge",
        icon: "🌍",
        description: "Interactive game where learners place AWS services on a world map, learning regions and global infrastructure.",
        route: "/world",
        tutorTip: "Excellent for teaching AWS global infrastructure. Demo it, then let learners compete for high scores.",
      },
      {
        id: "architecture_drawing",
        name: "Architecture Drawing",
        icon: "🏗️",
        description: "Draw AWS architecture diagrams to solve real-world scenarios. AI provides feedback on designs.",
        route: "/challenges",
        tutorTip: "Do one together as a group, then assign similar challenges as homework. Great for capstone projects.",
      },
    ];

    return NextResponse.json({
      games,
      learningTools,
      challenges,
      // Combined list for easy iteration
      allFeatures: [...games, ...learningTools, ...challenges],
    });
  } catch (error) {
    console.error("Error fetching platform features:", error);
    return NextResponse.json(
      { error: "Failed to fetch platform features" },
      { status: 500 }
    );
  }
}

// Tutor tips for each game type
function getTutorTip(slug: string): string {
  const tips: Record<string, string> = {
    quiz_battle: "Great for competitive review. Pair learners up for 1v1 battles, or run a class tournament.",
    service_slots: "Fun warm-up activity. Teaches service relationships - which services work together.",
    hot_streak: "Motivating solo practice. Challenge learners to beat their personal best streak.",
    service_sniper: "Quick service recognition game. Good for beginners learning service names.",
    speed_deploy: "Architecture practice under pressure. Use for intermediate/advanced learners.",
    cloud_tycoon: "Strategic thinking about cost and architecture. Good for teaching cost optimization.",
    ticking_bomb: "PERFECT FOR GROUP SESSIONS - whole class plays together! Great energy and engagement.",
    bug_bounty: "Architecture review game. Learners find issues in diagrams - teaches best practices.",
    architect_arena: "Advanced architecture challenges with AI judging. Use for capstone prep.",
    survival: "Endurance quiz mode. See who can last longest - great for review sessions.",
  };
  return tips[slug] || "Interactive learning activity for the group.";
}
