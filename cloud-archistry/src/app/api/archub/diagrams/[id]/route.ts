import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DIAGRAM_API_URL = process.env.DIAGRAM_API_URL || "http://diagram-api:8002";
const DIAGRAM_INGESTION_URL = process.env.DIAGRAM_INGESTION_URL || "http://diagram-ingestion:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const response = await fetch(`${DIAGRAM_API_URL}/diagrams/${params.id}`);
    
    if (!response.ok) {
      return NextResponse.json({ error: "Diagram not found" }, { status: 404 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching diagram:", error);
    return NextResponse.json({ error: "Failed to fetch diagram" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const arcHubProfile = await prisma.arcHubProfile.findUnique({
      where: { profileId: session.user.academyProfileId },
    });

    if (!arcHubProfile) {
      return NextResponse.json({ error: "ArcHub profile not found" }, { status: 404 });
    }

    // Check local ArcHubDiagram table first
    const localDiagram = await prisma.arcHubDiagram.findUnique({
      where: { id: params.id },
    });

    // If diagram exists locally, verify ownership
    if (localDiagram && localDiagram.arcHubProfileId !== arcHubProfile.id) {
      return NextResponse.json({ error: "Not authorized to delete this diagram" }, { status: 403 });
    }

    // Delete from diagram-ingestion (which will delete from MinIO and the diagram database)
    // Note: user_id in diagram-ingestion is the arcHubProfile.id (set during upload)
    let ingestionDeleted = false;
    try {
      const deleteResponse = await fetch(
        `${DIAGRAM_INGESTION_URL}/diagram/${params.id}?user_id=${arcHubProfile.id}`,
        { method: "DELETE" }
      );
      
      if (deleteResponse.ok) {
        ingestionDeleted = true;
      } else {
        const errorText = await deleteResponse.text();
        console.error("Failed to delete from diagram-ingestion:", errorText);
        // If 404, the diagram doesn't exist in ingestion - that's okay
        if (deleteResponse.status === 404) {
          ingestionDeleted = true;
        }
      }
    } catch (error) {
      console.error("Error calling diagram-ingestion delete:", error);
    }

    // Delete from local database if it exists there
    if (localDiagram) {
      await prisma.arcHubDiagram.delete({
        where: { id: params.id },
      });

      await prisma.arcHubProfile.update({
        where: { id: arcHubProfile.id },
        data: { diagramsUploaded: { decrement: 1 } },
      });
    }

    // If neither deletion worked, return error
    if (!localDiagram && !ingestionDeleted) {
      return NextResponse.json({ error: "Diagram not found or not authorized" }, { status: 404 });
    }

    return NextResponse.json({ message: "Diagram deleted successfully" });
  } catch (error) {
    console.error("Error deleting diagram:", error);
    return NextResponse.json({ error: "Failed to delete diagram" }, { status: 500 });
  }
}
