import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || process.env.NEXT_PUBLIC_LEARNING_AGENT_URL || "https://cloudarchistry.com";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to use CLI simulator" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Fetch user profile to get skill level and target certification
    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: session.user.academyProfileId },
      select: {
        skillLevel: true,
        targetCertification: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    const response = await fetch(`${LEARNING_AGENT_URL}/api/learning/cli-simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        user_level: profile.skillLevel,
        cert_code: profile.targetCertification || "SAA-C03",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Learning Agent cli-simulate error:", errorText);
      return NextResponse.json(
        { error: "Failed to simulate CLI command" },
        { status: 500 }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error("CLI simulate error:", error);
    return NextResponse.json(
      { error: "Failed to simulate CLI command", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
