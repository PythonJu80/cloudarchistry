"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Download, Copy, Eye, Share2, Trash2, FileCode, Calendar, User, Maximize2 } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with React Flow
const DiagramViewer = dynamic(
  () => import("@/components/archub/diagram-viewer").then(mod => mod.DiagramViewer),
  { ssr: false, loading: () => <div className="aspect-video bg-slate-800/50 flex items-center justify-center"><FileCode className="w-24 h-24 text-slate-600 animate-pulse" /></div> }
);

interface Diagram {
  id: string;
  title: string;
  description: string;
  format: string;
  status: string;
  user_id: string;
  username: string;
  file_url: string;
  thumbnail_url: string | null;
  tags: string[];
  services: string[];
  categories: Record<string, string[]>;
  created_at: string;
  updated_at: string;
  views: number;
  remixes: number;
  exports: number;
}

export default function BlueprintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [diagramContent, setDiagramContent] = useState<string | null>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchDiagram();
    }
  }, [params.id]);

  const fetchDiagram = async () => {
    try {
      const res = await fetch(`/api/archub/diagrams/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setDiagram(data);
        
        // Fetch diagram content for rendering
        if (data.file_url && data.format === "drawio_xml") {
          try {
            const contentRes = await fetch(data.file_url);
            if (contentRes.ok) {
              const content = await contentRes.text();
              setDiagramContent(content);
            }
          } catch (err) {
            console.error("Error fetching diagram content:", err);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching diagram:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!diagram) return;
    // Track the export
    try {
      await fetch(`/api/archub/diagrams/${diagram.id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: diagram.format }),
      });
    } catch (err) {
      console.error("Error tracking export:", err);
    }
    window.open(diagram.file_url, "_blank");
  };

  const handleRemix = async () => {
    if (!session || !diagram) return;
    try {
      await fetch(`/api/archub/diagrams/${diagram.id}/remix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: session.user.id }),
      });
      fetchDiagram();
    } catch (error) {
      console.error("Error remixing diagram:", error);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this blueprint?")) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/archub/diagrams/${params.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/archub");
      }
    } catch (error) {
      console.error("Error deleting diagram:", error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading blueprint...</div>
      </div>
    );
  }

  if (!diagram) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-4">Blueprint not found</p>
          <Link href="/archub" className="text-blue-400 hover:text-blue-300">
            Back to ArcHub
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = session?.user?.id === diagram.user_id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-6 py-8">
        <Link href="/archub" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
          ← Back to ArcHub
        </Link>

        <div className="grid grid-cols-12 gap-6">
          {/* Main Content */}
          <div className="col-span-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
              {/* Diagram Preview */}
              <div className="relative">
                {diagramContent && diagram.format === "drawio_xml" ? (
                  <>
                    <DiagramViewer
                      diagramContent={diagramContent}
                      format="drawio_xml"
                      className="aspect-video"
                      showControls={true}
                      showMiniMap={false}
                    />
                    <button
                      onClick={() => setShowFullscreen(true)}
                      className="absolute top-4 right-4 p-2 bg-slate-800/80 hover:bg-slate-700 rounded-lg text-white transition-colors"
                      title="Fullscreen"
                    >
                      <Maximize2 className="w-5 h-5" />
                    </button>
                  </>
                ) : diagram.thumbnail_url ? (
                  <div className="aspect-video bg-slate-800/50 flex items-center justify-center">
                    <img
                      src={diagram.thumbnail_url}
                      alt={diagram.title}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-slate-800/50 flex items-center justify-center">
                    <FileCode className="w-24 h-24 text-slate-600" />
                  </div>
                )}
              </div>

              {/* Fullscreen Modal */}
              {showFullscreen && diagramContent && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
                  <div className="w-full h-full max-w-7xl max-h-[90vh] relative">
                    <button
                      onClick={() => setShowFullscreen(false)}
                      className="absolute top-4 right-4 z-10 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors"
                    >
                      ✕
                    </button>
                    <DiagramViewer
                      diagramContent={diagramContent}
                      format="drawio_xml"
                      className="w-full h-full"
                      showControls={true}
                      showMiniMap={true}
                    />
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="p-6">
                <h1 className="text-3xl font-bold text-white mb-4">{diagram.title}</h1>

                {/* Metadata */}
                <div className="flex items-center gap-6 text-sm text-slate-400 mb-6">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>by {diagram.username}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(diagram.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    <span>{diagram.views} views</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Copy className="w-4 h-4" />
                    <span>{diagram.remixes} remixes</span>
                  </div>
                </div>

                {/* Description */}
                {diagram.description && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-white mb-2">Description</h2>
                    <p className="text-slate-300 whitespace-pre-wrap">{diagram.description}</p>
                  </div>
                )}

                {/* Services by Category */}
                {diagram.categories && Object.keys(diagram.categories).length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-white mb-3">AWS Services</h2>
                    <div className="space-y-3">
                      {Object.entries(diagram.categories).map(([category, services]) => (
                        <div key={category} className="bg-white/5 rounded-lg p-4">
                          <h3 className="text-sm font-medium text-blue-400 mb-2 capitalize">
                            {category.replace(/_/g, " ")}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {(services as string[]).map((service, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-full"
                              >
                                {service}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {diagram.tags && diagram.tags.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-3">Tags</h2>
                    <div className="flex flex-wrap gap-2">
                      {diagram.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-slate-700 text-slate-300 text-sm rounded-full"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-span-4">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-white mb-4">Actions</h2>

              <div className="space-y-3">
                <button
                  onClick={handleExport}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export to Draw.io
                </button>

                {session && !isOwner && (
                  <button
                    onClick={handleRemix}
                    className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Remix Blueprint
                  </button>
                )}

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                  }}
                  className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>

                {isOwner && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="w-full px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                )}
              </div>

              {/* Stats */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <h3 className="text-sm font-medium text-slate-400 mb-3">Statistics</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Views</span>
                    <span className="text-white font-medium">{diagram.views}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Remixes</span>
                    <span className="text-white font-medium">{diagram.remixes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Exports</span>
                    <span className="text-white font-medium">{diagram.exports}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Format</span>
                    <span className="text-white font-medium uppercase">
                      {diagram.format.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
