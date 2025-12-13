import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Learning Agent URL
const LEARNING_AGENT_URL = process.env.LEARNING_AGENT_URL || "http://localhost:8000";

// Fallback questions if AI generation fails - mixed types for variety
const FALLBACK_QUESTIONS = [
  // Service identification
  {
    type: "identify_service",
    question: "Which AWS service provides object storage with 99.999999999% durability?",
    options: ["EBS", "S3", "EFS", "Glacier"],
    correctIndex: 1,
    topic: "S3",
    difficulty: "easy",
  },
  {
    type: "best_for",
    question: "Which service is best for running containers without managing servers?",
    options: ["EC2", "ECS with Fargate", "Lightsail", "Elastic Beanstalk"],
    correctIndex: 1,
    topic: "Containers",
    difficulty: "medium",
  },
  {
    type: "inside_vpc",
    question: "EC2 instances must be launched inside a VPC.",
    options: ["True", "False"],
    correctIndex: 0,
    topic: "VPC",
    difficulty: "easy",
  },
  {
    type: "category_match",
    question: "What category does Lambda belong to?",
    options: ["Compute", "Storage", "Database", "Networking"],
    correctIndex: 0,
    topic: "Lambda",
    difficulty: "easy",
  },
  {
    type: "connection",
    question: "What allows instances in a private subnet to access the internet?",
    options: ["Internet Gateway", "NAT Gateway", "VPC Endpoint", "Transit Gateway"],
    correctIndex: 1,
    topic: "VPC",
    difficulty: "medium",
  },
  {
    type: "service_purpose",
    question: "What is the primary purpose of Amazon CloudFront?",
    options: [
      "DNS management",
      "Content delivery network (CDN)",
      "Load balancing",
      "API management"
    ],
    correctIndex: 1,
    topic: "CloudFront",
    difficulty: "easy",
  },
  {
    type: "best_for",
    question: "Which service is best for real-time streaming data processing?",
    options: ["SQS", "SNS", "Kinesis", "EventBridge"],
    correctIndex: 2,
    topic: "Analytics",
    difficulty: "medium",
  },
  {
    type: "inside_vpc",
    question: "DynamoDB tables run inside your VPC by default.",
    options: ["True", "False"],
    correctIndex: 1,
    topic: "DynamoDB",
    difficulty: "medium",
  },
  {
    type: "connection",
    question: "Which component defines inbound/outbound rules at the instance level?",
    options: ["NACL", "Security Group", "Route Table", "Internet Gateway"],
    correctIndex: 1,
    topic: "VPC",
    difficulty: "easy",
  },
  {
    type: "service_purpose",
    question: "What is the primary purpose of AWS IAM?",
    options: [
      "Monitor AWS resources",
      "Manage access to AWS services",
      "Encrypt data at rest",
      "Audit API calls"
    ],
    correctIndex: 1,
    topic: "IAM",
    difficulty: "easy",
  },
  {
    type: "best_for",
    question: "Which service is best for decoupling application components with queues?",
    options: ["SNS", "SQS", "EventBridge", "Step Functions"],
    correctIndex: 1,
    topic: "SQS",
    difficulty: "easy",
  },
  {
    type: "category_match",
    question: "What category does RDS belong to?",
    options: ["Compute", "Storage", "Database", "Analytics"],
    correctIndex: 2,
    topic: "RDS",
    difficulty: "easy",
  },
  {
    type: "connection",
    question: "What connects a VPC to the public internet?",
    options: ["NAT Gateway", "Internet Gateway", "VPN Gateway", "Direct Connect"],
    correctIndex: 1,
    topic: "VPC",
    difficulty: "easy",
  },
  {
    type: "inside_vpc",
    question: "Lambda functions can be configured to run inside a VPC.",
    options: ["True", "False"],
    correctIndex: 0,
    topic: "Lambda",
    difficulty: "medium",
  },
  {
    type: "best_for",
    question: "Which service is best for serverless SQL queries on S3 data?",
    options: ["Redshift", "Athena", "EMR", "Glue"],
    correctIndex: 1,
    topic: "Analytics",
    difficulty: "medium",
  },
  {
    type: "service_purpose",
    question: "What is the primary purpose of Amazon Route 53?",
    options: [
      "Content delivery",
      "DNS and domain registration",
      "Load balancing",
      "API gateway"
    ],
    correctIndex: 1,
    topic: "Route 53",
    difficulty: "easy",
  },
  {
    type: "connection",
    question: "Which is a stateless firewall at the subnet level?",
    options: ["Security Group", "Network ACL", "WAF", "Shield"],
    correctIndex: 1,
    topic: "VPC",
    difficulty: "hard",
  },
  {
    type: "best_for",
    question: "Which service is best for in-memory caching?",
    options: ["DynamoDB", "RDS", "ElastiCache", "S3"],
    correctIndex: 2,
    topic: "ElastiCache",
    difficulty: "easy",
  },
  {
    type: "inside_vpc",
    question: "S3 buckets are created inside a VPC.",
    options: ["True", "False"],
    correctIndex: 1,
    topic: "S3",
    difficulty: "easy",
  },
  {
    type: "service_purpose",
    question: "What is the primary purpose of AWS Step Functions?",
    options: [
      "Run serverless code",
      "Orchestrate serverless workflows",
      "Manage API endpoints",
      "Process streaming data"
    ],
    correctIndex: 1,
    topic: "Step Functions",
    difficulty: "medium",
  },
  {
    type: "connection",
    question: "What allows private access to S3 without using the internet?",
    options: ["NAT Gateway", "Internet Gateway", "VPC Endpoint", "PrivateLink"],
    correctIndex: 2,
    topic: "VPC",
    difficulty: "hard",
  },
  {
    type: "category_match",
    question: "What category does CloudWatch belong to?",
    options: ["Security", "Management & Governance", "Analytics", "Compute"],
    correctIndex: 1,
    topic: "CloudWatch",
    difficulty: "medium",
  },
  {
    type: "best_for",
    question: "Which service is best for user authentication in web/mobile apps?",
    options: ["IAM", "Cognito", "STS", "Directory Service"],
    correctIndex: 1,
    topic: "Cognito",
    difficulty: "medium",
  },
  {
    type: "inside_vpc",
    question: "RDS databases must be launched inside a VPC.",
    options: ["True", "False"],
    correctIndex: 0,
    topic: "RDS",
    difficulty: "easy",
  },
  {
    type: "service_purpose",
    question: "What is the primary purpose of AWS CloudTrail?",
    options: [
      "Monitor resource metrics",
      "Track API calls and user activity",
      "Manage encryption keys",
      "Configure firewall rules"
    ],
    correctIndex: 1,
    topic: "CloudTrail",
    difficulty: "medium",
  },
];

/**
 * POST /api/game/hot-streak/questions - Generate questions for Hot Streak
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
    const count = Math.min(body.count || 20, 50);

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
      const agentResponse = await fetch(`${LEARNING_AGENT_URL}/api/game/hot-streak/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_level: skillLevel,
          cert_code: targetCertification,
          weak_topics: body.weakTopics || null,
          recent_topics: body.recentTopics || null,
          question_count: count,
          question_types: ["identify_service", "best_for", "inside_vpc", "category_match", "connection", "service_purpose"],
        }),
      });

      if (agentResponse.ok) {
        const aiQuestions = await agentResponse.json();
        
        // Transform AI response to match frontend format
        const questions = aiQuestions.questions.map((q: {
          id: string;
          type: string;
          question: string;
          options: string[];
          correct_index: number;
          topic: string;
          difficulty: string;
          explanation?: string;
        }) => ({
          id: q.id,
          type: q.type || "best_for",
          question: q.question,
          options: q.options,
          correctIndex: q.correct_index,
          topic: q.topic,
          difficulty: q.difficulty,
          explanation: q.explanation,
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
      id: `hotstreak_q_${Date.now()}_${idx}`,
      ...q,
    }));

    return NextResponse.json({ 
      questions,
      source: "fallback",
    });
  } catch (error) {
    console.error("Error generating hot streak questions:", error);
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 });
  }
}
