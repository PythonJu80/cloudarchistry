/**
 * Study Guide Data Service
 * =========================
 * Gathers REAL data from the database for study guide generation.
 * The tool does the thinking - queries real content, calculates recommendations.
 * The AI just formats what we give it.
 */

import { prisma } from "@/lib/db";

// Types for the data we gather
export interface AvailableChallenge {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  points: number;
  estimatedMinutes: number;
  awsServices: string[];
  scenarioTitle: string;
  locationName: string;
  completed: boolean;
  userScore?: number;
}

export interface AvailableExam {
  id: string;
  slug: string;
  title: string;
  shortTitle: string | null;
  certificationCode: string;
  questionCount: number;
  timeLimit: number;
  passingScore: number;
  difficulty: string;
  userAttempts: number;
  userBestScore: number | null;
  userPassed: boolean;
}

export interface AvailableFlashcardDeck {
  id: string;
  title: string;
  description: string | null;
  totalCards: number;
  scenarioTitle: string;
  userProgress: {
    cardsMastered: number;
    totalReviews: number;
    lastReviewedAt: Date | null;
  } | null;
}

export interface AvailableQuiz {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
  scenarioTitle: string;
  userAttempts: number;
  userBestScore: number | null;
}

export interface GameMode {
  slug: string;
  name: string;
  description: string;
  link: string;
  isLive: boolean;
}

export interface UserProgress {
  challengesCompleted: number;
  totalChallenges: number;
  examsAttempted: number;
  examsPassed: number;
  flashcardDecksStarted: number;
  flashcardsMastered: number;
  quizzesCompleted: number;
  currentStreak: number;
  totalPoints: number;
  weakDomains: string[];
  strongDomains: string[];
}

export interface StudyGuideData {
  // User context
  profileId: string;
  skillLevel: string;
  targetCertification: string;
  
  // Real content available
  challenges: AvailableChallenge[];
  exams: AvailableExam[];
  flashcardDecks: AvailableFlashcardDeck[];
  quizzes: AvailableQuiz[];
  games: GameMode[];
  
  // User's actual progress
  progress: UserProgress;
  
  // Pre-computed recommendations (the tool decides, not the AI)
  recommendations: {
    priorityChallenges: AvailableChallenge[];
    nextExam: AvailableExam | null;
    flashcardDecksToReview: AvailableFlashcardDeck[];
    quizzesToTry: AvailableQuiz[];
    suggestedGames: GameMode[];
    focusAreas: string[];
  };
}

// Static game modes - these don't change
const GAME_MODES: GameMode[] = [
  { slug: "sniper-quiz", name: "Sniper Quiz", description: "High-stakes single-shot questions - one wrong and you're out", link: "/game/modes/sniper-quiz", isLive: true },
  { slug: "lightning-round", name: "Lightning Round", description: "60 seconds to answer as many questions as possible", link: "/game", isLive: true },
  { slug: "hot-streak", name: "Hot Streak", description: "Build multiplier streaks with consecutive correct answers", link: "/game", isLive: true },
  { slug: "quiz-battle", name: "Quiz Battle", description: "1v1 head-to-head knowledge showdown", link: "/game", isLive: false },
  { slug: "cloud-tycoon", name: "Cloud Tycoon", description: "Build infrastructure and earn virtual money", link: "/game/modes/cloud-tycoon", isLive: true },
];

/**
 * Gather all real data for study guide generation
 */
export async function gatherStudyGuideData(
  profileId: string,
  targetCertification: string
): Promise<StudyGuideData> {
  // Fetch profile
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
    throw new Error("Profile not found");
  }

  // Parallel fetch all content and user progress
  const [
    challenges,
    exams,
    flashcardDecks,
    quizzes,
    userChallengeProgress,
    userExamAttempts,
    userFlashcardProgress,
    userQuizAttempts,
  ] = await Promise.all([
    // All challenges (filter by cert relevance later)
    fetchChallenges(targetCertification),
    // Exams for this certification
    fetchExams(targetCertification),
    // Flashcard decks
    fetchFlashcardDecks(targetCertification),
    // Quizzes
    fetchQuizzes(targetCertification),
    // User's challenge progress
    fetchUserChallengeProgress(profileId),
    // User's exam attempts
    fetchUserExamAttempts(profileId),
    // User's flashcard progress
    fetchUserFlashcardProgress(profileId),
    // User's quiz attempts
    fetchUserQuizAttempts(profileId),
  ]);

  // Merge user progress into content
  const challengesWithProgress = mergeChallengeProgress(challenges, userChallengeProgress);
  const examsWithProgress = mergeExamProgress(exams, userExamAttempts);
  const flashcardsWithProgress = mergeFlashcardProgress(flashcardDecks, userFlashcardProgress);
  const quizzesWithProgress = mergeQuizProgress(quizzes, userQuizAttempts);

  // Calculate user progress summary
  const progress = calculateUserProgress(
    challengesWithProgress,
    examsWithProgress,
    flashcardsWithProgress,
    quizzesWithProgress,
    profile
  );

  // Generate recommendations (THE TOOL DECIDES, NOT THE AI)
  const recommendations = generateRecommendations(
    challengesWithProgress,
    examsWithProgress,
    flashcardsWithProgress,
    quizzesWithProgress,
    progress,
    profile.skillLevel
  );

  return {
    profileId,
    skillLevel: profile.skillLevel,
    targetCertification,
    challenges: challengesWithProgress,
    exams: examsWithProgress,
    flashcardDecks: flashcardsWithProgress,
    quizzes: quizzesWithProgress,
    games: GAME_MODES.filter(g => g.isLive),
    progress,
    recommendations,
  };
}

// ============================================
// Data Fetching Functions
// ============================================

async function fetchChallenges(certCode: string): Promise<AvailableChallenge[]> {
  // Filter by user's targetCertification via scenario.tags JSON array
  const challenges = await prisma.academyChallenge.findMany({
    where: {
      scenario: {
        isActive: true,
        tags: {
          array_contains: [certCode],
        },
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      difficulty: true,
      points: true,
      estimatedMinutes: true,
      awsServices: true,
      scenario: {
        select: {
          title: true,
          location: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { orderIndex: "asc" },
    take: 50, // Limit for performance
  });

  return challenges.map(c => ({
    id: c.id,
    title: c.title,
    description: c.description,
    difficulty: c.difficulty,
    points: c.points,
    estimatedMinutes: c.estimatedMinutes,
    awsServices: (c.awsServices as string[]) || [],
    scenarioTitle: c.scenario.title,
    locationName: c.scenario.location?.name || "Unknown",
    completed: false,
    userScore: undefined,
  }));
}

async function fetchExams(certCode: string): Promise<AvailableExam[]> {
  // Map short codes to full certification codes
  const certCodeMap: Record<string, string> = {
    "SAA": "SAA-C03",
    "solutions-architect-associate": "SAA-C03",
    "SAP": "SAP-C02",
    "solutions-architect-professional": "SAP-C02",
    "DVA": "DVA-C02",
    "developer-associate": "DVA-C02",
    "SOA": "SOA-C02",
    "sysops-administrator-associate": "SOA-C02",
    "DOP": "DOP-C02",
    "devops-engineer-professional": "DOP-C02",
    "CLF": "CLF-C02",
    "cloud-practitioner": "CLF-C02",
    "MLA": "MLA-C01",
    "machine-learning-associate": "MLA-C01",
    "DEA": "DEA-C01",
    "data-engineer-associate": "DEA-C01",
    "AIF": "AIF-C01",
    "ai-practitioner": "AIF-C01",
  };
  
  const normalizedCode = certCodeMap[certCode] || certCode;
  
  const exams = await prisma.practiceExam.findMany({
    where: {
      isActive: true,
      certificationCode: normalizedCode,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      shortTitle: true,
      certificationCode: true,
      questionCount: true,
      timeLimit: true,
      passingScore: true,
      difficulty: true,
    },
    orderBy: { title: "asc" },
  });

  return exams.map(e => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    shortTitle: e.shortTitle,
    certificationCode: e.certificationCode,
    questionCount: e.questionCount,
    timeLimit: e.timeLimit,
    passingScore: e.passingScore,
    difficulty: e.difficulty,
    userAttempts: 0,
    userBestScore: null,
    userPassed: false,
  }));
}

async function fetchFlashcardDecks(certCode: string): Promise<AvailableFlashcardDeck[]> {
  // Filter by user's targetCertification via scenario.tags
  const decks = await prisma.flashcardDeck.findMany({
    where: {
      isActive: true,
      scenario: {
        tags: {
          array_contains: [certCode],
        },
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      totalCards: true,
      scenario: {
        select: { title: true },
      },
    },
    orderBy: { title: "asc" },
    take: 30,
  });

  return decks.map(d => ({
    id: d.id,
    title: d.title,
    description: d.description,
    totalCards: d.totalCards,
    scenarioTitle: d.scenario.title,
    userProgress: null,
  }));
}

async function fetchQuizzes(certCode: string): Promise<AvailableQuiz[]> {
  // Filter by user's targetCertification via scenario.tags
  const quizzes = await prisma.quiz.findMany({
    where: {
      isActive: true,
      scenario: {
        tags: {
          array_contains: [certCode],
        },
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      _count: {
        select: { questions: true },
      },
      scenario: {
        select: { title: true },
      },
    },
    orderBy: { title: "asc" },
    take: 30,
  });

  return quizzes.map(q => ({
    id: q.id,
    title: q.title,
    description: q.description,
    questionCount: q._count.questions,
    scenarioTitle: q.scenario.title,
    userAttempts: 0,
    userBestScore: null,
  }));
}

async function fetchUserChallengeProgress(profileId: string) {
  return prisma.challengeProgress.findMany({
    where: {
      attempt: { profileId },
      status: "completed",
    },
    select: {
      challengeId: true,
      pointsEarned: true,
      completedAt: true,
    },
  });
}

async function fetchUserExamAttempts(profileId: string) {
  return prisma.examAttempt.findMany({
    where: { profileId },
    select: {
      examId: true,
      score: true,
      passed: true,
      domainScores: true,
    },
  });
}

async function fetchUserFlashcardProgress(profileId: string) {
  return prisma.flashcardUserProgress.findMany({
    where: { profileId },
    select: {
      deckId: true,
      cardsMastered: true,
      totalReviews: true,
      lastStudiedAt: true,
    },
  });
}

async function fetchUserQuizAttempts(profileId: string) {
  return prisma.quizAttempt.findMany({
    where: { profileId },
    select: {
      quizId: true,
      score: true,
    },
  });
}

// ============================================
// Progress Merging Functions
// ============================================

function mergeChallengeProgress(
  challenges: AvailableChallenge[],
  progress: { challengeId: string; pointsEarned: number }[]
): AvailableChallenge[] {
  const progressMap = new Map(progress.map(p => [p.challengeId, p]));
  
  return challenges.map(c => {
    const p = progressMap.get(c.id);
    return {
      ...c,
      completed: !!p,
      userScore: p?.pointsEarned ?? undefined,
    };
  });
}

function mergeExamProgress(
  exams: AvailableExam[],
  attempts: { examId: string; score: number; passed: boolean }[]
): AvailableExam[] {
  const attemptsByExam = new Map<string, { count: number; bestScore: number; passed: boolean }>();
  
  for (const a of attempts) {
    const existing = attemptsByExam.get(a.examId);
    if (existing) {
      existing.count++;
      existing.bestScore = Math.max(existing.bestScore, a.score);
      existing.passed = existing.passed || a.passed;
    } else {
      attemptsByExam.set(a.examId, { count: 1, bestScore: a.score, passed: a.passed });
    }
  }
  
  return exams.map(e => {
    const stats = attemptsByExam.get(e.id);
    return {
      ...e,
      userAttempts: stats?.count ?? 0,
      userBestScore: stats?.bestScore ?? null,
      userPassed: stats?.passed ?? false,
    };
  });
}

function mergeFlashcardProgress(
  decks: AvailableFlashcardDeck[],
  progress: { deckId: string; cardsMastered: number; totalReviews: number; lastStudiedAt: Date | null }[]
): AvailableFlashcardDeck[] {
  const progressMap = new Map(progress.map(p => [p.deckId, p]));
  
  return decks.map(d => {
    const p = progressMap.get(d.id);
    return {
      ...d,
      userProgress: p ? {
        cardsMastered: p.cardsMastered,
        totalReviews: p.totalReviews,
        lastReviewedAt: p.lastStudiedAt,
      } : null,
    };
  });
}

function mergeQuizProgress(
  quizzes: AvailableQuiz[],
  attempts: { quizId: string; score: number }[]
): AvailableQuiz[] {
  const attemptsByQuiz = new Map<string, { count: number; bestScore: number }>();
  
  for (const a of attempts) {
    const existing = attemptsByQuiz.get(a.quizId);
    if (existing) {
      existing.count++;
      existing.bestScore = Math.max(existing.bestScore, a.score);
    } else {
      attemptsByQuiz.set(a.quizId, { count: 1, bestScore: a.score });
    }
  }
  
  return quizzes.map(q => {
    const stats = attemptsByQuiz.get(q.id);
    return {
      ...q,
      userAttempts: stats?.count ?? 0,
      userBestScore: stats?.bestScore ?? null,
    };
  });
}

// ============================================
// Progress Calculation
// ============================================

function calculateUserProgress(
  challenges: AvailableChallenge[],
  exams: AvailableExam[],
  flashcards: AvailableFlashcardDeck[],
  quizzes: AvailableQuiz[],
  profile: { challengesCompleted: number; totalPoints: number; currentStreak: number }
): UserProgress {
  const completedChallenges = challenges.filter(c => c.completed).length;
  const passedExams = exams.filter(e => e.userPassed).length;
  const attemptedExams = exams.filter(e => e.userAttempts > 0).length;
  const startedDecks = flashcards.filter(f => f.userProgress !== null).length;
  const masteredCards = flashcards.reduce((sum, f) => sum + (f.userProgress?.cardsMastered ?? 0), 0);
  const completedQuizzes = quizzes.filter(q => q.userAttempts > 0).length;

  // TODO: Calculate weak/strong domains from exam domainScores
  // For now, return empty arrays
  const weakDomains: string[] = [];
  const strongDomains: string[] = [];

  return {
    challengesCompleted: completedChallenges,
    totalChallenges: challenges.length,
    examsAttempted: attemptedExams,
    examsPassed: passedExams,
    flashcardDecksStarted: startedDecks,
    flashcardsMastered: masteredCards,
    quizzesCompleted: completedQuizzes,
    currentStreak: profile.currentStreak,
    totalPoints: profile.totalPoints,
    weakDomains,
    strongDomains,
  };
}

// ============================================
// Recommendation Engine (THE TOOL DECIDES)
// ============================================

function generateRecommendations(
  challenges: AvailableChallenge[],
  exams: AvailableExam[],
  flashcards: AvailableFlashcardDeck[],
  quizzes: AvailableQuiz[],
  progress: UserProgress,
  skillLevel: string
): StudyGuideData["recommendations"] {
  // Priority challenges: incomplete, sorted by difficulty appropriate to skill level
  const incompleteChallenges = challenges.filter(c => !c.completed);
  const priorityChallenges = sortBySkillLevel(incompleteChallenges, skillLevel).slice(0, 5);

  // Next exam: first one not passed, or first one if none attempted
  const unpassedExams = exams.filter(e => !e.userPassed);
  const nextExam = unpassedExams.length > 0 ? unpassedExams[0] : (exams[0] ?? null);

  // Flashcard decks to review: not started or not fully mastered
  const decksToReview = flashcards
    .filter(f => !f.userProgress || f.userProgress.cardsMastered < f.totalCards)
    .slice(0, 3);

  // Quizzes to try: not attempted or low score
  const quizzesToTry = quizzes
    .filter(q => q.userAttempts === 0 || (q.userBestScore !== null && q.userBestScore < 80))
    .slice(0, 3);

  // Suggested games based on skill level
  const suggestedGames = GAME_MODES.filter(g => g.isLive);

  // Focus areas based on progress
  const focusAreas: string[] = [];
  if (progress.challengesCompleted < 3) {
    focusAreas.push("Complete more architecture challenges to build hands-on experience");
  }
  if (progress.examsAttempted === 0) {
    focusAreas.push("Take a practice exam to identify knowledge gaps");
  }
  if (progress.flashcardsMastered < 50) {
    focusAreas.push("Review flashcards daily to reinforce key concepts");
  }

  return {
    priorityChallenges,
    nextExam,
    flashcardDecksToReview: decksToReview,
    quizzesToTry,
    suggestedGames,
    focusAreas,
  };
}

function sortBySkillLevel(challenges: AvailableChallenge[], skillLevel: string): AvailableChallenge[] {
  const difficultyOrder: Record<string, number> = {
    beginner: { easy: 1, medium: 2, hard: 3 },
    intermediate: { easy: 2, medium: 1, hard: 2 },
    advanced: { hard: 1, medium: 2, easy: 3 },
  }[skillLevel] || { easy: 1, medium: 2, hard: 3 };

  return [...challenges].sort((a, b) => {
    const aOrder = difficultyOrder[a.difficulty] ?? 2;
    const bOrder = difficultyOrder[b.difficulty] ?? 2;
    return aOrder - bOrder;
  });
}
