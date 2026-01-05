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
  FileText,
  Download,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { JourneyTimeline } from "@/components/dashboard/journey-timeline";
import { Navbar } from "@/components/navbar";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardSocket } from "@/hooks/use-dashboard-socket";
import { BadgesWidget } from "@/components/badges";
import { PortfolioViewer } from "@/components/portfolio/portfolio-viewer";

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
    // Gaming stats
    gamingElo: number;
    gamingRank: string;
    gamesPlayed: number;
    gamesWon: number;
    gamingWinStreak: number;
    gamingPoints: number;
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
  notesCount: number;
  flashcardDecksCount: number;
  quizzesCount: number;
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
  
  // Portfolio state
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [portfoliosLoading, setPortfoliosLoading] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState<any | null>(null);
  const [portfolioViewerOpen, setPortfolioViewerOpen] = useState(false);

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

  const fetchPortfolios = useCallback(async () => {
    setPortfoliosLoading(true);
    try {
      const response = await fetch("/api/portfolio");
      if (response.ok) {
        const data = await response.json();
        setPortfolios(data.portfolios || []);
      }
    } catch (err) {
      console.error("Failed to fetch portfolios:", err);
    } finally {
      setPortfoliosLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      fetchDashboardData();
      fetchVersusData();
      fetchPortfolios();
      // Fetch actual decrypted API key for challenge workspace
      fetch("/api/settings/apikey")
        .then(res => res.json())
        .then(data => {
          if (data.apiKey) setUserApiKey(data.apiKey);
          if (data.preferredModel) setUserPreferredModel(data.preferredModel);
        })
        .catch(console.error);
    }
  }, [status, router, fetchDashboardData, fetchVersusData, fetchPortfolios]);

  // WebSocket for real-time versus updates (replaces polling)
  const { isConnected: socketConnected } = useDashboardSocket({
    userId: myUserId || "",
    onVersusUpdate: () => {
      // Refetch versus data when we receive real-time updates
      fetchVersusData();
    },
    onChallengeUpdate: () => {
      // Refresh dashboard data when a challenge is completed
      fetchDashboardData();
    },
    onJourneyUpdate: () => {
      // Refresh dashboard data when journey progress changes
      fetchDashboardData();
    },
    onNotification: (message) => {
      console.log("[Dashboard] Notification:", message);
    },
  });

  // Log socket connection status for debugging
  useEffect(() => {
    if (socketConnected) {
      console.log("[Dashboard] WebSocket connected for real-time updates");
    }
  }, [socketConnected]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar activePath="/dashboard" variant="transparent" />
        <main className="pt-24 pb-12 px-6">
          <div className="max-w-7xl mx-auto">
            {/* Header Skeleton */}
            <div className="mb-8">
              <Skeleton className="h-9 w-80 mb-2" />
              <Skeleton className="h-5 w-96" />
            </div>

            {/* Stats Overview Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="bg-card/50 border-border/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-lg" />
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Main Grid Skeleton */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Active Journeys Skeleton */}
                <Card className="bg-card/50 border-border/50">
                  <CardHeader>
                    <Skeleton className="h-6 w-40" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className="p-4 rounded-xl bg-slate-900/50 border border-border/50">
                          <div className="flex items-center gap-3 mb-3">
                            <Skeleton className="w-10 h-10 rounded-lg" />
                            <div className="space-y-2 flex-1">
                              <Skeleton className="h-5 w-48" />
                              <Skeleton className="h-4 w-32" />
                            </div>
                          </div>
                          <Skeleton className="h-2 w-full rounded-full" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Challenge Progress Skeleton */}
                <Card className="bg-card/50 border-border/50">
                  <CardHeader>
                    <Skeleton className="h-6 w-44" />
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="text-center p-4 rounded-lg bg-muted/20">
                          <Skeleton className="w-6 h-6 mx-auto mb-2 rounded-full" />
                          <Skeleton className="h-8 w-8 mx-auto mb-1" />
                          <Skeleton className="h-3 w-16 mx-auto" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar Skeleton */}
              <div className="space-y-6">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="bg-card/50 border-border/50">
                    <CardHeader>
                      <Skeleton className="h-5 w-28" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {[...Array(3)].map((_, j) => (
                        <Skeleton key={j} className="h-10 w-full rounded-lg" />
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </main>
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

  // Memoize expensive filter operations to prevent re-computation on every render
  // Note: These are safe because data is guaranteed to exist at this point (after early returns)
  const completedChallenges = challengeDetails.filter((c) => c.status === "completed");
  const inProgressChallenges = challengeDetails.filter((c) => c.status === "in_progress");
  const pendingChallenges = challengeDetails.filter(
    (c) => c.status === "available" || c.status === "locked"
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar activePath="/dashboard" variant="transparent" />

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
                    userSkillLevel={data?.profile?.skillLevel || "intermediate"}
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
              {/* Portfolios Card */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="w-4 h-4 text-purple-400" />
                    Portfolios
                    {portfoliosLoading && (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Portfolio Thumbnails Grid */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {portfolios.length > 0 ? (
                      portfolios.slice(0, 4).map((portfolio) => (
                        <div
                          key={portfolio.id}
                          className="group relative aspect-[3/4] rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-border/50 overflow-hidden cursor-pointer hover:border-purple-500/50 transition-all"
                          title={portfolio.title}
                          onClick={() => {
                            setSelectedPortfolio(portfolio);
                            setPortfolioViewerOpen(true);
                          }}
                        >
                          {/* Portfolio content */}
                          <div className="absolute inset-0 flex flex-col p-2">
                            {/* Example badge */}
                            {portfolio.isExample && (
                              <Badge className="absolute top-1 right-1 text-[8px] px-1 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30">
                                Example
                              </Badge>
                            )}
                            
                            {/* Thumbnail - always use dynamic SVG thumbnail */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/portfolio/${portfolio.id}/thumbnail`}
                              alt={portfolio.title}
                              className="w-full h-full object-contain rounded"
                              onError={(e) => {
                                // Fallback to icon if thumbnail fails
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                            <div className="hidden flex-1 flex-col items-center justify-center">
                              <FileText className="w-6 h-6 text-purple-400/70 mb-1" />
                              <span className="text-[9px] text-muted-foreground text-center line-clamp-2 px-1">
                                {portfolio.title}
                              </span>
                            </div>
                            
                            {/* Company/Industry tag */}
                            <div className="mt-auto">
                              <span className="text-[8px] text-muted-foreground truncate block">
                                {portfolio.companyName || portfolio.industry || "Portfolio"}
                              </span>
                            </div>
                          </div>
                          
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-purple-500/0 group-hover:bg-purple-500/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 bg-background/90 hover:bg-background"
                                title="Download PDF"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (portfolio.pdfUrl) {
                                    window.open(portfolio.pdfUrl, "_blank");
                                  } else {
                                    // Open viewer for preview
                                    setSelectedPortfolio(portfolio);
                                    setPortfolioViewerOpen(true);
                                  }
                                }}
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 bg-background/90 hover:bg-background"
                                title="View Details"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPortfolio(portfolio);
                                  setPortfolioViewerOpen(true);
                                }}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      // Empty state - show 4 placeholder slots
                      [1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="aspect-[3/4] rounded-lg bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-dashed border-border/30 flex flex-col items-center justify-center p-2"
                        >
                          <FileText className="w-5 h-5 text-muted-foreground/30 mb-1" />
                          <span className="text-[9px] text-muted-foreground/30 text-center">
                            Empty
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {/* Info message */}
                  <p className="text-xs text-muted-foreground text-center">
                    {portfolios.length > 0 
                      ? `${portfolios.length} portfolio${portfolios.length > 1 ? "s" : ""} available`
                      : "Complete challenges to generate portfolio PDFs showcasing your skills."
                    }
                  </p>
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
                        {data.flashcardDecksCount || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-amber-400" />
                        <span className="text-sm">Quizzes</span>
                      </div>
                      <Badge variant="outline">
                        {data.quizzesCount || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm">Notes</span>
                      </div>
                      <Badge variant="outline">
                        {data.notesCount || 0}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Badges Widget */}
              <BadgesWidget />

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
                        Your Gaming Stats
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
                          <p className="text-2xl font-bold text-cyan-400">
                            {profile.gamingElo}
                          </p>
                          <p className="text-xs text-muted-foreground">ELO Rating</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
                          <p className="text-sm font-bold text-purple-400">
                            {profile.gamingRank}
                          </p>
                          <p className="text-xs text-muted-foreground">Rank</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
                          <p className="text-2xl font-bold text-green-400">
                            {profile.gamesWon}
                          </p>
                          <p className="text-xs text-muted-foreground">Wins</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
                          <p className="text-2xl font-bold text-primary">
                            {profile.gamesPlayed}
                          </p>
                          <p className="text-xs text-muted-foreground">Games Played</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
                          <p className="text-2xl font-bold text-orange-400">
                            {profile.gamingWinStreak}
                          </p>
                          <p className="text-xs text-muted-foreground">Win Streak</p>
                        </div>
                        <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
                          <p className="text-2xl font-bold text-amber-400">
                            {profile.gamingPoints.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">Gaming Pts</p>
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
                            const canCancel = isChallenger && match.status === "pending";
                            
                            return (
                              <div key={match.id} className={`p-3 rounded-lg border transition-colors ${
                                needsResponse 
                                  ? "bg-red-500/10 border-red-500/30" 
                                  : "bg-background/50 border-border/50"
                              }`}>
                                <div className="flex items-center justify-between">
                                  <Link href={`/game/${match.matchCode}`} className="flex items-center gap-2 flex-1 hover:opacity-80">
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
                                         canCancel ? "Awaiting response..." :
                                         match.status === "completed" ? "View results" : "In progress"}
                                      </p>
                                    </div>
                                  </Link>
                                  <div className="flex items-center gap-2">
                                    {needsResponse && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="default"
                                          className="h-7 text-xs"
                                          onClick={async (e) => {
                                            e.preventDefault();
                                            await fetch(`/api/versus/${match.matchCode}`, {
                                              method: "PATCH",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ action: "accept" }),
                                            });
                                            fetchVersusData();
                                          }}
                                        >
                                          Accept
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 text-xs text-muted-foreground hover:text-red-500"
                                          onClick={async (e) => {
                                            e.preventDefault();
                                            await fetch(`/api/versus/${match.matchCode}`, {
                                              method: "PATCH",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ action: "decline" }),
                                            });
                                            fetchVersusData();
                                          }}
                                        >
                                          <XCircle className="w-4 h-4" />
                                        </Button>
                                      </>
                                    )}
                                    {canCancel && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs text-muted-foreground hover:text-red-500"
                                        onClick={async (e) => {
                                          e.preventDefault();
                                          await fetch(`/api/versus/${match.matchCode}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ action: "decline" }),
                                          });
                                          fetchVersusData();
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    )}
                                    {!needsResponse && !canCancel && (
                                      <Badge variant="secondary" className="text-xs">
                                        {match.status}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
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

      {/* Portfolio Viewer Modal */}
      <PortfolioViewer
        portfolio={selectedPortfolio}
        open={portfolioViewerOpen}
        onClose={() => {
          setPortfolioViewerOpen(false);
          setSelectedPortfolio(null);
        }}
      />
    </div>
  );
}
