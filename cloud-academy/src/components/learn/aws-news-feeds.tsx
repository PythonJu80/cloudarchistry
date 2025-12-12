"use client";

import { useState, useEffect, useRef } from "react";
import {
  Rss,
  ExternalLink,
  Headphones,
  Newspaper,
  ChevronDown,
  ChevronRight,
  Star,
  Loader2,
  Clock,
  BookOpen,
  Play,
  Pause,
  Volume2,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AWS_FEED_CATEGORIES,
  PRIORITY_CONFIG,
  type AWSFeedCategory,
  type AWSFeed,
} from "@/lib/aws-feeds";

interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  audioUrl?: string;
  duration?: string;
}

interface ExpandedState {
  [key: string]: boolean;
}

export function AWSNewsFeeds() {
  const [expandedCategories, setExpandedCategories] = useState<ExpandedState>(() => {
    // Expand core categories by default
    const initial: ExpandedState = {};
    AWS_FEED_CATEGORIES.forEach((cat) => {
      if (cat.priority === "core") {
        initial[cat.name] = true;
      }
    });
    return initial;
  });
  
  const [subscribedFeeds, setSubscribedFeeds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const saved = localStorage.getItem("subscribedAWSFeeds");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState<string | null>(null);
  const [selectedFeed, setSelectedFeed] = useState<AWSFeed | null>(null);
  const [isPodcastFeed, setIsPodcastFeed] = useState(false);
  
  // Audio player state
  const [playingEpisode, setPlayingEpisode] = useState<FeedItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Save subscriptions to localStorage
  useEffect(() => {
    localStorage.setItem("subscribedAWSFeeds", JSON.stringify([...subscribedFeeds]));
  }, [subscribedFeeds]);

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleSubscription = (feedUrl: string) => {
    setSubscribedFeeds((prev) => {
      const next = new Set(prev);
      if (next.has(feedUrl)) {
        next.delete(feedUrl);
      } else {
        next.add(feedUrl);
      }
      return next;
    });
  };

  const fetchFeedPreview = async (feed: AWSFeed) => {
    setLoadingFeed(feed.url);
    setSelectedFeed(feed);
    setFeedItems([]);
    setIsPodcastFeed(false);
    
    try {
      // Use a CORS proxy or API route to fetch RSS
      const response = await fetch(`/api/rss-proxy?url=${encodeURIComponent(feed.url)}`);
      if (response.ok) {
        const data = await response.json();
        setFeedItems(data.items?.slice(0, 5) || []);
        setIsPodcastFeed(data.isPodcast || false);
      }
    } catch (error) {
      console.error("Failed to fetch feed:", error);
    } finally {
      setLoadingFeed(null);
    }
  };

  // Audio player controls
  const playEpisode = (episode: FeedItem) => {
    if (playingEpisode?.audioUrl === episode.audioUrl && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      setPlayingEpisode(episode);
      setIsPlaying(true);
      if (audioRef.current) {
        if (playingEpisode?.audioUrl !== episode.audioUrl) {
          audioRef.current.src = episode.audioUrl || "";
          audioRef.current.load();
        }
        audioRef.current.play();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skipTime = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, duration));
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getPriorityFeeds = (priority: "core" | "secondary" | "specialized") => {
    return AWS_FEED_CATEGORIES.filter((cat) => cat.priority === priority);
  };

  const renderFeedCard = (feed: AWSFeed, category: AWSFeedCategory) => {
    const isSubscribed = subscribedFeeds.has(feed.url);
    const isPodcast = feed.url.includes("podcast");
    const config = PRIORITY_CONFIG[category.priority];
    
    return (
      <div
        key={feed.url}
        className={`group p-3 rounded-lg border transition-all hover:border-primary/50 ${
          isSubscribed ? `${config.bg} ${config.border}` : "border-border/50 bg-muted/30"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${config.bg}`}>
            {isPodcast ? (
              <Headphones className={`w-4 h-4 ${config.color}`} />
            ) : (
              <Newspaper className={`w-4 h-4 ${config.color}`} />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm truncate">{feed.name}</h4>
              {isSubscribed && (
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
              )}
            </div>
            {feed.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {feed.description}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => toggleSubscription(feed.url)}
              className={`p-1.5 rounded-md transition-colors ${
                isSubscribed 
                  ? "bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30" 
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
              title={isSubscribed ? "Unsubscribe" : "Subscribe"}
            >
              <Star className={`w-3.5 h-3.5 ${isSubscribed ? "fill-current" : ""}`} />
            </button>
            <button
              onClick={() => fetchFeedPreview(feed)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Preview feed"
            >
              {loadingFeed === feed.url ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <BookOpen className="w-3.5 h-3.5" />
              )}
            </button>
            <a
              href={feed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Open RSS feed"
            >
              <Rss className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  };

  const renderCategory = (category: AWSFeedCategory) => {
    const isExpanded = expandedCategories[category.name];
    const config = PRIORITY_CONFIG[category.priority];
    const subscribedCount = category.feeds.filter((f) => subscribedFeeds.has(f.url)).length;
    
    return (
      <div key={category.name} className="border border-border/50 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleCategory(category.name)}
          className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{category.name}</h3>
              <Badge variant="secondary" className="text-xs">
                {category.feeds.length} feeds
              </Badge>
              {subscribedCount > 0 && (
                <Badge className={`text-xs ${config.bg} ${config.color} border-0`}>
                  {subscribedCount} subscribed
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{category.description}</p>
          </div>
        </button>
        
        {isExpanded && (
          <div className="px-4 pb-4 space-y-2">
            {category.feeds.map((feed) => renderFeedCard(feed, category))}
          </div>
        )}
      </div>
    );
  };

  const renderPrioritySection = (
    priority: "core" | "secondary" | "specialized",
    title: string
  ) => {
    const categories = getPriorityFeeds(priority);
    const config = PRIORITY_CONFIG[priority];
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-1 h-6 rounded-full ${config.bg.replace("/10", "")}`} />
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>
        </div>
        <div className="space-y-3 pl-4">
          {categories.map(renderCategory)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">
            {subscribedFeeds.size} feeds subscribed • {AWS_FEED_CATEGORIES.reduce((acc, cat) => acc + cat.feeds.length, 0)} total
          </p>
        </div>
        {subscribedFeeds.size > 0 && (
          <Button variant="outline" size="sm">
            <Rss className="w-4 h-4 mr-2" />
            Export OPML
          </Button>
        )}
      </div>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      {/* Podcast Player - Fixed at bottom when playing */}
      {playingEpisode && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/50 p-4 z-50 shadow-lg">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => skipTime(-15)}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                  title="Back 15s"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={() => playEpisode(playingEpisode)}
                  className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
                <button
                  onClick={() => skipTime(30)}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                  title="Forward 30s"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Headphones className="w-4 h-4 text-primary flex-shrink-0" />
                  <h4 className="font-medium text-sm truncate">{playingEpisode.title}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10">{formatTime(currentTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-1 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                  />
                  <span className="text-xs text-muted-foreground w-10 text-right">{formatTime(duration)}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                <button
                  onClick={() => {
                    setPlayingEpisode(null);
                    setIsPlaying(false);
                    if (audioRef.current) {
                      audioRef.current.pause();
                      audioRef.current.src = "";
                    }
                  }}
                  className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
                  title="Close player"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feed Preview Panel */}
      {selectedFeed && (
        <div className="border border-border/50 rounded-xl p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {isPodcastFeed ? (
                <Headphones className="w-5 h-5 text-primary" />
              ) : (
                <Newspaper className="w-5 h-5 text-primary" />
              )}
              <div>
                <h3 className="font-semibold">{selectedFeed.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {isPodcastFeed ? "Latest episodes" : "Latest articles"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFeed(null)}
            >
              Close
            </Button>
          </div>
          
          {loadingFeed ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : feedItems.length > 0 ? (
            <div className="space-y-3">
              {feedItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border transition-all ${
                    playingEpisode?.audioUrl === item.audioUrl
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Play button for podcasts */}
                    {item.audioUrl && (
                      <button
                        onClick={() => playEpisode(item)}
                        className={`flex-shrink-0 p-2 rounded-full transition-colors ${
                          playingEpisode?.audioUrl === item.audioUrl && isPlaying
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-primary hover:text-primary-foreground"
                        }`}
                      >
                        {playingEpisode?.audioUrl === item.audioUrl && isPlaying ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" />
                        )}
                      </button>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors"
                      >
                        <h4 className="font-medium text-sm line-clamp-2">{item.title}</h4>
                      </a>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.pubDate).toLocaleDateString()}
                          </span>
                        </div>
                        {item.duration && (
                          <div className="flex items-center gap-1">
                            <Headphones className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{item.duration}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
              <a
                href={selectedFeed.url.replace("/feed/", "").replace("/feed", "").replace(".rss", "")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
              >
                {isPodcastFeed ? "View all episodes" : "View all articles"}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Click preview to load {isPodcastFeed ? "episodes" : "articles"}, or visit directly
            </p>
          )}
        </div>
      )}

      {/* Priority Sections */}
      {renderPrioritySection("core", "Core Resources")}
      {renderPrioritySection("secondary", "Complementary Topics")}
      {renderPrioritySection("specialized", "Specialized Domains")}
    </div>
  );
}
