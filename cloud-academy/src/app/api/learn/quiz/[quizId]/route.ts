import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET - Get a specific quiz with all questions and check for in-progress attempt
export async function GET(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = session.user.academyProfileId;

    const quiz = await prisma.quiz.findUnique({
      where: { id: params.quizId },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Check for existing in-progress attempt
    const existingAttempt = await prisma.quizAttempt.findFirst({
      where: {
        profileId,
        quizId: params.quizId,
        status: "in_progress",
      },
      include: {
        answers: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform questions for frontend (hide correct answers initially)
    const questionsForUser = quiz.questions.map((q) => {
      const options = typeof q.options === "string" 
        ? JSON.parse(q.options) 
        : q.options;
      
      // Check if user already answered this question
      const existingAnswer = existingAttempt?.answers.find(a => a.questionId === q.id);
      
      return {
        id: q.id,
        question: q.question,
        questionType: q.questionType,
        options: options.map((opt: { id: string; text: string; is_correct: boolean }) => ({
          id: opt.id,
          text: opt.text,
        })),
        difficulty: q.difficulty,
        points: q.points,
        awsServices: q.awsServices,
        tags: q.tags,
        // Include previous answer if resuming
        previousAnswer: existingAnswer ? {
          selectedOptions: existingAnswer.selectedOptions,
          isCorrect: existingAnswer.isCorrect,
        } : null,
      };
    });

    // Find the first unanswered question index for resume
    let resumeIndex = 0;
    if (existingAttempt) {
      const answeredIds = new Set(existingAttempt.answers.map(a => a.questionId));
      resumeIndex = questionsForUser.findIndex(q => !answeredIds.has(q.id));
      if (resumeIndex === -1) resumeIndex = questionsForUser.length - 1;
    }

    return NextResponse.json({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      quizType: quiz.quizType,
      passingScore: quiz.passingScore,
      questionCount: quiz.questionCount,
      questions: questionsForUser,
      // Resume data
      attemptId: existingAttempt?.id || null,
      resumeIndex: existingAttempt ? resumeIndex : 0,
      questionsAnswered: existingAttempt?.questionsAnswered || 0,
      startedAt: existingAttempt?.startedAt || null,
    });
  } catch (error) {
    console.error("Error fetching quiz:", error);
    return NextResponse.json(
      { error: "Failed to fetch quiz" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a quiz
export async function DELETE(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.quiz.delete({
      where: { id: params.quizId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quiz:", error);
    return NextResponse.json(
      { error: "Failed to delete quiz" },
      { status: 500 }
    );
  }
}
