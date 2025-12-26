/**
 * Game Stats Tracking Utilities
 * Centralized functions for updating GameProfile stats after game completion
 */

import { prisma } from "@/lib/db";
import { calculateEloChange } from "./elo";

interface GameResult {
  userId: string;
  won: boolean;
  lost: boolean;
  draw?: boolean;
  pointsEarned: number;
  opponentId?: string;
  opponentElo?: number;
}

/**
 * Update GameProfile stats after a game completes
 * Handles wins, losses, draws, points, streaks, and ELO
 */
export async function updateGameStats(result: GameResult): Promise<void> {
  const { userId, won, lost, draw = false, pointsEarned, opponentId, opponentElo } = result;

  // Get current profile
  const profile = await prisma.gameProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    // Create profile if it doesn't exist
    await prisma.gameProfile.create({
      data: {
        userId,
        totalGames: 1,
        totalWins: won ? 1 : 0,
        totalLosses: lost ? 1 : 0,
        totalDraws: draw ? 1 : 0,
        totalPoints: pointsEarned,
        winStreak: won ? 1 : 0,
        bestWinStreak: won ? 1 : 0,
      },
    });
    return;
  }

  // Calculate new streak
  const newStreak = won ? profile.winStreak + 1 : 0;
  const newBestStreak = Math.max(profile.bestWinStreak, newStreak);

  // Calculate ELO change if opponent provided
  let eloChange = 0;
  if (opponentId && opponentElo !== undefined) {
    eloChange = calculateEloChange(
      profile.elo,
      opponentElo,
      won,
      draw,
      profile.totalGames
    );
  }

  const newElo = profile.elo + eloChange;

  // Update profile
  await prisma.gameProfile.update({
    where: { userId },
    data: {
      totalGames: { increment: 1 },
      totalWins: won ? { increment: 1 } : undefined,
      totalLosses: lost ? { increment: 1 } : undefined,
      totalDraws: draw ? { increment: 1 } : undefined,
      totalPoints: { increment: pointsEarned },
      weeklyPoints: { increment: pointsEarned },
      seasonPoints: { increment: pointsEarned },
      winStreak: newStreak,
      bestWinStreak: newBestStreak,
      elo: newElo,
      peakElo: Math.max(profile.peakElo, newElo),
      lastPlayedAt: new Date(),
    },
  });

  // UNIFIED PROGRESSION: Also add gaming points to main AcademyUserProfile
  const academyUser = await prisma.academyUser.findUnique({
    where: { id: userId },
    select: { profile: { select: { id: true } } },
  });

  if (academyUser?.profile?.id) {
    await prisma.academyUserProfile.update({
      where: { id: academyUser.profile.id },
      data: {
        totalPoints: { increment: pointsEarned },
        xp: { increment: Math.floor(pointsEarned / 10) },
        lastActivityDate: new Date(),
      },
    });
  }
}

/**
 * Update game-specific stats (stored in JSON fields)
 */
export async function updateGameModeStats(
  userId: string,
  gameMode: string,
  stats: Record<string, unknown>
): Promise<void> {
  const profile = await prisma.gameProfile.findUnique({
    where: { userId },
  });

  if (!profile) return;

  // Determine which JSON field to update
  const fieldMap: Record<string, string> = {
    quiz_battle: "quizBattleStats",
    hot_streak: "hotStreakStats",
    service_slots: "serviceSlotsStats",
    cloud_tycoon: "cloudTycoonStats",
    speed_deploy: "speedDeployStats",
    architect_arena: "architectArenaStats",
    ticking_bomb: "tickingBombStats",
    bug_bounty: "bugBountyStats",
  };

  const field = fieldMap[gameMode];
  if (!field) return;

  // Get current stats
  const currentStats = (profile[field as keyof typeof profile] as Record<string, unknown>) || {};

  // Merge new stats with existing
  const updatedStats = { ...currentStats, ...stats };

  // Update profile
  await prisma.gameProfile.update({
    where: { userId },
    data: {
      [field]: updatedStats,
    },
  });
}

/**
 * Record a solo game completion (no opponent)
 */
export async function recordSoloGame(
  userId: string,
  gameMode: string,
  pointsEarned: number,
  won: boolean = true
): Promise<void> {
  await updateGameStats({
    userId,
    won,
    lost: !won,
    pointsEarned,
  });
}

/**
 * Record a 1v1 match completion with ELO calculation
 */
export async function recordMatchResult(
  player1Id: string,
  player2Id: string,
  player1Won: boolean,
  player1Points: number,
  player2Points: number,
  isDraw: boolean = false
): Promise<void> {
  // Get both profiles for ELO calculation
  const [profile1, profile2] = await Promise.all([
    prisma.gameProfile.findUnique({ where: { userId: player1Id } }),
    prisma.gameProfile.findUnique({ where: { userId: player2Id } }),
  ]);

  const elo1 = profile1?.elo || 1500;
  const elo2 = profile2?.elo || 1500;

  // Update player 1
  await updateGameStats({
    userId: player1Id,
    won: player1Won && !isDraw,
    lost: !player1Won && !isDraw,
    draw: isDraw,
    pointsEarned: player1Points,
    opponentId: player2Id,
    opponentElo: elo2,
  });

  // Update player 2
  await updateGameStats({
    userId: player2Id,
    won: !player1Won && !isDraw,
    lost: player1Won && !isDraw,
    draw: isDraw,
    pointsEarned: player2Points,
    opponentId: player1Id,
    opponentElo: elo1,
  });
}
