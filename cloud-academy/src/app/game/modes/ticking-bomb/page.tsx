"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bomb,
  Users,
  Loader2,
  Target,
  Skull,
  Timer,
  Zap,
  Swords,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function TickingBombLobbyPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { toast } = useToast();

  // Challenge state
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [opponents, setOpponents] = useState<Array<{
    id: string;
    name: string | null;
    username: string | null;
    email: string;
    teamName?: string;
  }>>([]);
  const [challenging, setChallenging] = useState<string | null>(null);

  // Fetch team members for challenges
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/team");
      if (response.ok) {
        const data = await response.json();
        const teams = data.teams || [];
        
        const opponentsList: Array<{
          id: string;
          name: string | null;
          username: string | null;
          email: string;
          teamName?: string;
        }> = [];

        for (const team of teams) {
          for (const member of team.members) {
            if (member.academyUser && member.academyUser.email !== session?.user?.email) {
              opponentsList.push({
                ...member.academyUser,
                teamName: team.name,
              });
            }
          }
        }
        setOpponents(opponentsList);
      }
    } catch (error) {
      console.error("Failed to fetch team members:", error);
    }
  }, [session?.user?.email]);

  // Fetch team members on mount
  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchTeamMembers();
    }
  }, [authStatus, fetchTeamMembers]);

  // Handle PvP challenge
  const handleChallenge = async (opponentId: string) => {
    setChallenging(opponentId);
    try {
      const res = await fetch("/api/versus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opponentId, matchType: "ticking_bomb" }),
      });
      const data = await res.json();
      if (res.ok && data.match) {
        toast({
          title: "💣 Challenge Sent!",
          description: data.emailSent ? "Email sent to opponent!" : "Match created!",
        });
        setShowChallengeModal(false);
        setTimeout(() => router.push(`/game/ticking-bomb/${data.match.matchCode}`), 1000);
      }
    } catch (err) {
      console.error("Failed to create challenge:", err);
      toast({ title: "Failed to send challenge", variant: "destructive" });
    } finally {
      setChallenging(null);
    }
  };

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "1s" }} />
        
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(239, 68, 68, 0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(239, 68, 68, 0.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/game"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Arena</span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          {/* Animated bomb */}
          <div className="relative inline-block mb-6">
            <motion.div
              animate={{ rotate: [0, -5, 5, -5, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              className="text-8xl"
            >
              💣
            </motion.div>
            {/* Spark */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 0.3, repeat: Infinity }}
              className="absolute -top-2 right-4 text-2xl"
            >
              ✨
            </motion.div>
          </div>

          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
              TICKING BOMB
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-lg mx-auto">
            Hot potato with AWS questions! Answer correctly to pass the bomb.
            <br />
            <span className="text-red-400 font-semibold">Last one standing wins!</span>
          </p>
        </motion.div>

        {/* How to play */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-4 gap-4 mb-12"
        >
          {[
            { icon: Bomb, title: "Get the Bomb", desc: "Random player starts with it", color: "text-red-400" },
            { icon: Timer, title: "Answer Fast", desc: "Before the fuse runs out", color: "text-orange-400" },
            { icon: Target, title: "Choose Target", desc: "Throw it at any player", color: "text-yellow-400" },
            { icon: Skull, title: "Survive", desc: "Last one alive wins", color: "text-purple-400" },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 text-center"
            >
              <item.icon className={`w-8 h-8 mx-auto mb-2 ${item.color}`} />
              <h3 className="font-bold text-white mb-1">{item.title}</h3>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
          ))}
        </motion.div>

        {/* Challenge Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-md mx-auto"
        >
          <div className="p-6 rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <Swords className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Challenge Teammates</h2>
                <p className="text-sm text-gray-500">Select who to play with</p>
              </div>
            </div>

            <Button
              onClick={() => setShowChallengeModal(true)}
              disabled={authStatus !== "authenticated"}
              className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-white font-bold py-6"
            >
              <Swords className="w-5 h-5 mr-2" />
              Start Game
            </Button>
          </div>
        </motion.div>

        {/* Game info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              2-8 Players
            </span>
            <span className="flex items-center gap-2">
              <Timer className="w-4 h-4" />
              ~5-10 min
            </span>
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Real-time Multiplayer
            </span>
          </div>
        </motion.div>

        {/* Challenge Modal */}
        {showChallengeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowChallengeModal(false)}
            />
            
            {/* Modal */}
            <div className="relative bg-gray-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
              {/* Close button */}
              <button 
                onClick={() => setShowChallengeModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">💣</div>
                <h3 className="text-2xl font-black bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                  TICKING BOMB
                </h3>
                <p className="text-gray-400 text-sm mt-1">Challenge a teammate</p>
              </div>

              {/* Team members list */}
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {opponents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No team members found</p>
                    <p className="text-xs mt-1">Invite people to your team first!</p>
                  </div>
                ) : (
                  opponents.map((opponent) => (
                    <div 
                      key={opponent.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-800/50 border border-gray-700 hover:border-red-500/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold">
                          {(opponent.name || opponent.username || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">
                            {opponent.name || opponent.username || "Unknown"}
                          </p>
                          <p className="text-xs text-gray-500">{opponent.teamName}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleChallenge(opponent.id)}
                        disabled={challenging === opponent.id}
                        className="bg-red-500 hover:bg-red-400 text-white font-bold gap-2"
                      >
                        {challenging === opponent.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Swords className="w-4 h-4" />
                        )}
                        Challenge
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-gray-800 text-center">
                <p className="text-xs text-gray-500">
                  Your opponent will receive a challenge notification
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Not signed in warning */}
        {authStatus === "unauthenticated" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-center"
          >
            <p className="text-yellow-400">
              Please{" "}
              <Link href="/login" className="underline font-bold">
                sign in
              </Link>{" "}
              to play Ticking Bomb
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
