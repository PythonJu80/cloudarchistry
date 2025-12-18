"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Folder, FileCode, TrendingUp, Upload, Search, Filter } from "lucide-react";
import Link from "next/link";

interface DiagramStats {
  total_diagrams: number;
  completed_diagrams: number;
  total_users: number;
  categories: Record<string, number>;
  services: Record<string, number>;
}

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
  views: number;
  remixes: number;
  exports: number;
}

const AWS_CATEGORIES = [
  { id: "compute", name: "Compute", icon: "💻" },
  { id: "storage", name: "Storage", icon: "💾" },
  { id: "database", name: "Database", icon: "🗄️" },
  { id: "networking", name: "Networking", icon: "🌐" },
  { id: "security", name: "Security", icon: "🔒" },
  { id: "analytics", name: "Analytics", icon: "📊" },
  { id: "ml_ai", name: "ML & AI", icon: "🤖" },
  { id: "containers", name: "Containers", icon: "📦" },
  { id: "serverless", name: "Serverless", icon: "⚡" },
  { id: "integration", name: "Integration", icon: "🔗" },
  { id: "management", name: "Management", icon: "⚙️" },
];

export default function ArcHubPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DiagramStats | null>(null);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchDiagrams();
  }, []);

  useEffect(() => {
    if (selectedCategory || searchQuery) {
      fetchDiagrams();
    }
  }, [selectedCategory, searchQuery]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/archub/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchDiagrams = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("query", searchQuery);
      if (selectedCategory) params.append("category", selectedCategory);
      params.append("limit", "20");

      const res = await fetch(`/api/archub/diagrams?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDiagrams(data.diagrams);
      }
    } catch (error) {
      console.error("Error fetching diagrams:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block">
            ← Back to Cloud Archistry
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  ArcHub
                </span>
              </h1>
              <p className="text-slate-300">AWS Architecture Diagram Community</p>
            </div>
            <div className="flex gap-3">
              {session && (
                <>
                  <Link
                    href="/archub/profile"
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  >
                    My Profile
                  </Link>
                  <Link
                    href="/archub/upload"
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Blueprint
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          {stats && (
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                <div className="text-2xl font-bold text-white">{stats.completed_diagrams}</div>
                <div className="text-sm text-slate-400">Blueprints</div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                <div className="text-2xl font-bold text-white">{stats.total_users}</div>
                <div className="text-sm text-slate-400">Contributors</div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                <div className="text-2xl font-bold text-white">
                  {Object.keys(stats.services || {}).length}
                </div>
                <div className="text-sm text-slate-400">AWS Services</div>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                <div className="text-2xl font-bold text-white">
                  {Object.keys(stats.categories || {}).length}
                </div>
                <div className="text-sm text-slate-400">Categories</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar - Virtual File System */}
          <div className="col-span-3">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-4 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <Folder className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">Categories</h2>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedCategory === null
                      ? "bg-blue-500/20 text-blue-300"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4" />
                    <span>All Blueprints</span>
                  </div>
                </button>

                {AWS_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedCategory === category.id
                        ? "bg-blue-500/20 text-blue-300"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{category.icon}</span>
                      <span>{category.name}</span>
                      {stats?.categories?.[category.id] && (
                        <span className="ml-auto text-xs text-slate-500">
                          {stats.categories[category.id]}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-white/10">
                <Link
                  href="/archub/trending"
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Trending Blueprints</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-9">
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search blueprints by title, description, or services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Diagrams Grid */}
            {loading ? (
              <div className="text-center py-12 text-slate-400">Loading blueprints...</div>
            ) : diagrams && diagrams.length > 0 ? (
              <div className="grid grid-cols-2 gap-6">
                {diagrams.map((diagram) => (
                  <Link
                    key={diagram.id}
                    href={`/archub/blueprint/${diagram.id}`}
                    className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 hover:border-blue-500/50 transition-all overflow-hidden group"
                  >
                    <div className="aspect-video bg-slate-800/50 flex items-center justify-center">
                      {diagram.thumbnail_url ? (
                        <img
                          src={diagram.thumbnail_url}
                          alt={diagram.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileCode className="w-16 h-16 text-slate-600" />
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
                        {diagram.title}
                      </h3>
                      <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                        {diagram.description || "No description"}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>by {diagram.username}</span>
                        <div className="flex gap-3">
                          <span>👁️ {diagram.views}</span>
                          <span>🔄 {diagram.remixes}</span>
                        </div>
                      </div>
                      {diagram.services && diagram.services.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {diagram.services.slice(0, 3).map((service, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded"
                            >
                              {service}
                            </span>
                          ))}
                          {diagram.services.length > 3 && (
                            <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded">
                              +{diagram.services.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileCode className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No blueprints found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
