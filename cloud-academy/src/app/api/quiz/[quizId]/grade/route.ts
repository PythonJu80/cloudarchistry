import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST - Grade a single question (for immediate feedback)
export async function POST(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { questionId, selectedOptions } = body as {
      questionId: string;
      selectedOptions: string[];
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

    return NextResponse.json({
      questionId,
      isCorrect,
      pointsEarned: isCorrect ? question.points : 0,
      correctOptions,
      explanation: question.explanation || "",
    });
  } catch (error) {
    console.error("Error grading question:", error);
    return NextResponse.json(
      { error: "Failed to grade question" },
      { status: 500 }
    );
  }
}
