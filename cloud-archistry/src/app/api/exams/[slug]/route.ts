import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/exams/[slug] - Get exam details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);
    const profileId = session?.user?.academyProfileId;
    
    const exam = await prisma.practiceExam.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });
    
    if (!exam) {
      return NextResponse.json(
        { error: "Exam not found" },
        { status: 404 }
      );
    }
    
    // Check access
    let userTier = "free";
    if (profileId) {
      const profile = await prisma.academyUserProfile.findUnique({
        where: { id: profileId },
        select: { subscriptionTier: true },
      });
      userTier = profile?.subscriptionTier || "free";
    }
    
    const tierOrder = ["free", "learner", "pro", "team"];
    const userTierIndex = tierOrder.indexOf(userTier);
    const requiredTierIndex = tierOrder.indexOf(exam.requiredTier);
    const hasAccess = exam.isFree || userTierIndex >= requiredTierIndex;
    
    // Get user's attempt history
    let userAttempts: any[] = [];
    let analytics = null;
    
    if (profileId) {
      userAttempts = await prisma.examAttempt.findMany({
        where: {
          profileId,
          examId: exam.id,
        },
        orderBy: { startedAt: "desc" },
        take: 10,
        select: {
          id: true,
          mode: true,
          status: true,
          score: true,
          passed: true,
          correctCount: true,
          incorrectCount: true,
          timeSpentSeconds: true,
          startedAt: true,
          completedAt: true,
          domainScores: true,
        },
      });
      
      // Get or create analytics
      analytics = await prisma.examAnalytics.findUnique({
        where: {
          profileId_examId: {
            profileId,
            examId: exam.id,
          },
        },
      });
    }
    
    // Get in-progress attempt if any
    let inProgressAttempt = null;
    if (profileId) {
      inProgressAttempt = await prisma.examAttempt.findFirst({
        where: {
          profileId,
          examId: exam.id,
          status: "in_progress",
        },
        select: {
          id: true,
          currentIndex: true,
          timeSpentSeconds: true,
          startedAt: true,
        },
      });
    }
    
    return NextResponse.json({
      exam: {
        ...exam,
        questionCount: exam._count.questions || exam.questionCount,
        hasAccess,
      },
      userAttempts,
      analytics,
      inProgressAttempt,
    });
  } catch (error) {
    console.error("Error fetching exam:", error);
    return NextResponse.json(
      { error: "Failed to fetch exam" },
      { status: 500 }
    );
  }
}
