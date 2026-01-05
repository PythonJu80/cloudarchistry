import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";
import { gatherStudyGuideData, type StudyGuideData } from "@/lib/academy/services/study-guide-data";
import { 
  evaluateMilestones, 
  evaluateActions,
  parseLegacyMilestones,
  type MilestoneDefinition,
  type EvaluatedMilestone,
  type EvaluatedAction 
} from "@/lib/academy/services/milestone-evaluator";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || process.env.NEXT_PUBLIC_LEARNING_AGENT_URL || "https://cloudarchistry.com";

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

    // Fetch current study plan (most recent) - includes all fields for milestone tracking
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

    // Transform plan output to frontend format with auto-evaluated milestones
    // Cast to StoredPlan - progressData exists in DB but Prisma types may need regeneration
    const transformedPlan = currentPlan 
      ? await transformPlanOutputWithMilestones(currentPlan as unknown as StoredPlan, profileId) 
      : null;
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

    // Fetch most recent plan to extract themes/actions for variation
    const previousPlan = await prisma.studyPlan.findFirst({
      where: { profileId },
      orderBy: { generatedAt: "desc" },
      select: { planOutput: true },
    });

    // Extract previous themes and action types to avoid repetition
    let previousContext = "";
    if (previousPlan?.planOutput) {
      const prevOutput = previousPlan.planOutput as Record<string, unknown>;
      const prevWeeks = (prevOutput.weeks as unknown[]) || [];
      const themes = prevWeeks.map((w: unknown) => {
        const week = w as Record<string, unknown>;
        return week.theme as string;
      }).filter(Boolean);
      
      const actionTypes = new Set<string>();
      const gameActions: string[] = [];
      prevWeeks.forEach((w: unknown) => {
        const week = w as Record<string, unknown>;
        const actions = (week.actions as unknown[]) || [];
        actions.forEach((a: unknown) => {
          const action = a as Record<string, unknown>;
          const type = action.type as string;
          const title = action.title as string;
          if (type) actionTypes.add(type);
          if (type === "game" && title) gameActions.push(title);
        });
      });

      previousContext = `PREVIOUS STUDY PLAN (DO NOT REPEAT):\nThemes used: ${themes.join(", ")}\nGames used: ${gameActions.join(", ")}\nAction types: ${[...actionTypes].join(", ")}`;
    }

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
        // Previous plan context for variation
        previous_plan_context: previousContext,
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

    // Delete ALL old plans for this user before creating new one
    // This ensures clean slate and prevents old progress data from affecting new plan
    await prisma.studyPlan.deleteMany({
      where: { profileId },
    });

    // Also delete old auto-generated content so new content can be created
    // Only delete AI-generated certification content, not user-created content
    await Promise.all([
      prisma.flashcardDeck.deleteMany({
        where: { profileId, deckType: "certification", generatedBy: "ai" },
      }),
      prisma.quiz.deleteMany({
        where: { profileId, quizType: "certification", generatedBy: "ai" },
      }),
      prisma.studyNotes.deleteMany({
        where: { profileId, generatedBy: "ai" },
      }),
    ]);

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

    // Auto-generate content based on what's in the study plan
    // This runs in the background - don't block the response
    autoGenerateStudyPlanContent(
      profileId,
      profile.targetCertification,
      profile.skillLevel || "intermediate",
      data.plan,
      aiConfig
    ).catch((err: unknown) => console.error("Background content generation failed:", err));

    // Transform and return with auto-evaluated milestones
    const transformedPlan = await transformPlanOutputWithMilestones(
      planRecord as unknown as StoredPlan, 
      profileId
    );

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

  // ALL PLATFORM FEATURES - organized by category for better distribution
  const handsOnFeatures = [
    { type: "world_challenge", title: "World Map Challenge", description: "Real-world scenario challenges from the world map", link: "/world" },
    { type: "drawing_challenge", title: "Architecture Drawing Challenge", description: "Design and draw AWS architectures to solve real problems", link: "/challenges" },
    { type: "cli_practice", title: "CLI Simulator", description: "Practice AWS CLI commands in a safe sandbox environment", link: "/challenges" },
  ];
  
  const studyFeatures = [
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
    // Games: ONLY final week gets a game for stress relief before exam
    // For longer plans (12+ weeks), also add one at the midpoint
    const isFinalWeek = w === weeks;
    const isMidpoint = weeks >= 12 && w === Math.floor(weeks / 2);
    const maxGamesThisWeek = (isFinalWeek || isMidpoint) ? 1 : 0;
    let gamesAdded = 0;

    // PRIORITY 1: Database challenges (if available) OR world map challenge
    if (challenges.length > 0 && w <= challenges.length) {
      const challenge = challenges[w - 1];
      weekActions.push({
        type: "world_challenge",
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        link: `/challenges/${challenge.id}`,
      });
    } else if (w % 3 === 1) {
      // Add world challenge every 3rd week starting from week 1
      weekActions.push(handsOnFeatures[0]); // World Map Challenge
    }

    // PRIORITY 2: Rotate hands-on features (drawing, CLI) - one per week
    const handsOnIndex = (w - 1) % handsOnFeatures.length;
    const handsOnFeature = handsOnFeatures[handsOnIndex];
    // Don't duplicate world_challenge if already added
    if (handsOnFeature.type !== "world_challenge" || weekActions.length === 0) {
      weekActions.push(handsOnFeature);
    }
    
    // PRIORITY 3: Add study feature every other week (notes, learning center, AI chat)
    if (w % 2 === 0 || w === 1) {
      const studyIndex = Math.floor((w - 1) / 2) % studyFeatures.length;
      weekActions.push(studyFeatures[studyIndex]);
    }

    // PRIORITY 4: Flashcards (every week, but with variety)
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
      weekActions.push({
        type: "flashcard",
        title: "Flashcard Review",
        description: "Review key AWS concepts with spaced repetition",
        link: "/learn/flashcards",
      });
    }

    // PRIORITY 5: Quizzes (starting week 2, every week)
    if (w >= 2) {
      if (quizzes.length > 0 && (w - 2) < quizzes.length) {
        const quiz = quizzes[w - 2];
        weekActions.push({
          type: "quiz",
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          link: `/learn/quiz/${quiz.id}`,
        });
      } else {
        weekActions.push({
          type: "quiz",
          title: "Topic Quiz",
          description: "Test your knowledge on specific AWS topics",
          link: "/learn/quiz",
        });
      }
    }

    // PRIORITY 6: Practice exam (final 2 weeks)
    if (w >= weeks - 1 && recommendations.nextExam) {
      weekActions.push({
        type: "practice_exam",
        id: recommendations.nextExam.id,
        title: recommendations.nextExam.title,
        description: `Full ${recommendations.nextExam.questionCount}-question practice exam`,
        link: `/learn/exams/${recommendations.nextExam.slug}`,
      });
    }

    // PRIORITY 7: Games (SPARINGLY - only midpoint and final week)
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

  // Build milestones with machine-readable criteria for auto-completion
  const passingScore = recommendations.nextExam?.passingScore ?? 75;
  const milestones = [
    {
      id: `milestone-challenges-${weeks}`,
      weekNumber: Math.ceil(weeks / 3),
      label: "Complete hands-on challenges and architecture drawings",
      metric: "Build 3+ working solutions",
      criteria: {
        type: "challenges_completed" as const,
        threshold: 3,
      },
    },
    {
      id: `milestone-flashcards-${weeks}`,
      weekNumber: Math.ceil(weeks / 2),
      label: "Master core AWS concepts through flashcards and notes",
      metric: "Master 30+ flashcards",
      criteria: {
        type: "flashcard_cards_mastered" as const,
        threshold: 30,
      },
    },
    {
      id: `milestone-exam-${weeks}`,
      weekNumber: weeks,
      label: "Pass practice exam with confidence",
      metric: `Score ${passingScore}%+ on practice exam`,
      criteria: {
        type: "exam_score" as const,
        threshold: passingScore,
      },
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
  // Rotate through ALL available games to ensure variety
  // Different games for different weeks - no bias toward any single game
  const availableGames = games.filter(g => g.slug !== "quiz-battle"); // Exclude non-live games
  
  if (availableGames.length === 0) return null;
  
  // Simple rotation through all games based on week number
  // This ensures different games are selected for different weeks
  const gameIndex = (weekNumber - 1) % availableGames.length;
  return availableGames[gameIndex];
}

interface StoredPlan {
  id: string;
  planOutput: unknown;
  studyHoursPerWeek: number | null;
  planInputs: unknown;
  progressData?: unknown;  // Optional - may not be in Prisma generated types until regenerated
  generatedAt: Date;
}

/**
 * Transform plan output with auto-evaluated milestones from database activity
 */
async function transformPlanOutputWithMilestones(plan: StoredPlan, profileId: string) {
  const output = plan.planOutput as Record<string, unknown> | null;
  const inputs = plan.planInputs as Record<string, unknown> | null;
  const progressData = (plan.progressData as {
    completedActions?: string[];
    completedMilestones?: string[];
  }) || {};
  
  if (!output) {
    return null;
  }

  // Parse milestones - check if they have criteria (new format) or need parsing (legacy)
  const rawMilestones = (output.milestones as unknown[]) || [];
  let milestoneDefinitions: MilestoneDefinition[];
  
  // Check if first milestone has criteria (new format)
  const firstMilestone = rawMilestones[0] as Record<string, unknown> | undefined;
  if (firstMilestone?.criteria) {
    // New format with criteria
    milestoneDefinitions = rawMilestones.map((m: unknown) => {
      const milestone = m as Record<string, unknown>;
      return {
        id: milestone.id as string || `milestone-${milestone.week_number || milestone.weekNumber}`,
        label: milestone.label as string,
        weekNumber: (milestone.week_number || milestone.weekNumber) as number,
        metric: milestone.metric as string,
        criteria: milestone.criteria as MilestoneDefinition["criteria"],
      };
    });
  } else {
    // Legacy format - parse and infer criteria
    milestoneDefinitions = parseLegacyMilestones(
      rawMilestones.map((m: unknown) => m as { label: string; week_number?: number; weekNumber?: number; metric?: string }),
      output.total_weeks as number || 6
    );
  }

  // Evaluate milestones against real database activity
  const evaluatedMilestones = await evaluateMilestones(
    profileId,
    milestoneDefinitions,
    progressData.completedMilestones || []
  );

  return {
    id: plan.id,
    summary: output.summary as string || "Your personalized study plan",
    totalWeeks: output.total_weeks as number || 6,
    hoursPerWeek: plan.studyHoursPerWeek || 6,
    learningStyle: inputs?.learningStyle as string || "hands_on",
    weeks: await Promise.all((output.weeks as unknown[])?.map(async (week: unknown) => {
      const w = week as Record<string, unknown>;
      const rawActions = ((w.actions as unknown[]) || []).map((action: unknown) => {
        const a = action as Record<string, unknown>;
        return {
          id: a.id as string,
          type: a.type as string,
          title: a.title as string,
          description: a.description as string,
          target: a.target as string | undefined,
          link: a.link as string | undefined,
        };
      });
      
      // Evaluate actions against real database activity
      const evaluatedActions = await evaluateActions(
        profileId,
        rawActions,
        progressData.completedActions || []
      );
      
      return {
        weekNumber: w.week_number as number,
        theme: w.theme as string,
        focus: w.focus as string,
        actions: evaluatedActions.map((a: EvaluatedAction) => ({
          id: a.id,
          type: a.type,
          title: a.title,
          description: a.description,
          target: a.target,
          link: a.link,
          completed: a.completed,
          autoDetected: a.autoDetected,
          currentValue: a.currentValue,
          targetValue: a.targetValue,
        })),
      };
    }) || []),
    milestones: evaluatedMilestones.map((m: EvaluatedMilestone) => ({
      id: m.id,
      label: m.label,
      weekNumber: m.weekNumber,
      metric: m.metric,
      completed: m.completed,
      autoDetected: m.autoDetected,
      currentValue: m.currentValue,
      targetValue: m.targetValue,
    })),
    accountability: (output.accountability as string[]) || [],
    resources: ((output.resources as unknown[]) || []).map((r: unknown) => {
      const resource = r as Record<string, unknown>;
      return {
        title: resource.title as string,
        url: resource.url as string,
        type: resource.type as string,
        description: (resource.description as string) || "",
      };
    }),
    generatedAt: plan.generatedAt.toISOString(),
  };
}

/**
 * Auto-generate content based on what actions are in the study plan.
 * Runs in background after plan creation - doesn't block the response.
 * 
 * Checks for:
 * - flashcard actions → generates flashcard deck
 * - notes actions → generates study notes  
 * - quiz actions → generates quiz
 */
async function autoGenerateStudyPlanContent(
  profileId: string,
  targetCertification: string,
  skillLevel: string,
  planOutput: Record<string, unknown>,
  aiConfig: { key?: string; preferredModel?: string } | null
): Promise<void> {
  const weeks = (planOutput.weeks as unknown[]) || [];
  
  // Collect all action types from the plan
  const actionTypes = new Set<string>();
  for (const week of weeks) {
    const w = week as Record<string, unknown>;
    const actions = (w.actions as unknown[]) || [];
    for (const action of actions) {
      const a = action as Record<string, unknown>;
      const actionType = a.type as string;
      if (actionType) {
        actionTypes.add(actionType);
      }
    }
  }

  console.log(`[Study Plan] Auto-generating content for action types: ${[...actionTypes].join(", ")}`);

  const generatePromises: Promise<unknown>[] = [];

  // Always generate flashcards if action exists (even if user has some)
  // Study plans should have dedicated flashcard decks
  if (actionTypes.has("flashcard") || actionTypes.has("flashcards")) {
    console.log("[Study Plan] Generating flashcards for study plan...");
    generatePromises.push(
      generateFlashcardsForPlan(profileId, targetCertification, skillLevel, aiConfig)
    );
  }

  // Always generate notes if action exists
  if (actionTypes.has("notes") || actionTypes.has("study_notes")) {
    console.log("[Study Plan] Generating study notes for study plan...");
    generatePromises.push(
      generateNotesForPlan(profileId, targetCertification, skillLevel, aiConfig)
    );
  }

  // Always generate quiz if action exists
  if (actionTypes.has("quiz")) {
    console.log("[Study Plan] Generating quiz for study plan...");
    generatePromises.push(
      generateQuizForPlan(profileId, targetCertification, skillLevel, aiConfig)
    );
  }

  // Run all generations in parallel
  if (generatePromises.length > 0) {
    const results = await Promise.allSettled(generatePromises);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[Study Plan] Content generation failed:", result.reason);
      }
    }
    console.log(`[Study Plan] Auto-generated ${generatePromises.length} content items`);
  }
}

/**
 * Generate flashcards for the study plan
 */
async function generateFlashcardsForPlan(
  profileId: string,
  targetCertification: string,
  skillLevel: string,
  aiConfig: { key?: string; preferredModel?: string } | null
): Promise<void> {
  try {
    // Dynamic card count based on skill level
    const cardCountByLevel: Record<string, number> = {
      beginner: 20,
      intermediate: 30,
      advanced: 40,
    };
    const cardCount = cardCountByLevel[skillLevel.toLowerCase()] || 30;

    // Use the same endpoint as the flashcards page - /api/learning/generate-flashcards
    const response = await fetch(`${LEARNING_AGENT_URL}/api/learning/generate-flashcards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        certification_code: targetCertification,
        user_level: skillLevel,
        card_count: cardCount,
        openai_api_key: aiConfig?.key,
        preferred_model: aiConfig?.preferredModel,
      }),
    });

    if (!response.ok) {
      throw new Error(`Flashcard generation failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.deck) {
      throw new Error("Invalid flashcard response");
    }

    // Save to database
    await prisma.flashcardDeck.create({
      data: {
        profileId,
        certificationCode: targetCertification,
        title: data.deck.title || `${targetCertification} Study Flashcards`,
        description: data.deck.description || "Auto-generated from your study plan",
        generatedBy: "ai",
        aiModel: aiConfig?.preferredModel || "gpt-4o",
        deckType: "certification",
        totalCards: data.deck.cards?.length || 0,
        cards: {
          create: (data.deck.cards || []).map((card: {
            front: string;
            back: string;
            difficulty?: string;
            tags?: string[];
            aws_services?: string[];
          }, index: number) => ({
            front: card.front,
            back: card.back,
            difficulty: card.difficulty || "medium",
            tags: card.tags || [],
            awsServices: card.aws_services || [],
            orderIndex: index,
          })),
        },
      },
    });

    console.log(`[Study Plan] Created flashcard deck with ${data.deck.cards?.length || 0} cards`);
  } catch (error) {
    console.error("[Study Plan] Flashcard generation error:", error);
    throw error;
  }
}

/**
 * Generate study notes for the study plan
 */
async function generateNotesForPlan(
  profileId: string,
  targetCertification: string,
  skillLevel: string,
  aiConfig: { key?: string; preferredModel?: string } | null
): Promise<void> {
  try {
    const response = await fetch(`${LEARNING_AGENT_URL}/api/learning/generate-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        certification_code: targetCertification,
        user_level: skillLevel,
        openai_api_key: aiConfig?.key,
        preferred_model: aiConfig?.preferredModel,
      }),
    });

    if (!response.ok) {
      throw new Error(`Notes generation failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.notes) {
      throw new Error("Invalid notes response");
    }

    // Save to database
    await prisma.studyNotes.create({
      data: {
        profileId,
        certificationCode: targetCertification,
        title: data.notes.title || `${targetCertification} Study Notes`,
        content: data.notes.content || "",
        generatedBy: "ai",
        aiModel: aiConfig?.preferredModel || "gpt-4o",
      },
    });

    console.log(`[Study Plan] Created study notes: ${data.notes.title}`);
  } catch (error) {
    console.error("[Study Plan] Notes generation error:", error);
    throw error;
  }
}

/**
 * Generate quiz for the study plan
 */
async function generateQuizForPlan(
  profileId: string,
  targetCertification: string,
  skillLevel: string,
  aiConfig: { key?: string; preferredModel?: string } | null
): Promise<void> {
  try {
    const response = await fetch(`${LEARNING_AGENT_URL}/api/learning/generate-quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        certification_code: targetCertification,
        user_level: skillLevel,
        question_count: 10,
        openai_api_key: aiConfig?.key,
        preferred_model: aiConfig?.preferredModel,
      }),
    });

    if (!response.ok) {
      throw new Error(`Quiz generation failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.quiz) {
      throw new Error("Invalid quiz response");
    }

    // Save to database
    await prisma.quiz.create({
      data: {
        profileId,
        certificationCode: targetCertification,
        title: data.quiz.title || `${targetCertification} Practice Quiz`,
        description: data.quiz.description || "Auto-generated from your study plan",
        quizType: "certification",
        questionCount: data.quiz.questions?.length || 0,
        generatedBy: "ai",
        aiModel: aiConfig?.preferredModel || "gpt-4o",
        questions: {
          create: (data.quiz.questions || []).map((q: {
            question: string;
            options: string[] | Array<{ id: string; text: string; isCorrect: boolean }>;
            correct_answer?: number;
            explanation?: string;
            difficulty?: string;
          }, index: number) => {
            // Handle both array of strings and array of option objects
            let formattedOptions: Array<{ id: string; text: string; isCorrect: boolean }>;
            if (Array.isArray(q.options) && q.options.length > 0) {
              if (typeof q.options[0] === "string") {
                // Convert string array to option objects
                formattedOptions = (q.options as string[]).map((opt, i) => ({
                  id: `opt-${i}`,
                  text: opt,
                  isCorrect: i === (q.correct_answer ?? 0),
                }));
              } else {
                formattedOptions = q.options as Array<{ id: string; text: string; isCorrect: boolean }>;
              }
            } else {
              formattedOptions = [];
            }
            
            return {
              question: q.question,
              options: formattedOptions,
              explanation: q.explanation || "",
              difficulty: q.difficulty || "medium",
              orderIndex: index,
            };
          }),
        },
      },
    });

    console.log(`[Study Plan] Created quiz with ${data.quiz.questions?.length || 0} questions`);
  } catch (error) {
    console.error("[Study Plan] Quiz generation error:", error);
    throw error;
  }
}

