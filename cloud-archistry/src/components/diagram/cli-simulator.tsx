"use client";

/**
 * AWS CLI Simulator Component
 * 
 * AI-powered terminal that simulates AWS CLI commands in a sandboxed environment.
 * Context-aware of the current challenge - teaches CLI while users practice.
 * 
 * This is NOT executing real AWS commands - it's an AI tutor that responds
 * AS IF it were AWS, with realistic outputs tailored to the learning scenario.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Terminal, 
  Trash2, 
  Copy, 
  Check,
  Loader2,
  BookOpen,
  Sparkles,
  Zap,
  Trophy,
  Target,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ============================================================================
// TYPES
// ============================================================================

export interface TerminalLine {
  id: string;
  type: "input" | "output" | "error" | "info" | "success" | "warning" | "hint" | "suggestion";
  content: string;
  timestamp: Date;
}

export interface CLISimulatorProps {
  className?: string;
  challengeContext?: {
    id: string;
    title: string;
    description: string;
    aws_services: string[];
    success_criteria: string[];
  };
  companyName?: string;
  industry?: string;
  businessContext?: string;
  apiKey?: string | null;
  preferredModel?: string | null;
  onCommandExecuted?: (command: string, output: string) => void;
}

// Quick commands for the current context
const QUICK_COMMANDS = [
  { label: "Verify Identity", cmd: "aws sts get-caller-identity" },
  { label: "List VPCs", cmd: "aws ec2 describe-vpcs" },
  { label: "List S3 Buckets", cmd: "aws s3 ls" },
  { label: "List EC2 Instances", cmd: "aws ec2 describe-instances" },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function CLISimulator({
  className,
  challengeContext,
  companyName = "Acme Corp",
  industry = "Technology",
  businessContext = "",
  apiKey,
  preferredModel,
  onCommandExecuted,
}: CLISimulatorProps) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Progress tracking
  const [sessionProgress, setSessionProgress] = useState({
    totalCommands: 0,
    correctCommands: 0,
    currentStreak: 0,
    bestStreak: 0,
    objectivesCompleted: [] as string[],
    totalPoints: 0,
  });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Welcome message
  useEffect(() => {
    const welcomeLines: TerminalLine[] = [
      {
        id: "welcome-1",
        type: "info",
        content: "╔══════════════════════════════════════════════════════════════╗",
        timestamp: new Date(),
      },
      {
        id: "welcome-2",
        type: "info",
        content: "║  🎓 AWS CLI LEARNING SIMULATOR                               ║",
        timestamp: new Date(),
      },
      {
        id: "welcome-3",
        type: "info",
        content: "║  AI-powered sandbox - no real AWS resources affected         ║",
        timestamp: new Date(),
      },
      {
        id: "welcome-4",
        type: "info",
        content: "╚══════════════════════════════════════════════════════════════╝",
        timestamp: new Date(),
      },
      {
        id: "welcome-5",
        type: "warning",
        content: "⚠️  This is a TRAINING environment. AI generates realistic responses",
        timestamp: new Date(),
      },
      {
        id: "welcome-6",
        type: "warning",
        content: "   to teach you AWS CLI - expect 3-10 second response times.",
        timestamp: new Date(),
      },
    ];
    
    if (challengeContext) {
      welcomeLines.push({
        id: "context",
        type: "hint",
        content: `💡 Challenge: ${challengeContext.title}`,
        timestamp: new Date(),
      });
      welcomeLines.push({
        id: "services",
        type: "hint",
        content: `   Services: ${challengeContext.aws_services.join(", ")}`,
        timestamp: new Date(),
      });
    }
    
    welcomeLines.push({
      id: "help",
      type: "info",
      content: "Type 'help' for commands, or start with 'aws ...'",
      timestamp: new Date(),
    });
    
    setLines(welcomeLines);
  }, [challengeContext]);

  // Add a line to the terminal
  const addLine = useCallback((type: TerminalLine["type"], content: string) => {
    const newLine: TerminalLine = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      timestamp: new Date(),
    };
    setLines((prev) => [...prev, newLine]);
  }, []);

  // Execute command via Learning Agent
  const executeCommand = async (command: string) => {
    if (!command.trim()) return;
    
    const trimmedCmd = command.trim();
    
    // Add to history
    setCommandHistory((prev) => [...prev.filter((c) => c !== trimmedCmd), trimmedCmd]);
    setHistoryIndex(-1);
    
    // Show input
    addLine("input", `$ ${trimmedCmd}`);
    
    // Handle built-in commands
    if (trimmedCmd === "help") {
      addLine("info", "");
      addLine("info", "Available commands:");
      addLine("info", "  aws <service> <command>  - Simulate AWS CLI command");
      addLine("info", "  help <topic>             - Get help on a topic (e.g., 'help ec2')");
      addLine("info", "  chat <message>           - Ask the AI tutor a question");
      addLine("info", "  clear                    - Clear terminal");
      addLine("info", "  history                  - Show command history");
      addLine("info", "");
      addLine("hint", "💡 Try: aws sts get-caller-identity");
      addLine("hint", "💬 Or ask: chat how do I encrypt an S3 bucket?");
      return;
    }
    
    if (trimmedCmd === "clear") {
      setLines([]);
      return;
    }
    
    if (trimmedCmd === "history") {
      if (commandHistory.length === 0) {
        addLine("info", "No command history");
      } else {
        commandHistory.forEach((cmd, i) => {
          addLine("info", `  ${i + 1}  ${cmd}`);
        });
      }
      return;
    }
    
    // Handle help <topic>
    if (trimmedCmd.startsWith("help ")) {
      const topic = trimmedCmd.slice(5).trim();
      await getHelp(topic);
      return;
    }
    
    // Handle chat <message> - talk to AI tutor
    if (trimmedCmd.startsWith("chat ")) {
      const message = trimmedCmd.slice(5).trim();
      if (!message) {
        addLine("error", "Usage: chat <your question>");
        return;
      }
      await chatWithTutor(message);
      return;
    }
    
    // Validate AWS command
    if (!trimmedCmd.startsWith("aws ")) {
      addLine("error", "Commands must start with 'aws', 'help', or 'chat'. Type 'help' for usage.");
      return;
    }
    
    // Execute via Learning Agent
    setIsExecuting(true);
    
    try {
      const response = await fetch('/api/cli/simulate', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: trimmedCmd,
          session_id: sessionId,
          challenge_context: challengeContext ? {
            id: challengeContext.id,
            title: challengeContext.title,
            description: challengeContext.description,
            aws_services: challengeContext.aws_services,
            success_criteria: challengeContext.success_criteria,
          } : null,
          company_name: companyName,
          industry: industry,
          business_context: businessContext,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        addLine("error", data.detail || data.error || "Command failed");
        return;
      }
      
      // Save session ID
      if (data.session_id) {
        setSessionId(data.session_id);
      }
      
      // Show warning if dangerous
      if (data.is_dangerous && data.warning) {
        addLine("warning", `⚠️  ${data.warning}`);
      }
      
      // Display output
      if (data.output) {
        const outputLines = data.output.split("\n");
        outputLines.forEach((line: string) => {
          if (line.trim()) {
            addLine(data.exit_code === 0 ? "output" : "error", line);
          }
        });
      }
      
      // Show success/error indicator
      if (data.exit_code === 0) {
        addLine("success", "✓ Command completed");
      } else {
        addLine("error", `✗ Exit code: ${data.exit_code}`);
      }
      
      // Show teaching moment
      if (data.explanation) {
        addLine("hint", "");
        addLine("hint", `💡 ${data.explanation}`);
      }
      
      // Show next steps
      if (data.next_steps && data.next_steps.length > 0) {
        addLine("suggestion", "");
        addLine("suggestion", "📚 Try next:");
        data.next_steps.forEach((step: string) => {
          addLine("suggestion", `   → ${step}`);
        });
      }
      
      // Update session progress
      if (data.session_progress) {
        setSessionProgress({
          totalCommands: data.session_progress.total_commands || 0,
          correctCommands: data.session_progress.correct_commands || 0,
          currentStreak: data.session_progress.current_streak || 0,
          bestStreak: data.session_progress.best_streak || 0,
          objectivesCompleted: data.session_progress.objectives_completed || [],
          totalPoints: data.session_progress.total_points || 0,
        });
        
        // Show streak celebration
        if (data.session_progress.current_streak > 0 && data.session_progress.current_streak % 5 === 0) {
          addLine("success", `🔥 ${data.session_progress.current_streak} command streak!`);
        }
        
        // Show objective completion
        if (data.objective_completed) {
          addLine("success", `✅ Objective completed: ${data.objective_completed}`);
        }
        
        // Show points earned
        if (data.points_earned > 0) {
          addLine("success", `+${data.points_earned} points`);
        }
      }
      
      onCommandExecuted?.(trimmedCmd, data.output || "");
      
    } catch (error) {
      addLine("error", `Failed to execute: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Get help on a topic
  const getHelp = async (topic: string) => {
    setIsExecuting(true);
    addLine("info", `Fetching help for: ${topic}...`);
    
    try {
      const response = await fetch('/api/cli/help', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          challenge_context: challengeContext,
          user_level: "intermediate",
          openai_api_key: apiKey,
          preferred_model: preferredModel,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        addLine("error", data.detail || "Failed to get help");
        return;
      }
      
      // Display help content
      addLine("info", "");
      addLine("info", `═══ ${data.topic?.toUpperCase() || topic.toUpperCase()} ═══`);
      
      if (data.summary) {
        addLine("info", "");
        addLine("output", data.summary);
      }
      
      if (data.common_commands && data.common_commands.length > 0) {
        addLine("info", "");
        addLine("hint", "Common Commands:");
        data.common_commands.forEach((cmd: { command?: string; description?: string } | string) => {
          if (typeof cmd === "string") {
            addLine("output", `  ${cmd}`);
          } else {
            addLine("output", `  ${cmd.command || cmd}`);
            if (cmd.description) {
              addLine("info", `    └─ ${cmd.description}`);
            }
          }
        });
      }
      
      if (data.examples && data.examples.length > 0) {
        addLine("info", "");
        addLine("hint", "Examples:");
        data.examples.forEach((ex: string | { command?: string; description?: string; example?: string }) => {
          if (typeof ex === "string") {
            addLine("suggestion", `  ${ex}`);
          } else {
            // Handle object format
            const cmd = ex.command || ex.example || JSON.stringify(ex);
            addLine("suggestion", `  ${cmd}`);
            if (ex.description) {
              addLine("info", `    └─ ${ex.description}`);
            }
          }
        });
      }
      
      if (data.tips && data.tips.length > 0) {
        addLine("info", "");
        addLine("hint", "💡 Tips:");
        data.tips.forEach((tip: string) => {
          addLine("hint", `  • ${tip}`);
        });
      }
      
    } catch (error) {
      addLine("error", `Failed to get help: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Chat with AI tutor
  const chatWithTutor = async (message: string) => {
    setIsExecuting(true);
    addLine("info", "");
    addLine("hint", `💬 You: ${message}`);
    addLine("info", "Thinking...");
    
    try {
      const response = await fetch('/api/chat', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          context: challengeContext ? {
            challenge_title: challengeContext.title,
            challenge_description: challengeContext.description,
            aws_services: challengeContext.aws_services,
            mode: "cli_tutor",
          } : { mode: "cli_tutor" },
          openai_api_key: apiKey,
          preferred_model: preferredModel,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        addLine("error", data.detail || "Failed to get response");
        return;
      }
      
      // Remove "Thinking..." line
      setLines(prev => prev.filter(l => l.content !== "Thinking..."));
      
      // Display AI response
      addLine("info", "");
      addLine("success", "🤖 Sophia:");
      
      // Split response into lines for better display
      const responseText = data.response || data.message || data.content || "No response";
      const responseLines = responseText.split("\n");
      responseLines.forEach((line: string) => {
        if (line.trim()) {
          // Check if it's a code block or command
          if (line.trim().startsWith("aws ") || line.trim().startsWith("$")) {
            addLine("suggestion", `  ${line}`);
          } else if (line.trim().startsWith("-") || line.trim().startsWith("•")) {
            addLine("hint", `  ${line}`);
          } else {
            addLine("output", `  ${line}`);
          }
        }
      });
      
    } catch (error) {
      addLine("error", `Chat failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle key events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isExecuting) {
      executeCommand(currentInput);
      setCurrentInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || "");
      } else {
        setHistoryIndex(-1);
        setCurrentInput("");
      }
    }
  };

  // Copy line content
  const copyLine = async (line: TerminalLine) => {
    await navigator.clipboard.writeText(line.content);
    setCopiedId(line.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Get line color
  const getLineColor = (type: TerminalLine["type"]) => {
    switch (type) {
      case "input":
        return "text-cyan-400";
      case "output":
        return "text-slate-300";
      case "error":
        return "text-red-400";
      case "success":
        return "text-green-400";
      case "warning":
        return "text-amber-400";
      case "hint":
        return "text-purple-400";
      case "suggestion":
        return "text-blue-400";
      default:
        return "text-slate-500";
    }
  };

  return (
    <div className={cn("flex flex-col bg-slate-950 overflow-hidden h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium text-slate-300">CLI Sandbox</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
            AI
          </span>
        </div>
        
        {/* Progress Stats */}
        {sessionProgress.totalCommands > 0 && (
          <div className="flex items-center gap-2 text-[10px]">
            {/* Streak */}
            {sessionProgress.currentStreak > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                <Zap className="w-3 h-3" />
                <span>{sessionProgress.currentStreak}</span>
              </div>
            )}
            {/* Points */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
              <Trophy className="w-3 h-3" />
              <span>{sessionProgress.totalPoints}</span>
            </div>
            {/* Accuracy */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
              <Target className="w-3 h-3" />
              <span>{Math.round((sessionProgress.correctCommands / sessionProgress.totalCommands) * 100)}%</span>
            </div>
            {/* Objectives */}
            {sessionProgress.objectivesCompleted.length > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>{sessionProgress.objectivesCompleted.length}</span>
              </div>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => getHelp(challengeContext?.aws_services[0] || "ec2")}
            className="h-7 px-2 text-xs text-slate-400 hover:text-white gap-1"
            title="Get contextual help"
          >
            <BookOpen className="w-3 h-3" />
            Help
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLines([])}
            className="h-7 w-7 p-0 text-slate-400 hover:text-white"
            title="Clear terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Terminal content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line) => (
          <div
            key={line.id}
            className={cn(
              "flex items-start gap-2 group leading-relaxed",
              getLineColor(line.type)
            )}
          >
            <span className="flex-1 whitespace-pre-wrap break-all">{line.content}</span>
            {line.type === "input" && (
              <button
                onClick={() => copyLine(line)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-800 rounded shrink-0"
                title="Copy"
              >
                {copiedId === line.id ? (
                  <Check className="w-3 h-3 text-green-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            )}
          </div>
        ))}
        
        {/* Current input line */}
        <div className="flex items-center gap-2 relative mt-1">
          <span className="text-green-400">$</span>
          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            className="flex-1 bg-transparent border-none outline-none text-cyan-400 placeholder:text-slate-600"
            placeholder={isExecuting ? "Executing..." : "Type AWS command..."}
            autoFocus
          />
          {isExecuting && (
            <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
          )}
        </div>
      </div>

      {/* Quick commands footer */}
      <div className="px-3 py-2 bg-slate-900/50 border-t border-slate-800 shrink-0">
        <div className="flex flex-wrap gap-1">
          {QUICK_COMMANDS.map((qc) => (
            <button
              key={qc.cmd}
              onClick={() => {
                setCurrentInput(qc.cmd);
                inputRef.current?.focus();
              }}
              className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-700 transition-colors"
            >
              {qc.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-600">
          <span>↑↓ History</span>
          <span>Enter Execute</span>
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            AI simulates responses
          </span>
        </div>
      </div>
    </div>
  );
}
