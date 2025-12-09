import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAiConfigForRequest } from "@/lib/academy/services/api-keys";

const LEARNING_AGENT_URL = process.env.NEXT_PUBLIC_LEARNING_AGENT_URL!;

// Certification to topic mapping for question generation
const CERT_TOPICS: Record<string, string[]> = {
  "solutions-architect": ["VPC", "EC2", "S3", "RDS", "Lambda", "IAM", "CloudFront", "Route53", "ELB", "Auto Scaling"],
  "developer": ["Lambda", "API Gateway", "DynamoDB", "S3", "SQS", "SNS", "CodePipeline", "CloudFormation", "X-Ray"],
  "sysops": ["CloudWatch", "EC2", "S3", "VPC", "IAM", "Systems Manager", "CloudTrail", "Config", "Backup"],
  "devops": ["CodePipeline", "CodeBuild", "CodeDeploy", "CloudFormation", "ECS", "EKS", "Lambda", "CloudWatch"],
  "data-analytics": ["Kinesis", "Athena", "Glue", "Redshift", "EMR", "QuickSight", "S3", "DynamoDB"],
  "machine-learning": ["SageMaker", "Rekognition", "Comprehend", "Lex", "Polly", "S3", "Lambda"],
  "security": ["IAM", "KMS", "Secrets Manager", "WAF", "Shield", "GuardDuty", "Inspector", "Macie", "CloudTrail"],
  "networking": ["VPC", "Direct Connect", "Transit Gateway", "Route53", "CloudFront", "Global Accelerator", "ELB"],
  "database": ["RDS", "Aurora", "DynamoDB", "ElastiCache", "Neptune", "DocumentDB", "Redshift"],
  "default": ["S3", "EC2", "Lambda", "IAM", "VPC", "RDS", "DynamoDB", "CloudWatch"],
};

// Fallback questions when AI is unavailable (defined before use)
const FALLBACK_QUESTIONS: Record<string, Array<{
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}>> = {
  S3: [
    { question: "Which S3 storage class is best for infrequently accessed data with millisecond retrieval?", options: ["S3 Glacier Deep Archive", "S3 Standard-IA", "S3 One Zone-IA", "S3 Intelligent-Tiering"], correctIndex: 1, explanation: "S3 Standard-IA provides millisecond access for infrequently accessed data." },
    { question: "What is the minimum storage duration for S3 Glacier Deep Archive?", options: ["30 days", "90 days", "180 days", "365 days"], correctIndex: 2, explanation: "S3 Glacier Deep Archive has a minimum storage duration of 180 days." },
  ],
  EC2: [
    { question: "Which EC2 instance type is optimized for memory-intensive workloads?", options: ["C5 (Compute)", "R5 (Memory)", "T3 (Burstable)", "M5 (General)"], correctIndex: 1, explanation: "R5 instances are memory-optimized for databases and caching." },
    { question: "What happens to instance store data when an EC2 instance is stopped?", options: ["Data persists", "Data is lost", "Data is backed up to S3", "Data moves to EBS"], correctIndex: 1, explanation: "Instance store is ephemeral - data is lost when the instance stops." },
  ],
  Lambda: [
    { question: "What is the maximum execution time for a Lambda function?", options: ["5 minutes", "10 minutes", "15 minutes", "30 minutes"], correctIndex: 2, explanation: "Lambda functions can run for a maximum of 15 minutes." },
    { question: "What is the maximum memory allocation for a Lambda function?", options: ["3 GB", "6 GB", "10 GB", "16 GB"], correctIndex: 2, explanation: "Lambda supports up to 10 GB of memory." },
  ],
  IAM: [
    { question: "Which IAM policy effect takes precedence?", options: ["Allow", "Deny", "Neither", "Depends on order"], correctIndex: 1, explanation: "Explicit Deny always wins over Allow." },
    { question: "What is the maximum number of IAM users per AWS account?", options: ["1,000", "5,000", "10,000", "Unlimited"], correctIndex: 1, explanation: "Default limit is 5,000 IAM users per account." },
  ],
  VPC: [
    { question: "What is the maximum number of VPCs per region by default?", options: ["2", "5", "10", "20"], correctIndex: 1, explanation: "Default limit is 5 VPCs per region." },
    { question: "Which CIDR block size is the largest allowed for a VPC?", options: ["/16", "/20", "/24", "/28"], correctIndex: 0, explanation: "VPCs support CIDR blocks from /16 to /28. /16 is the largest." },
  ],
  RDS: [
    { question: "Which RDS feature provides automatic failover?", options: ["Read Replicas", "Multi-AZ", "Aurora Global", "Snapshot"], correctIndex: 1, explanation: "Multi-AZ provides automatic failover to a standby replica." },
    { question: "What is the maximum storage size for an RDS instance?", options: ["16 TB", "32 TB", "64 TB", "128 TB"], correctIndex: 2, explanation: "RDS supports up to 64 TB of storage." },
  ],
  DynamoDB: [
    { question: "What is the maximum size of an item in DynamoDB?", options: ["256 KB", "400 KB", "1 MB", "4 MB"], correctIndex: 1, explanation: "DynamoDB items can be a maximum of 400 KB." },
    { question: "Which DynamoDB feature provides automatic scaling?", options: ["Provisioned Mode", "On-Demand Mode", "DAX", "Global Tables"], correctIndex: 1, explanation: "On-Demand mode automatically scales without capacity planning." },
  ],
  CloudWatch: [
    { question: "What is the default retention period for CloudWatch Logs?", options: ["7 days", "14 days", "30 days", "Never expires"], correctIndex: 3, explanation: "CloudWatch Logs never expire by default." },
    { question: "What is the minimum resolution for CloudWatch custom metrics?", options: ["1 second", "10 seconds", "1 minute", "5 minutes"], correctIndex: 0, explanation: "High-resolution metrics can have 1-second resolution." },
  ],
};

function generateFallbackQuestions(count: number, topics: string[]): Array<{
  question: string; options: string[]; correctIndex: number; topic: string; explanation: string;
}> {
  const available: Array<{ question: string; options: string[]; correctIndex: number; topic: string; explanation: string; }> = [];
  
  // Collect from requested topics
  for (const topic of topics) {
    const qs = FALLBACK_QUESTIONS[topic];
    if (qs) qs.forEach(q => available.push({ ...q, topic }));
  }
  
  // Add from other topics if needed
  if (available.length < count) {
    for (const [topic, qs] of Object.entries(FALLBACK_QUESTIONS)) {
      if (!topics.includes(topic)) qs.forEach(q => available.push({ ...q, topic }));
    }
  }
  
  // Shuffle and pick
  return available.sort(() => Math.random() - 0.5).slice(0, count).map(q => {
    const opts = q.options.map((opt, idx) => ({ opt, isCorrect: idx === q.correctIndex })).sort(() => Math.random() - 0.5);
    return { ...q, options: opts.map(o => o.opt), correctIndex: opts.findIndex(o => o.isCorrect) };
  });
}

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

    // Get challenger's learning profile to determine topics
    const profile = await prisma.academyUserProfile.findFirst({
      where: { academyUserId: academyUser.id },
      select: { 
        targetCertification: true, 
        skillLevel: true,
      },
    });

    const certification = profile?.targetCertification || "default";
    const topics = CERT_TOPICS[certification] || CERT_TOPICS["default"];
    const skillLevel = profile?.skillLevel || "intermediate";

    // Get AI config for the user (BYOK support)
    const aiConfig = await getAiConfigForRequest(session.user.id);

    // Call Learning Agent to generate questions
    let questions: Array<{
      question: string;
      options: string[];
      correctIndex: number;
      topic: string;
      explanation: string;
    }> = [];

    try {
      const response = await fetch(
        `${LEARNING_AGENT_URL}/api/learning/generate-battle-questions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question_count: match.totalQuestions,
            topics: topics.slice(0, 5), // Pick 5 topics to focus on
            difficulty: skillLevel,
            certification: certification,
            openai_api_key: aiConfig?.key,
            preferred_model: aiConfig?.preferredModel || "gpt-4o-mini",
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.questions && result.questions.length > 0) {
          questions = result.questions.map((q: {
            question: string;
            options: Array<{ text: string; is_correct: boolean }>;
            topic?: string;
            explanation?: string;
          }) => {
            // Shuffle options and track correct index
            const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
            const correctIndex = shuffledOptions.findIndex(o => o.is_correct);
            
            return {
              question: q.question,
              options: shuffledOptions.map(o => o.text),
              correctIndex,
              topic: q.topic || "AWS",
              explanation: q.explanation || "",
            };
          });
        }
      }
    } catch (err) {
      console.error("Learning agent error, falling back to basic questions:", err);
    }

    // Fallback: Generate basic questions if AI fails
    if (questions.length === 0) {
      questions = generateFallbackQuestions(match.totalQuestions, topics);
    }

    // Update match with questions and initialize answer tracking
    await prisma.versusMatch.update({
      where: { matchCode },
      data: {
        matchState: {
          ...matchState,
          questions,
          // Track all answers for end-game recap
          questionHistory: questions.map((_, idx) => ({
            questionIndex: idx,
            player1Answer: null,
            player2Answer: null,
            buzzedBy: null,
            passedTo: null,
            answeredCorrectly: null,
            pointsAwarded: 0,
          })),
        },
      },
    });

    return NextResponse.json({
      success: true,
      questionCount: questions.length,
      topics: [...new Set(questions.map(q => q.topic))],
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
      passedTo?: string;
      firstAnswer?: number;
      firstAnswerBy?: string;
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

    // Check if this is a pass-back situation
    const isPassedToMe = matchState.passedTo === academyUser.id;
    const isPassedToOpponent = matchState.passedTo && matchState.passedTo !== academyUser.id;

    // Return question WITHOUT the correct answer
    return NextResponse.json({
      questionNumber: match.currentQuestion + 1,
      totalQuestions: match.totalQuestions,
      question: currentQ.question,
      options: currentQ.options,
      topic: currentQ.topic,
      buzzedBy: matchState.currentQuestionBuzz || null,
      canBuzz: !matchState.currentQuestionBuzz && !matchState.passedTo,
      // Pass-back state
      passedToMe: isPassedToMe,
      passedToOpponent: isPassedToOpponent,
      opponentAnswer: isPassedToMe ? matchState.firstAnswer : null, // Show what opponent picked if passed to me
      canAnswer: isPassedToMe, // I can answer on pass-back
      canPass: isPassedToMe, // I can skip on pass-back
    });
  } catch (error) {
    console.error("Error fetching question:", error);
    return NextResponse.json({ error: "Failed to fetch question" }, { status: 500 });
  }
}
