"use client";

import { useState, useEffect } from "react";
import {
  Layers,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Loader2,
  AlertCircle,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface FlashcardProgress {
  status: string;
  nextReviewAt: string | null;
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty: string;
  tags: string[];
  awsServices: string[];
  progress: FlashcardProgress | null;
}

interface DeckUserProgress {
  cardsStudied: number;
  cardsMastered: number;
  totalReviews: number;
  lastStudiedAt: string | null;
  currentStreak: number;
}

interface FlashcardDeck {
  id: string;
  title: string;
  description: string | null;
  totalCards: number;
  deckType?: string;
  scenarioId?: string | null;
  scenarioTitle?: string | null;
  locationName: string;
  certificationCode?: string | null;
  generatedBy: string;
  createdAt: string;
  cards?: Flashcard[];
  userProgress: DeckUserProgress | null;
  difficultyDistribution?: {
    easy: number;
    medium: number;
    hard: number;
  };
}

export default function FlashcardsPage() {
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Fetch decks on mount
  useEffect(() => {
    fetchDecks();
  }, []);

  const fetchDecks = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/learn/flashcards");
      if (!res.ok) throw new Error("Failed to fetch decks");
      const data = await res.json();
      setDecks(data.decks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load flashcards");
    } finally {
      setLoading(false);
    }
  };

  const fetchDeckWithCards = async (deckId: string) => {
    try {
      const res = await fetch(`/api/learn/flashcards/${deckId}`);
      if (!res.ok) throw new Error("Failed to fetch deck");
      const data = await res.json();
      return data.deck as FlashcardDeck;
    } catch (err) {
      console.error("Error fetching deck:", err);
      return null;
    }
  };

  // Generate flashcards from user's certification + telemetry (simplified - no scenario needed)
  const handleGenerateDeck = async () => {
    try {
      setGenerating(true);
      setError(null);
      
      const res = await fetch("/api/learn/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardCount: 20 }),
      });
      
      if (res.status === 402) {
        setError("Please configure your OpenAI API key in Settings to generate flashcards.");
        return;
      }
      
      if (res.status === 400) {
        const data = await res.json();
        if (data.action === "set_certification") {
          setError("Please set your target AWS certification in Settings before generating flashcards.");
          return;
        }
        throw new Error(data.error || "Failed to generate deck");
      }
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate deck");
      }
      
      // Refresh decks
      await fetchDecks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate flashcards");
    } finally {
      setGenerating(false);
    }
  };

  const startStudying = async (deck: FlashcardDeck) => {
    const fullDeck = await fetchDeckWithCards(deck.id);
    if (fullDeck && fullDeck.cards && fullDeck.cards.length > 0) {
      setActiveDeck(fullDeck);
      setCurrentCardIndex(0);
      setIsFlipped(false);
    }
  };

  const currentCard = activeDeck?.cards?.[currentCardIndex];
  const masteredCount = activeDeck?.userProgress?.cardsMastered || 0;
  const totalCards = activeDeck?.cards?.length || activeDeck?.totalCards || 0;

  const nextCard = () => {
    if (activeDeck?.cards && currentCardIndex < activeDeck.cards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  };

  const prevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
      setIsFlipped(false);
    }
  };

  const recordProgress = async (quality: number) => {
    if (!activeDeck || !currentCard) return;
    
    try {
      await fetch(`/api/learn/flashcards/${activeDeck.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: currentCard.id, quality }),
      });
    } catch (err) {
      console.error("Failed to record progress:", err);
    }
  };

  const markCard = async (correct: boolean) => {
    if (!activeDeck || !currentCard) return;
    
    // Record progress: 0-2 = wrong, 4 = correct
    await recordProgress(correct ? 4 : 1);
    nextCard();
  };

  const exitStudy = () => {
    setActiveDeck(null);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    // Refresh decks to get updated progress
    fetchDecks();
  };

  // Study mode
  if (activeDeck && currentCard) {
    return (
      <div className="p-6">
        {/* Study Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={exitStudy}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to decks
            </Button>
            <div>
              <h2 className="font-semibold">{activeDeck.title}</h2>
              <p className="text-sm text-muted-foreground">
                Card {currentCardIndex + 1} of {totalCards}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {masteredCount}/{totalCards} mastered
            </div>
            <Progress value={(masteredCount / totalCards) * 100} className="w-32 h-2" />
          </div>
        </div>

        {/* Flashcard */}
        <div className="max-w-2xl mx-auto">
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="relative h-80 cursor-pointer perspective-1000"
          >
            <div
              className={`absolute inset-0 p-8 rounded-2xl border border-border/50 bg-muted/30 flex items-center justify-center text-center transition-all duration-300 ${
                isFlipped ? "opacity-0 rotate-y-180" : "opacity-100"
              }`}
            >
              <div>
                <Badge variant="secondary" className="mb-4">Question</Badge>
                <p className="text-xl font-medium">{currentCard.front}</p>
              </div>
            </div>
            <div
              className={`absolute inset-0 p-8 rounded-2xl border border-primary/50 bg-primary/5 flex items-center justify-center text-center transition-all duration-300 ${
                isFlipped ? "opacity-100" : "opacity-0 rotate-y-180"
              }`}
            >
              <div>
                <Badge className="mb-4 bg-primary">Answer</Badge>
                <p className="text-lg">{currentCard.back}</p>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-4 mb-6">
            Click card to flip
          </p>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={prevCard}
              disabled={currentCardIndex === 0}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            
            <Button
              variant="outline"
              className="text-red-400 border-red-400/50 hover:bg-red-400/10"
              onClick={() => markCard(false)}
            >
              <X className="w-4 h-4 mr-2" />
              Still learning
            </Button>
            
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => markCard(true)}
            >
              <Check className="w-4 h-4 mr-2" />
              Got it!
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={nextCard}
              disabled={currentCardIndex === totalCards - 1}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Deck list view
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Flashcards</h1>
          <p className="text-muted-foreground">
            Study with spaced repetition for better retention
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleGenerateDeck} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <GraduationCap className="w-4 h-4 mr-2" />
                Generate Flashcards
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/50 bg-red-500/10 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-500">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
            Dismiss
          </Button>
        </div>
      )}

      {/* Decks Grid */}
      {decks.length === 0 ? (
        <div className="text-center py-20">
          <Layers className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No flashcard decks yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Generate flashcards based on your target AWS certification to start studying.
          </p>
          <Button onClick={handleGenerateDeck} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <GraduationCap className="w-4 h-4 mr-2" />
                Generate Flashcards
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck) => {
            const deckMastered = deck.userProgress?.cardsMastered || 0;
            const deckTotal = deck.totalCards || 0;
            const progress = deckTotal > 0 ? (deckMastered / deckTotal) * 100 : 0;
            return (
              <div
                key={deck.id}
                onClick={() => startStudying(deck)}
                className="p-5 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="secondary">{deck.locationName}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {deckTotal} cards
                  </span>
                </div>
                <h3 className="font-semibold mb-1">{deck.title}</h3>
                {deck.scenarioTitle && (
                  <p className="text-sm text-muted-foreground mb-1">{deck.scenarioTitle}</p>
                )}
                {deck.certificationCode && (
                  <p className="text-sm text-muted-foreground mb-1">
                    <Badge variant="outline" className="text-xs">{deck.certificationCode}</Badge>
                  </p>
                )}
                <p className="text-xs text-muted-foreground mb-4">{deck.description}</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className={progress === 100 ? "text-green-400" : ""}>
                      {deckMastered}/{deckTotal} mastered
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
