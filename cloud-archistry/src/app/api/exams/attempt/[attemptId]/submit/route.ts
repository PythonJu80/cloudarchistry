import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/exams/attempt/[attemptId]/submit - Submit and grade the exam
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
    const { timeSpentSeconds, timedOut } = body;
    
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
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
    
    if (attempt.status !== "in_progress") {
      return NextResponse.json(
        { error: "Attempt already submitted" },
        { status: 400 }
      );
    }
    
    // Get all questions for grading
    const questionIds = attempt.questionIds as string[];
    const questions = await prisma.examQuestion.findMany({
      where: { id: { in: questionIds } },
    });
    
    const questionMap = new Map(questions.map(q => [q.id, q]));
    
    // Grade each answer
    let correctCount = 0;
    let incorrectCount = 0;
    const domainScores: Record<string, { correct: number; total: number; percentage: number }> = {};
    
    // Initialize domain scores
    for (const question of questions) {
      if (!domainScores[question.domain]) {
        domainScores[question.domain] = { correct: 0, total: 0, percentage: 0 };
      }
      domainScores[question.domain].total++;
    }
    
    // Grade answers
    for (const answer of attempt.answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) continue;
      
      const correctAnswers = question.correctAnswers as string[];
      const selectedOptions = answer.selectedOptions as string[];
      
      // Check if answer is correct
      const isCorrect = 
        correctAnswers.length === selectedOptions.length &&
        correctAnswers.every(a => selectedOptions.includes(a));
      
      // Check for partial credit on multi-select
      const isPartiallyCorrect = 
        !isCorrect &&
        question.questionType === "multiple" &&
        selectedOptions.some(a => correctAnswers.includes(a));
      
      // Update answer with grading
      await prisma.examAnswer.update({
        where: { id: answer.id },
        data: {
          isCorrect,
          isPartiallyCorrect,
        },
      });
      
      if (isCorrect) {
        correctCount++;
        domainScores[question.domain].correct++;
      } else {
        incorrectCount++;
      }
    }
    
    // Calculate unanswered
    const answeredIds = new Set(attempt.answers.map(a => a.questionId));
    const unansweredCount = questionIds.filter(id => !answeredIds.has(id)).length;
    
    // Calculate domain percentages
    for (const domain of Object.keys(domainScores)) {
      const ds = domainScores[domain];
      ds.percentage = ds.total > 0 ? Math.round((ds.correct / ds.total) * 100) : 0;
    }
    
    // Calculate final score
    const totalQuestions = questionIds.length;
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = score >= attempt.exam.passingScore;
    
    // Calculate points earned (gamification)
    let pointsEarned = correctCount * 10; // 10 points per correct answer
    if (passed) {
      pointsEarned += 100; // Bonus for passing
    }
    if (score === 100) {
      pointsEarned += 50; // Perfect score bonus
    }
    
    // Update the attempt
    const completedAttempt = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        status: timedOut ? "timed_out" : "completed",
        score,
        passed,
        correctCount,
        incorrectCount,
        unansweredCount,
        domainScores,
        timeSpentSeconds: timeSpentSeconds || attempt.timeSpentSeconds,
        timeRemaining: 0,
        completedAt: new Date(),
        pointsEarned,
      },
    });
    
    // Update exam stats
    const examStats = await prisma.examAttempt.aggregate({
      where: {
        examId: attempt.examId,
        status: { in: ["completed", "timed_out"] },
      },
      _avg: { score: true },
      _count: { id: true },
    });
    
    const passedCount = await prisma.examAttempt.count({
      where: {
        examId: attempt.examId,
        status: { in: ["completed", "timed_out"] },
        passed: true,
      },
    });
    
    await prisma.practiceExam.update({
      where: { id: attempt.examId },
      data: {
        avgScore: examStats._avg.score || 0,
        passRate: examStats._count.id > 0 
          ? Math.round((passedCount / examStats._count.id) * 100) 
          : 0,
      },
    });
    
    // Update question stats
    for (const answer of attempt.answers) {
      const isCorrect = answer.isCorrect;
      const question = questionMap.get(answer.questionId);
      if (!question) continue;
      
      const newAttempts = question.totalAttempts + 1;
      const currentCorrect = Math.round(question.correctRate * question.totalAttempts / 100);
      const newCorrect = currentCorrect + (isCorrect ? 1 : 0);
      const newRate = Math.round((newCorrect / newAttempts) * 100);
      
      await prisma.examQuestion.update({
        where: { id: answer.questionId },
        data: {
          totalAttempts: newAttempts,
          correctRate: newRate,
        },
      });
    }
    
    // Update or create analytics
    await prisma.examAnalytics.upsert({
      where: {
        profileId_examId: {
          profileId,
          examId: attempt.examId,
        },
      },
      create: {
        profileId,
        examId: attempt.examId,
        totalAttempts: 1,
        bestScore: score,
        avgScore: score,
        passCount: passed ? 1 : 0,
        domainPerformance: domainScores,
        weakDomains: Object.entries(domainScores)
          .filter(([_, ds]) => ds.percentage < 70)
          .map(([domain]) => domain),
        avgTimeSeconds: timeSpentSeconds || 0,
        totalTimeSeconds: timeSpentSeconds || 0,
        readinessScore: score,
        readinessUpdatedAt: new Date(),
        lastAttemptAt: new Date(),
      },
      update: {
        totalAttempts: { increment: 1 },
        bestScore: { set: score }, // Will be updated below
        passCount: passed ? { increment: 1 } : undefined,
        lastAttemptAt: new Date(),
        readinessScore: score,
        readinessUpdatedAt: new Date(),
      },
    });
    
    // Update best score if this is better
    const analytics = await prisma.examAnalytics.findUnique({
      where: {
        profileId_examId: {
          profileId,
          examId: attempt.examId,
        },
      },
    });
    
    if (analytics && score > analytics.bestScore) {
      await prisma.examAnalytics.update({
        where: { id: analytics.id },
        data: { bestScore: score },
      });
    }
    
    // Update user profile points
    await prisma.academyUserProfile.update({
      where: { id: profileId },
      data: {
        totalPoints: { increment: pointsEarned },
      },
    });
    
    return NextResponse.json({
      attempt: completedAttempt,
      results: {
        score,
        passed,
        correctCount,
        incorrectCount,
        unansweredCount,
        totalQuestions,
        domainScores,
        pointsEarned,
        passingScore: attempt.exam.passingScore,
      },
    });
  } catch (error) {
    console.error("Error submitting exam:", error);
    return NextResponse.json(
      { error: "Failed to submit exam" },
      { status: 500 }
    );
  }
}
