"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
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
    link?: string;
  }>;
}

interface DashboardApiResponse {
  totalChallenges?: number;
  completedChallenges?: number;
  avgScoreLast7Days?: number;
  focusAreas?: Array<{ label: string; progress: number }>;
  upcomingMilestones?: Array<{ title: string; description: string; eta: string; link?: string }>;
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
  useEffect(() => {
    hydrate();
  }, []);

  const hydrate = async () => {
    try {
      const dashRes = await fetch("/api/learn/overview");
      let data: DashboardApiResponse | null = null;
      if (dashRes.ok) {
        data = (await dashRes.json()) as DashboardApiResponse;
      }
      const stats = data ?? {};
      setSnapshot({
        totalChallenges: stats.totalChallenges ?? 0,
        completedChallenges: stats.completedChallenges ?? 0,
        avgScore: stats.avgScoreLast7Days ?? 0,
        focusAreas: stats.focusAreas ?? [],
        upcomingMilestones: stats.upcomingMilestones ?? [],
      });

    } catch (error) {
      console.error("Failed to load learning overview", error);
    } finally {
      setLoading(false);
    }
  };

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
        <div className="space-y-6 max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-widest text-white/70">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            Cloud Academy Learning Centre
          </div>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Coaching that adapts to you.
            </h1>
            <p className="mt-4 text-base text-white/70 md:text-lg">
              Everything here feeds one of three things: your personalised study plan, the coach chat, or your saved
              sources. Treat this page like the map—pick the tool you need, then let the telemetry guide you.
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
              <Link href="/learn/sources">
                Browse sources
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-16 top-10 hidden h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl md:block" />
        <div className="pointer-events-none absolute -bottom-16 left-24 hidden h-56 w-56 rounded-full bg-blue-500/20 blur-3xl md:block" />
      </section>

      {/* How this hub works */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Guide",
            description: "Tell us your exam target and hours. We’ll crunch telemetry and deliver a SMART plan.",
            link: "/learn/guide",
            cta: "Open Guide",
          },
          {
            title: "Coach",
            description: "Chat with the assistant when you’re stuck mid-challenge or want live feedback.",
            link: "/learn/chat",
            cta: "Talk to coach",
          },
          {
            title: "Studio",
            description: "Run audits or practice diagrams to give the coach fresh architecture signal.",
            link: "/learn/studio",
            cta: "Launch Studio",
          },
          {
            title: "Resources",
            description: "Save videos, docs, and links so you never have to hunt through tabs again.",
            link: "/learn/sources",
            cta: "View resources",
          },
        ].map((item) => (
          <Card key={item.title} className="border-white/10 bg-slate-950/70">
            <CardContent className="p-5 space-y-3">
              <p className="text-xs uppercase tracking-widest text-white/60">{item.title}</p>
              <p className="text-sm text-white/80">{item.description}</p>
              <Button asChild variant="ghost" className="gap-2 text-white">
                <Link href={item.link}>
                  {item.cta}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Telemetry + actions */}
      <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/60">Momentum snapshot</p>
                <h2 className="text-xl font-semibold text-white">Where you stand today</h2>
              </div>
              <Badge className="bg-cyan-500/20 text-cyan-100">Live</Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <p className="text-xs text-white/60">Challenges completed</p>
                <p className="text-3xl font-semibold text-white">{snapshot.completedChallenges}</p>
                <p className="text-xs text-white/50">of {snapshot.totalChallenges}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <p className="text-xs text-white/60">Average score</p>
                <p className="text-3xl font-semibold text-white">{snapshot.avgScore}%</p>
                <p className="text-xs text-white/50">last 7 days</p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-white/60 mb-3">Focus mix</p>
              <div className="space-y-2">
                {snapshot.focusAreas.map((area) => (
                  <div key={area.label}>
                    <div className="flex items-center justify-between text-xs text-white/70">
                      <span>{area.label}</span>
                      <span>{area.progress}%</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                        style={{ width: `${area.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/80">
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/60">Next best moves</p>
              <h3 className="text-lg font-semibold text-white">Do one of these now</h3>
            </div>
            {snapshot.upcomingMilestones.length === 0 ? (
              <p className="text-sm text-white/60">
                The coach will surface deadlines as soon as more activity comes in.
              </p>
            ) : (
              <div className="space-y-3">
                {snapshot.upcomingMilestones.map((milestone) => (
                  <Link
                    key={milestone.title}
                    href={milestone.link || "#"}
                    className="block rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors"
                  >
                    <p className="text-sm font-semibold text-white">{milestone.title}</p>
                    <p className="text-xs text-white/70">{milestone.description}</p>
                    <Badge className="mt-2 bg-cyan-500/20 text-cyan-200">{milestone.eta}</Badge>
                  </Link>
                ))}
              </div>
            )}
            <div className="grid gap-2">
              <Button asChild className="w-full gap-2">
                <Link href="/learn/guide">
                  Update study plan
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" className="w-full gap-2 bg-white/10 text-white hover:bg-white/20">
                <Link href="/learn/studio">
                  Launch Studio drill
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
