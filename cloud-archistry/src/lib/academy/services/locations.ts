/**
 * Academy Location Service
 * Handles locations, scenarios, and progress tracking
 */

import prisma from "@/lib/db";
import type {
  Location,
  Scenario,
  Challenge,
  LocationProgress,
  DifficultyLevel,
  UnlockRequirement,
  CompanyInfo,
} from "../types";

/**
 * Get all active locations
 */
export async function getAllLocations(): Promise<Location[]> {
  const locations = await prisma.academyLocation.findMany({
    where: { isActive: true },
    orderBy: [{ region: "asc" }, { company: "asc" }],
  });

  return locations.map(transformLocation);
}

/**
 * Get locations by region
 */
export async function getLocationsByRegion(region: string): Promise<Location[]> {
  const locations = await prisma.academyLocation.findMany({
    where: { region, isActive: true },
    orderBy: { company: "asc" },
  });

  return locations.map(transformLocation);
}

/**
 * Get locations by industry
 */
export async function getLocationsByIndustry(industry: string): Promise<Location[]> {
  const locations = await prisma.academyLocation.findMany({
    where: { industry, isActive: true },
    orderBy: { company: "asc" },
  });

  return locations.map(transformLocation);
}

/**
 * Get a single location by slug
 */
export async function getLocationBySlug(slug: string): Promise<Location | null> {
  const location = await prisma.academyLocation.findUnique({
    where: { slug },
  });

  return location ? transformLocation(location) : null;
}

/**
 * Get a single location by ID
 */
export async function getLocationById(id: string): Promise<Location | null> {
  const location = await prisma.academyLocation.findUnique({
    where: { id },
  });

  return location ? transformLocation(location) : null;
}

/**
 * Check if a location is unlocked for a user
 */
export async function isLocationUnlocked(
  locationId: string,
  profileId: string
): Promise<{ unlocked: boolean; requirements?: UnlockRequirement[]; progress?: Record<string, number> }> {
  const location = await prisma.academyLocation.findUnique({
    where: { id: locationId },
  });

  if (!location) {
    return { unlocked: false };
  }

  if (!location.isLocked) {
    return { unlocked: true };
  }

  const requirements = location.unlockRequirements as UnlockRequirement[];
  if (!requirements || requirements.length === 0) {
    return { unlocked: true };
  }

  const progress: Record<string, number> = {};
  let allMet = true;

  for (const req of requirements) {
    switch (req.type) {
      case "locations_completed": {
        const completed = await prisma.userLocationProgress.count({
          where: { profileId, status: "completed" },
        });
        progress["locations_completed"] = completed;
        if (completed < (req.count || 0)) allMet = false;
        break;
      }
      case "challenges_completed": {
        const profile = await prisma.academyUserProfile.findUnique({
          where: { id: profileId },
          select: { challengesCompleted: true },
        });
        progress["challenges_completed"] = profile?.challengesCompleted || 0;
        if ((profile?.challengesCompleted || 0) < (req.count || 0)) allMet = false;
        break;
      }
      case "location": {
        if (req.id) {
          const locProgress = await prisma.userLocationProgress.findUnique({
            where: { profileId_locationId: { profileId, locationId: req.id } },
          });
          const completed = locProgress?.status === "completed";
          progress[`location_${req.id}`] = completed ? 1 : 0;
          if (!completed) allMet = false;
        }
        break;
      }
      case "points": {
        const profile = await prisma.academyUserProfile.findUnique({
          where: { id: profileId },
          select: { totalPoints: true },
        });
        progress["points"] = profile?.totalPoints || 0;
        if ((profile?.totalPoints || 0) < (req.value || 0)) allMet = false;
        break;
      }
    }
  }

  return { unlocked: allMet, requirements, progress };
}

/**
 * Get user's progress on a location
 */
export async function getLocationProgress(
  profileId: string,
  locationId: string
): Promise<LocationProgress | null> {
  const progress = await prisma.userLocationProgress.findUnique({
    where: { profileId_locationId: { profileId, locationId } },
  });

  return progress ? transformLocationProgress(progress) : null;
}

/**
 * Get all location progress for a user
 */
export async function getAllLocationProgress(
  profileId: string
): Promise<LocationProgress[]> {
  const progress = await prisma.userLocationProgress.findMany({
    where: { profileId },
  });

  return progress.map(transformLocationProgress);
}

/**
 * Visit a location (create or update progress)
 */
export async function visitLocation(
  profileId: string,
  locationId: string
): Promise<LocationProgress> {
  const existing = await prisma.userLocationProgress.findUnique({
    where: { profileId_locationId: { profileId, locationId } },
  });

  if (existing) {
    const updated = await prisma.userLocationProgress.update({
      where: { id: existing.id },
      data: {
        lastVisitedAt: new Date(),
        status: existing.status === "not_started" ? "visited" : existing.status,
      },
    });
    return transformLocationProgress(updated);
  }

  // First visit - increment user's locations visited
  await prisma.academyUserProfile.update({
    where: { id: profileId },
    data: { locationsVisited: { increment: 1 } },
  });

  // Increment location's total attempts
  await prisma.academyLocation.update({
    where: { id: locationId },
    data: { totalAttempts: { increment: 1 } },
  });

  const created = await prisma.userLocationProgress.create({
    data: {
      profileId,
      locationId,
      status: "visited",
    },
  });

  return transformLocationProgress(created);
}

// ============================================
// Scenario Functions
// ============================================

/**
 * Get scenarios for a location
 */
export async function getLocationScenarios(
  locationId: string,
  targetLevel?: DifficultyLevel
): Promise<Scenario[]> {
  const scenarios = await prisma.academyScenario.findMany({
    where: {
      locationId,
      isActive: true,
      ...(targetLevel && { targetLevel }),
    },
    include: {
      challenges: {
        orderBy: { orderIndex: "asc" },
      },
    },
    orderBy: { version: "desc" },
  });

  return scenarios.map(transformScenario);
}

/**
 * Get a scenario by ID
 */
export async function getScenarioById(id: string): Promise<Scenario | null> {
  const scenario = await prisma.academyScenario.findUnique({
    where: { id },
    include: {
      challenges: {
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  return scenario ? transformScenario(scenario) : null;
}

/**
 * Get or create a scenario for a location (from Learning Agent)
 */
export async function getOrCreateScenario(
  locationId: string,
  targetLevel: DifficultyLevel,
  generatedScenario: {
    title: string;
    description: string;
    businessContext: string;
    difficulty: string;
    technicalRequirements: string[];
    complianceRequirements: string[];
    constraints: string[];
    learningObjectives: string[];
    tags: string[];
    estimatedMinutes: number;
    challenges: Array<{
      title: string;
      description: string;
      difficulty: string;
      points: number;
      hints: string[];
      successCriteria: string[];
      awsServices: string[];
      estimatedMinutes: number;
    }>;
    companyInfo?: CompanyInfo;
  }
): Promise<Scenario> {
  // Check for existing scenario at this level
  const existing = await prisma.academyScenario.findFirst({
    where: {
      locationId,
      targetLevel,
      isActive: true,
    },
    include: { challenges: { orderBy: { orderIndex: "asc" } } },
    orderBy: { version: "desc" },
  });

  if (existing) {
    return transformScenario(existing);
  }

  // Calculate max points
  const maxPoints = generatedScenario.challenges.reduce(
    (sum, c) => sum + c.points,
    0
  );

  // Create new scenario with challenges
  const scenario = await prisma.academyScenario.create({
    data: {
      locationId,
      title: generatedScenario.title,
      description: generatedScenario.description,
      businessContext: generatedScenario.businessContext,
      difficulty: generatedScenario.difficulty,
      technicalRequirements: generatedScenario.technicalRequirements,
      complianceRequirements: generatedScenario.complianceRequirements,
      constraints: generatedScenario.constraints,
      learningObjectives: generatedScenario.learningObjectives,
      tags: generatedScenario.tags,
      estimatedMinutes: generatedScenario.estimatedMinutes,
      maxPoints,
      targetLevel,
      companyInfo: generatedScenario.companyInfo || null,
      generatedBy: "learning_agent_v1",
      challenges: {
        create: generatedScenario.challenges.map((c, index) => ({
          title: c.title,
          description: c.description,
          difficulty: c.difficulty,
          orderIndex: index,
          points: c.points,
          hints: c.hints,
          successCriteria: c.successCriteria,
          awsServices: c.awsServices,
          estimatedMinutes: c.estimatedMinutes,
        })),
      },
    },
    include: {
      challenges: { orderBy: { orderIndex: "asc" } },
    },
  });

  return transformScenario(scenario);
}

// ============================================
// Transform Functions
// ============================================

function transformLocation(loc: {
  id: string;
  slug: string;
  name: string;
  company: string;
  industry: string;
  lat: number;
  lng: number;
  region: string | null;
  country: string | null;
  city: string | null;
  icon: string;
  imageUrl: string | null;
  difficulty: string;
  description: string;
  compliance: unknown;
  tags: unknown;
  isLocked: boolean;
  unlockRequirements: unknown;
  totalAttempts: number;
  avgCompletionRate: number;
  isActive: boolean;
}): Location {
  return {
    id: loc.id,
    slug: loc.slug,
    name: loc.name,
    company: loc.company,
    industry: loc.industry,
    lat: loc.lat,
    lng: loc.lng,
    region: loc.region ?? undefined,
    country: loc.country ?? undefined,
    city: loc.city ?? undefined,
    icon: loc.icon,
    imageUrl: loc.imageUrl ?? undefined,
    difficulty: loc.difficulty as DifficultyLevel,
    description: loc.description,
    compliance: (loc.compliance as string[]) || [],
    tags: (loc.tags as string[]) || [],
    isLocked: loc.isLocked,
    unlockRequirements: (loc.unlockRequirements as UnlockRequirement[]) || [],
    totalAttempts: loc.totalAttempts,
    avgCompletionRate: loc.avgCompletionRate,
    isActive: loc.isActive,
  };
}

function transformLocationProgress(progress: {
  id: string;
  profileId: string;
  locationId: string;
  status: string;
  firstVisitedAt: Date;
  lastVisitedAt: Date;
  completedAt: Date | null;
  totalPoints: number;
  challengesCompleted: number;
  totalChallenges: number;
  timeSpentMinutes: number;
  bestAttemptId: string | null;
}): LocationProgress {
  return {
    id: progress.id,
    profileId: progress.profileId,
    locationId: progress.locationId,
    status: progress.status as LocationProgress["status"],
    firstVisitedAt: progress.firstVisitedAt,
    lastVisitedAt: progress.lastVisitedAt,
    completedAt: progress.completedAt ?? undefined,
    totalPoints: progress.totalPoints,
    challengesCompleted: progress.challengesCompleted,
    totalChallenges: progress.totalChallenges,
    timeSpentMinutes: progress.timeSpentMinutes,
    bestAttemptId: progress.bestAttemptId ?? undefined,
  };
}

function transformScenario(scenario: {
  id: string;
  locationId: string;
  title: string;
  description: string;
  businessContext: string;
  difficulty: string;
  technicalRequirements: unknown;
  complianceRequirements: unknown;
  constraints: unknown;
  learningObjectives: unknown;
  tags: unknown;
  estimatedMinutes: number;
  maxPoints: number;
  version: number;
  targetLevel: string;
  companyInfo: unknown;
  isActive: boolean;
  challenges: Array<{
    id: string;
    scenarioId: string;
    title: string;
    description: string;
    difficulty: string;
    orderIndex: number;
    points: number;
    bonusPoints: number;
    hints: unknown;
    successCriteria: unknown;
    awsServices: unknown;
    solutionTemplate: unknown;
    evaluationRubric: unknown;
    estimatedMinutes: number;
    timeLimitMinutes: number | null;
    prerequisiteChallengeIds: unknown;
  }>;
}): Scenario {
  return {
    id: scenario.id,
    locationId: scenario.locationId,
    title: scenario.title,
    description: scenario.description,
    businessContext: scenario.businessContext,
    difficulty: scenario.difficulty as DifficultyLevel,
    technicalRequirements: (scenario.technicalRequirements as string[]) || [],
    complianceRequirements: (scenario.complianceRequirements as string[]) || [],
    constraints: (scenario.constraints as string[]) || [],
    learningObjectives: (scenario.learningObjectives as string[]) || [],
    tags: (scenario.tags as string[]) || [],
    estimatedMinutes: scenario.estimatedMinutes,
    maxPoints: scenario.maxPoints,
    version: scenario.version,
    targetLevel: scenario.targetLevel as DifficultyLevel,
    companyInfo: scenario.companyInfo as CompanyInfo | undefined,
    isActive: scenario.isActive,
    challenges: scenario.challenges.map(transformChallenge),
  };
}

function transformChallenge(challenge: {
  id: string;
  scenarioId: string;
  title: string;
  description: string;
  difficulty: string;
  orderIndex: number;
  points: number;
  bonusPoints: number;
  hints: unknown;
  successCriteria: unknown;
  awsServices: unknown;
  solutionTemplate: unknown;
  evaluationRubric: unknown;
  estimatedMinutes: number;
  timeLimitMinutes: number | null;
  prerequisiteChallengeIds: unknown;
}): Challenge {
  return {
    id: challenge.id,
    scenarioId: challenge.scenarioId,
    title: challenge.title,
    description: challenge.description,
    difficulty: challenge.difficulty as DifficultyLevel,
    orderIndex: challenge.orderIndex,
    points: challenge.points,
    bonusPoints: challenge.bonusPoints,
    hints: (challenge.hints as string[]) || [],
    successCriteria: (challenge.successCriteria as string[]) || [],
    awsServices: (challenge.awsServices as string[]) || [],
    solutionTemplate: challenge.solutionTemplate as Challenge["solutionTemplate"],
    evaluationRubric: challenge.evaluationRubric as Challenge["evaluationRubric"],
    estimatedMinutes: challenge.estimatedMinutes,
    timeLimitMinutes: challenge.timeLimitMinutes ?? undefined,
    prerequisiteChallengeIds: (challenge.prerequisiteChallengeIds as string[]) || [],
  };
}
