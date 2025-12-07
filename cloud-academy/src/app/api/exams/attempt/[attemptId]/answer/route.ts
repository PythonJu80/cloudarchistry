import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/exams/attempt/[attemptId]/answer - Submit an answer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in" },
        { status: 401 }
      );
    }
    
    const profileId = session.user.academyProfileId;
    const body = await request.json();
    const { questionId, selectedOptions, timeSpentSeconds, flagged } = body;
    
    if (!questionId || !Array.isArray(selectedOptions)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
    });
    
    if (!attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }
    
    if (attempt.profileId !== profileId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }
    
    if (attempt.status !== "in_progress") {
      return NextResponse.json(
        { error: "Attempt is not in progress" },
        { status: 400 }
      );
    }
    
    // Verify question is part of this attempt
    const questionIds = attempt.questionIds as string[];
    if (!questionIds.includes(questionId)) {
      return NextResponse.json(
        { error: "Question not part of this attempt" },
        { status: 400 }
      );
    }
    
    // Upsert the answer (don't grade yet - that happens on submit)
    const answer = await prisma.examAnswer.upsert({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId,
        },
      },
      create: {
        attemptId,
        questionId,
        selectedOptions,
        timeSpentSeconds: timeSpentSeconds || 0,
        wasFlagged: flagged || false,
      },
      update: {
        selectedOptions,
        timeSpentSeconds: timeSpentSeconds || 0,
        wasFlagged: flagged || false,
        answeredAt: new Date(),
      },
    });
    
    // Update flagged questions list if needed
    if (typeof flagged === "boolean") {
      const currentFlagged = (attempt.flaggedQuestions as string[]) || [];
      let newFlagged: string[];
      
      if (flagged && !currentFlagged.includes(questionId)) {
        newFlagged = [...currentFlagged, questionId];
      } else if (!flagged && currentFlagged.includes(questionId)) {
        newFlagged = currentFlagged.filter(id => id !== questionId);
      } else {
        newFlagged = currentFlagged;
      }
      
      if (JSON.stringify(newFlagged) !== JSON.stringify(currentFlagged)) {
        await prisma.examAttempt.update({
          where: { id: attemptId },
          data: { flaggedQuestions: newFlagged },
        });
      }
    }
    
    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Error saving answer:", error);
    return NextResponse.json(
      { error: "Failed to save answer" },
      { status: 500 }
    );
  }
}
