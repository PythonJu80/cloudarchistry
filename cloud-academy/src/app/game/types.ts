// Shared types for game system
// These types are used across all game modes

export interface Player {
  id: string;
  name: string | null;
  username: string | null;
  email: string;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: string;
}

export interface TeamMember {
  id: string;
  role: string;
  academyUser: {
    id: string;
    name: string | null;
    email: string;
    username: string | null;
  } | null;
}

export interface Team {
  id: string;
  name: string;
  members: TeamMember[];
}

export interface Match {
  id: string;
  matchCode: string;
  status: string;
  player1Score: number;
  player2Score: number;
  player1: { id: string; name: string | null; username: string | null };
  player2: { id: string; name: string | null; username: string | null };
  createdAt: string;
}

export interface GameProfile {
  elo: number;
  rank: string;
  rankTier: number;
  rankFormatted: string;
  rankColor: string;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  winStreak: number;
  bestWinStreak: number;
  winRate: number;
  totalPoints: number;
  countryCode: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  elo: number;
  rankName: string;
  rankColor: string;
  winRate: number;
  isCurrentUser: boolean;
}

export interface MatchData {
  id: string;
  matchCode: string;
  player1: Player;
  player2: Player;
  player1Score: number;
  player2Score: number;
  status: string;
  matchType: string;
  currentQuestion: number;
  totalQuestions: number;
  chatMessages: ChatMessage[];
  myPlayerId: string;
  isPlayer1: boolean;
  myScore: number;
  opponentScore: number;
  opponent: Player;
  winnerId: string | null;
  matchState: {
    currentQuestionBuzz?: string;
    questions?: unknown[];
  };
}

export interface QuestionData {
  questionNumber: number;
  totalQuestions: number;
  question: string;
  options: string[];
  topic: string;
  buzzedBy: string | null;
  canBuzz: boolean;
  complete?: boolean;
  // Pass-back state
  passedToMe?: boolean;
  passedToOpponent?: boolean;
  opponentAnswer?: number | null;
  canAnswer?: boolean;
  canPass?: boolean;
}

export interface AnswerResult {
  correct: boolean;
  points: number;
  correctAnswer?: number;
  explanation?: string | null;
  yourAnswer?: number;
  opponentAnswer?: number | null;
  passedTo?: string;
  passed?: boolean;
}

// Recap data for completed matches
export interface QuestionRecap {
  questionNumber: number;
  question: string;
  options: string[];
  correctAnswer: number;
  correctAnswerText: string;
  topic: string;
  explanation: string | null;
  player1Answer: number | null;
  player2Answer: number | null;
  buzzedBy: string | null;
  passedTo: string | null;
  answeredCorrectly: string | null;
  pointsAwarded: number;
}

// Game mode definitions
export type GameModeSlug =
  | "quiz_battle"
  | "lightning_round"
  | "hot_streak"
  | "sniper_quiz"
  | "service_slots"
  | "speed_deploy"
  | "cloud_tycoon"
  | "architecture_poker"
  | "ticking_bomb"
  | "tournament"
  | "daily_jackpot"
  | "architect_arena";

export interface GameMode {
  slug: GameModeSlug;
  title: string;
  icon: string;
  description: string;
  players: string;
  gradient: string;
  isLive: boolean;
  comingSoon: boolean;
}

// All available game modes
export const GAME_MODES: GameMode[] = [
  {
    slug: "quiz_battle",
    title: "Quiz Battle",
    icon: "⚔️",
    description: "Head-to-head AWS knowledge showdown. Race to buzz in first!",
    players: "1v1",
    gradient: "linear-gradient(135deg, #ef4444, #f97316)",
    isLive: true,
    comingSoon: false,
  },
  {
    slug: "service_slots",
    title: "Service Slots",
    icon: "🎰",
    description: "Spin to match 3 AWS services that work together. Jackpot!",
    players: "Solo",
    gradient: "linear-gradient(135deg, #fbbf24, #f59e0b)",
    isLive: true,
    comingSoon: false,
  },
  {
    slug: "lightning_round",
    title: "Lightning Round",
    icon: "⚡",
    description: "60 seconds. Answer as many as you can. Pure speed!",
    players: "Solo",
    gradient: "linear-gradient(135deg, #facc15, #eab308)",
    isLive: true,
    comingSoon: false,
  },
  {
    slug: "hot_streak",
    title: "Hot Streak",
    icon: "🔥",
    description: "Build your streak! Multipliers increase with each correct answer.",
    players: "Solo",
    gradient: "linear-gradient(135deg, #f97316, #dc2626)",
    isLive: true,
    comingSoon: false,
  },
  {
    slug: "sniper_quiz",
    title: "Sniper Quiz",
    icon: "🎯",
    description: "One shot, high stakes. Big points or nothing. No pressure...",
    players: "Solo",
    gradient: "linear-gradient(135deg, #10b981, #059669)",
    isLive: true,
    comingSoon: false,
  },
  {
    slug: "speed_deploy",
    title: "Speed Deploy",
    icon: "🏎️",
    description: "Race to deploy the correct architecture faster than your opponent!",
    players: "1v1",
    gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    isLive: true,
    comingSoon: false,
  },
  {
    slug: "cloud_tycoon",
    title: "Cloud Tycoon",
    icon: "💰",
    description: "Build & manage infrastructure. Earn virtual millions.",
    players: "Solo",
    gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
    isLive: false,
    comingSoon: true,
  },
  {
    slug: "architecture_poker",
    title: "Architecture Poker",
    icon: "🃏",
    description: "Build the best 'hand' of services for each scenario.",
    players: "2-6",
    gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    isLive: false,
    comingSoon: true,
  },
  {
    slug: "ticking_bomb",
    title: "Ticking Bomb",
    icon: "💣",
    description: "Hot potato! Answer before time runs out or pass the bomb!",
    players: "2-8 Party",
    gradient: "linear-gradient(135deg, #ef4444, #b91c1c)",
    isLive: false,
    comingSoon: true,
  },
  {
    slug: "tournament",
    title: "Tournament",
    icon: "🏆",
    description: "Bracket-style elimination. Fight your way to the championship!",
    players: "8-64",
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    isLive: false,
    comingSoon: true,
  },
  {
    slug: "daily_jackpot",
    title: "Daily Jackpot",
    icon: "🎲",
    description: "One chance per day. Massive prize pool. Don't miss out!",
    players: "Global",
    gradient: "linear-gradient(135deg, #ec4899, #db2777)",
    isLive: false,
    comingSoon: true,
  },
  {
    slug: "architect_arena",
    title: "Architect Arena",
    icon: "🏗️",
    description: "Design architectures under pressure. AI judges your solution.",
    players: "1v1",
    gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
    isLive: false,
    comingSoon: true,
  },
];
