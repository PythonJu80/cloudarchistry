"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Trophy,
  Target,
  Clock,
  Flame,
  CheckCircle2,
  PlayCircle,
  Lock,
  ChevronRight,
  Settings,
  Zap,
  BookOpen,
  Brain,
  Award,
  MapPin,
  TrendingUp,
  Swords,
  Users,
  XCircle,
  Loader2,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { JourneyTimeline } from "@/components/dashboard/journey-timeline";
import { Navbar } from "@/components/navbar";

interface DashboardData {
  profile: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    skillLevel: string;
    subscriptionTier: string;
    totalPoints: number;
    level: number;
    xp: number;
    currentStreak: number;
    longestStreak: number;
    challengesCompleted: number;
    scenariosCompleted: number;
    locationsVisited: number;
    totalTimeMinutes: number;
    hasAiAccess: boolean;
    hasOpenAiKey: boolean;
    openaiKeyLastFour: string | null;
  };
  stats: {
    totalChallenges: number;
    completedChallenges: number;
    inProgressChallenges: number;
    pendingChallenges: number;
    locationsVisited: number;
    scenariosStarted: number;
    scenariosCompleted: number;
  };
  userJourneys: Array<{
    id: string;
    scenarioId: string;
    status: string;
    startedAt: string;
    lastActivityAt: string;
    completedAt: string | null;
    pointsEarned: number;
    maxPoints: number;
    scenario: {
      id: string;
      title: string;
      description: string;
      difficulty: string;
      companyInfo: Record<string, unknown>;
    };
    location: {
      id: string;
      name: string;
      company: string;
      icon: string;
      slug: string;
      lat: number;
      lng: number;
      country: string | null;
      industry: string;
      difficulty: string;
    };
    challenges: Array<{
      id: string;
      title: string;
      description: string;
      difficulty: string;
      points: number;
      orderIndex: number;
      estimatedMinutes: number;
      awsServices: string[];
      hints: string[];
      successCriteria: string[];
      status: string;
      startedAt: string | null;
      completedAt: string | null;
      pointsEarned: number;
      hintsUsed: number;
      progressId: string | null;
    }>;
    totalChallenges: number;
    challengesCompleted: number;
    progress: number;
  }>;
  challengeDetails: Array<{
    id: string;
    challengeId: string;
    challengeTitle: string;
    challengeDescription: string;
    scenarioTitle: string;
    locationName: string;
    status: string;
    pointsEarned: number;
    maxPoints: number;
    hintsUsed: number;
    startedAt: string | null;
    completedAt: string | null;
    difficulty: string;
  }>;
  locationProgress: Array<{
    id: string;
    locationId: string;
    locationName: string;
    locationCompany: string;
    locationIcon: string;
    status: string;
    totalPoints: number;
    challengesCompleted: number;
    totalChallenges: number;
    firstVisitedAt: string;
    lastVisitedAt: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    data: Record<string, unknown>;
    createdAt: string;
  }>;
  flashcardProgress: Array<{
    id: string;
    deckTitle: string;
    scenarioTitle: string;
    locationName: string;
    cardsStudied: number;
    cardsMastered: number;
    totalCards: number;
    lastStudiedAt: string | null;
  }>;
  quizAttempts: Array<{
    id: string;
    quizTitle: string;
    scenarioTitle: string;
    locationName: string;
    score: number;
    passed: boolean;
    completedAt: string | null;
  }>;
}

interface VersusMatch {
  id: string;
  matchCode: string;
  status: string;
  player1Score: number;
  player2Score: number;
  player1: { id: string; name: string | null; username: string | null };
  player2: { id: string; name: string | null; username: string | null };
  createdAt: string;
  completedAt: string | null;
}

interface VersusData {
  activeMatches: VersusMatch[];
  recentMatches: VersusMatch[];
}

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case "in_progress":
      return <PlayCircle className="w-4 h-4 text-amber-400" />;
    case "available":
      return <Target className="w-4 h-4 text-blue-400" />;
    case "locked":
      return <Lock className="w-4 h-4 text-muted-foreground" />;
    default:
      return <Target className="w-4 h-4 text-muted-foreground" />;
  }
}

function getDifficultyColor(difficulty: string) {
  switch (difficulty) {
    case "beginner":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "intermediate":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "advanced":
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "expert":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versusData, setVersusData] = useState<VersusData | null>(null);
  const [versusLoading, setVersusLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [userPreferredModel, setUserPreferredModel] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard");
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }
      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVersusData = useCallback(async () => {
    try {
      // Fetch versus matches
      const versusRes = await fetch("/api/versus");
      if (versusRes.ok) {
        const data = await versusRes.json();
        setVersusData(data);
      }
      
      // Fetch user ID from team data
      const teamsRes = await fetch("/api/team");
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        for (const team of teamsData.teams || []) {
          const myMember = team.members.find(
            (m: { academyUser?: { email?: string; id?: string } }) => m.academyUser?.email === session?.user?.email
          );
          if (myMember?.academyUser?.id) {
            setMyUserId(myMember.academyUser.id);
            break;
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch versus data:", err);
    } finally {
      setVersusLoading(false);
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      fetchDashboardData();
      fetchVersusData();
      // Fetch actual decrypted API key for challenge workspace
      fetch("/api/settings/apikey")
        .then(res => res.json())
        .then(data => {
          if (data.apiKey) setUserApiKey(data.apiKey);
          if (data.preferredModel) setUserPreferredModel(data.preferredModel);
        })
        .catch(console.error);
    }
  }, [status, router, fetchDashboardData, fetchVersusData]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { profile, stats, userJourneys, challengeDetails } = data;

  // Calculate XP progress to next level
  const xpForNextLevel = profile.level * 1000;
  const xpProgress = (profile.xp / xpForNextLevel) * 100;

  // Separate challenges by status
  const completedChallenges = challengeDetails.filter((c) => c.status === "completed");
  const inProgressChallenges = challengeDetails.filter((c) => c.status === "in_progress");
  const pendingChallenges = challengeDetails.filter(
    (c) => c.status === "available" || c.status === "locked"
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar activePath="/dashboard" />

      {/* Main Content */}
      <main className="pt-24 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              Welcome back, {profile.displayName || session?.user?.name || "Architect"}!
            </h1>
            <p className="text-muted-foreground">
              Track your progress, continue your journeys, and master cloud architecture.
            </p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{profile.totalPoints.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Points</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">Level {profile.level}</p>
                    <p className="text-xs text-muted-foreground">{profile.xp}/{xpForNextLevel} XP</p>
                  </div>
                </div>
                <Progress value={xpProgress} className="mt-2 h-1" />
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Flame className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{profile.currentStreak}</p>
                    <p className="text-xs text-muted-foreground">Day Streak</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.completedChallenges}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.locationsVisited}</p>
                    <p className="text-xs text-muted-foreground">Locations</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {Math.floor(profile.totalTimeMinutes / 60)}h
                    </p>
                    <p className="text-xs text-muted-foreground">Time Spent</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* User Journeys */}
            <div className="lg:col-span-2 space-y-6">
              {/* Active Journeys - Interactive Timeline */}
              <Card className="bg-card/50 border-border/50 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <PlayCircle className="w-5 h-5 text-amber-400" />
                    Active Journeys
                  </CardTitle>
                  <Link href="/world">
                    <Button variant="ghost" size="sm" className="gap-1">
                      Explore Map
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent className="pt-2">
                  <JourneyTimeline 
                    journeys={userJourneys} 
                    apiKey={userApiKey || undefined}
                    preferredModel={userPreferredModel || undefined}
                    onRefresh={fetchDashboardData}
                  />
                </CardContent>
              </Card>

              {/* Challenges Overview */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-400" />
                    Challenge Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-400">
                        {completedChallenges.length}
                      </p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <PlayCircle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-amber-400">
                        {inProgressChallenges.length}
                      </p>
                      <p className="text-xs text-muted-foreground">In Progress</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <Target className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-400">
                        {pendingChallenges.length}
                      </p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                  </div>

                  {/* Recent Challenges */}
                  <h4 className="font-medium mb-3">Recent Challenges</h4>
                  {challengeDetails.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      No challenges started yet. Begin your first journey!
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {challengeDetails.slice(0, 5).map((challenge) => (
                        <div
                          key={challenge.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50"
                        >
                          <div className="flex items-center gap-3">
                            {getStatusIcon(challenge.status)}
                            <div>
                              <p className="font-medium text-sm">{challenge.challengeTitle}</p>
                              <p className="text-xs text-muted-foreground">
                                {challenge.locationName} • {challenge.scenarioTitle}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={getDifficultyColor(challenge.difficulty)}
                            >
                              {challenge.difficulty}
                            </Badge>
                            <span className="text-sm font-medium">
                              {challenge.pointsEarned}/{challenge.maxPoints}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Completed Journeys */}
              {userJourneys.filter((j) => j.status === "completed").length > 0 && (
                <Card className="bg-card/50 border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-green-400" />
                      Completed Journeys
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {userJourneys
                        .filter((j) => j.status === "completed")
                        .slice(0, 5)
                        .map((journey) => (
                          <div
                            key={journey.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{journey.location.icon}</span>
                              <div>
                                <p className="font-medium">{journey.scenario.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {journey.location.company}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-green-400">
                                {journey.pointsEarned} pts
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {journey.challengesCompleted} challenges
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href="/world" className="block">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Globe className="w-4 h-4 text-cyan-400" />
                      Explore World Map
                    </Button>
                  </Link>
                  <Link href="/challenges" className="block">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Target className="w-4 h-4 text-amber-400" />
                      Browse Challenges
                    </Button>
                  </Link>
                  <Link href="/leaderboard" className="block">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Trophy className="w-4 h-4 text-purple-400" />
                      View Leaderboard
                    </Button>
                  </Link>
                  <Link href="/dashboard/settings" className="block">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      Settings
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* AI Access Status */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Brain className="w-5 h-5 text-purple-400" />
                    AI Features
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {profile.hasAiAccess || profile.hasOpenAiKey ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm">AI features enabled</span>
                      </div>
                      {profile.hasOpenAiKey && (
                        <p className="text-xs text-muted-foreground">
                          Using your API key: {profile.openaiKeyLastFour}
                        </p>
                      )}
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>• AI-powered coaching</p>
                        <p>• Smart flashcards</p>
                        <p>• Solution feedback</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Add your OpenAI API key to unlock AI-powered features.
                      </p>
                      <Link href="/dashboard/settings">
                        <Button variant="glow" size="sm" className="w-full gap-2">
                          <Zap className="w-4 h-4" />
                          Add API Key
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Learning Resources */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                    Learning
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                      <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-purple-400" />
                        <span className="text-sm">Flashcards</span>
                      </div>
                      <Badge variant="outline">
                        {data.flashcardProgress?.length || 0} decks
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-amber-400" />
                        <span className="text-sm">Quizzes</span>
                      </div>
                      <Badge variant="outline">
                        {data.quizAttempts?.length || 0} taken
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Skill Level */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Your Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Skill Level</span>
                      <Badge className={getDifficultyColor(profile.skillLevel)}>
                        {profile.skillLevel}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Subscription</span>
                      <Badge variant="outline" className="capitalize">
                        {profile.subscriptionTier}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Best Streak</span>
                      <span className="font-medium">{profile.longestStreak} days</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Game Zone Section - Full Width */}
          <div className="mt-8">
            <Card className="bg-gradient-to-br from-red-500/10 via-card/50 to-orange-500/10 border-red-500/30">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                    <Swords className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      Game Zone
                      <Badge variant="destructive" className="text-xs">BETA</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Challenge teammates to head-to-head quiz battles
                    </p>
                  </div>
                </div>
                <Link href="/game">
                  <Button variant="glow" className="gap-2 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600">
                    <Swords className="w-4 h-4" />
                    Enter Game Zone
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {versusLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid md:grid-cols-3 gap-6">
                    {/* Stats Summary */}
                    <div className="space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        Your Battle Stats
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
                          <p className="text-2xl font-bold text-green-400">
                            {versusData?.recentMatches.filter(m => {
                              const isPlayer1 = m.player1.id === myUserId;
                              return isPlayer1 ? m.player1Score > m.player2Score : m.player2Score > m.player1Score;
                            }).length || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">Wins</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
                          <p className="text-2xl font-bold text-red-400">
                            {versusData?.recentMatches.filter(m => {
                              const isPlayer1 = m.player1.id === myUserId;
                              return isPlayer1 ? m.player1Score < m.player2Score : m.player2Score < m.player1Score;
                            }).length || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">Losses</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
                          <p className="text-2xl font-bold text-primary">
                            {(versusData?.activeMatches.length || 0) + (versusData?.recentMatches.length || 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">Total Matches</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
                          <p className="text-2xl font-bold text-amber-400">
                            {versusData?.activeMatches.length || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">Active</p>
                        </div>
                      </div>
                    </div>

                    {/* Active/Pending Matches */}
                    <div className="space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        Active Matches
                      </h4>
                      {!versusData?.activeMatches.length ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No active matches</p>
                          <p className="text-xs">Challenge a teammate!</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {versusData.activeMatches.slice(0, 3).map((match) => {
                            const isChallenger = match.player1.id === myUserId;
                            const opponent = isChallenger ? match.player2 : match.player1;
                            const needsResponse = !isChallenger && match.status === "pending";
                            
                            return (
                              <Link key={match.id} href={`/game/${match.matchCode}`}>
                                <div className={`p-3 rounded-lg border transition-colors ${
                                  needsResponse 
                                    ? "bg-red-500/10 border-red-500/30 hover:bg-red-500/20" 
                                    : "bg-background/50 border-border/50 hover:bg-muted/50"
                                }`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        needsResponse ? "bg-red-500/20" : "bg-primary/20"
                                      }`}>
                                        {needsResponse ? (
                                          <Swords className="w-4 h-4 text-red-500" />
                                        ) : (
                                          <Users className="w-4 h-4 text-primary" />
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium">
                                          vs {opponent.name || opponent.username}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {needsResponse ? "Respond now!" : 
                                           match.status === "pending" ? "Waiting..." : "In progress"}
                                        </p>
                                      </div>
                                    </div>
                                    <Badge variant={needsResponse ? "destructive" : "secondary"} className="text-xs">
                                      {needsResponse ? "!" : match.status}
                                    </Badge>
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Recent Results */}
                    <div className="space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-purple-500" />
                        Recent Results
                      </h4>
                      {!versusData?.recentMatches.length ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No matches yet</p>
                          <p className="text-xs">Start battling!</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {versusData.recentMatches.slice(0, 3).map((match) => {
                            const isPlayer1 = match.player1.id === myUserId;
                            const myScore = isPlayer1 ? match.player1Score : match.player2Score;
                            const theirScore = isPlayer1 ? match.player2Score : match.player1Score;
                            const opponent = isPlayer1 ? match.player2 : match.player1;
                            const won = myScore > theirScore;
                            const draw = myScore === theirScore;
                            
                            return (
                              <div
                                key={match.id}
                                className={`p-3 rounded-lg border ${
                                  won ? "bg-green-500/10 border-green-500/30" :
                                  draw ? "bg-muted/50 border-border/50" :
                                  "bg-red-500/10 border-red-500/30"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                      won ? "bg-green-500/20" : draw ? "bg-muted" : "bg-red-500/20"
                                    }`}>
                                      {won ? (
                                        <Trophy className="w-4 h-4 text-green-500" />
                                      ) : draw ? (
                                        <span className="text-sm">🤝</span>
                                      ) : (
                                        <XCircle className="w-4 h-4 text-red-500" />
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">
                                        vs {opponent.name || opponent.username}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {myScore} - {theirScore}
                                      </p>
                                    </div>
                                  </div>
                                  <Badge variant={won ? "default" : draw ? "secondary" : "destructive"} className="text-xs">
                                    {won ? "Won" : draw ? "Draw" : "Lost"}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
