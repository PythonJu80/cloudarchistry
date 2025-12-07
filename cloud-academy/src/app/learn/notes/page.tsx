"use client";

import { useState } from "react";
import {
  Plus,
  FileText,
  Search,
  MoreVertical,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Note {
  id: string;
  title: string;
  content: string;
  type: "saved_response" | "manual" | "generated";
  createdAt: Date;
  tags: string[];
}

// Placeholder notes
const placeholderNotes: Note[] = [];

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>(placeholderNotes);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addNote = () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: "New Note",
      content: "",
      type: "manual",
      createdAt: new Date(),
      tags: [],
    };
    setNotes((prev) => [newNote, ...prev]);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Notes</h1>
            <p className="text-muted-foreground">
              Saved responses and your personal notes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate notes
            </Button>
            <Button onClick={addNote}>
              <Plus className="w-4 h-4 mr-2" />
              Add note
            </Button>
          </div>
        </div>

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
          <div className="h-full flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
              <FileText className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No notes yet</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Save AI responses from chat, generate study notes, or create your own notes to build your knowledge base.
            </p>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={addNote}>
                <Plus className="w-4 h-4 mr-2" />
                Create note
              </Button>
              <Button>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate study notes
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className="group p-5 rounded-xl border border-border/50 hover:border-primary/50 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <Badge
                    variant="secondary"
                    className={
                      note.type === "saved_response"
                        ? "bg-blue-500/10 text-blue-400"
                        : note.type === "generated"
                        ? "bg-purple-500/10 text-purple-400"
                        : "bg-muted"
                    }
                  >
                    {note.type === "saved_response"
                      ? "Saved Response"
                      : note.type === "generated"
                      ? "AI Generated"
                      : "Note"}
                  </Badge>
                  <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all">
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <h3 className="font-semibold mb-2">{note.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {note.content || "Empty note..."}
                </p>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">
                    {note.createdAt.toLocaleDateString()}
                  </span>
                  {note.tags.length > 0 && (
                    <div className="flex gap-1">
                      {note.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded bg-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
