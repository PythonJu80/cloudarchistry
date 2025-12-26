"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Bug,
  Loader2,
  Play,
  CheckCircle2,
  DollarSign,
  Shield,
  AlertTriangle,
  Search,
  FileText,
  Activity,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function BugBountyLobby() {
  const router = useRouter();
  const { status: authStatus } = useSession();

  const startGame = () => {
    router.push("/game/modes/bug-bounty");
  };

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white overflow-hidden relative">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(236,72,153,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(236,72,153,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        
        {/* Floating bug icons */}
        <div className="absolute top-[10%] left-[5%] animate-bounce" style={{ animationDuration: "3s" }}>
          <div className="w-12 h-12 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center backdrop-blur-sm">
            <Bug className="w-6 h-6 text-red-400/60" />
          </div>
        </div>
        <div className="absolute top-[15%] right-[8%] animate-bounce" style={{ animationDuration: "4s", animationDelay: "1s" }}>
          <div className="w-14 h-14 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center backdrop-blur-sm">
            <Shield className="w-7 h-7 text-purple-400/60" />
          </div>
        </div>
        <div className="absolute top-[35%] left-[8%] animate-bounce" style={{ animationDuration: "3.5s", animationDelay: "0.5s" }}>
          <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center backdrop-blur-sm">
            <DollarSign className="w-5 h-5 text-yellow-400/60" />
          </div>
        </div>
        <div className="absolute top-[25%] right-[15%] animate-bounce" style={{ animationDuration: "4.5s", animationDelay: "2s" }}>
          <div className="w-16 h-16 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center backdrop-blur-sm">
            <AlertTriangle className="w-8 h-8 text-orange-400/60" />
          </div>
        </div>
        <div className="absolute top-[45%] left-[3%] animate-bounce" style={{ animationDuration: "2.5s", animationDelay: "1.5s" }}>
          <div className="w-11 h-11 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center backdrop-blur-sm">
            <Search className="w-5 h-5 text-pink-400/60" />
          </div>
        </div>
        <div className="absolute top-[40%] right-[5%] animate-bounce" style={{ animationDuration: "3.8s", animationDelay: "0.8s" }}>
          <div className="w-13 h-13 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center backdrop-blur-sm">
            <Activity className="w-6 h-6 text-cyan-400/60" />
          </div>
        </div>

        {/* Particle sparkles */}
        <div className="absolute top-[20%] left-[20%] w-1 h-1 bg-purple-400 rounded-full animate-ping opacity-60" style={{ animationDuration: "2s" }} />
        <div className="absolute top-[30%] right-[25%] w-1 h-1 bg-pink-400 rounded-full animate-ping opacity-60" style={{ animationDuration: "2.5s", animationDelay: "0.5s" }} />
        <div className="absolute top-[15%] left-[60%] w-1 h-1 bg-red-400 rounded-full animate-ping opacity-60" style={{ animationDuration: "3s", animationDelay: "1s" }} />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-6">
        <div className="max-w-4xl w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-block mb-4 relative">
              <span className="text-7xl animate-bounce" style={{ animationDuration: "2s" }}>🐛</span>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-2 bg-purple-500/20 rounded-full blur-md" />
            </div>
            <h1 className="text-5xl font-black bg-gradient-to-r from-pink-400 via-purple-400 to-red-400 bg-clip-text text-transparent mb-3 tracking-tight">
              Bug Bounty Hunter
            </h1>
            <p className="text-gray-400 text-lg">Find security & architecture bugs to earn bounties</p>
          </div>

          {/* How It Works */}
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              How It Works
            </h2>
            
            {/* What You'll See */}
            <div className="mb-5 p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
              <p className="text-white font-semibold text-sm mb-2">You&apos;ll receive:</p>
              <ul className="text-gray-400 text-xs space-y-1.5 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span>A <strong className="text-white">use case description</strong> with business requirements (SLA, compliance, scale)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span>An <strong className="text-white">architecture diagram</strong> showing the AWS services deployed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span><strong className="text-white">AWS environment data</strong>: CloudWatch logs, metrics, VPC flow logs, IAM policies, X-Ray traces, Config rules</span>
                </li>
              </ul>
            </div>
            
            {/* Steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0 text-purple-400 font-bold">1</div>
                <div>
                  <p className="text-white font-semibold text-sm mb-1">Investigate</p>
                  <p className="text-gray-400 text-xs leading-relaxed">Compare the description requirements against the actual diagram and logs. Look for contradictions!</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-pink-500/10 to-transparent border border-pink-500/20 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center shrink-0 text-pink-400 font-bold">2</div>
                <div>
                  <p className="text-white font-semibold text-sm mb-1">Flag Bugs</p>
                  <p className="text-gray-400 text-xs leading-relaxed">Click &quot;Flag Bug&quot; and describe what&apos;s wrong, the bug type, severity, and your evidence.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0 text-green-400 font-bold">3</div>
                <div>
                  <p className="text-white font-semibold text-sm mb-1">Earn Points</p>
                  <p className="text-gray-400 text-xs leading-relaxed">Correct claims earn points (more for critical bugs). False claims lose 50 points!</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Scoring */}
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-5 mb-6">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              Scoring
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 font-bold text-lg">200</p>
                <p className="text-gray-400 text-xs">Critical Bug</p>
              </div>
              <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <p className="text-orange-400 font-bold text-lg">150</p>
                <p className="text-gray-400 text-xs">High Severity</p>
              </div>
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-yellow-400 font-bold text-lg">100</p>
                <p className="text-gray-400 text-xs">Medium</p>
              </div>
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-blue-400 font-bold text-lg">50</p>
                <p className="text-gray-400 text-xs">Low</p>
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-3 text-center">+ Bonus points for providing evidence and high confidence on correct answers</p>
          </div>

          {/* Bug Categories */}
          <div className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-red-500/10 border border-purple-500/30 rounded-2xl p-5 mb-6 backdrop-blur-sm">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              Bug Categories You&apos;ll Hunt
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { name: "Security", icon: Shield, color: "text-red-400" },
                { name: "Reliability", icon: Activity, color: "text-blue-400" },
                { name: "Performance", icon: Zap, color: "text-yellow-400" },
                { name: "Cost", icon: DollarSign, color: "text-green-400" },
                { name: "Compliance", icon: CheckCircle2, color: "text-purple-400" },
                { name: "Mismatch", icon: AlertTriangle, color: "text-orange-400" },
              ].map((category) => (
                <div key={category.name} className="flex items-center gap-2 p-2 bg-black/30 rounded-lg border border-white/5">
                  <category.icon className={cn("w-4 h-4", category.color)} />
                  <span className="text-sm text-gray-300">{category.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/game")}
              className="gap-2 border-gray-700 hover:bg-gray-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Hub
            </Button>
            <Button
              onClick={startGame}
              size="lg"
              className="gap-2 px-8 text-lg font-semibold transition-all duration-300 bg-gradient-to-r from-purple-600 to-pink-600 hover:scale-105 hover:shadow-lg"
            >
              <Play className="w-5 h-5" />
              Start Hunting
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
