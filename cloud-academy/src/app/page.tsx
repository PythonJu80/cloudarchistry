"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { 
  Zap, 
  Trophy, 
  Target, 
  Rocket,
  ChevronRight,
  Building2,
  Play,
  Shield,
  Swords,
  Crown,
  Sparkles,
  Star,
  Flame,
  Users,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NavbarAvatar } from "@/components/navbar";
import { UserNav } from "@/components/user-nav";

// Dynamically import the 3D globe - no SSR
const Globe3D = dynamic(() => import("@/components/world/globe-3d"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-950">
      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 animate-pulse" />
    </div>
  ),
});

// Skill classes
const classes = [
  {
    name: "Solutions Architect",
    icon: Building2,
    color: "from-cyan-500 to-blue-600",
    borderColor: "border-cyan-500/50",
    textColor: "text-cyan-400",
    desc: "Design scalable infrastructure",
    skills: ["VPC", "HA", "Cost"],
  },
  {
    name: "DevOps Engineer",
    icon: Rocket,
    color: "from-purple-500 to-pink-600",
    borderColor: "border-purple-500/50",
    textColor: "text-purple-400",
    desc: "Automate everything",
    skills: ["CI/CD", "IaC", "K8s"],
  },
  {
    name: "Security Specialist",
    icon: Shield,
    color: "from-red-500 to-orange-600",
    borderColor: "border-red-500/50",
    textColor: "text-red-400",
    desc: "Protect & comply",
    skills: ["IAM", "KMS", "WAF"],
  },
];

// Achievement badges
const achievements = [
  { name: "First Blood", icon: "⚔️", rarity: "common", color: "from-zinc-600 to-zinc-700" },
  { name: "Globe Trotter", icon: "🌍", rarity: "rare", color: "from-blue-600 to-blue-700" },
  { name: "Speed Demon", icon: "⚡", rarity: "epic", color: "from-purple-600 to-purple-700" },
  { name: "Perfect Score", icon: "💎", rarity: "legendary", color: "from-amber-500 to-yellow-600" },
  { name: "Streak Master", icon: "🔥", rarity: "epic", color: "from-orange-600 to-red-600" },
  { name: "World Champion", icon: "👑", rarity: "legendary", color: "from-yellow-500 to-amber-600" },
];

// Daily quests
const quests = [
  { name: "Daily Mission", xp: 100, icon: Target, difficulty: "Easy", color: "text-green-400 border-green-500/30 bg-green-500/10" },
  { name: "Boss Battle", xp: 500, icon: Swords, difficulty: "Hard", color: "text-red-400 border-red-500/30 bg-red-500/10" },
  { name: "Speed Run", xp: 250, icon: Zap, difficulty: "Medium", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
];

// Leaderboard
const leaderboard = [
  { rank: 1, name: "Sarah C.", level: 47, xp: "124.5K", streak: 45 },
  { rank: 2, name: "Marcus J.", level: 45, xp: "118.2K", streak: 32 },
  { rank: 3, name: "Priya P.", level: 44, xp: "115.8K", streak: 28 },
];

export default function Home() {
  const { data: session } = useSession();
  const [selectedClass, setSelectedClass] = useState(0);
  
  return (
    <div className="min-h-screen bg-slate-950">
      {/* ===== HERO SECTION - FULL SCREEN GLOBE ===== */}
      <section className="relative h-screen">
        {/* Globe Background - Full Screen */}
        <div className="absolute inset-0 z-0">
          <Globe3D 
            locations={[]}
            selectedLocation={null}
            onLocationSelect={() => {}}
            visitedLocations={[]}
          />
        </div>
        
        {/* Gradient Overlays for readability */}
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-slate-950/80 via-transparent to-slate-950" />
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-slate-950/60 via-transparent to-slate-950/60" />
        
        {/* Navigation - On top of globe */}
        <nav className="absolute top-0 left-0 right-0 z-50 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <NavbarAvatar />
              <span className="text-xl font-bold text-white">CloudAcademy</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link href="/world" className="text-white/70 hover:text-white transition-colors text-sm font-medium">
                World Map
              </Link>
              <Link href="/challenges" className="text-white/70 hover:text-white transition-colors text-sm font-medium">
                Challenges
              </Link>
              <Link href="/game" className="text-red-400 hover:text-red-300 transition-colors text-sm font-medium flex items-center gap-1">
                <Swords className="w-4 h-4" />
                Game Zone
              </Link>
              <Link href="/leaderboard" className="text-white/70 hover:text-white transition-colors text-sm font-medium">
                Leaderboard
              </Link>
              <Link href="/pricing" className="text-white/70 hover:text-white transition-colors text-sm font-medium">
                Pricing
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <UserNav user={session?.user ? { username: session.user.username, subscriptionTier: session.user.subscriptionTier } : null} />
            </div>
          </div>
        </nav>
        
        {/* Hero Content - Centered on globe */}
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="text-center max-w-4xl mx-auto px-6">
            {/* Game-style badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-sm font-bold mb-6 backdrop-blur-sm">
              <Sparkles className="w-4 h-4" />
              SEASON 1 NOW LIVE
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            </div>
            
            {/* Main Title - Game style */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-6">
              <span className="text-white drop-shadow-2xl">CLOUD</span>
              <br />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
                ACADEMY
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-8 font-medium">
              Explore the world. Complete missions. Master AWS.
              <br />
              <span className="text-cyan-400">The RPG for Cloud Architects.</span>
            </p>
            
            {/* XP Bar Preview */}
            <div className="max-w-md mx-auto mb-8">
              <div className="flex items-center justify-between text-xs text-white/60 mb-1">
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400" />
                  Level 1
                </span>
                <span>0 / 1,000 XP</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                <div className="h-full w-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" />
              </div>
            </div>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/world">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold px-8 py-6 text-lg rounded-xl shadow-lg shadow-cyan-500/25 group">
                  <Play className="w-5 h-5" />
                  START GAME
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button variant="outline" size="lg" className="gap-2 border-white/20 text-white hover:bg-white/10 font-bold px-8 py-6 text-lg rounded-xl backdrop-blur-sm">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  LEADERBOARD
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-white/50 rounded-full animate-pulse" />
          </div>
        </div>
        
        {/* Stats bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pt-20 pb-6">
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-black text-white">500+</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Missions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-black text-cyan-400">50+</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">AWS Services</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-black text-purple-400">12</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Industries</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-black text-amber-400">10K+</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Players</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CHOOSE YOUR CLASS ===== */}
      <section className="py-20 px-6 bg-slate-950 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent" />
        
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-bold mb-4">
              <Users className="w-3 h-3" />
              CHOOSE YOUR PATH
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
              SELECT YOUR <span className="text-purple-400">CLASS</span>
            </h2>
            <p className="text-white/60 max-w-xl mx-auto">
              Each path unlocks unique challenges and certifications
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {classes.map((cls, i) => (
              <Card 
                key={cls.name}
                className={`bg-slate-900/50 border-2 transition-all duration-300 cursor-pointer backdrop-blur-sm ${
                  selectedClass === i 
                    ? `${cls.borderColor} scale-105 shadow-lg` 
                    : 'border-white/10 hover:border-white/20'
                }`}
                onClick={() => setSelectedClass(i)}
              >
                <CardContent className="p-6">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${cls.color} flex items-center justify-center mb-4 shadow-lg`}>
                    <cls.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className={`text-xl font-bold ${cls.textColor} mb-2`}>{cls.name}</h3>
                  <p className="text-white/60 text-sm mb-4">{cls.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {cls.skills.map(skill => (
                      <span key={skill} className="px-2 py-1 rounded-md bg-white/5 text-white/70 text-xs font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                  {selectedClass === i && (
                    <div className={`mt-4 pt-4 border-t border-white/10 flex items-center justify-between`}>
                      <span className="text-xs text-white/50">SELECTED</span>
                      <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${cls.color}`} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== DAILY QUESTS ===== */}
      <section className="py-20 px-6 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Quests */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold mb-4">
                <Flame className="w-3 h-3" />
                DAILY QUESTS
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-6">
                COMPLETE MISSIONS.<br />
                <span className="text-amber-400">EARN XP.</span>
              </h2>
              
              <div className="space-y-4">
                {quests.map((quest) => (
                  <div 
                    key={quest.name}
                    className={`p-4 rounded-xl border ${quest.color} flex items-center gap-4 group hover:scale-[1.02] transition-transform cursor-pointer`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                      <quest.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{quest.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">{quest.difficulty}</span>
                      </div>
                      <div className="text-xs text-white/50">+{quest.xp} XP</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
              </div>
            </div>
            
            {/* Leaderboard Preview */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-bold mb-4">
                <Trophy className="w-3 h-3" />
                TOP PLAYERS
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-6">
                CLIMB THE <span className="text-cyan-400">RANKS</span>
              </h2>
              
              <div className="bg-slate-900/80 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-sm">
                {leaderboard.map((player, i) => (
                  <div 
                    key={player.name}
                    className={`p-4 flex items-center gap-4 ${i !== leaderboard.length - 1 ? 'border-b border-white/5' : ''}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                      i === 0 ? 'bg-gradient-to-br from-amber-500 to-yellow-600 text-white' :
                      i === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500 text-white' :
                      i === 2 ? 'bg-gradient-to-br from-amber-700 to-amber-800 text-white' :
                      'bg-white/5 text-white/50'
                    }`}>
                      {player.rank}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{player.name}</span>
                        {i === 0 && <Crown className="w-4 h-4 text-amber-400" />}
                      </div>
                      <div className="text-xs text-white/50">Level {player.level} • {player.xp} XP</div>
                    </div>
                    <div className="flex items-center gap-1 text-orange-400">
                      <Flame className="w-4 h-4" />
                      <span className="text-sm font-bold">{player.streak}</span>
                    </div>
                  </div>
                ))}
                <Link href="/leaderboard" className="block p-4 text-center text-cyan-400 hover:bg-white/5 transition-colors font-medium text-sm">
                  View Full Leaderboard →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ACHIEVEMENTS ===== */}
      <section className="py-20 px-6 bg-slate-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold mb-4">
              <Star className="w-3 h-3" />
              ACHIEVEMENTS
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
              UNLOCK <span className="text-amber-400">BADGES</span>
            </h2>
            <p className="text-white/60 max-w-xl mx-auto">
              Complete challenges to earn rare achievements
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {achievements.map((achievement) => (
              <div 
                key={achievement.name}
                className="group relative"
              >
                <div className={`aspect-square rounded-2xl bg-gradient-to-br ${achievement.color} p-[2px] hover:scale-105 transition-transform cursor-pointer`}>
                  <div className="w-full h-full rounded-2xl bg-slate-900 flex flex-col items-center justify-center p-4">
                    <span className="text-4xl mb-2">{achievement.icon}</span>
                    <span className="text-xs font-bold text-white text-center">{achievement.name}</span>
                    <span className={`text-[10px] uppercase tracking-wider mt-1 ${
                      achievement.rarity === 'legendary' ? 'text-amber-400' :
                      achievement.rarity === 'epic' ? 'text-purple-400' :
                      achievement.rarity === 'rare' ? 'text-blue-400' :
                      'text-white/40'
                    }`}>
                      {achievement.rarity}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-20 px-6 bg-gradient-to-b from-slate-950 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-cyan-900/30 via-transparent to-transparent" />
        
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-sm font-bold mb-6">
            <Rocket className="w-4 h-4" />
            FREE TO PLAY
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
            READY TO <span className="text-cyan-400">BEGIN?</span>
          </h2>
          <p className="text-xl text-white/70 mb-10 max-w-2xl mx-auto">
            Join thousands of cloud architects leveling up their skills
          </p>
          <Link href="/world">
            <Button size="lg" className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold px-12 py-7 text-xl rounded-xl shadow-lg shadow-cyan-500/25">
              <Play className="w-6 h-6" />
              PLAY NOW
            </Button>
          </Link>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/10 py-8 px-6 bg-slate-950">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white">CloudAcademy</span>
          </div>
          <p className="text-sm text-white/40">
            Part of the CloudFabric ecosystem. © 2024
          </p>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
