"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Compass,
  MessageCircle,
  Library,
  Rocket,
  Target,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

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
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({
    totalChallenges: 0,
    completedChallenges: 0,
    avgScore: 0,
    focusAreas: [],
    upcomingMilestones: [],
  });

  const hydrate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dashRes = await fetch("/api/learn/overview");
      if (!dashRes.ok) {
        throw new Error("Failed to fetch overview data");
      }
      const data = (await dashRes.json()) as DashboardApiResponse;
      setSnapshot({
        totalChallenges: data.totalChallenges ?? 0,
        completedChallenges: data.completedChallenges ?? 0,
        avgScore: data.avgScoreLast7Days ?? 0,
        focusAreas: data.focusAreas ?? [],
        upcomingMilestones: data.upcomingMilestones ?? [],
      });
    } catch (err) {
      console.error("Failed to load learning overview", err);
      setError("Unable to load your learning data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const featureCards = [
    {
      title: "Study Guide",
      description: "Your personalised roadmap. Set your exam date and we'll build the path.",
      link: "/learn/guide",
      cta: "Build my plan",
      icon: Compass,
      gradient: "from-violet-500 to-purple-600",
      glow: "group-hover:shadow-violet-500/25",
    },
    {
      title: "AI Coach",
      description: "Stuck on a concept? Chat with your coach for instant, contextual help.",
      link: "/learn/chat",
      cta: "Start chatting",
      icon: MessageCircle,
      gradient: "from-cyan-500 to-blue-600",
      glow: "group-hover:shadow-cyan-500/25",
    },
    {
      title: "Resources",
      description: "Your curated library of videos, docs, and bookmarks—all in one place.",
      link: "/learn/sources",
      cta: "Explore library",
      icon: Library,
      gradient: "from-amber-500 to-orange-600",
      glow: "group-hover:shadow-amber-500/25",
    },
  ];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 blur-xl opacity-30 animate-pulse" />
            <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto mb-4 relative" />
          </div>
          <p className="text-muted-foreground text-lg">Preparing your learning space...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <p className="text-muted-foreground text-lg">{error}</p>
          <Button onClick={hydrate} variant="outline" size="lg" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-16 pb-12">
      {/* Hero - Warm, inviting landing */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900/95 to-slate-950 px-8 py-16 md:px-12 md:py-20"
      >
        {/* Animated ambient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/20 blur-3xl"
          />
          <motion.div
            animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-gradient-to-br from-violet-500/25 to-purple-500/15 blur-3xl"
          />
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute right-1/3 top-1/4 h-40 w-40 rounded-full bg-amber-500/10 blur-2xl"
          />
        </div>

        <div className="relative z-10 max-w-3xl">
          <motion.div variants={fadeInUp} className="mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm font-medium text-cyan-300">
              <Sparkles className="w-4 h-4" />
              Your Learning Sanctuary
            </span>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-4xl font-bold tracking-tight text-white md:text-6xl lg:text-7xl"
          >
            Learn at your
            <span className="block bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
              own pace.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="mt-6 text-lg text-white/60 md:text-xl max-w-2xl leading-relaxed"
          >
            This is your space to grow. Build a study plan that fits your life, chat with an AI coach when you&apos;re stuck, and track your progress—all in one calm, focused environment.
          </motion.p>

          <motion.div variants={fadeInUp} className="mt-10 flex flex-wrap gap-4">
            <Button
              asChild
              size="lg"
              className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-[1.02]"
            >
              <Link href="/learn/guide">
                <Rocket className="w-5 h-5" />
                Start my journey
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="gap-2 border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all"
            >
              <Link href="/learn/chat">
                <MessageCircle className="w-5 h-5" />
                Talk to coach
              </Link>
            </Button>
          </motion.div>
        </div>
      </motion.section>

      {/* Feature Cards - Interactive and inviting */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={staggerContainer}
        className="grid gap-6 md:grid-cols-3"
      >
        {featureCards.map((item) => {
          const Icon = item.icon;
          return (
            <motion.div key={item.title} variants={scaleIn}>
              <Link href={item.link} className="group block h-full">
                <Card className={`relative h-full overflow-hidden border-white/10 bg-slate-950/80 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-slate-900/80 group-hover:shadow-2xl ${item.glow}`}>
                  <CardContent className="p-6 space-y-4">
                    {/* Icon with gradient background */}
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} shadow-lg`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-sm text-white/60 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-medium text-white/70 group-hover:text-white transition-colors">
                      {item.cta}
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </CardContent>

                  {/* Hover glow effect */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </motion.section>

      {/* Progress Section - Softer, more encouraging */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={staggerContainer}
        className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]"
      >
        <motion.div variants={fadeInUp}>
          <Card className="relative overflow-hidden border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/90 backdrop-blur-sm">
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-5 h-5 text-cyan-400" />
                    <p className="text-sm font-medium text-white/70">Your Progress</p>
                  </div>
                  <h2 className="text-2xl font-bold text-white">Keep up the momentum</h2>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                  Live
                </Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/[0.07]"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-sm text-white/60">Challenges</p>
                  </div>
                  <p className="text-4xl font-bold text-white">{snapshot.completedChallenges}</p>
                  <p className="text-sm text-white/40 mt-1">of {snapshot.totalChallenges} completed</p>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/[0.07]"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-sm text-white/60">Avg Score</p>
                  </div>
                  <p className="text-4xl font-bold text-white">{snapshot.avgScore}%</p>
                  <p className="text-sm text-white/40 mt-1">last 7 days</p>
                </motion.div>
              </div>

              <div>
                <p className="text-sm font-medium text-white/70 mb-4">Focus Areas</p>
                <div className="space-y-3">
                  {snapshot.focusAreas.length === 0 ? (
                    <p className="text-sm text-white/40 italic">Complete some challenges to see your focus mix here.</p>
                  ) : (
                    snapshot.focusAreas.map((area) => (
                      <div key={area.label}>
                        <div className="flex items-center justify-between text-sm text-white/70 mb-1.5">
                          <span>{area.label}</span>
                          <span className="font-medium text-white">{area.progress}%</span>
                        </div>
                        <div
                          className="h-2 rounded-full bg-white/10 overflow-hidden"
                          role="progressbar"
                          aria-valuenow={area.progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${area.label} progress`}
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${area.progress}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>

            {/* Subtle background glow */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="relative h-full overflow-hidden border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/90 backdrop-blur-sm">
            <CardContent className="p-8 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Rocket className="w-5 h-5 text-violet-400" />
                  <p className="text-sm font-medium text-white/70">Up Next</p>
                </div>
                <h3 className="text-xl font-bold text-white">Suggested actions</h3>
              </div>

              {snapshot.upcomingMilestones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-white/30" />
                  </div>
                  <p className="text-sm text-white/50">
                    Complete some activities and we&apos;ll suggest your next steps here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {snapshot.upcomingMilestones.map((milestone, index) => {
                    const content = (
                      <>
                        <p className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                          {milestone.title}
                        </p>
                        <p className="text-sm text-white/60 mt-1">{milestone.description}</p>
                        <Badge className="mt-3 bg-white/10 text-white/70 border-white/10">
                          {milestone.eta}
                        </Badge>
                      </>
                    );

                    return milestone.link ? (
                      <motion.div key={`${milestone.title}-${index}`} whileHover={{ scale: 1.01 }}>
                        <Link
                          href={milestone.link}
                          className="group block rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:border-white/20 transition-all"
                        >
                          {content}
                        </Link>
                      </motion.div>
                    ) : (
                      <div
                        key={`${milestone.title}-${index}`}
                        className="rounded-xl border border-white/10 bg-white/5 p-4"
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>

            {/* Subtle background glow */}
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
          </Card>
        </motion.div>
      </motion.section>
    </div>
  );
}
