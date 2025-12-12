import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/learn/flashcards/[deckId]
 * Get a specific flashcard deck with all cards and user progress
 */
export async function GET(
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

    // Get deck with cards and user progress
    const deck = await prisma.flashcardDeck.findUnique({
      where: { id: deckId },
      include: {
        scenario: {
          select: {
            id: true,
            title: true,
            location: {
              select: { name: true, country: true },
            },
          },
        },
        cards: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            front: true,
            back: true,
            frontType: true,
            backType: true,
            difficulty: true,
            tags: true,
            awsServices: true,
            orderIndex: true,
          },
        },
        userProgress: {
          where: { profileId },
          include: {
            cardProgress: {
              select: {
                cardId: true,
                status: true,
                easeFactor: true,
                interval: true,
                repetitions: true,
                nextReviewAt: true,
                lastReviewAt: true,
                totalReviews: true,
                correctCount: true,
              },
            },
          },
        },
      },
    });

    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    const userProgress = deck.userProgress[0] || null;
    const cardProgressMap = new Map(
      userProgress?.cardProgress.map((cp) => [cp.cardId, cp]) || []
    );

    // Transform cards with progress
    const cardsWithProgress = deck.cards.map((card) => {
      const progress = cardProgressMap.get(card.id);
      return {
        id: card.id,
        front: card.front,
        back: card.back,
        frontType: card.frontType,
        backType: card.backType,
        difficulty: card.difficulty,
        tags: card.tags,
        awsServices: card.awsServices,
        orderIndex: card.orderIndex,
        progress: progress
          ? {
              status: progress.status,
              easeFactor: progress.easeFactor,
              interval: progress.interval,
              repetitions: progress.repetitions,
              nextReviewAt: progress.nextReviewAt,
              lastReviewAt: progress.lastReviewAt,
              totalReviews: progress.totalReviews,
              correctCount: progress.correctCount,
            }
          : null,
      };
    });

    return NextResponse.json({
      deck: {
        id: deck.id,
        title: deck.title,
        description: deck.description,
        totalCards: deck.totalCards,
        scenarioId: deck.scenarioId,
        scenarioTitle: deck.scenario.title,
        locationName: deck.scenario.location?.name || "Unknown",
        generatedBy: deck.generatedBy,
        createdAt: deck.createdAt,
        cards: cardsWithProgress,
        userProgress: userProgress
          ? {
              cardsStudied: userProgress.cardsStudied,
              cardsMastered: userProgress.cardsMastered,
              totalReviews: userProgress.totalReviews,
              lastStudiedAt: userProgress.lastStudiedAt,
              currentStreak: userProgress.currentStreak,
              totalTimeMinutes: userProgress.totalTimeMinutes,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Flashcard deck GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch flashcard deck" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/learn/flashcards/[deckId]
 * Delete a flashcard deck (soft delete - set isActive to false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { deckId } = await params;

    // Soft delete the deck
    await prisma.flashcardDeck.update({
      where: { id: deckId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Flashcard deck DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete flashcard deck" },
      { status: 500 }
    );
  }
}
