import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || process.env.NEXT_PUBLIC_LEARNING_AGENT_URL || "https://cloudarchistry.com";

/**
 * GET /api/learn/flashcards
 * List all flashcard decks for the current user (both scenario-based and certification-based)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;

    // Get all flashcard decks - both scenario-based and certification-based
    const decks = await prisma.flashcardDeck.findMany({
      where: {
        isActive: true,
        OR: [
          { profileId }, // User's certification-based decks
          { scenarioId: { not: null } }, // Scenario-based decks (shared)
        ],
      },
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

    // Transform for frontend - handle both deck types
    const transformedDecks = decks.map((deck) => {
      const progress = deck.userProgress[0] || null;
      const isCertificationBased = deck.deckType === "certification";
      
      return {
        id: deck.id,
        title: deck.title,
        description: deck.description,
        totalCards: deck.totalCards,
        deckType: deck.deckType,
        // Scenario info (may be null for certification-based decks)
        scenarioId: deck.scenarioId,
        scenarioTitle: deck.scenario?.title || null,
        locationName: deck.scenario?.location?.name || (isCertificationBased ? "Certification Study" : "Unknown"),
        // Certification info (for certification-based decks)
        certificationCode: deck.certificationCode,
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
 * Generate a new flashcard deck - either from scenario OR from user's certification/telemetry
 * 
 * Body options:
 * - { scenarioId, cardCount } - Generate from a specific scenario (legacy)
 * - { cardCount } - Generate from user's target certification + skill level (new)
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

    // Get AI config (optional - will use .env if not provided)
    const aiConfig = await getAiConfigForRequest(profileId);

    // Get user profile with telemetry data
    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: profileId },
      select: {
        skillLevel: true,
        targetCertification: true,
        challengesCompleted: true,
        scenariosCompleted: true,
        totalPoints: true,
        level: true,
        achievements: true,
      },
    });

    if (!profile?.targetCertification) {
      return NextResponse.json(
        {
          error: "No target certification set",
          message: "Please set your target AWS certification in Settings before generating flashcards.",
          action: "set_certification",
        },
        { status: 400 }
      );
    }

    if (!LEARNING_AGENT_URL) {
      return NextResponse.json(
        { error: "Learning agent not configured" },
        { status: 500 }
      );
    }

    // Build telemetry summary for AI context
    const telemetrySummary = {
      skillLevel: profile.skillLevel,
      targetCertification: profile.targetCertification,
      challengesCompleted: profile.challengesCompleted,
      scenariosCompleted: profile.scenariosCompleted,
      totalPoints: profile.totalPoints,
      level: profile.level,
      achievements: profile.achievements,
    };

    // Call learning agent to generate flashcards
    const response = await fetch(
      `${LEARNING_AGENT_URL}/api/learning/generate-flashcards`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certification_code: profile.targetCertification,
          user_level: profile.skillLevel || "intermediate",
          card_count: cardCount,
          telemetry: telemetrySummary,
          scenario_id: scenarioId || null,
          openai_api_key: aiConfig?.key,
          preferred_model: aiConfig?.preferredModel,
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

    // Save the deck to our database
    const deck = data.deck;
    const newDeck = await prisma.flashcardDeck.create({
      data: {
        profileId,
        certificationCode: profile.targetCertification,
        title: deck.title,
        description: deck.description,
        generatedBy: "ai",
        aiModel: aiConfig.preferredModel || "gpt-4o",
        deckType: "certification",
        totalCards: deck.cards?.length || 0,
        cards: {
          create: (deck.cards || []).map((card: {
            front: string;
            back: string;
            difficulty?: string;
            tags?: string[];
            awsServices?: string[];
          }, index: number) => ({
            front: card.front,
            back: card.back,
            difficulty: card.difficulty || "medium",
            tags: card.tags || [],
            awsServices: card.awsServices || [],
            orderIndex: index,
          })),
        },
      },
      include: {
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

    return NextResponse.json({
      success: true,
      deck: {
        id: newDeck.id,
        title: newDeck.title,
        description: newDeck.description,
        totalCards: newDeck.totalCards,
        deckType: newDeck.deckType,
        certificationCode: newDeck.certificationCode,
        locationName: "Certification Study",
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
