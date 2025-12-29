import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || process.env.NEXT_PUBLIC_LEARNING_AGENT_URL || "https://cloudarchistry.com";

// Types for cohort program structure
interface CohortWeek {
  week: number;
  title: string;
  learningObjectives: string[];
  sessions: Array<{
    sessionNumber: number;
    title: string;
    duration: string;
    overview: string;
    keyPoints: string[];
  }>;
  homework?: {
    description: string;
    platformFeature?: string;
    estimatedMinutes?: number;
    link?: string;
  };
}

interface CohortMilestone {
  label: string;
  weekNumber: number;
  successIndicators?: string[];
}

interface CohortProgram {
  title: string;
  outcome: string;
  duration: number;
  level: string;
  sessionsPerWeek: number;
  weeklyHours: number;
  targetCertification?: string;
  weeks: CohortWeek[];
  milestones?: CohortMilestone[];
  capstone?: {
    title: string;
    description: string;
  };
}

/**
 * Transform a tutor's cohort program into learner-focused study guide content.
 * Extracts homework, learning objectives, and key points as actionable study items.
 */
function transformCohortProgramToStudyContent(program: CohortProgram) {
  return {
    weeks: program.weeks.map((week) => ({
      weekNumber: week.week,
      actions: [
        // Learning objectives as study focus items
        ...week.learningObjectives.map((objective) => ({
          type: "study",
          title: objective,
          description: `Week ${week.week}: ${week.title}`,
          link: "/learn",
        })),
        // Homework as primary learner action
        ...(week.homework ? [{
          type: week.homework.platformFeature || "task",
          title: week.homework.description,
          description: week.homework.estimatedMinutes 
            ? `Estimated: ${week.homework.estimatedMinutes} minutes`
            : "Complete before next session",
          link: week.homework.link || "/learn",
        }] : []),
        // Key points from sessions as review items
        ...week.sessions.flatMap((session) => 
          (session.keyPoints || []).slice(0, 2).map((point) => ({
            type: "review",
            title: point,
            description: `From Session ${session.sessionNumber}: ${session.title}`,
            link: "/learn/flashcards",
          }))
        ),
      ],
    })),
    milestones: (program.milestones || []).map((m) => ({
      weekNumber: m.weekNumber,
      label: m.label,
      metric: (m.successIndicators || []).join(", ") || "Complete milestone",
    })),
    focusAreas: program.weeks.flatMap((w) => w.learningObjectives).slice(0, 10),
    progress: { 
      challengesCompleted: 0, 
      totalChallenges: program.weeks.length * 2, 
      examsPassed: 0, 
      currentStreak: 0 
    },
  };
}

/**
 * Generate study guides for all cohort members (excluding owner).
 * Runs asynchronously after program creation - does not block response.
 */
async function generateStudyGuidesForMembers(
  teamId: string,
  program: CohortProgram,
  savedProgramId: string,
  skillLevel: string,
  targetCertification: string | null,
  weeklyHours: number,
  duration: number,
  teamName: string,
  aiConfig: { key?: string; preferredModel?: string } | null
) {
  try {
    // Get all non-owner members with their profiles
    const members = await prisma.academyTeamMember.findMany({
      where: {
        teamId,
        role: { not: "owner" },
      },
      include: {
        academyUser: {
          include: {
            profile: {
              select: {
                id: true,
                skillLevel: true,
                targetCertification: true,
              }
            }
          }
        }
      }
    });

    if (members.length === 0) {
      console.log(`[Cohort] No non-owner members found for team ${teamId}`);
      return;
    }

    console.log(`[Cohort] Generating study guides for ${members.length} members`);

    // Transform cohort program to study guide content
    const structuredContent = transformCohortProgramToStudyContent(program);

    // Generate study guide for each member
    for (const member of members) {
      if (!member.academyUser?.profile?.id) {
        console.log(`[Cohort] Skipping member ${member.id} - no profile`);
        continue;
      }

      const profileId = member.academyUser.profile.id;

      // Check for existing study plan from this cohort program (deduplication)
      const existingPlan = await prisma.studyPlan.findFirst({
        where: {
          profileId,
          planInputs: {
            path: ["cohortProgramId"],
            equals: savedProgramId,
          },
        },
      });

      if (existingPlan) {
        console.log(`[Cohort] Study plan already exists for profile ${profileId}`);
        continue;
      }

      try {
        const response = await fetch(`${LEARNING_AGENT_URL}/api/learning/format-study-guide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_certification: targetCertification || member.academyUser.profile.targetCertification || "cloud-practitioner",
            skill_level: skillLevel,
            time_horizon_weeks: duration,
            hours_per_week: weeklyHours,
            learning_styles: ["hands_on"],
            coach_notes: `Part of cohort: ${teamName}. Follow your tutor's guidance during live sessions.`,
            structured_content: structuredContent,
            openai_api_key: aiConfig?.key || "",
            preferred_model: aiConfig?.preferredModel || "gpt-4o",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data?.success && data?.plan) {
            await prisma.studyPlan.create({
              data: {
                profileId,
                targetExam: targetCertification,
                studyHoursPerWeek: weeklyHours,
                confidenceLevel: skillLevel,
                planInputs: { 
                  cohortProgramId: savedProgramId, 
                  teamId,
                  teamName,
                  generatedFromCohort: true,
                },
                planOutput: data.plan,
              },
            });
            console.log(`[Cohort] Created study plan for profile ${profileId}`);
          }
        } else {
          console.error(`[Cohort] Failed to generate study guide for profile ${profileId}:`, await response.text());
        }
      } catch (memberError) {
        console.error(`[Cohort] Error generating study guide for profile ${profileId}:`, memberError);
      }
    }

    console.log(`[Cohort] Finished generating study guides for team ${teamId}`);
  } catch (error) {
    console.error(`[Cohort] Error in generateStudyGuidesForMembers:`, error);
  }
}

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

    // Archive any existing active programs for this team
    await prisma.cohortProgram.updateMany({
      where: {
        teamId,
        status: "active",
      },
      data: {
        status: "archived",
      },
    });

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

    // Generate study guides for all cohort members (async - don't block response)
    generateStudyGuidesForMembers(
      teamId,
      program as CohortProgram,
      savedProgram.id,
      skillLevel,
      targetCertification,
      weeklyHours,
      duration,
      teamMember.team.name,
      aiConfig
    ).catch((err) => {
      console.error("[Cohort] Background study guide generation failed:", err);
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
