import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/exams/attempt/[attemptId] - Get attempt with current question
export async function GET(
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
    
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            shortTitle: true,
            timeLimit: true,
            passingScore: true,
            questionCount: true,
          },
        },
        answers: {
          select: {
            questionId: true,
            selectedOptions: true,
            wasFlagged: true,
          },
        },
      },
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
    
    // Get the current question
    const questionIds = attempt.questionIds as string[];
    const currentQuestionId = questionIds[attempt.currentIndex];
    
    let currentQuestion = null;
    if (currentQuestionId && attempt.status === "in_progress") {
      currentQuestion = await prisma.examQuestion.findUnique({
        where: { id: currentQuestionId },
        select: {
          id: true,
          questionText: true,
          questionType: true,
          selectCount: true,
          scenario: true,
          options: true,
          domain: true,
          // Don't include correct answers or explanations during exam
        },
      });
    }
    
    // Build answered questions map
    const answeredMap: Record<string, { selected: string[]; flagged: boolean }> = {};
    for (const answer of attempt.answers) {
      answeredMap[answer.questionId] = {
        selected: answer.selectedOptions as string[],
        flagged: answer.wasFlagged,
      };
    }
    
    return NextResponse.json({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        mode: attempt.mode,
        currentIndex: attempt.currentIndex,
        totalQuestions: questionIds.length,
        timeSpentSeconds: attempt.timeSpentSeconds,
        timeRemaining: attempt.timeRemaining,
        startedAt: attempt.startedAt,
        flaggedQuestions: attempt.flaggedQuestions,
        score: attempt.score,
        passed: attempt.passed,
        correctCount: attempt.correctCount,
        incorrectCount: attempt.incorrectCount,
        domainScores: attempt.domainScores,
      },
      exam: attempt.exam,
      currentQuestion,
      answeredMap,
      questionIds,
    });
  } catch (error) {
    console.error("Error fetching attempt:", error);
    return NextResponse.json(
      { error: "Failed to fetch attempt" },
      { status: 500 }
    );
  }
}

// PATCH /api/exams/attempt/[attemptId] - Update attempt (navigate, save time)
export async function PATCH(
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
    
    // Update fields
    const updateData: any = {};
    
    if (typeof body.currentIndex === "number") {
      const questionIds = attempt.questionIds as string[];
      if (body.currentIndex >= 0 && body.currentIndex < questionIds.length) {
        updateData.currentIndex = body.currentIndex;
      }
    }
    
    if (typeof body.timeSpentSeconds === "number") {
      updateData.timeSpentSeconds = body.timeSpentSeconds;
    }
    
    if (typeof body.timeRemaining === "number") {
      updateData.timeRemaining = body.timeRemaining;
    }
    
    if (Array.isArray(body.flaggedQuestions)) {
      updateData.flaggedQuestions = body.flaggedQuestions;
    }
    
    const updated = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: updateData,
    });
    
    return NextResponse.json({ attempt: updated });
  } catch (error) {
    console.error("Error updating attempt:", error);
    return NextResponse.json(
      { error: "Failed to update attempt" },
      { status: 500 }
    );
  }
}
