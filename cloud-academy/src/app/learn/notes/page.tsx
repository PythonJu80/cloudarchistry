"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  Sparkles,
  Loader2,
  AlertCircle,
  Trash2,
  Clock,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Scenario {
  id: string;
  title: string;
  locationName: string;
}

interface Note {
  id: string;
  title: string;
  summary: string;
  content: string;
  estimatedReadTimeMinutes: number;
  keyTakeaways: string[];
  awsServices: string[];
  scenarioId: string | null;
  createdAt: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Generate dialog
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Active note view
  const [activeNote, setActiveNote] = useState<Note | null>(null);

  // Fetch notes from API
  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/learn/notes");
      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes || []);
      }
    } catch (err) {
      console.error("Error fetching notes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Fetch scenarios for generation
  const fetchScenarios = async () => {
    try {
      setLoadingScenarios(true);
      const res = await fetch("/api/scenarios?limit=50");
      if (!res.ok) throw new Error("Failed to fetch scenarios");
      const data = await res.json();
      setScenarios(
        (data.scenarios || []).map((s: { id: string; title: string; location?: { name: string } }) => ({
          id: s.id,
          title: s.title,
          locationName: s.location?.name || "Unknown",
        }))
      );
    } catch (err) {
      console.error("Error fetching scenarios:", err);
    } finally {
      setLoadingScenarios(false);
    }
  };

  const handleOpenGenerateDialog = () => {
    setShowGenerateDialog(true);
    fetchScenarios();
  };

  // Generate new notes
  const handleGenerateNotes = async () => {
    if (!selectedScenarioId) return;

    try {
      setGenerating(true);
      setError(null);
      const response = await fetch("/api/learn/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: selectedScenarioId,
        }),
      });

      if (response.status === 402) {
        setError("Please configure your OpenAI API key in Settings to generate notes.");
        setShowGenerateDialog(false);
        return;
      }

      if (response.ok) {
        setShowGenerateDialog(false);
        setSelectedScenarioId(null);
        await fetchNotes();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to generate notes");
      }
    } catch (err) {
      console.error("Error generating notes:", err);
      setError("Failed to generate notes");
    } finally {
      setGenerating(false);
    }
  };

  // Delete note
  const deleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete these notes?")) return;

    try {
      const response = await fetch(`/api/learn/notes/${noteId}`, { method: "DELETE" });
      if (response.ok) {
        await fetchNotes();
        if (activeNote?.id === noteId) {
          setActiveNote(null);
        }
      }
    } catch (err) {
      console.error("Error deleting note:", err);
    }
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Loading state
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Active note view
  if (activeNote) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => setActiveNote(null)}>
            ← Back to notes
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => deleteNote(activeNote.id, e)}
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
        
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">{activeNote.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {activeNote.estimatedReadTimeMinutes} min read
            </div>
            <div className="flex items-center gap-1">
              <BookOpen className="w-4 h-4" />
              {activeNote.awsServices.length} services
            </div>
          </div>
          
          {activeNote.keyTakeaways.length > 0 && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 mb-6">
              <h3 className="font-semibold mb-2">Key Takeaways</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {activeNote.keyTakeaways.map((takeaway, i) => (
                  <li key={i}>{takeaway}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="prose prose-invert max-w-none">
            <div dangerouslySetInnerHTML={{ __html: activeNote.content.replace(/\n/g, '<br />') }} />
          </div>
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
            <h1 className="text-2xl font-bold">Study Notes</h1>
            <p className="text-muted-foreground">
              AI-generated study notes from your scenarios
            </p>
          </div>
          <Button onClick={handleOpenGenerateDialog}>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Notes
          </Button>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-4 rounded-lg border border-red-500/50 bg-red-500/10 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-500">{error}</p>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
              Dismiss
            </Button>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted/50 border border-border/50 focus:border-primary focus:outline-none text-sm"
          />
        </div>
      </div>

      {/* Notes Grid */}
      <div>
        {filteredNotes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
              <FileText className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No notes yet</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Generate study notes from your scenarios to build your knowledge base.
            </p>
            <Button onClick={handleOpenGenerateDialog}>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Study Notes
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => setActiveNote(note)}
                className="group p-5 rounded-xl border border-border/50 hover:border-primary/50 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <Badge variant="secondary" className="bg-purple-500/10 text-purple-400">
                    AI Generated
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 h-8 w-8"
                    onClick={(e) => deleteNote(note.id, e)}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
                <h3 className="font-semibold mb-2">{note.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {note.summary || "Study notes..."}
                </p>
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {note.estimatedReadTimeMinutes} min
                  </div>
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {note.awsServices.length} services
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate Notes Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Study Notes</DialogTitle>
            <DialogDescription>
              Select a scenario to generate study notes from its content.
            </DialogDescription>
          </DialogHeader>

          {loadingScenarios ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : scenarios.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No scenarios found. Complete some scenarios first!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              <Label>Select Scenario</Label>
              {scenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  onClick={() => setSelectedScenarioId(scenario.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedScenarioId === scenario.id
                      ? "border-primary bg-primary/10"
                      : "border-border/50 hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium">{scenario.title}</p>
                  <p className="text-sm text-muted-foreground">{scenario.locationName}</p>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateNotes}
              disabled={!selectedScenarioId || generating}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Notes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
