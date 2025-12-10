"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  Loader2, 
  DollarSign,
  MapPin,
  Trophy,
  Sparkles,
  RefreshCw,
  History,
  ChevronDown,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { JourneyMap } from "./journey-map";
import { BusinessModal } from "./business-modal";
import { Business, BusinessResult, JourneyHistory } from "./types";

interface Journey {
  id: string;
  journey_name: string;
  theme: string;
  businesses: Business[];
  total_contract_value: number;
  difficulty_distribution: Record<string, number>;
}

interface GameState {
  currentBusinessIndex: number;
  completedBusinesses: Set<string>;
  totalEarnings: number;
  perfectMatches: number;
  businessResults: BusinessResult[];
}

// Storage keys for localStorage
const STORAGE_KEY = "cloud-tycoon-state";
const LIFETIME_EARNINGS_KEY = "cloud-tycoon-lifetime-earnings";
const JOURNEY_HISTORY_KEY = "cloud-tycoon-journey-history";

// Serializable version of game state for storage
interface StoredGameState {
  journey: Journey | null;
  currentBusinessIndex: number;
  completedBusinessIds: string[];
  totalEarnings: number;
  perfectMatches: number;
  businessResults: BusinessResult[];
  savedAt: string;
}

// Save state to localStorage
function saveGameState(journey: Journey | null, gameState: GameState) {
  if (typeof window === "undefined") return;
  
  const stored: StoredGameState = {
    journey,
    currentBusinessIndex: gameState.currentBusinessIndex,
    completedBusinessIds: Array.from(gameState.completedBusinesses),
    totalEarnings: gameState.totalEarnings,
    perfectMatches: gameState.perfectMatches,
    businessResults: gameState.businessResults,
    savedAt: new Date().toISOString(),
  };
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (e) {
    console.error("Failed to save game state:", e);
  }
}

// Save lifetime earnings
function saveLifetimeEarnings(earnings: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LIFETIME_EARNINGS_KEY, earnings.toString());
  } catch (e) {
    console.error("Failed to save lifetime earnings:", e);
  }
}

// Load lifetime earnings
function loadLifetimeEarnings(): number {
  if (typeof window === "undefined") return 0;
  try {
    const stored = localStorage.getItem(LIFETIME_EARNINGS_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch (e) {
    console.error("Failed to load lifetime earnings:", e);
    return 0;
  }
}

// Save journey to history
function saveJourneyToHistory(journey: Journey, gameState: GameState): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    const existingHistory = loadJourneyHistory();
    
    // Check if this journey was already saved (prevent duplicates)
    // A journey is considered duplicate if it has the same base journey ID
    const alreadySaved = existingHistory.some(h => h.journeyId.startsWith(journey.id + '-'));
    if (alreadySaved) {
      return false;
    }
    
    const history: JourneyHistory = {
      journeyId: `${journey.id}-${Date.now()}`, // Unique ID with timestamp
      journeyName: journey.journey_name,
      completedAt: new Date().toISOString(),
      businesses: gameState.businessResults,
      totalEarnings: gameState.totalEarnings,
      perfectMatches: gameState.perfectMatches,
      totalBusinesses: journey.businesses.length,
    };
    
    existingHistory.push(history);
    
    // Keep only last 10 journeys
    const limitedHistory = existingHistory.slice(-10);
    
    localStorage.setItem(JOURNEY_HISTORY_KEY, JSON.stringify(limitedHistory));
    return true;
  } catch (e) {
    console.error("Failed to save journey to history:", e);
    return false;
  }
}

// Load journey history
function loadJourneyHistory(): JourneyHistory[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(JOURNEY_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to load journey history:", e);
    return [];
  }
}

// Delete journey from history
function deleteJourneyFromHistory(journeyId: string) {
  if (typeof window === "undefined") return;
  try {
    const history = loadJourneyHistory();
    const filteredHistory = history.filter(j => j.journeyId !== journeyId);
    localStorage.setItem(JOURNEY_HISTORY_KEY, JSON.stringify(filteredHistory));
  } catch (e) {
    console.error("Failed to delete journey from history:", e);
  }
}

// Clear all journey history
function clearJourneyHistory() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(JOURNEY_HISTORY_KEY);
  } catch (e) {
    console.error("Failed to clear journey history:", e);
  }
}

// Load state from localStorage
function loadGameState(): { journey: Journey | null; gameState: GameState } | null {
  if (typeof window === "undefined") return null;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const parsed: StoredGameState = JSON.parse(stored);
    
    // Check if saved state is older than 24 hours
    const savedAt = new Date(parsed.savedAt);
    const hoursSinceSave = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceSave > 24) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    return {
      journey: parsed.journey,
      gameState: {
        currentBusinessIndex: parsed.currentBusinessIndex,
        completedBusinesses: new Set(parsed.completedBusinessIds),
        totalEarnings: parsed.totalEarnings,
        perfectMatches: parsed.perfectMatches,
        businessResults: parsed.businessResults || [],
      },
    };
  } catch (e) {
    console.error("Failed to load game state:", e);
    return null;
  }
}

// Clear saved state
function clearGameState() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export default function CloudTycoonPage() {
  
  // Journey state
  const [journey, setJourney] = useState<Journey | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Game state
  const [gameState, setGameState] = useState<GameState>({
    currentBusinessIndex: 0,
    completedBusinesses: new Set(),
    totalEarnings: 0,
    perfectMatches: 0,
    businessResults: [],
  });
  const [lifetimeEarnings, setLifetimeEarnings] = useState(0);
  const [journeyHistory, setJourneyHistory] = useState<JourneyHistory[]>([]);
  
  // Modal state
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // Handle delete journey
  const handleDeleteJourney = (journeyId: string) => {
    deleteJourneyFromHistory(journeyId);
    setJourneyHistory(loadJourneyHistory());
  };
  
  // Handle clear history
  const handleClearHistory = () => {
    clearJourneyHistory();
    setJourneyHistory([]);
  };

  // Load saved state on mount
  useEffect(() => {
    const saved = loadGameState();
    if (saved && saved.journey) {
      setJourney(saved.journey);
      setGameState(saved.gameState);
    }
    // Load lifetime earnings
    setLifetimeEarnings(loadLifetimeEarnings());
    // Load journey history
    setJourneyHistory(loadJourneyHistory());
    setIsInitialized(true);
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    if (isInitialized && journey) {
      saveGameState(journey, gameState);
    }
  }, [journey, gameState, isInitialized]);

  // Save lifetime earnings whenever it changes
  useEffect(() => {
    if (isInitialized) {
      saveLifetimeEarnings(lifetimeEarnings);
    }
  }, [lifetimeEarnings, isInitialized]);


  // Generate a new journey
  const generateJourney = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/game/tycoon/journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_level: "intermediate",
          cert_code: "SAA-C03",
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to generate journey");
      }
      
      const data = await response.json();
      
      // Clear old saved state and set new journey
      clearGameState();
      setJourney(data);
      setGameState({
        currentBusinessIndex: 0,
        completedBusinesses: new Set(),
        totalEarnings: 0,
        perfectMatches: 0,
        businessResults: [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load journey");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle business click
  const handleBusinessClick = (business: Business, index: number) => {
    // Can only click current or completed businesses
    if (index <= gameState.currentBusinessIndex || gameState.completedBusinesses.has(business.id)) {
      setSelectedBusiness(business);
      setIsModalOpen(true);
    }
  };

  // Handle business completion
  const handleBusinessComplete = (businessId: string, earnings: number, isPerfect: boolean) => {
    setGameState(prev => {
      const newCompleted = new Set(prev.completedBusinesses);
      newCompleted.add(businessId);
      
      // Find business details
      const business = journey?.businesses.find(b => b.id === businessId);
      const businessResult: BusinessResult = {
        businessId,
        businessName: business?.business_name || 'Unknown Business',
        outcome: isPerfect ? 'success' : 'partial',
        earnings,
      };
      
      const updatedState = {
        ...prev,
        completedBusinesses: newCompleted,
        currentBusinessIndex: Math.min(prev.currentBusinessIndex + 1, (journey?.businesses.length || 1) - 1),
        totalEarnings: prev.totalEarnings + earnings,
        perfectMatches: prev.perfectMatches + (isPerfect ? 1 : 0),
        businessResults: [...prev.businessResults, businessResult],
      };
      
      // Check if journey is complete and save to history
      if (journey && newCompleted.size === journey.businesses.length) {
        const saved = saveJourneyToHistory(journey, updatedState);
        if (saved) {
          setJourneyHistory(loadJourneyHistory()); // Refresh history list only if saved
        }
      }
      
      return updatedState;
    });
    // Add to lifetime earnings
    setLifetimeEarnings(prev => prev + earnings);
    setIsModalOpen(false);
  };


  // Check if journey is complete
  const isJourneyComplete = journey && gameState.completedBusinesses.size === journey.businesses.length;

  return (
    <div className="h-screen bg-slate-950 text-white overflow-hidden">
      {/* Full-page Map Background */}
      <div className="absolute inset-0">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-16 h-16 animate-spin text-green-400 mb-4" />
            <p className="text-xl text-slate-300">Generating your business journey...</p>
            <p className="text-sm text-slate-500 mt-2">Creating unique business use cases</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-red-400 text-xl mb-4">{error}</p>
            <Button onClick={generateJourney} size="lg" className="gap-2">
              <RefreshCw className="w-5 h-5" />
              Try Again
            </Button>
          </div>
        )}

        {/* No Journey - Full Page Welcome */}
        {!journey && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center h-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="text-9xl mb-6">💰</div>
              <h1 className="text-5xl font-bold mb-4">Cloud Tycoon</h1>
              <p className="text-xl text-slate-400 max-w-lg mx-auto mb-8">
                Travel through businesses, match AWS services to their use cases, 
                and earn virtual millions as a cloud consultant!
              </p>
              <div className="flex items-center justify-center gap-8 mb-10">
                <div className="text-center">
                  <p className="text-4xl mb-2">🏢</p>
                  <p className="text-sm text-slate-400">10 Businesses</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl mb-2">☁️</p>
                  <p className="text-sm text-slate-400">AWS Services</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl mb-2">💵</p>
                  <p className="text-sm text-slate-400">Earn Millions</p>
                </div>
              </div>
              <Button 
                onClick={generateJourney}
                size="lg"
                className="bg-green-600 hover:bg-green-700 gap-2 text-lg px-8 py-6"
              >
                <Sparkles className="w-6 h-6" />
                Start New Journey
              </Button>
              
              {/* Lifetime Stats */}
              {lifetimeEarnings > 0 && (
                <div className="mt-8 flex items-center justify-center gap-6">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
                    <DollarSign className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-medium">
                      ${lifetimeEarnings.toLocaleString()} lifetime
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <span className="text-amber-400 font-medium">
                      {journeyHistory.reduce((sum, j) => sum + j.perfectMatches, 0)} perfect
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* Full Page Journey Map */}
        {journey && !isLoading && !isJourneyComplete && (
          <JourneyMap
            businesses={journey.businesses}
            currentIndex={gameState.currentBusinessIndex}
            completedIds={gameState.completedBusinesses}
            onBusinessClick={handleBusinessClick}
          />
        )}

        {/* Journey Complete - Full Page */}
        {journey && !isLoading && isJourneyComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-green-900/20 to-amber-900/20"
          >
            <div className="text-9xl mb-6">🏆</div>
            <h1 className="text-4xl font-bold mb-2">Journey Complete!</h1>
            <p className="text-xl text-slate-400 mb-8">{journey.journey_name}</p>
            
            <div className="flex items-center gap-12 mb-10">
              <div className="text-center">
                <p className="text-5xl font-bold text-green-400">
                  ${gameState.totalEarnings.toLocaleString()}
                </p>
                <p className="text-sm text-slate-500 mt-1">Journey Earnings</p>
              </div>
              <div className="text-center">
                <p className="text-5xl font-bold text-amber-400">
                  {gameState.perfectMatches}
                </p>
                <p className="text-sm text-slate-500 mt-1">Perfect Matches</p>
              </div>
              <div className="text-center">
                <p className="text-5xl font-bold text-cyan-400">
                  {journey.businesses.length}
                </p>
                <p className="text-sm text-slate-500 mt-1">Businesses</p>
              </div>
            </div>
            
            <Button 
              onClick={generateJourney}
              size="lg"
              className="bg-green-600 hover:bg-green-700 gap-2 text-lg px-8 py-6"
            >
              <RefreshCw className="w-6 h-6" />
              Start New Journey
            </Button>
          </motion.div>
        )}
      </div>

      {/* Floating Header - Only when journey active */}
      {journey && !isJourneyComplete && (
        <header className="fixed top-4 left-4 right-4 z-50 flex items-center justify-between pointer-events-none">
          {/* Left - Back & Title */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <Link href="/game">
              <Button variant="ghost" size="icon" className="bg-slate-900/80 backdrop-blur-sm border border-slate-700 text-slate-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700 rounded-lg px-4 py-2">
              <h1 className="text-lg font-bold flex items-center gap-2">
                <span>💰</span>
                Cloud Tycoon
              </h1>
              <p className="text-xs text-slate-500 truncate max-w-[200px]">{journey.journey_name}</p>
            </div>
          </div>
          
          {/* Right - Stats */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <div className="bg-slate-900/80 backdrop-blur-sm border border-green-500/30 rounded-lg px-4 py-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <div>
                <p className="text-xs text-green-400/70">Lifetime</p>
                <p className="text-sm font-bold text-green-400">${lifetimeEarnings.toLocaleString()}</p>
              </div>
            </div>
            <div className="bg-slate-900/80 backdrop-blur-sm border border-blue-500/30 rounded-lg px-4 py-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              <div>
                <p className="text-xs text-blue-400/70">Progress</p>
                <p className="text-sm font-bold text-blue-400">
                  {gameState.completedBusinesses.size}/{journey.businesses.length}
                </p>
              </div>
            </div>
            {gameState.perfectMatches > 0 && (
              <div className="bg-slate-900/80 backdrop-blur-sm border border-amber-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-amber-400">{gameState.perfectMatches}</span>
              </div>
            )}
            <Button 
              onClick={generateJourney}
              disabled={isLoading}
              size="sm"
              className="bg-green-600 hover:bg-green-700 gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              New
            </Button>
          </div>
        </header>
      )}

      {/* Floating Back Button + History - When no journey */}
      {!journey && (
        <div className="fixed top-4 left-4 z-50 flex items-center gap-3">
          <Link href="/game">
            <Button variant="ghost" size="icon" className="bg-slate-900/80 backdrop-blur-sm border border-slate-700 text-slate-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          {journeyHistory.length > 0 && (
            <Button 
              variant="ghost" 
              onClick={() => setShowHistory(!showHistory)}
              className="bg-slate-900/80 backdrop-blur-sm border border-slate-700 text-slate-400 hover:text-white gap-2"
            >
              <History className="w-4 h-4" />
              History
              <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </Button>
          )}
        </div>
      )}

      {/* History Panel - Slide out */}
      {showHistory && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="fixed top-20 left-4 z-40 w-80 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h3 className="font-semibold text-white">Journey History</h3>
            <div className="flex items-center gap-2">
              {journeyHistory.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="max-h-[400px] overflow-y-auto p-2">
            {journeyHistory.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                No journeys completed yet
              </p>
            ) : (
              <div className="space-y-2">
                {journeyHistory.slice().reverse().map((j) => (
                  <div
                    key={j.journeyId}
                    className="group p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {j.journeyName}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="text-green-400">${j.totalEarnings.toLocaleString()}</span>
                          <span className="text-amber-400">{j.perfectMatches} perfect</span>
                          <span>{j.businesses.length}/{j.totalBusinesses}</span>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-1">
                          {new Date(j.completedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteJourney(j.journeyId)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Business Modal */}
      <BusinessModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        business={selectedBusiness}
        onComplete={handleBusinessComplete}
        apiKey={undefined}
      />
    </div>
  );
}
