"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Globe, 
  Trophy,
  Medal,
  Crown,
  Star,
  TrendingUp,
  Calendar,
  Swords
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NavbarAvatar } from "@/components/navbar";

const leaderboardData = [
  {
    rank: 1,
    name: "Sarah Chen",
    avatar: "SC",
    points: 15420,
    challenges: 89,
    streak: 45,
    badges: ["AWS Expert", "Speed Demon", "Perfect Score"],
    change: 0,
  },
  {
    rank: 2,
    name: "Marcus Johnson",
    avatar: "MJ",
    points: 14890,
    challenges: 82,
    streak: 32,
    badges: ["Security Master", "Multi-Cloud"],
    change: 2,
  },
  {
    rank: 3,
    name: "Priya Patel",
    avatar: "PP",
    points: 14250,
    challenges: 78,
    streak: 28,
    badges: ["Cost Optimizer", "Database Guru"],
    change: -1,
  },
  {
    rank: 4,
    name: "James Wilson",
    avatar: "JW",
    points: 13800,
    challenges: 75,
    streak: 21,
    badges: ["Serverless Pro"],
    change: 1,
  },
  {
    rank: 5,
    name: "Emma Rodriguez",
    avatar: "ER",
    points: 13450,
    challenges: 71,
    streak: 19,
    badges: ["Network Ninja"],
    change: -2,
  },
  {
    rank: 6,
    name: "David Kim",
    avatar: "DK",
    points: 12900,
    challenges: 68,
    streak: 15,
    badges: ["Container King"],
    change: 3,
  },
  {
    rank: 7,
    name: "Lisa Thompson",
    avatar: "LT",
    points: 12500,
    challenges: 65,
    streak: 12,
    badges: ["ML Pioneer"],
    change: 0,
  },
  {
    rank: 8,
    name: "Alex Murphy",
    avatar: "AM",
    points: 12100,
    challenges: 62,
    streak: 10,
    badges: ["DevOps Master"],
    change: 1,
  },
  {
    rank: 9,
    name: "Nina Kowalski",
    avatar: "NK",
    points: 11800,
    challenges: 59,
    streak: 8,
    badges: ["Rising Star"],
    change: 4,
  },
  {
    rank: 10,
    name: "Ryan O'Brien",
    avatar: "RO",
    points: 11500,
    challenges: 56,
    streak: 7,
    badges: ["Consistent"],
    change: -1,
  },
];

const timeFilters = ["All Time", "This Month", "This Week", "Today"];

export default function LeaderboardPage() {
  const [selectedTime, setSelectedTime] = useState("All Time");

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-amber-400" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-slate-300" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
  };

  const getChangeIndicator = (change: number) => {
    if (change > 0) return <span className="text-green-400 text-sm">↑{change}</span>;
    if (change < 0) return <span className="text-red-400 text-sm">↓{Math.abs(change)}</span>;
    return <span className="text-muted-foreground text-sm">-</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <NavbarAvatar />
            <span className="text-xl font-bold">CloudAcademy</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/world" className="text-muted-foreground hover:text-foreground transition-colors">
              World Map
            </Link>
            <Link href="/challenges" className="text-muted-foreground hover:text-foreground transition-colors">
              Challenges
            </Link>
            <Link href="/game" className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-1">
              <Swords className="w-4 h-4" />
              Game Zone
            </Link>
            <Link href="/leaderboard" className="text-foreground font-medium">
              Leaderboard
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button variant="glow" size="sm">Start Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-24 pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Trophy className="w-10 h-10 text-amber-400" />
            <h1 className="text-4xl font-bold">Global Leaderboard</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Top architects ranked by points, challenges completed, and consistency.
          </p>
        </div>
      </section>

      {/* Time Filter */}
      <section className="px-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-2">
            {timeFilters.map((filter) => (
              <Button
                key={filter}
                variant={selectedTime === filter ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTime(filter)}
              >
                {filter}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      <section className="px-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  Top Architect
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{leaderboardData[0].name}</p>
                <p className="text-sm text-muted-foreground">{leaderboardData[0].points.toLocaleString()} points</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  Biggest Climber
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">Nina Kowalski</p>
                <p className="text-sm text-green-400">↑4 positions this week</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  Longest Streak
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{leaderboardData[0].streak} days</p>
                <p className="text-sm text-muted-foreground">by {leaderboardData[0].name}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Leaderboard Table */}
      <section className="px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {leaderboardData.map((user, index) => (
                  <div
                    key={user.rank}
                    className={`flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors ${
                      index < 3 ? "bg-gradient-to-r from-amber-500/5 to-transparent" : ""
                    }`}
                  >
                    {/* Rank */}
                    <div className="w-12 flex items-center justify-center">
                      {getRankIcon(user.rank)}
                    </div>
                    
                    {/* Avatar */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black" :
                      index === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-black" :
                      index === 2 ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white" :
                      "bg-accent text-foreground"
                    }`}>
                      {user.avatar}
                    </div>
                    
                    {/* Name & Badges */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{user.name}</p>
                      <div className="flex gap-1 flex-wrap">
                        {user.badges.slice(0, 2).map((badge) => (
                          <Badge key={badge} variant="outline" className="text-xs">
                            {badge}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="hidden md:flex items-center gap-8 text-sm">
                      <div className="text-center">
                        <p className="font-bold">{user.challenges}</p>
                        <p className="text-muted-foreground text-xs">Challenges</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold">{user.streak}</p>
                        <p className="text-muted-foreground text-xs">Day Streak</p>
                      </div>
                    </div>
                    
                    {/* Points & Change */}
                    <div className="text-right">
                      <p className="font-bold text-lg">{user.points.toLocaleString()}</p>
                      <div className="flex items-center justify-end gap-1">
                        <Star className="w-3 h-3 text-amber-400" />
                        {getChangeIndicator(user.change)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
