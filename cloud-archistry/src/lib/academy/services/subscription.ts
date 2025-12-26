/**
 * Subscription & Feature Access Service
 * Handles tier checks and feature gating
 * 
 * Beta Model:
 * - Learner: Individual learners, can join cohorts when invited
 * - Tutor: Can create/manage cohorts, invite learners, has all learner features
 */

export type SubscriptionTier = "free" | "learner" | "tutor" | "pro" | "team";

export interface TierFeatures {
  canStartChallenges: boolean;
  hasAiAccess: boolean;
  hasNeo4jAccess: boolean;
  hasTeamAccess: boolean;
  canCreateCohorts: boolean;
  canManageCohorts: boolean;
  canCreateCustomScenarios: boolean;
  canExportReports: boolean;
  hasApiAccess: boolean;
}

export interface TeamLimits {
  maxTeams: number;  // -1 = unlimited
  maxMembersPerTeam: number;
  canInviteMembers: boolean;
  canTransferOwnership: boolean;
}

/**
 * Get features available for a subscription tier
 */
export function getTierFeatures(tier: SubscriptionTier): TierFeatures {
  switch (tier) {
    case "free":
      return {
        canStartChallenges: false,
        hasAiAccess: false,
        hasNeo4jAccess: false,
        hasTeamAccess: false,
        canCreateCohorts: false,
        canManageCohorts: false,
        canCreateCustomScenarios: false,
        canExportReports: false,
        hasApiAccess: false,
      };
    case "learner":
      // Learners can do challenges, use AI, join cohorts (but not create them)
      return {
        canStartChallenges: true,
        hasAiAccess: true,
        hasNeo4jAccess: false,
        hasTeamAccess: true, // Can JOIN cohorts when invited
        canCreateCohorts: false,
        canManageCohorts: false,
        canCreateCustomScenarios: false,
        canExportReports: false,
        hasApiAccess: false,
      };
    case "tutor":
      // Tutors have all learner features + can create/manage cohorts
      return {
        canStartChallenges: true,
        hasAiAccess: true,
        hasNeo4jAccess: true,
        hasTeamAccess: true,
        canCreateCohorts: true,
        canManageCohorts: true,
        canCreateCustomScenarios: true,
        canExportReports: true,
        hasApiAccess: true,
      };
    case "pro":
      // Legacy - maps to tutor features
      return {
        canStartChallenges: true,
        hasAiAccess: true,
        hasNeo4jAccess: true,
        hasTeamAccess: true,
        canCreateCohorts: true,
        canManageCohorts: true,
        canCreateCustomScenarios: true,
        canExportReports: true,
        hasApiAccess: true,
      };
    case "team":
      // Legacy - maps to tutor features
      return {
        canStartChallenges: true,
        hasAiAccess: true,
        hasNeo4jAccess: true,
        hasTeamAccess: true,
        canCreateCohorts: true,
        canManageCohorts: true,
        canCreateCustomScenarios: true,
        canExportReports: true,
        hasApiAccess: true,
      };
    default:
      return getTierFeatures("free");
  }
}

/**
 * Check if a user can perform a specific action
 */
export function canPerformAction(
  tier: SubscriptionTier,
  action: keyof TierFeatures
): boolean {
  const features = getTierFeatures(tier);
  return features[action];
}

/**
 * Get upgrade message for a blocked feature
 */
export function getUpgradeMessage(action: keyof TierFeatures): {
  title: string;
  description: string;
  requiredTier: SubscriptionTier;
} {
  switch (action) {
    case "canStartChallenges":
      return {
        title: "Upgrade to Start Challenges",
        description: "Start your learning journey with unlimited challenges, AI coaching, and progress tracking.",
        requiredTier: "learner",
      };
    case "hasAiAccess":
      return {
        title: "Upgrade for AI Coaching",
        description: "Get personalized AI feedback on your solutions and real-time coaching.",
        requiredTier: "learner",
      };
    case "hasNeo4jAccess":
      return {
        title: "Upgrade for Knowledge Graph",
        description: "Access the Neo4j knowledge graph for advanced AWS service relationships and insights.",
        requiredTier: "pro",
      };
    case "canCreateCustomScenarios":
      return {
        title: "Upgrade for Custom Scenarios",
        description: "Create your own scenarios tailored to your learning goals.",
        requiredTier: "pro",
      };
    case "hasTeamAccess":
      return {
        title: "Join as a Learner",
        description: "Register as a Learner to join cohorts and participate in team challenges.",
        requiredTier: "learner",
      };
    case "canCreateCohorts":
      return {
        title: "Register as a Tutor",
        description: "Tutors can create cohorts, invite learners, and track team progress.",
        requiredTier: "tutor",
      };
    case "canManageCohorts":
      return {
        title: "Register as a Tutor",
        description: "Tutors can manage cohort members, send invites, and view analytics.",
        requiredTier: "tutor",
      };
    default:
      return {
        title: "Upgrade Required",
        description: "This feature requires a paid subscription.",
        requiredTier: "learner",
      };
  }
}

/**
 * Get team limits for a subscription tier
 */
export function getTeamLimits(tier: SubscriptionTier): TeamLimits {
  switch (tier) {
    case "free":
      return {
        maxTeams: 0,
        maxMembersPerTeam: 0,
        canInviteMembers: false,
        canTransferOwnership: false,
      };
    case "learner":
      // Learners can join teams but not create them
      return {
        maxTeams: 0,
        maxMembersPerTeam: 0,
        canInviteMembers: false,
        canTransferOwnership: false,
      };
    case "tutor":
      // Tutors can create and manage cohorts
      return {
        maxTeams: 5,
        maxMembersPerTeam: 25,
        canInviteMembers: true,
        canTransferOwnership: true,
      };
    case "pro":
      // Pro has same limits as tutor
      return {
        maxTeams: 10,
        maxMembersPerTeam: 50,
        canInviteMembers: true,
        canTransferOwnership: true,
      };
    case "team":
      // Team/Bootcamp tier has unlimited teams
      return {
        maxTeams: -1,  // unlimited
        maxMembersPerTeam: 100,
        canInviteMembers: true,
        canTransferOwnership: true,
      };
    default:
      return getTeamLimits("free");
  }
}

/**
 * Tier display info
 */
export const TIER_INFO: Record<SubscriptionTier, { name: string; color: string; price: string }> = {
  free: { name: "Free Trial", color: "text-muted-foreground", price: "14 days" },
  learner: { name: "Learner", color: "text-cyan-400", price: "£29/mo" },
  tutor: { name: "Tutor", color: "text-purple-400", price: "£79/mo" },
  pro: { name: "Pro", color: "text-purple-400", price: "£79/mo" },
  team: { name: "Bootcamp", color: "text-amber-400", price: "Custom" },
};
