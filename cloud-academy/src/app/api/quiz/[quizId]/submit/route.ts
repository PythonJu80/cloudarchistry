import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface SubmittedAnswer {
  questionId: string;
  selectedOptions: string[];
  freeText?: string;
}

// POST - Submit quiz answers and get results
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
    const { answers, timeSpentSeconds } = body as {
      answers: SubmittedAnswer[];
      timeSpentSeconds: number;
    };

    // Get user's profile
    const profile = await prisma.academyUserProfile.findFirst({
      where: { academyUserId: session.user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get quiz with questions
    const quiz = await prisma.quiz.findUnique({
      where: { id: params.quizId },
      include: {
        questions: true,
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Grade each answer
    let totalPoints = 0;
    let earnedPoints = 0;
    const gradedAnswers: {
      questionId: string;
      isCorrect: boolean;
      pointsEarned: number;
      correctOptions: string[];
      explanation: string;
    }[] = [];

    for (const question of quiz.questions) {
      const userAnswer = answers.find((a) => a.questionId === question.id);
      const options = typeof question.options === "string"
        ? JSON.parse(question.options)
        : question.options;
      
      const correctOptions = options
        .filter((opt: { is_correct: boolean }) => opt.is_correct)
        .map((opt: { id: string }) => opt.id);

      totalPoints += question.points;

      let isCorrect = false;
      if (userAnswer) {
        // Check if selected options match correct options
        const selectedSet = new Set(userAnswer.selectedOptions);
        const correctSet = new Set(correctOptions);
        isCorrect =
          selectedSet.size === correctSet.size &&
          [...selectedSet].every((opt) => correctSet.has(opt));
      }

      const pointsEarned = isCorrect ? question.points : 0;
      earnedPoints += pointsEarned;

      gradedAnswers.push({
        questionId: question.id,
        isCorrect,
        pointsEarned,
        correctOptions,
        explanation: question.explanation || "",
      });
    }

    // Calculate score percentage
    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = score >= quiz.passingScore;

    // Create quiz attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        profileId: profile.id,
        quizId: quiz.id,
        score,
        passed,
        questionsAnswered: answers.length,
        questionsCorrect: gradedAnswers.filter((a) => a.isCorrect).length,
        totalQuestions: quiz.questions.length,
        pointsEarned: earnedPoints,
        maxPoints: totalPoints,
        timeSpentSeconds: timeSpentSeconds || 0,
        status: "completed",
        completedAt: new Date(),
      },
    });

    // Save individual answers
    for (const answer of answers) {
      const graded = gradedAnswers.find((g) => g.questionId === answer.questionId);
      await prisma.quizAnswer.create({
        data: {
          attemptId: attempt.id,
          questionId: answer.questionId,
          selectedOptions: answer.selectedOptions,
          textAnswer: answer.freeText,
          isCorrect: graded?.isCorrect || false,
          pointsAwarded: graded?.pointsEarned || 0,
        },
      });
    }

    // Update user's XP and points
    if (earnedPoints > 0) {
      await prisma.academyUserProfile.update({
        where: { id: profile.id },
        data: {
          xp: { increment: earnedPoints },
          totalPoints: { increment: earnedPoints },
        },
      });
    }

    return NextResponse.json({
      success: true,
      attemptId: attempt.id,
      score,
      passed,
      totalPoints,
      earnedPoints,
      correctCount: gradedAnswers.filter((a) => a.isCorrect).length,
      totalQuestions: quiz.questions.length,
      gradedAnswers,
    });
  } catch (error) {
    console.error("Error submitting quiz:", error);
    return NextResponse.json(
      { error: "Failed to submit quiz" },
      { status: 500 }
    );
  }
}
