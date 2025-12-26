import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Only allow AWS RSS feeds for security
  const allowedDomains = [
    "aws.amazon.com",
    "d3gih7jbfe3jlq.cloudfront.net", // AWS Podcast
  ];
  
  try {
    const feedUrl = new URL(url);
    if (!allowedDomains.some((domain) => feedUrl.hostname.includes(domain))) {
      return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CloudArchistry RSS Reader/1.0",
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch feed" },
        { status: response.status }
      );
    }

    const xml = await response.text();
    
    // Check if this is a podcast feed
    const isPodcast = url.includes("podcast") || xml.includes("<enclosure");
    
    // Parse RSS XML - simple extraction
    const items: Array<{
      title: string;
      link: string;
      pubDate: string;
      description?: string;
      audioUrl?: string;
      duration?: string;
    }> = [];

    // Extract items using regex (simple but effective for RSS)
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
    
    for (const match of itemMatches) {
      const itemXml = match[1];
      
      const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
      const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/pubDate>/);
      const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);

      // Extract audio enclosure for podcasts
      const enclosureMatch = itemXml.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*\/?>/);
      const durationMatch = itemXml.match(/<itunes:duration>([^<]+)<\/itunes:duration>/);

      if (titleMatch && linkMatch) {
        items.push({
          title: decodeHTMLEntities(titleMatch[1].trim()),
          link: linkMatch[1].trim(),
          pubDate: pubDateMatch?.[1]?.trim() || "",
          description: descMatch ? decodeHTMLEntities(descMatch[1].trim()).slice(0, 200) : undefined,
          audioUrl: enclosureMatch?.[1]?.trim(),
          duration: durationMatch?.[1]?.trim(),
        });
      }

      if (items.length >= 10) break; // Limit to 10 items
    }

    return NextResponse.json({ items, isPodcast });
  } catch (error) {
    console.error("RSS proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch or parse feed" },
      { status: 500 }
    );
  }
}

function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
  };
  
  return text.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
}
