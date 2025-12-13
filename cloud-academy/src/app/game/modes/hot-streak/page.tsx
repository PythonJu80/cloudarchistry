"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Flame,
  Trophy,
  Heart,
  RotateCcw,
  Home,
  Clock,
  Zap,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AWS_SERVICES, AWS_CATEGORIES } from "@/lib/aws-services";

// Question types for variety
type QuestionType = 
  | "identify_service"      // Show icon, name the service
  | "service_purpose"       // What does this service do?
  | "category_match"        // Which category does this belong to?
  | "true_false"            // True/False statements
  | "best_for"              // Which service is best for X?
  | "inside_vpc"            // Does this run inside a VPC?
  | "connection"            // What can connect to what?

interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options: string[];
  correctIndex: number;
  serviceId?: string;
  difficulty: number; // 1-3
}

interface GameState {
  status: "ready" | "playing" | "finished";
  score: number;
  streak: number;
  bestStreak: number;
  lives: number;
  questionsAnswered: number;
  correctAnswers: number;
  currentMultiplier: number;
}

const MAX_LIVES = 3;
const QUESTION_TIME = 8; // seconds per question
const BASE_POINTS = 100;

// Services that typically run inside VPC
const VPC_SERVICES = ["ec2", "rds", "elasticache", "redshift", "ecs", "eks", "lambda", "aurora", "documentdb", "neptune", "msk"];
const NON_VPC_SERVICES = ["s3", "dynamodb", "sqs", "sns", "cloudfront", "route53", "iam", "cloudwatch", "cloudtrail"];

// Generate questions dynamically
function generateQuestions(count: number, difficulty: number): Question[] {
  const questions: Question[] = [];
  const usedServices = new Set<string>();
  
  const questionGenerators = [
    // Type 1: Identify Service by description
    () => {
      const availableServices = AWS_SERVICES.filter(s => !usedServices.has(s.id) && s.description);
      if (availableServices.length < 4) return null;
      
      const service = availableServices[Math.floor(Math.random() * availableServices.length)];
      usedServices.add(service.id);
      
      const wrongServices = AWS_SERVICES
        .filter(s => s.id !== service.id && s.category !== service.category)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      
      const options = [service.shortName, ...wrongServices.map(s => s.shortName)];
      
      // Shuffle
      const shuffled = options.map((opt, i) => ({ opt, isCorrect: i === 0 })).sort(() => Math.random() - 0.5);
      
      return {
        id: `q_${Date.now()}_${Math.random()}`,
        type: "identify_service" as QuestionType,
        question: `Which AWS service is "${service.name}"?`,
        options: shuffled.map(s => s.opt),
        correctIndex: shuffled.findIndex(s => s.isCorrect),
        serviceId: service.id,
        difficulty: 1,
      };
    },
    
    // Type 2: Category Match
    () => {
      const availableServices = AWS_SERVICES.filter(s => !usedServices.has(s.id));
      if (availableServices.length < 1) return null;
      
      const service = availableServices[Math.floor(Math.random() * availableServices.length)];
      usedServices.add(service.id);
      
      const category = AWS_CATEGORIES.find(c => c.id === service.category);
      const wrongCategories = AWS_CATEGORIES
        .filter(c => c.id !== service.category)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      
      const options = [category?.name || service.category, ...wrongCategories.map(c => c.name)];
      const shuffled = options.map((opt, i) => ({ opt, isCorrect: i === 0 })).sort(() => Math.random() - 0.5);
      
      return {
        id: `q_${Date.now()}_${Math.random()}`,
        type: "category_match" as QuestionType,
        question: `What category does ${service.shortName} belong to?`,
        options: shuffled.map(s => s.opt),
        correctIndex: shuffled.findIndex(s => s.isCorrect),
        serviceId: service.id,
        difficulty: 1,
      };
    },
    
    // Type 3: VPC True/False
    () => {
      const isVpcService = Math.random() > 0.5;
      const servicePool = isVpcService ? VPC_SERVICES : NON_VPC_SERVICES;
      const availableIds = servicePool.filter(id => !usedServices.has(id));
      if (availableIds.length < 1) return null;
      
      const serviceId = availableIds[Math.floor(Math.random() * availableIds.length)];
      const service = AWS_SERVICES.find(s => s.id === serviceId);
      if (!service) return null;
      
      usedServices.add(serviceId);
      
      // Randomly decide if we ask true or false version
      const askTrue = Math.random() > 0.5;
      const correctAnswer = askTrue ? isVpcService : !isVpcService;
      
      return {
        id: `q_${Date.now()}_${Math.random()}`,
        type: "inside_vpc" as QuestionType,
        question: askTrue 
          ? `${service.shortName} typically runs inside a VPC.`
          : `${service.shortName} does NOT require a VPC to operate.`,
        options: ["True", "False"],
        correctIndex: correctAnswer ? 0 : 1,
        serviceId: service.id,
        difficulty: 2,
      };
    },
    
    // Type 4: Best Service For
    () => {
      const scenarios = [
        { answer: "S3", question: "storing static website assets", wrong: ["EBS", "EFS", "Glacier"] },
        { answer: "Lambda", question: "running code without managing servers", wrong: ["EC2", "ECS", "Lightsail"] },
        { answer: "DynamoDB", question: "a fully managed NoSQL database", wrong: ["RDS", "Aurora", "Redshift"] },
        { answer: "CloudFront", question: "global content delivery (CDN)", wrong: ["Route 53", "API Gateway", "ELB"] },
        { answer: "SQS", question: "decoupling application components with queues", wrong: ["SNS", "EventBridge", "Kinesis"] },
        { answer: "RDS", question: "managed relational databases", wrong: ["DynamoDB", "ElastiCache", "Neptune"] },
        { answer: "ElastiCache", question: "in-memory caching", wrong: ["DynamoDB", "RDS", "S3"] },
        { answer: "Cognito", question: "user authentication and authorization", wrong: ["IAM", "STS", "Directory Service"] },
        { answer: "CloudWatch", question: "monitoring AWS resources and applications", wrong: ["CloudTrail", "X-Ray", "Config"] },
        { answer: "Route 53", question: "DNS and domain registration", wrong: ["CloudFront", "API Gateway", "ELB"] },
        { answer: "VPC", question: "isolating your AWS resources in a private network", wrong: ["Security Group", "NACL", "Subnet"] },
        { answer: "ECS", question: "running Docker containers on AWS", wrong: ["Lambda", "EC2", "Lightsail"] },
        { answer: "Kinesis", question: "real-time streaming data processing", wrong: ["SQS", "SNS", "EventBridge"] },
        { answer: "Athena", question: "querying data in S3 using SQL", wrong: ["Redshift", "RDS", "DynamoDB"] },
        { answer: "Step Functions", question: "orchestrating serverless workflows", wrong: ["Lambda", "EventBridge", "SQS"] },
      ];
      
      const available = scenarios.filter(s => !usedServices.has(s.answer.toLowerCase().replace(/\s+/g, '')));
      if (available.length < 1) return null;
      
      const scenario = available[Math.floor(Math.random() * available.length)];
      usedServices.add(scenario.answer.toLowerCase().replace(/\s+/g, ''));
      
      const options = [scenario.answer, ...scenario.wrong];
      const shuffled = options.map((opt, i) => ({ opt, isCorrect: i === 0 })).sort(() => Math.random() - 0.5);
      
      return {
        id: `q_${Date.now()}_${Math.random()}`,
        type: "best_for" as QuestionType,
        question: `Which service is best for ${scenario.question}?`,
        options: shuffled.map(s => s.opt),
        correctIndex: shuffled.findIndex(s => s.isCorrect),
        difficulty: 2,
      };
    },
    
    // Type 5: Service Purpose
    () => {
      const purposes = [
        { service: "Lambda", purpose: "Run code in response to events without provisioning servers" },
        { service: "EC2", purpose: "Virtual servers in the cloud" },
        { service: "S3", purpose: "Object storage with high durability" },
        { service: "RDS", purpose: "Managed relational database service" },
        { service: "DynamoDB", purpose: "Fast and flexible NoSQL database" },
        { service: "VPC", purpose: "Logically isolated virtual network" },
        { service: "IAM", purpose: "Manage access to AWS services and resources" },
        { service: "CloudFormation", purpose: "Infrastructure as code - provision resources with templates" },
        { service: "ELB", purpose: "Distribute incoming traffic across multiple targets" },
        { service: "Auto Scaling", purpose: "Automatically adjust capacity to maintain performance" },
        { service: "SNS", purpose: "Pub/sub messaging for microservices and serverless" },
        { service: "API Gateway", purpose: "Create, publish, and manage APIs at any scale" },
        { service: "Secrets Manager", purpose: "Securely store and rotate credentials" },
        { service: "KMS", purpose: "Create and manage cryptographic keys" },
        { service: "CloudTrail", purpose: "Track user activity and API usage" },
      ];
      
      const available = purposes.filter(p => !usedServices.has(p.service.toLowerCase().replace(/\s+/g, '')));
      if (available.length < 4) return null;
      
      const correct = available[Math.floor(Math.random() * available.length)];
      usedServices.add(correct.service.toLowerCase().replace(/\s+/g, ''));
      
      const wrongPurposes = available
        .filter(p => p.service !== correct.service)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(p => p.purpose);
      
      const options = [correct.purpose, ...wrongPurposes];
      const shuffled = options.map((opt, i) => ({ opt, isCorrect: i === 0 })).sort(() => Math.random() - 0.5);
      
      return {
        id: `q_${Date.now()}_${Math.random()}`,
        type: "service_purpose" as QuestionType,
        question: `What is the primary purpose of ${correct.service}?`,
        options: shuffled.map(s => s.opt),
        correctIndex: shuffled.findIndex(s => s.isCorrect),
        difficulty: 2,
      };
    },
    
    // Type 6: Architecture Questions
    () => {
      const archQuestions = [
        { 
          question: "Which component must be inside a VPC?",
          answer: "EC2 Instance",
          wrong: ["S3 Bucket", "DynamoDB Table", "CloudFront Distribution"]
        },
        { 
          question: "What defines inbound/outbound rules at the instance level?",
          answer: "Security Group",
          wrong: ["NACL", "Route Table", "Internet Gateway"]
        },
        { 
          question: "What allows instances in a private subnet to access the internet?",
          answer: "NAT Gateway",
          wrong: ["Internet Gateway", "VPC Endpoint", "Transit Gateway"]
        },
        { 
          question: "What connects a VPC to the internet?",
          answer: "Internet Gateway",
          wrong: ["NAT Gateway", "VPN Gateway", "Direct Connect"]
        },
        { 
          question: "Which is a stateless firewall at the subnet level?",
          answer: "Network ACL",
          wrong: ["Security Group", "WAF", "Shield"]
        },
        { 
          question: "What allows private access to S3 without internet?",
          answer: "VPC Endpoint",
          wrong: ["NAT Gateway", "Internet Gateway", "PrivateLink"]
        },
        { 
          question: "Which subnet type has a route to an Internet Gateway?",
          answer: "Public Subnet",
          wrong: ["Private Subnet", "Isolated Subnet", "VPN Subnet"]
        },
        { 
          question: "What determines where network traffic is directed in a VPC?",
          answer: "Route Table",
          wrong: ["Security Group", "NACL", "Flow Logs"]
        },
      ];
      
      const available = archQuestions.filter(q => !usedServices.has(q.answer.toLowerCase().replace(/\s+/g, '')));
      if (available.length < 1) return null;
      
      const q = available[Math.floor(Math.random() * available.length)];
      usedServices.add(q.answer.toLowerCase().replace(/\s+/g, ''));
      
      const options = [q.answer, ...q.wrong];
      const shuffled = options.map((opt, i) => ({ opt, isCorrect: i === 0 })).sort(() => Math.random() - 0.5);
      
      return {
        id: `q_${Date.now()}_${Math.random()}`,
        type: "connection" as QuestionType,
        question: q.question,
        options: shuffled.map(s => s.opt),
        correctIndex: shuffled.findIndex(s => s.isCorrect),
        difficulty: 3,
      };
    },
  ];
  
  // Generate questions with increasing difficulty
  for (let i = 0; i < count; i++) {
    let question: Question | null = null;
    let attempts = 0;
    
    // Bias towards harder questions as we progress
    const difficultyBias = Math.min(difficulty + Math.floor(i / 5), 3);
    
    while (!question && attempts < 20) {
      const generatorIndex = Math.floor(Math.random() * questionGenerators.length);
      question = questionGenerators[generatorIndex]();
      attempts++;
    }
    
    if (question) {
      question.difficulty = Math.min(difficultyBias, 3);
      questions.push(question);
    }
  }
  
  return questions;
}

// Calculate multiplier based on streak
function getMultiplier(streak: number): number {
  if (streak >= 15) return 10;
  if (streak >= 10) return 5;
  if (streak >= 7) return 3;
  if (streak >= 4) return 2;
  if (streak >= 2) return 1.5;
  return 1;
}

// Get streak tier name
function getStreakTier(streak: number): string {
  if (streak >= 15) return "LEGENDARY";
  if (streak >= 10) return "ON FIRE";
  if (streak >= 7) return "BLAZING";
  if (streak >= 4) return "HEATING UP";
  if (streak >= 2) return "WARMING UP";
  return "";
}

export default function HotStreakPage() {
  const router = useRouter();
  const { status: authStatus } = useSession();
  
  const [gameState, setGameState] = useState<GameState>({
    status: "ready",
    score: 0,
    streak: 0,
    bestStreak: 0,
    lives: MAX_LIVES,
    questionsAnswered: 0,
    correctAnswers: 0,
    currentMultiplier: 1,
  });
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [questionSource, setQuestionSource] = useState<"ai" | "fallback" | "local">("local");
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentQuestion = questions[currentQuestionIndex];

  // Fetch questions from API (with fallback to local generation)
  const fetchQuestions = useCallback(async (count: number = 30): Promise<Question[]> => {
    try {
      const response = await fetch("/api/game/hot-streak/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setQuestionSource(data.source === "ai" ? "ai" : "fallback");
        return data.questions.map((q: {
          id: string;
          type?: string;
          question: string;
          options: string[];
          correctIndex: number;
          topic?: string;
          difficulty?: string;
        }) => ({
          id: q.id,
          type: (q.type || "best_for") as QuestionType,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          difficulty: q.difficulty === "hard" ? 3 : q.difficulty === "medium" ? 2 : 1,
        }));
      }
    } catch (error) {
      console.warn("Failed to fetch questions from API, using local generation:", error);
    }
    
    // Fallback to local generation
    setQuestionSource("local");
    return generateQuestions(count, 1);
  }, []);

  // Start game
  const startGame = useCallback(async () => {
    setIsLoading(true);
    setCurrentQuestionIndex(0);
    setTimeLeft(QUESTION_TIME);
    setSelectedAnswer(null);
    setShowResult(false);
    setGameState({
      status: "playing",
      score: 0,
      streak: 0,
      bestStreak: 0,
      lives: MAX_LIVES,
      questionsAnswered: 0,
      correctAnswers: 0,
      currentMultiplier: 1,
    });
    
    // Fetch questions from API
    const newQuestions = await fetchQuestions(30);
    setQuestions(newQuestions);
    setIsLoading(false);
  }, [fetchQuestions]);

  // Handle answer selection
  const handleAnswer = useCallback((answerIndex: number) => {
    if (showResult || selectedAnswer !== null) return;
    
    setSelectedAnswer(answerIndex);
    const correct = answerIndex === currentQuestion?.correctIndex;
    setIsCorrect(correct);
    setShowResult(true);
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Update game state
    setGameState(prev => {
      const newStreak = correct ? prev.streak + 1 : 0;
      const multiplier = getMultiplier(newStreak);
      const points = correct ? Math.floor(BASE_POINTS * multiplier) : 0;
      const newLives = correct ? prev.lives : prev.lives - 1;
      
      return {
        ...prev,
        score: prev.score + points,
        streak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
        lives: newLives,
        questionsAnswered: prev.questionsAnswered + 1,
        correctAnswers: prev.correctAnswers + (correct ? 1 : 0),
        currentMultiplier: multiplier,
        status: newLives <= 0 ? "finished" : prev.status,
      };
    });
    
    // Move to next question after delay
    setTimeout(() => {
      if (gameState.lives <= 1 && !correct) {
        // Game over handled by state update
        return;
      }
      
      if (currentQuestionIndex >= questions.length - 1) {
        // Fetch more questions
        fetchQuestions(20).then(moreQuestions => {
          setQuestions(prev => [...prev, ...moreQuestions]);
        });
      }
      
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setTimeLeft(QUESTION_TIME);
    }, 1500);
  }, [showResult, selectedAnswer, currentQuestion, currentQuestionIndex, questions.length, gameState.lives, gameState.questionsAnswered, fetchQuestions]);

  // Timer effect
  useEffect(() => {
    if (gameState.status !== "playing" || showResult) return;
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - treat as wrong answer
          handleAnswer(-1);
          return QUESTION_TIME;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState.status, showResult, handleAnswer]);

  // Check for game over
  useEffect(() => {
    if (gameState.lives <= 0 && gameState.status === "playing") {
      setGameState(prev => ({ ...prev, status: "finished" }));
    }
  }, [gameState.lives, gameState.status]);

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Flame className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Igniting...</p>
        </div>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const streakTier = getStreakTier(gameState.streak);
  const accuracy = gameState.questionsAnswered > 0
    ? Math.round((gameState.correctAnswers / gameState.questionsAnswered) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden relative">
      {/* Animated fire background based on streak */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-orange-950/30 via-transparent to-transparent" />
        
        {/* Streak-based fire effect */}
        {gameState.streak >= 2 && (
          <div 
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-orange-600/20 via-red-600/10 to-transparent transition-all duration-500"
            style={{ height: `${Math.min(gameState.streak * 5, 60)}%` }}
          />
        )}
        {gameState.streak >= 7 && (
          <div 
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-yellow-500/20 via-orange-500/10 to-transparent animate-pulse"
            style={{ height: `${Math.min(gameState.streak * 3, 40)}%` }}
          />
        )}
      </div>

      {/* Header */}
      <nav className="relative z-50 border-b border-orange-900/30 bg-black/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/game" className="flex items-center gap-2 text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            <span>Exit</span>
          </Link>
          
          <div className="flex items-center gap-6">
            {/* Lives */}
            <div className="flex items-center gap-1">
              {[...Array(MAX_LIVES)].map((_, i) => (
                <Heart 
                  key={i}
                  className={`w-5 h-5 transition-all duration-300 ${
                    i < gameState.lives 
                      ? "text-red-500 fill-red-500" 
                      : "text-gray-700"
                  }`}
                />
              ))}
            </div>
            
            {/* Streak */}
            {gameState.streak > 0 && (
              <div className="flex items-center gap-1 text-orange-500">
                <Flame className={`w-5 h-5 ${gameState.streak >= 4 ? "animate-pulse" : ""}`} />
                <span className="font-bold">{gameState.streak}</span>
                {gameState.currentMultiplier > 1 && (
                  <span className="text-xs text-yellow-400">×{gameState.currentMultiplier}</span>
                )}
              </div>
            )}
            
            {/* Score */}
            <div className="flex items-center gap-2 text-yellow-500">
              <Trophy className="w-5 h-5" />
              <span className="font-bold text-xl">{gameState.score}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Ready State */}
        {gameState.status === "ready" && (
          <div className="flex items-center justify-center min-h-[70vh]">
            <div className="text-center">
              <div className="relative inline-block mb-8">
                <Flame className="w-32 h-32 text-orange-500 mx-auto" />
                <div className="absolute inset-0 animate-ping">
                  <Flame className="w-32 h-32 text-orange-500/30 mx-auto" />
                </div>
              </div>
              
              <h1 className="text-5xl font-black mb-4">
                <span className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                  HOT STREAK
                </span>
              </h1>
              
              <p className="text-gray-400 text-lg mb-2 max-w-md mx-auto">
                Answer questions correctly to build your streak.
                <br />
                Higher streaks = bigger multipliers!
              </p>
              <p className="text-gray-500 text-sm mb-8">
                3 lives. Don&apos;t let the fire die!
              </p>
              
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8 text-sm">
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <Heart className="w-6 h-6 text-red-500 mx-auto mb-2" />
                  <p className="text-gray-400">3 Lives</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <Flame className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                  <p className="text-gray-400">Build Streak</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <Zap className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
                  <p className="text-gray-400">Up to 10×</p>
                </div>
              </div>
              
              <Button
                size="lg"
                onClick={startGame}
                className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold text-xl px-12 py-6 rounded-xl"
              >
                <Flame className="w-6 h-6 mr-2" />
                START STREAK
              </Button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {gameState.status === "playing" && isLoading && (
          <div className="flex items-center justify-center min-h-[70vh]">
            <div className="text-center">
              <Flame className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-pulse" />
              <p className="text-gray-400">
                {questionSource === "ai" ? "AI is generating questions..." : "Loading questions..."}
              </p>
            </div>
          </div>
        )}

        {/* Playing State */}
        {gameState.status === "playing" && !isLoading && currentQuestion && (
          <div className="space-y-6">
            {/* Streak Tier Banner */}
            {streakTier && (
              <div className={`
                text-center py-2 rounded-lg font-black text-lg animate-pulse
                ${gameState.streak >= 15 ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white" : ""}
                ${gameState.streak >= 10 && gameState.streak < 15 ? "bg-gradient-to-r from-red-600 to-orange-600 text-white" : ""}
                ${gameState.streak >= 7 && gameState.streak < 10 ? "bg-gradient-to-r from-orange-600 to-yellow-600 text-white" : ""}
                ${gameState.streak >= 4 && gameState.streak < 7 ? "bg-orange-600/50 text-orange-300" : ""}
                ${gameState.streak >= 2 && gameState.streak < 4 ? "bg-orange-900/50 text-orange-400" : ""}
              `}>
                🔥 {streakTier} 🔥
              </div>
            )}
            
            {/* Timer Bar */}
            <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ease-linear ${
                  timeLeft <= 3 ? "bg-red-500" : "bg-gradient-to-r from-orange-500 to-yellow-500"
                }`}
                style={{ width: `${(timeLeft / QUESTION_TIME) * 100}%` }}
              />
            </div>
            
            {/* Question Counter */}
            <div className="flex justify-between items-center text-sm text-gray-500">
              <span>Question {gameState.questionsAnswered + 1}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {timeLeft}s
              </span>
            </div>
            
            {/* Question Card */}
            <div className="bg-gray-900/80 border border-gray-700 rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-center mb-8">
                {currentQuestion.question}
              </h2>
              
              {/* Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedAnswer === index;
                  const isCorrectAnswer = index === currentQuestion.correctIndex;
                  const showCorrect = showResult && isCorrectAnswer;
                  const showWrong = showResult && isSelected && !isCorrectAnswer;
                  
                  return (
                    <button
                      key={index}
                      onClick={() => handleAnswer(index)}
                      disabled={showResult}
                      className={`
                        relative p-4 rounded-xl border-2 text-left font-medium transition-all duration-200
                        ${!showResult && !isSelected ? "border-gray-700 bg-gray-800/50 hover:border-orange-500 hover:bg-gray-800" : ""}
                        ${isSelected && !showResult ? "border-orange-500 bg-orange-500/20" : ""}
                        ${showCorrect ? "border-green-500 bg-green-500/20" : ""}
                        ${showWrong ? "border-red-500 bg-red-500/20" : ""}
                        ${showResult && !isSelected && !isCorrectAnswer ? "opacity-50" : ""}
                      `}
                    >
                      <span className="block">{option}</span>
                      
                      {/* Result icons */}
                      {showCorrect && (
                        <Check className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-green-500" />
                      )}
                      {showWrong && (
                        <X className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-red-500" />
                      )}
                    </button>
                  );
                })}
              </div>
              
              {/* Result Feedback */}
              {showResult && (
                <div className={`
                  mt-6 text-center text-xl font-bold
                  ${isCorrect ? "text-green-400" : "text-red-400"}
                `}>
                  {isCorrect ? (
                    <span className="flex items-center justify-center gap-2">
                      <Check className="w-6 h-6" />
                      +{Math.floor(BASE_POINTS * gameState.currentMultiplier)} points!
                      {gameState.currentMultiplier > 1 && (
                        <span className="text-yellow-400 text-sm">(×{gameState.currentMultiplier})</span>
                      )}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <X className="w-6 h-6" />
                      Streak lost! -{1} life
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Finished State */}
        {gameState.status === "finished" && (
          <div className="flex items-center justify-center min-h-[70vh]">
            <div className="text-center">
              <div className="relative w-32 h-32 mx-auto mb-6">
                {gameState.bestStreak >= 10 ? (
                  <>
                    <Trophy className="w-32 h-32 text-yellow-500" />
                    <div className="absolute inset-0 animate-ping">
                      <Trophy className="w-32 h-32 text-yellow-500/30" />
                    </div>
                  </>
                ) : gameState.bestStreak >= 5 ? (
                  <Flame className="w-32 h-32 text-orange-500" />
                ) : (
                  <Flame className="w-32 h-32 text-gray-500" />
                )}
              </div>
              
              <h1 className="text-4xl font-black mb-2">
                {gameState.bestStreak >= 10 ? (
                  <span className="text-yellow-400">LEGENDARY RUN!</span>
                ) : gameState.bestStreak >= 5 ? (
                  <span className="text-orange-400">GREAT STREAK!</span>
                ) : (
                  <span className="text-gray-400">FLAME OUT</span>
                )}
              </h1>
              
              <p className="text-6xl font-black text-yellow-500 mb-8">
                {gameState.score}
              </p>
              
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 max-w-xl mx-auto mb-8">
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <p className="text-3xl font-bold text-orange-400">{gameState.bestStreak}</p>
                  <p className="text-sm text-gray-500">Best Streak</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <p className="text-3xl font-bold text-green-400">{gameState.correctAnswers}</p>
                  <p className="text-sm text-gray-500">Correct</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <p className="text-3xl font-bold text-blue-400">{gameState.questionsAnswered}</p>
                  <p className="text-sm text-gray-500">Questions</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <p className="text-3xl font-bold text-purple-400">{accuracy}%</p>
                  <p className="text-sm text-gray-500">Accuracy</p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={() => router.push("/game")}
                  className="gap-2"
                >
                  <Home className="w-4 h-4" />
                  Back to Arena
                </Button>
                <Button
                  onClick={startGame}
                  className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
