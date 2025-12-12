import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/learn/notes/[notesId]
 * Get a specific study notes document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ notesId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { notesId } = await params;

    const notes = await prisma.studyNotes.findUnique({
      where: { id: notesId },
      include: {
        scenario: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!notes) {
      return NextResponse.json({ error: "Notes not found" }, { status: 404 });
    }

    // Transform to UI-friendly format
    const content = notes.content || "";
    const wordCount = content.split(/\s+/).length;
    const awsServices = notes.awsServices as string[] || [];
    const sections = notes.sections as { title?: string }[] || [];
    
    // Extract key takeaways from content
    const keyTakeawaysMatch = content.match(/(?:Key Takeaways|Takeaways)[\s\S]*?((?:[-*]\s+.+\n?)+)/i);
    const keyTakeaways = keyTakeawaysMatch 
      ? keyTakeawaysMatch[1].split("\n").filter(l => l.trim().startsWith("-") || l.trim().startsWith("*")).map(l => l.replace(/^[-*]\s+/, "").trim()).slice(0, 5)
      : sections.slice(0, 3).map(s => s.title || "");

    return NextResponse.json({
      id: notes.id,
      title: notes.title,
      content: notes.content,
      estimatedReadTimeMinutes: Math.max(1, Math.round(wordCount / 200)),
      keyTakeaways,
      awsServices,
      scenarioId: notes.scenarioId,
      scenario: notes.scenario,
      createdAt: notes.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/learn/notes/[notesId]
 * Soft-delete study notes
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ notesId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { notesId } = await params;

    // Soft delete by setting isActive to false
    await prisma.studyNotes.update({
      where: { id: notesId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting notes:", error);
    return NextResponse.json(
      { error: "Failed to delete notes" },
      { status: 500 }
    );
  }
}
