import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/gaming/badges - Get all badges, all users with their badges, and current user's badges
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user
    const currentUser = await prisma.academyUser.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true } } },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get all active badges
    const allBadges = await prisma.gameAchievement.findMany({
      where: { isActive: true },
      orderBy: [
        { category: "asc" },
        { rarity: "asc" },
      ],
    });

    // Get ALL users
    const allUsers = await prisma.academyUser.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        profile: { select: { avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Get ALL badge unlocks
    const allUnlocks = await prisma.gameAchievementUnlock.findMany({
      include: {
        achievement: true,
      },
      orderBy: { unlockedAt: "desc" },
    });

    // Group unlocks by user
    const unlocksByUser = new Map<string, typeof allUnlocks>();
    for (const unlock of allUnlocks) {
      const existing = unlocksByUser.get(unlock.userId) || [];
      existing.push(unlock);
      unlocksByUser.set(unlock.userId, existing);
    }

    // Build users list with their badges (NULL/empty if none)
    const usersWithBadges = allUsers.map((user) => {
      const userUnlocks = unlocksByUser.get(user.id) || [];
      const badges = userUnlocks.map((u) => ({
        id: u.achievement.id,
        slug: u.achievement.slug,
        name: u.achievement.name,
        icon: u.achievement.icon,
        rarity: u.achievement.rarity,
        unlockedAt: u.unlockedAt,
      }));

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        avatarUrl: user.profile?.avatarUrl || null,
        badgeCount: badges.length,
        badges: badges.length > 0 ? badges : null,
        isCurrentUser: user.id === currentUser.id,
      };
    });

    // Sort by badge count (descending), current user gets prominence
    usersWithBadges.sort((a, b) => {
      // Current user always at top if they have badges
      if (a.isCurrentUser && a.badgeCount > 0) return -1;
      if (b.isCurrentUser && b.badgeCount > 0) return 1;
      return b.badgeCount - a.badgeCount;
    });

    // Current user's unlocks
    const currentUserUnlocks = unlocksByUser.get(currentUser.id) || [];
    const unlockedMap = new Map(
      currentUserUnlocks.map((u) => [u.achievementId, u.unlockedAt])
    );

    // All badges with current user's unlock status
    const badges = allBadges.map((badge) => ({
      id: badge.id,
      slug: badge.slug,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      rarity: badge.rarity,
      category: badge.category,
      pointsReward: badge.pointsReward,
      titleReward: badge.titleReward,
      frameReward: badge.frameReward,
      isHidden: badge.isHidden,
      unlocked: unlockedMap.has(badge.id),
      unlockedAt: unlockedMap.get(badge.id) || null,
    }));

    // Stats for current user
    const totalBadges = allBadges.filter((b) => !b.isHidden).length;
    const unlockedCount = currentUserUnlocks.length;
    const recentUnlocks = currentUserUnlocks.slice(0, 5).map((u) => ({
      id: u.achievement.id,
      slug: u.achievement.slug,
      name: u.achievement.name,
      icon: u.achievement.icon,
      rarity: u.achievement.rarity,
      unlockedAt: u.unlockedAt,
    }));

    // Group by category
    const byCategory: Record<string, typeof badges> = {};
    for (const badge of badges) {
      if (!byCategory[badge.category]) {
        byCategory[badge.category] = [];
      }
      byCategory[badge.category].push(badge);
    }

    // Count by rarity for current user
    const byRarity = {
      common: currentUserUnlocks.filter((u) => u.achievement.rarity === "common").length,
      uncommon: currentUserUnlocks.filter((u) => u.achievement.rarity === "uncommon").length,
      rare: currentUserUnlocks.filter((u) => u.achievement.rarity === "rare").length,
      epic: currentUserUnlocks.filter((u) => u.achievement.rarity === "epic").length,
      legendary: currentUserUnlocks.filter((u) => u.achievement.rarity === "legendary").length,
    };

    return NextResponse.json({
      currentUser: {
        id: currentUser.id,
        name: currentUser.name,
        username: currentUser.username,
        avatarUrl: currentUser.profile?.avatarUrl || null,
      },
      badges,
      byCategory,
      stats: {
        total: totalBadges,
        unlocked: unlockedCount,
        percentage: totalBadges > 0 ? Math.round((unlockedCount / totalBadges) * 100) : 0,
        byRarity,
      },
      recentUnlocks,
      leaderboard: usersWithBadges,
    });
  } catch (error) {
    console.error("Error fetching badges:", error);
    return NextResponse.json(
      { error: "Failed to fetch badges" },
      { status: 500 }
    );
  }
}
