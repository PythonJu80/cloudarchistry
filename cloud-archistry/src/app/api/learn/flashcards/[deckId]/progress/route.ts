import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/learn/flashcards/[deckId]/progress
 * Record study progress for a flashcard
 * Uses SM-2 spaced repetition algorithm
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { deckId } = await params;
    const profileId = session.user.academyProfileId;
    const body = await request.json();
    const { cardId, quality, timeSpentSeconds = 0 } = body;

    // quality: 0-5 (SM-2 algorithm)
    // 0 = complete failure, 5 = perfect recall
    // Simplified: 0-2 = wrong, 3-5 = correct
    if (typeof quality !== "number" || quality < 0 || quality > 5) {
      return NextResponse.json(
        { error: "quality must be 0-5" },
        { status: 400 }
      );
    }

    if (!cardId) {
      return NextResponse.json(
        { error: "cardId is required" },
        { status: 400 }
      );
    }

    // Get or create user deck progress
    let userProgress = await prisma.flashcardUserProgress.findUnique({
      where: {
        profileId_deckId: { profileId, deckId },
      },
    });

    if (!userProgress) {
      userProgress = await prisma.flashcardUserProgress.create({
        data: {
          profileId,
          deckId,
          cardsStudied: 0,
          cardsMastered: 0,
          totalReviews: 0,
          currentStreak: 0,
          totalTimeMinutes: 0,
        },
      });
    }

    // Get or create card progress
    let cardProgress = await prisma.flashcardProgress.findUnique({
      where: {
        userProgressId_cardId: {
          userProgressId: userProgress.id,
          cardId,
        },
      },
    });

    const now = new Date();
    const isCorrect = quality >= 3;

    if (!cardProgress) {
      // First time seeing this card
      const { easeFactor, interval, status, nextReviewAt } = calculateSM2(
        2.5, // default ease factor
        1, // default interval
        0, // no repetitions yet
        quality
      );

      cardProgress = await prisma.flashcardProgress.create({
        data: {
          userProgressId: userProgress.id,
          cardId,
          easeFactor,
          interval,
          repetitions: isCorrect ? 1 : 0,
          status,
          nextReviewAt,
          lastReviewAt: now,
          totalReviews: 1,
          correctCount: isCorrect ? 1 : 0,
        },
      });

      // Update deck progress - new card studied
      await prisma.flashcardUserProgress.update({
        where: { id: userProgress.id },
        data: {
          cardsStudied: { increment: 1 },
          totalReviews: { increment: 1 },
          cardsMastered: status === "mastered" ? { increment: 1 } : undefined,
          lastStudiedAt: now,
          totalTimeMinutes: { increment: Math.ceil(timeSpentSeconds / 60) },
        },
      });
    } else {
      // Update existing card progress
      const { easeFactor, interval, status, nextReviewAt } = calculateSM2(
        cardProgress.easeFactor,
        cardProgress.interval,
        cardProgress.repetitions,
        quality
      );

      const wasMastered = cardProgress.status === "mastered";
      const isMastered = status === "mastered";

      await prisma.flashcardProgress.update({
        where: { id: cardProgress.id },
        data: {
          easeFactor,
          interval,
          repetitions: isCorrect ? cardProgress.repetitions + 1 : 0,
          status,
          nextReviewAt,
          lastReviewAt: now,
          totalReviews: { increment: 1 },
          correctCount: isCorrect ? { increment: 1 } : undefined,
        },
      });

      // Update deck progress
      await prisma.flashcardUserProgress.update({
        where: { id: userProgress.id },
        data: {
          totalReviews: { increment: 1 },
          cardsMastered: !wasMastered && isMastered
            ? { increment: 1 }
            : wasMastered && !isMastered
            ? { decrement: 1 }
            : undefined,
          lastStudiedAt: now,
          totalTimeMinutes: { increment: Math.ceil(timeSpentSeconds / 60) },
        },
      });
    }

    // Log activity
    await prisma.academyActivity.create({
      data: {
        tenantId: session.user.tenantId || "default",
        profileId,
        type: "flashcard_review",
        data: {
          deckId,
          cardId,
          quality,
          isCorrect,
        },
      },
    });

    return NextResponse.json({
      success: true,
      isCorrect,
      cardProgress: {
        status: cardProgress?.status,
        nextReviewAt: cardProgress?.nextReviewAt,
      },
    });
  } catch (error) {
    console.error("Flashcard progress POST error:", error);
    return NextResponse.json(
      { error: "Failed to record progress" },
      { status: 500 }
    );
  }
}

/**
 * SM-2 Spaced Repetition Algorithm
 * Based on SuperMemo 2 algorithm
 */
function calculateSM2(
  currentEF: number,
  currentInterval: number,
  repetitions: number,
  quality: number // 0-5
): {
  easeFactor: number;
  interval: number;
  status: string;
  nextReviewAt: Date;
} {
  // Calculate new ease factor
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  let newEF = currentEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEF = Math.max(1.3, newEF); // EF should never go below 1.3

  let newInterval: number;
  let newReps = repetitions;

  if (quality < 3) {
    // Wrong answer - reset
    newInterval = 1;
    newReps = 0;
  } else {
    // Correct answer
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(currentInterval * newEF);
    }
    newReps = repetitions + 1;
  }

  // Determine status
  let status: string;
  if (newReps === 0) {
    status = "learning";
  } else if (newReps < 3) {
    status = "review";
  } else if (newInterval >= 21) {
    status = "mastered";
  } else {
    status = "review";
  }

  // Calculate next review date
  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);

  return {
    easeFactor: newEF,
    interval: newInterval,
    status,
    nextReviewAt,
  };
}
