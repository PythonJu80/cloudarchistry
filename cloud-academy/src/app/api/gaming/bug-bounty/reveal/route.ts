import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const DRAWING_AGENT_URL = process.env.DRAWING_AGENT_URL || "http://10.121.19.210:6098";

export async function GET(
  req: NextRequest,
  { params }: { params: { challengeId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const challengeId = params.challengeId;

    const response = await fetch(
      `${DRAWING_AGENT_URL}/bug-bounty/${challengeId}/reveal`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Bug Bounty] Reveal error:", errorText);
      return NextResponse.json(
        { error: "Failed to reveal bugs" },
        { status: 500 }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      bugs: result.bugs,
    });
  } catch (error) {
    console.error("[Bug Bounty Reveal] Error:", error);
    return NextResponse.json(
      { error: "Failed to reveal bugs." },
      { status: 500 }
    );
  }
}
