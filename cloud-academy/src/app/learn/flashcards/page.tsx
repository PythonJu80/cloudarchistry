"use client";

import { useState } from "react";
import {
  Plus,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  mastered: boolean;
}

interface FlashcardDeck {
  id: string;
  title: string;
  description: string;
  cards: Flashcard[];
  category: string;
}

// Placeholder decks
const placeholderDecks: FlashcardDeck[] = [
  {
    id: "1",
    title: "AWS IAM Fundamentals",
    description: "Identity and Access Management core concepts",
    category: "Security",
    cards: [
      { id: "1a", front: "What is an IAM Policy?", back: "A JSON document that defines permissions. It specifies what actions are allowed or denied on which AWS resources.", mastered: false },
      { id: "1b", front: "What is the principle of least privilege?", back: "Granting only the minimum permissions necessary to perform a task. Users and services should only have access to the resources they need.", mastered: true },
      { id: "1c", front: "What is an IAM Role?", back: "An IAM identity with specific permissions that can be assumed by users, applications, or services. Unlike users, roles don't have permanent credentials.", mastered: false },
    ],
  },
  {
    id: "2",
    title: "VPC Networking",
    description: "Virtual Private Cloud concepts and components",
    category: "Networking",
    cards: [
      { id: "2a", front: "What is a VPC?", back: "A logically isolated virtual network in AWS where you can launch resources. You have complete control over IP addressing, subnets, routing, and security.", mastered: false },
      { id: "2b", front: "What is a NAT Gateway?", back: "A managed service that allows instances in private subnets to connect to the internet while preventing inbound connections from the internet.", mastered: false },
    ],
  },
];

export default function FlashcardsPage() {
  const [decks, setDecks] = useState<FlashcardDeck[]>(placeholderDecks);
  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const currentCard = activeDeck?.cards[currentCardIndex];
  const masteredCount = activeDeck?.cards.filter(c => c.mastered).length || 0;
  const totalCards = activeDeck?.cards.length || 0;

  const nextCard = () => {
    if (activeDeck && currentCardIndex < activeDeck.cards.length - 1) {
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

  const markCard = (mastered: boolean) => {
    if (!activeDeck || !currentCard) return;
    
    setDecks(prev => prev.map(deck => {
      if (deck.id === activeDeck.id) {
        return {
          ...deck,
          cards: deck.cards.map(card => 
            card.id === currentCard.id ? { ...card, mastered } : card
          ),
        };
      }
      return deck;
    }));
    
    // Update active deck too
    setActiveDeck(prev => {
      if (!prev) return null;
      return {
        ...prev,
        cards: prev.cards.map(card =>
          card.id === currentCard.id ? { ...card, mastered } : card
        ),
      };
    });
    
    nextCard();
  };

  const exitStudy = () => {
    setActiveDeck(null);
    setCurrentCardIndex(0);
    setIsFlipped(false);
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
          <Button variant="outline">
            <Sparkles className="w-4 h-4 mr-2" />
            Generate from sources
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create deck
          </Button>
        </div>
      </div>

      {/* Decks Grid */}
      {decks.length === 0 ? (
        <div className="text-center py-20">
          <Layers className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No flashcard decks yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Create flashcards manually or generate them from your learning sources.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate from sources
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create deck
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck) => {
            const deckMastered = deck.cards.filter(c => c.mastered).length;
            const progress = (deckMastered / deck.cards.length) * 100;
            return (
              <div
                key={deck.id}
                onClick={() => {
                  setActiveDeck(deck);
                  setCurrentCardIndex(0);
                  setIsFlipped(false);
                }}
                className="p-5 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="secondary">{deck.category}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {deck.cards.length} cards
                  </span>
                </div>
                <h3 className="font-semibold mb-1">{deck.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{deck.description}</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className={progress === 100 ? "text-green-400" : ""}>
                      {deckMastered}/{deck.cards.length} mastered
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
