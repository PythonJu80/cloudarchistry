"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  Cloud,
  Server,
  Database,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";

// Floating particles component
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-cyan-400/30 rounded-full animate-float"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${8 + Math.random() * 4}s`,
          }}
        />
      ))}
      {[...Array(10)].map((_, i) => (
        <div
          key={`large-${i}`}
          className="absolute w-2 h-2 bg-purple-400/20 rounded-full animate-float"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${10 + Math.random() * 5}s`,
          }}
        />
      ))}
    </div>
  );
}

// Animated grid background
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      {/* Animated scan line */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent h-[200px] animate-scan" />
    </div>
  );
}

// Floating AWS icons
function FloatingIcons() {
  const icons = [Cloud, Server, Database, Lock, Shield, Rocket];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {icons.map((Icon, i) => (
        <div
          key={i}
          className="absolute text-white/5 animate-float-slow"
          style={{
            left: `${10 + (i * 15)}%`,
            top: `${20 + (i % 3) * 25}%`,
            animationDelay: `${i * 0.8}s`,
          }}
        >
          <Icon className="w-16 h-16 md:w-24 md:h-24" />
        </div>
      ))}
    </div>
  );
}

// Skill classes
const classes = [
  {
    name: "Solutions Architect",
    icon: Building2,
    color: "from-cyan-500 to-blue-600",
    glowColor: "shadow-cyan-500/25",
    borderColor: "border-cyan-500/50",
    textColor: "text-cyan-400",
    desc: "Design scalable infrastructure",
    skills: ["VPC", "HA", "Cost"],
  },
  {
    name: "DevOps Engineer",
    icon: Rocket,
    color: "from-purple-500 to-pink-600",
    glowColor: "shadow-purple-500/25",
    borderColor: "border-purple-500/50",
    textColor: "text-purple-400",
    desc: "Automate everything",
    skills: ["CI/CD", "IaC", "K8s"],
  },
  {
    name: "Security Specialist",
    icon: Shield,
    color: "from-red-500 to-orange-600",
    glowColor: "shadow-red-500/25",
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
  { name: "Daily Mission", xp: 100, icon: Target, difficulty: "Easy", color: "text-green-400 border-green-500/30 bg-green-500/10", glowColor: "hover:shadow-green-500/20" },
  { name: "Boss Battle", xp: 500, icon: Swords, difficulty: "Hard", color: "text-red-400 border-red-500/30 bg-red-500/10", glowColor: "hover:shadow-red-500/20" },
  { name: "Speed Run", xp: 250, icon: Zap, difficulty: "Medium", color: "text-amber-400 border-amber-500/30 bg-amber-500/10", glowColor: "hover:shadow-amber-500/20" },
];

// Leaderboard
const leaderboard = [
  { rank: 1, name: "Sarah C.", level: 47, xp: "124.5K", streak: 45 },
  { rank: 2, name: "Marcus J.", level: 45, xp: "118.2K", streak: 32 },
  { rank: 3, name: "Priya P.", level: 44, xp: "115.8K", streak: 28 },
];

export default function Home() {
  const [selectedClass, setSelectedClass] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Custom CSS for animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.3; }
          50% { transform: translateY(-20px) rotate(5deg); opacity: 0.6; }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-30px) rotate(3deg); }
        }
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(6, 182, 212, 0.3); }
          50% { box-shadow: 0 0 40px rgba(6, 182, 212, 0.6); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-float { animation: float 8s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 12s ease-in-out infinite; }
        .animate-scan { animation: scan 8s linear infinite; }
        .animate-gradient-x { 
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite; 
        }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        .animate-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>

      {/* ===== HERO SECTION ===== */}
      <section className="relative h-screen overflow-hidden">
        {/* Layered Background Effects */}
        <div className="absolute inset-0 z-0 bg-slate-950" />
        
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 z-[1] overflow-hidden">
          <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-1/2 -right-1/4 w-[600px] h-[600px] bg-gradient-to-br from-purple-500/20 via-pink-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        
        {/* Grid background */}
        <GridBackground />
        
        {/* Floating particles */}
        {mounted && <FloatingParticles />}
        
        {/* Floating icons */}
        {mounted && <FloatingIcons />}
        
        {/* Gradient Overlays */}
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950" />
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-slate-950/40 via-transparent to-slate-950/40" />
        
        {/* Navigation */}
        <Navbar variant="transparent" />
        
        {/* Hero Content */}
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="text-center max-w-4xl mx-auto px-6">
            {/* Animated badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400 text-sm font-bold mb-6 backdrop-blur-md animate-pulse-glow">
              <Sparkles className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
              SEASON 1 NOW LIVE
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            </div>
            
            {/* Main Title with animated gradient */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-6">
              <span className="text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">CLOUD</span>
              <br />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 via-purple-400 to-pink-500 bg-clip-text text-transparent animate-gradient-x drop-shadow-[0_0_30px_rgba(6,182,212,0.5)]">
                ACADEMY
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-8 font-medium leading-relaxed">
              Explore the world. Complete missions. Master AWS.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 font-bold">The RPG for Cloud Architects.</span>
            </p>
            
            {/* Animated XP Bar */}
            <div className="max-w-md mx-auto mb-10">
              <div className="flex items-center justify-between text-xs text-white/60 mb-2">
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400 animate-pulse" />
                  <span className="font-bold text-amber-400">Level 1</span>
                </span>
                <span className="font-mono">0 / 1,000 XP</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm border border-white/10 relative">
                <div className="absolute inset-0 animate-shimmer" />
                <div className="h-full w-[5%] bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-lg shadow-white/50" />
                </div>
              </div>
            </div>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/world">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 text-white font-bold px-10 py-7 text-lg rounded-2xl shadow-2xl shadow-cyan-500/30 group transition-all duration-300 hover:scale-105 hover:shadow-cyan-500/50 border border-white/10">
                  <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  START GAME
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button variant="outline" size="lg" className="gap-2 border-white/20 hover:border-amber-400/50 text-white hover:bg-amber-500/10 font-bold px-10 py-7 text-lg rounded-2xl backdrop-blur-md transition-all duration-300 hover:scale-105 group">
                  <Trophy className="w-5 h-5 text-amber-400 group-hover:rotate-12 transition-transform" />
                  LEADERBOARD
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 animate-bounce">
          <div className="w-7 h-12 rounded-full border-2 border-cyan-400/50 flex items-start justify-center p-2 backdrop-blur-sm bg-white/5">
            <div className="w-1.5 h-3 bg-gradient-to-b from-cyan-400 to-purple-400 rounded-full animate-pulse" />
          </div>
        </div>
        
        {/* Stats bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pt-24 pb-8">
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100px, 100%), 1fr))' }}>
              {[
                { value: "500+", label: "Missions", color: "text-white" },
                { value: "50+", label: "AWS Services", color: "text-cyan-400" },
                { value: "12", label: "Industries", color: "text-purple-400" },
                { value: "10K+", label: "Players", color: "text-amber-400" },
              ].map((stat, i) => (
                <div key={stat.label} className="text-center group cursor-default">
                  <div className={`text-2xl md:text-4xl font-black ${stat.color} transition-transform group-hover:scale-110`}>
                    {stat.value}
                  </div>
                  <div className="text-xs text-white/50 uppercase tracking-wider mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== CHOOSE YOUR CLASS ===== */}
      <section className="py-24 px-6 bg-slate-950 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-purple-500/10 to-transparent rounded-full blur-3xl" />
        
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-bold mb-6 backdrop-blur-sm">
              <Users className="w-3 h-3" />
              CHOOSE YOUR PATH
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-4">
              SELECT YOUR <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">CLASS</span>
            </h2>
            <p className="text-white/60 max-w-xl mx-auto text-lg">
              Each path unlocks unique challenges and certifications
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {classes.map((cls, i) => (
              <Card 
                key={cls.name}
                className={`bg-slate-900/80 border-2 transition-all duration-500 cursor-pointer backdrop-blur-sm group relative overflow-hidden ${
                  selectedClass === i 
                    ? `${cls.borderColor} scale-105 shadow-2xl ${cls.glowColor}` 
                    : 'border-white/10 hover:border-white/30 hover:shadow-xl'
                }`}
                onClick={() => setSelectedClass(i)}
              >
                {/* Glow effect on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${cls.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                
                <CardContent className="p-8 relative">
                  <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${cls.color} flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 transition-transform duration-300 ${cls.glowColor} shadow-lg`}>
                    <cls.icon className="w-10 h-10 text-white" />
                  </div>
                  <h3 className={`text-2xl font-bold ${cls.textColor} mb-3`}>{cls.name}</h3>
                  <p className="text-white/60 text-sm mb-6">{cls.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {cls.skills.map(skill => (
                      <span key={skill} className={`px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/80 text-xs font-semibold group-hover:border-white/20 transition-colors`}>
                        {skill}
                      </span>
                    ))}
                  </div>
                  {selectedClass === i && (
                    <div className={`mt-6 pt-6 border-t border-white/10 flex items-center justify-between`}>
                      <span className="text-xs text-white/50 uppercase tracking-wider font-bold">SELECTED</span>
                      <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${cls.color} animate-pulse shadow-lg`} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== DAILY QUESTS ===== */}
      <section className="py-24 px-6 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-1/4 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-amber-500/10 to-transparent rounded-full blur-3xl" />
          <div className="absolute -right-1/4 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-l from-cyan-500/10 to-transparent rounded-full blur-3xl" />
        </div>
        
        <div className="max-w-6xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Quests */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold mb-6 backdrop-blur-sm">
                <Flame className="w-3 h-3 animate-pulse" />
                DAILY QUESTS
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-8">
                COMPLETE MISSIONS.<br />
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">EARN XP.</span>
              </h2>
              
              <div className="space-y-4">
                {quests.map((quest, i) => (
                  <div 
                    key={quest.name}
                    className={`p-5 rounded-2xl border ${quest.color} ${quest.glowColor} flex items-center gap-4 group hover:scale-[1.02] transition-all duration-300 cursor-pointer backdrop-blur-sm hover:shadow-lg`}
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <quest.icon className="w-7 h-7" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-lg">{quest.name}</span>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 font-semibold">{quest.difficulty}</span>
                      </div>
                      <div className="text-sm text-white/50 font-medium">+{quest.xp} XP</div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-white/30 group-hover:text-white/70 group-hover:translate-x-2 transition-all" />
                  </div>
                ))}
              </div>
            </div>
            
            {/* Leaderboard Preview */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-bold mb-6 backdrop-blur-sm">
                <Trophy className="w-3 h-3" />
                TOP PLAYERS
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-8">
                CLIMB THE <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">RANKS</span>
              </h2>
              
              <div className="bg-slate-900/80 rounded-3xl border border-white/10 overflow-hidden backdrop-blur-md shadow-2xl">
                {leaderboard.map((player, i) => (
                  <div 
                    key={player.name}
                    className={`p-5 flex items-center gap-4 hover:bg-white/5 transition-colors ${i !== leaderboard.length - 1 ? 'border-b border-white/5' : ''}`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-lg ${
                      i === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-600 text-white shadow-amber-500/30' :
                      i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-slate-400/30' :
                      i === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-amber-700/30' :
                      'bg-white/5 text-white/50'
                    }`}>
                      {player.rank}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-lg">{player.name}</span>
                        {i === 0 && <Crown className="w-5 h-5 text-amber-400 animate-pulse" />}
                      </div>
                      <div className="text-sm text-white/50">Level {player.level} • {player.xp} XP</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-orange-400 bg-orange-500/10 px-3 py-1.5 rounded-full">
                      <Flame className="w-4 h-4" />
                      <span className="text-sm font-bold">{player.streak}</span>
                    </div>
                  </div>
                ))}
                <Link href="/leaderboard" className="block p-5 text-center text-cyan-400 hover:bg-cyan-500/10 transition-colors font-bold text-sm group">
                  View Full Leaderboard 
                  <ChevronRight className="w-4 h-4 inline ml-1 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ACHIEVEMENTS ===== */}
      <section className="py-24 px-6 bg-slate-950 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-cyan-500/10 rounded-full blur-3xl" />
        
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold mb-6 backdrop-blur-sm">
              <Star className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} />
              ACHIEVEMENTS
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-4">
              UNLOCK <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 bg-clip-text text-transparent">BADGES</span>
            </h2>
            <p className="text-white/60 max-w-xl mx-auto text-lg">
              Complete challenges to earn rare achievements
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {achievements.map((achievement, i) => (
              <div 
                key={achievement.name}
                className="group relative"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className={`aspect-square rounded-3xl bg-gradient-to-br ${achievement.color} p-[2px] hover:scale-110 transition-all duration-300 cursor-pointer hover:shadow-2xl`}>
                  <div className="w-full h-full rounded-3xl bg-slate-900/95 flex flex-col items-center justify-center p-4 group-hover:bg-slate-900/80 transition-colors">
                    <span className="text-5xl mb-3 group-hover:scale-125 transition-transform duration-300">{achievement.icon}</span>
                    <span className="text-xs font-bold text-white text-center">{achievement.name}</span>
                    <span className={`text-[10px] uppercase tracking-wider mt-1 font-bold ${
                      achievement.rarity === 'legendary' ? 'text-amber-400' :
                      achievement.rarity === 'epic' ? 'text-purple-400' :
                      achievement.rarity === 'rare' ? 'text-blue-400' :
                      'text-white/40'
                    }`}>
                      {achievement.rarity}
                    </span>
                  </div>
                </div>
                {/* Glow effect for legendary/epic */}
                {(achievement.rarity === 'legendary' || achievement.rarity === 'epic') && (
                  <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${achievement.color} opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-300 -z-10`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-32 px-6 bg-gradient-to-b from-slate-950 to-slate-900 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-t from-cyan-500/20 via-blue-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-gradient-to-t from-purple-500/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gradient-to-t from-amber-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400 text-sm font-bold mb-8 backdrop-blur-md animate-pulse-glow">
            <Rocket className="w-4 h-4" />
            FREE TO PLAY
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-5xl md:text-7xl font-black text-white mb-8">
            READY TO <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent animate-gradient-x">BEGIN?</span>
          </h2>
          <p className="text-xl md:text-2xl text-white/70 mb-12 max-w-2xl mx-auto leading-relaxed">
            Join thousands of cloud architects leveling up their skills
          </p>
          <Link href="/world">
            <Button size="lg" className="gap-3 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 text-white font-bold px-14 py-8 text-xl rounded-2xl shadow-2xl shadow-cyan-500/40 transition-all duration-300 hover:scale-110 hover:shadow-cyan-500/60 border border-white/10 group">
              <Play className="w-7 h-7 group-hover:scale-110 transition-transform" />
              PLAY NOW
              <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/10 py-12 px-6 bg-slate-950 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent" />
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 relative">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-shadow">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-white text-lg">CloudAcademy</span>
          </div>
          <p className="text-sm text-white/40">
            Part of the CloudFabric ecosystem. © 2024
          </p>
          <div className="flex items-center gap-8 text-sm text-white/40">
            <Link href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-cyan-400 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
