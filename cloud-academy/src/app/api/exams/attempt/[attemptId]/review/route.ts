import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/exams/attempt/[attemptId]/review - Get full review with explanations
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
            passingScore: true,
            domains: true,
          },
        },
        answers: true,
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
    
    // Only allow review of completed attempts
    if (attempt.status === "in_progress") {
      return NextResponse.json(
        { error: "Cannot review an in-progress attempt" },
        { status: 400 }
      );
    }
    
    // Get all questions with full details (including explanations)
    const questionIds = attempt.questionIds as string[];
    const questions = await prisma.examQuestion.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        questionText: true,
        questionType: true,
        selectCount: true,
        scenario: true,
        options: true,
        correctAnswers: true,
        explanation: true,
        whyCorrect: true,
        whyWrong: true,
        domain: true,
        subdomain: true,
        awsServices: true,
        difficulty: true,
        referenceLinks: true,
      },
    });
    
    // Create a map for quick lookup
    const questionMap = new Map(questions.map(q => [q.id, q]));
    const answerMap = new Map(attempt.answers.map(a => [a.questionId, a]));
    
    // Build review data in question order
    const reviewQuestions = questionIds.map((qId, index) => {
      const question = questionMap.get(qId);
      const answer = answerMap.get(qId);
      
      if (!question) return null;
      
      return {
        index,
        question,
        userAnswer: answer ? {
          selectedOptions: answer.selectedOptions,
          isCorrect: answer.isCorrect,
          isPartiallyCorrect: answer.isPartiallyCorrect,
          timeSpentSeconds: answer.timeSpentSeconds,
          wasFlagged: answer.wasFlagged,
        } : null,
        wasAnswered: !!answer,
      };
    }).filter(Boolean);
    
    // Group by domain for domain-based review
    const byDomain: Record<string, typeof reviewQuestions> = {};
    for (const item of reviewQuestions) {
      if (!item) continue;
      const domain = item.question.domain;
      if (!byDomain[domain]) {
        byDomain[domain] = [];
      }
      byDomain[domain].push(item);
    }
    
    // Filter for incorrect/unanswered only
    const incorrectQuestions = reviewQuestions.filter(
      item => item && (!item.userAnswer || !item.userAnswer.isCorrect)
    );
    
    return NextResponse.json({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        score: attempt.score,
        passed: attempt.passed,
        correctCount: attempt.correctCount,
        incorrectCount: attempt.incorrectCount,
        unansweredCount: attempt.unansweredCount,
        domainScores: attempt.domainScores,
        timeSpentSeconds: attempt.timeSpentSeconds,
        completedAt: attempt.completedAt,
        pointsEarned: attempt.pointsEarned,
      },
      exam: attempt.exam,
      questions: reviewQuestions,
      byDomain,
      incorrectQuestions,
      totalQuestions: questionIds.length,
    });
  } catch (error) {
    console.error("Error fetching review:", error);
    return NextResponse.json(
      { error: "Failed to fetch review" },
      { status: 500 }
    );
  }
}
