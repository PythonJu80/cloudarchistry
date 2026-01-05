"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Target,
  CalendarDays,
  BookOpen,
  Gamepad2,
  GraduationCap,
  Layers,
  CheckCircle2,
  Circle,
  ChevronRight,
  Sparkles,
  Clock,
  TrendingUp,
  Brain,
  Zap,
  FileQuestion,
  ExternalLink,
} from "lucide-react";

// Certification display names
const CERT_NAMES: Record<string, string> = {
  // Foundational
  CLF: "Cloud Practitioner",
  AIF: "AI Practitioner",
  // Associate
  SAA: "Solutions Architect Associate",
  DVA: "Developer Associate",
  SOA: "SysOps Administrator Associate",
  DEA: "Data Engineer Associate",
  MLA: "Machine Learning Engineer Associate",
  // Professional
  SAP: "Solutions Architect Professional",
  DOP: "DevOps Engineer Professional",
  // Specialty
  ANS: "Advanced Networking Specialty",
  SCS: "Security Specialty",
  MLS: "Machine Learning Specialty",
  PAS: "SAP on AWS Specialty",
};

// Skill level display
const SKILL_LEVELS: Record<string, { label: string; color: string }> = {
  beginner: { label: "Beginner", color: "text-green-500" },
  intermediate: { label: "Intermediate", color: "text-blue-500" },
  advanced: { label: "Advanced", color: "text-purple-500" },
  expert: { label: "Expert", color: "text-amber-500" },
};

// Learning style options
const LEARNING_STYLES = [
  { value: "visual", label: "Visual", description: "Videos, diagrams, charts", icon: "🎬" },
  { value: "auditory", label: "Auditory", description: "Podcasts, discussions", icon: "🎧" },
  { value: "reading", label: "Reading/Writing", description: "Docs, notes, articles", icon: "📖" },
  { value: "hands_on", label: "Hands-on", description: "Labs, challenges, building", icon: "🛠️" },
];

// Action type icons and colors
const ACTION_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  game: { icon: <Gamepad2 className="h-4 w-4" />, color: "text-red-500", bg: "bg-red-500/10" },
  exam: { icon: <GraduationCap className="h-4 w-4" />, color: "text-amber-500", bg: "bg-amber-500/10" },
  quiz: { icon: <FileQuestion className="h-4 w-4" />, color: "text-purple-500", bg: "bg-purple-500/10" },
  challenge: { icon: <Target className="h-4 w-4" />, color: "text-cyan-500", bg: "bg-cyan-500/10" },
  flashcard: { icon: <Layers className="h-4 w-4" />, color: "text-green-500", bg: "bg-green-500/10" },
  resource: { icon: <BookOpen className="h-4 w-4" />, color: "text-blue-500", bg: "bg-blue-500/10" },
};

// Types
interface UserProfile {
  skillLevel: string;
  targetCertification: string | null;
  challengesCompleted: number;
  totalPoints: number;
  currentStreak: number;
}

interface PlanAction {
  id: string;
  type: string;
  title: string;
  description: string;
  target?: string;
  link?: string;
  completed: boolean;
  autoDetected?: boolean;    // True if completion was auto-detected from DB activity
  currentValue?: number;     // Current progress value
  targetValue?: number;      // Target value to complete
}

interface WeekPlan {
  weekNumber: number;
  theme: string;
  focus: string;
  actions: PlanAction[];
}

interface Milestone {
  id?: string;
  label: string;
  weekNumber: number;
  metric: string;
  completed: boolean;
  autoDetected?: boolean;    // True if completion was auto-detected from DB activity
  currentValue?: number;     // Current progress value
  targetValue?: number;      // Target value to complete
}

interface StudyPlanData {
  id: string;
  summary: string;
  totalWeeks: number;
  hoursPerWeek: number;
  learningStyle?: string;  // Legacy single
  learningStyles?: string[];  // New multiple
  weeks: WeekPlan[];
  milestones: Milestone[];
  accountability: string[];
  resources: { title: string; url: string; type: string }[];
  generatedAt: string;
}

interface GuideData {
  profile: UserProfile;
  currentPlan: StudyPlanData | null;
  history: { id: string; generatedAt: string; summary: string }[];
}

export default function GuidePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Profile data (auto-fetched)
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  // Current plan
  const [plan, setPlan] = useState<StudyPlanData | null>(null);
  const [history, setHistory] = useState<{ id: string; generatedAt: string; summary: string }[]>([]);
  
  // Form inputs (only what user needs to provide)
  const [form, setForm] = useState({
    examDate: "",
    hoursPerWeek: 6,
    learningStyles: ["hands_on"] as string[],  // Multiple selection
    coachNotes: "",
  });

  // Fetch profile and existing plan on mount
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch("/api/learn/guide");
      if (!response.ok) {
        throw new Error("Failed to load guide data");
      }
      
      const data: GuideData = await response.json();
      setProfile(data.profile);
      setPlan(data.currentPlan);
      setHistory(data.history || []);
      
      // Pre-fill form from existing plan if available
      if (data.currentPlan) {
        const styles = data.currentPlan!.learningStyles || data.currentPlan!.learningStyle;
        setForm(prev => ({
          ...prev,
          hoursPerWeek: data.currentPlan!.hoursPerWeek || 6,
          learningStyles: Array.isArray(styles) ? styles : [styles || "hands_on"],
        }));
      }
    } catch (err) {
      console.error(err);
      setError("Unable to load your study guide. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate new plan
  const handleGenerate = async () => {
    if (!profile) return;
    
    try {
      setGenerating(true);
      setError(null);
      // Clear old plan immediately so user sees loading state
      setPlan(null);
      
      const response = await fetch("/api/learn/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examDate: form.examDate || null,
          hoursPerWeek: form.hoursPerWeek,
          learningStyles: form.learningStyles,  // Send as array
          coachNotes: form.coachNotes,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to generate plan");
      }

      const data = await response.json();
      setPlan(data.plan);
      toast.success("Study guide generated!");
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Plan generation failed";
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  // Toggle action completion
  const toggleAction = async (weekNumber: number, actionId: string) => {
    if (!plan) return;
    
    // Optimistic update
    setPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        weeks: prev.weeks.map(week => {
          if (week.weekNumber !== weekNumber) return week;
          return {
            ...week,
            actions: week.actions.map(action => {
              if (action.id !== actionId) return action;
              return { ...action, completed: !action.completed };
            }),
          };
        }),
      };
    });
    
    // Persist to backend
    try {
      await fetch("/api/learn/guide/action", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, weekNumber, actionId, actionType: "action" }),
      });
    } catch (err) {
      console.error("Failed to update action:", err);
      // Revert on error
      loadData();
    }
  };

  // Toggle milestone completion
  const toggleMilestone = async (milestoneLabel: string) => {
    if (!plan) return;
    
    // Optimistic update
    setPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        milestones: prev.milestones.map(milestone => {
          if (milestone.label !== milestoneLabel) return milestone;
          return { ...milestone, completed: !milestone.completed };
        }),
      };
    });
    
    // Persist to backend
    try {
      await fetch("/api/learn/guide/action", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, actionId: milestoneLabel, actionType: "milestone" }),
      });
    } catch (err) {
      console.error("Failed to update milestone:", err);
      // Revert on error
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your study guide...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={loadData}>Try Again</Button>
        </div>
      </div>
    );
  }

  const certName = profile?.targetCertification 
    ? CERT_NAMES[profile.targetCertification] || profile.targetCertification
    : null;
  
  const skillInfo = SKILL_LEVELS[profile?.skillLevel || "intermediate"];

  return (
    <div className="space-y-8 pb-12">
      {/* Header with profile info */}
      <div className="flex flex-col lg:flex-row gap-6 items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Study Guide
          </h1>
          <p className="text-muted-foreground mt-1">
            Your personalized learning path based on your profile and goals.
          </p>
          
          {/* Profile badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            {certName && (
              <Badge variant="outline" className="gap-1">
                <Target className="h-3.5 w-3.5" />
                {certName}
              </Badge>
            )}
            {skillInfo && (
              <Badge variant="secondary" className={cn("gap-1", skillInfo.color)}>
                <TrendingUp className="h-3.5 w-3.5" />
                {skillInfo.label}
              </Badge>
            )}
            {profile && profile.currentStreak > 0 && (
              <Badge variant="secondary" className="gap-1 text-orange-500">
                <Zap className="h-3.5 w-3.5" />
                {profile.currentStreak} day streak
              </Badge>
            )}
          </div>
        </div>
        
        {plan && (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3.5 w-3.5" />
            Updated {new Date(plan.generatedAt).toLocaleDateString()}
          </Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-[380px,1fr] gap-6">
        {/* Left: Input form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generate Plan
            </CardTitle>
            <CardDescription>
              Your certification and skill level are already set. Just tell us your availability.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Read-only profile info */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Target Certification</span>
                <span className="font-medium">{certName || "Not set"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Skill Level</span>
                <span className={cn("font-medium", skillInfo?.color)}>{skillInfo?.label || "Intermediate"}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-2 border-t">
                Update these in <Link href="/dashboard/settings" className="text-primary hover:underline">Settings</Link>
              </p>
            </div>

            {/* Exam date */}
            <div className="space-y-2">
              <Label>Exam Date (optional)</Label>
              <Input
                type="date"
                value={form.examDate}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setForm(prev => ({ ...prev, examDate: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                If set, your plan will be optimized for this deadline.
              </p>
            </div>

            {/* Hours per week */}
            <div className="space-y-2">
              <Label>Hours per Week</Label>
              <Input
                type="number"
                min={2}
                max={40}
                value={form.hoursPerWeek}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setForm(prev => ({ ...prev, hoursPerWeek: Number(e.target.value) || 6 }))
                }
              />
            </div>

            {/* Learning style */}
            <div className="space-y-2">
              <Label>Learning Styles <span className="text-muted-foreground text-xs">(select all that apply)</span></Label>
              <div className="grid grid-cols-2 gap-2">
                {LEARNING_STYLES.map((style) => {
                  const isSelected = form.learningStyles.includes(style.value);
                  return (
                    <button
                      key={style.value}
                      type="button"
                      className={cn(
                        "rounded-lg border p-3 text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => {
                        setForm(prev => {
                          const styles = prev.learningStyles.includes(style.value)
                            ? prev.learningStyles.filter(s => s !== style.value)
                            : [...prev.learningStyles, style.value];
                          // Ensure at least one is selected
                          return { ...prev, learningStyles: styles.length > 0 ? styles : [style.value] };
                        });
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg">{style.icon}</span>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="font-medium text-sm mt-1">{style.label}</p>
                      <p className="text-xs text-muted-foreground">{style.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Coach notes */}
            <div className="space-y-2">
              <Label>Notes for Your Coach</Label>
              <Textarea
                placeholder="Any deadlines, blockers, or preferences the AI should know about..."
                value={form.coachNotes}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  setForm(prev => ({ ...prev, coachNotes: e.target.value }))
                }
                rows={3}
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button 
              className="w-full" 
              onClick={handleGenerate} 
              disabled={generating || !profile?.targetCertification}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {plan ? "Regenerate Plan" : "Generate Plan"}
                </>
              )}
            </Button>
            
            {!profile?.targetCertification && (
              <p className="text-xs text-amber-500 text-center">
                Please set your target certification in Settings first.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Right: Plan display */}
        <div className="space-y-6">
          {generating ? (
            /* Loading state while generating */
            <Card>
              <CardContent className="py-16">
                <div className="flex flex-col items-center justify-center text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Generating Your Study Plan</h3>
                  <p className="text-muted-foreground max-w-md">
                    Our AI is analyzing your profile, skill level, and learning preferences to create a personalized study plan...
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span>This usually takes 10-20 seconds</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : plan ? (
            <>
              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Plan</CardTitle>
                  <CardDescription>{plan.summary}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span>{plan.totalWeeks} weeks</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{plan.hoursPerWeek} hrs/week</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Weekly breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Actions</CardTitle>
                  <CardDescription>Check off tasks as you complete them.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {plan.weeks.map((week) => (
                    <div key={week.weekNumber} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Week {week.weekNumber}: {week.theme}</h3>
                        <Badge variant="outline" className="text-xs">
                          {week.actions.filter(a => a.completed).length}/{week.actions.length} done
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{week.focus}</p>
                      
                      <div className="space-y-2">
                        {week.actions.map((action) => {
                          const config = ACTION_CONFIG[action.type] || ACTION_CONFIG.resource;
                          return (
                            <div
                              key={action.id}
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-lg border transition-all",
                                action.completed 
                                  ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" 
                                  : "hover:border-primary/50",
                                !action.autoDetected && "cursor-pointer"
                              )}
                              onClick={() => !action.autoDetected && toggleAction(week.weekNumber, action.id)}
                            >
                              <button className="mt-0.5 flex-shrink-0" disabled={action.autoDetected}>
                                {action.completed ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                  <Circle className="h-5 w-5 text-muted-foreground" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={cn("p-1 rounded", config.bg, config.color)}>
                                    {config.icon}
                                  </span>
                                  <span className={cn(
                                    "font-medium",
                                    action.completed && "text-green-700 dark:text-green-400"
                                  )}>
                                    {action.title}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {action.description}
                                </p>
                                {action.target && (
                                  <p className="text-xs text-primary mt-1">
                                    Target: {action.target}
                                  </p>
                                )}
                                {/* Progress bar for incomplete actions with progress data */}
                                {!action.completed && action.targetValue !== undefined && action.currentValue !== undefined && action.targetValue > 0 && (
                                  <div className="mt-2">
                                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                      <span>Progress: {action.currentValue} / {action.targetValue}</span>
                                      <span>{Math.min(100, Math.round((action.currentValue / action.targetValue) * 100))}%</span>
                                    </div>
                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-primary rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min(100, Math.round((action.currentValue / action.targetValue) * 100))}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                              {action.link && (
                                <Link 
                                  href={action.link}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-shrink-0"
                                >
                                  <Button size="sm" variant="ghost">
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </Link>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Milestones */}
              {plan.milestones.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Milestones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {plan.milestones.map((milestone, idx) => {
                        const progressPercent = milestone.targetValue && milestone.currentValue !== undefined
                          ? Math.min(100, Math.round((milestone.currentValue / milestone.targetValue) * 100))
                          : milestone.completed ? 100 : 0;
                        
                        return (
                          <div 
                            key={milestone.id || idx}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border transition-all",
                              milestone.completed 
                                ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" 
                                : "hover:border-primary/50",
                              !milestone.autoDetected && "cursor-pointer"
                            )}
                            onClick={() => !milestone.autoDetected && toggleMilestone(milestone.label)}
                          >
                            <button className="flex-shrink-0" disabled={milestone.autoDetected}>
                              {milestone.completed ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={cn(
                                  "font-medium",
                                  milestone.completed && "text-green-700 dark:text-green-400"
                                )}>{milestone.label}</p>
                              </div>
                              <p className="text-sm text-muted-foreground">{milestone.metric}</p>
                              {/* Progress bar for incomplete milestones */}
                              {!milestone.completed && milestone.targetValue !== undefined && milestone.currentValue !== undefined && (
                                <div className="mt-2">
                                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                    <span>Progress: {milestone.currentValue} / {milestone.targetValue}</span>
                                    <span>{progressPercent}%</span>
                                  </div>
                                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-primary rounded-full transition-all duration-500"
                                      style={{ width: `${progressPercent}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            <Badge variant="outline">Week {milestone.weekNumber}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Resources */}
              {plan.resources && plan.resources.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Recommended Resources</CardTitle>
                    <CardDescription>Based on your learning style: {
                      (plan.learningStyles || [plan.learningStyle])
                        .filter(Boolean)
                        .map(s => LEARNING_STYLES.find(ls => ls.value === s)?.label)
                        .filter(Boolean)
                        .join(", ") || "Hands-on"
                    }</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {plan.resources.map((resource, idx) => (
                        <a
                          key={idx}
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 transition-colors"
                        >
                          <BookOpen className="h-4 w-4 text-blue-500" />
                          <div className="flex-1">
                            <p className="font-medium">{resource.title}</p>
                            <p className="text-xs text-muted-foreground">{resource.type}</p>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Accountability */}
              {plan.accountability && plan.accountability.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Accountability Reminders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {plan.accountability.map((reminder, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Zap className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          {reminder}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No Study Plan Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Generate a personalized study plan based on your certification goal and learning preferences.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Your plan will include specific actions from the platform: games, challenges, exams, quizzes, and flashcards.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
