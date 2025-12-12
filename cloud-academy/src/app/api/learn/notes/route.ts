import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";
import { prisma } from "@/lib/db";

const LEARNING_AGENT_URL = process.env.NEXT_PUBLIC_LEARNING_AGENT_URL;

/**
 * GET /api/learn/notes
 * List all study notes for the current user's profile
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;

    // Fetch study notes
    const notes = await prisma.studyNotes.findMany({
      where: {
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        content: true,
        sections: true,
        awsServices: true,
        scenarioId: true,
        createdAt: true,
      },
    });

    // Get user's read progress
    const readProgress = await prisma.studyNotesProgress.findMany({
      where: { profileId },
    });

    const progressMap = new Map(
      readProgress.map((p) => [p.notesId, p])
    );

    // Transform notes to UI-friendly format
    const notesWithProgress = notes.map((note) => {
      const content = note.content || "";
      const wordCount = content.split(/\s+/).length;
      const awsServices = note.awsServices as string[] || [];
      const sections = note.sections as { title?: string }[] || [];
      
      // Extract summary from first paragraph
      const firstParagraph = content.split("\n\n")[0] || "";
      const summary = firstParagraph.replace(/^#.*\n/, "").slice(0, 200);
      
      // Extract key takeaways from content (look for bullet points after "Key Takeaways")
      const keyTakeawaysMatch = content.match(/(?:Key Takeaways|Takeaways)[\s\S]*?((?:[-*]\s+.+\n?)+)/i);
      const keyTakeaways = keyTakeawaysMatch 
        ? keyTakeawaysMatch[1].split("\n").filter(l => l.trim().startsWith("-") || l.trim().startsWith("*")).map(l => l.replace(/^[-*]\s+/, "").trim()).slice(0, 5)
        : sections.slice(0, 3).map(s => s.title || "");
      
      return {
        id: note.id,
        title: note.title,
        summary,
        content: note.content,
        estimatedReadTimeMinutes: Math.max(1, Math.round(wordCount / 200)),
        keyTakeaways,
        awsServices,
        scenarioId: note.scenarioId,
        createdAt: note.createdAt.toISOString(),
        userProgress: progressMap.get(note.id) || null,
      };
    });

    return NextResponse.json({ notes: notesWithProgress });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/learn/notes
 * Generate new study notes from a scenario
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const body = await request.json();
    const { scenarioId } = body;

    if (!scenarioId) {
      return NextResponse.json(
        { error: "scenarioId is required" },
        { status: 400 }
      );
    }

    // Get AI config
    const aiConfig = await getAiConfigForRequest(profileId);
    if (!aiConfig) {
      return NextResponse.json(
        {
          error: "OpenAI API key required",
          message: "Add an API key in Settings to generate notes.",
          action: "configure_api_key",
        },
        { status: 402 }
      );
    }

    // Get user profile for persona
    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: profileId },
      select: { skillLevel: true, targetCertification: true },
    });

    if (!LEARNING_AGENT_URL) {
      return NextResponse.json(
        { error: "Learning agent not configured" },
        { status: 500 }
      );
    }

    // Call learning agent to generate notes
    const response = await fetch(
      `${LEARNING_AGENT_URL}/api/learning/generate-notes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_id: scenarioId,
          user_level: profile?.skillLevel || "intermediate",
          persona_id: profile?.targetCertification || null,
          openai_api_key: aiConfig.key,
          preferred_model: aiConfig.preferredModel,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Learning agent error:", errorText);
      return NextResponse.json(
        { error: `Failed to generate notes: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    if (!data.success) {
      return NextResponse.json(
        { error: data.error || "Notes generation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notesId: data.notes_id,
      generationMethod: data.generation_method,
    });
  } catch (error) {
    console.error("Error generating notes:", error);
    return NextResponse.json(
      { error: "Failed to generate notes" },
      { status: 500 }
    );
  }
}
