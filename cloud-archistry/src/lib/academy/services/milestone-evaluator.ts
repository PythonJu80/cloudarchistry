/**
 * Milestone Evaluator Service
 * ============================
 * Automatically evaluates milestone completion based on real user activity data from the database.
 * No more manual toggling - milestones complete themselves when criteria are met.
 */

import { prisma } from "@/lib/db";

// Milestone criteria types that can be evaluated
export type MilestoneCriteriaType = 
  | "challenges_completed"      // Count of completed challenges
  | "scenarios_completed"       // Count of completed scenarios  
  | "flashcard_mastery"         // Percentage of cards mastered in a deck
  | "flashcard_cards_mastered"  // Total cards mastered across all decks
  | "exam_score"                // Best practice exam score percentage
  | "exam_passed"               // Has passed a practice exam
  | "quiz_score"                // Best quiz score percentage
  | "quiz_passed"               // Has passed a quiz
  | "total_points"              // Total points earned
  | "current_streak"            // Current activity streak days
  | "total_time_minutes";       // Total study time

export interface MilestoneCriteria {
  type: MilestoneCriteriaType;
  threshold: number;           // The value that must be met/exceeded
  certCode?: string;           // Optional: for cert-specific milestones
  examId?: string;             // Optional: for specific exam milestones
  deckId?: string;             // Optional: for specific flashcard deck
}

export interface MilestoneDefinition {
  id: string;
  label: string;
  weekNumber: number;
  metric: string;              // Human-readable description
  criteria: MilestoneCriteria;
}

export interface EvaluatedMilestone {
  id: string;
  label: string;
  weekNumber: number;
  metric: string;
  completed: boolean;
  autoDetected: boolean;       // True if completion was auto-detected from DB
  currentValue?: number;       // Current progress value
  targetValue?: number;        // Target value to complete
  completedAt?: string;        // When it was completed (if available)
}

export interface UserActivityData {
  // From AcademyUserProfile
  challengesCompleted: number;
  scenariosCompleted: number;
  totalPoints: number;
  currentStreak: number;
  totalTimeMinutes: number;
  
  // From ExamAttempt
  bestExamScore: number | null;
  examsPassed: number;
  examAttemptCount: number;
  latestExamCompletedAt: Date | null;
  
  // From FlashcardUserProgress
  totalCardsMastered: number;
  totalCardsStudied: number;
  flashcardAccuracy: number;   // Percentage
  hasStudiedFlashcards: boolean;
  
  // From QuizAttempt
  bestQuizScore: number | null;
  quizzesPassed: number;
  quizAttemptCount: number;
  latestQuizCompletedAt: Date | null;
  
  // From ScenarioAttempt
  completedScenarioIds: string[];
  scenarioAttemptCount: number;
  
  // From ChallengeProgress
  completedChallengeCount: number;
  
  // From ArcHubDiagram (architecture drawings)
  diagramsCreated: number;
}

// Action types that can be auto-evaluated
export type ActionType = 
  | "world_challenge"      // World Map Challenge - scenarios
  | "flashcard"            // Flashcard Review
  | "practice_exam"        // Practice Exam
  | "quiz"                 // Quiz
  | "architecture"         // Architecture Drawing Challenge
  | "cli_challenge"        // CLI Challenge
  | "notes"                // Study Notes
  | "game";                // Learning Games

export interface EvaluatedAction {
  id: string;
  type: string;
  title: string;
  description: string;
  target?: string;
  link?: string;
  completed: boolean;
  autoDetected: boolean;
  currentValue?: number;
  targetValue?: number;
}

/**
 * Fetch all relevant user activity data from the database
 */
export async function fetchUserActivityData(profileId: string): Promise<UserActivityData> {
  // Parallel fetch all activity data
  const [
    profile,
    examAttempts,
    flashcardProgress,
    quizAttempts,
    scenarioAttempts,
    challengeProgressCount,
  ] = await Promise.all([
    // User profile stats
    prisma.academyUserProfile.findUnique({
      where: { id: profileId },
      select: {
        challengesCompleted: true,
        scenariosCompleted: true,
        totalPoints: true,
        currentStreak: true,
        totalTimeMinutes: true,
      },
    }),
    
    // Exam attempts - get completed ones
    prisma.examAttempt.findMany({
      where: { 
        profileId,
        status: "completed",
      },
      select: {
        score: true,
        passed: true,
        completedAt: true,
      },
      orderBy: { completedAt: "desc" },
    }),
    
    // Flashcard progress across all decks
    prisma.flashcardUserProgress.findMany({
      where: { profileId },
      select: {
        cardsMastered: true,
        cardsStudied: true,
        totalReviews: true,
      },
    }),
    
    // Quiz attempts - get completed ones
    prisma.quizAttempt.findMany({
      where: {
        profileId,
        status: "completed",
      },
      select: {
        score: true,
        passed: true,
        completedAt: true,
      },
      orderBy: { completedAt: "desc" },
    }),
    
    // Scenario attempts - get completed ones
    prisma.scenarioAttempt.findMany({
      where: {
        profileId,
        status: "completed",
      },
      select: {
        id: true,
        scenarioId: true,
        completedAt: true,
      },
    }),
    
    // Challenge progress - count completed
    prisma.challengeProgress.count({
      where: {
        attempt: { profileId },
        status: "completed",
      },
    }),
  ]);

  // Calculate aggregated stats
  const bestExamScore = examAttempts.length > 0 
    ? Math.max(...examAttempts.map(e => e.score ?? 0))
    : null;
  
  const examsPassed = examAttempts.filter(e => e.passed).length;
  
  const latestExamCompletedAt = examAttempts.length > 0 && examAttempts[0].completedAt
    ? examAttempts[0].completedAt
    : null;

  const totalCardsMastered = flashcardProgress.reduce((sum, fp) => sum + fp.cardsMastered, 0);
  const totalCardsStudied = flashcardProgress.reduce((sum, fp) => sum + fp.cardsStudied, 0);
  const flashcardAccuracy = totalCardsStudied > 0 
    ? (totalCardsMastered / totalCardsStudied) * 100 
    : 0;

  const bestQuizScore = quizAttempts.length > 0
    ? Math.max(...quizAttempts.map(q => q.score ?? 0))
    : null;
  
  const quizzesPassed = quizAttempts.filter(q => q.passed).length;
  
  const latestQuizCompletedAt = quizAttempts.length > 0 && quizAttempts[0].completedAt
    ? quizAttempts[0].completedAt
    : null;

  return {
    challengesCompleted: profile?.challengesCompleted ?? 0,
    scenariosCompleted: profile?.scenariosCompleted ?? 0,
    totalPoints: profile?.totalPoints ?? 0,
    currentStreak: profile?.currentStreak ?? 0,
    totalTimeMinutes: profile?.totalTimeMinutes ?? 0,
    bestExamScore,
    examsPassed,
    examAttemptCount: examAttempts.length,
    latestExamCompletedAt,
    totalCardsMastered,
    totalCardsStudied,
    flashcardAccuracy,
    hasStudiedFlashcards: flashcardProgress.length > 0 && totalCardsStudied > 0,
    bestQuizScore,
    quizzesPassed,
    quizAttemptCount: quizAttempts.length,
    latestQuizCompletedAt,
    completedScenarioIds: scenarioAttempts.map(s => s.scenarioId),
    scenarioAttemptCount: scenarioAttempts.length,
    completedChallengeCount: challengeProgressCount,
    diagramsCreated: 0, // Will be fetched separately if needed
  };
}

/**
 * Evaluate a single milestone criteria against user activity data
 */
function evaluateCriteria(
  criteria: MilestoneCriteria,
  activity: UserActivityData
): { completed: boolean; currentValue: number; targetValue: number } {
  const { type, threshold } = criteria;
  let currentValue = 0;

  switch (type) {
    case "challenges_completed":
      currentValue = activity.completedChallengeCount;
      break;
    
    case "scenarios_completed":
      currentValue = activity.scenariosCompleted;
      break;
    
    case "flashcard_mastery":
      currentValue = activity.flashcardAccuracy;
      break;
    
    case "flashcard_cards_mastered":
      currentValue = activity.totalCardsMastered;
      break;
    
    case "exam_score":
      currentValue = activity.bestExamScore ?? 0;
      break;
    
    case "exam_passed":
      currentValue = activity.examsPassed;
      break;
    
    case "quiz_score":
      currentValue = activity.bestQuizScore ?? 0;
      break;
    
    case "quiz_passed":
      currentValue = activity.quizzesPassed;
      break;
    
    case "total_points":
      currentValue = activity.totalPoints;
      break;
    
    case "current_streak":
      currentValue = activity.currentStreak;
      break;
    
    case "total_time_minutes":
      currentValue = activity.totalTimeMinutes;
      break;
    
    default:
      currentValue = 0;
  }

  return {
    completed: currentValue >= threshold,
    currentValue,
    targetValue: threshold,
  };
}

/**
 * Evaluate all milestones for a study plan against real user activity
 */
export async function evaluateMilestones(
  profileId: string,
  milestones: MilestoneDefinition[],
  manuallyCompleted: string[] = []
): Promise<EvaluatedMilestone[]> {
  // Fetch real activity data from database
  const activity = await fetchUserActivityData(profileId);

  return milestones.map((milestone) => {
    // Check if manually marked complete (legacy support)
    const isManuallyCompleted = manuallyCompleted.includes(milestone.label) || 
                                 manuallyCompleted.includes(milestone.id);

    // Evaluate against real data
    const evaluation = evaluateCriteria(milestone.criteria, activity);

    // Determine completion status
    const completed = evaluation.completed || isManuallyCompleted;
    const autoDetected = evaluation.completed && !isManuallyCompleted;

    return {
      id: milestone.id,
      label: milestone.label,
      weekNumber: milestone.weekNumber,
      metric: milestone.metric,
      completed,
      autoDetected,
      currentValue: evaluation.currentValue,
      targetValue: evaluation.targetValue,
    };
  });
}

/**
 * Generate default milestone definitions based on study plan parameters
 */
export function generateMilestoneDefinitions(
  weeks: number,
  certCode?: string,
  passingScore: number = 75
): MilestoneDefinition[] {
  const milestones: MilestoneDefinition[] = [];

  // Milestone 1: Complete hands-on challenges (around week 2-3)
  milestones.push({
    id: `milestone-challenges-${weeks}`,
    label: "Complete hands-on challenges and architecture drawings",
    weekNumber: Math.ceil(weeks / 3),
    metric: "Build 3+ working solutions",
    criteria: {
      type: "challenges_completed",
      threshold: 3,
    },
  });

  // Milestone 2: Master flashcards (around mid-point)
  milestones.push({
    id: `milestone-flashcards-${weeks}`,
    label: "Master core AWS concepts through flashcards and notes",
    weekNumber: Math.ceil(weeks / 2),
    metric: "Master 30+ flashcards",
    criteria: {
      type: "flashcard_cards_mastered",
      threshold: 30,
    },
  });

  // Milestone 3: Pass practice exam (final week)
  milestones.push({
    id: `milestone-exam-${weeks}`,
    label: "Pass practice exam with confidence",
    weekNumber: weeks,
    metric: `Score ${passingScore}%+ on practice exam`,
    criteria: {
      type: "exam_score",
      threshold: passingScore,
      certCode,
    },
  });

  return milestones;
}

/**
 * Evaluate actions based on their type against real user activity
 */
export async function evaluateActions(
  profileId: string,
  actions: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    target?: string;
    link?: string;
  }>,
  manuallyCompleted: string[] = []
): Promise<EvaluatedAction[]> {
  // Fetch real activity data from database
  const activity = await fetchUserActivityData(profileId);

  return actions.map((action) => {
    // Check if manually marked complete (legacy support)
    const isManuallyCompleted = manuallyCompleted.includes(action.id);

    // Evaluate based on action type
    const evaluation = evaluateActionType(action.type, action.target, activity);

    // Determine completion status - auto OR manual
    const completed = evaluation.completed || isManuallyCompleted;
    const autoDetected = evaluation.completed && !isManuallyCompleted;

    return {
      id: action.id,
      type: action.type,
      title: action.title,
      description: action.description,
      target: action.target,
      link: action.link,
      completed,
      autoDetected,
      currentValue: evaluation.currentValue,
      targetValue: evaluation.targetValue,
    };
  });
}

/**
 * Evaluate a single action type against user activity data
 */
function evaluateActionType(
  actionType: string,
  target: string | undefined,
  activity: UserActivityData
): { completed: boolean; currentValue: number; targetValue: number } {
  // Parse target to extract threshold if present (e.g., "Complete 3 scenarios")
  const targetMatch = target?.match(/(\d+)/);
  const threshold = targetMatch ? parseInt(targetMatch[1]) : 1;

  let currentValue = 0;
  let targetValue = threshold;

  switch (actionType) {
    case "world_challenge":
    case "scenario":
      // World Map Challenge - check scenarios completed
      currentValue = activity.scenarioAttemptCount;
      targetValue = threshold || 3;
      break;

    case "flashcard":
    case "flashcards":
      // Flashcard Review - NEVER auto-complete
      // Flashcards require manual review and user confirmation
      // Users must manually check off when they've completed their flashcard study
      return { completed: false, currentValue: 0, targetValue: 1 };

    case "practice_exam":
    case "exam":
      // Practice Exam - check if user has completed an exam
      currentValue = activity.examAttemptCount;
      targetValue = 1;
      break;

    case "quiz":
      // Quiz - check if user has completed quizzes
      currentValue = activity.quizAttemptCount;
      targetValue = threshold || 1;
      break;

    case "architecture":
    case "diagram":
    case "drawing":
      // Architecture Drawing - check diagrams created
      currentValue = activity.diagramsCreated;
      targetValue = threshold || 2;
      break;

    case "cli_challenge":
    case "cli":
      // CLI Challenge - check challenges completed
      currentValue = activity.completedChallengeCount;
      targetValue = threshold || 1;
      break;

    case "notes":
    case "study_notes":
      // Study Notes - for now, require manual completion
      return { completed: false, currentValue: 0, targetValue: 1 };

    case "game":
    case "learning_game":
      // Learning Games - for now, require manual completion
      return { completed: false, currentValue: 0, targetValue: 1 };

    default:
      // Unknown type - don't auto-complete
      return { completed: false, currentValue: 0, targetValue: 1 };
  }

  return {
    completed: currentValue >= targetValue,
    currentValue,
    targetValue,
  };
}

/**
 * Parse legacy milestones (without criteria) and add default criteria
 */
export function parseLegacyMilestones(
  legacyMilestones: Array<{
    label: string;
    week_number?: number;
    weekNumber?: number;
    metric?: string;
  }>,
  weeks: number = 6
): MilestoneDefinition[] {
  return legacyMilestones.map((m, index) => {
    const label = m.label.toLowerCase();
    const weekNumber = m.week_number ?? m.weekNumber ?? Math.ceil((index + 1) * weeks / legacyMilestones.length);
    
    // Infer criteria from label/metric text
    let criteria: MilestoneCriteria;
    
    if (label.includes("challenge") || label.includes("hands-on") || label.includes("architecture") || label.includes("drawing")) {
      criteria = { type: "challenges_completed", threshold: 3 };
    } else if (label.includes("flashcard") || label.includes("concept") || label.includes("master")) {
      criteria = { type: "flashcard_cards_mastered", threshold: 30 };
    } else if (label.includes("exam") || label.includes("practice")) {
      // Extract score from metric if present
      const scoreMatch = m.metric?.match(/(\d+)%/);
      const threshold = scoreMatch ? parseInt(scoreMatch[1]) : 75;
      criteria = { type: "exam_score", threshold };
    } else if (label.includes("quiz")) {
      criteria = { type: "quiz_passed", threshold: 1 };
    } else if (label.includes("streak")) {
      criteria = { type: "current_streak", threshold: 7 };
    } else if (label.includes("point")) {
      criteria = { type: "total_points", threshold: 1000 };
    } else {
      // Default: challenges completed
      criteria = { type: "challenges_completed", threshold: 3 };
    }

    return {
      id: `milestone-${index}-${weekNumber}`,
      label: m.label,
      weekNumber,
      metric: m.metric || "Complete milestone",
      criteria,
    };
  });
}
