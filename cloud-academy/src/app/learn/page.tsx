"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Layers,
  FileText,
  Lightbulb,
  BookOpen,
  HelpCircle,
  Calendar,
  ListTodo,
  MessageSquare,
} from "lucide-react";

interface SourceSummary {
  totalSources: number;
  exams: number;
  challenges: number;
  flashcards: number;
  notes: number;
}

interface SuggestedQuestion {
  id: string;
  question: string;
}

// Help me create actions
const createActions = [
  { id: "study-guide", label: "Study guide", icon: BookOpen },
  { id: "briefing-doc", label: "Briefing doc", icon: FileText },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "timeline", label: "Timeline", icon: Calendar },
  { id: "quiz", label: "Quiz", icon: ListTodo },
];

export default function LearnPage() {
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<SourceSummary>({
    totalSources: 0,
    exams: 0,
    challenges: 0,
    flashcards: 0,
    notes: 0,
  });
  const [summary, setSummary] = useState<string>("");
  const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestion[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch dashboard data to build source summary
      const dashRes = await fetch("/api/dashboard");
      if (dashRes.ok) {
        const data = await dashRes.json();
        const examsCount = data.stats?.totalChallenges || 0;
        const challengesCount = data.stats?.completedChallenges || 0;
        const flashcardsCount = data.flashcardProgress?.length || 0;
        
        setSources({
          totalSources: examsCount + challengesCount + flashcardsCount,
          exams: examsCount,
          challenges: challengesCount,
          flashcards: flashcardsCount,
          notes: 0,
        });

        // Generate summary based on data
        setSummary(
          `Based on your ${sources.totalSources} learning sources, you're preparing for AWS certifications with focus on hands-on challenges and practice exams. Your learning activity shows engagement across multiple domains including compute, networking, and security.`
        );
      }

      // Set suggested questions
      setSuggestedQuestions([
        { id: "1", question: "What are the key differences between VPC peering and Transit Gateway?" },
        { id: "2", question: "How should I prepare for the SAA-C03 exam based on my progress?" },
        { id: "3", question: "What IAM best practices should I focus on?" },
      ]);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading notebook...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Help me create */}
      <section className="mb-10">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Help me create</h2>
          <div className="flex flex-wrap gap-3">
            {createActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/50 hover:bg-muted border border-border/50 hover:border-primary/50 transition-all text-sm"
                >
                  <Icon className="w-4 h-4 text-primary" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Summary */}
        <section className="mb-10">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Summary</h2>
          <div className="p-6 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground leading-relaxed">
                  {summary || "Add sources to your notebook to generate a summary of your learning materials."}
                </p>
                {sources.totalSources > 0 && (
                  <Link 
                    href="/learn/sources" 
                    className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline"
                  >
                    <Layers className="w-4 h-4" />
                    {sources.totalSources} sources
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Help me understand */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Help me understand</h2>
          <div className="space-y-3">
            {suggestedQuestions.map((q) => (
              <Link
                key={q.id}
                href={`/learn/chat?q=${encodeURIComponent(q.question)}`}
                className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 border border-border/50 hover:border-primary/50 transition-all group"
              >
                <MessageSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm group-hover:text-primary transition-colors">
                  {q.question}
                </span>
              </Link>
            ))}
          </div>
        </section>
    </div>
  );
}
