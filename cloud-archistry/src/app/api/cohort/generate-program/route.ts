import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || process.env.NEXT_PUBLIC_LEARNING_AGENT_URL || "https://cloudarchistry.com";

interface GenerateProgramRequest {
  teamId: string;
  outcome: string;
  duration: number;
  sessionsPerWeek: number;
  weeklyHours: number;
  focusAreas?: string;
  // Note: level and certTarget come from the tutor's profile settings
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;

    // Get academy user and verify tutor tier
    const academyUser = await prisma.academyUser.findUnique({
      where: { email: session.user.email },
      include: { 
        profile: {
          select: {
            id: true,
            subscriptionTier: true,
            skillLevel: true,
            targetCertification: true,
            preferredModel: true,
          }
        }, 
        tenant: true 
      },
    });

    if (!academyUser?.profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (academyUser.profile.subscriptionTier !== "tutor" && academyUser.profile.subscriptionTier !== "pro") {
      return NextResponse.json(
        { error: "Cohort program generation requires a Tutor subscription" },
        { status: 403 }
      );
    }

    const body: GenerateProgramRequest = await req.json();
    const { teamId, outcome, duration, sessionsPerWeek, weeklyHours, focusAreas } = body;

    if (!outcome?.trim()) {
      return NextResponse.json({ error: "Outcome is required" }, { status: 400 });
    }

    // Verify user owns/admins this team
    const teamMember = await prisma.academyTeamMember.findFirst({
      where: {
        academyUserId: academyUser.id,
        teamId,
        role: { in: ["owner", "admin"] },
      },
      include: { team: true },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "You must be an owner or admin of this cohort" },
        { status: 403 }
      );
    }

    // Get AI config (uses platform .env key)
    const aiConfig = await getAiConfigForRequest(profileId);

    // Get skill level and target certification from tutor's profile
    const skillLevel = academyUser.profile.skillLevel || "intermediate";
    const targetCertification = academyUser.profile.targetCertification || null;

    // Call the learning agent
    const response = await fetch(`${LEARNING_AGENT_URL}/api/learning/generate-cohort-program`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        team_id: teamId,
        team_name: teamMember.team.name,
        outcome,
        duration_weeks: duration,
        sessions_per_week: sessionsPerWeek,
        weekly_hours: weeklyHours,
        focus_areas: focusAreas || null,
        // From tutor's profile settings
        skill_level: skillLevel,
        target_certification: targetCertification,
        // AI config
        openai_api_key: aiConfig?.key || "",
        preferred_model: aiConfig?.preferredModel || "gpt-4o",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Learning agent error:", errorText);
      return NextResponse.json(
        { error: `Learning agent error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (!data?.success || !data?.program) {
      return NextResponse.json(
        { error: data?.error || "Learning agent returned an invalid payload" },
        { status: 502 }
      );
    }

    const program = data.program;

    // Save to database
    const savedProgram = await prisma.cohortProgram.create({
      data: {
        teamId,
        title: program.title,
        outcome: program.outcome || outcome,
        durationWeeks: program.duration || duration,
        sessionsPerWeek: program.sessionsPerWeek || sessionsPerWeek,
        weeklyHours: program.weeklyHours || weeklyHours,
        skillLevel,
        targetCertification,
        focusAreas: focusAreas || null,
        programData: program,
        progressData: { completedActions: [], completedMilestones: [], completedDeliverables: [] },
        status: "active",
        createdBy: academyUser.id,
      },
    });

    return NextResponse.json({
      id: savedProgram.id,
      ...program,
    });
  } catch (error) {
    console.error("Cohort program generation error:", error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
