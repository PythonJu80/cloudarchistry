"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  CheckSquare,
  Square,
  GraduationCap,
  Target,
  Layers,
  FileText,
  Gamepad2,
  Filter,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Source {
  id: string;
  type: "exam" | "challenge" | "flashcard" | "note" | "game";
  title: string;
  description?: string;
  selected: boolean;
  metadata?: {
    score?: number;
    completed?: boolean;
    count?: number;
    lastActivity?: string;
  };
}

const sourceTypeConfig = {
  exam: { icon: GraduationCap, color: "text-amber-400", bg: "bg-amber-500/10" },
  challenge: { icon: Target, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  flashcard: { icon: Layers, color: "text-green-400", bg: "bg-green-500/10" },
  note: { icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10" },
  game: { icon: Gamepad2, color: "text-purple-400", bg: "bg-purple-500/10" },
};

export default function SourcesPage() {
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<Source[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      // Fetch exams
      const examsRes = await fetch("/api/exams");
      const examsData = examsRes.ok ? await examsRes.json() : { exams: [] };

      // Fetch dashboard data
      const dashRes = await fetch("/api/dashboard");
      const dashData = dashRes.ok ? await dashRes.json() : {};

      const allSources: Source[] = [];

      // Add exams as sources
      for (const exam of examsData.exams || []) {
        allSources.push({
          id: `exam-${exam.id}`,
          type: "exam",
          title: exam.title,
          description: `${exam.certificationCode} - ${exam.questionCount} questions`,
          selected: true,
          metadata: {
            score: exam.userStats?.bestScore,
            completed: exam.userStats?.passed,
          },
        });
      }

      // Add challenges as sources
      for (const challenge of dashData.challengeDetails || []) {
        allSources.push({
          id: `challenge-${challenge.id}`,
          type: "challenge",
          title: challenge.challengeTitle,
          description: challenge.scenarioTitle,
          selected: true,
          metadata: {
            completed: challenge.status === "completed",
            score: challenge.pointsEarned,
          },
        });
      }

      // Add flashcard decks as sources
      for (const deck of dashData.flashcardProgress || []) {
        allSources.push({
          id: `flashcard-${deck.id}`,
          type: "flashcard",
          title: deck.deckTitle,
          description: `${deck.cardsMastered}/${deck.totalCards} mastered`,
          selected: true,
          metadata: {
            count: deck.totalCards,
          },
        });
      }

      setSources(allSources);
    } catch (error) {
      console.error("Failed to fetch sources:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSource = (id: string) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  };

  const toggleAll = () => {
    const allSelected = sources.every((s) => s.selected);
    setSources((prev) => prev.map((s) => ({ ...s, selected: !allSelected })));
  };

  const filteredSources = sources.filter((s) => {
    if (filter !== "all" && s.type !== filter) return false;
    if (searchQuery && !s.title.toLowerCase().includes(searchQuery.toLowerCase()))
      return false;
    return true;
  });

  const selectedCount = sources.filter((s) => s.selected).length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading sources...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Sources</h1>
            <p className="text-muted-foreground">
              {selectedCount} of {sources.length} sources selected
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add source
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted/50 border border-border/50 focus:border-primary focus:outline-none text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            {["all", "exam", "challenge", "flashcard", "note"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Select All */}
      <div className="py-3 mb-4">
        <button
          onClick={toggleAll}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {sources.every((s) => s.selected) ? (
            <CheckSquare className="w-4 h-4 text-primary" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          Select all sources
        </button>
      </div>

      {/* Sources List */}
      <div>
        {filteredSources.length === 0 ? (
          <div className="text-center py-20">
            <Layers className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No sources found</h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery
                ? "Try a different search term"
                : "Add sources to start building your learning notebook"}
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add your first source
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSources.map((source) => {
              const config = sourceTypeConfig[source.type];
              const Icon = config.icon;
              return (
                <div
                  key={source.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                    source.selected
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/50 hover:border-border"
                  }`}
                  onClick={() => toggleSource(source.id)}
                >
                  {source.selected ? (
                    <CheckSquare className="w-5 h-5 text-primary flex-shrink-0" />
                  ) : (
                    <Square className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{source.title}</h3>
                    {source.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {source.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {source.metadata?.completed && (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-400">
                        Completed
                      </Badge>
                    )}
                    {source.metadata?.score !== undefined && (
                      <Badge variant="secondary">
                        {source.metadata.score}%
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
