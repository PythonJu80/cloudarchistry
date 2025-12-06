"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Globe,
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
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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
    scenarioTitle: string;
    locationName: string;
    locationCompany: string;
    locationIcon: string;
    status: string;
    startedAt: string;
    lastActivityAt: string;
    completedAt: string | null;
    pointsEarned: number;
    maxPoints: number;
    totalChallenges: number;
    completedChallenges: number;
    inProgressChallenges: number;
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

function getStatusColor(status: string) {
  switch (status) {
    case "completed":
      return "text-green-400";
    case "in_progress":
      return "text-amber-400";
    case "available":
      return "text-blue-400";
    case "locked":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
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

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      fetchDashboardData();
      // Load avatar from localStorage
      const localAvatar = localStorage.getItem("academy-avatar");
      if (localAvatar) {
        setAvatar(localAvatar);
      }
    }
  }, [status, router]);

  async function fetchDashboardData() {
    try {
      const response = await fetch("/api/dashboard");
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }
      const dashboardData = await response.json();
      setData(dashboardData);
      // Set avatar from profile if no local avatar
      if (!localStorage.getItem("academy-avatar") && dashboardData.profile?.avatarUrl) {
        setAvatar(dashboardData.profile.avatarUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

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
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt="Profile"
                className="w-10 h-10 rounded-xl object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                <Globe className="w-6 h-6 text-white" />
              </div>
            )}
            <span className="text-xl font-bold">CloudAcademy</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/world"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              World Map
            </Link>
            <Link
              href="/challenges"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Challenges
            </Link>
            <Link
              href="/leaderboard"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Leaderboard
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/settings">
              <Button variant="ghost" size="icon" className="rounded-full">
                <Settings className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                @{session?.user?.username || "user"}
              </span>
              <Badge variant="outline" className="text-xs capitalize">
                {profile.subscriptionTier}
              </Badge>
            </div>
          </div>
        </div>
      </nav>

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
              {/* Active Journeys */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="flex flex-row items-center justify-between">
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
                <CardContent>
                  {userJourneys.filter((j) => j.status === "in_progress").length === 0 ? (
                    <div className="text-center py-8">
                      <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground mb-4">
                        No active journeys. Start exploring the world map!
                      </p>
                      <Link href="/world">
                        <Button variant="glow" size="sm">
                          Start a Journey
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {userJourneys
                        .filter((j) => j.status === "in_progress")
                        .slice(0, 3)
                        .map((journey) => (
                          <div
                            key={journey.id}
                            className="p-4 rounded-lg bg-background/50 border border-border/50 hover:border-primary/50 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{journey.locationIcon}</span>
                                <div>
                                  <h4 className="font-semibold">{journey.scenarioTitle}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {journey.locationCompany} • {journey.locationName}
                                  </p>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-amber-400 border-amber-400/30">
                                In Progress
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {journey.completedChallenges}/{journey.totalChallenges} challenges
                                </span>
                                <span className="font-medium">{journey.progress}%</span>
                              </div>
                              <Progress value={journey.progress} className="h-2" />
                            </div>
                            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                              <span>
                                <Calendar className="w-3 h-3 inline mr-1" />
                                Last active {formatTimeAgo(journey.lastActivityAt)}
                              </span>
                              <span>
                                <Trophy className="w-3 h-3 inline mr-1" />
                                {journey.pointsEarned} pts earned
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
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
                              <span className="text-xl">{journey.locationIcon}</span>
                              <div>
                                <p className="font-medium">{journey.scenarioTitle}</p>
                                <p className="text-xs text-muted-foreground">
                                  {journey.locationCompany}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-green-400">
                                {journey.pointsEarned} pts
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {journey.completedChallenges} challenges
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
        </div>
      </main>
    </div>
  );
}
