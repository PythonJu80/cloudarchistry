import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AWS_SERVICES } from "@/lib/aws-services";

type FocusBucketKey = "compute_containers" | "networking_edge" | "security_identity" | "data_storage" | "other";

const SERVICE_CATEGORY_BY_ID = new Map(AWS_SERVICES.map((s) => [s.id, s.category] as const));

function bucketForServiceId(serviceId: string): FocusBucketKey {
  const category = SERVICE_CATEGORY_BY_ID.get(serviceId);
  switch (category) {
    case "compute":
    case "containers":
      return "compute_containers";
    case "networking":
      return "networking_edge";
    case "security":
    case "governance":
    case "policies":
      return "security_identity";
    case "database":
    case "storage":
    case "analytics":
      return "data_storage";
    default:
      return "other";
  }
}

const BUCKET_LABELS: Record<FocusBucketKey, string> = {
  compute_containers: "Compute & Containers",
  networking_edge: "Networking & Edge",
  security_identity: "Security & Identity",
  data_storage: "Data & Storage",
  other: "Other",
};

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string") as string[];
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({
        totalChallenges: 0,
        completedChallenges: 0,
        avgScoreLast7Days: 0,
        focusAreas: [],
        upcomingMilestones: [],
      });
    }

    const profileId = session.user.academyProfileId;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalChallenges,
      completedChallenges,
      recentCompletions,
      nextChallenge,
      flashcardToReview,
      nextQuiz,
    ] = await Promise.all([
      prisma.challengeProgress.count({
        where: { attempt: { profileId } },
      }),
      prisma.challengeProgress.count({
        where: { attempt: { profileId }, status: "completed" },
      }),
      prisma.challengeProgress.findMany({
        where: {
          attempt: { profileId },
          status: "completed",
          completedAt: { gte: since },
        },
        select: {
          pointsEarned: true,
          challenge: {
            select: {
              points: true,
              awsServices: true,
            },
          },
        },
      }),
      // Next available/in-progress challenge
      prisma.challengeProgress.findFirst({
        where: {
          attempt: { profileId },
          status: { in: ["available", "in_progress"] },
        },
        orderBy: { attempt: { startedAt: "desc" } },
        select: {
          challenge: {
            select: {
              id: true,
              title: true,
              difficulty: true,
              estimatedMinutes: true,
            },
          },
          attempt: {
            select: {
              scenario: {
                select: { title: true },
              },
            },
          },
        },
      }),
      // Flashcard deck with lowest mastery
      prisma.flashcardProgress.findFirst({
        where: { profileId },
        orderBy: { cardsMastered: "asc" },
        select: {
          deck: {
            select: {
              id: true,
              title: true,
              totalCards: true,
            },
          },
          cardsMastered: true,
        },
      }),
      // Next quiz not yet passed
      prisma.quizAttempt.findFirst({
        where: { profileId, passed: false },
        orderBy: { completedAt: "desc" },
        select: {
          quiz: {
            select: {
              id: true,
              title: true,
              questionCount: true,
            },
          },
          score: true,
        },
      }),
    ]);

    let avgScoreLast7Days = 0;
    if (recentCompletions.length > 0) {
      const percentages = recentCompletions
        .map((cp) => {
          const maxPoints = cp.challenge.points || 0;
          if (maxPoints <= 0) return null;
          return Math.max(0, Math.min(100, Math.round((cp.pointsEarned / maxPoints) * 100)));
        })
        .filter((v): v is number => typeof v === "number");

      if (percentages.length > 0) {
        avgScoreLast7Days = Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length);
      }
    }

    const bucketCounts: Record<FocusBucketKey, number> = {
      compute_containers: 0,
      networking_edge: 0,
      security_identity: 0,
      data_storage: 0,
      other: 0,
    };

    for (const completion of recentCompletions) {
      const services = safeArray(completion.challenge.awsServices);
      if (services.length === 0) {
        bucketCounts.other += 1;
        continue;
      }
      for (const serviceId of services) {
        bucketCounts[bucketForServiceId(serviceId)] += 1;
      }
    }

    const totalSignals = Object.values(bucketCounts).reduce((a, b) => a + b, 0);
    const focusAreas = Object.entries(bucketCounts)
      .map(([key, count]) => ({
        label: BUCKET_LABELS[key as FocusBucketKey],
        progress: totalSignals > 0 ? Math.round((count / totalSignals) * 100) : 0,
      }))
      .filter((a) => a.progress > 0)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 3);

    // Build actual next actions (not distant milestones)
    const nextActions: Array<{ title: string; description: string; eta: string; link: string }> = [];

    if (nextChallenge) {
      const mins = nextChallenge.challenge.estimatedMinutes || 30;
      nextActions.push({
        title: nextChallenge.challenge.title,
        description: `Continue this ${nextChallenge.challenge.difficulty} challenge from ${nextChallenge.attempt.scenario.title}`,
        eta: `~${mins} min`,
        link: `/challenges/${nextChallenge.challenge.id}`,
      });
    }

    if (flashcardToReview && flashcardToReview.deck) {
      const remaining = (flashcardToReview.deck.totalCards || 0) - (flashcardToReview.cardsMastered || 0);
      if (remaining > 0) {
        nextActions.push({
          title: `Review: ${flashcardToReview.deck.title}`,
          description: `${remaining} cards left to master`,
          eta: "5-10 min",
          link: `/learn/flashcards/${flashcardToReview.deck.id}`,
        });
      }
    }

    if (nextQuiz && nextQuiz.quiz) {
      nextActions.push({
        title: `Retry: ${nextQuiz.quiz.title}`,
        description: `Last score: ${nextQuiz.score}% – ${nextQuiz.quiz.questionCount} questions`,
        eta: "10-15 min",
        link: `/learn/quiz/${nextQuiz.quiz.id}`,
      });
    }

    // Limit to 3 actions
    const upcomingMilestones = nextActions.slice(0, 3);

    return NextResponse.json({
      totalChallenges,
      completedChallenges,
      avgScoreLast7Days,
      focusAreas,
      upcomingMilestones,
    });
  } catch (error) {
    console.error("Learn overview GET failed:", error);
    return NextResponse.json(
      {
        totalChallenges: 0,
        completedChallenges: 0,
        avgScoreLast7Days: 0,
        focusAreas: [],
        upcomingMilestones: [],
      },
      { status: 500 }
    );
  }
}
