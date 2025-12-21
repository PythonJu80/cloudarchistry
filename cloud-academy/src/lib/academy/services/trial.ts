/**
 * Trial Status Service
 * Handles 14-day free trial tracking and status checks
 */

export interface TrialStatus {
  isInTrial: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number;
  trialExpired: boolean;
  trialUsed: boolean;
}

/**
 * Calculate trial status from profile data
 */
export function getTrialStatus(
  trialEndsAt: Date | string | null,
  trialUsed: boolean = false
): TrialStatus {
  if (!trialEndsAt) {
    return {
      isInTrial: false,
      trialEndsAt: null,
      daysRemaining: 0,
      trialExpired: false,
      trialUsed,
    };
  }

  const endDate = typeof trialEndsAt === "string" ? new Date(trialEndsAt) : trialEndsAt;
  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const trialExpired = diffMs <= 0;

  return {
    isInTrial: !trialExpired && daysRemaining > 0,
    trialEndsAt: endDate,
    daysRemaining,
    trialExpired,
    trialUsed,
  };
}

/**
 * Check if user has active access (trial or paid subscription)
 */
export function hasActiveAccess(
  subscriptionTier: string,
  trialEndsAt: Date | string | null,
  subscriptionExpiresAt: Date | string | null = null
): boolean {
  // Free tier always has limited access
  if (subscriptionTier === "free") {
    return false;
  }

  // Check if in active trial
  const trialStatus = getTrialStatus(trialEndsAt);
  if (trialStatus.isInTrial) {
    return true;
  }

  // Check if has paid subscription
  if (subscriptionExpiresAt) {
    const expiryDate = typeof subscriptionExpiresAt === "string" 
      ? new Date(subscriptionExpiresAt) 
      : subscriptionExpiresAt;
    return expiryDate.getTime() > Date.now();
  }

  // Trial expired and no paid subscription
  return false;
}

/**
 * Get display text for trial status
 */
export function getTrialDisplayText(trialStatus: TrialStatus): string {
  if (!trialStatus.trialEndsAt) {
    return "";
  }

  if (trialStatus.trialExpired) {
    return "Trial expired";
  }

  if (trialStatus.daysRemaining === 1) {
    return "1 day left in trial";
  }

  return `${trialStatus.daysRemaining} days left in trial`;
}

/**
 * Get urgency level for trial countdown
 */
export function getTrialUrgency(daysRemaining: number): "normal" | "warning" | "critical" {
  if (daysRemaining <= 2) return "critical";
  if (daysRemaining <= 5) return "warning";
  return "normal";
}
