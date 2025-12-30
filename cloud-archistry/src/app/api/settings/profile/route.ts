/**
 * Profile Settings API
 * Manages user profile data like bio, skill level, preferences
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Valid options for dropdowns
const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "expert"];
const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"];
const CERTIFICATION_OPTIONS = [
  // Foundational
  "CLF", // Cloud Practitioner
  "AIF", // AI Practitioner (NEW 2024)
  // Associate
  "SAA", // Solutions Architect Associate
  "DVA", // Developer Associate
  "SOA", // SysOps Administrator Associate
  "DEA", // Data Engineer Associate (NEW 2024)
  "MLA", // Machine Learning Engineer Associate (NEW 2024)
  // Professional
  "SAP", // Solutions Architect Professional
  "DOP", // DevOps Engineer Professional
  // Specialty
  "ANS", // Advanced Networking Specialty
  "SCS", // Security Specialty
  "MLS", // Machine Learning Specialty
  "PAS", // SAP on AWS Specialty
  "DBS", // Database Specialty
];

/**
 * GET /api/settings/profile
 * Get current profile data
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please sign in to view profile" },
        { status: 401 }
      );
    }

    // Use academyProfileId if available, otherwise lookup by user id
    const profile = session.user.academyProfileId
      ? await prisma.academyUserProfile.findUnique({
          where: { id: session.user.academyProfileId },
          select: {
            displayName: true,
            avatarUrl: true,
            bio: true,
            skillLevel: true,
            targetCertification: true,
            preferredDifficulty: true,
            preferredIndustries: true,
            totalPoints: true,
            level: true,
            xp: true,
            currentStreak: true,
            longestStreak: true,
            challengesCompleted: true,
            scenariosCompleted: true,
            locationsVisited: true,
            totalTimeMinutes: true,
            lastActivityDate: true,
          },
        })
      : await prisma.academyUserProfile.findFirst({
          where: { academyUserId: session.user.id },
          select: {
            displayName: true,
            avatarUrl: true,
            bio: true,
            skillLevel: true,
            targetCertification: true,
            preferredDifficulty: true,
            preferredIndustries: true,
            totalPoints: true,
            level: true,
            xp: true,
            currentStreak: true,
            longestStreak: true,
            challengesCompleted: true,
            scenariosCompleted: true,
            locationsVisited: true,
            totalTimeMinutes: true,
            lastActivityDate: true,
          },
        });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...profile,
      skillLevelOptions: SKILL_LEVELS,
      difficultyOptions: DIFFICULTY_OPTIONS,
      certificationOptions: CERTIFICATION_OPTIONS,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      { error: "Failed to get profile", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/profile
 * Update profile data
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please sign in to update profile" },
        { status: 401 }
      );
    }

    // Get profile ID - use session value or lookup by user id
    let profileId = session.user.academyProfileId;
    if (!profileId) {
      const profile = await prisma.academyUserProfile.findFirst({
        where: { academyUserId: session.user.id },
        select: { id: true },
      });
      profileId = profile?.id;
    }

    if (!profileId) {
      return NextResponse.json(
        { error: "Profile not found. Please contact support." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      displayName,
      bio,
      skillLevel,
      targetCertification,
      preferredDifficulty,
      preferredIndustries,
    } = body;

    // Build update data with validation
    const updateData: Record<string, unknown> = {};

    if (displayName !== undefined) {
      if (displayName && displayName.length > 100) {
        return NextResponse.json(
          { error: "Display name must be 100 characters or less" },
          { status: 400 }
        );
      }
      updateData.displayName = displayName || null;
    }

    if (bio !== undefined) {
      if (bio && bio.length > 500) {
        return NextResponse.json(
          { error: "Bio must be 500 characters or less" },
          { status: 400 }
        );
      }
      updateData.bio = bio || null;
    }

    if (skillLevel !== undefined) {
      if (skillLevel && !SKILL_LEVELS.includes(skillLevel)) {
        return NextResponse.json(
          { error: `Invalid skill level. Must be one of: ${SKILL_LEVELS.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.skillLevel = skillLevel || "intermediate";
    }

    if (targetCertification !== undefined) {
      if (targetCertification && !CERTIFICATION_OPTIONS.includes(targetCertification)) {
        return NextResponse.json(
          { error: `Invalid certification. Must be one of: ${CERTIFICATION_OPTIONS.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.targetCertification = targetCertification || null;
    }

    if (preferredDifficulty !== undefined) {
      if (preferredDifficulty && !DIFFICULTY_OPTIONS.includes(preferredDifficulty)) {
        return NextResponse.json(
          { error: `Invalid difficulty. Must be one of: ${DIFFICULTY_OPTIONS.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.preferredDifficulty = preferredDifficulty || null;
    }

    if (preferredIndustries !== undefined) {
      if (!Array.isArray(preferredIndustries)) {
        return NextResponse.json(
          { error: "Preferred industries must be an array" },
          { status: 400 }
        );
      }
      updateData.preferredIndustries = preferredIndustries;
    }

    // Update the profile
    const updatedProfile = await prisma.academyUserProfile.update({
      where: { id: profileId },
      data: updateData,
      select: {
        displayName: true,
        bio: true,
        skillLevel: true,
        targetCertification: true,
        preferredDifficulty: true,
        preferredIndustries: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      ...updatedProfile,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      { error: "Failed to update profile", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
