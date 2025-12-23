import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";
import { gatherStudyGuideData, type StudyGuideData } from "@/lib/academy/services/study-guide-data";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "http://10.121.19.210:1027";

/**
 * GET /api/learn/guide
 * Fetch user profile and current study plan
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;

    // Fetch profile with stats
    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: profileId },
      select: {
        skillLevel: true,
        targetCertification: true,
        challengesCompleted: true,
        totalPoints: true,
        currentStreak: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Fetch current study plan (most recent)
    const currentPlan = await prisma.studyPlan.findFirst({
      where: { profileId },
      orderBy: { generatedAt: "desc" },
    });

    // Fetch plan history (excluding current)
    const history = await prisma.studyPlan.findMany({
      where: { 
        profileId,
        id: currentPlan ? { not: currentPlan.id } : undefined,
      },
      orderBy: { generatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        generatedAt: true,
        planOutput: true,
      },
    });

    // Transform plan output to frontend format
    const transformedPlan = currentPlan ? transformPlanOutput(currentPlan) : null;
    const transformedHistory = history.map((h: { id: string; generatedAt: Date; planOutput: unknown }) => ({
      id: h.id,
      generatedAt: h.generatedAt.toISOString(),
      summary: (h.planOutput as Record<string, unknown>)?.summary as string || "Study Plan",
    }));

    return NextResponse.json({
      profile: {
        skillLevel: profile.skillLevel,
        targetCertification: profile.targetCertification,
        challengesCompleted: profile.challengesCompleted,
        totalPoints: profile.totalPoints,
        currentStreak: profile.currentStreak,
      },
      currentPlan: transformedPlan,
      history: transformedHistory,
    });
  } catch (error) {
    console.error("Guide GET failed:", error);
    return NextResponse.json({ error: "Failed to load guide data" }, { status: 500 });
  }
}

/**
 * POST /api/learn/guide
 * Generate a new study plan
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;

    // Get user's AI config (optional - will use .env if not provided)
    const aiConfig = await getAiConfigForRequest(profileId);

    // Get profile data
    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: profileId },
      select: {
        skillLevel: true,
        targetCertification: true,
        challengesCompleted: true,
        totalPoints: true,
        currentStreak: true,
        displayName: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile.targetCertification) {
      return NextResponse.json(
        { error: "Please set your target certification in Settings first." },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { examDate, hoursPerWeek = 6, learningStyles = ["hands_on"], coachNotes } = body;
    // Normalize to array and ensure at least one style
    const stylesArray: string[] = Array.isArray(learningStyles) ? learningStyles : [learningStyles];
    const normalizedStyles = stylesArray.length > 0 ? stylesArray : ["hands_on"];

    // Calculate weeks until exam
    const weeks = calculateWeeksUntil(examDate);

    // GATHER REAL DATA - The tool does the thinking, not the AI
    const guideData = await gatherStudyGuideData(profileId, profile.targetCertification);

    // Build structured content for the AI to format (not decide)
    const structuredContent = buildStructuredContent(guideData, weeks, hoursPerWeek, normalizedStyles);

    // Call learning agent to FORMAT the plan (not decide what goes in it)
    if (!LEARNING_AGENT_URL) {
      return NextResponse.json({ error: "Learning agent not configured" }, { status: 500 });
    }

    const response = await fetch(`${LEARNING_AGENT_URL}/api/learning/format-study-guide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // User context
        target_certification: profile.targetCertification,
        skill_level: profile.skillLevel,
        time_horizon_weeks: weeks,
        hours_per_week: hoursPerWeek,
        learning_styles: normalizedStyles,  // Array of styles
        coach_notes: coachNotes,
        exam_date: examDate || null,
        progress_summary: `${profile.challengesCompleted || 0} challenges completed, ${profile.totalPoints || 0} points earned, ${profile.currentStreak || 0} day streak`,
        // PRE-SELECTED content - AI just formats this
        structured_content: structuredContent,
        // AI config
        openai_api_key: aiConfig?.key,
        preferred_model: aiConfig?.preferredModel,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Learning agent error:", errorText);
      return NextResponse.json(
        { error: `Failed to generate plan: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    if (!data?.success || !data?.plan) {
      return NextResponse.json(
        { error: "Learning agent returned invalid response" },
        { status: 502 }
      );
    }

    // Save plan to database
    const planRecord = await prisma.studyPlan.create({
      data: {
        profileId,
        targetExam: profile.targetCertification,
        examDate: examDate ? new Date(examDate) : null,
        studyHoursPerWeek: hoursPerWeek,
        confidenceLevel: profile.skillLevel,
        planInputs: {
          examDate,
          hoursPerWeek,
          learningStyles: normalizedStyles,
          coachNotes,
          structuredContent,
        },
        planOutput: data.plan,
      },
    });

    // Transform and return
    const transformedPlan = transformPlanOutput(planRecord);

    return NextResponse.json({ plan: transformedPlan });
  } catch (error) {
    console.error("Guide POST failed:", error);
    return NextResponse.json({ error: "Failed to generate study plan" }, { status: 500 });
  }
}

// Helper functions

function calculateWeeksUntil(examDate?: string | null): number {
  if (!examDate) return 6; // Default 6 weeks
  const target = new Date(examDate);
  if (Number.isNaN(target.getTime())) return 6;
  const diffMs = target.getTime() - Date.now();
  const weeks = Math.max(2, Math.round(diffMs / (1000 * 60 * 60 * 24 * 7)));
  return Math.min(weeks, 12); // Cap at 12 weeks
}

/**
 * Build structured content from real data + ALL platform features.
 * THE TOOL DECIDES what content goes in the plan.
 * The AI just formats it nicely.
 * 
 * CRITICAL: 70-80% serious study features, max 1-2 games per week
 */
function buildStructuredContent(
  data: StudyGuideData,
  weeks: number,
  hoursPerWeek: number,
  learningStyles: string[]
) {
  const { recommendations, progress, games } = data;
  const weeklyContent = [];

  // ALL PLATFORM FEATURES (not just database content)
  const allFeatures = [
    // SERIOUS STUDY FEATURES (prioritize these)
    { type: "world_challenge", title: "World Map Challenge", description: "Real-world scenario challenges from the world map", link: "/world" },
    { type: "drawing_challenge", title: "Architecture Drawing Challenge", description: "Design and draw AWS architectures to solve real problems", link: "/challenges" },
    { type: "cli_practice", title: "CLI Simulator", description: "Practice AWS CLI commands in a safe sandbox environment", link: "/learn/cli" },
    { type: "notes", title: "Study Notes", description: "AI-generated comprehensive study notes on AWS topics", link: "/learn/notes" },
    { type: "learning_center", title: "Learning Center", description: "Comprehensive learning resources and guided paths", link: "/learn" },
    { type: "ai_chat", title: "Chat with AI Tutor", description: "Ask questions and get personalized explanations from the AI tutor", link: "/learn/chat" },
  ];

  // Merge database content with platform features
  const challenges = [...recommendations.priorityChallenges];
  const flashcards = [...recommendations.flashcardDecksToReview];
  const quizzes = [...recommendations.quizzesToTry];

  for (let w = 1; w <= weeks; w++) {
    const weekActions = [];
    const maxGamesThisWeek = w % 4 === 0 ? 1 : 0; // Game every 4th week only
    let gamesAdded = 0;

    // PRIORITY 1: Database challenges (if available)
    if (challenges.length > 0 && w <= challenges.length) {
      const challenge = challenges[w - 1];
      weekActions.push({
        type: "world_challenge",
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        link: `/challenges/${challenge.id}`,
      });
    }

    // PRIORITY 2: Platform features (rotate through ALL of them)
    const featureIndex = (w - 1) % allFeatures.length;
    const platformFeature = allFeatures[featureIndex];
    weekActions.push(platformFeature);
    
    // Add EXTRA drawing/CLI for hands-on/visual learners (in addition to rotation)
    if ((learningStyles.includes("hands_on") || learningStyles.includes("visual")) && w <= 6) {
      const extraFeatureIndex = (w - 1 + 3) % allFeatures.length; // Offset by 3
      const extraFeature = allFeatures[extraFeatureIndex];
      if (extraFeature.type === "drawing_challenge" || extraFeature.type === "cli_practice") {
        weekActions.push(extraFeature);
      }
    }

    // PRIORITY 3: Flashcards (if available)
    if (flashcards.length > 0 && w <= flashcards.length) {
      const deck = flashcards[w - 1];
      weekActions.push({
        type: "flashcard",
        id: deck.id,
        title: deck.title,
        description: deck.description || `Master ${deck.totalCards} flashcards`,
        link: `/learn/flashcards/${deck.id}`,
      });
    } else {
      // Add generic flashcard action
      weekActions.push({
        type: "flashcard",
        title: "Flashcard Review",
        description: "Review key AWS concepts with spaced repetition",
        link: "/learn/flashcards",
      });
    }

    // PRIORITY 4: Quizzes (starting week 2)
    if (w >= 2 && quizzes.length > 0 && (w - 2) < quizzes.length) {
      const quiz = quizzes[w - 2];
      weekActions.push({
        type: "quiz",
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        link: `/learn/quiz/${quiz.id}`,
      });
    } else if (w >= 2) {
      // Add generic quiz action
      weekActions.push({
        type: "quiz",
        title: "Topic Quiz",
        description: "Test your knowledge on specific AWS topics",
        link: "/learn/quiz",
      });
    }

    // PRIORITY 5: Practice exam (final 2 weeks)
    if (w >= weeks - 1 && recommendations.nextExam) {
      weekActions.push({
        type: "practice_exam",
        id: recommendations.nextExam.id,
        title: recommendations.nextExam.title,
        description: `Full ${recommendations.nextExam.questionCount}-question practice exam`,
        link: `/learn/exams/${recommendations.nextExam.slug}`,
      });
    }

    // PRIORITY 6: Games (SPARINGLY - max 1 per week, only every 4th week)
    if (gamesAdded < maxGamesThisWeek && games.length > 0) {
      const gameForWeek = selectGameForLearningStyles(games, learningStyles, w);
      if (gameForWeek) {
        weekActions.push({
          type: "game",
          id: gameForWeek.slug,
          title: gameForWeek.name,
          description: gameForWeek.description,
          link: gameForWeek.link,
        });
        gamesAdded++;
      }
    }

    weeklyContent.push({
      weekNumber: w,
      actions: weekActions,
    });
  }

  // Build milestones
  const milestones = [
    {
      weekNumber: Math.ceil(weeks / 3),
      label: "Complete hands-on challenges and architecture drawings",
      metric: "Build 3+ working solutions",
    },
    {
      weekNumber: Math.ceil(weeks / 2),
      label: "Master core AWS concepts through flashcards and notes",
      metric: "90%+ accuracy on flashcard reviews",
    },
    {
      weekNumber: weeks,
      label: "Pass practice exam with confidence",
      metric: recommendations.nextExam ? `Score ${recommendations.nextExam.passingScore}%+ on practice exam` : "Score 75%+ on practice exam",
    },
  ]

  return {
    weeks: weeklyContent,
    milestones,
    focusAreas: recommendations.focusAreas,
    progress: {
      challengesCompleted: progress.challengesCompleted,
      totalChallenges: progress.totalChallenges,
      examsPassed: progress.examsPassed,
      currentStreak: progress.currentStreak,
    },
  };
}

function selectGameForLearningStyles(
  games: StudyGuideData["games"],
  learningStyles: string[],
  weekNumber: number
) {
  // Rotate through games, prioritizing based on learning styles
  // Combine priorities from all selected styles
  const priorityMap: Record<string, string[]> = {
    visual: ["cloud-tycoon", "sniper-quiz", "lightning-round"],
    auditory: ["quiz-battle", "lightning-round", "hot-streak"],
    reading: ["sniper-quiz", "hot-streak", "lightning-round"],
    hands_on: ["cloud-tycoon", "sniper-quiz", "hot-streak"],
  };

  // Merge priorities from all selected styles
  const allPriorities: string[] = [];
  for (const style of learningStyles) {
    const stylePriorities = priorityMap[style] || [];
    for (const game of stylePriorities) {
      if (!allPriorities.includes(game)) {
        allPriorities.push(game);
      }
    }
  }
  const priority = allPriorities.length > 0 ? allPriorities : priorityMap.hands_on;
  const gameSlug = priority[weekNumber % priority.length];
  return games.find(g => g.slug === gameSlug) || games[0];
}

interface StoredPlan {
  id: string;
  planOutput: unknown;
  studyHoursPerWeek: number | null;
  planInputs: unknown;
  generatedAt: Date;
}

function transformPlanOutput(plan: StoredPlan) {
  const output = plan.planOutput as Record<string, unknown> | null;
  const inputs = plan.planInputs as Record<string, unknown> | null;
  
  if (!output) {
    return null;
  }

  return {
    id: plan.id,
    summary: output.summary as string || "Your personalized study plan",
    totalWeeks: output.total_weeks as number || 6,
    hoursPerWeek: plan.studyHoursPerWeek || 6,
    learningStyle: inputs?.learningStyle as string || "hands_on",
    weeks: (output.weeks as unknown[])?.map((week: unknown) => {
      const w = week as Record<string, unknown>;
      return {
        weekNumber: w.week_number as number,
        theme: w.theme as string,
        focus: w.focus as string,
        actions: ((w.actions as unknown[]) || []).map((action: unknown) => {
          const a = action as Record<string, unknown>;
          return {
            id: a.id as string,
            type: a.type as string,
            title: a.title as string,
            description: a.description as string,
            target: a.target as string | undefined,
            link: a.link as string | undefined,
            completed: a.completed as boolean || false,
          };
        }),
      };
    }) || [],
    milestones: ((output.milestones as unknown[]) || []).map((m: unknown) => {
      const milestone = m as Record<string, unknown>;
      return {
        label: milestone.label as string,
        weekNumber: milestone.week_number as number,
        metric: milestone.metric as string,
        completed: milestone.completed as boolean || false,
      };
    }),
    accountability: (output.accountability as string[]) || [],
    resources: ((output.resources as unknown[]) || []).map((r: unknown) => {
      const resource = r as Record<string, unknown>;
      return {
        title: resource.title as string,
        url: resource.url as string,
        type: resource.type as string,
      };
    }),
    generatedAt: plan.generatedAt.toISOString(),
  };
}
