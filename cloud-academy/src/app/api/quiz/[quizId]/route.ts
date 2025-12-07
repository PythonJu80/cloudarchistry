import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET - Get a specific quiz with all questions
export async function GET(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Transform questions for frontend (hide correct answers initially)
    const questionsForUser = quiz.questions.map((q) => {
      const options = typeof q.options === "string" 
        ? JSON.parse(q.options) 
        : q.options;
      
      return {
        id: q.id,
        question: q.question,
        questionType: q.questionType,
        options: options.map((opt: { id: string; text: string; is_correct: boolean }) => ({
          id: opt.id,
          text: opt.text,
          // Don't send is_correct to frontend during quiz
        })),
        difficulty: q.difficulty,
        points: q.points,
        awsServices: q.awsServices,
        tags: q.tags,
      };
    });

    return NextResponse.json({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      quizType: quiz.quizType,
      passingScore: quiz.passingScore,
      questionCount: quiz.questionCount,
      questions: questionsForUser,
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
