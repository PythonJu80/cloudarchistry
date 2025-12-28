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
  Trophy,
  Presentation,
  Monitor,
  MessageCircle,
  Code,
  Layout,
  FileText,
  HelpCircle,
  ClipboardCheck,
  Edit3,
  Gamepad2,
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

// Teaching method icons
const METHOD_ICONS: Record<string, React.ReactNode> = {
  lecture: <Presentation className="h-4 w-4" />,
  demo: <Monitor className="h-4 w-4" />,
  guided_lab: <Users className="h-4 w-4" />,
  independent_lab: <Target className="h-4 w-4" />,
  group_discussion: <MessageCircle className="h-4 w-4" />,
  code_along: <Code className="h-4 w-4" />,
  architecture_review: <Layout className="h-4 w-4" />,
  case_study: <FileText className="h-4 w-4" />,
  q_and_a: <HelpCircle className="h-4 w-4" />,
  quiz_review: <ClipboardCheck className="h-4 w-4" />,
  pair_exercise: <Users className="h-4 w-4" />,
  whiteboard: <Edit3 className="h-4 w-4" />,
  game: <Gamepad2 className="h-4 w-4" />,
};

// Method colors for visual distinction
const METHOD_COLORS: Record<string, string> = {
  lecture: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  demo: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  guided_lab: "bg-green-500/10 text-green-500 border-green-500/30",
  independent_lab: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
  group_discussion: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  code_along: "bg-pink-500/10 text-pink-500 border-pink-500/30",
  architecture_review: "bg-indigo-500/10 text-indigo-500 border-indigo-500/30",
  case_study: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  q_and_a: "bg-teal-500/10 text-teal-500 border-teal-500/30",
  quiz_review: "bg-red-500/10 text-red-500 border-red-500/30",
  pair_exercise: "bg-lime-500/10 text-lime-500 border-lime-500/30",
  whiteboard: "bg-violet-500/10 text-violet-500 border-violet-500/30",
  game: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
};

// Agenda item within a session
interface AgendaItem {
  id: string;
  time: string;
  activity: string;
  method: string;
  methodTitle?: string;
  methodIcon?: string;
  notes: string;
}

// Demonstration to perform
interface Demonstration {
  title: string;
  steps: string[];
}

// A single teaching session
interface Session {
  id: string;
  sessionNumber: number;
  title: string;
  duration: string;
  overview: string;
  agenda: AgendaItem[];
  keyPoints: string[];
  demonstrations: Demonstration[];
  discussionQuestions: string[];
  commonMistakes: string[];
  completed: boolean;
}

// Homework assignment for the week
interface Homework {
  description: string;
  platformFeature?: string;
  featureTitle?: string;
  link?: string;
  estimatedTime: string;
  completed: boolean;
}

// Week plan with sessions
interface WeekPlan {
  week: number;
  title: string;
  learningObjectives: string[];
  sessions: Session[];
  homework?: Homework;
  assessmentCriteria: string[];
}

// Milestone
interface Milestone {
  id: string;
  label: string;
  weekNumber: number;
  successIndicators: string[];
  completed: boolean;
}

// Capstone project
interface Capstone {
  id: string;
  title: string;
  description: string;
  evaluationCriteria: string[];
  presentationFormat: string;
  completed: boolean;
}

// Tutor resources
interface TutorResources {
  prerequisiteKnowledge: string[];
  suggestedPrep: string[];
  commonChallenges: string[];
}

// Full cohort program (teaching delivery plan)
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
  tutorResources?: TutorResources;
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

  // Toggle session/milestone completion
  const toggleItem = async (itemId: string, itemType: "session" | "milestone" | "homework") => {
    if (!program?.id) return;
    
    // Optimistic update
    setProgram(prev => {
      if (!prev) return prev;
      
      if (itemType === "milestone") {
        return {
          ...prev,
          milestones: prev.milestones?.map(m => 
            m.id === itemId ? { ...m, completed: !m.completed } : m
          ),
        };
      }
      
      if (itemType === "homework") {
        return {
          ...prev,
          weeks: prev.weeks.map(week => ({
            ...week,
            homework: week.homework
              ? { ...week.homework, completed: !week.homework.completed }
              : week.homework,
          })),
        };
      }
      
      // Session
      return {
        ...prev,
        weeks: prev.weeks.map(week => ({
          ...week,
          sessions: week.sessions.map(s =>
            s.id === itemId ? { ...s, completed: !s.completed } : s
          ),
        })),
      };
    });
    
    // Persist to backend
    try {
      await fetch("/api/cohort/program/action", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: program.id, actionId: itemId, actionType: itemType }),
      });
    } catch (error) {
      console.error("Failed to update item:", error);
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
    
    text += `## Weekly Teaching Plan\n\n`;
    prog.weeks.forEach((week) => {
      text += `### Week ${week.week}: ${week.title}\n\n`;
      text += `**Learning Objectives:**\n`;
      week.learningObjectives.forEach((obj) => {
        text += `- ${obj}\n`;
      });
      text += `\n`;
      
      week.sessions.forEach((session) => {
        text += `#### Session ${session.sessionNumber}: ${session.title} (${session.duration})\n`;
        text += `${session.overview}\n\n`;
        
        text += `**Agenda:**\n`;
        session.agenda.forEach((item) => {
          text += `- ${item.time}: ${item.activity} [${item.method}]\n`;
          if (item.notes) text += `  - Notes: ${item.notes}\n`;
        });
        text += `\n`;
        
        if (session.keyPoints.length > 0) {
          text += `**Key Points:**\n`;
          session.keyPoints.forEach((point) => {
            text += `- ${point}\n`;
          });
          text += `\n`;
        }
        
        if (session.demonstrations.length > 0) {
          text += `**Demonstrations:**\n`;
          session.demonstrations.forEach((demo) => {
            text += `- ${demo.title}\n`;
            demo.steps.forEach((step) => {
              text += `  - ${step}\n`;
            });
          });
          text += `\n`;
        }
        
        if (session.discussionQuestions.length > 0) {
          text += `**Discussion Questions:**\n`;
          session.discussionQuestions.forEach((q) => {
            text += `- ${q}\n`;
          });
          text += `\n`;
        }
        
        if (session.commonMistakes.length > 0) {
          text += `**Common Mistakes to Address:**\n`;
          session.commonMistakes.forEach((m) => {
            text += `- ${m}\n`;
          });
          text += `\n`;
        }
      });
      
      if (week.homework) {
        text += `**Homework:** ${week.homework.description} (${week.homework.estimatedTime})\n\n`;
      }
      
      text += `**Assessment Criteria:**\n`;
      week.assessmentCriteria.forEach((c) => {
        text += `- ${c}\n`;
      });
      text += `\n---\n\n`;
    });
    
    text += `## Capstone Project\n\n`;
    text += `**${prog.capstone.title}**\n`;
    text += `${prog.capstone.description}\n\n`;
    text += `**Presentation Format:** ${prog.capstone.presentationFormat}\n\n`;
    text += `**Evaluation Criteria:**\n`;
    prog.capstone.evaluationCriteria.forEach((c) => {
      text += `- ${c}\n`;
    });
    
    if (prog.tutorResources) {
      text += `\n## Tutor Resources\n\n`;
      text += `**Prerequisite Knowledge:**\n`;
      prog.tutorResources.prerequisiteKnowledge.forEach((k) => {
        text += `- ${k}\n`;
      });
      text += `\n**Suggested Prep:**\n`;
      prog.tutorResources.suggestedPrep.forEach((p) => {
        text += `- ${p}\n`;
      });
      text += `\n**Common Challenges:**\n`;
      prog.tutorResources.commonChallenges.forEach((c) => {
        text += `- ${c}\n`;
      });
    }
    
    return text;
  };

  // Calculate progress (sessions completed)
  const calculateProgress = () => {
    if (!program) return { completed: 0, total: 0, percentage: 0 };
    
    let completed = 0;
    let total = 0;
    
    program.weeks.forEach(week => {
      week.sessions.forEach(session => {
        total++;
        if (session.completed) completed++;
      });
    });
    
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  };

  const progress = calculateProgress();
  
  // State for expanded sessions
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  
  const toggleSessionExpand = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

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

          {/* Teaching Delivery Plan Display */}
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
                      <span className="text-muted-foreground">Sessions Delivered</span>
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

              {/* Weekly Teaching Plan */}
              <div className="space-y-6">
                <h4 className="font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  Weekly Teaching Plan
                </h4>
                
                {program.weeks.map((week) => {
                  const weekSessionsCompleted = week.sessions.filter(s => s.completed).length;
                  const weekSessionsTotal = week.sessions.length;
                  
                  return (
                    <div
                      key={week.week}
                      className="p-4 rounded-lg bg-background/50 border border-border/50"
                    >
                      {/* Week Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                            Week {week.week}
                          </Badge>
                          <span className="font-medium">{week.title}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {weekSessionsCompleted}/{weekSessionsTotal} sessions
                        </Badge>
                      </div>
                      
                      {/* Learning Objectives */}
                      <div className="mb-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <p className="text-xs font-medium text-blue-400 mb-2 flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          Learning Objectives
                        </p>
                        <ul className="space-y-1">
                          {(week.learningObjectives || []).map((obj, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-blue-400 mt-1">•</span>
                              {obj}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {/* Sessions */}
                      <div className="space-y-3">
                        {week.sessions.map((session) => {
                          const isExpanded = expandedSessions.has(session.id);
                          
                          return (
                            <div
                              key={session.id}
                              className={cn(
                                "rounded-lg border transition-all",
                                session.completed 
                                  ? "bg-green-500/5 border-green-500/30" 
                                  : "border-border/50"
                              )}
                            >
                              {/* Session Header */}
                              <div 
                                className="p-3 flex items-center justify-between cursor-pointer"
                                onClick={() => toggleSessionExpand(session.id)}
                              >
                                <div className="flex items-center gap-3">
                                  <button 
                                    className="flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleItem(session.id, "session");
                                    }}
                                  >
                                    {session.completed ? (
                                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : (
                                      <Circle className="h-5 w-5 text-muted-foreground" />
                                    )}
                                  </button>
                                  <div>
                                    <p className={cn(
                                      "font-medium",
                                      session.completed && "text-muted-foreground"
                                    )}>
                                      Session {session.sessionNumber}: {session.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                                      <Clock className="w-3 h-3" />
                                      {session.duration}
                                    </p>
                                  </div>
                                </div>
                                <ChevronRight className={cn(
                                  "w-5 h-5 text-muted-foreground transition-transform",
                                  isExpanded && "rotate-90"
                                )} />
                              </div>
                              
                              {/* Expanded Session Details */}
                              {isExpanded && (
                                <div className="px-3 pb-3 space-y-4 border-t border-border/50 pt-3">
                                  {/* Overview */}
                                  <p className="text-sm text-muted-foreground">{session.overview}</p>
                                  
                                  {/* Agenda */}
                                  <div>
                                    <p className="text-xs font-medium text-purple-400 mb-2 flex items-center gap-1">
                                      <BookOpen className="w-3 h-3" />
                                      Session Agenda
                                    </p>
                                    <div className="space-y-2">
                                      {(session.agenda || []).map((item) => (
                                        <div 
                                          key={item.id}
                                          className={cn(
                                            "p-2 rounded-lg border text-sm",
                                            METHOD_COLORS[item.method] || "bg-secondary/50"
                                          )}
                                        >
                                          <div className="flex items-center gap-2 mb-1">
                                            {METHOD_ICONS[item.method] || <BookOpen className="h-4 w-4" />}
                                            <span className="font-medium">{item.time}</span>
                                            <span className="text-xs opacity-70">({item.methodTitle || item.method})</span>
                                          </div>
                                          <p>{item.activity}</p>
                                          {item.notes && (
                                            <p className="text-xs mt-1 opacity-70 italic">💡 {item.notes}</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  {/* Key Points */}
                                  {session.keyPoints.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-green-400 mb-2 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Key Points to Emphasize
                                      </p>
                                      <ul className="space-y-1">
                                        {(session.keyPoints || []).map((point, i) => (
                                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                            <span className="text-green-400 mt-1">✓</span>
                                            {point}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {/* Demonstrations */}
                                  {session.demonstrations.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-cyan-400 mb-2 flex items-center gap-1">
                                        <Monitor className="w-3 h-3" />
                                        Demonstrations
                                      </p>
                                      {(session.demonstrations || []).map((demo, i) => (
                                        <div key={i} className="mb-2 p-2 rounded bg-cyan-500/5 border border-cyan-500/20">
                                          <p className="text-sm font-medium">{demo.title}</p>
                                          <ol className="mt-1 space-y-1">
                                            {(demo.steps || []).map((step, j) => (
                                              <li key={j} className="text-xs text-muted-foreground flex items-start gap-2">
                                                <span className="text-cyan-400 font-mono">{j + 1}.</span>
                                                {step}
                                              </li>
                                            ))}
                                          </ol>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {/* Discussion Questions */}
                                  {session.discussionQuestions.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1">
                                        <MessageCircle className="w-3 h-3" />
                                        Discussion Questions
                                      </p>
                                      <ul className="space-y-1">
                                        {(session.discussionQuestions || []).map((q, i) => (
                                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                            <span className="text-amber-400">?</span>
                                            {q}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {/* Common Mistakes */}
                                  {session.commonMistakes.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1">
                                        <HelpCircle className="w-3 h-3" />
                                        Common Mistakes to Address
                                      </p>
                                      <ul className="space-y-1">
                                        {(session.commonMistakes || []).map((m, i) => (
                                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                            <span className="text-red-400">⚠</span>
                                            {m}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Homework */}
                      {week.homework && (
                        <div className="mt-4 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                          <p className="text-xs font-medium text-orange-400 mb-2 flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            Homework Assignment
                          </p>
                          <p className="text-sm">{week.homework.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {week.homework.estimatedTime}
                            </span>
                            {week.homework.link && (
                              <Link href={week.homework.link} className="text-orange-400 hover:underline flex items-center gap-1">
                                {week.homework.featureTitle || "Platform Feature"}
                                <ChevronRight className="w-3 h-3" />
                              </Link>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Assessment Criteria */}
                      <div className="mt-4 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                        <p className="text-xs font-medium text-violet-400 mb-2 flex items-center gap-1">
                          <ClipboardCheck className="w-3 h-3" />
                          Assessment Criteria
                        </p>
                        <ul className="space-y-1">
                          {(week.assessmentCriteria || []).map((c, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-violet-400 mt-1">•</span>
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
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
                          "p-3 rounded-lg border transition-all cursor-pointer",
                          milestone.completed 
                            ? "bg-green-500/5 border-green-500/30" 
                            : "hover:border-primary/50"
                        )}
                        onClick={() => toggleItem(milestone.id, "milestone")}
                      >
                        <div className="flex items-center gap-3">
                          {milestone.completed ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className={cn("font-medium", milestone.completed && "text-muted-foreground")}>
                              {milestone.label}
                            </p>
                            <ul className="mt-1 space-y-0.5">
                              {(milestone.successIndicators || []).map((indicator, i) => (
                                <li key={i} className="text-xs text-muted-foreground">• {indicator}</li>
                              ))}
                            </ul>
                          </div>
                          <Badge variant="outline">Week {milestone.weekNumber}</Badge>
                        </div>
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
                <div className="mt-3 p-2 rounded bg-amber-500/10">
                  <p className="text-xs font-medium text-amber-400 mb-1">Presentation Format</p>
                  <p className="text-sm">{program.capstone.presentationFormat}</p>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Evaluation Criteria:</p>
                  <ul className="space-y-1">
                    {(program.capstone.evaluationCriteria || []).map((c, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-amber-400 mt-1">•</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Tutor Resources */}
              {program.tutorResources && (
                <div className="p-4 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30">
                  <h4 className="font-semibold flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-indigo-400" />
                    Tutor Resources
                  </h4>
                  
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium text-indigo-400 mb-2">Prerequisite Knowledge</p>
                      <ul className="space-y-1">
                        {(program.tutorResources.prerequisiteKnowledge || []).map((k, i) => (
                          <li key={i} className="text-sm text-muted-foreground">• {k}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-indigo-400 mb-2">Suggested Prep</p>
                      <ul className="space-y-1">
                        {(program.tutorResources.suggestedPrep || []).map((p, i) => (
                          <li key={i} className="text-sm text-muted-foreground">• {p}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-indigo-400 mb-2">Common Challenges</p>
                      <ul className="space-y-1">
                        {(program.tutorResources.commonChallenges || []).map((c, i) => (
                          <li key={i} className="text-sm text-muted-foreground">• {c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
