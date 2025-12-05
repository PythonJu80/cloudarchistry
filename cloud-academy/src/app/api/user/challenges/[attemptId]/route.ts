import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * DELETE /api/user/challenges/[attemptId]
 * 
 * Deletes a scenario attempt and ALL related data:
 * - ChallengeProgress records (includes saved questions, answers, points)
 * - ScenarioAttempt record
 * - Optionally: AcademyScenario and AcademyChallenge if no other attempts reference them
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in" },
        { status: 401 }
      );
    }

    const { attemptId } = await params;

    if (!attemptId) {
      return NextResponse.json(
        { error: "Missing attemptId" },
        { status: 400 }
      );
    }

    // Find the attempt and verify ownership
    const attempt = await prisma.scenarioAttempt.findFirst({
      where: {
        id: attemptId,
        profileId: session.user.academyProfileId,
      },
      include: {
        challengeProgress: true,
        scenario: {
          include: {
            challenges: true,
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Challenge not found or you don't have permission to delete it" },
        { status: 404 }
      );
    }

    const scenarioId = attempt.scenarioId;

    // Use a transaction to delete everything atomically
    await prisma.$transaction(async (tx) => {
      // 1. Delete all ChallengeProgress records for this attempt
      // This includes: saved questions, answers, points, hints used, etc.
      await tx.challengeProgress.deleteMany({
        where: {
          attemptId: attemptId,
        },
      });

      // 2. Delete the ScenarioAttempt record
      await tx.scenarioAttempt.delete({
        where: {
          id: attemptId,
        },
      });

      // 3. Check if any other attempts reference this scenario
      const otherAttempts = await tx.scenarioAttempt.count({
        where: {
          scenarioId: scenarioId,
        },
      });

      // 4. If no other attempts, delete the scenario and its challenges
      if (otherAttempts === 0) {
        // Delete all challenges for this scenario
        await tx.academyChallenge.deleteMany({
          where: {
            scenarioId: scenarioId,
          },
        });

        // Delete the scenario itself
        await tx.academyScenario.delete({
          where: {
            id: scenarioId,
          },
        });

        // Note: AcademyLocation is NOT deleted as it may be used by other scenarios
        // or be a system location
      }
    });

    return NextResponse.json({
      success: true,
      message: "Challenge and all related data deleted successfully",
      deleted: {
        attemptId,
        scenarioId: attempt.scenario.id,
        challengeProgressCount: attempt.challengeProgress.length,
        scenarioDeleted: true, // Will be true if no other attempts referenced it
      },
    });

  } catch (error) {
    console.error("Delete challenge error:", error);
    return NextResponse.json(
      { error: "Failed to delete challenge" },
      { status: 500 }
    );
  }
}
