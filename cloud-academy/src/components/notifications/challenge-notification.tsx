"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { Swords, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardSocket } from "@/hooks/use-dashboard-socket";

interface PendingChallenge {
  id: string;
  matchCode: string;
  player1: {
    id: string;
    name: string | null;
    username: string | null;
  };
  createdAt: string;
}

export function ChallengeNotificationProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [challenges, setChallenges] = useState<PendingChallenge[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [responding, setResponding] = useState<string | null>(null);
  const seenChallengeIds = useRef<Set<string>>(new Set());
  const [myUserId, setMyUserId] = useState<string>("");
  
  // Don't show notifications if already on a game page
  const isOnGamePage = pathname?.startsWith("/game/");

  // Fetch pending challenges
  const fetchChallenges = useCallback(async () => {
    if (status !== "authenticated") return;
    
    try {
      const res = await fetch("/api/versus/pending");
      if (res.ok) {
        const data = await res.json();
        setChallenges(data.challenges || []);
      }
    } catch (err) {
      console.error("Failed to fetch challenges:", err);
    }
  }, [status]);

  // Get user ID for WebSocket connection
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;
    
    fetch("/api/team")
      .then(res => res.json())
      .then(data => {
        for (const team of data.teams || []) {
          const myMember = team.members.find(
            (m: { academyUser?: { email?: string; id?: string } }) => 
              m.academyUser?.email === session.user?.email
          );
          if (myMember?.academyUser?.id) {
            setMyUserId(myMember.academyUser.id);
            break;
          }
        }
      })
      .catch(console.error);
  }, [status, session?.user?.email]);

  // WebSocket for real-time challenge notifications (replaces polling)
  useDashboardSocket({
    userId: myUserId,
    onVersusUpdate: () => {
      // Refetch challenges when we get a versus update
      fetchChallenges();
    },
  });

  // Initial fetch only (no more polling)
  useEffect(() => {
    if (status !== "authenticated") return;
    fetchChallenges();
  }, [status, fetchChallenges]);

  // Handle accept
  const handleAccept = async (matchCode: string) => {
    setResponding(matchCode);
    try {
      const res = await fetch(`/api/versus/${matchCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      
      if (res.ok) {
        // Remove from list and navigate to game
        setChallenges(prev => prev.filter(c => c.matchCode !== matchCode));
        router.push(`/game/${matchCode}`);
      }
    } catch (err) {
      console.error("Failed to accept:", err);
    } finally {
      setResponding(null);
    }
  };

  // Handle decline
  const handleDecline = async (matchCode: string, challengeId: string) => {
    setResponding(matchCode);
    try {
      await fetch(`/api/versus/${matchCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });
      
      // Remove from list
      setChallenges(prev => prev.filter(c => c.matchCode !== matchCode));
      setDismissedIds(prev => new Set([...prev, challengeId]));
    } catch (err) {
      console.error("Failed to decline:", err);
    } finally {
      setResponding(null);
    }
  };

  // Handle dismiss (just hide, don't decline)
  const handleDismiss = (challengeId: string) => {
    setDismissedIds(prev => new Set([...prev, challengeId]));
  };

  // Filter out dismissed challenges and don't show on game pages
  const visibleChallenges = isOnGamePage 
    ? [] 
    : challenges.filter(c => !dismissedIds.has(c.id));
  
  // Play notification sound for new challenges
  useEffect(() => {
    const newChallenges = challenges.filter(c => !seenChallengeIds.current.has(c.id));
    if (newChallenges.length > 0) {
      // Mark as seen
      newChallenges.forEach(c => seenChallengeIds.current.add(c.id));
      // Could add sound here if desired
    }
  }, [challenges]);

  return (
    <>
      {children}
      
      {/* Challenge notifications - fixed position */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {visibleChallenges.map((challenge) => {
          const challengerName = challenge.player1.name || challenge.player1.username || "Someone";
          const isResponding = responding === challenge.matchCode;
          
          return (
            <div
              key={challenge.id}
              className="bg-gradient-to-r from-red-950 to-orange-950 border border-red-500/50 rounded-lg p-4 shadow-2xl animate-in slide-in-from-right-5 duration-300"
            >
              {/* Close button */}
              <button
                onClick={() => handleDismiss(challenge.id)}
                className="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              {/* Content */}
              <div className="flex items-start gap-3 pr-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <Swords className="w-5 h-5 text-red-400" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">
                    ⚔️ Battle Challenge!
                  </p>
                  <p className="text-gray-300 text-sm mt-0.5">
                    <span className="font-medium text-red-400">{challengerName}</span> wants to battle you!
                  </p>
                  
                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => handleAccept(challenge.matchCode)}
                      disabled={isResponding}
                      className="bg-green-600 hover:bg-green-500 text-white h-8 text-xs gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDecline(challenge.matchCode, challenge.id)}
                      disabled={isResponding}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/20 h-8 text-xs gap-1"
                    >
                      <X className="w-3 h-3" />
                      Decline
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
