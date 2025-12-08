"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, Target, CalendarDays, Save, Clock } from "lucide-react";

type PlanRecord = {
  id: string;
  targetExam: string | null;
  examDate: string | null;
  studyHoursPerWeek: number | null;
  confidenceLevel: string | null;
  planInputs: Record<string, any>;
  planOutput: Record<string, any> | null;
  generatedAt: string;
};

type PlanHints = {
  skillLevel: string | null;
  targetCertification: string | null;
  challengeHighlights: { title: string | null; difficulty: string | null; completedAt: string | null }[];
  examInsights: { certification?: string | null; score?: number | null; passed?: boolean | null }[];
  flashcardHighlights: { deck?: string | null; cardsMastered: number; totalReviews: number }[];
  recommendedWeakAreas: string[];
  recommendedFocusDomains: string[];
  recommendedFormats: string[];
};

type StudyPlanResponse = {
  latestPlan: PlanRecord | null;
  history: PlanRecord[];
  hints: PlanHints;
};

const confidenceOptions = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
];

const formatDate = (date: string | null) => (date ? format(new Date(date), "PPP") : "Not set");

export default function GuidePage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [plan, setPlan] = useState<PlanRecord | null>(null);
  const [history, setHistory] = useState<PlanRecord[]>([]);
  const [hints, setHints] = useState<PlanHints | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    targetExam: "",
    examDate: "",
    studyHoursPerWeek: 6,
    confidenceLevel: "intermediate",
    weakAreas: [] as string[],
    focusDomains: [] as string[],
    preferredFormats: [] as string[],
    learnerNotes: "",
  });

  const loadPlan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/learn/study-plan");
      if (!response.ok) {
        throw new Error("Failed to load plan data");
      }
      const data: StudyPlanResponse = await response.json();
      setPlan(data.latestPlan);
      setHistory(data.history || []);
      setHints(data.hints || null);
      setForm((prev) => ({
        ...prev,
        targetExam: data.latestPlan?.targetExam || data.hints?.targetCertification || "",
        confidenceLevel: data.latestPlan?.confidenceLevel || data.hints?.skillLevel || prev.confidenceLevel,
      }));
    } catch (err) {
      console.error(err);
      setError("Unable to load your study plan. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const toggleMultiSelect = (key: "weakAreas" | "focusDomains" | "preferredFormats", value: string) => {
    setForm((prev) => {
      const exists = prev[key].includes(value);
      return {
        ...prev,
        [key]: exists ? prev[key].filter((item) => item !== value) : [...prev[key], value],
      };
    });
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const response = await fetch("/api/learn/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to generate plan");
      }

      const data = await response.json();
      setPlan(data.plan);
      toast.success("Study plan updated");
      loadPlan();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Plan generation failed");
      toast.error("Plan generation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const planOutput = plan?.planOutput || {};
  const weeklyPlan = Array.isArray(planOutput.weekly_plan) ? planOutput.weekly_plan : [];
  const milestones = Array.isArray(planOutput.milestones) ? planOutput.milestones : [];
  const actionItems = Array.isArray(planOutput.action_items) ? planOutput.action_items : [];
  const accountability = Array.isArray(planOutput.accountability) ? planOutput.accountability : [];

  const timelineDescription = useMemo(() => {
    if (!plan?.planInputs?.timeHorizon) return null;
    return plan.planInputs.timeHorizon as string;
  }, [plan?.planInputs]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col lg:flex-row gap-6 items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Submit your current goals and confidence to generate a SMART plan grounded in your actual activity.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {plan?.generatedAt && (
              <Badge variant="outline">
                <Clock className="h-3.5 w-3.5 mr-1" />
                Updated {format(new Date(plan.generatedAt), "PPpp")}
              </Badge>
            )}
            {timelineDescription && <Badge variant="secondary">{timelineDescription}</Badge>}
            {plan?.studyHoursPerWeek && (
              <Badge variant="secondary">{plan.studyHoursPerWeek} hrs / week target</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadPlan} disabled={loading || submitting}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[360px,1fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Plan inputs</CardTitle>
            <CardDescription>Prefill from your telemetry, then adjust for your current exam push.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Target certification</Label>
              <Input
                value={form.targetExam}
                placeholder={hints?.targetCertification || "e.g. SAA-C03"}
                onChange={(e) => setForm((prev) => ({ ...prev, targetExam: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Exam date (optional)</Label>
                <Input
                  type="date"
                  value={form.examDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, examDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Hours per week</Label>
                <Input
                  type="number"
                  min={2}
                  max={40}
                  value={form.studyHoursPerWeek}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, studyHoursPerWeek: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confidence level</Label>
              <div className="grid grid-cols-2 gap-2">
                {confidenceOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm text-left",
                      form.confidenceLevel === option.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/50",
                    )}
                    onClick={() => setForm((prev) => ({ ...prev, confidenceLevel: option.value }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <MultiSelectSection
              label="Weak areas"
              options={hints?.recommendedWeakAreas || []}
              values={form.weakAreas}
              onToggle={(value) => toggleMultiSelect("weakAreas", value)}
            />

            <MultiSelectSection
              label="Focus domains"
              options={hints?.recommendedFocusDomains || []}
              values={form.focusDomains}
              onToggle={(value) => toggleMultiSelect("focusDomains", value)}
            />

            <MultiSelectSection
              label="Preferred formats"
              options={hints?.recommendedFormats || []}
              values={form.preferredFormats}
              onToggle={(value) => toggleMultiSelect("preferredFormats", value)}
            />

            <div className="space-y-2">
              <Label>Notes for your coach</Label>
              <Textarea
                placeholder="Let the coach know about upcoming deadlines, blockers, or learning preferences."
                value={form.learnerNotes}
                onChange={(e) => setForm((prev) => ({ ...prev, learnerNotes: e.target.value }))}
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate plan
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Plan summary</CardTitle>
                <CardDescription>
                  {planOutput.summary || "Generate a plan to see a personalized summary."}
                </CardDescription>
              </div>
              {plan?.targetExam && (
                <Badge variant="outline">
                  <Target className="h-3.5 w-3.5 mr-1" />
                  {plan.targetExam}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  {timelineDescription || "Timeline will align to your exam window."}
                </div>
                <div className="space-y-3">
                  {weeklyPlan.length > 0 ? (
                    weeklyPlan.map((week: any) => (
                      <div key={week.week_number} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between text-sm font-medium">
                          <span>Week {week.week_number}</span>
                          <span className="text-muted-foreground">{week.date_range}</span>
                        </div>
                        <p className="text-sm mt-1 font-semibold">{week.theme}</p>
                        <p className="text-sm text-muted-foreground">{week.key_focus}</p>
                        <div className="text-xs text-muted-foreground mt-2">
                          Deliverables: {Array.isArray(week.deliverables) ? week.deliverables.join(", ") : week.deliverables}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState message="Once generated, you'll see each week's focus here." />
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Milestones</h3>
                </div>
                {milestones.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-3">
                    {milestones.map((milestone: any, index: number) => (
                      <div key={`${milestone.label}-${index}`} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between text-sm font-semibold">
                          <span>{milestone.label}</span>
                          <span className="text-muted-foreground">{milestone.due_by}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Metric: {milestone.success_metric}
                        </p>
                        <p className="text-xs mt-2">{milestone.rationale}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="Milestones will appear once your plan is generated." />
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Next actions</h3>
                  <Badge variant="outline">{actionItems.length} tasks</Badge>
                </div>
                {actionItems.length > 0 ? (
                  <div className="space-y-2">
                    {actionItems.map((item: any, index: number) => (
                      <div
                        key={`${item.description}-${index}`}
                        className="rounded-lg border p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                      >
                        <div>
                          <p className="font-medium">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Target: {item.metric} → {item.target_value}
                          </p>
                          {item.source_reference && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Source: {item.source_reference}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="capitalize">
                            {item.category}
                          </Badge>
                          <span>Due {item.deadline}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="Action items will show concrete tasks once a plan is generated." />
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Accountability</h3>
                </div>
                {accountability.length > 0 ? (
                  <ul className="space-y-2">
                    {accountability.map((item: any, index: number) => (
                      <li key={`${item.reminder}-${index}`} className="rounded-lg border p-3 text-sm">
                        {item.reminder}
                        <span className="block text-xs text-muted-foreground mt-1">{item.trigger}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState message="Your reminders will appear here once generated." />
                )}
              </section>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>History</CardTitle>
                <CardDescription>Recent plans allow you to revert or compare.</CardDescription>
              </div>
              <Badge variant="outline">{history.length} saved</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length > 0 ? (
                history.map((record) => (
                  <div key={record.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{record.targetExam || "Custom plan"}</span>
                      <span className="text-muted-foreground">
                        {format(new Date(record.generatedAt), "PPpp")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {record.planInputs?.timeHorizon || "Window not specified"}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 text-xs"
                      onClick={() => {
                        setPlan(record);
                        toast.success("Previewing historical plan");
                      }}
                    >
                      View plan
                    </Button>
                  </div>
                ))
              ) : (
                <EmptyState message="Previous plans will appear here." />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MultiSelectSection({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: string[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  if (!options?.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = values.includes(option);
          return (
            <button
              key={option}
              type="button"
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border",
                active ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary",
              )}
              onClick={() => onToggle(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}
