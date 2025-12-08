"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DashboardSnapshot {
  totalChallenges: number;
  completedChallenges: number;
  avgScore: number;
  focusAreas: Array<{ label: string; progress: number }>;
  upcomingMilestones: Array<{
    title: string;
    description: string;
    eta: string;
  }>;
}

interface DashboardApiResponse {
  stats?: {
    totalChallenges?: number;
    completedChallenges?: number;
  };
  challengeProgress?: {
    averageScore?: number;
  };
}

interface LearningThread {
  title: string;
  description: string;
  status: string;
  icon: string;
  color: string;
  link: string;
}

export default function LearnPage() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({
    totalChallenges: 0,
    completedChallenges: 0,
    avgScore: 0,
    focusAreas: [],
    upcomingMilestones: [],
  });
  const [threads, setThreads] = useState<LearningThread[]>([]);

  useEffect(() => {
    hydrate();
  }, []);

  const hydrate = async () => {
    try {
      const dashRes = await fetch("/api/dashboard");
      let data: DashboardApiResponse | null = null;
      if (dashRes.ok) {
        data = (await dashRes.json()) as DashboardApiResponse;
      }
      const stats = data ?? {};
      setSnapshot({
        totalChallenges: stats.stats?.totalChallenges ?? 0,
        completedChallenges: stats.stats?.completedChallenges ?? 0,
        avgScore: stats.challengeProgress?.averageScore ?? 0,
        focusAreas: [
          { label: "Compute & Containers", progress: 72 },
          { label: "Networking & Edge", progress: 58 },
          { label: "Security & Identity", progress: 83 },
        ],
        upcomingMilestones: [
          {
            title: "SAA-C03 Readiness Check",
            description: "Run a timed assessment to confirm week 4 outcomes.",
            eta: "Due in 5 days",
          },
          {
            title: "Identity Deep Dive",
            description: "Reinforce IAM governance before final mock.",
            eta: "Scheduled: Next Tuesday 8pm",
          },
        ],
      });

      setThreads([
        {
          title: "AWS Solutions Architect Journey",
          description:
            "Primary certification path with layered scenarios for hybrid networking and secure landing zones.",
          status: "In progress",
          icon: "🎯",
          color: "from-cyan-500/20 to-blue-500/10",
          link: "/learn/guide",
        },
        {
          title: "Architecture practice",
          description:
            "Recent diagrams and audits the coach monitors to keep resilience and costs balanced.",
          status: "Live",
          icon: "🧠",
          color: "from-purple-500/20 to-fuchsia-500/10",
          link: "/learn/studio",
        },
        {
          title: "Coaching notes & sources",
          description:
            "Saved responses, flashcards, and notes that shape how the agent answers future questions.",
          status: "Queued",
          icon: "🗂️",
          color: "from-amber-500/20 to-orange-500/10",
          link: "/learn/sources",
        },
      ]);
    } catch (error) {
      console.error("Failed to load learning overview", error);
    } finally {
      setLoading(false);
    }
  };

  const learningScore = useMemo(() => {
    if (snapshot.totalChallenges === 0) return 0;
    const completionRatio =
      snapshot.totalChallenges === 0
        ? 0
        : snapshot.completedChallenges / snapshot.totalChallenges;
    return Math.round((completionRatio * 0.6 + snapshot.avgScore / 100 * 0.4) * 100);
  }, [snapshot]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Calibrating your learning centre...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-widest text-white/70">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              Cloud Academy Learning Centre
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Coaching that adapts to you.
              </h1>
              <p className="mt-4 text-base text-white/70 md:text-lg">
                Our learning coach keeps score on every challenge, audit, and chat so it can queue the next
                best move. This hub simply shows you where you stand and what to do next—no jargon, just a clear runway.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2 bg-cyan-600 hover:bg-cyan-500">
                <Link href="/learn/guide">
                  Build my study guide
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="gap-2 border-white/30 text-white">
                <Link href="/learn/chat">
                  Talk to the coach
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative w-full max-w-sm self-stretch rounded-2xl border border-white/10 bg-white/5 p-6 text-white">
            <div className="text-sm uppercase tracking-widest text-white/60">Learning telemetry</div>
            <div className="mt-6 space-y-4">
              <div>
                <p className="text-xs text-white/60">Momentum score</p>
                <p className="text-5xl font-semibold text-white">{learningScore}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-white/80">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-white/60">Challenges</p>
                  <p className="text-2xl font-semibold">{snapshot.completedChallenges}</p>
                  <p className="text-xs text-white/50">of {snapshot.totalChallenges}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] uppercase tracking-widest text-white/60">Avg score</p>
                  <p className="text-2xl font-semibold">{snapshot.avgScore}%</p>
                  <p className="text-xs text-white/50">last 7 days</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-white/60">Focus mix</p>
                <div className="mt-2 space-y-2">
                  {snapshot.focusAreas.map((area) => (
                    <div key={area.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-white/70">
                        <span>{area.label}</span>
                        <span>{area.progress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                          style={{ width: `${area.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute -right-16 top-10 hidden h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl md:block" />
        <div className="pointer-events-none absolute -bottom-16 left-24 hidden h-56 w-56 rounded-full bg-blue-500/20 blur-3xl md:block" />
      </section>

      {/* Guidance row */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/5 bg-white/5">
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/60">Next milestones</p>
              <h2 className="text-xl font-semibold text-white">Your upcoming checkpoints</h2>
            </div>
            {snapshot.upcomingMilestones.length === 0 ? (
              <p className="text-sm text-white/60">Once the coach sees more activity it will surface deadlines here.</p>
            ) : (
              <div className="space-y-3">
                {snapshot.upcomingMilestones.map((milestone) => (
                  <div key={milestone.title} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{milestone.title}</p>
                        <p className="text-xs text-white/70">{milestone.description}</p>
                      </div>
                      <Badge className="bg-cyan-500/20 text-cyan-200">{milestone.eta}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button asChild variant="ghost" className="w-full gap-2 text-white">
              <Link href="/learn/guide">
                Open study guide inputs
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-slate-950/80">
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/60">Coach suggestions</p>
              <h2 className="text-xl font-semibold text-white">What to do right now</h2>
            </div>
            <div className="space-y-3">
              {[
                {
                  title: "Generate a fresh study plan",
                  detail: "Lock in your target exam + timeframe so the guide can adapt the challenges feed.",
                  link: "/learn/guide",
                },
                {
                  title: "Audit your latest diagram",
                  detail: "Kick off an audit in the challenge workspace to give the coach new architecture signal.",
                  link: "/challenges",
                },
                {
                  title: "Save takeaways to Notes",
                  detail: "Capturing lessons keeps the assistant grounded in your language.",
                  link: "/learn/notes",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-white/70">{item.detail}</p>
                  <Button asChild variant="ghost" className="mt-3 h-8 gap-2 text-white">
                    <Link href={item.link}>
                      Go
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Active threads */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/60">Active threads</p>
            <h2 className="text-2xl font-semibold text-white">Everything feeds the journey</h2>
          </div>
          <Button asChild variant="ghost" className="text-white/80">
            <Link href="/learn/sources">
              View all sources
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {threads.map((thread) => (
            <div
              key={thread.title}
              className={`rounded-3xl border border-white/10 bg-gradient-to-br ${thread.color} p-6 text-white`}
            >
              <div className="flex items-center gap-3">
                <div className="text-xl">{thread.icon}</div>
                <div className="rounded-full border border-white/30 px-3 py-1 text-xs uppercase tracking-widest text-white/70">
                  {thread.status}
                </div>
              </div>
              <h3 className="mt-4 text-xl font-semibold">{thread.title}</h3>
              <p className="mt-2 text-sm text-white/80">{thread.description}</p>
              <Button asChild variant="ghost" className="mt-5 gap-2 text-white">
                <Link href={thread.link}>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Quick CTA */}
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-indigo-500/10 p-8 text-white">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/70">Keep momentum</p>
            <h2 className="text-2xl font-semibold">Ready for your next rep?</h2>
            <p className="mt-2 text-sm text-white/80">
              Spin up the study guide or drop into the coach whenever you need fresh direction.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild className="gap-2 bg-white text-slate-900 hover:bg-white/90">
              <Link href="/learn/guide">
                Generate plan
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white text-white">
              <Link href="/learn/chat">
                Talk to coach
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
