import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";
import { prisma } from "@/lib/db";

const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "http://10.121.19.210:1027";

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's profile for certification and skill level
    const profile = await prisma.academyUserProfile.findFirst({
      where: { academyUserId: session.user.id },
      select: { 
        skillLevel: true,
        targetCertification: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // Get API key and preferred model from user's settings (optional - will use .env if not provided)
    const aiConfig = await getAiConfigForRequest(session.user.academyProfileId || session.user.id);

    // Call learning agent to generate a deployment brief
    // user_level from profile drives challenge complexity (difficulty param is deprecated)
    const response = await fetch(`${LEARNING_AGENT_URL}/api/speed-deploy/brief/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_level: profile.skillLevel || "intermediate",
        cert_code: profile.targetCertification || "SAA-C03",
        openai_api_key: aiConfig?.key,
        preferred_model: aiConfig?.preferredModel,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || "Failed to generate brief" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Speed Deploy brief error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
