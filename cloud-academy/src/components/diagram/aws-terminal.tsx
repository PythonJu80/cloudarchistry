"use client";

/**
 * AWS Terminal Component
 * 
 * Interactive terminal for executing AWS CLI commands.
 * Commands are executed via API with user's encrypted AWS credentials.
 * 
 * Features:
 * - Command history (up/down arrows)
 * - Auto-complete for common AWS commands
 * - Real-time output streaming
 * - Command validation before execution
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Terminal, 
  Trash2, 
  Copy, 
  Check,
  AlertTriangle,
  Loader2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ============================================================================
// TYPES
// ============================================================================

export interface TerminalLine {
  id: string;
  type: "input" | "output" | "error" | "info" | "success" | "warning";
  content: string;
  timestamp: Date;
}

export interface AwsTerminalProps {
  className?: string;
  onCommandExecuted?: (command: string, output: string) => void;
  initialCommands?: string[];
  readOnly?: boolean;
  hasAwsCredentials?: boolean;
}

// Common AWS CLI commands for auto-complete
const AWS_COMMANDS = [
  "aws ec2 describe-instances",
  "aws ec2 describe-vpcs",
  "aws ec2 describe-subnets",
  "aws ec2 describe-security-groups",
  "aws ec2 run-instances",
  "aws ec2 create-vpc",
  "aws ec2 create-subnet",
  "aws s3 ls",
  "aws s3 mb",
  "aws s3 cp",
  "aws s3 sync",
  "aws rds describe-db-instances",
  "aws rds create-db-instance",
  "aws lambda list-functions",
  "aws lambda create-function",
  "aws lambda invoke",
  "aws iam list-users",
  "aws iam list-roles",
  "aws sts get-caller-identity",
  "aws cloudformation describe-stacks",
  "aws cloudformation create-stack",
  "aws cloudformation deploy",
];

// Dangerous commands that require confirmation
const DANGEROUS_PATTERNS = [
  /delete/i,
  /terminate/i,
  /remove/i,
  /destroy/i,
  /--force/i,
  /drop/i,
];

// ============================================================================
// COMPONENT
// ============================================================================

export function AwsTerminal({
  className,
  onCommandExecuted,
  initialCommands = [],
  readOnly = false,
  hasAwsCredentials = false,
}: AwsTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Add initial welcome message (only on mount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    addLine("info", "AWS CLI Terminal - Cloud Academy");
    addLine("info", "Type 'help' for available commands or start with 'aws ...'");
    if (!hasAwsCredentials) {
      addLine("warning", "⚠️ No AWS credentials configured. Go to Settings to add your AWS keys.");
    }
  }, []);

  // Run initial commands (only when they change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialCommands.length > 0) {
      initialCommands.forEach((cmd) => {
        addLine("input", `$ ${cmd}`);
        addLine("info", `[Queued] ${cmd}`);
      });
    }
  }, [initialCommands]);

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

  // Check if command is dangerous
  const isDangerous = (cmd: string): boolean => {
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(cmd));
  };

  // Execute command via API
  const executeCommand = async (command: string) => {
    if (!command.trim()) return;
    
    // Add to history
    setCommandHistory((prev) => [...prev.filter((c) => c !== command), command]);
    setHistoryIndex(-1);
    
    // Show input
    addLine("input", `$ ${command}`);
    
    // Handle built-in commands
    if (command === "help") {
      addLine("info", "Available commands:");
      addLine("info", "  aws <service> <command>  - Execute AWS CLI command");
      addLine("info", "  clear                    - Clear terminal");
      addLine("info", "  history                  - Show command history");
      addLine("info", "  help                     - Show this help");
      return;
    }
    
    if (command === "clear") {
      setLines([]);
      return;
    }
    
    if (command === "history") {
      if (commandHistory.length === 0) {
        addLine("info", "No command history");
      } else {
        commandHistory.forEach((cmd, i) => {
          addLine("info", `  ${i + 1}  ${cmd}`);
        });
      }
      return;
    }
    
    // Validate AWS command
    if (!command.startsWith("aws ")) {
      addLine("error", "Commands must start with 'aws'. Type 'help' for usage.");
      return;
    }
    
    // Check credentials
    if (!hasAwsCredentials) {
      addLine("error", "No AWS credentials configured. Go to Settings → AWS to add your credentials.");
      return;
    }
    
    // Check for dangerous commands
    if (isDangerous(command)) {
      addLine("warning", "⚠️ This command may be destructive. Execution requires confirmation.");
      addLine("warning", "Add --dry-run to preview or use the AWS Console for destructive operations.");
      return;
    }
    
    // Execute via API
    setIsExecuting(true);
    addLine("info", "Executing...");
    
    try {
      const response = await fetch("/api/aws/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        addLine("error", data.error || "Command failed");
        if (data.details) {
          addLine("error", data.details);
        }
      } else {
        // Parse and display output
        if (data.output) {
          const outputLines = data.output.split("\n");
          outputLines.forEach((line: string) => {
            if (line.trim()) {
              addLine("output", line);
            }
          });
        }
        
        if (data.exitCode === 0) {
          addLine("success", `✓ Command completed successfully`);
        }
        
        onCommandExecuted?.(command, data.output || "");
      }
    } catch (error) {
      addLine("error", `Failed to execute: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle input change with suggestions
  const handleInputChange = (value: string) => {
    setCurrentInput(value);
    
    if (value.startsWith("aws ") && value.length > 4) {
      const matches = AWS_COMMANDS.filter((cmd) =>
        cmd.toLowerCase().startsWith(value.toLowerCase())
      ).slice(0, 5);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle key events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isExecuting) {
      executeCommand(currentInput);
      setCurrentInput("");
      setShowSuggestions(false);
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
    } else if (e.key === "Tab" && suggestions.length > 0) {
      e.preventDefault();
      setCurrentInput(suggestions[0]);
      setShowSuggestions(false);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
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
      default:
        return "text-slate-500";
    }
  };

  return (
    <div className={cn("flex flex-col bg-slate-950 rounded-lg border border-slate-800 overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
        >
          <Terminal className="w-4 h-4 text-green-500" />
          <span>AWS Terminal</span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          )}
        </button>
        
        <div className="flex items-center gap-1">
          {!hasAwsCredentials && (
            <div className="flex items-center gap-1 text-xs text-amber-400 mr-2">
              <AlertTriangle className="w-3 h-3" />
              <span>No credentials</span>
            </div>
          )}
          
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
      {isExpanded && (
        <>
          <div
            ref={scrollRef}
            className="flex-1 min-h-[200px] max-h-[400px] overflow-y-auto p-3 font-mono text-xs space-y-1"
            onClick={() => inputRef.current?.focus()}
          >
            {lines.map((line) => (
              <div
                key={line.id}
                className={cn(
                  "flex items-start gap-2 group",
                  getLineColor(line.type)
                )}
              >
                <span className="flex-1 whitespace-pre-wrap break-all">{line.content}</span>
                <button
                  onClick={() => copyLine(line)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-800 rounded"
                  title="Copy"
                >
                  {copiedId === line.id ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            ))}
            
            {/* Current input line */}
            {!readOnly && (
              <div className="flex items-center gap-2 relative">
                <span className="text-green-400">$</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={currentInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isExecuting}
                  className="flex-1 bg-transparent border-none outline-none text-cyan-400 placeholder:text-slate-600"
                  placeholder={isExecuting ? "Executing..." : "Type AWS command..."}
                  autoFocus
                />
                {isExecuting && (
                  <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
                )}
                
                {/* Suggestions dropdown */}
                {showSuggestions && (
                  <div className="absolute left-4 top-full mt-1 bg-slate-800 border border-slate-700 rounded shadow-lg z-10 max-w-md">
                    {suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setCurrentInput(suggestion);
                          setShowSuggestions(false);
                          inputRef.current?.focus();
                        }}
                        className="block w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 first:rounded-t last:rounded-b"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer with hints */}
          <div className="px-3 py-2 bg-slate-900/50 border-t border-slate-800 text-[10px] text-slate-500 flex items-center gap-4">
            <span>↑↓ History</span>
            <span>Tab Autocomplete</span>
            <span>Enter Execute</span>
          </div>
        </>
      )}
    </div>
  );
}
