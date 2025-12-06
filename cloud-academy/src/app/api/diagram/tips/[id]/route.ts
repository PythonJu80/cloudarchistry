import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/diagram/tips/[id]
 * 
 * Get a single audit tip by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to view tips" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const tip = await prisma.diagramAuditTip.findFirst({
      where: {
        id,
        profileId: session.user.academyProfileId,
      },
    });

    if (!tip) {
      return NextResponse.json(
        { error: "Tip not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tip,
    });

  } catch (error) {
    console.error("Error fetching diagram tip:", error);
    return NextResponse.json(
      { error: "Failed to fetch tip" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/diagram/tips/[id]
 * 
 * Update a tip (dismiss, mark helpful, add notes).
 * Body: { isDismissed?, isHelpful?, userNotes? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to update tips" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { isDismissed, isHelpful, userNotes } = body;

    // Verify ownership
    const existingTip = await prisma.diagramAuditTip.findFirst({
      where: {
        id,
        profileId: session.user.academyProfileId,
      },
    });

    if (!existingTip) {
      return NextResponse.json(
        { error: "Tip not found or access denied" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: {
      isDismissed?: boolean;
      dismissedAt?: Date | null;
      isHelpful?: boolean;
      userNotes?: string;
    } = {};

    if (typeof isDismissed === "boolean") {
      updateData.isDismissed = isDismissed;
      updateData.dismissedAt = isDismissed ? new Date() : null;
    }

    if (typeof isHelpful === "boolean") {
      updateData.isHelpful = isHelpful;
    }

    if (typeof userNotes === "string") {
      updateData.userNotes = userNotes;
    }

    const updatedTip = await prisma.diagramAuditTip.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      tip: updatedTip,
    });

  } catch (error) {
    console.error("Error updating diagram tip:", error);
    return NextResponse.json(
      { error: "Failed to update tip" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/diagram/tips/[id]
 * 
 * Permanently delete a tip.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to delete tips" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify ownership
    const existingTip = await prisma.diagramAuditTip.findFirst({
      where: {
        id,
        profileId: session.user.academyProfileId,
      },
    });

    if (!existingTip) {
      return NextResponse.json(
        { error: "Tip not found or access denied" },
        { status: 404 }
      );
    }

    await prisma.diagramAuditTip.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      deleted: true,
    });

  } catch (error) {
    console.error("Error deleting diagram tip:", error);
    return NextResponse.json(
      { error: "Failed to delete tip" },
      { status: 500 }
    );
  }
}
