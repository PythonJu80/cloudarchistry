import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Sample AWS quiz questions - in production, these would come from the Learning Agent
const AWS_QUIZ_QUESTIONS = [
  {
    question: "Which S3 storage class is best for infrequently accessed data with millisecond retrieval?",
    options: ["S3 Glacier Deep Archive", "S3 Standard-IA", "S3 One Zone-IA", "S3 Intelligent-Tiering"],
    correctIndex: 1,
    topic: "S3",
  },
  {
    question: "What is the maximum size of an item in DynamoDB?",
    options: ["256 KB", "400 KB", "1 MB", "4 MB"],
    correctIndex: 1,
    topic: "DynamoDB",
  },
  {
    question: "Which AWS service provides managed Kubernetes?",
    options: ["ECS", "EKS", "Fargate", "Lambda"],
    correctIndex: 1,
    topic: "Containers",
  },
  {
    question: "What is the default visibility timeout for SQS messages?",
    options: ["10 seconds", "30 seconds", "1 minute", "5 minutes"],
    correctIndex: 1,
    topic: "SQS",
  },
  {
    question: "Which EC2 instance type is optimized for memory-intensive workloads?",
    options: ["C5", "R5", "T3", "M5"],
    correctIndex: 1,
    topic: "EC2",
  },
  {
    question: "What is the maximum execution time for a Lambda function?",
    options: ["5 minutes", "10 minutes", "15 minutes", "30 minutes"],
    correctIndex: 2,
    topic: "Lambda",
  },
  {
    question: "Which service provides a fully managed message broker for Apache ActiveMQ and RabbitMQ?",
    options: ["Amazon SQS", "Amazon SNS", "Amazon MQ", "Amazon Kinesis"],
    correctIndex: 2,
    topic: "Messaging",
  },
  {
    question: "What is the minimum storage duration for S3 Glacier Deep Archive?",
    options: ["30 days", "90 days", "180 days", "365 days"],
    correctIndex: 2,
    topic: "S3",
  },
  {
    question: "Which AWS service is used for real-time data streaming?",
    options: ["SQS", "SNS", "Kinesis", "EventBridge"],
    correctIndex: 2,
    topic: "Streaming",
  },
  {
    question: "What is the maximum number of VPCs per region by default?",
    options: ["2", "5", "10", "20"],
    correctIndex: 1,
    topic: "VPC",
  },
  {
    question: "Which RDS engine does NOT support read replicas?",
    options: ["MySQL", "PostgreSQL", "Oracle", "All support read replicas"],
    correctIndex: 3,
    topic: "RDS",
  },
  {
    question: "What is the maximum size of an SQS message?",
    options: ["64 KB", "128 KB", "256 KB", "512 KB"],
    correctIndex: 2,
    topic: "SQS",
  },
  {
    question: "Which service provides serverless SQL queries on S3 data?",
    options: ["Redshift", "Athena", "EMR", "Glue"],
    correctIndex: 1,
    topic: "Analytics",
  },
  {
    question: "What is the default retention period for CloudWatch Logs?",
    options: ["7 days", "14 days", "30 days", "Never expires"],
    correctIndex: 3,
    topic: "CloudWatch",
  },
  {
    question: "Which IAM policy effect takes precedence?",
    options: ["Allow", "Deny", "Neither - they cancel out", "Depends on order"],
    correctIndex: 1,
    topic: "IAM",
  },
];

/**
 * POST /api/versus/[matchCode]/questions - Generate questions for the match
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { matchCode: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { matchCode } = params;

    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const match = await prisma.versusMatch.findUnique({
      where: { matchCode },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Only player 1 (challenger) can generate questions
    if (match.player1Id !== academyUser.id) {
      return NextResponse.json({ error: "Only the challenger can start the quiz" }, { status: 403 });
    }

    // Check if questions already generated
    const matchState = match.matchState as { questions?: unknown[] } || {};
    if (matchState.questions && matchState.questions.length > 0) {
      return NextResponse.json({ error: "Questions already generated" }, { status: 400 });
    }

    // Shuffle and pick questions
    const shuffled = [...AWS_QUIZ_QUESTIONS].sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, match.totalQuestions);

    // Also shuffle the options for each question (and update correctIndex)
    const questionsWithShuffledOptions = selectedQuestions.map(q => {
      const optionsWithIndex = q.options.map((opt, idx) => ({ opt, isCorrect: idx === q.correctIndex }));
      const shuffledOptions = optionsWithIndex.sort(() => Math.random() - 0.5);
      const newCorrectIndex = shuffledOptions.findIndex(o => o.isCorrect);
      
      return {
        question: q.question,
        options: shuffledOptions.map(o => o.opt),
        correctIndex: newCorrectIndex,
        topic: q.topic,
      };
    });

    // Update match with questions
    const updated = await prisma.versusMatch.update({
      where: { matchCode },
      data: {
        matchState: {
          ...matchState,
          questions: questionsWithShuffledOptions,
          answers: {},
        },
      },
    });

    return NextResponse.json({
      success: true,
      questionCount: questionsWithShuffledOptions.length,
    });
  } catch (error) {
    console.error("Error generating questions:", error);
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 });
  }
}

/**
 * GET /api/versus/[matchCode]/questions - Get current question (without revealing answer)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { matchCode: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { matchCode } = params;

    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { id: true },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const match = await prisma.versusMatch.findUnique({
      where: { matchCode },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Verify player is in match
    if (match.player1Id !== academyUser.id && match.player2Id !== academyUser.id) {
      return NextResponse.json({ error: "You are not part of this match" }, { status: 403 });
    }

    const matchState = match.matchState as {
      questions?: Array<{
        question: string;
        options: string[];
        correctIndex: number;
        topic: string;
      }>;
      currentQuestionBuzz?: string;
    } || {};

    const questions = matchState.questions || [];
    const currentQ = questions[match.currentQuestion];

    if (!currentQ) {
      return NextResponse.json({
        complete: true,
        currentQuestion: match.currentQuestion,
        totalQuestions: match.totalQuestions,
      });
    }

    // Return question WITHOUT the correct answer
    return NextResponse.json({
      questionNumber: match.currentQuestion + 1,
      totalQuestions: match.totalQuestions,
      question: currentQ.question,
      options: currentQ.options,
      topic: currentQ.topic,
      buzzedBy: matchState.currentQuestionBuzz || null,
      canBuzz: !matchState.currentQuestionBuzz,
    });
  } catch (error) {
    console.error("Error fetching question:", error);
    return NextResponse.json({ error: "Failed to fetch question" }, { status: 500 });
  }
}
