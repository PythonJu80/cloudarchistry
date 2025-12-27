"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles,
  Calendar,
  GraduationCap,
  Target,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  BookOpen,
  Clock,
  Users,
  Copy,
  Check,
  ChevronRight,
  Gamepad2,
  FileQuestion,
  Layers,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Action type icons and colors
const ACTION_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  game: { icon: <Gamepad2 className="h-4 w-4" />, color: "text-red-500", bg: "bg-red-500/10" },
  exam: { icon: <GraduationCap className="h-4 w-4" />, color: "text-amber-500", bg: "bg-amber-500/10" },
  quiz: { icon: <FileQuestion className="h-4 w-4" />, color: "text-purple-500", bg: "bg-purple-500/10" },
  challenge: { icon: <Target className="h-4 w-4" />, color: "text-cyan-500", bg: "bg-cyan-500/10" },
  flashcard: { icon: <Layers className="h-4 w-4" />, color: "text-green-500", bg: "bg-green-500/10" },
  resource: { icon: <BookOpen className="h-4 w-4" />, color: "text-blue-500", bg: "bg-blue-500/10" },
};

interface ProgramAction {
  id: string;
  actionType: string;
  type: string;
  title: string;
  description: string;
  target?: string;
  link?: string;
  estimatedMinutes?: number;
  completed: boolean;
}

interface WeekCheckpoint {
  id: string;
  title: string;
  type: "quiz" | "practical";
  criteria?: string[];
  completed: boolean;
}

interface WeekPlan {
  week: number;
  title: string;
  focus?: string;
  topics: string[];
  actions: ProgramAction[];
  checkpoint?: WeekCheckpoint;
}

interface Milestone {
  id: string;
  label: string;
  weekNumber: number;
  metric: string;
  completed: boolean;
}

interface Deliverable {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
}

interface Capstone {
  id: string;
  title: string;
  description: string;
  deliverables: Deliverable[];
  completed: boolean;
}

interface CohortProgram {
  id?: string;
  title: string;
  outcome: string;
  duration: number;
  level: string;
  sessionsPerWeek: number;
  weeklyHours: number;
  targetCertification?: string;
  weeks: WeekPlan[];
  milestones?: Milestone[];
  capstone: Capstone;
}

interface CohortProgramBuilderProps {
  teamId: string;
  teamName: string;
  onProgramGenerated?: (program: CohortProgram) => void;
}

export function CohortProgramBuilder({ teamId, teamName, onProgramGenerated }: CohortProgramBuilderProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [program, setProgram] = useState<CohortProgram | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Form state - skill level and target certification come from tutor's profile settings
  const [formData, setFormData] = useState({
    outcome: "",
    duration: "6",
    sessionsPerWeek: "2",
    weeklyHours: "4",
    focusAreas: "",
  });

  // Load existing program on mount
  const loadProgram = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/cohort/program?teamId=${teamId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.program) {
          setProgram(data.program);
        }
      }
    } catch (error) {
      console.error("Failed to load program:", error);
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadProgram();
  }, [loadProgram]);

  const handleGenerate = async () => {
    if (!formData.outcome.trim()) {
      toast({
        title: "Outcome required",
        description: "Please describe what learners should achieve by the end of the cohort.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const response = await fetch("/api/cohort/generate-program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          ...formData,
          duration: parseInt(formData.duration),
          sessionsPerWeek: parseInt(formData.sessionsPerWeek),
          weeklyHours: parseInt(formData.weeklyHours),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate program");
      }

      const newProgram = await response.json();
      setProgram(newProgram);
      onProgramGenerated?.(newProgram);
      
      toast({
        title: "Program generated!",
        description: `${newProgram.duration}-week curriculum ready for "${teamName}"`,
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle action completion
  const toggleAction = async (actionId: string, actionType: "action" | "checkpoint" | "milestone" | "deliverable") => {
    if (!program?.id) return;
    
    // Optimistic update
    setProgram(prev => {
      if (!prev) return prev;
      
      if (actionType === "milestone") {
        return {
          ...prev,
          milestones: prev.milestones?.map(m => 
            m.id === actionId ? { ...m, completed: !m.completed } : m
          ),
        };
      }
      
      if (actionType === "deliverable") {
        return {
          ...prev,
          capstone: {
            ...prev.capstone,
            deliverables: prev.capstone.deliverables.map(d =>
              d.id === actionId ? { ...d, completed: !d.completed } : d
            ),
          },
        };
      }
      
      // Action or checkpoint
      return {
        ...prev,
        weeks: prev.weeks.map(week => ({
          ...week,
          actions: week.actions.map(a =>
            a.id === actionId ? { ...a, completed: !a.completed } : a
          ),
          checkpoint: week.checkpoint?.id === actionId
            ? { ...week.checkpoint, completed: !week.checkpoint.completed }
            : week.checkpoint,
        })),
      };
    });
    
    // Persist to backend
    try {
      await fetch("/api/cohort/program/action", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: program.id, actionId, actionType }),
      });
    } catch (error) {
      console.error("Failed to update action:", error);
      loadProgram(); // Revert on error
    }
  };

  const handleCopyProgram = async () => {
    if (!program) return;
    
    const programText = formatProgramAsText(program);
    await navigator.clipboard.writeText(programText);
    setCopied(true);
    toast({ title: "Copied!", description: "Program copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const formatProgramAsText = (prog: CohortProgram): string => {
    let text = `# ${prog.title}\n\n`;
    text += `**Outcome:** ${prog.outcome}\n`;
    text += `**Duration:** ${prog.duration} weeks\n`;
    text += `**Level:** ${prog.level}\n`;
    text += `**Sessions/Week:** ${prog.sessionsPerWeek}\n`;
    text += `**Weekly Hours:** ${prog.weeklyHours}\n\n`;
    
    text += `## Weekly Breakdown\n\n`;
    prog.weeks.forEach((week) => {
      text += `### Week ${week.week}: ${week.title}\n`;
      if (week.focus) text += `**Focus:** ${week.focus}\n`;
      text += `**Topics:** ${week.topics.join(", ")}\n`;
      text += `**Actions:**\n`;
      week.actions.forEach((action) => {
        text += `- [${action.completed ? "x" : " "}] ${action.title}: ${action.description}\n`;
      });
      if (week.checkpoint) {
        text += `**Checkpoint:** ${week.checkpoint.title} (${week.checkpoint.type})\n`;
      }
      text += `\n`;
    });
    
    text += `## Capstone Project\n\n`;
    text += `**${prog.capstone.title}**\n`;
    text += `${prog.capstone.description}\n\n`;
    text += `**Deliverables:**\n`;
    prog.capstone.deliverables.forEach((d) => {
      text += `- [${d.completed ? "x" : " "}] ${d.title}\n`;
    });
    
    return text;
  };

  // Calculate progress
  const calculateProgress = () => {
    if (!program) return { completed: 0, total: 0, percentage: 0 };
    
    let completed = 0;
    let total = 0;
    
    program.weeks.forEach(week => {
      week.actions.forEach(action => {
        total++;
        if (action.completed) completed++;
      });
      if (week.checkpoint) {
        total++;
        if (week.checkpoint.completed) completed++;
      }
    });
    
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  };

  const progress = calculateProgress();

  return (
    <Card className="bg-gradient-to-br from-purple-500/10 via-card/50 to-cyan-500/10 border-purple-500/30">
      <CardHeader 
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                AI Cohort Program Builder
                <Badge variant="secondary" className="text-xs">Beta</Badge>
              </CardTitle>
              <CardDescription>
                Generate a complete AWS learning curriculum with AI
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              <span className="ml-2 text-muted-foreground">Loading program...</span>
            </div>
          )}

          {/* Configuration Form */}
          {!program && !isLoading && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="outcome">
                  <Target className="w-4 h-4 inline mr-2" />
                  Cohort Outcome *
                </Label>
                <Textarea
                  id="outcome"
                  placeholder="e.g., Deploy a production-ready serverless API on AWS and pass Cloud Practitioner certification"
                  value={formData.outcome}
                  onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Duration (weeks)
                </Label>
                <Select
                  value={formData.duration}
                  onValueChange={(v) => setFormData({ ...formData, duration: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 weeks (Intensive)</SelectItem>
                    <SelectItem value="6">6 weeks (Standard)</SelectItem>
                    <SelectItem value="8">8 weeks (Comprehensive)</SelectItem>
                    <SelectItem value="12">12 weeks (Deep Dive)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sessions">
                  <Users className="w-4 h-4 inline mr-2" />
                  Sessions per Week
                </Label>
                <Select
                  value={formData.sessionsPerWeek}
                  onValueChange={(v) => setFormData({ ...formData, sessionsPerWeek: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 session</SelectItem>
                    <SelectItem value="2">2 sessions</SelectItem>
                    <SelectItem value="3">3 sessions</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hours">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Expected Weekly Hours
                </Label>
                <Select
                  value={formData.weeklyHours}
                  onValueChange={(v) => setFormData({ ...formData, weeklyHours: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2-3 hours</SelectItem>
                    <SelectItem value="4">4-5 hours</SelectItem>
                    <SelectItem value="6">6-8 hours</SelectItem>
                    <SelectItem value="10">10+ hours (Bootcamp)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="focus">
                  <BookOpen className="w-4 h-4 inline mr-2" />
                  Focus Areas (optional)
                </Label>
                <Input
                  id="focus"
                  placeholder="e.g., Serverless, Containers, Security"
                  value={formData.focusAreas}
                  onChange={(e) => setFormData({ ...formData, focusAreas: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  💡 Skill level and target certification are pulled from your profile settings.
                </p>
              </div>

              <div className="md:col-span-2">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !formData.outcome.trim()}
                  className="w-full gap-2 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Curriculum...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Cohort Program
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Program Display with Interactive Checkboxes */}
          {program && (
            <div className="space-y-6">
              {/* Program Header with Progress */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold">{program.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {program.outcome}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline">{program.duration} weeks</Badge>
                    <Badge variant="outline" className="capitalize">{program.level}</Badge>
                    <Badge variant="outline">{program.sessionsPerWeek} sessions/week</Badge>
                    <Badge variant="outline">{program.weeklyHours}h/week</Badge>
                    {program.targetCertification && (
                      <Badge variant="secondary">{program.targetCertification}</Badge>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{progress.completed}/{progress.total} ({progress.percentage}%)</span>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyProgram}
                    className="gap-2"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setProgram(null)}
                  >
                    New Program
                  </Button>
                </div>
              </div>

              {/* Weekly Actions with Checkboxes */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  Weekly Actions
                  <span className="text-xs text-muted-foreground font-normal">
                    (Click to mark complete)
                  </span>
                </h4>
                
                {program.weeks.map((week) => {
                  const weekCompleted = week.actions.filter(a => a.completed).length;
                  const weekTotal = week.actions.length;
                  
                  return (
                    <div
                      key={week.week}
                      className="p-4 rounded-lg bg-background/50 border border-border/50"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                            Week {week.week}
                          </Badge>
                          <span className="font-medium">{week.title}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {weekCompleted}/{weekTotal} done
                        </Badge>
                      </div>
                      
                      {week.focus && (
                        <p className="text-sm text-muted-foreground mb-3">{week.focus}</p>
                      )}
                      
                      {/* Topics */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {week.topics.map((topic, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                      
                      {/* Actions with checkboxes */}
                      <div className="space-y-2">
                        {week.actions.map((action) => {
                          const config = ACTION_CONFIG[action.type] || ACTION_CONFIG.resource;
                          return (
                            <div
                              key={action.id}
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                                action.completed 
                                  ? "bg-muted/50 border-muted" 
                                  : "hover:border-primary/50"
                              )}
                              onClick={() => toggleAction(action.id, "action")}
                            >
                              <button className="mt-0.5 flex-shrink-0">
                                {action.completed ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                  <Circle className="h-5 w-5 text-muted-foreground" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={cn("p-1 rounded", config.bg, config.color)}>
                                    {config.icon}
                                  </span>
                                  <span className={cn(
                                    "font-medium",
                                    action.completed && "line-through text-muted-foreground"
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
                      
                      {/* Checkpoint */}
                      {week.checkpoint && (
                        <div 
                          className={cn(
                            "mt-3 p-3 rounded-lg border-2 border-dashed cursor-pointer transition-all",
                            week.checkpoint.completed 
                              ? "border-green-500/50 bg-green-500/10" 
                              : "border-amber-500/50 bg-amber-500/10"
                          )}
                          onClick={() => toggleAction(week.checkpoint!.id, "checkpoint")}
                        >
                          <div className="flex items-center gap-2">
                            {week.checkpoint.completed ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <Circle className="h-5 w-5 text-amber-500" />
                            )}
                            <span className="font-medium">
                              {week.checkpoint.type === "quiz" ? "📝" : "🔧"} {week.checkpoint.title}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Milestones */}
              {program.milestones && program.milestones.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Milestones
                  </h4>
                  <div className="space-y-2">
                    {program.milestones.map((milestone) => (
                      <div 
                        key={milestone.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                          milestone.completed 
                            ? "bg-muted/50 border-muted" 
                            : "hover:border-primary/50"
                        )}
                        onClick={() => toggleAction(milestone.id, "milestone")}
                      >
                        {milestone.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className={cn("font-medium", milestone.completed && "line-through text-muted-foreground")}>
                            {milestone.label}
                          </p>
                          <p className="text-sm text-muted-foreground">{milestone.metric}</p>
                        </div>
                        <Badge variant="outline">Week {milestone.weekNumber}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Capstone */}
              <div className="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30">
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <GraduationCap className="w-5 h-5 text-amber-400" />
                  Capstone Project
                </h4>
                <p className="font-medium">{program.capstone.title}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {program.capstone.description}
                </p>
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Deliverables:</p>
                  {program.capstone.deliverables.map((d) => (
                    <div 
                      key={d.id} 
                      className={cn(
                        "flex items-center gap-2 p-2 rounded cursor-pointer transition-all",
                        d.completed ? "bg-green-500/10" : "hover:bg-secondary/50"
                      )}
                      onClick={() => toggleAction(d.id, "deliverable")}
                    >
                      {d.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-amber-400" />
                      )}
                      <span className={cn("text-sm", d.completed && "line-through text-muted-foreground")}>
                        {d.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
