import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/exams - List all available practice exams
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const profileId = session?.user?.academyProfileId;
    
    // Get user's subscription tier for access control
    let userTier = "free";
    if (profileId) {
      const profile = await prisma.academyUserProfile.findUnique({
        where: { id: profileId },
        select: { subscriptionTier: true },
      });
      userTier = profile?.subscriptionTier || "free";
    }
    
    // Fetch all active exams
    const exams = await prisma.practiceExam.findMany({
      where: { isActive: true },
      orderBy: [
        { difficulty: "asc" },
        { title: "asc" },
      ],
      select: {
        id: true,
        slug: true,
        title: true,
        shortTitle: true,
        certificationCode: true,
        description: true,
        questionCount: true,
        timeLimit: true,
        passingScore: true,
        totalQuestions: true,
        domains: true,
        isFree: true,
        requiredTier: true,
        icon: true,
        color: true,
        difficulty: true,
        totalAttempts: true,
        avgScore: true,
        passRate: true,
        lastUpdated: true,
      },
    });
    
    // Add user's attempt stats if logged in
    const userStats: Record<string, { attempts: number; bestScore: number; passed: boolean }> = {};
    if (profileId) {
      const attempts = await prisma.examAttempt.groupBy({
        by: ["examId"],
        where: {
          profileId,
          status: "completed",
        },
        _count: { id: true },
        _max: { score: true },
      });
      
      // Check if user has passed each exam
      const passedExams = await prisma.examAttempt.findMany({
        where: {
          profileId,
          status: "completed",
          passed: true,
        },
        select: { examId: true },
        distinct: ["examId"],
      });
      const passedSet = new Set(passedExams.map(e => e.examId));
      
      for (const attempt of attempts) {
        userStats[attempt.examId] = {
          attempts: attempt._count.id,
          bestScore: attempt._max.score || 0,
          passed: passedSet.has(attempt.examId),
        };
      }
    }
    
    // Determine access for each exam
    const tierOrder = ["free", "learner", "pro", "team"];
    const userTierIndex = tierOrder.indexOf(userTier);
    
    const examsWithAccess = exams.map(exam => {
      const requiredTierIndex = tierOrder.indexOf(exam.requiredTier);
      const hasAccess = exam.isFree || userTierIndex >= requiredTierIndex;
      
      return {
        ...exam,
        hasAccess,
        userStats: userStats[exam.id] || null,
      };
    });
    
    return NextResponse.json({ exams: examsWithAccess });
  } catch (error) {
    console.error("Error fetching exams:", error);
    return NextResponse.json(
      { error: "Failed to fetch exams" },
      { status: 500 }
    );
  }
}
