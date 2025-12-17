"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Globe, 
  BookOpen, 
  Layers, 
  MessageSquare, 
  FileText,
  Zap,
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
  Download,
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
            Welcome to Cloud Archistry! This platform helps you prepare for AWS certifications through 
            real-world business scenarios, AI-powered learning tools, hands-on diagram building, and 
            real AWS deployment.
          </p>
          
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              Step 1: Set Up Your API Keys
            </h4>
            <p className="text-sm text-muted-foreground pl-6">
              Go to <Link href="/dashboard/settings" className="text-cyan-400 hover:underline">Settings</Link> and 
              add your <strong>OpenAI API key</strong> (powers AI features) and optionally your 
              <strong> AWS credentials</strong> (for real deployments).
            </p>
            
            <h4 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              Step 2: Set Up Your Profile
            </h4>
            <p className="text-sm text-muted-foreground pl-6">
              Configure your skill level, target certification, and preferred industries. 
              This personalizes all generated content to your learning goals.
            </p>
            
            <h4 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              Step 3: Explore the World
            </h4>
            <p className="text-sm text-muted-foreground pl-6">
              Click on any location on the 3D globe to zoom in and discover real businesses. 
              Each business can become a unique learning scenario.
            </p>
            
            <h4 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              Step 4: Build & Deploy
            </h4>
            <p className="text-sm text-muted-foreground pl-6">
              Design AWS architectures visually with our diagram builder, get AI feedback, 
              and deploy to real AWS infrastructure.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "world-map",
      title: "World Map & Business Discovery",
      icon: <Globe className="w-5 h-5" />,
      description: "Navigate the interactive globe and find businesses",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            The World Map is your gateway to discovering real businesses that become the foundation 
            for your AWS learning scenarios.
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
                Satellite View
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                <li>After clicking a location, you see the satellite map</li>
                <li>Colored markers show different business types</li>
                <li>Click any business marker to see details</li>
                <li>Use the industry filter (bottom-left) to show/hide categories</li>
              </ul>
            </div>
            
            <div className="p-4 rounded-lg bg-slate-800/50 border border-border/50">
              <h4 className="font-semibold flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                Business Types
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-400" /> Finance (Banks)</span>
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400" /> Healthcare</span>
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-400" /> Technology</span>
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Retail</span>
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-400" /> Hospitality</span>
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-400" /> Automotive</span>
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-400" /> Education</span>
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-teal-400" /> Aviation</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "challenge-generation",
      title: "AI Challenge Generation",
      icon: <Zap className="w-5 h-5" />,
      description: "Create custom AWS challenges from real businesses",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Our AI researches real businesses and creates tailored AWS architecture challenges 
            based on their actual needs and your target certification.
          </p>
          
          <div className="space-y-3">
            <h4 className="font-semibold">How It Works:</h4>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-5">
              <li><strong>Select a business</strong> from the map or enter one manually</li>
              <li><strong>AI researches</strong> the company using web search (Tavily)</li>
              <li><strong>Knowledge base</strong> is searched for relevant AWS best practices</li>
              <li><strong>Certification focus</strong> is applied based on your target cert</li>
              <li><strong>Challenges are generated</strong> with real-world context</li>
            </ol>
          </div>
          
          <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <h4 className="font-semibold text-cyan-400 mb-2">What You Will See:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Live streaming logs showing the AI research process</li>
              <li>Web sources being searched</li>
              <li>AWS knowledge base matches</li>
              <li>Final scenario with 3-5 progressive challenges</li>
            </ul>
          </div>
          
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <h4 className="font-semibold text-amber-400 mb-2">After Generation:</h4>
            <p className="text-sm text-muted-foreground">
              Choose from four learning modes: <strong>Quiz</strong>, <strong>Notes</strong>, 
              <strong>Flashcards</strong>, or <strong>Coach with AI</strong>.
            </p>
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
      id: "learning-tools",
      title: "Learning Tools",
      icon: <Brain className="w-5 h-5" />,
      description: "Quiz, Notes, Flashcards, and AI Coaching",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            After generating a challenge, you have four ways to learn the material:
          </p>
          
          <div className="grid gap-4">
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-purple-400 mb-2">
                <BookOpen className="w-4 h-4" />
                Quiz
              </h4>
              <p className="text-sm text-muted-foreground">
                Test your knowledge with multiple-choice questions generated from the scenario. 
                Questions are tailored to your certification focus areas.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-green-400 mb-2">
                <FileText className="w-4 h-4" />
                Notes
              </h4>
              <p className="text-sm text-muted-foreground">
                Get comprehensive study notes covering the AWS services, best practices, 
                and architecture patterns relevant to the scenario.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-amber-400 mb-2">
                <Layers className="w-4 h-4" />
                Flashcards
              </h4>
              <p className="text-sm text-muted-foreground">
                Quick-review flashcards for memorizing key concepts, service features, 
                and exam-relevant facts.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-cyan-400 mb-2">
                <MessageSquare className="w-4 h-4" />
                Coach with AI
              </h4>
              <p className="text-sm text-muted-foreground">
                Chat with an AI coach who understands the scenario context. Ask questions, 
                get explanations, and work through the challenges step by step.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "diagram-builder",
      title: "AWS Diagram Builder",
      icon: <PenTool className="w-5 h-5" />,
      description: "Design AWS architectures visually with 47+ services",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Build AWS architecture diagrams visually using drag-and-drop. Get real-time AI feedback 
            on your designs and export to CLI scripts or CloudFormation.
          </p>
          
          <div className="grid gap-4">
            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-cyan-400 mb-2">
                <Layers className="w-4 h-4" />
                47+ AWS Services
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Drag services from the sidebar onto the canvas:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>• VPC, Subnets, Security Groups</span>
                <span>• EC2, Lambda, ECS</span>
                <span>• RDS, Aurora, DynamoDB</span>
                <span>• S3, EFS, ElastiCache</span>
                <span>• ALB, NLB, API Gateway</span>
                <span>• SQS, SNS, EventBridge</span>
                <span>• CloudFront, Route 53</span>
                <span>• IAM, Cognito, WAF</span>
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-green-400 mb-2">
                <Building2 className="w-4 h-4" />
                Container Nesting
              </h4>
              <p className="text-sm text-muted-foreground">
                Drag EC2 instances inside Subnets, Subnets inside VPCs. The diagram builder 
                understands AWS resource hierarchy and validates your architecture.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-purple-400 mb-2">
                <Brain className="w-4 h-4" />
                AI Architecture Audit
              </h4>
              <p className="text-sm text-muted-foreground">
                Click &quot;Audit Diagram&quot; to have the AI coach review your architecture. Get feedback 
                on missing components, security issues, and best practices.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-amber-400 mb-2">
                <Sparkles className="w-4 h-4" />
                Custom Services
              </h4>
              <p className="text-sm text-muted-foreground">
                Need a service that is not listed? Create custom services with your own name, 
                color, and category. They are saved locally for future use.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "deployment",
      title: "Deploy to AWS",
      icon: <Rocket className="w-5 h-5" />,
      description: "Generate CLI scripts, CloudFormation, and deploy directly",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Turn your diagrams into real AWS infrastructure. Generate deployment scripts, 
            CloudFormation templates, or deploy directly from the browser.
          </p>
          
          <div className="grid gap-4">
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-green-400 mb-2">
                <Terminal className="w-4 h-4" />
                CLI Script Generator
              </h4>
              <p className="text-sm text-muted-foreground">
                Generate a complete bash script with AWS CLI commands. Includes proper dependency 
                ordering (VPC → Subnet → EC2), error handling, and rollback scripts.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-amber-400 mb-2">
                <FileText className="w-4 h-4" />
                CloudFormation Export
              </h4>
              <p className="text-sm text-muted-foreground">
                Export your diagram as a CloudFormation YAML template. Includes parameters for 
                secrets, outputs for cross-stack references, and proper resource dependencies.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-cyan-400 mb-2">
                <Cloud className="w-4 h-4" />
                Direct Deployment
              </h4>
              <p className="text-sm text-muted-foreground">
                Deploy resources directly to your AWS account from the browser. Track progress 
                in real-time, pause/resume, and see detailed logs.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <h4 className="font-semibold flex items-center gap-2 text-purple-400 mb-2">
                <Download className="w-4 h-4" />
                Download Scripts
              </h4>
              <p className="text-sm text-muted-foreground">
                Download deployment and rollback scripts to run locally. Perfect for CI/CD 
                pipelines or when you prefer manual control.
              </p>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <h4 className="font-semibold text-red-400 mb-2">⚠️ Important</h4>
            <p className="text-sm text-muted-foreground">
              Deploying creates real AWS resources that may incur costs. Always review generated 
              scripts before deploying, and use the rollback script to clean up.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "aws-terminal",
      title: "AWS Terminal",
      icon: <Terminal className="w-5 h-5" />,
      description: "Run AWS CLI commands directly in the browser",
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            The built-in AWS terminal lets you run read-only AWS CLI commands to explore your 
            account without leaving Cloud Archistry.
          </p>
          
          <div className="p-4 rounded-lg bg-slate-800/50 border border-border/50">
            <h4 className="font-semibold mb-2">Supported Commands</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground font-mono">
              <span>aws sts get-caller-identity</span>
              <span>aws ec2 describe-vpcs</span>
              <span>aws ec2 describe-subnets</span>
              <span>aws ec2 describe-instances</span>
              <span>aws s3 ls</span>
              <span>aws lambda list-functions</span>
              <span>aws rds describe-db-instances</span>
              <span>aws dynamodb list-tables</span>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
            <h4 className="font-semibold text-green-400 mb-2">Features</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Command history (↑/↓ arrows)</li>
              <li>Auto-complete suggestions</li>
              <li>Copy output to clipboard</li>
              <li>Real-time output display</li>
            </ul>
          </div>
          
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <h4 className="font-semibold text-amber-400 mb-2">Security</h4>
            <p className="text-sm text-muted-foreground">
              Destructive commands (delete, terminate, remove) are blocked. The terminal is 
              read-only to prevent accidental changes to your AWS account.
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
              <h4 className="font-semibold text-cyan-400 mb-2">🎯 Focus on One Cert at a Time</h4>
              <p className="text-sm text-muted-foreground">
                Set your target certification and stick with it. All generated content will 
                be tailored to that exam objectives.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <h4 className="font-semibold text-green-400 mb-2">🏢 Use Diverse Industries</h4>
              <p className="text-sm text-muted-foreground">
                Practice with different business types - banks need different architectures 
                than hospitals or retail stores. This builds versatile skills.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <h4 className="font-semibold text-purple-400 mb-2">💬 Use the AI Coach</h4>
              <p className="text-sm text-muted-foreground">
                Do not just read the challenges - discuss them with the AI coach. Ask why 
                questions and explore alternative solutions.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <h4 className="font-semibold text-amber-400 mb-2">📚 Review with Flashcards</h4>
              <p className="text-sm text-muted-foreground">
                After completing a scenario, use flashcards for spaced repetition. This 
                helps cement the knowledge for exam day.
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <h4 className="font-semibold text-red-400 mb-2">🔄 Practice Regularly</h4>
              <p className="text-sm text-muted-foreground">
                Consistency beats intensity. 30 minutes daily is better than 4 hours once 
                a week. Build a study streak!
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
