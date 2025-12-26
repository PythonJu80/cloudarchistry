/**
 * CloudArchistry Type Definitions
 * These mirror the Prisma models but with proper TypeScript types for JSON fields
 */

// ============================================
// Location & Scenario Types
// ============================================

export interface Location {
  id: string;
  slug: string;
  name: string;
  company: string;
  industry: string;
  lat: number;
  lng: number;
  region?: string;
  country?: string;
  city?: string;
  icon: string;
  imageUrl?: string;
  difficulty: DifficultyLevel;
  description: string;
  compliance: string[];
  tags: string[];
  isLocked: boolean;
  unlockRequirements: UnlockRequirement[];
  totalAttempts: number;
  avgCompletionRate: number;
  isActive: boolean;
}

export type DifficultyLevel = "beginner" | "intermediate" | "advanced" | "expert";

export interface UnlockRequirement {
  type: "location" | "locations_completed" | "challenges_completed" | "points";
  id?: string;  // For specific location requirement
  count?: number;
  value?: number;
}

export interface Scenario {
  id: string;
  locationId: string;
  title: string;
  description: string;
  businessContext: string;
  difficulty: DifficultyLevel;
  technicalRequirements: string[];
  complianceRequirements: string[];
  constraints: string[];
  learningObjectives: string[];
  tags: string[];
  estimatedMinutes: number;
  maxPoints: number;
  version: number;
  targetLevel: DifficultyLevel;
  companyInfo?: CompanyInfo;
  isActive: boolean;
  challenges: Challenge[];
}

export interface Challenge {
  id: string;
  scenarioId: string;
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  orderIndex: number;
  points: number;
  bonusPoints: number;
  hints: string[];
  successCriteria: string[];
  awsServices: string[];
  solutionTemplate?: SolutionTemplate;
  evaluationRubric?: EvaluationRubric;
  estimatedMinutes: number;
  timeLimitMinutes?: number;
  prerequisiteChallengeIds: string[];
}

export interface CompanyInfo {
  name: string;
  industry: string;
  description: string;
  headquarters?: string;
  employeeCount?: string;
  revenue?: string;
  keyServices: string[];
  technologyStack: string[];
  complianceRequirements: string[];
  businessChallenges: string[];
  dataTypes: string[];
  trafficPatterns?: string;
  globalPresence?: string;
}

export interface SolutionTemplate {
  components: SolutionComponent[];
  connections: SolutionConnection[];
}

export interface SolutionComponent {
  id: string;
  type: string;  // EC2, RDS, S3, Lambda, etc.
  required: boolean;
  config?: Record<string, unknown>;
}

export interface SolutionConnection {
  from: string;
  to: string;
  type: string;  // vpc, internet, private, etc.
}

export interface EvaluationRubric {
  criteria: RubricCriterion[];
  passingScore: number;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
  weight: number;
}

// ============================================
// User & Progress Types
// ============================================

export interface UserProfile {
  id: string;
  userId: string;
  tenantId: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  skillLevel: DifficultyLevel;
  preferredIndustries: string[];
  preferredDifficulty?: DifficultyLevel;
  totalPoints: number;
  level: number;
  xp: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: Date;
  achievements: UserAchievement[];
  challengesCompleted: number;
  scenariosCompleted: number;
  locationsVisited: number;
  totalTimeMinutes: number;
  settings: UserSettings;
}

export interface UserAchievement {
  id: string;
  earnedAt: string;
}

export interface UserSettings {
  theme?: "light" | "dark" | "system";
  notifications?: {
    email?: boolean;
    push?: boolean;
    streakReminder?: boolean;
  };
  privacy?: {
    showOnLeaderboard?: boolean;
    showActivity?: boolean;
  };
}

export interface LocationProgress {
  id: string;
  profileId: string;
  locationId: string;
  status: LocationStatus;
  firstVisitedAt: Date;
  lastVisitedAt: Date;
  completedAt?: Date;
  totalPoints: number;
  challengesCompleted: number;
  totalChallenges: number;
  timeSpentMinutes: number;
  bestAttemptId?: string;
}

export type LocationStatus = "not_started" | "visited" | "in_progress" | "completed";

export interface ScenarioAttempt {
  id: string;
  profileId: string;
  scenarioId: string;
  tenantId: string;
  teamAttemptId?: string;
  status: AttemptStatus;
  startedAt: Date;
  lastActivityAt: Date;
  completedAt?: Date;
  pointsEarned: number;
  maxPoints: number;
  bonusPoints: number;
  activeTimeMinutes: number;
  chatHistory: ChatMessage[];
  metadata: AttemptMetadata;
  challengeProgress: ChallengeProgress[];
}

export type AttemptStatus = "in_progress" | "completed" | "abandoned" | "timed_out";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  challengeId?: string;
}

export interface AttemptMetadata {
  browser?: string;
  device?: string;
  startedFrom?: string;
}

export interface ChallengeProgress {
  id: string;
  attemptId: string;
  challengeId: string;
  status: ChallengeStatus;
  unlockedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  pointsEarned: number;
  bonusEarned: number;
  hintsUsed: number;
  attemptsCount: number;
  timeSpentMinutes: number;
  solution?: UserSolution;
  solutionNotes?: string;
  feedback?: ChallengeFeedback;
  evaluatedAt?: Date;
}

export type ChallengeStatus = "locked" | "available" | "in_progress" | "completed" | "skipped";

export interface UserSolution {
  architecture?: {
    nodes: unknown[];
    edges: unknown[];
  };
  answers?: Record<string, unknown>;
  notes?: string;
}

export interface ChallengeFeedback {
  score: number;
  maxScore: number;
  percentage: number;
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  detailedScores?: Record<string, number>;
}

// ============================================
// Team Types
// ============================================

export interface Team {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  avatarUrl?: string;
  visibility: TeamVisibility;
  maxMembers: number;
  totalPoints: number;
  level: number;
  settings: TeamSettings;
  createdBy: string;
  createdAt: Date;
  members: TeamMember[];
}

export type TeamVisibility = "private" | "tenant" | "public";

export interface TeamSettings {
  allowMemberInvites?: boolean;
  requireApproval?: boolean;
  defaultMemberRole?: TeamRole;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  pointsContributed: number;
  challengesCompleted: number;
  joinedAt: Date;
  // Joined from user
  displayName?: string;
  avatarUrl?: string;
}

export type TeamRole = "owner" | "admin" | "member";

export interface TeamInvite {
  id: string;
  teamId: string;
  email?: string;
  userId?: string;
  code: string;
  role: TeamRole;
  expiresAt: Date;
  usedAt?: Date;
  usedBy?: string;
  createdBy: string;
  createdAt: Date;
}

export interface TeamChallengeAttempt {
  id: string;
  teamId: string;
  scenarioId: string;
  tenantId: string;
  status: AttemptStatus;
  startedAt: Date;
  completedAt?: Date;
  totalPoints: number;
  contributions: TeamContributions;
  discussion: TeamDiscussionMessage[];
}

export interface TeamContributions {
  [userId: string]: {
    points: number;
    challenges: number;
    timeMinutes: number;
  };
}

export interface TeamDiscussionMessage {
  userId: string;
  displayName: string;
  message: string;
  timestamp: string;
}

// ============================================
// Leaderboard & Achievement Types
// ============================================

export interface LeaderboardEntry {
  id: string;
  scope: LeaderboardScope;
  scopeId?: string;
  period: LeaderboardPeriod;
  periodKey: string;
  entryType: "user" | "team";
  entryId: string;
  displayName: string;
  avatarUrl?: string;
  totalPoints: number;
  challengesCompleted: number;
  scenariosCompleted: number;
  locationsCompleted: number;
  averageScore: number;
  rank: number;
  previousRank?: number;
}

export type LeaderboardScope = "global" | "tenant" | "team" | "industry";
export type LeaderboardPeriod = "all_time" | "yearly" | "monthly" | "weekly" | "daily";

export interface Achievement {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  criteria: AchievementCriteria;
  pointsReward: number;
  xpReward: number;
  category: string;
  isSecret: boolean;
  isActive: boolean;
}

export type AchievementRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface AchievementCriteria {
  type: string;
  value?: number;
  industry?: string;
  startHour?: number;
  endHour?: number;
}

// ============================================
// Activity Feed Types
// ============================================

export interface Activity {
  id: string;
  profileId: string;
  tenantId: string;
  teamId?: string;
  type: ActivityType;
  data: ActivityData;
  visibility: ActivityVisibility;
  createdAt: Date;
  // Joined data
  displayName?: string;
  avatarUrl?: string;
}

export type ActivityType =
  | "challenge_completed"
  | "scenario_completed"
  | "achievement_earned"
  | "level_up"
  | "streak_milestone"
  | "team_joined"
  | "team_created"
  | "location_unlocked"
  | "leaderboard_rank_up";

export interface ActivityData {
  challengeId?: string;
  challengeTitle?: string;
  scenarioId?: string;
  scenarioTitle?: string;
  locationId?: string;
  locationName?: string;
  achievementId?: string;
  achievementName?: string;
  achievementIcon?: string;
  teamId?: string;
  teamName?: string;
  points?: number;
  level?: number;
  streak?: number;
  rank?: number;
  previousRank?: number;
}

export type ActivityVisibility = "private" | "team" | "tenant" | "public";

// ============================================
// XP & Level System
// ============================================

export const XP_PER_LEVEL = 1000;
export const XP_GROWTH_RATE = 1.2;  // Each level requires 20% more XP

export function calculateLevel(totalXp: number): { level: number; xpInLevel: number; xpForNextLevel: number } {
  let level = 1;
  let xpRequired = XP_PER_LEVEL;
  let xpRemaining = totalXp;
  
  while (xpRemaining >= xpRequired) {
    xpRemaining -= xpRequired;
    level++;
    xpRequired = Math.floor(XP_PER_LEVEL * Math.pow(XP_GROWTH_RATE, level - 1));
  }
  
  return {
    level,
    xpInLevel: xpRemaining,
    xpForNextLevel: xpRequired,
  };
}

export function calculateXpForLevel(level: number): number {
  if (level <= 1) return 0;
  let totalXp = 0;
  for (let i = 1; i < level; i++) {
    totalXp += Math.floor(XP_PER_LEVEL * Math.pow(XP_GROWTH_RATE, i - 1));
  }
  return totalXp;
}
