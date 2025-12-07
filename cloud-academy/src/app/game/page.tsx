"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Loader2,
  Zap,
  ArrowLeft,
  Users,
  Swords,
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface TeamMember {
  id: string;
  role: string;
  academyUser: {
    id: string;
    name: string | null;
    email: string;
    username: string | null;
  } | null;
}

interface Team {
  id: string;
  name: string;
  members: TeamMember[];
}

interface Match {
  id: string;
  matchCode: string;
  status: string;
  player1Score: number;
  player2Score: number;
  player1: { id: string; name: string | null; username: string | null };
  player2: { id: string; name: string | null; username: string | null };
  createdAt: string;
}

export default function GameModePage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<{ activeMatches: Match[]; recentMatches: Match[] }>({
    activeMatches: [],
    recentMatches: [],
  });
  const [loading, setLoading] = useState(true);
  const [challenging, setChallenging] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (authStatus === "authenticated") {
      fetchData();
    }
  }, [authStatus, router]);

  const fetchData = async () => {
    try {
      // Fetch teams
      const teamsRes = await fetch("/api/team");
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData.teams || []);
        
        // Find my user ID from team members
        for (const team of teamsData.teams || []) {
          const myMember = team.members.find(
            (m: TeamMember) => m.academyUser?.email === session?.user?.email
          );
          if (myMember?.academyUser?.id) {
            setMyUserId(myMember.academyUser.id);
            break;
          }
        }
      }

      // Fetch matches
      const matchesRes = await fetch("/api/versus");
      if (matchesRes.ok) {
        const matchesData = await matchesRes.json();
        setMatches(matchesData);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChallenge = async (opponentId: string) => {
    setChallenging(opponentId);
    try {
      const res = await fetch("/api/versus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opponentId,
          matchType: "quiz",
        }),
      });

      const data = await res.json();

      if (res.ok && data.match) {
        // Show toast notification about email status
        if (data.emailSent) {
          toast({
            title: "⚔️ Challenge Sent!",
            description: `Email sent to ${data.emailTo}. They've been notified!`,
            duration: 5000,
          });
        } else {
          toast({
            title: "⚔️ Challenge Created",
            description: "Match created but email failed. Share the link manually.",
            variant: "destructive",
            duration: 5000,
          });
        }
        
        // Short delay so user sees the toast before redirect
        setTimeout(() => {
          router.push(`/game/${data.match.matchCode}`);
        }, 1500);
      }
    } catch (err) {
      console.error("Failed to create challenge:", err);
      toast({
        title: "Error",
        description: "Failed to create challenge. Try again.",
        variant: "destructive",
      });
    } finally {
      setChallenging(null);
    }
  };

  if (loading || authStatus === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Get all team members except myself
  const opponents = teams.flatMap(team => 
    team.members
      .filter(m => m.academyUser && m.academyUser.id !== myUserId)
      .map(m => ({
        ...m.academyUser!,
        teamName: team.name,
      }))
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" />
            <span className="font-semibold">Versus Mode</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Incoming Challenges - matches where I'm player2 and need to accept */}
        {matches.activeMatches.filter(m => m.player2.id === myUserId && m.status === "pending").length > 0 && (
          <Card className="border-red-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-red-500" />
                Incoming Challenges
              </CardTitle>
              <CardDescription>
                You&apos;ve been challenged! Accept or decline.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {matches.activeMatches
                .filter(m => m.player2.id === myUserId && m.status === "pending")
                .map((match) => (
                <Link key={match.id} href={`/game/${match.matchCode}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                        <Swords className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {match.player1.name || match.player1.username} challenged you!
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Click to accept or decline
                        </p>
                      </div>
                    </div>
                    <Badge variant="destructive">
                      <Clock className="w-3 h-3 mr-1" />
                      Respond
                    </Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* My Pending Challenges - matches I created, waiting for opponent */}
        {matches.activeMatches.filter(m => m.player1.id === myUserId && m.status === "pending").length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-500" />
                Awaiting Response
              </CardTitle>
              <CardDescription>
                Challenges you sent, waiting for opponent to accept.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {matches.activeMatches
                .filter(m => m.player1.id === myUserId && m.status === "pending")
                .map((match) => (
                <Link key={match.id} href={`/game/${match.matchCode}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-yellow-500" />
                      </div>
                      <div>
                        <p className="font-medium">
                          vs {match.player2.name || match.player2.username}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Waiting for them to accept...
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      <Clock className="w-3 h-3 mr-1" />
                      pending
                    </Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Active Games - matches in progress */}
        {matches.activeMatches.filter(m => m.status === "active").length > 0 && (
          <Card className="border-green-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-500" />
                Live Matches
              </CardTitle>
              <CardDescription>
                Games in progress - jump back in!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {matches.activeMatches
                .filter(m => m.status === "active")
                .map((match) => (
                <Link key={match.id} href={`/game/${match.matchCode}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 hover:bg-green-500/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {match.player1.name || match.player1.username} vs {match.player2.name || match.player2.username}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Score: {match.player1Score} - {match.player2Score}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-500">
                      <Zap className="w-3 h-3 mr-1" />
                      LIVE
                    </Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Challenge Someone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-red-500" />
              Challenge a Teammate
            </CardTitle>
            <CardDescription>
              Pick someone from your team to battle in a Quiz!
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teams.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">
                  You need to be part of a team to challenge someone.
                </p>
                <Link href="/dashboard/settings">
                  <Button>Create or Join a Team</Button>
                </Link>
              </div>
            ) : opponents.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">
                  No teammates to challenge yet. Invite someone to your team!
                </p>
                <Link href="/dashboard/settings">
                  <Button>Invite Teammates</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {opponents.map((opponent) => (
                  <div
                    key={opponent.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{opponent.name || opponent.username}</p>
                        <p className="text-sm text-muted-foreground">{opponent.teamName}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleChallenge(opponent.id)}
                      disabled={challenging === opponent.id}
                      className="gap-2"
                    >
                      {challenging === opponent.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Swords className="w-4 h-4" />
                      )}
                      Challenge
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Matches */}
        {matches.recentMatches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Recent Matches
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {matches.recentMatches.map((match) => {
                const isWinner = match.player1Score > match.player2Score 
                  ? match.player1.id === myUserId
                  : match.player2.id === myUserId;
                const isDraw = match.player1Score === match.player2Score;

                return (
                  <div
                    key={match.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {isDraw ? (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-lg">🤝</span>
                        </div>
                      ) : isWinner ? (
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                          <XCircle className="w-5 h-5 text-red-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">
                          {match.player1.name || match.player1.username} vs {match.player2.name || match.player2.username}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {match.player1Score} - {match.player2Score}
                        </p>
                      </div>
                    </div>
                    <Badge variant={isDraw ? "secondary" : isWinner ? "default" : "destructive"}>
                      {isDraw ? "Draw" : isWinner ? "Won" : "Lost"}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
