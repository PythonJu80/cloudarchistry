import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * DELETE /api/cohort/program/delete
 * Permanently delete an archived program
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("programId");

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

    // Get the program to delete
    const programToDelete = await prisma.cohortProgram.findUnique({
      where: { id: programId },
    });

    if (!programToDelete) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Only allow deleting archived programs
    if (programToDelete.status !== "archived") {
      return NextResponse.json(
        { error: "Only archived programs can be deleted" },
        { status: 400 }
      );
    }

    // Verify user is owner/admin of this team
    const teamMember = await prisma.academyTeamMember.findFirst({
      where: {
        academyUserId: academyUser.id,
        teamId: programToDelete.teamId,
        role: { in: ["owner", "admin"] },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "You must be an owner or admin of this cohort" },
        { status: 403 }
      );
    }

    // Delete the program
    await prisma.cohortProgram.delete({
      where: { id: programId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cohort program delete error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
