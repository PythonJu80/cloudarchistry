import { NextRequest, NextResponse } from "next/server";
import { Redis } from "ioredis";

const GOOGLE_PLACES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Redis for persistent caching
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

interface Business {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
  rating?: number;
  totalRatings?: number;
  icon?: string;
  photo?: string;
}

// Round coordinates to create cache key - includes type!
function getCacheKey(lat: string, lng: string, type: string): string {
  return `${parseFloat(lat).toFixed(2)},${parseFloat(lng).toFixed(2)}:${type}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radius = searchParams.get("radius") || "5000";
  const type = searchParams.get("type") || "establishment";

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const cacheKey = getCacheKey(lat, lng, type);

  // Check Redis cache
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`Redis HIT for ${cacheKey}`);
      return NextResponse.json({ businesses: JSON.parse(cached) });
    }
  } catch (err) {
    console.error("Redis read error:", err);
  }

  if (!GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: "Google API key not configured" }, { status: 500 });
  }

  try {
    console.log(`Cache MISS for ${cacheKey} - fetching from Google`);
    
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${GOOGLE_PLACES_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Google Places API error:", data.status, data.error_message);
      return NextResponse.json({ error: data.status }, { status: 500 });
    }

    // Filter to operational businesses with location
    const businesses: Business[] = (data.results || [])
      .filter((place: Record<string, unknown>) => 
        place.business_status === "OPERATIONAL" &&
        place.name &&
        (place.geometry as Record<string, unknown>)?.location
      )
      .slice(0, 30)
      .map((place: Record<string, unknown>) => {
        const photos = place.photos as Array<{ photo_reference: string }>;
        const geometry = place.geometry as { location: { lat: number; lng: number } };
        
        // Get photo URL if available
        let photoUrl: string | undefined;
        if (photos && photos.length > 0) {
          const photoRef = photos[0].photo_reference;
          photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${GOOGLE_PLACES_API_KEY}`;
        }
        
        return {
          id: place.place_id as string,
          name: place.name as string,
          address: place.vicinity as string,
          lat: geometry.location.lat,
          lng: geometry.location.lng,
          types: (place.types as string[]) || [],
          rating: place.rating as number | undefined,
          totalRatings: place.user_ratings_total as number | undefined,
          icon: place.icon as string | undefined,
          photo: photoUrl,
        };
      });

    // Store in Redis cache (forever)
    try {
      await redis.set(cacheKey, JSON.stringify(businesses));
      console.log(`Redis: Cached ${businesses.length} businesses for ${cacheKey}`);
    } catch (err) {
      console.error("Redis write error:", err);
    }

    return NextResponse.json({ businesses });
  } catch (error) {
    console.error("Failed to fetch places:", error);
    return NextResponse.json({ error: "Failed to fetch places" }, { status: 500 });
  }
}
