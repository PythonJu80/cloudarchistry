"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Send,
  Zap,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  Brain,
  Lightbulb,
  Award,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Types matching the learning agent
interface CompanyInfo {
  name: string;
  industry: string;
  description: string;
  headquarters?: string;
  employee_count?: string;
  key_services: string[];
  technology_stack: string[];
  compliance_requirements: string[];
  business_challenges: string[];
  data_types: string[];
  traffic_patterns?: string;
  global_presence?: string;
}

interface ScenarioChallenge {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  points: number;
  hints: string[];
  success_criteria: string[];
  aws_services_relevant: string[];
  estimated_time_minutes: number;
}

interface CloudScenario {
  id: string;
  company_name: string;
  scenario_title: string;
  scenario_description: string;
  business_context: string;
  technical_requirements: string[];
  compliance_requirements: string[];
  constraints: string[];
  challenges: ScenarioChallenge[];
  learning_objectives: string[];
  difficulty: string;
  estimated_total_time_minutes: number;
  tags: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Sample location data (would come from DB in production)
const LOCATIONS: Record<string, { company: string; industry: string; icon: string }> = {
  "hsbc-london": { company: "HSBC", industry: "Banking & Finance", icon: "🏦" },
  "barclays-canary": { company: "Barclays", industry: "Banking & Finance", icon: "🏦" },
  "nhs-london": { company: "NHS", industry: "Healthcare", icon: "🏥" },
  "google-mv": { company: "Google", industry: "Technology", icon: "🔍" },
  "meta-menlo": { company: "Meta", industry: "Social Media", icon: "📱" },
  "amazon-seattle": { company: "Amazon", industry: "E-Commerce", icon: "🛒" },
  "netflix-la": { company: "Netflix", industry: "Media & Streaming", icon: "📺" },
  "nintendo-kyoto": { company: "Nintendo", industry: "Gaming", icon: "🎮" },
  "bmw-munich": { company: "BMW", industry: "Automotive", icon: "🚗" },
  "dbs-singapore": { company: "DBS Bank", industry: "Banking & Finance", icon: "🏦" },
  "emirates-dubai": { company: "Emirates", industry: "Logistics & Aviation", icon: "✈️" },
  "lvmh-paris": { company: "LVMH", industry: "Retail & Luxury", icon: "👜" },
};

const difficultyColors: Record<string, { bg: string; text: string }> = {
  beginner: { bg: "bg-green-500/20", text: "text-green-400" },
  intermediate: { bg: "bg-amber-500/20", text: "text-amber-400" },
  advanced: { bg: "bg-orange-500/20", text: "text-orange-400" },
  expert: { bg: "bg-red-500/20", text: "text-red-400" },
};

export default function ChallengePage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;
  const location = LOCATIONS[locationId];

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<CloudScenario | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null); // Used for company details panel
  const [activeChallenge, setActiveChallenge] = useState<number>(0);
  const [completedChallenges, setCompletedChallenges] = useState<string[]>([]);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Generate scenario on mount
  useEffect(() => {
    if (!location) {
      setError("Location not found");
      setIsLoading(false);
      return;
    }

    generateScenario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const generateScenario = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: location.company,
          industry: location.industry,
          user_level: "intermediate", // TODO: Get from user profile
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate scenario");
      }

      const data = await response.json();
      
      if (data.success && data.scenario) {
        setScenario(data.scenario);
        setCompanyInfo(data.company_info);
        
        // Add welcome message from coach
        setChatMessages([{
          role: "assistant",
          content: `Welcome to the ${data.scenario.scenario_title} challenge! 🎯\n\nI'm Sophia, your cloud architecture coach. I'll guide you through this scenario based on real-world requirements from ${location.company}.\n\n${data.scenario.business_context}\n\nReady to start? Take a look at the first challenge and let me know if you have any questions!`,
          timestamp: new Date(),
        }]);
      } else {
        throw new Error(data.error || "Failed to generate scenario");
      }
    } catch (err) {
      console.error("Scenario generation error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: chatInput,
          scenario_id: scenario?.id,
          challenge_id: scenario?.challenges[activeChallenge]?.id,
          context: {
            company: location.company,
            industry: location.industry,
            challenge_title: scenario?.challenges[activeChallenge]?.title,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      }]);
    } catch (err) {
      console.error("Chat error:", err);
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        content: "I'm having trouble connecting. Please try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const markChallengeComplete = (challengeId: string) => {
    if (!completedChallenges.includes(challengeId)) {
      setCompletedChallenges((prev) => [...prev, challengeId]);
      
      // Add congratulations message
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        content: `🎉 Excellent work completing this challenge! You've demonstrated solid understanding of the requirements.\n\n${activeChallenge < (scenario?.challenges.length || 0) - 1 ? "Ready for the next challenge? Click 'Next Challenge' to continue!" : "You've completed all challenges in this scenario! Amazing job! 🏆"}`,
        timestamp: new Date(),
      }]);
    }
  };

  if (!location) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Location Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The challenge location you are looking for does not exist.
            </p>
            <Link href="/world">
              <Button>Back to World Map</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-cyan-500/30 animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Brain className="w-8 h-8 text-white animate-pulse" />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-2">Generating Your Scenario</h2>
          <p className="text-muted-foreground mb-4">
            Researching {location.company} and creating a personalized challenge...
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>This may take 15-30 seconds</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Generation Failed</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => router.back()}>
                Go Back
              </Button>
              <Button onClick={generateScenario}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentChallenge = scenario?.challenges[activeChallenge];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/world">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                World Map
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-2xl">{location.icon}</span>
              <div>
                <h1 className="font-bold">{scenario?.scenario_title || location.company}</h1>
                <p className="text-xs text-muted-foreground">{location.industry}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span>{completedChallenges.length}/{scenario?.challenges.length || 0}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>~{scenario?.estimated_total_time_minutes || 60}min</span>
            </div>
            {scenario && (
              <span className={cn(
                "text-xs px-2 py-1 rounded-full",
                difficultyColors[scenario.difficulty]?.bg || "bg-secondary",
                difficultyColors[scenario.difficulty]?.text || "text-foreground"
              )}>
                {scenario.difficulty}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content - Challenges */}
        <div className="lg:col-span-2 space-y-4">
          {/* Scenario Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                Scenario Overview
              </CardTitle>
              <CardDescription>{scenario?.scenario_description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Learning Objectives */}
              <div>
                <h4 className="text-sm font-medium mb-2">Learning Objectives</h4>
                <ul className="space-y-1">
                  {scenario?.learning_objectives.map((obj, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Technical Requirements */}
              <div>
                <h4 className="text-sm font-medium mb-2">Technical Requirements</h4>
                <div className="flex flex-wrap gap-1">
                  {scenario?.technical_requirements.map((req, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded bg-secondary">
                      {req}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Challenge Cards */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Target className="w-5 h-5" />
              Challenges
            </h3>
            {scenario?.challenges.map((challenge, index) => {
              const isCompleted = completedChallenges.includes(challenge.id);
              const isActive = index === activeChallenge;
              
              return (
                <Card
                  key={challenge.id}
                  className={cn(
                    "cursor-pointer transition-all",
                    isActive && "ring-2 ring-primary",
                    isCompleted && "opacity-75"
                  )}
                  onClick={() => setActiveChallenge(index)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                          isCompleted ? "bg-green-500 text-white" : "bg-secondary"
                        )}>
                          {isCompleted ? <CheckCircle className="w-5 h-5" /> : index + 1}
                        </div>
                        <div>
                          <h4 className="font-medium">{challenge.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {challenge.description}
                          </p>
                          {isActive && (
                            <div className="mt-3 space-y-2">
                              <div className="flex flex-wrap gap-1">
                                {challenge.aws_services_relevant.map((service) => (
                                  <span
                                    key={service}
                                    className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400"
                                  >
                                    {service}
                                  </span>
                                ))}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Award className="w-3 h-3" />
                                  {challenge.points} pts
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  ~{challenge.estimated_time_minutes}min
                                </span>
                              </div>
                              {!isCompleted && (
                                <Button
                                  size="sm"
                                  className="mt-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markChallengeComplete(challenge.id);
                                  }}
                                >
                                  Mark Complete
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        "w-5 h-5 text-muted-foreground transition-transform",
                        isActive && "rotate-90"
                      )} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20 h-[calc(100vh-6rem)] flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
                Sophia - Your Coach
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-secondary rounded-lg px-3 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Hints */}
              {currentChallenge?.hints && currentChallenge.hints.length > 0 && (
                <div className="px-4 py-2 border-t border-border/50">
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    onClick={() => {
                      const hint = currentChallenge.hints[0];
                      setChatMessages((prev) => [...prev, {
                        role: "assistant",
                        content: `💡 Hint: ${hint}`,
                        timestamp: new Date(),
                      }]);
                    }}
                  >
                    <Lightbulb className="w-3 h-3" />
                    Need a hint?
                  </button>
                </div>
              )}

              {/* Input */}
              <div className="p-4 border-t border-border/50">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendChatMessage();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask Sophia for help..."
                    disabled={isChatLoading}
                  />
                  <Button type="submit" size="icon" disabled={isChatLoading || !chatInput.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
