/**
 * Team/Cohort Types
 * 
 * Unified types for team functionality across the application.
 * Backend uses "Team" terminology, UI can brand as "Cohort" where appropriate.
 */

// ============================================
// API Response Types (what /api/team returns)
// ============================================

/**
 * Academy user info as returned in team member data
 */
export interface TeamMemberUser {
  id: string;
  name: string | null;
  email: string;
  username: string | null;
}

/**
 * Team member as returned from API
 */
export interface TeamMemberResponse {
  id: string;
  role: TeamRole;
  pointsContributed: number;
  challengesCompleted: number;
  joinedAt: string;
  academyUser: TeamMemberUser | null;
}

/**
 * Team invite as returned from API
 */
export interface TeamInviteResponse {
  id: string;
  email: string | null;
  code: string;
  role: TeamRole;
  expiresAt: string;
  createdAt: string;
}

/**
 * Full team data as returned from GET /api/team
 */
export interface TeamResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  visibility: TeamVisibility;
  maxMembers: number;
  totalPoints: number;
  level: number;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  myRole: TeamRole;
  memberCount: number;
  activeChallenges: number;
  // Nested data
  members: TeamMemberResponse[];
  invites: TeamInviteResponse[];
}

/**
 * Simplified team for lists (e.g., cohort challenges section)
 */
export interface TeamSummary {
  id: string;
  name: string;
  memberCount: number;
  activeChallenges: number;
}

// ============================================
// Team Activity Types
// ============================================

export type TeamActivityType = 
  | "challenge_completed"
  | "scenario_started"
  | "scenario_completed"
  | "member_joined"
  | "member_left"
  | "badge_earned"
  | "level_up"
  | "points_earned";

export interface TeamActivityResponse {
  id: string;
  teamId: string;
  academyUserId: string | null;
  activityType: TeamActivityType;
  pointsEarned: number;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  // Joined user info
  user?: TeamMemberUser | null;
}

// ============================================
// Team Challenge Attempt Types
// ============================================

export interface TeamChallengeAttemptResponse {
  id: string;
  teamId: string;
  scenarioId: string;
  status: TeamChallengeStatus;
  startedAt: string;
  completedAt: string | null;
  totalPoints: number;
  contributions: TeamContributions;
  discussion: TeamDiscussionMessage[];
  // Joined scenario info
  scenario?: {
    id: string;
    title: string;
    description: string;
    difficulty: string;
  };
}

export type TeamChallengeStatus = "in_progress" | "completed" | "abandoned";

export interface TeamContributions {
  [academyUserId: string]: {
    points: number;
    challenges: number;
    timeMinutes: number;
  };
}

export interface TeamDiscussionMessage {
  academyUserId: string;
  displayName: string;
  message: string;
  timestamp: string;
}

// ============================================
// Team Stats Types
// ============================================

export interface TeamStatsResponse {
  teamId: string;
  totalPoints: number;
  level: number;
  memberCount: number;
  challengesCompleted: number;
  challengesInProgress: number;
  averageScore: number;
  topContributors: Array<{
    academyUserId: string;
    displayName: string;
    points: number;
    challengesCompleted: number;
  }>;
  recentActivity: TeamActivityResponse[];
}

// ============================================
// Enums & Constants
// ============================================

export type TeamRole = "owner" | "admin" | "member";
export type TeamVisibility = "private" | "tenant" | "public";

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export const TEAM_VISIBILITY_LABELS: Record<TeamVisibility, string> = {
  private: "Private",
  tenant: "Organization",
  public: "Public",
};
