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
  Mail,
  UserPlus,
  Loader2,
  X,
  Copy,
  Check,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { 
  TeamResponse, 
  TeamStatsResponse, 
  TeamActivityResponse,
  TeamRole,
  TeamInviteResponse,
} from "@/lib/academy/types/team";
import { CohortProgramBuilder } from "@/components/cohort/cohort-program-builder";

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
  const { toast } = useToast();

  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [stats, setStats] = useState<TeamStatsResponse | null>(null);
  const [activities, setActivities] = useState<TeamActivityResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);
  const [revokingInvite, setRevokingInvite] = useState<string | null>(null);

  // Team diagnostics state
  interface MemberDiagnostics {
    memberId: string;
    academyUserId: string;
    role: string;
    pointsContributed: number;
    challengesCompleted: number;
    joinedAt: string;
    user: { name: string; email?: string };
    profile: {
      displayName?: string;
      skillLevel?: string;
      targetCertification?: string;
      level?: number;
      xp?: number;
      totalPoints?: number;
      currentStreak?: number;
    } | null;
    latestDiagnostics: {
      id: string;
      overallReadiness: number;
      readinessLabel: string;
      summary?: string;
      strengths?: string[];
      weaknesses?: string[];
      recommendations?: string[];
      encouragement?: string;
      nextMilestone?: string;
      daysToMilestone?: number;
      createdAt: string;
    } | null;
    diagnosticsHistory: Array<{
      id: string;
      overallReadiness: number;
      readinessLabel: string;
      createdAt: string;
    }>;
  }
  interface TeamDiagnosticsData {
    teamStats: {
      totalMembers: number;
      membersWithDiagnostics: number;
      avgReadiness: number;
      readinessDistribution: {
        examReady: number;
        almostReady: number;
        gettingThere: number;
        notReady: number;
      };
      totalPoints: number;
      totalChallengesCompleted: number;
    };
    members: MemberDiagnostics[];
  }
  const [teamDiagnostics, setTeamDiagnostics] = useState<TeamDiagnosticsData | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

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

  // Send invite handler
  const handleSendInvite = async () => {
    const emailToSend = inviteEmail.trim().toLowerCase();
    if (!emailToSend) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }

    setSendingInvite(true);
    try {
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, email: emailToSend }),
      });
      const data = await response.json();
      
      // Handle rate limiting
      if (response.status === 429) {
        const resetInMinutes = data.resetAt 
          ? Math.ceil((data.resetAt - Date.now()) / 60000)
          : 60;
        toast({ 
          title: "Rate Limit Exceeded", 
          description: `You can send more invites in ${resetInMinutes} minute${resetInMinutes !== 1 ? 's' : ''}. (Limit: 10 per hour)`,
          variant: "destructive"
        });
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to send invite");
      }
      toast({ title: "Success", description: `Invite sent to ${emailToSend}` });
      setInviteEmail("");
      fetchTeamData(); // Refresh to show new invite
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err instanceof Error ? err.message : "Failed to send invite",
        variant: "destructive"
      });
    } finally {
      setSendingInvite(false);
    }
  };

  // Revoke invite handler
  const handleRevokeInvite = async (inviteId: string) => {
    setRevokingInvite(inviteId);
    try {
      const response = await fetch(`/api/team/invite?id=${inviteId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to revoke invite");
      }
      toast({ title: "Success", description: "Invite revoked" });
      fetchTeamData();
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err instanceof Error ? err.message : "Failed to revoke invite",
        variant: "destructive"
      });
    } finally {
      setRevokingInvite(null);
    }
  };

  // Copy invite link handler
  const handleCopyInviteLink = async (code: string) => {
    const inviteUrl = `${window.location.origin}/invite/${code}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopiedInvite(code);
    toast({ title: "Copied!", description: "Invite link copied to clipboard" });
    setTimeout(() => setCopiedInvite(null), 2000);
  };

  // Check if current user can manage invites
  const canManageInvites = team?.myRole === "owner" || team?.myRole === "admin";

  // Fetch team diagnostics
  const fetchTeamDiagnostics = useCallback(async () => {
    if (!teamId) return;
    setDiagnosticsLoading(true);
    try {
      const res = await fetch(`/api/team/${teamId}/diagnostics`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTeamDiagnostics(data);
        }
      }
    } catch {
      // Ignore - diagnostics are optional
    } finally {
      setDiagnosticsLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (authStatus === "authenticated" && teamId) {
      fetchTeamData();
      // Fetch team diagnostics for tutors
      fetchTeamDiagnostics();
    }
  }, [authStatus, teamId, router, fetchTeamData, fetchTeamDiagnostics]);

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

        {/* AI Cohort Program Builder - Only for owners/admins */}
        {canManageInvites && (
          <CohortProgramBuilder 
            teamId={teamId} 
            teamName={team.name}
          />
        )}

        {/* Team Member Diagnostics - Only for tutors (owner/admin) */}
        {canManageInvites && teamDiagnostics && (
          <Card className="border-violet-500/20 bg-gradient-to-br from-violet-950/20 to-slate-950/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-violet-400" />
                Learner Diagnostics
              </CardTitle>
              <CardDescription>
                AI-powered readiness assessment for each team member
              </CardDescription>
              {/* Team-wide readiness summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <p className="text-2xl font-bold text-violet-400">{teamDiagnostics.teamStats.avgReadiness}%</p>
                  <p className="text-xs text-muted-foreground">Avg Readiness</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{teamDiagnostics.teamStats.readinessDistribution.examReady}</p>
                  <p className="text-xs text-muted-foreground">Exam Ready</p>
                </div>
                <div className="p-3 rounded-lg bg-cyan-500/10 text-center">
                  <p className="text-2xl font-bold text-cyan-400">{teamDiagnostics.teamStats.readinessDistribution.almostReady}</p>
                  <p className="text-xs text-muted-foreground">Almost Ready</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                  <p className="text-2xl font-bold text-amber-400">{teamDiagnostics.teamStats.readinessDistribution.gettingThere + teamDiagnostics.teamStats.readinessDistribution.notReady}</p>
                  <p className="text-xs text-muted-foreground">Needs Work</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {diagnosticsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                </div>
              ) : teamDiagnostics.members.length > 0 ? (
                teamDiagnostics.members.map((member) => (
                  <div
                    key={member.memberId}
                    className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Readiness circle */}
                        <div className="relative w-12 h-12">
                          <svg className="w-12 h-12 transform -rotate-90">
                            <circle
                              cx="24"
                              cy="24"
                              r="20"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                              className="text-white/10"
                            />
                            <circle
                              cx="24"
                              cy="24"
                              r="20"
                              stroke={
                                member.latestDiagnostics
                                  ? member.latestDiagnostics.overallReadiness >= 80
                                    ? "#10b981"
                                    : member.latestDiagnostics.overallReadiness >= 60
                                    ? "#06b6d4"
                                    : member.latestDiagnostics.overallReadiness >= 40
                                    ? "#f59e0b"
                                    : "#ef4444"
                                  : "#6b7280"
                              }
                              strokeWidth="4"
                              fill="none"
                              strokeLinecap="round"
                              strokeDasharray={`${((member.latestDiagnostics?.overallReadiness || 0) / 100) * 126} 126`}
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                            {member.latestDiagnostics?.overallReadiness || 0}%
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{member.user.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {member.latestDiagnostics ? (
                              <Badge
                                className={cn(
                                  "text-xs",
                                  member.latestDiagnostics.readinessLabel === "Exam Ready"
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                    : member.latestDiagnostics.readinessLabel === "Almost Ready"
                                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                                    : member.latestDiagnostics.readinessLabel === "Getting There"
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                    : "bg-red-500/20 text-red-300 border-red-500/30"
                                )}
                              >
                                {member.latestDiagnostics.readinessLabel}
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs">
                                No diagnostics yet
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground capitalize">
                              {member.role}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="text-sm font-medium text-purple-400">{member.pointsContributed}</p>
                          <p className="text-xs text-muted-foreground">Team pts</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-green-400">{member.challengesCompleted}</p>
                          <p className="text-xs text-muted-foreground">Challenges</p>
                        </div>
                        {member.diagnosticsHistory.length > 1 && (
                          <div className="flex items-center gap-1">
                            {member.diagnosticsHistory[0].overallReadiness > member.diagnosticsHistory[1].overallReadiness ? (
                              <>
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs text-emerald-400">
                                  +{member.diagnosticsHistory[0].overallReadiness - member.diagnosticsHistory[1].overallReadiness}%
                                </span>
                              </>
                            ) : member.diagnosticsHistory[0].overallReadiness < member.diagnosticsHistory[1].overallReadiness ? (
                              <>
                                <TrendingDown className="w-4 h-4 text-red-400" />
                                <span className="text-xs text-red-400">
                                  {member.diagnosticsHistory[0].overallReadiness - member.diagnosticsHistory[1].overallReadiness}%
                                </span>
                              </>
                            ) : (
                              <>
                                <Minus className="w-4 h-4 text-gray-400" />
                                <span className="text-xs text-gray-400">0%</span>
                              </>
                            )}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedMember(expandedMember === member.memberId ? null : member.memberId)}
                          className="h-8 w-8 p-0"
                        >
                          {expandedMember === member.memberId ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {/* Expanded details */}
                    {expandedMember === member.memberId && member.latestDiagnostics && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                        {member.latestDiagnostics.summary && (
                          <p className="text-sm text-muted-foreground">{member.latestDiagnostics.summary}</p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {member.latestDiagnostics.strengths && Array.isArray(member.latestDiagnostics.strengths) && member.latestDiagnostics.strengths.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-emerald-400 mb-2">Strengths</p>
                              <ul className="space-y-1">
                                {(member.latestDiagnostics.strengths as Array<string | { area?: string }>).slice(0, 3).map((s, i) => (
                                  <li key={i} className="text-xs text-muted-foreground">
                                    • {typeof s === "string" ? s : (s?.area || "Unknown")}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {member.latestDiagnostics.weaknesses && Array.isArray(member.latestDiagnostics.weaknesses) && member.latestDiagnostics.weaknesses.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-amber-400 mb-2">Areas to Improve</p>
                              <ul className="space-y-1">
                                {(member.latestDiagnostics.weaknesses as Array<string | { area?: string }>).slice(0, 3).map((w, i) => (
                                  <li key={i} className="text-xs text-muted-foreground">
                                    • {typeof w === "string" ? w : (w?.area || "Unknown")}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        {member.latestDiagnostics.nextMilestone && (
                          <div className="p-2 rounded bg-violet-500/10 text-xs">
                            <span className="text-violet-400 font-medium">Next Milestone:</span>{" "}
                            <span className="text-muted-foreground">{member.latestDiagnostics.nextMilestone}</span>
                            {member.latestDiagnostics.daysToMilestone && (
                              <span className="text-violet-400 ml-2">({member.latestDiagnostics.daysToMilestone} days)</span>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Last assessed: {new Date(member.latestDiagnostics.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No member diagnostics available</p>
                  <p className="text-xs">Members can generate diagnostics from their Analytics page</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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

        {/* Members & Invites */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-purple-400" />
              Cohort Members
            </CardTitle>
            <CardDescription className="space-y-2">
              <div className="flex items-center justify-between">
                <span>{team.memberCount} of {team.maxMembers} members</span>
                <span className="text-xs">
                  {Math.round((team.memberCount / team.maxMembers) * 100)}% capacity
                </span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-300",
                    team.memberCount >= team.maxMembers ? "bg-red-500" :
                    team.memberCount / team.maxMembers > 0.8 ? "bg-yellow-500" :
                    "bg-green-500"
                  )}
                  style={{ width: `${Math.min((team.memberCount / team.maxMembers) * 100, 100)}%` }}
                />
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Members Grid */}
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

            {/* Invite Section - Only for owner/admin */}
            {canManageInvites && (
              <div className="border-t border-border pt-6 space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-cyan-400" />
                  Invite Members
                </h4>
                
                {/* Invite Form */}
                <div className="flex gap-2">
                  <Input
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendInvite()}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendInvite}
                    disabled={sendingInvite || !inviteEmail.trim()}
                    className="gap-2"
                  >
                    {sendingInvite ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                    Send Invite
                  </Button>
                </div>

                {/* Pending Invites */}
                {team.invites && team.invites.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-muted-foreground">
                      Pending Invites ({team.invites.length})
                    </h5>
                    <div className="space-y-2">
                      {team.invites.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/20"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {invite.email || "Anyone with link"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Expires {new Date(invite.expiresAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyInviteLink(invite.code)}
                              className="h-8 px-2"
                            >
                              {copiedInvite === invite.code ? (
                                <Check className="w-4 h-4 text-green-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeInvite(invite.id)}
                              disabled={revokingInvite === invite.id}
                              className="h-8 px-2 text-red-400 hover:text-red-300"
                            >
                              {revokingInvite === invite.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
