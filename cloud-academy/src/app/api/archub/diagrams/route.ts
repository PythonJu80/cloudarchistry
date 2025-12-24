import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DIAGRAM_API_URL = process.env.DIAGRAM_API_URL || "http://diagram-api:8002";
const DIAGRAM_INGESTION_URL = process.env.DIAGRAM_INGESTION_URL || "http://diagram-ingestion:8000";
const DIAGRAM_PARSER_URL = process.env.DIAGRAM_PARSER_URL || "http://diagram-parser:8001";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("query");
    const category = searchParams.get("category");
    const service = searchParams.get("service");
    const tag = searchParams.get("tag");
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const params = new URLSearchParams();
    if (query) params.append("query", query);
    if (category) params.append("category", category);
    if (service) params.append("service", service);
    if (tag) params.append("tag", tag);
    if (userId) params.append("user_id", userId);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    params.append("status", "completed");

    const response = await fetch(`${DIAGRAM_API_URL}/diagrams?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Diagram API error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching diagrams:", error);
    return NextResponse.json({ error: "Failed to fetch diagrams" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let arcHubProfile = await prisma.arcHubProfile.findUnique({
      where: { profileId: session.user.academyProfileId },
    });

    if (!arcHubProfile) {
      // Auto-create ArcHub profile if it doesn't exist
      arcHubProfile = await prisma.arcHubProfile.create({
        data: {
          profileId: session.user.academyProfileId,
          arcHubUsername: session.user.username || session.user.email?.split("@")[0] || "user",
        },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const tags = formData.get("tags") as string;
    const format = formData.get("format") as string;

    if (!file || !title || !format) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("title", title);
    uploadFormData.append("description", description || "");
    uploadFormData.append("tags", tags || "[]");
    uploadFormData.append("format", format);
    uploadFormData.append("user_id", arcHubProfile.id);
    uploadFormData.append("username", arcHubProfile.arcHubUsername || session.user.username);

    const uploadResponse = await fetch(`${DIAGRAM_INGESTION_URL}/upload`, {
      method: "POST",
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      return NextResponse.json({ error: errorData.detail || "Upload failed" }, { status: uploadResponse.status });
    }

    const diagramData = await uploadResponse.json();

    await prisma.arcHubDiagram.create({
      data: {
        id: diagramData.id,
        arcHubProfileId: arcHubProfile.id,
        title: diagramData.title,
        description: diagramData.description,
        format: diagramData.format,
        status: diagramData.status,
        fileUrl: diagramData.file_url,
        thumbnailUrl: diagramData.thumbnail_url,
        tags: diagramData.tags,
        services: diagramData.services,
        categories: diagramData.categories,
        visibility: arcHubProfile.defaultVisibility,
      },
    });

    await prisma.arcHubProfile.update({
      where: { id: arcHubProfile.id },
      data: { diagramsUploaded: { increment: 1 } },
    });

    const parseResponse = await fetch(`${DIAGRAM_PARSER_URL}/parse/${diagramData.id}`, {
      method: "POST",
    });

    if (!parseResponse.ok) {
      console.error("Failed to trigger parsing");
    }

    return NextResponse.json(diagramData);
  } catch (error) {
    console.error("Error uploading diagram:", error);
    return NextResponse.json({ error: "Failed to upload diagram" }, { status: 500 });
  }
}
