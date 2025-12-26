import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST - Grade a single question (for immediate feedback) and save progress
export async function POST(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;
    const body = await request.json();
    const { questionId, selectedOptions, attemptId } = body as {
      questionId: string;
      selectedOptions: string[];
      attemptId?: string;
    };

    // Get the question
    const question = await prisma.quizQuestion.findFirst({
      where: {
        id: questionId,
        quizId: params.quizId,
      },
    });

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Parse options and find correct ones
    const options = typeof question.options === "string"
      ? JSON.parse(question.options)
      : question.options;
    
    const correctOptions = options
      .filter((opt: { is_correct: boolean }) => opt.is_correct)
      .map((opt: { id: string }) => opt.id);

    // Check if answer is correct
    const selectedSet = new Set(selectedOptions);
    const correctSet = new Set(correctOptions);
    const isCorrect =
      selectedSet.size === correctSet.size &&
      [...selectedSet].every((opt) => correctSet.has(opt));

    const pointsEarned = isCorrect ? question.points : 0;

    // Get or create quiz attempt for progress tracking
    let attempt;
    if (attemptId) {
      attempt = await prisma.quizAttempt.findUnique({
        where: { id: attemptId },
      });
    }
    
    if (!attempt) {
      // Get quiz for total questions
      const quiz = await prisma.quiz.findUnique({
        where: { id: params.quizId },
        select: { questions: { select: { points: true } } },
      });
      const maxPoints = quiz?.questions.reduce((sum, q) => sum + q.points, 0) || 0;
      
      attempt = await prisma.quizAttempt.create({
        data: {
          profileId,
          quizId: params.quizId,
          status: "in_progress",
          totalQuestions: quiz?.questions.length || 0,
          maxPoints,
        },
      });
    }

    // Save or update the answer
    const existingAnswer = await prisma.quizAnswer.findFirst({
      where: {
        attemptId: attempt.id,
        questionId,
      },
    });

    if (existingAnswer) {
      await prisma.quizAnswer.update({
        where: { id: existingAnswer.id },
        data: {
          selectedOptions,
          isCorrect,
          pointsAwarded: pointsEarned,
        },
      });
    } else {
      await prisma.quizAnswer.create({
        data: {
          attemptId: attempt.id,
          questionId,
          selectedOptions,
          isCorrect,
          pointsAwarded: pointsEarned,
        },
      });

      // Update attempt progress
      await prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          questionsAnswered: { increment: 1 },
          questionsCorrect: isCorrect ? { increment: 1 } : undefined,
          pointsEarned: { increment: pointsEarned },
        },
      });
    }

    return NextResponse.json({
      questionId,
      isCorrect,
      pointsEarned,
      correctOptions,
      explanation: question.explanation || "",
      attemptId: attempt.id,
    });
  } catch (error) {
    console.error("Error grading question:", error);
    return NextResponse.json(
      { error: "Failed to grade question" },
      { status: 500 }
    );
  }
}
