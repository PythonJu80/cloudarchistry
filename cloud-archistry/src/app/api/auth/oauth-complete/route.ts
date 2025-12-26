import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const oauthCompleteSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  userType: z.enum(["learner", "tutor"]),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { username, userType } = oauthCompleteSchema.parse(body);

    // Check if username is already taken
    const existingUsername = await prisma.academyUser.findFirst({
      where: { 
        username,
        id: { not: session.user.id }
      },
    });

    if (existingUsername) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 400 }
      );
    }

    // Update username (required)
    await prisma.academyUser.update({
      where: { id: session.user.id },
      data: { username },
    });

    // Update subscription tier (required)
    if (!session.user.academyProfileId) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 400 }
      );
    }

    const subscriptionTier = userType === "tutor" ? "tutor" : "learner";
    
    await prisma.academyUserProfile.update({
      where: { id: session.user.academyProfileId },
      data: { 
        subscriptionTier,
        displayName: username, // Update display name to match username
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    console.error("OAuth completion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
