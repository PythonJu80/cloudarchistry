import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/cohort/program/restore
 * Restore an archived program to active status (archives the current active one)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { programId } = body;

    if (!programId) {
      return NextResponse.json({ error: "programId is required" }, { status: 400 });
    }

    // Get academy user
    const academyUser = await prisma.academyUser.findUnique({
      where: { email: session.user.email },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the program to restore
    const programToRestore = await prisma.cohortProgram.findUnique({
      where: { id: programId },
    });

    if (!programToRestore) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Verify user is owner/admin of this team
    const teamMember = await prisma.academyTeamMember.findFirst({
      where: {
        academyUserId: academyUser.id,
        teamId: programToRestore.teamId,
        role: { in: ["owner", "admin"] },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "You must be an owner or admin of this cohort" },
        { status: 403 }
      );
    }

    // Archive any currently active programs for this team
    await prisma.cohortProgram.updateMany({
      where: {
        teamId: programToRestore.teamId,
        status: "active",
      },
      data: {
        status: "archived",
      },
    });

    // Restore the selected program to active
    await prisma.cohortProgram.update({
      where: { id: programId },
      data: { status: "active" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cohort program restore error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
