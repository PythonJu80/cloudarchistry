import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Learning Agent URL
const LEARNING_AGENT_URL = process.env.NEXT_PUBLIC_LEARNING_AGENT_URL || "https://api.cloudarchistry.com";

// Fallback questions if AI generation fails
const FALLBACK_QUESTIONS = [
  {
    question: "What is the maximum size of an S3 object?",
    options: ["5 GB", "5 TB", "50 TB", "Unlimited"],
    correctIndex: 1,
    topic: "S3",
    difficulty: "medium",
  },
  {
    question: "Which EC2 instance type is optimized for memory-intensive applications?",
    options: ["C5", "R5", "T3", "M5"],
    correctIndex: 1,
    topic: "EC2",
    difficulty: "easy",
  },
  {
    question: "What is the default visibility timeout for SQS messages?",
    options: ["10 seconds", "30 seconds", "1 minute", "5 minutes"],
    correctIndex: 1,
    topic: "SQS",
    difficulty: "medium",
  },
  {
    question: "Which AWS service provides managed Kubernetes?",
    options: ["ECS", "EKS", "Fargate", "Lambda"],
    correctIndex: 1,
    topic: "Containers",
    difficulty: "easy",
  },
  {
    question: "What is the maximum execution time for a Lambda function?",
    options: ["5 minutes", "10 minutes", "15 minutes", "30 minutes"],
    correctIndex: 2,
    topic: "Lambda",
    difficulty: "medium",
  },
  {
    question: "Which DynamoDB feature provides automatic scaling?",
    options: ["Provisioned capacity", "On-demand capacity", "Reserved capacity", "Spot capacity"],
    correctIndex: 1,
    topic: "DynamoDB",
    difficulty: "medium",
  },
  {
    question: "What is the purpose of a NAT Gateway?",
    options: [
      "Route traffic between VPCs",
      "Allow private instances to access the internet",
      "Load balance traffic",
      "Encrypt data in transit"
    ],
    correctIndex: 1,
    topic: "VPC",
    difficulty: "medium",
  },
  {
    question: "Which S3 storage class has the lowest cost for rarely accessed data?",
    options: ["S3 Standard", "S3 Standard-IA", "S3 Glacier Deep Archive", "S3 One Zone-IA"],
    correctIndex: 2,
    topic: "S3",
    difficulty: "easy",
  },
  {
    question: "What does RDS stand for?",
    options: [
      "Relational Data Service",
      "Relational Database Service",
      "Remote Database System",
      "Redundant Data Storage"
    ],
    correctIndex: 1,
    topic: "RDS",
    difficulty: "easy",
  },
  {
    question: "Which AWS service is used for DNS management?",
    options: ["CloudFront", "Route 53", "API Gateway", "Direct Connect"],
    correctIndex: 1,
    topic: "Networking",
    difficulty: "easy",
  },
  {
    question: "What is the maximum number of VPCs per region by default?",
    options: ["3", "5", "10", "20"],
    correctIndex: 1,
    topic: "VPC",
    difficulty: "hard",
  },
  {
    question: "Which IAM policy effect denies access?",
    options: ["Deny", "Block", "Reject", "Refuse"],
    correctIndex: 0,
    topic: "IAM",
    difficulty: "easy",
  },
  {
    question: "What is the minimum storage duration for S3 Glacier?",
    options: ["30 days", "60 days", "90 days", "180 days"],
    correctIndex: 2,
    topic: "S3",
    difficulty: "hard",
  },
  {
    question: "Which service provides serverless SQL queries on S3?",
    options: ["Redshift", "Athena", "EMR", "Glue"],
    correctIndex: 1,
    topic: "Analytics",
    difficulty: "medium",
  },
  {
    question: "What is the default retention period for CloudWatch Logs?",
    options: ["7 days", "14 days", "30 days", "Never expires"],
    correctIndex: 3,
    topic: "CloudWatch",
    difficulty: "hard",
  },
];

/**
 * POST /api/game/sniper-quiz/questions - Generate questions for Sniper Quiz
 * 
 * Tries to use AI-generated questions from the Learning Agent.
 * Falls back to hardcoded questions if AI is unavailable.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const count = Math.min(body.count || 10, 15);

    // Get user's profile for personalization
    const academyUser = await prisma.academyUser.findFirst({
      where: { email: session.user.email! },
      select: { 
        id: true,
        profile: {
          select: {
            skillLevel: true,
            targetCertification: true,
          },
        },
      },
    });

    if (!academyUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    const skillLevel = academyUser.profile?.skillLevel || "intermediate";
    const targetCertification = academyUser.profile?.targetCertification || null;

    // Try to get AI-generated questions from Learning Agent
    try {
      const agentResponse = await fetch(`${LEARNING_AGENT_URL}/api/game/sniper-quiz/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_level: skillLevel,
          cert_code: targetCertification,
          weak_topics: body.weakTopics || null,
          recent_topics: body.recentTopics || null,
          question_count: count,
        }),
      });

      if (agentResponse.ok) {
        const aiQuestions = await agentResponse.json();
        
        // Transform AI response to match frontend format
        const questions = aiQuestions.questions.map((q: {
          id: string;
          question: string;
          options: string[];
          correct_index: number;
          topic: string;
          difficulty: string;
          explanation: string;
          points: number;
        }) => ({
          id: q.id,
          question: q.question,
          options: q.options,
          correctIndex: q.correct_index,
          topic: q.topic,
          difficulty: q.difficulty,
          explanation: q.explanation,
          points: q.points,
        }));

        return NextResponse.json({ 
          questions,
          source: "ai",
          topics_covered: aiQuestions.topics_covered,
        });
      }
    } catch (agentError) {
      console.warn("Learning Agent unavailable, using fallback questions:", agentError);
    }

    // Fallback: Use hardcoded questions
    const shuffled = [...FALLBACK_QUESTIONS].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    const questions = selected.map((q, idx) => ({
      id: `sniper_q_${Date.now()}_${idx}`,
      ...q,
      points: (idx + 1) * 10,
    }));

    return NextResponse.json({ 
      questions,
      source: "fallback",
    });
  } catch (error) {
    console.error("Error generating sniper quiz questions:", error);
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 });
  }
}
