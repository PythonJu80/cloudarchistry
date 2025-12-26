"use client";

import { useState, useEffect, useRef } from "react";
import {
  ExternalLink,
  Headphones,
  Newspaper,
  Star,
  Loader2,
  Clock,
  Play,
  Pause,
  Volume2,
  SkipBack,
  SkipForward,
  X,
  Youtube,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AWS_FEED_CATEGORIES,
  PRIORITY_CONFIG,
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

interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
}

export function AWSNewsFeeds() {
  const [subscribedFeeds, setSubscribedFeeds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const saved = localStorage.getItem("subscribedAWSFeeds");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState<string | null>(null);
  const [selectedFeed, setSelectedFeed] = useState<AWSFeed | null>(null);
  const [isPodcastFeed, setIsPodcastFeed] = useState(false);
  
  // YouTube playlist state
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeVideo[]>([]);
  const [loadingYoutube, setLoadingYoutube] = useState(true);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  
  // Audio player state
  const [playingEpisode, setPlayingEpisode] = useState<FeedItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    localStorage.setItem("subscribedAWSFeeds", JSON.stringify([...subscribedFeeds]));
  }, [subscribedFeeds]);

  // Fetch YouTube playlist videos
  useEffect(() => {
    async function fetchYoutubeVideos() {
      try {
        const response = await fetch("/api/youtube-playlist?limit=6");
        if (response.ok) {
          const data = await response.json();
          setYoutubeVideos(data.videos || []);
        } else {
          setYoutubeError("Failed to load videos");
        }
      } catch {
        setYoutubeError("Failed to load videos");
      } finally {
        setLoadingYoutube(false);
      }
    }
    fetchYoutubeVideos();
  }, []);

  const toggleSubscription = (feedUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  // Group all feeds flat for grid display
  const allFeeds = AWS_FEED_CATEGORIES.flatMap((cat) => 
    cat.feeds.map((feed) => ({ ...feed, category: cat.name, priority: cat.priority }))
  );

  // Get podcast feeds
  const podcastFeeds = allFeeds.filter((f) => 
    f.category === "Podcasts" || f.url.includes("podcast") || f.url.includes(".rss")
  );

  const renderFeedCard = (feed: AWSFeed & { category: string; priority: "core" | "secondary" | "specialized" }) => {
    const isSubscribed = subscribedFeeds.has(feed.url);
    const isPodcast = feed.category === "Podcasts" || feed.url.includes("podcast");
    const config = PRIORITY_CONFIG[feed.priority];
    const isSelected = selectedFeed?.url === feed.url;
    const isLoading = loadingFeed === feed.url;
    
    return (
      <div
        key={feed.url}
        onClick={() => fetchFeedPreview(feed)}
        className={`group relative p-4 rounded-xl border cursor-pointer transition-all ${
          isSelected 
            ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
            : isSubscribed 
              ? `${config.bg} ${config.border}` 
              : "border-border/50 bg-card hover:border-primary/30 hover:bg-muted/50"
        }`}
      >
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 rounded-xl flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
        
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-lg ${config.bg} flex-shrink-0`}>
            {isPodcast ? (
              <Headphones className={`w-5 h-5 ${config.color}`} />
            ) : (
              <Newspaper className={`w-5 h-5 ${config.color}`} />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm truncate">{feed.name}</h4>
              {isSubscribed && (
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {feed.description}
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {feed.category}
          </Badge>
          
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => toggleSubscription(feed.url, e)}
              className={`p-1.5 rounded-md transition-colors ${
                isSubscribed 
                  ? "bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30" 
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
              title={isSubscribed ? "Unsubscribe" : "Subscribe"}
            >
              <Star className={`w-3.5 h-3.5 ${isSubscribed ? "fill-current" : ""}`} />
            </button>
            <a
              href={feed.url.replace("/feed/", "").replace("/feed", "").replace(".rss", "")}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Open website"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{subscribedFeeds.size}</span> subscribed · <span className="font-medium text-foreground">{allFeeds.length}</span> total feeds
        </p>
        <p className="text-xs text-muted-foreground">Click any feed to preview latest content</p>
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

      {/* Feed Preview Panel - Slides in when feed selected */}
      {selectedFeed && (
        <div className="border border-primary/30 rounded-xl bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/30">
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
            <button
              onClick={() => setSelectedFeed(null)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="p-4">
            {loadingFeed ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : feedItems.length > 0 ? (
              <div className="grid gap-3">
                {feedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border transition-all ${
                      playingEpisode?.audioUrl === item.audioUrl
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-primary/30 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
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
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No items found
              </p>
            )}
          </div>
        </div>
      )}

      {/* AWS Podcast Videos Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold">AWS Podcast Videos</h2>
            {youtubeVideos.length > 0 && (
              <Badge variant="secondary" className="text-xs">{youtubeVideos.length}</Badge>
            )}
          </div>
          <a
            href="https://www.youtube.com/playlist?list=PLhr1KZpdzukfFtjuF85ydw0r-qlnLFkM9"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            View all <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        
        {loadingYoutube ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : youtubeError ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <p>{youtubeError}</p>
            <p className="text-xs mt-1">Add GOOGLE_API_KEY to your environment</p>
          </div>
        ) : youtubeVideos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {youtubeVideos.map((video) => (
              <div
                key={video.videoId}
                className={`group rounded-xl border overflow-hidden transition-all hover:border-primary/50 ${
                  playingVideoId === video.videoId ? "border-red-500 ring-1 ring-red-500/20" : "border-border/50"
                }`}
              >
                {playingVideoId === video.videoId ? (
                  <div className="aspect-video">
                    <iframe
                      src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1`}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                ) : (
                  <div
                    className="relative aspect-video bg-muted cursor-pointer"
                    onClick={() => setPlayingVideoId(video.videoId)}
                  >
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center">
                        <Play className="w-7 h-7 text-white ml-1" />
                      </div>
                    </div>
                  </div>
                )}
                <div className="p-3">
                  <h4 className="font-medium text-sm line-clamp-2 leading-tight">{video.title}</h4>
                  <div className="flex items-center gap-1 mt-2">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {new Date(video.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No videos available
          </p>
        )}
      </div>

      {/* RSS Podcasts Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Headphones className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">RSS Podcast Feeds</h2>
          <Badge variant="secondary" className="text-xs">{podcastFeeds.length}</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {podcastFeeds.map((feed) => renderFeedCard(feed))}
        </div>
      </div>

      {/* Blogs Section - Grouped by Category */}
      {AWS_FEED_CATEGORIES.filter((cat) => cat.name !== "Podcasts").map((category) => {
        const config = PRIORITY_CONFIG[category.priority];
        const categoryFeeds = category.feeds.map((feed) => ({
          ...feed,
          category: category.name,
          priority: category.priority,
        }));
        
        return (
          <div key={category.name}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-1.5 h-5 rounded-full ${config.bg.replace("/10", "")}`} />
              <h2 className="font-semibold">{category.name}</h2>
              <Badge variant="outline" className={`text-xs ${config.color}`}>
                {category.feeds.length}
              </Badge>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {category.description}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {categoryFeeds.map((feed) => renderFeedCard(feed))}
            </div>
          </div>
        );
      })}

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
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
