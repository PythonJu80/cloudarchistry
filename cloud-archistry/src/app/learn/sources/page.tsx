"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Plus,
  Play,
  ExternalLink,
  Youtube,
  FileText,
  BookOpen,
  Search,
  Filter,
  Rss,
  Layers,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AWSNewsFeeds } from "@/components/learn/aws-news-feeds";

interface Resource {
  title: string;
  url: string;
  type: string;
  videoId?: string;
  thumbnailUrl?: string;
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

const typeConfig: Record<string, { icon: typeof Youtube; color: string; bg: string; label: string }> = {
  video: { icon: Youtube, color: "text-red-400", bg: "bg-red-500/10", label: "Video" },
  documentation: { icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10", label: "Docs" },
  course: { icon: BookOpen, color: "text-green-400", bg: "bg-green-500/10", label: "Course" },
  whitepaper: { icon: FileText, color: "text-amber-400", bg: "bg-amber-500/10", label: "Whitepaper" },
  article: { icon: FileText, color: "text-purple-400", bg: "bg-purple-500/10", label: "Article" },
};

type SubTab = "my-resources" | "aws-news";

export default function ResourcesPage() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("my-resources");
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<Resource[]>([]);
  const [userResources, setUserResources] = useState<Resource[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Add resource modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  
  // Video player modal
  const [playingVideo, setPlayingVideo] = useState<Resource | null>(null);

  // Fetch resources from study guide
  const fetchResources = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load user-added resources from localStorage first (fast)
      const saved = localStorage.getItem("userResources");
      if (saved) {
        try {
          setUserResources(JSON.parse(saved));
        } catch {
          // Invalid JSON, ignore
        }
      }
      
      // Fetch study guide resources with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const response = await fetch("/api/learn/resources", {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          const guideResources = data.resources || [];
          // Add videoId and thumbnail for YouTube URLs
          const enriched = guideResources.map((r: Resource) => {
            const videoId = extractYouTubeVideoId(r.url);
            return {
              ...r,
              videoId,
              thumbnailUrl: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null,
            };
          });
          setResources(enriched);
        }
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") {
          console.log("Guide fetch timed out");
        } else {
          console.error("Failed to fetch guide:", fetchError);
        }
      }
    } catch (error) {
      console.error("Failed to fetch resources:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const addResource = async () => {
    if (!newUrl.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    setAdding(true);
    
    const videoId = extractYouTubeVideoId(newUrl);
    let title = newTitle.trim();
    
    // Fetch YouTube video title if no custom title provided
    if (!title && videoId) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await fetch(oembedUrl);
        if (response.ok) {
          const data = await response.json();
          title = data.title || "YouTube Video";
        }
      } catch {
        title = "YouTube Video";
      }
    }
    
    const newResource: Resource = {
      title: title || (videoId ? "YouTube Video" : "External Resource"),
      url: newUrl.trim(),
      type: videoId ? "video" : "documentation",
      videoId: videoId || undefined,
      thumbnailUrl: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : undefined,
    };

    const updated = [...userResources, newResource];
    setUserResources(updated);
    localStorage.setItem("userResources", JSON.stringify(updated));
    
    setNewUrl("");
    setNewTitle("");
    setShowAddModal(false);
    setAdding(false);
    toast.success("Resource added!");
  };

  const removeUserResource = (index: number) => {
    const updated = userResources.filter((_, i) => i !== index);
    setUserResources(updated);
    localStorage.setItem("userResources", JSON.stringify(updated));
    toast.success("Resource removed");
  };

  // Combine guide resources and user resources
  const allResources = [...resources, ...userResources];

  const filteredResources = allResources.filter((r) => {
    if (filter === "video" && r.type !== "video") return false;
    if (filter === "documentation" && r.type !== "documentation" && r.type !== "course" && r.type !== "whitepaper") return false;
    if (searchQuery && !r.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading resources...</p>
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
            <h1 className="text-2xl font-bold">Resources</h1>
            <p className="text-muted-foreground">
              Learning materials & AWS news feeds
            </p>
          </div>
          {activeSubTab === "my-resources" && (
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Resource
            </Button>
          )}
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setActiveSubTab("my-resources")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSubTab === "my-resources"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Layers className="w-4 h-4" />
            My Resources
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-background/20 text-xs">
              {allResources.length}
            </span>
          </button>
          <button
            onClick={() => setActiveSubTab("aws-news")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSubTab === "aws-news"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Rss className="w-4 h-4" />
            AWS News & Blogs
          </button>
        </div>

        {/* Filters - only show for My Resources */}
        {activeSubTab === "my-resources" && (
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted/50 border border-border/50 focus:border-primary focus:outline-none text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            {["all", "video", "documentation"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "documentation" ? "Docs" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* Content based on active sub-tab */}
      {activeSubTab === "aws-news" ? (
        <AWSNewsFeeds />
      ) : filteredResources.length === 0 ? (
        <div className="text-center py-20">
          <Youtube className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No resources yet</h3>
          <p className="text-muted-foreground mb-6">
            Generate a study guide to get recommended resources, or add your own YouTube videos
          </p>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add your first resource
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResources.map((resource, idx) => {
            const config = typeConfig[resource.type] || typeConfig.article;
            const Icon = config.icon;
            const isUserAdded = idx >= resources.length;
            
            return (
              <div
                key={`${resource.url}-${idx}`}
                className="rounded-xl border overflow-hidden transition-all hover:border-primary/50 flex flex-col"
              >
                {/* Thumbnail for videos */}
                {resource.thumbnailUrl ? (
                  <div 
                    className="relative aspect-video bg-muted cursor-pointer group"
                    onClick={() => resource.videoId && setPlayingVideo(resource)}
                  >
                    <img
                      src={resource.thumbnailUrl}
                      alt={resource.title}
                      className="w-full h-full object-cover"
                    />
                    {resource.videoId && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                          <Play className="w-8 h-8 text-white ml-1" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Placeholder header for docs/courses */
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`aspect-video ${config.bg} flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity`}
                  >
                    <Icon className={`w-16 h-16 ${config.color}`} />
                  </a>
                )}

                {/* Content */}
                <div className="p-4 flex-1">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium line-clamp-2">{resource.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {config.label}
                        </Badge>
                        {isUserAdded && (
                          <span className="text-xs text-muted-foreground">Added by you</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end mt-4 pt-3 border-t border-border/50 gap-1">
                    {resource.videoId && (
                      <button
                        onClick={() => setPlayingVideo(resource)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                        title="Play video"
                      >
                        <Play className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>
                    <button
                      onClick={async () => {
                        if (isUserAdded) {
                          removeUserResource(idx - resources.length);
                        } else {
                          // Remove from guide resources - persist to database
                          try {
                            const response = await fetch("/api/learn/resources", {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ url: resource.url }),
                            });
                            
                            if (response.ok) {
                              const updated = resources.filter((_, i) => i !== idx);
                              setResources(updated);
                              toast.success("Resource removed");
                            } else {
                              toast.error("Failed to remove resource");
                            }
                          } catch (error) {
                            console.error("Failed to delete resource:", error);
                            toast.error("Failed to remove resource");
                          }
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Resource Modal - only for My Resources */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Resource</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                placeholder="https://example.com/article or https://youtube.com/watch?v=..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-muted/50 border border-border/50 focus:border-primary focus:outline-none text-sm"
                onKeyDown={(e) => e.key === "Enter" && addResource()}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Add any URL - YouTube videos, documentation, articles, or any website
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Title <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="Custom title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-muted/50 border border-border/50 focus:border-primary focus:outline-none text-sm"
                onKeyDown={(e) => e.key === "Enter" && addResource()}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button onClick={addResource} disabled={adding}>
                {adding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Player Modal */}
      <Dialog open={!!playingVideo} onOpenChange={() => setPlayingVideo(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden [&>button]:hidden">
          {playingVideo?.videoId && (
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${playingVideo.videoId}?autoplay=1`}
                title={playingVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          )}
          <div className="p-4 border-t">
            <h3 className="font-semibold">{playingVideo?.title}</h3>
            <a
              href={playingVideo?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block"
            >
              <Button size="sm" variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open on YouTube
              </Button>
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
