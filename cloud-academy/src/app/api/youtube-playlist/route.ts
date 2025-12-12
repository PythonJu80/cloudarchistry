import { NextRequest, NextResponse } from "next/server";

const PLAYLIST_ID = "PLhr1KZpdzukfFtjuF85ydw0r-qlnLFkM9";

// In-memory cache to minimize API calls
const cache: { data: { videos: unknown[]; fetchedAt: number } | null } = { data: null };
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours - fetch once per day max

export async function GET(request: NextRequest) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json(
      { error: "YouTube API key not configured. Add YOUTUBE_API_KEY to your environment." },
      { status: 500 }
    );
  }

  // Return cached data if still valid (within 24 hours)
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "6");
  
  if (cache.data && Date.now() - cache.data.fetchedAt < CACHE_DURATION_MS) {
    return NextResponse.json({
      videos: cache.data.videos.slice(0, limit),
      playlistId: PLAYLIST_ID,
      total: cache.data.videos.length,
      cached: true,
      cachedAt: new Date(cache.data.fetchedAt).toISOString(),
    });
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=10&playlistId=${PLAYLIST_ID}&key=${apiKey}`;
    
    const response = await fetch(url, {
      next: { revalidate: 86400 }, // Next.js cache for 24 hours
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("YouTube API error:", error);
      return NextResponse.json(
        { error: "Failed to fetch playlist" },
        { status: response.status }
      );
    }

    const data = await response.json();

    const videos = data.items?.map((item: {
      snippet: {
        resourceId: { videoId: string };
        title: string;
        description: string;
        publishedAt: string;
        thumbnails: {
          medium?: { url: string };
          default?: { url: string };
        };
      };
    }) => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      description: item.snippet.description?.slice(0, 150) + "...",
      publishedAt: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
    })) || [];

    // Save to cache
    cache.data = {
      videos,
      fetchedAt: Date.now(),
    };

    return NextResponse.json({ 
      videos: videos.slice(0, limit),
      playlistId: PLAYLIST_ID,
      total: data.pageInfo?.totalResults || videos.length,
      cached: false,
    });
  } catch (error) {
    console.error("YouTube playlist fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch playlist" },
      { status: 500 }
    );
  }
}
