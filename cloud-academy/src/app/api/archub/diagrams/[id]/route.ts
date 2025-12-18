import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DIAGRAM_API_URL = process.env.DIAGRAM_API_URL || "http://diagram-api:8002";

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

    const diagram = await prisma.arcHubDiagram.findUnique({
      where: { id: params.id },
    });

    if (!diagram || diagram.arcHubProfileId !== arcHubProfile.id) {
      return NextResponse.json({ error: "Diagram not found or unauthorized" }, { status: 404 });
    }

    await prisma.arcHubDiagram.delete({
      where: { id: params.id },
    });

    await prisma.arcHubProfile.update({
      where: { id: arcHubProfile.id },
      data: { diagramsUploaded: { decrement: 1 } },
    });

    return NextResponse.json({ message: "Diagram deleted successfully" });
  } catch (error) {
    console.error("Error deleting diagram:", error);
    return NextResponse.json({ error: "Failed to delete diagram" }, { status: 500 });
  }
}
