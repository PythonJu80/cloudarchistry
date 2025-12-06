/**
 * Profile API Route
 * 
 * GET - Fetch current user's profile
 * PATCH - Update profile fields
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * GET /api/profile
 * Get current user's profile data
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: session.user.academyProfileId },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        skillLevel: true,
        preferredIndustries: true,
        preferredDifficulty: true,
        targetCertification: true,
        totalPoints: true,
        level: true,
        xp: true,
        currentStreak: true,
        longestStreak: true,
        challengesCompleted: true,
        scenariosCompleted: true,
        subscriptionTier: true,
        hasAiAccess: true,
        // OpenAI key status (not the actual key)
        openaiKeyLastFour: true,
        openaiKeyAddedAt: true,
        // AWS credentials status (not the actual credentials)
        awsKeyLastFour: true,
        awsKeyAddedAt: true,
        awsRegion: true,
        awsCredentialsValid: true,
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
      hasOpenAiKey: !!profile.openaiKeyLastFour,
      hasAwsCredentials: !!profile.awsKeyLastFour,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/profile
 * Update profile fields
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Only allow updating specific fields
    const allowedFields = [
      "displayName",
      "avatarUrl",
      "bio",
      "skillLevel",
      "preferredIndustries",
      "preferredDifficulty",
      "targetCertification",
    ];

    const updateData: Record<string, unknown> = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Validate skill level
    if (updateData.skillLevel && !["beginner", "intermediate", "advanced", "expert"].includes(updateData.skillLevel as string)) {
      return NextResponse.json(
        { error: "Invalid skill level" },
        { status: 400 }
      );
    }

    // Validate difficulty
    if (updateData.preferredDifficulty && !["easy", "medium", "hard"].includes(updateData.preferredDifficulty as string)) {
      return NextResponse.json(
        { error: "Invalid difficulty" },
        { status: 400 }
      );
    }

    const profile = await prisma.academyUserProfile.update({
      where: { id: session.user.academyProfileId },
      data: updateData,
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        skillLevel: true,
        preferredIndustries: true,
        preferredDifficulty: true,
        targetCertification: true,
      },
    });

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
