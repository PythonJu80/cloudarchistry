/**
 * Academy User Profile Service
 * Handles user profiles, progress, and gamification
 */

import prisma from "@/lib/db";
import { calculateLevel } from "../types";
import type { UserProfile, UserSettings, DifficultyLevel } from "../types";

/**
 * Get or create an academy profile for a user
 */
export async function getOrCreateProfile(
  userId: string,
  tenantId: string
): Promise<UserProfile> {
  let profile = await prisma.academyUserProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    profile = await prisma.academyUserProfile.create({
      data: {
        userId,
        tenantId,
        skillLevel: "intermediate",
      },
    });
  }

  return transformProfile(profile);
}

/**
 * Get a profile by ID
 */
export async function getProfileById(profileId: string): Promise<UserProfile | null> {
  const profile = await prisma.academyUserProfile.findUnique({
    where: { id: profileId },
  });

  return profile ? transformProfile(profile) : null;
}

/**
 * Get a profile by user ID
 */
export async function getProfileByUserId(userId: string): Promise<UserProfile | null> {
  const profile = await prisma.academyUserProfile.findUnique({
    where: { userId },
  });

  return profile ? transformProfile(profile) : null;
}

/**
 * Update profile settings
 */
export async function updateProfile(
  profileId: string,
  data: {
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
    skillLevel?: DifficultyLevel;
    preferredIndustries?: string[];
    preferredDifficulty?: DifficultyLevel;
    settings?: Partial<UserSettings>;
  }
): Promise<UserProfile> {
  const current = await prisma.academyUserProfile.findUnique({
    where: { id: profileId },
  });

  if (!current) {
    throw new Error("Profile not found");
  }

  const profile = await prisma.academyUserProfile.update({
    where: { id: profileId },
    data: {
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
      bio: data.bio,
      skillLevel: data.skillLevel,
      preferredIndustries: data.preferredIndustries,
      preferredDifficulty: data.preferredDifficulty,
      settings: data.settings
        ? { ...(current.settings as object), ...data.settings }
        : undefined,
    },
  });

  return transformProfile(profile);
}

/**
 * Add XP and handle level ups
 */
export async function addXp(
  profileId: string,
  xpAmount: number,
  _source?: string // For future audit logging
): Promise<{ profile: UserProfile; leveledUp: boolean; newLevel?: number }> {
  const current = await prisma.academyUserProfile.findUnique({
    where: { id: profileId },
  });

  if (!current) {
    throw new Error("Profile not found");
  }

  const oldLevel = current.level;
  const { level: newLevel, xpInLevel } = calculateLevel(
    current.totalPoints + xpAmount // Using totalPoints as cumulative XP
  );

  const profile = await prisma.academyUserProfile.update({
    where: { id: profileId },
    data: {
      xp: xpInLevel,
      level: newLevel,
      totalPoints: { increment: xpAmount },
    },
  });

  const leveledUp = newLevel > oldLevel;

  // Create activity if leveled up
  if (leveledUp) {
    await prisma.academyActivity.create({
      data: {
        profileId,
        tenantId: current.tenantId,
        type: "level_up",
        data: {
          level: newLevel,
          previousLevel: oldLevel,
        },
        visibility: "tenant",
      },
    });
  }

  return {
    profile: transformProfile(profile),
    leveledUp,
    newLevel: leveledUp ? newLevel : undefined,
  };
}

/**
 * Update streak
 */
export async function updateStreak(profileId: string): Promise<{
  currentStreak: number;
  isNewStreak: boolean;
  milestoneReached?: number;
}> {
  const profile = await prisma.academyUserProfile.findUnique({
    where: { id: profileId },
  });

  if (!profile) {
    throw new Error("Profile not found");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActivity = profile.lastActivityDate;
  let newStreak = profile.currentStreak;
  let isNewStreak = false;

  if (!lastActivity) {
    // First activity
    newStreak = 1;
    isNewStreak = true;
  } else {
    const lastDate = new Date(lastActivity);
    lastDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor(
      (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 0) {
      // Same day, no change
    } else if (daysDiff === 1) {
      // Consecutive day
      newStreak = profile.currentStreak + 1;
      isNewStreak = true;
    } else {
      // Streak broken
      newStreak = 1;
      isNewStreak = true;
    }
  }

  const longestStreak = Math.max(profile.longestStreak, newStreak);

  await prisma.academyUserProfile.update({
    where: { id: profileId },
    data: {
      currentStreak: newStreak,
      longestStreak,
      lastActivityDate: today,
    },
  });

  // Check for streak milestones
  const milestones = [7, 14, 30, 60, 100, 365];
  const milestoneReached = milestones.find(
    (m) => newStreak === m && profile.currentStreak < m
  );

  if (milestoneReached) {
    await prisma.academyActivity.create({
      data: {
        profileId,
        tenantId: profile.tenantId,
        type: "streak_milestone",
        data: { streak: milestoneReached },
        visibility: "tenant",
      },
    });
  }

  return {
    currentStreak: newStreak,
    isNewStreak,
    milestoneReached,
  };
}

/**
 * Increment stats
 */
export async function incrementStats(
  profileId: string,
  stats: {
    challengesCompleted?: number;
    scenariosCompleted?: number;
    locationsVisited?: number;
    totalTimeMinutes?: number;
    totalPoints?: number;
  }
): Promise<void> {
  await prisma.academyUserProfile.update({
    where: { id: profileId },
    data: {
      challengesCompleted: stats.challengesCompleted
        ? { increment: stats.challengesCompleted }
        : undefined,
      scenariosCompleted: stats.scenariosCompleted
        ? { increment: stats.scenariosCompleted }
        : undefined,
      locationsVisited: stats.locationsVisited
        ? { increment: stats.locationsVisited }
        : undefined,
      totalTimeMinutes: stats.totalTimeMinutes
        ? { increment: stats.totalTimeMinutes }
        : undefined,
      totalPoints: stats.totalPoints
        ? { increment: stats.totalPoints }
        : undefined,
    },
  });
}

/**
 * Get user's team memberships
 * @param academyUserId - The AcademyUser ID (not the legacy userId)
 */
export async function getUserTeams(academyUserId: string) {
  const memberships = await prisma.academyTeamMember.findMany({
    where: { academyUserId },
    include: {
      team: {
        include: {
          _count: {
            select: { 
              members: true,
              attempts: true,
            },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return memberships.map((m) => ({
    id: m.team.id,
    name: m.team.name,
    slug: m.team.slug,
    description: m.team.description,
    avatarUrl: m.team.avatarUrl,
    visibility: m.team.visibility,
    maxMembers: m.team.maxMembers,
    totalPoints: m.team.totalPoints,
    level: m.team.level,
    createdAt: m.team.createdAt,
    // User's role in this team
    myRole: m.role,
    pointsContributed: m.pointsContributed,
    challengesCompleted: m.challengesCompleted,
    joinedAt: m.joinedAt,
    // Counts
    memberCount: m.team._count.members,
    activeChallenges: m.team._count.attempts,
  }));
}

// Transform Prisma model to typed interface
function transformProfile(profile: {
  id: string;
  userId: string;
  tenantId: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  skillLevel: string;
  preferredIndustries: unknown;
  preferredDifficulty: string | null;
  totalPoints: number;
  level: number;
  xp: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date | null;
  achievements: unknown;
  challengesCompleted: number;
  scenariosCompleted: number;
  locationsVisited: number;
  totalTimeMinutes: number;
  settings: unknown;
}): UserProfile {
  return {
    id: profile.id,
    userId: profile.userId,
    tenantId: profile.tenantId,
    displayName: profile.displayName ?? undefined,
    avatarUrl: profile.avatarUrl ?? undefined,
    bio: profile.bio ?? undefined,
    skillLevel: profile.skillLevel as DifficultyLevel,
    preferredIndustries: (profile.preferredIndustries as string[]) || [],
    preferredDifficulty: profile.preferredDifficulty as DifficultyLevel | undefined,
    totalPoints: profile.totalPoints,
    level: profile.level,
    xp: profile.xp,
    currentStreak: profile.currentStreak,
    longestStreak: profile.longestStreak,
    lastActivityDate: profile.lastActivityDate ?? undefined,
    achievements: (profile.achievements as { id: string; earnedAt: string }[]) || [],
    challengesCompleted: profile.challengesCompleted,
    scenariosCompleted: profile.scenariosCompleted,
    locationsVisited: profile.locationsVisited,
    totalTimeMinutes: profile.totalTimeMinutes,
    settings: (profile.settings as UserSettings) || {},
  };
}
