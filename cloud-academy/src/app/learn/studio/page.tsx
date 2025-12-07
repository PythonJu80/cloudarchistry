"use client";

import { useState } from "react";
import {
  Headphones,
  FileText,
  ListTodo,
  HelpCircle,
  Calendar,
  BookOpen,
  Sparkles,
  Loader2,
  Play,
  Download,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface GeneratedContent {
  id: string;
  type: "audio" | "study_guide" | "faq" | "timeline" | "quiz";
  title: string;
  status: "ready" | "generating" | "failed";
  createdAt: Date;
}

const contentTypes = [
  {
    id: "audio",
    label: "Audio Overview",
    description: "Generate a podcast-style deep dive conversation",
    icon: Headphones,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    id: "study_guide",
    label: "Study Guide",
    description: "Comprehensive study guide from your sources",
    icon: BookOpen,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    id: "faq",
    label: "FAQ",
    description: "Frequently asked questions and answers",
    icon: HelpCircle,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    id: "timeline",
    label: "Timeline",
    description: "Chronological overview of key concepts",
    icon: Calendar,
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  {
    id: "quiz",
    label: "Practice Quiz",
    description: "Generate quiz questions from your sources",
    icon: ListTodo,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
];

export default function StudioPage() {
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);

  const handleGenerate = async (typeId: string) => {
    setGenerating(typeId);
    
    // Simulate generation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    const newContent: GeneratedContent = {
      id: crypto.randomUUID(),
      type: typeId as GeneratedContent["type"],
      title: `${contentTypes.find((t) => t.id === typeId)?.label} - AWS Certification Prep`,
      status: "ready",
      createdAt: new Date(),
    };
    
    setGeneratedContent((prev) => [newContent, ...prev]);
    setGenerating(null);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Studio</h1>
        <p className="text-muted-foreground">
          Generate study materials from your learning sources
        </p>
      </div>

      <div>
        <div className="max-w-4xl">
          {/* Audio Overview - Featured */}
          <section className="mb-10">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Audio Overview</h2>
            <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Headphones className="w-7 h-7 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-1">Deep Dive Conversation</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Generate a podcast-style audio overview with two hosts discussing your learning materials.
                  </p>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => handleGenerate("audio")}
                      disabled={generating === "audio"}
                    >
                      {generating === "audio" ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate
                        </>
                      )}
                    </Button>
                    <Button variant="outline" disabled>
                      Customize
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Other Content Types */}
          <section className="mb-10">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Generate Content</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {contentTypes.filter((t) => t.id !== "audio").map((type) => {
                const Icon = type.icon;
                const isGenerating = generating === type.id;
                return (
                  <div
                    key={type.id}
                    className="p-5 rounded-xl border border-border/50 hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg ${type.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${type.color}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{type.label}</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {type.description}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleGenerate(type.id)}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Generate
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Generated Content */}
          {generatedContent.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-4">Generated Content</h2>
              <div className="space-y-3">
                {generatedContent.map((content) => {
                  const typeConfig = contentTypes.find((t) => t.id === content.type);
                  const Icon = typeConfig?.icon || FileText;
                  return (
                    <div
                      key={content.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:border-primary/50 transition-all"
                    >
                      <div className={`w-10 h-10 rounded-lg ${typeConfig?.bg || "bg-muted"} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${typeConfig?.color || "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{content.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {content.createdAt.toLocaleDateString()}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          content.status === "ready"
                            ? "bg-green-500/10 text-green-400"
                            : content.status === "generating"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-red-500/10 text-red-400"
                        }
                      >
                        {content.status}
                      </Badge>
                      <div className="flex items-center gap-1">
                        {content.type === "audio" && content.status === "ready" && (
                          <Button size="icon" variant="ghost">
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost">
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost">
                          <Share2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
