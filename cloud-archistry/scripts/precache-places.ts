/**
 * Pre-cache Google Places data for all system challenge locations
 * Run once to populate Redis, then never pay for those locations again
 * 
 * Usage: npx ts-node scripts/precache-places.ts
 */

import { Redis } from "ioredis";

const GOOGLE_PLACES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:4379";

// All system challenge locations from page.tsx
const LOCATIONS = [
  { name: "Mailchimp HQ - Atlanta", lat: 33.7725, lng: -84.3655 },
  { name: "Shopify HQ - Ottawa", lat: 45.4208, lng: -75.6901 },
  { name: "Canva HQ - Sydney", lat: -33.8837, lng: 151.2086 },
  { name: "Atlassian HQ - Sydney", lat: -33.8651, lng: 151.2070 },
  { name: "HSBC Tower - London", lat: 51.5049, lng: -0.0183 },
  { name: "Barclays HQ - London", lat: 51.5154, lng: -0.0990 },
  { name: "NHS England - London", lat: 51.5074, lng: -0.0798 },
  { name: "Google HQ - Mountain View", lat: 37.4220, lng: -122.0841 },
  { name: "Meta HQ - Menlo Park", lat: 37.4845, lng: -122.1477 },
  { name: "Amazon HQ - Seattle", lat: 47.6222, lng: -122.3369 },
  { name: "Netflix HQ - Los Gatos", lat: 37.2614, lng: -121.9577 },
  { name: "Nintendo HQ - Kyoto", lat: 34.9697, lng: 135.7544 },
  { name: "BMW Welt - Munich", lat: 48.1770, lng: 11.5562 },
  { name: "DBS HQ - Singapore", lat: 1.2789, lng: 103.8536 },
  { name: "Emirates HQ - Dubai", lat: 25.2528, lng: 55.3644 },
  { name: "LVMH Tower - Paris", lat: 48.8661, lng: 2.3044 },
];

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

function getCacheKey(lat: number, lng: number): string {
  return `places:${lat.toFixed(2)},${lng.toFixed(2)}`;
}

async function fetchAndCachePlaces(redis: Redis, location: { name: string; lat: number; lng: number }) {
  const cacheKey = getCacheKey(location.lat, location.lng);
  
  // Check if already cached
  const existing = await redis.get(cacheKey);
  if (existing) {
    const businesses = JSON.parse(existing);
    console.log(`✓ ${location.name} - Already cached (${businesses.length} businesses)`);
    return;
  }

  // Fetch from Google Places
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=5000&type=establishment&key=${GOOGLE_PLACES_API_KEY}`;
  
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error(`✗ ${location.name} - API Error: ${data.status}`);
    return;
  }

  // Filter and map businesses
  const businesses: Business[] = (data.results || [])
    .filter((place: Record<string, unknown>) => 
      place.business_status === "OPERATIONAL" &&
      place.name &&
      (place.geometry as Record<string, unknown>)?.location &&
      place.photos && (place.photos as unknown[]).length > 0
    )
    .slice(0, 30)
    .map((place: Record<string, unknown>) => {
      const photos = place.photos as Array<{ photo_reference: string }>;
      const geometry = place.geometry as { location: { lat: number; lng: number } };
      
      let photoUrl: string | undefined;
      if (photos && photos.length > 0) {
        photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photos[0].photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
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

  // Cache to Redis
  await redis.set(cacheKey, JSON.stringify(businesses));
  console.log(`✓ ${location.name} - Cached ${businesses.length} businesses`);
}

async function main() {
  if (!GOOGLE_PLACES_API_KEY) {
    console.error("ERROR: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set");
    process.exit(1);
  }

  console.log("Connecting to Redis...");
  const redis = new Redis(REDIS_URL);
  
  console.log(`\nPre-caching ${LOCATIONS.length} locations...\n`);

  for (const location of LOCATIONS) {
    await fetchAndCachePlaces(redis, location);
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log("\n✓ Done! All locations cached.");
  
  await redis.quit();
  process.exit(0);
}

main().catch(console.error);
