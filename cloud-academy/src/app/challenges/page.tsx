"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Globe, 
  Search, 
  Clock,
  Users,
  Star,
  Zap,
  Shield,
  Database,
  Server,
  Lock,
  Swords
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NavbarAvatar } from "@/components/navbar";

const challenges = [
  {
    id: "netflix-streaming",
    title: "Netflix-Scale Video Streaming",
    company: "StreamCo",
    industry: "Media & Entertainment",
    difficulty: "Expert",
    duration: "45 min",
    completions: 1234,
    rating: 4.8,
    services: ["CloudFront", "S3", "Lambda", "DynamoDB"],
    description: "Design a global video streaming architecture handling 100M+ concurrent users with adaptive bitrate streaming.",
    icon: Server,
    color: "text-red-400",
    bgColor: "bg-red-400/10",
  },
  {
    id: "bank-migration",
    title: "Core Banking Migration",
    company: "GlobalBank",
    industry: "Financial Services",
    difficulty: "Expert",
    duration: "60 min",
    completions: 892,
    rating: 4.9,
    services: ["RDS", "Aurora", "KMS", "CloudHSM"],
    description: "Migrate a legacy mainframe banking system to AWS while maintaining PCI-DSS compliance and zero downtime.",
    icon: Shield,
    color: "text-green-400",
    bgColor: "bg-green-400/10",
  },
  {
    id: "healthcare-hipaa",
    title: "HIPAA-Compliant Patient Portal",
    company: "MedTech Solutions",
    industry: "Healthcare",
    difficulty: "Advanced",
    duration: "40 min",
    completions: 1567,
    rating: 4.7,
    services: ["ECS", "RDS", "WAF", "Secrets Manager"],
    description: "Build a secure patient portal with PHI protection, audit logging, and disaster recovery.",
    icon: Lock,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
  },
  {
    id: "ecommerce-blackfriday",
    title: "Black Friday Scale-Out",
    company: "MegaShop",
    industry: "E-Commerce",
    difficulty: "Advanced",
    duration: "35 min",
    completions: 2341,
    rating: 4.6,
    services: ["ELB", "Auto Scaling", "ElastiCache", "SQS"],
    description: "Design an architecture that handles 50x traffic spikes during flash sales without degradation.",
    icon: Zap,
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
  },
  {
    id: "iot-fleet",
    title: "IoT Fleet Management",
    company: "LogiTrack",
    industry: "Logistics",
    difficulty: "Intermediate",
    duration: "30 min",
    completions: 1823,
    rating: 4.5,
    services: ["IoT Core", "Kinesis", "Timestream", "QuickSight"],
    description: "Build a real-time tracking system for 100,000+ delivery vehicles with predictive analytics.",
    icon: Globe,
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
  },
  {
    id: "data-lake",
    title: "Enterprise Data Lake",
    company: "DataCorp",
    industry: "Technology",
    difficulty: "Intermediate",
    duration: "40 min",
    completions: 1456,
    rating: 4.7,
    services: ["S3", "Glue", "Athena", "Lake Formation"],
    description: "Design a petabyte-scale data lake with governance, cataloging, and self-service analytics.",
    icon: Database,
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
  },
];

const industries = ["All", "Financial Services", "Healthcare", "E-Commerce", "Media & Entertainment", "Logistics", "Technology"];
const difficulties = ["All", "Beginner", "Intermediate", "Advanced", "Expert"];

export default function ChallengesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("All");
  const [selectedDifficulty, setSelectedDifficulty] = useState("All");

  const filteredChallenges = challenges.filter((challenge) => {
    const matchesSearch = challenge.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         challenge.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesIndustry = selectedIndustry === "All" || challenge.industry === selectedIndustry;
    const matchesDifficulty = selectedDifficulty === "All" || challenge.difficulty === selectedDifficulty;
    return matchesSearch && matchesIndustry && matchesDifficulty;
  });

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
            <Link href="/challenges" className="text-foreground font-medium">
              Challenges
            </Link>
            <Link href="/game" className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-1">
              <Swords className="w-4 h-4" />
              Game Zone
            </Link>
            <Link href="/leaderboard" className="text-muted-foreground hover:text-foreground transition-colors">
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
          <h1 className="text-4xl font-bold mb-4">Architecture Challenges</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Real-world scenarios from actual companies. Design, build, and get graded on your solutions.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="px-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search challenges..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card border-border"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={selectedIndustry}
                onChange={(e) => setSelectedIndustry(e.target.value)}
                className="px-4 py-2 rounded-lg bg-card border border-border text-sm"
              >
                {industries.map((industry) => (
                  <option key={industry} value={industry}>{industry}</option>
                ))}
              </select>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="px-4 py-2 rounded-lg bg-card border border-border text-sm"
              >
                {difficulties.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>{difficulty}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Challenge Grid */}
      <section className="px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredChallenges.map((challenge) => (
              <Link key={challenge.id} href={`/challenge/${challenge.id}`}>
                <Card className="bg-card/50 border-border/50 hover:border-primary/50 transition-all hover:scale-[1.02] cursor-pointer h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl ${challenge.bgColor} flex items-center justify-center`}>
                        <challenge.icon className={`w-6 h-6 ${challenge.color}`} />
                      </div>
                      <Badge variant={
                        challenge.difficulty === "Expert" ? "destructive" :
                        challenge.difficulty === "Advanced" ? "default" :
                        "secondary"
                      }>
                        {challenge.difficulty}
                      </Badge>
                    </div>
                    
                    <h3 className="text-lg font-semibold mb-1">{challenge.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{challenge.company} • {challenge.industry}</p>
                    
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {challenge.description}
                    </p>
                    
                    <div className="flex flex-wrap gap-1 mb-4">
                      {challenge.services.slice(0, 3).map((service) => (
                        <Badge key={service} variant="outline" className="text-xs">
                          {service}
                        </Badge>
                      ))}
                      {challenge.services.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{challenge.services.length - 3}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {challenge.duration}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {challenge.completions.toLocaleString()}
                        </span>
                      </div>
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        {challenge.rating}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          
          {filteredChallenges.length === 0 && (
            <div className="text-center py-20">
              <p className="text-muted-foreground">No challenges match your filters.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
