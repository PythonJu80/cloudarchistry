import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";

const LEARNING_AGENT_URL = process.env.NEXT_PUBLIC_LEARNING_AGENT_URL;

/**
 * GET /api/learn/flashcards
 * List all flashcard decks for the current user
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;

    // Get all flashcard decks with user progress
    const decks = await prisma.flashcardDeck.findMany({
      where: { isActive: true },
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
          select: { id: true, difficulty: true },
        },
        userProgress: {
          where: { profileId },
          select: {
            cardsStudied: true,
            cardsMastered: true,
            totalReviews: true,
            lastStudiedAt: true,
            currentStreak: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform for frontend
    const transformedDecks = decks.map((deck) => {
      const progress = deck.userProgress[0] || null;
      return {
        id: deck.id,
        title: deck.title,
        description: deck.description,
        totalCards: deck.totalCards,
        scenarioId: deck.scenarioId,
        scenarioTitle: deck.scenario.title,
        locationName: deck.scenario.location?.name || "Unknown",
        generatedBy: deck.generatedBy,
        createdAt: deck.createdAt,
        // Difficulty distribution
        difficultyDistribution: {
          easy: deck.cards.filter((c) => c.difficulty === "easy").length,
          medium: deck.cards.filter((c) => c.difficulty === "medium").length,
          hard: deck.cards.filter((c) => c.difficulty === "hard").length,
        },
        // User progress
        userProgress: progress
          ? {
              cardsStudied: progress.cardsStudied,
              cardsMastered: progress.cardsMastered,
              totalReviews: progress.totalReviews,
              lastStudiedAt: progress.lastStudiedAt,
              currentStreak: progress.currentStreak,
            }
          : null,
      };
    });

    return NextResponse.json({ decks: transformedDecks });
  } catch (error) {
    console.error("Flashcards GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch flashcard decks" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/learn/flashcards
 * Generate a new flashcard deck from a scenario
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const body = await request.json();
    const { scenarioId, cardCount = 20 } = body;

    if (!scenarioId) {
      return NextResponse.json(
        { error: "scenarioId is required" },
        { status: 400 }
      );
    }

    // Get AI config
    const aiConfig = await getAiConfigForRequest(profileId);
    if (!aiConfig) {
      return NextResponse.json(
        {
          error: "OpenAI API key required",
          message: "Add an API key in Settings to generate flashcards.",
          action: "configure_api_key",
        },
        { status: 402 }
      );
    }

    // Get user profile for persona
    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: profileId },
      select: { skillLevel: true, targetCertification: true },
    });

    if (!LEARNING_AGENT_URL) {
      return NextResponse.json(
        { error: "Learning agent not configured" },
        { status: 500 }
      );
    }

    // Call learning agent to generate flashcards
    const response = await fetch(
      `${LEARNING_AGENT_URL}/api/learning/generate-flashcards`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_id: scenarioId,
          user_level: profile?.skillLevel || "intermediate",
          persona_id: profile?.targetCertification || null,
          options: { card_count: cardCount },
          openai_api_key: aiConfig.key,
          preferred_model: aiConfig.preferredModel,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Learning agent error:", errorText);
      return NextResponse.json(
        { error: `Failed to generate flashcards: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    if (!data.success) {
      return NextResponse.json(
        { error: data.error || "Failed to generate flashcards" },
        { status: 500 }
      );
    }

    // The learning agent saves to the DB, but we need to fetch and return the deck
    // First, find the deck by scenario
    const newDeck = await prisma.flashcardDeck.findFirst({
      where: { scenarioId, isActive: true },
      orderBy: { createdAt: "desc" },
      include: {
        scenario: {
          select: {
            title: true,
            location: { select: { name: true } },
          },
        },
        cards: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            front: true,
            back: true,
            difficulty: true,
            tags: true,
            awsServices: true,
          },
        },
      },
    });

    if (!newDeck) {
      return NextResponse.json(
        { error: "Deck created but could not be retrieved" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deck: {
        id: newDeck.id,
        title: newDeck.title,
        description: newDeck.description,
        totalCards: newDeck.totalCards,
        scenarioTitle: newDeck.scenario.title,
        locationName: newDeck.scenario.location?.name || "Unknown",
        cards: newDeck.cards.map((c) => ({
          id: c.id,
          front: c.front,
          back: c.back,
          difficulty: c.difficulty,
          tags: c.tags,
          awsServices: c.awsServices,
        })),
      },
    });
  } catch (error) {
    console.error("Flashcards POST error:", error);
    return NextResponse.json(
      { error: "Failed to generate flashcard deck" },
      { status: 500 }
    );
  }
}
