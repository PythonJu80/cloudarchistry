"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Trophy,
  Target,
  Clock,
  ArrowLeft,
  Crown,
  Shield,
  User,
  Activity,
  Award,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { 
  TeamResponse, 
  TeamStatsResponse, 
  TeamActivityResponse,
  TeamRole,
} from "@/lib/academy/types/team";

// Role icon mapping
const ROLE_ICONS: Record<TeamRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: User,
};

const ROLE_COLORS: Record<TeamRole, string> = {
  owner: "text-yellow-500",
  admin: "text-blue-400",
  member: "text-muted-foreground",
};

// Activity type icons
const ACTIVITY_ICONS: Record<string, string> = {
  challenge_completed: "🏆",
  scenario_started: "🚀",
  scenario_completed: "✅",
  member_joined: "👋",
  member_left: "👋",
  badge_earned: "🏅",
  level_up: "⬆️",
  points_earned: "⭐",
};

export default function CohortDashboardPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [stats, setStats] = useState<TeamStatsResponse | null>(null);
  const [activities, setActivities] = useState<TeamActivityResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamData = useCallback(async () => {
    if (!teamId) return;

    setLoading(true);
    setError(null);

    try {
      const [teamRes, statsRes, activityRes] = await Promise.all([
        fetch(`/api/team/${teamId}`),
        fetch(`/api/team/${teamId}/stats`),
        fetch(`/api/team/${teamId}/activity?limit=20`),
      ]);

      if (!teamRes.ok) {
        const data = await teamRes.json();
        throw new Error(data.error || "Failed to load cohort");
      }

      const teamData = await teamRes.json();
      setTeam(teamData.team);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setActivities(activityData.activities || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cohort data");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (authStatus === "authenticated" && teamId) {
      fetchTeamData();
    }
  }, [authStatus, teamId, router, fetchTeamData]);

  if (authStatus === "loading" || loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={() => router.push("/world")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to World
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!team) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/world">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Users className="w-6 h-6 text-purple-400" />
                  {team.name}
                </h1>
                {team.description && (
                  <p className="text-sm text-muted-foreground">{team.description}</p>
                )}
              </div>
            </div>
            <Badge variant="outline" className="capitalize">
              {team.myRole}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Points</p>
                  <p className="text-3xl font-bold text-purple-400">
                    {stats?.totalPoints?.toLocaleString() || 0}
                  </p>
                </div>
                <Trophy className="w-10 h-10 text-purple-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Members</p>
                  <p className="text-3xl font-bold text-cyan-400">
                    {stats?.memberCount || team.memberCount}
                  </p>
                </div>
                <Users className="w-10 h-10 text-cyan-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-3xl font-bold text-green-400">
                    {stats?.challengesCompleted || 0}
                  </p>
                </div>
                <Target className="w-10 h-10 text-green-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-3xl font-bold text-amber-400">
                    {stats?.challengesInProgress || team.activeChallenges}
                  </p>
                </div>
                <Clock className="w-10 h-10 text-amber-400/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Contributors */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Award className="w-5 h-5 text-yellow-400" />
                Top Contributors
              </CardTitle>
              <CardDescription>Members with most points</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats?.topContributors && stats.topContributors.length > 0 ? (
                stats.topContributors.map((contributor, index) => (
                  <div
                    key={contributor.academyUserId}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                        index === 0 ? "bg-yellow-500/20 text-yellow-400" :
                        index === 1 ? "bg-gray-400/20 text-gray-300" :
                        index === 2 ? "bg-amber-600/20 text-amber-500" :
                        "bg-secondary text-muted-foreground"
                      )}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{contributor.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {contributor.challengesCompleted} challenges
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-400">{contributor.points}</p>
                      <p className="text-xs text-muted-foreground">pts</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No contributions yet</p>
                  <p className="text-xs">Complete challenges to earn points!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="w-5 h-5 text-cyan-400" />
                Cohort Activity
              </CardTitle>
              <CardDescription>Recent team activity</CardDescription>
            </CardHeader>
            <CardContent>
              {activities.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="text-2xl">
                        {ACTIVITY_ICONS[activity.activityType] || "📌"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{activity.title}</p>
                        {activity.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {activity.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {activity.user?.name || activity.user?.username || "Team"}
                          </span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(activity.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {activity.pointsEarned > 0 && (
                        <Badge variant="secondary" className="text-green-400">
                          +{activity.pointsEarned}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No activity yet</p>
                  <p className="text-xs">Activity will appear here as your cohort progresses</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Members List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-purple-400" />
              Cohort Members
            </CardTitle>
            <CardDescription>
              {team.memberCount} of {team.maxMembers} members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {team.members.map((member) => {
                const RoleIcon = ROLE_ICONS[member.role as TeamRole] || User;
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {member.academyUser?.name || member.academyUser?.username || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.academyUser?.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <RoleIcon className={cn("w-4 h-4", ROLE_COLORS[member.role as TeamRole])} />
                      <span className="text-xs capitalize text-muted-foreground">
                        {member.role}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
