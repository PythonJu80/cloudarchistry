"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Globe, 
  BookOpen, 
  Layers, 
  MessageSquare, 
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Building2,
  Map,
  Sparkles,
  GraduationCap,
  Trophy,
  Brain,
  CheckCircle2,
  HelpCircle,
  Play,
  Key,
  Database,
  PenTool,
  Rocket,
  Terminal,
  Cloud,
  Shield,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  content: React.ReactNode;
}

export default function GuidePage() {
  const [expandedSection, setExpandedSection] = useState<string | null>("getting-started");

  const sections: GuideSection[] = [
    {
      id: "getting-started",
      title: "Getting Started",
      icon: <Play className="w-5 h-5" />,
      description: "Learn the basics of Cloud Archistry",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Cloud Archistry combines real-world AWS learning with gamification. Master cloud architecture 
            through interactive challenges, competitive games, and hands-on diagram building.
          </p>
          
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              Step 1: Set Your Target Certification
            </h4>
            <p className="text-sm text-muted-foreground pl-6">
              Choose from 9 AWS certifications (Associate, Professional, Specialty). All content 
              adapts to your exam objectives.
            </p>
            
            <h4 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              Step 2: Add Your OpenAI API Key
            </h4>
            <p className="text-sm text-muted-foreground pl-6">
              Go to <Link href="/dashboard/settings" className="text-cyan-400 hover:underline">Settings</Link> to 
              add your API key. This powers AI challenge generation, coaching, and diagram audits.
            </p>
            
            <h4 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              Step 3: Choose Your Path
            </h4>
            <p className="text-sm text-muted-foreground pl-6">
              <strong>World Map:</strong> Create custom challenges from real businesses<br/>
              <strong>Game Zone:</strong> Play 8 different game modes for quick practice
            </p>
            
            <h4 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              Step 4: Track Your Progress
            </h4>
            <p className="text-sm text-muted-foreground pl-6">
              Earn points, build streaks, climb the leaderboard, and track your ELO rating 
              across all game modes.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "world-map",
      title: "World Map - Custom Challenges",
      icon: <Globe className="w-5 h-5" />,
      description: "Create AI-generated challenges from real businesses",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            The World Map lets you create personalized AWS challenges based on real businesses anywhere 
            in the world. AI researches the company and generates certification-focused scenarios.
          </p>
          
          <div className="grid gap-4">
            <div className="p-4 rounded-lg bg-slate-800/50 border border-border/50">
              <h4 className="font-semibold flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                3D Globe Navigation
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                <li>Click and drag to rotate the globe</li>
                <li>Click on glowing location markers to zoom in</li>
                <li>Each marker represents a major city with businesses</li>
              </ul>
            </div>
            
            <div className="p-4 rounded-lg bg-slate-800/50 border border-border/50">
              <h4 className="font-semibold flex items-center gap-2 mb-2">
                <Map className="w-4 h-4 text-green-400" />
                Search & Create
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                <li>Click the globe to zoom into any city</li>
                <li>Search for real businesses using Google Places integration</li>
                <li>Industry is auto-detected (Finance, Healthcare, Tech, etc.)</li>
                <li>AI generates 3-5 progressive challenges tailored to your cert</li>
              </ul>
            </div>
            
            <div className="p-4 rounded-lg bg-slate-800/50 border border-border/50">
              <h4 className="font-semibold flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                Your Challenges
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                <li>All created challenges appear in the sidebar</li>
                <li>Resume anytime - progress is automatically saved</li>
                <li>Track completion status and points earned</li>
                <li>Delete challenges you no longer need</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "game-zone",
      title: "Game Zone - 8 Game Modes",
      icon: <Trophy className="w-5 h-5" />,
      description: "Competitive and solo games for quick AWS practice",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            The Game Zone offers 8 different game modes for fast-paced AWS learning. Earn ELO ratings, 
            climb leaderboards, and compete with other learners.
          </p>
          
          <div className="grid gap-3">
            <div className="p-4 rounded-lg bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30">
              <h4 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                ⚔️ Quiz Battle (1v1)
              </h4>
              <p className="text-sm text-muted-foreground">
                Head-to-head AWS knowledge showdown. Buzz in first to answer questions. Pass questions 
                to your opponent if you&apos;re unsure. Real-time WebSocket gameplay with live chat.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30">
              <h4 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                🎯 Service Sniper (Solo)
              </h4>
              <p className="text-sm text-muted-foreground">
                Shoot real AWS services, avoid the fakes! 60-second arcade shooter testing your 
                ability to identify genuine AWS services from convincing imposters.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30">
              <h4 className="font-semibold text-orange-400 mb-2 flex items-center gap-2">
                🔥 Hot Streak (Solo)
              </h4>
              <p className="text-sm text-muted-foreground">
                Build your streak! Answer correctly to increase your temperature and multiplier. 
                Reach INFERNO mode for 5x points. Temperature decays over time.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30">
              <h4 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                🎰 Service Slots (Solo)
              </h4>
              <p className="text-sm text-muted-foreground">
                Spin to match 3 AWS services that work together. Match services by category, 
                use case, or architecture pattern for bonus points.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30">
              <h4 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                🚀 Speed Deploy (1v1)
              </h4>
              <p className="text-sm text-muted-foreground">
                Race to deploy the correct architecture faster than your opponent. Drag AWS 
                services onto the canvas to match the requirements.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-600/10 border border-green-500/30">
              <h4 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                💰 Cloud Tycoon (Solo)
              </h4>
              <p className="text-sm text-muted-foreground">
                Build and manage cloud infrastructure. Make architecture decisions for virtual 
                businesses, earn revenue, and grow your empire.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-to-r from-red-500/10 to-rose-500/10 border border-red-500/30">
              <h4 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                💣 Ticking Bomb (2-8 Players)
              </h4>
              <p className="text-sm text-muted-foreground">
                Hot potato party game! Answer correctly to pass the bomb to another player. 
                Last one holding when it explodes loses.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-500/30">
              <h4 className="font-semibold text-pink-400 mb-2 flex items-center gap-2">
                🐛 Bug Bounty (Solo)
              </h4>
              <p className="text-sm text-muted-foreground">
                Hunt for bugs in AWS architectures. Identify security issues, misconfigurations, 
                and anti-patterns to earn points.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30">
              <h4 className="font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                🏗️ Architect Arena (1v1)
              </h4>
              <p className="text-sm text-muted-foreground">
                Design architectures under pressure. AI judges your solution against your 
                opponent&apos;s based on best practices, cost, and scalability.
              </p>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <h4 className="font-semibold text-purple-400 mb-2">Leaderboard & Rankings</h4>
            <p className="text-sm text-muted-foreground">
              Track your ELO rating, win rate, and rank (Bronze → Diamond → Master). 
              Compete globally and see live activity from other players.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "challenge-workspace",
      title: "Challenge Workspace",
      icon: <PenTool className="w-5 h-5" />,
      description: "Four ways to learn: Quiz, Diagram, Terminal, Chat",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            When you open a challenge, you get a full workspace with 4 interactive modes. 
            Switch between them anytime to learn your way.
          </p>
          
          <div className="grid gap-4">
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-purple-400 mb-2">
                <BookOpen className="w-4 h-4" />
                Quiz Mode
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                AI-generated multiple choice questions based on the challenge context. 
                Questions adapt to your certification and skill level.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
                <li>Instant feedback with detailed explanations</li>
                <li>Hints available if you&apos;re stuck</li>
                <li>Points awarded for correct answers</li>
                <li>Progress saved automatically</li>
              </ul>
            </div>
            
            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-cyan-400 mb-2">
                <PenTool className="w-4 h-4" />
                Diagram Mode
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Visual AWS architecture builder with 47+ services. Drag and drop to design 
                your solution.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
                <li>Real-time scoring based on AWS best practices</li>
                <li>Container nesting (EC2 in Subnets, Subnets in VPCs)</li>
                <li>AI audit provides detailed feedback</li>
                <li>Export to CLI scripts or CloudFormation</li>
                <li>Deploy directly to your AWS account</li>
              </ul>
            </div>
            
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-green-400 mb-2">
                <Terminal className="w-4 h-4" />
                Terminal Mode
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                AI-powered sandbox terminal. Run AWS CLI commands in a safe environment.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
                <li>Simulated AWS environment - no real resources created</li>
                <li>Learn CLI commands hands-on</li>
                <li>AI understands the challenge context</li>
                <li>Command history and auto-complete</li>
              </ul>
            </div>
            
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-amber-400 mb-2">
                <MessageSquare className="w-4 h-4" />
                Chat Mode (AI Coach)
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Chat with an AI coach who knows the challenge, company, and your certification goals.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
                <li>Ask questions about AWS services</li>
                <li>Get hints without revealing the answer</li>
                <li>Discuss alternative architectures</li>
                <li>Understand why certain solutions are better</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "certifications",
      title: "AWS Certifications",
      icon: <GraduationCap className="w-5 h-5" />,
      description: "Supported certifications and focus areas",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Select your target certification and all content will be tailored to its specific 
            focus areas and exam objectives.
          </p>
          
          <div className="space-y-3">
            <h4 className="font-semibold text-green-400">Associate Level</h4>
            <div className="grid gap-2">
              <div className="p-3 rounded-lg bg-slate-800/50 border border-border/50">
                <div className="font-medium">Solutions Architect Associate</div>
                <p className="text-xs text-muted-foreground">Architecture design, high availability, cost optimization</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/50 border border-border/50">
                <div className="font-medium">Developer Associate</div>
                <p className="text-xs text-muted-foreground">Serverless, APIs, CI/CD, SDKs</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/50 border border-border/50">
                <div className="font-medium">SysOps Administrator Associate</div>
                <p className="text-xs text-muted-foreground">Operations, monitoring, automation</p>
              </div>
            </div>
            
            <h4 className="font-semibold text-amber-400 mt-4">Professional Level</h4>
            <div className="grid gap-2">
              <div className="p-3 rounded-lg bg-slate-800/50 border border-border/50">
                <div className="font-medium">Solutions Architect Professional</div>
                <p className="text-xs text-muted-foreground">Complex architectures, multi-account, migrations</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/50 border border-border/50">
                <div className="font-medium">DevOps Engineer Professional</div>
                <p className="text-xs text-muted-foreground">CI/CD pipelines, infrastructure as code, monitoring</p>
              </div>
            </div>
            
            <h4 className="font-semibold text-purple-400 mt-4">Specialty</h4>
            <div className="grid gap-2">
              <div className="p-3 rounded-lg bg-slate-800/50 border border-border/50">
                <div className="font-medium">Security, Networking, ML, Database</div>
                <p className="text-xs text-muted-foreground">Deep-dive specialty certifications</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "diagram-builder",
      title: "Diagram Builder - Real-Time Scoring",
      icon: <PenTool className="w-5 h-5" />,
      description: "Visual architecture builder with AWS best practices validation",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            The diagram builder provides real-time feedback as you design. Every placement, connection, 
            and configuration is scored against AWS Well-Architected Framework principles.
          </p>
          
          <div className="grid gap-4">
            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-cyan-400 mb-2">
                <Layers className="w-4 h-4" />
                47+ AWS Services
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Complete service library organized by category:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>• Compute: EC2, Lambda, ECS, Fargate</span>
                <span>• Storage: S3, EBS, EFS, Glacier</span>
                <span>• Database: RDS, DynamoDB, Aurora</span>
                <span>• Networking: VPC, ALB, NLB, CloudFront</span>
                <span>• Security: IAM, Cognito, WAF, Shield</span>
                <span>• Integration: SQS, SNS, EventBridge</span>
                <span>• Analytics: Kinesis, Athena, Glue</span>
                <span>• Management: CloudWatch, CloudTrail</span>
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-green-400 mb-2">
                <Trophy className="w-4 h-4" />
                Real-Time Scoring System
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Your diagram is continuously evaluated on:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
                <li>High Availability: Multi-AZ deployments, redundancy</li>
                <li>Security: Proper subnet placement, security groups</li>
                <li>Cost Optimization: Right-sizing, reserved capacity</li>
                <li>Performance: CDN usage, caching strategies</li>
                <li>Operational Excellence: Monitoring, logging</li>
              </ul>
            </div>
            
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-purple-400 mb-2">
                <Brain className="w-4 h-4" />
                AI Architecture Audit
              </h4>
              <p className="text-sm text-muted-foreground">
                Get detailed AI feedback on your architecture. The AI analyzes your design against 
                the challenge requirements and provides specific improvement suggestions.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-amber-400 mb-2">
                <Building2 className="w-4 h-4" />
                Smart Nesting & Validation
              </h4>
              <p className="text-sm text-muted-foreground">
                Drag resources into containers (EC2 → Subnet → VPC). The system validates 
                hierarchy rules and prevents invalid configurations.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "deployment",
      title: "Export & Deploy",
      icon: <Rocket className="w-5 h-5" />,
      description: "Generate CLI scripts, CloudFormation, or deploy directly",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Transform your diagrams into real infrastructure. Export as code or deploy directly 
            to your AWS account with proper dependency ordering and error handling.
          </p>
          
          <div className="grid gap-4">
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-green-400 mb-2">
                <Terminal className="w-4 h-4" />
                AWS CLI Scripts
              </h4>
              <p className="text-sm text-muted-foreground">
                Generate bash scripts with AWS CLI commands. Includes dependency ordering 
                (VPC before Subnets), error handling, and automatic rollback scripts.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-amber-400 mb-2">
                <FileText className="w-4 h-4" />
                CloudFormation Templates
              </h4>
              <p className="text-sm text-muted-foreground">
                Export as CloudFormation YAML with parameters, outputs, and proper resource 
                dependencies. Ready for production deployment.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-cyan-400 mb-2">
                <Cloud className="w-4 h-4" />
                Direct Deployment
              </h4>
              <p className="text-sm text-muted-foreground">
                Deploy directly to AWS from your browser. Requires AWS credentials in settings. 
                Track progress in real-time with detailed logs.
              </p>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <h4 className="font-semibold text-red-400 mb-2">⚠️ Cost Warning</h4>
            <p className="text-sm text-muted-foreground">
              Deploying creates real AWS resources that incur costs. Always review scripts 
              before deploying and use rollback scripts to clean up resources.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "profile",
      title: "Your Profile",
      icon: <User className="w-5 h-5" />,
      description: "Customize your learning experience",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Your profile settings personalize the learning experience. Set your skill level, 
            target certification, and preferred industries.
          </p>
          
          <div className="grid gap-4">
            <div className="p-4 rounded-lg bg-slate-800/50 border border-border/50">
              <h4 className="font-semibold flex items-center gap-2 mb-2">
                <GraduationCap className="w-4 h-4 text-cyan-400" />
                Skill Level
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Choose your current AWS experience level:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="p-2 rounded bg-slate-700/50">Beginner - New to AWS</span>
                <span className="p-2 rounded bg-slate-700/50">Intermediate - Some experience</span>
                <span className="p-2 rounded bg-slate-700/50">Advanced - Production experience</span>
                <span className="p-2 rounded bg-slate-700/50">Expert - Deep expertise</span>
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-slate-800/50 border border-border/50">
              <h4 className="font-semibold flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Target Certification
              </h4>
              <p className="text-sm text-muted-foreground">
                Select your target AWS certification. All generated challenges, quizzes, and 
                flashcards will focus on that exam objectives.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-slate-800/50 border border-border/50">
              <h4 className="font-semibold flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-green-400" />
                Preferred Industries
              </h4>
              <p className="text-sm text-muted-foreground">
                Select industries you are interested in (Finance, Healthcare, E-commerce, etc.). 
                Challenges will feature scenarios from these sectors.
              </p>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <h4 className="font-semibold text-cyan-400 mb-2">Gamification</h4>
            <p className="text-sm text-muted-foreground">
              Track your progress with XP, levels, streaks, and achievements. Compete on the 
              leaderboard and unlock new content as you level up.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "settings",
      title: "Settings & API Keys",
      icon: <Settings className="w-5 h-5" />,
      description: "Configure your API keys and preferences",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Cloud Archistry uses your own API keys for AI features and AWS deployment. This gives 
            you full control over costs and capabilities.
          </p>
          
          <div className="p-4 rounded-lg bg-slate-800/50 border border-border/50">
            <h4 className="font-semibold flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-amber-400" />
              OpenAI API Key
            </h4>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-5">
              <li>Go to <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">platform.openai.com</a></li>
              <li>Create an API key in your account settings</li>
              <li>Copy the key (starts with sk-)</li>
              <li>Paste it in <Link href="/dashboard/settings" className="text-cyan-400 hover:underline">Settings</Link></li>
            </ol>
          </div>
          
          <div className="p-4 rounded-lg bg-slate-800/50 border border-border/50">
            <h4 className="font-semibold flex items-center gap-2 mb-2">
              <Cloud className="w-4 h-4 text-cyan-400" />
              AWS Credentials
            </h4>
            <p className="text-sm text-muted-foreground mb-2">
              Required for the AWS Terminal and deployment features:
            </p>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-5">
              <li>Go to AWS IAM Console → Users → Your User</li>
              <li>Create an Access Key (CLI access)</li>
              <li>Copy the Access Key ID and Secret Access Key</li>
              <li>Paste them in <Link href="/dashboard/settings" className="text-cyan-400 hover:underline">Settings → AWS</Link></li>
            </ol>
          </div>
          
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
            <h4 className="font-semibold flex items-center gap-2 text-green-400 mb-2">
              <Shield className="w-4 h-4" />
              Security
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>All keys are encrypted with AES-256-GCM before storage</li>
              <li>Only the last 4 characters are visible for identification</li>
              <li>AWS credentials are verified via STS before saving</li>
              <li>Keys are never exposed in API responses</li>
            </ul>
          </div>
          
          <div className="p-4 rounded-lg bg-slate-800/50 border border-border/50">
            <h4 className="font-semibold flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-purple-400" />
              Preferred Model
            </h4>
            <p className="text-sm text-muted-foreground">
              Choose your preferred OpenAI model. GPT-4.1 is recommended for best results. 
              The model list is fetched from your OpenAI account.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "tips",
      title: "Tips & Best Practices",
      icon: <Sparkles className="w-5 h-5" />,
      description: "Get the most out of Cloud Archistry",
      content: (
        <div className="space-y-4">
          <div className="grid gap-4">
            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <h4 className="font-semibold text-cyan-400 mb-2">🎯 Mix Learning Modes</h4>
              <p className="text-sm text-muted-foreground">
                Don&apos;t stick to just one mode. Use Quiz for testing, Diagram for hands-on practice, 
                Terminal for CLI experience, and Chat when you need explanations.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <h4 className="font-semibold text-green-400 mb-2">� Play Games Daily</h4>
              <p className="text-sm text-muted-foreground">
                Quick 5-minute game sessions build muscle memory for AWS services. Hot Streak 
                and Service Sniper are perfect for daily practice.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <h4 className="font-semibold text-purple-400 mb-2">🏗️ Build Real Architectures</h4>
              <p className="text-sm text-muted-foreground">
                Use the diagram builder to design solutions for real companies. The AI audit 
                will teach you best practices faster than reading documentation.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <h4 className="font-semibold text-amber-400 mb-2">⚔️ Challenge Others</h4>
              <p className="text-sm text-muted-foreground">
                Quiz Battle and Architect Arena force you to think fast and defend your 
                decisions. Competing reveals knowledge gaps better than solo study.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <h4 className="font-semibold text-red-400 mb-2">� Track Your Progress</h4>
              <p className="text-sm text-muted-foreground">
                Check your ELO rating and leaderboard position regularly. Seeing improvement 
                motivates consistent practice. Aim for a 10-game win streak!
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <h4 className="font-semibold text-blue-400 mb-2">💡 Use the AI Coach Wisely</h4>
              <p className="text-sm text-muted-foreground">
                Ask &quot;why&quot; questions instead of just getting answers. Understanding the reasoning 
                behind architecture decisions is what separates good from great architects.
              </p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/world">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to World
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-cyan-400" />
              <h1 className="text-lg font-semibold">User Guide</h1>
            </div>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 mb-4">
            <GraduationCap className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Welcome to Cloud Archistry</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Learn AWS through real-world business scenarios. Our AI generates custom challenges 
            based on actual companies, tailored to your target certification.
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
          <Link href="/world">
            <Card className="hover:border-cyan-500/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 text-center">
                <Globe className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                <div className="font-medium">World Map</div>
                <div className="text-xs text-muted-foreground">Explore businesses</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/settings">
            <Card className="hover:border-cyan-500/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 text-center">
                <Key className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <div className="font-medium">Settings</div>
                <div className="text-xs text-muted-foreground">API keys setup</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard">
            <Card className="hover:border-cyan-500/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 text-center">
                <Trophy className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <div className="font-medium">Dashboard</div>
                <div className="text-xs text-muted-foreground">Your progress</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/coach">
            <Card className="hover:border-cyan-500/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 text-center">
                <MessageSquare className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <div className="font-medium">AI Coach</div>
                <div className="text-xs text-muted-foreground">Get help</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard">
            <Card className="hover:border-cyan-500/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 text-center">
                <PenTool className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                <div className="font-medium">Diagram Builder</div>
                <div className="text-xs text-muted-foreground">Build architectures</div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((section) => (
            <Card key={section.id} className="overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                className="w-full text-left"
              >
                <CardHeader className="flex flex-row items-center gap-4 py-4 hover:bg-secondary/50 transition-colors">
                  <div className={cn(
                    "p-2 rounded-lg",
                    expandedSection === section.id ? "bg-cyan-500/20 text-cyan-400" : "bg-secondary text-muted-foreground"
                  )}>
                    {section.icon}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <CardDescription className="text-sm">{section.description}</CardDescription>
                  </div>
                  {expandedSection === section.id ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </CardHeader>
              </button>
              {expandedSection === section.id && (
                <CardContent className="pt-0 pb-6 px-6 border-t border-border/50">
                  {section.content}
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 text-center">
          <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30">
            <CardContent className="py-8">
              <h3 className="text-xl font-semibold mb-2">Ready to Start Learning?</h3>
              <p className="text-muted-foreground mb-4">
                Explore the world and create your first challenge!
              </p>
              <Link href="/world">
                <Button variant="glow" size="lg" className="gap-2">
                  <Globe className="w-5 h-5" />
                  Open World Map
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
