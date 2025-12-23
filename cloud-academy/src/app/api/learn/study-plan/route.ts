import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";
import type { Prisma } from "@prisma/client";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "http://10.121.19.210:1027";
const HISTORY_LIMIT = 5;

type TelemetryHints = {
  skillLevel: string | null;
  targetCertification: string | null;
  challengeHighlights: { title: string | null; difficulty: string | null; completedAt: string | null }[];
  examInsights: { certification?: string | null; score?: number | null; passed?: boolean | null }[];
  flashcardHighlights: { deck?: string | null; cardsMastered: number; totalReviews: number }[];
  recommendedWeakAreas: string[];
  recommendedFocusDomains: string[];
  recommendedFormats: string[];
};

type TelemetryPayload = {
  summary: string;
  hints: TelemetryHints;
};

function ensureEnv() {
  if (!LEARNING_AGENT_URL) {
    throw new Error("LEARNING_AGENT_URL is not configured");
  }
}

function formatDateRange(weeks: number, examDate?: Date | null) {
  if (examDate) {
    return `${weeks} weeks (target ${examDate.toISOString().slice(0, 10)})`;
  }
  return `${weeks} weeks`;
}

function calculateWeeksUntil(examDate?: string | null) {
  if (!examDate) return 6;
  const target = new Date(examDate);
  if (Number.isNaN(target.getTime())) return 6;
  const diffMs = target.getTime() - Date.now();
  const weeks = Math.max(2, Math.round(diffMs / (1000 * 60 * 60 * 24 * 7)));
  return weeks;
}

type DomainScore = number | { percentage?: number; score?: number } | null;

type SerializedPlan = {
  id: string;
  targetExam: string | null;
  examDate: Date | null;
  studyHoursPerWeek: number | null;
  confidenceLevel: string | null;
  planInputs: Prisma.JsonValue;
  planOutput: Prisma.JsonValue | null;
  generatedAt: Date;
};

function serializePlan(plan: Prisma.StudyPlan): SerializedPlan {
  return {
    id: plan.id,
    targetExam: plan.targetExam,
    examDate: plan.examDate,
    studyHoursPerWeek: plan.studyHoursPerWeek,
    confidenceLevel: plan.confidenceLevel,
    planInputs: plan.planInputs,
    planOutput: plan.planOutput,
    generatedAt: plan.generatedAt,
  };
}

async function buildTelemetry(profileId: string): Promise<TelemetryPayload> {
  const profile = await prisma.academyUserProfile.findUnique({
    where: { id: profileId },
    select: {
      displayName: true,
      skillLevel: true,
      targetCertification: true,
      challengesCompleted: true,
      totalPoints: true,
      currentStreak: true,
    },
  });

  const [recentChallenges, examAttempts, flashcards] = await Promise.all([
    prisma.challengeProgress.findMany({
      where: {
        status: "completed",
        attempt: {
          profileId,
        },
      },
      orderBy: { completedAt: "desc" },
      take: 3,
      select: {
        completedAt: true,
        challenge: {
          select: {
            title: true,
            difficulty: true,
            awsServices: true,
          },
        },
      },
    }),
    prisma.examAttempt.findMany({
      where: { profileId },
      orderBy: { completedAt: "desc" },
      take: 3,
      select: {
        score: true,
        passed: true,
        domainScores: true,
        exam: {
          select: { title: true, certificationCode: true },
        },
      },
    }),
    prisma.flashcardProgress.findMany({
      where: { profileId },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: {
        cardsMastered: true,
        totalReviews: true,
        deck: { select: { title: true } },
      },
    }),
  ]);

  const recommendedWeakAreas = new Set<string>();
  const recommendedFocusDomains = new Set<string>();

  examAttempts.forEach((attempt) => {
    const domains = attempt.domainScores as Record<string, DomainScore> | null;
    if (!domains) return;
    Object.entries(domains).forEach(([domain, stats]) => {
      const percentage =
        typeof stats === "number"
          ? stats
          : stats && typeof stats === "object"
            ? stats.percentage ?? stats.score
            : undefined;
      if (typeof percentage === "number" && percentage < 70) {
        recommendedWeakAreas.add(domain);
      }
      recommendedFocusDomains.add(domain);
    });
  });

  const recommendedFormats = new Set<string>();
  if (flashcards.length > 0) recommendedFormats.add("flashcards");
  if (recentChallenges.length > 0) recommendedFormats.add("challenges");
  if (examAttempts.length > 0) recommendedFormats.add("practice-exams");

  const summaryParts: string[] = [];
  summaryParts.push(
    `Learner: ${profile?.displayName || "Unknown"} | Skill: ${profile?.skillLevel || "intermediate"}`,
  );
  summaryParts.push(
    `Target certification: ${profile?.targetCertification || "not set"} | Completed challenges: ${
      profile?.challengesCompleted ?? 0
    }`,
  );
  summaryParts.push(
    `Total points: ${profile?.totalPoints ?? 0} | Current streak: ${profile?.currentStreak ?? 0} days`,
  );

  if (recentChallenges.length > 0) {
    summaryParts.push(
      "Recent challenges:" +
        recentChallenges
          .map((c) => ` ${c.challenge?.title} (${c.challenge?.difficulty ?? "n/a"})`)
          .join(";")
    );
  }

  if (examAttempts.length > 0) {
    summaryParts.push(
      "Practice exams:" +
        examAttempts
          .map((a) => ` ${a.exam?.certificationCode}: ${a.score ?? "n/a"}%${a.passed ? " (pass)" : ""}`)
          .join(";")
    );
  }

  if (flashcards.length > 0) {
    summaryParts.push(
      "Flashcards:" +
        flashcards.map((f) => ` ${f.deck?.title}: ${f.cardsMastered} mastered`).join(";")
    );
  }

  const hints: TelemetryHints = {
    skillLevel: profile?.skillLevel || null,
    targetCertification: profile?.targetCertification || null,
    challengeHighlights: recentChallenges.map((c) => ({
      title: c.challenge?.title ?? null,
      difficulty: c.challenge?.difficulty ?? null,
      completedAt: c.completedAt ? c.completedAt.toISOString() : null,
    })),
    examInsights: examAttempts.map((a) => ({
      certification: a.exam?.certificationCode,
      score: a.score,
      passed: a.passed,
    })),
    flashcardHighlights: flashcards.map((f) => ({
      deck: f.deck?.title,
      cardsMastered: f.cardsMastered,
      totalReviews: f.totalReviews,
    })),
    recommendedWeakAreas: Array.from(recommendedWeakAreas),
    recommendedFocusDomains: Array.from(recommendedFocusDomains),
    recommendedFormats: Array.from(recommendedFormats),
  };

  return {
    summary: summaryParts.join("\n"),
    hints,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const [telemetry, plans] = await Promise.all([
      buildTelemetry(profileId),
      prisma.studyPlan.findMany({
        where: { profileId },
        orderBy: { generatedAt: "desc" },
        take: HISTORY_LIMIT,
      }),
    ]);

    return NextResponse.json({
      latestPlan: plans[0] ? serializePlan(plans[0]) : null,
      history: plans.slice(1).map(serializePlan),
      hints: telemetry.hints,
    });
  } catch (error) {
    console.error("Study plan GET failed", error);
    return NextResponse.json({ error: "Failed to load study plans" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureEnv();

    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;

    const body = await request.json();
    const {
      targetExam,
      examDate,
      studyHoursPerWeek = 6,
      confidenceLevel = "intermediate",
      weakAreas = [],
      focusDomains = [],
      preferredFormats = [],
      learnerNotes,
    } = body;

    // Get AI config (optional - will use .env if not provided)
    const aiConfig = await getAiConfigForRequest(profileId);

    const telemetry = await buildTelemetry(profileId);
    const weeks = calculateWeeksUntil(examDate || null);

    const response = await fetch(`${LEARNING_AGENT_URL}/api/learning/generate-study-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_exam: targetExam || telemetry.hints.targetCertification || null,
        time_horizon_weeks: weeks,
        study_hours_per_week: studyHoursPerWeek,
        confidence_level: confidenceLevel,
        weak_areas: weakAreas,
        focus_domains: focusDomains,
        preferred_formats: preferredFormats,
        learner_notes: learnerNotes,
        telemetry_summary: telemetry.summary,
        openai_api_key: aiConfig.key,
        preferred_model: aiConfig.preferredModel,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Learning agent error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    if (!data?.success || !data?.plan) {
      return NextResponse.json(
        { error: "Learning agent returned an invalid payload" },
        { status: 502 }
      );
    }

    const planRecord = await prisma.studyPlan.create({
      data: {
        profileId,
        targetExam: targetExam || telemetry.hints.targetCertification,
        examDate: examDate ? new Date(examDate) : null,
        studyHoursPerWeek,
        confidenceLevel,
        planInputs: {
          targetExam,
          examDate,
          studyHoursPerWeek,
          confidenceLevel,
          weakAreas,
          focusDomains,
          preferredFormats,
          learnerNotes,
          telemetrySummary: telemetry.summary,
          timeHorizon: formatDateRange(weeks, examDate ? new Date(examDate) : null),
        },
        planOutput: data.plan,
      },
    });

    return NextResponse.json({
      plan: serializePlan(planRecord),
    });
  } catch (error) {
    console.error("Study plan POST failed", error);
    return NextResponse.json({ error: "Failed to generate study plan" }, { status: 500 });
  }
}
