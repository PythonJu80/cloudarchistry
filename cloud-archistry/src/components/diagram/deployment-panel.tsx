"use client";

/**
 * Deployment Panel Component
 * 
 * Provides UI for:
 * - Previewing generated AWS CLI commands
 * - Viewing CloudFormation template
 * - Executing deployment
 * - Tracking deployment progress
 * - Downloading scripts/templates
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Play,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Terminal,
  FileCode,
  Rocket,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DiagramNode, DiagramEdge } from "@/components/diagram";
import { generateAwsCliCommands, type GeneratedCommand, type GenerationResult } from "@/lib/aws-cli-generator";
import { generateCloudFormation, templateToYaml } from "@/lib/cloudformation-generator";

// ============================================================================
// TYPES
// ============================================================================

interface DeploymentPanelProps {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  projectName?: string;
  environment?: string;
  region?: string;
  hasAwsCredentials: boolean;
  onClose?: () => void;
}

interface CommandStatus {
  id: string;
  status: "pending" | "running" | "success" | "error" | "skipped";
  output?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

type ViewMode = "cli" | "cloudformation" | "deploy";

// ============================================================================
// COMPONENT
// ============================================================================

export function DeploymentPanel({
  nodes,
  edges,
  projectName = "cloudarchistry",
  environment = "dev",
  region = "us-east-1",
  hasAwsCredentials,
  onClose,
}: DeploymentPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("cli");
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [cfnTemplate, setCfnTemplate] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedCommands, setExpandedCommands] = useState<Set<string>>(new Set());
  
  // Deployment state
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentPaused, setDeploymentPaused] = useState(false);
  const [commandStatuses, setCommandStatuses] = useState<Map<string, CommandStatus>>(new Map());
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0);

  // Generate commands when diagram changes - using useMemo pattern
  const generatedData = useMemo(() => {
    if (nodes.length === 0) {
      return { result: null, template: "" };
    }

    // Generate CLI commands
    const result = generateAwsCliCommands(nodes, edges, {
      projectName,
      environment,
      region,
      addTags: true,
      dryRun: false,
    });

    // Generate CloudFormation
    const cfnTemplate = generateCloudFormation(nodes, edges, {
      stackName: projectName,
      environment,
      region,
      includeOutputs: true,
      includeParameters: true,
    });

    return { result, template: templateToYaml(cfnTemplate) };
  }, [nodes, edges, projectName, environment, region]);

  // Update state from memoized data
  useEffect(() => {
    setGenerationResult(generatedData.result);
    setCfnTemplate(generatedData.template);
  }, [generatedData]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  // Download file
  const downloadFile = useCallback((content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Toggle command expansion
  const toggleCommand = (id: string) => {
    setExpandedCommands(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Execute single command
  const executeCommand = async (command: GeneratedCommand): Promise<{ success: boolean; output?: string; error?: string }> => {
    try {
      const response = await fetch("/api/aws/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: command.command,
          resourceType: command.resourceType,
          resourceName: command.resourceName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Command failed" };
      }

      return { success: true, output: data.output };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  };

  // Start deployment
  const startDeployment = async () => {
    if (!generationResult || !hasAwsCredentials) return;

    setIsDeploying(true);
    setDeploymentPaused(false);
    setCurrentCommandIndex(0);

    // Initialize all commands as pending
    const initialStatuses = new Map<string, CommandStatus>();
    generationResult.commands.forEach(cmd => {
      initialStatuses.set(cmd.id, { id: cmd.id, status: "pending" });
    });
    setCommandStatuses(initialStatuses);

    // Execute commands sequentially
    for (let i = 0; i < generationResult.commands.length; i++) {
      if (deploymentPaused) {
        break;
      }

      const cmd = generationResult.commands[i];
      setCurrentCommandIndex(i);

      // Update status to running
      setCommandStatuses(prev => {
        const next = new Map(prev);
        next.set(cmd.id, { id: cmd.id, status: "running", startedAt: new Date() });
        return next;
      });

      // Execute command
      const result = await executeCommand(cmd);

      // Update status based on result
      setCommandStatuses(prev => {
        const next = new Map(prev);
        next.set(cmd.id, {
          id: cmd.id,
          status: result.success ? "success" : "error",
          output: result.output,
          error: result.error,
          completedAt: new Date(),
        });
        return next;
      });

      // Stop on error
      if (!result.success) {
        break;
      }

      // Small delay between commands
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsDeploying(false);
  };

  // Pause deployment
  const pauseDeployment = () => {
    setDeploymentPaused(true);
  };

  // Reset deployment
  const resetDeployment = () => {
    setIsDeploying(false);
    setDeploymentPaused(false);
    setCurrentCommandIndex(0);
    setCommandStatuses(new Map());
  };

  // Get status icon
  const getStatusIcon = (status: CommandStatus["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-slate-400" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "skipped":
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    }
  };

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8">
        <Rocket className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">No resources to deploy</p>
        <p className="text-sm mt-1">Add AWS services to your diagram to generate deployment scripts</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Rocket className="w-5 h-5 text-cyan-400" />
          <h2 className="font-semibold">Deploy Infrastructure</h2>
        </div>
        
        {/* View mode tabs */}
        <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1">
          <button
            onClick={() => setViewMode("cli")}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-medium transition-colors",
              viewMode === "cli"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Terminal className="w-3.5 h-3.5 inline mr-1.5" />
            CLI Script
          </button>
          <button
            onClick={() => setViewMode("cloudformation")}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-medium transition-colors",
              viewMode === "cloudformation"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white"
            )}
          >
            <FileCode className="w-3.5 h-3.5 inline mr-1.5" />
            CloudFormation
          </button>
          <button
            onClick={() => setViewMode("deploy")}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-medium transition-colors",
              viewMode === "deploy"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Play className="w-3.5 h-3.5 inline mr-1.5" />
            Deploy
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {generationResult && (
        <div className="flex items-center gap-4 px-4 py-2 bg-slate-900/50 border-b border-slate-800 text-xs">
          <span className="text-slate-400">
            <strong className="text-white">{generationResult.summary.totalCommands}</strong> resources
          </span>
          <span className="text-slate-400">
            <Clock className="w-3 h-3 inline mr-1" />
            ~{Math.ceil(generationResult.summary.estimatedTime / 60)} min
          </span>
          {generationResult.warnings.length > 0 && (
            <span className="text-amber-400">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              {generationResult.warnings.length} warnings
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* CLI Script View */}
        {viewMode === "cli" && generationResult && (
          <div className="p-4 space-y-4">
            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(generationResult.script, "script")}
                className="gap-2"
              >
                {copied === "script" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Script
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadFile(generationResult.script, `${projectName}-deploy.sh`, "text/x-shellscript")}
                className="gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadFile(generationResult.rollbackScript, `${projectName}-rollback.sh`, "text/x-shellscript")}
                className="gap-2 text-red-400 border-red-400/30 hover:bg-red-400/10"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Rollback Script
              </Button>
            </div>

            {/* Command list */}
            <div className="space-y-2">
              {generationResult.commands.map((cmd, index) => (
                <div
                  key={cmd.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden"
                >
                  <button
                    onClick={() => toggleCommand(cmd.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-800/50"
                  >
                    {expandedCommands.has(cmd.id) ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="text-xs text-slate-500 w-6">{index + 1}</span>
                    <span className="flex-1 text-sm font-medium">{cmd.serviceName}</span>
                    <span className="text-xs text-slate-500">{cmd.resourceType}</span>
                    <span className="text-xs text-slate-400">~{cmd.estimatedTime}s</span>
                  </button>
                  
                  {expandedCommands.has(cmd.id) && (
                    <div className="px-3 pb-3 pt-1 border-t border-slate-800">
                      <p className="text-xs text-slate-400 mb-2">{cmd.description}</p>
                      <pre className="text-xs bg-slate-950 rounded p-2 overflow-x-auto font-mono text-green-400">
                        {cmd.command}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(cmd.command, cmd.id)}
                        className="mt-2 text-xs text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        {copied === cmd.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        Copy command
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CloudFormation View */}
        {viewMode === "cloudformation" && (
          <div className="p-4 space-y-4">
            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(cfnTemplate, "cfn")}
                className="gap-2"
              >
                {copied === "cfn" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Template
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadFile(cfnTemplate, `${projectName}-template.yaml`, "text/yaml")}
                className="gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Download YAML
              </Button>
            </div>

            {/* Template preview */}
            <pre className="text-xs bg-slate-900 rounded-lg p-4 overflow-x-auto font-mono text-slate-300 max-h-[500px]">
              {cfnTemplate}
            </pre>
          </div>
        )}

        {/* Deploy View */}
        {viewMode === "deploy" && generationResult && (
          <div className="p-4 space-y-4">
            {/* Credentials warning */}
            {!hasAwsCredentials && (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-400">AWS Credentials Required</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Go to Settings → AWS to add your credentials before deploying.
                  </p>
                </div>
              </div>
            )}

            {/* Deploy actions */}
            <div className="flex items-center gap-2">
              {!isDeploying ? (
                <Button
                  onClick={startDeployment}
                  disabled={!hasAwsCredentials}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Play className="w-4 h-4" />
                  Start Deployment
                </Button>
              ) : (
                <>
                  <Button
                    onClick={pauseDeployment}
                    variant="outline"
                    className="gap-2"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </Button>
                  <Button
                    onClick={resetDeployment}
                    variant="outline"
                    className="gap-2 text-red-400 border-red-400/30"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancel
                  </Button>
                </>
              )}
              
              {commandStatuses.size > 0 && !isDeploying && (
                <Button
                  onClick={resetDeployment}
                  variant="outline"
                  className="gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </Button>
              )}
            </div>

            {/* Progress */}
            {isDeploying && (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>
                  Deploying resource {currentCommandIndex + 1} of {generationResult.commands.length}...
                </span>
              </div>
            )}

            {/* Command status list */}
            <div className="space-y-2">
              {generationResult.commands.map((cmd, index) => {
                const status = commandStatuses.get(cmd.id);
                return (
                  <div
                    key={cmd.id}
                    className={cn(
                      "rounded-lg border bg-slate-900/50 overflow-hidden",
                      status?.status === "running" && "border-cyan-500/50",
                      status?.status === "success" && "border-green-500/30",
                      status?.status === "error" && "border-red-500/30",
                      !status && "border-slate-800"
                    )}
                  >
                    <div className="flex items-center gap-3 px-3 py-2">
                      {status ? getStatusIcon(status.status) : <Clock className="w-4 h-4 text-slate-600" />}
                      <span className="text-xs text-slate-500 w-6">{index + 1}</span>
                      <span className="flex-1 text-sm font-medium">{cmd.serviceName}</span>
                      <span className="text-xs text-slate-500">{cmd.resourceType}</span>
                    </div>
                    
                    {status?.error && (
                      <div className="px-3 pb-2 pt-1 border-t border-slate-800">
                        <p className="text-xs text-red-400">{status.error}</p>
                      </div>
                    )}
                    
                    {status?.output && (
                      <div className="px-3 pb-2 pt-1 border-t border-slate-800">
                        <pre className="text-xs text-slate-400 overflow-x-auto">{status.output}</pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/50">
        <p className="text-xs text-slate-500">
          ⚠️ Review all commands before deploying. This will create real AWS resources and may incur costs.
        </p>
      </div>
    </div>
  );
}
