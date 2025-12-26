import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Extract YouTube video ID from various URL formats
 */
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

/**
 * GET /api/resources
 * Fetch user's external resources
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // video, documentation, course, article
    const source = searchParams.get("source"); // youtube, aws, user, study-guide

    const where: Record<string, unknown> = { profileId };
    if (type) where.type = type;
    if (source) where.source = source;

    const resources = await prisma.externalResource.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ resources });
  } catch (error) {
    console.error("Failed to fetch resources:", error);
    return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
  }
}

/**
 * POST /api/resources
 * Add a new external resource (user-added or from study guide)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const body = await request.json();
    const { url, title, type, source = "user", notes, certification } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Check for duplicate URL
    const existing = await prisma.externalResource.findFirst({
      where: { profileId, url },
    });
    if (existing) {
      return NextResponse.json({ error: "Resource already exists", resource: existing }, { status: 409 });
    }

    // Extract YouTube video ID if it's a YouTube URL
    const videoId = extractYouTubeVideoId(url);
    const isYouTube = !!videoId;
    
    // Generate thumbnail URL for YouTube videos
    const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;

    // Determine type if not provided
    let resourceType = type;
    if (!resourceType) {
      if (isYouTube) resourceType = "video";
      else if (url.includes("docs.aws.amazon.com")) resourceType = "documentation";
      else if (url.includes("aws.amazon.com/training")) resourceType = "course";
      else resourceType = "article";
    }

    // Determine source if YouTube
    const resourceSource = isYouTube ? "youtube" : (url.includes("aws.amazon.com") ? "aws" : source);

    // Get user's target certification if not provided
    let cert = certification;
    if (!cert) {
      const profile = await prisma.academyUserProfile.findUnique({
        where: { id: profileId },
        select: { targetCertification: true },
      });
      cert = profile?.targetCertification;
    }

    // Create the resource
    const resource = await prisma.externalResource.create({
      data: {
        profileId,
        url,
        title: title || (isYouTube ? "YouTube Video" : "External Resource"),
        type: resourceType,
        source: resourceSource,
        videoId,
        thumbnailUrl,
        certification: cert,
        notes,
      },
    });

    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    console.error("Failed to add resource:", error);
    return NextResponse.json({ error: "Failed to add resource" }, { status: 500 });
  }
}

/**
 * DELETE /api/resources
 * Delete a resource by ID
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Resource ID required" }, { status: 400 });
    }

    // Verify ownership
    const resource = await prisma.externalResource.findFirst({
      where: { id, profileId },
    });

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    await prisma.externalResource.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete resource:", error);
    return NextResponse.json({ error: "Failed to delete resource" }, { status: 500 });
  }
}

/**
 * PATCH /api/resources
 * Update a resource (mark watched, add notes, favorite)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const body = await request.json();
    const { id, isWatched, isFavorite, notes, title } = body;

    if (!id) {
      return NextResponse.json({ error: "Resource ID required" }, { status: 400 });
    }

    // Verify ownership
    const resource = await prisma.externalResource.findFirst({
      where: { id, profileId },
    });

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (isWatched !== undefined) {
      updateData.isWatched = isWatched;
      if (isWatched) updateData.watchedAt = new Date();
    }
    if (isFavorite !== undefined) updateData.isFavorite = isFavorite;
    if (notes !== undefined) updateData.notes = notes;
    if (title !== undefined) updateData.title = title;

    const updated = await prisma.externalResource.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ resource: updated });
  } catch (error) {
    console.error("Failed to update resource:", error);
    return NextResponse.json({ error: "Failed to update resource" }, { status: 500 });
  }
}
