import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/gaming/activity-ticker - Get real user data for the live activity ticker
 * Returns a mix of real users with simulated activities for the arena banner
 */
export async function GET() {
  try {
    // Fetch ALL real users from the database - no filtering
    const allUsers = await prisma.academyUser.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
    });

    console.log(`[Activity Ticker] Found ${allUsers.length} users`);

    // Fetch game profiles separately
    const userIds = allUsers.map(u => u.id);
    const gameProfiles = await prisma.gameProfile.findMany({
      where: { userId: { in: userIds } },
    });

    const profiles = await prisma.academyUserProfile.findMany({
      where: { academyUserId: { in: userIds } },
    });

    // Map profiles to users
    const usersWithProfiles = allUsers.map(user => ({
      ...user,
      gameProfile: gameProfiles.find(gp => gp.userId === user.id) || null,
      profile: profiles.find(p => p.academyUserId === user.id) || null,
    }));

    const uniqueUsers = usersWithProfiles;

    // Generate activity entries from real users with REAL stats
    const activities = uniqueUsers.slice(0, 10).map((user) => {
      const displayName = user.username || user.name || `Player${user.id.slice(-4)}`;
      const elo = user.gameProfile?.elo || 1500;
      const totalPoints = user.gameProfile?.totalPoints || user.profile?.totalPoints || 0;
      const streak = user.gameProfile?.winStreak || user.profile?.currentStreak || 0;
      
      // Extract real earnings from serviceSlotsStats JSON
      const slotsStats = user.gameProfile?.serviceSlotsStats as any;
      const slotsWinnings = slotsStats?.totalWinnings || 0;
      const slotsBalance = slotsStats?.balance || 0;
      
      // Extract Cloud Tycoon earnings
      const tycoonStats = user.gameProfile?.cloudTycoonStats as any;
      const tycoonEarnings = tycoonStats?.totalEarnings || 0;
      
      // Calculate total earnings across all games
      const totalEarnings = slotsWinnings + tycoonEarnings;

      // Generate varied activities with REAL user stats
      const activityTypes = [
        { action: "won", game: "Quiz Battle", points: `${elo} ELO` },
        { action: "earned", game: "total", points: totalEarnings !== 0 ? `$${totalEarnings.toLocaleString()}` : "" },
        { action: "has", game: `${totalPoints} total points`, points: "🏆" },
        { action: "holds", game: "balance", points: slotsBalance > 0 ? `$${slotsBalance.toLocaleString()}` : "" },
      ];

      // Add streak achievement if user has a streak
      if (streak >= 3) {
        activityTypes.push({ action: "achieved", game: `${streak} Win Streak`, points: "🔥" });
      }

      // Pick a random activity type
      const activity = activityTypes[Math.floor(Math.random() * activityTypes.length)];

      return {
        user: displayName,
        action: activity.action,
        game: activity.game,
        points: activity.points,
      };
    });

    // If we don't have enough real users, pad with some variety
    if (activities.length < 5) {
      const fallbackActivities = [
        { user: "NewPlayer", action: "joined", game: "Arena", points: "" },
        { user: "Learner", action: "started", game: "Quiz Battle", points: "" },
      ];
      activities.push(...fallbackActivities.slice(0, 5 - activities.length));
    }

    return NextResponse.json({
      activities,
      userCount: uniqueUsers.length,
    });
  } catch (error) {
    console.error("Error fetching activity ticker data:", error);
    // Return fallback data on error
    return NextResponse.json({
      activities: [
        { user: "Player", action: "joined", game: "Arena", points: "" },
      ],
      userCount: 0,
    });
  }
}
