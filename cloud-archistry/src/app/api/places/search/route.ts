import { NextRequest, NextResponse } from "next/server";

const GOOGLE_PLACES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radius = searchParams.get("radius") || "5000"; // 5km default

  if (!query) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  if (!GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: "Google API key not configured" }, { status: 500 });
  }

  try {
    // Use Text Search API with location bias
    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}`;
    
    // Add location bias if coordinates provided
    if (lat && lng) {
      url += `&location=${lat},${lng}&radius=${radius}`;
    }
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Google Places API error:", data.status, data.error_message);
      return NextResponse.json({ error: data.status }, { status: 500 });
    }

    // Return simplified results
    const results = (data.results || [])
      .slice(0, 8) // Limit to 8 results
      .map((place: { place_id: string; name: string; formatted_address: string; vicinity?: string; types: string[] }) => ({
        place_id: place.place_id,
        name: place.name,
        vicinity: place.formatted_address || place.vicinity,
        types: place.types || [],
      }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Failed to search places:", error);
    return NextResponse.json({ error: "Failed to search places" }, { status: 500 });
  }
}
