import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/exams/[slug]/start - Start a new exam attempt
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to take practice exams" },
        { status: 401 }
      );
    }
    
    const profileId = session.user.academyProfileId;
    const body = await request.json();
    const mode = body.mode || "timed"; // timed, review, domain_focus
    const focusDomain = body.focusDomain;
    
    // Get the exam
    const exam = await prisma.practiceExam.findUnique({
      where: { slug },
    });
    
    if (!exam) {
      return NextResponse.json(
        { error: "Exam not found" },
        { status: 404 }
      );
    }
    
    // Check access
    const profile = await prisma.academyUserProfile.findUnique({
      where: { id: profileId },
      select: { subscriptionTier: true },
    });
    
    const userTier = profile?.subscriptionTier || "free";
    const tierOrder = ["free", "learner", "pro", "team"];
    const userTierIndex = tierOrder.indexOf(userTier);
    const requiredTierIndex = tierOrder.indexOf(exam.requiredTier);
    
    if (!exam.isFree && userTierIndex < requiredTierIndex) {
      return NextResponse.json(
        { error: "Upgrade your subscription to access this exam" },
        { status: 403 }
      );
    }
    
    // Check for existing in-progress attempt
    const existingAttempt = await prisma.examAttempt.findFirst({
      where: {
        profileId,
        examId: exam.id,
        status: "in_progress",
      },
    });
    
    if (existingAttempt) {
      return NextResponse.json({
        attempt: existingAttempt,
        message: "Resuming existing attempt",
      });
    }
    
    // Get questions for this attempt
    let questionQuery: any = {
      where: {
        examId: exam.id,
        isActive: true,
      },
    };
    
    // If domain focus mode, filter by domain
    if (mode === "domain_focus" && focusDomain) {
      questionQuery.where.domain = focusDomain;
    }
    
    const allQuestions = await prisma.examQuestion.findMany({
      ...questionQuery,
      select: { id: true },
    });
    
    if (allQuestions.length === 0) {
      return NextResponse.json(
        { error: "No questions available for this exam" },
        { status: 400 }
      );
    }
    
    // Shuffle and select questions
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, exam.questionCount);
    const questionIds = selectedQuestions.map(q => q.id);
    
    // Create the attempt
    const attempt = await prisma.examAttempt.create({
      data: {
        profileId,
        examId: exam.id,
        mode,
        focusDomain: mode === "domain_focus" ? focusDomain : null,
        status: "in_progress",
        questionIds,
        questionOrder: questionIds, // Same as questionIds initially
        currentIndex: 0,
        timeRemaining: mode === "timed" ? exam.timeLimit * 60 : null,
      },
    });
    
    // Update exam stats
    await prisma.practiceExam.update({
      where: { id: exam.id },
      data: {
        totalAttempts: { increment: 1 },
      },
    });
    
    return NextResponse.json({
      attempt,
      totalQuestions: questionIds.length,
      timeLimit: mode === "timed" ? exam.timeLimit : null,
    });
  } catch (error) {
    console.error("Error starting exam:", error);
    return NextResponse.json(
      { error: "Failed to start exam" },
      { status: 500 }
    );
  }
}
