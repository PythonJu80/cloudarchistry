import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";
import { prisma } from "@/lib/db";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "http://10.121.19.210:1027";

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
 * Generate new study notes from user's certification/telemetry (same pattern as flashcards)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;

    // Get AI config (optional - will use .env if not provided)
    const aiConfig = await getAiConfigForRequest(profileId);

    // Get user profile with telemetry data
    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: profileId },
      select: {
        skillLevel: true,
        targetCertification: true,
        challengesCompleted: true,
        scenariosCompleted: true,
        totalPoints: true,
        level: true,
      },
    });

    if (!profile?.targetCertification) {
      return NextResponse.json(
        {
          error: "No target certification set",
          message: "Please set your target AWS certification in Settings before generating notes.",
          action: "set_certification",
        },
        { status: 400 }
      );
    }

    if (!LEARNING_AGENT_URL) {
      return NextResponse.json(
        { error: "Learning agent not configured" },
        { status: 500 }
      );
    }

    // Build telemetry summary for AI context
    const telemetrySummary = {
      skillLevel: profile.skillLevel,
      targetCertification: profile.targetCertification,
      challengesCompleted: profile.challengesCompleted,
      scenariosCompleted: profile.scenariosCompleted,
      totalPoints: profile.totalPoints,
      level: profile.level,
    };

    // Call learning agent to generate notes
    const response = await fetch(
      `${LEARNING_AGENT_URL}/api/learning/generate-notes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certification_code: profile.targetCertification,
          user_level: profile.skillLevel || "intermediate",
          telemetry: telemetrySummary,
          openai_api_key: aiConfig?.key,
          preferred_model: aiConfig?.preferredModel,
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

    // Save the notes to our database (same pattern as flashcards)
    const notesData = data.notes;
    const newNotes = await prisma.studyNotes.create({
      data: {
        profileId,
        certificationCode: profile.targetCertification,
        title: notesData.title || `${profile.targetCertification} Study Notes`,
        content: notesData.content || "",
        sections: notesData.sections || [],
        awsServices: notesData.aws_services || notesData.awsServices || [],
        keyTakeaways: notesData.key_takeaways || notesData.keyTakeaways || [],
        generatedBy: "ai",
        aiModel: aiConfig.preferredModel || "gpt-4o",
      },
    });

    return NextResponse.json({
      success: true,
      notesId: newNotes.id,
    });
  } catch (error) {
    console.error("Error generating notes:", error);
    return NextResponse.json(
      { error: "Failed to generate notes" },
      { status: 500 }
    );
  }
}
