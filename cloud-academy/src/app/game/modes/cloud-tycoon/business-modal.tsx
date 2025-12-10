"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Lightbulb, 
  CheckCircle2, 
  XCircle,
  DollarSign,
  Loader2,
  GripVertical,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Business, RequiredService } from "./types";

// AWS Services for the picker - MUST match IDs from learning_agent/generators/cloud_tycoon.py
const AWS_SERVICES = [
  // COMPUTE
  { id: "ec2", name: "EC2", category: "compute", color: "#ED7100" },
  { id: "lambda", name: "Lambda", category: "compute", color: "#ED7100" },
  { id: "auto-scaling", name: "Auto Scaling", category: "compute", color: "#ED7100" },
  // CONTAINERS
  { id: "ecs", name: "ECS", category: "containers", color: "#ED7100" },
  { id: "eks", name: "EKS", category: "containers", color: "#ED7100" },
  { id: "fargate", name: "Fargate", category: "containers", color: "#ED7100" },
  // DATABASE
  { id: "rds", name: "RDS", category: "database", color: "#3B48CC" },
  { id: "aurora", name: "Aurora", category: "database", color: "#3B48CC" },
  { id: "dynamodb", name: "DynamoDB", category: "database", color: "#3B48CC" },
  { id: "elasticache", name: "ElastiCache", category: "database", color: "#3B48CC" },
  { id: "redshift", name: "Redshift", category: "database", color: "#3B48CC" },
  { id: "neptune", name: "Neptune", category: "database", color: "#3B48CC" },
  // STORAGE
  { id: "s3", name: "S3", category: "storage", color: "#3F8624" },
  { id: "efs", name: "EFS", category: "storage", color: "#3F8624" },
  { id: "ebs", name: "EBS", category: "storage", color: "#3F8624" },
  { id: "glacier", name: "Glacier", category: "storage", color: "#3F8624" },
  { id: "backup", name: "Backup", category: "storage", color: "#3F8624" },
  // NETWORKING
  { id: "vpc", name: "VPC", category: "networking", color: "#8C4FFF" },
  { id: "alb", name: "ALB", category: "networking", color: "#8C4FFF" },
  { id: "nlb", name: "NLB", category: "networking", color: "#8C4FFF" },
  { id: "cloudfront", name: "CloudFront", category: "networking", color: "#8C4FFF" },
  { id: "route53", name: "Route 53", category: "networking", color: "#8C4FFF" },
  { id: "api-gateway", name: "API Gateway", category: "networking", color: "#8C4FFF" },
  // SECURITY
  { id: "iam", name: "IAM", category: "security", color: "#DD344C" },
  { id: "kms", name: "KMS", category: "security", color: "#DD344C" },
  { id: "secrets-manager", name: "Secrets Mgr", category: "security", color: "#DD344C" },
  { id: "waf", name: "WAF", category: "security", color: "#DD344C" },
  { id: "shield", name: "Shield", category: "security", color: "#DD344C" },
  { id: "cognito", name: "Cognito", category: "security", color: "#DD344C" },
  { id: "guardduty", name: "GuardDuty", category: "security", color: "#DD344C" },
  // INTEGRATION
  { id: "sqs", name: "SQS", category: "integration", color: "#E7157B" },
  { id: "sns", name: "SNS", category: "integration", color: "#E7157B" },
  { id: "eventbridge", name: "EventBridge", category: "integration", color: "#E7157B" },
  { id: "step-functions", name: "Step Functions", category: "integration", color: "#E7157B" },
  // ANALYTICS
  { id: "kinesis", name: "Kinesis", category: "analytics", color: "#8C4FFF" },
  { id: "athena", name: "Athena", category: "analytics", color: "#8C4FFF" },
  { id: "glue", name: "Glue", category: "analytics", color: "#8C4FFF" },
  { id: "quicksight", name: "QuickSight", category: "analytics", color: "#8C4FFF" },
  // MANAGEMENT
  { id: "cloudwatch", name: "CloudWatch", category: "management", color: "#E7157B" },
  { id: "cloudtrail", name: "CloudTrail", category: "management", color: "#E7157B" },
  { id: "cloudformation", name: "CloudFormation", category: "management", color: "#E7157B" },
  // DISTRACTORS - Common services that make the game harder
  { id: "elastic-beanstalk", name: "Elastic Beanstalk", category: "compute", color: "#ED7100" },
  { id: "lightsail", name: "Lightsail", category: "compute", color: "#ED7100" },
  { id: "documentdb", name: "DocumentDB", category: "database", color: "#3B48CC" },
  { id: "memorydb", name: "MemoryDB", category: "database", color: "#3B48CC" },
  { id: "fsx", name: "FSx", category: "storage", color: "#3F8624" },
  { id: "transfer-family", name: "Transfer Family", category: "storage", color: "#3F8624" },
  { id: "direct-connect", name: "Direct Connect", category: "networking", color: "#8C4FFF" },
  { id: "global-accelerator", name: "Global Accelerator", category: "networking", color: "#8C4FFF" },
  { id: "inspector", name: "Inspector", category: "security", color: "#DD344C" },
  { id: "macie", name: "Macie", category: "security", color: "#DD344C" },
  { id: "mq", name: "Amazon MQ", category: "integration", color: "#E7157B" },
  { id: "appsync", name: "AppSync", category: "integration", color: "#E7157B" },
  { id: "msk", name: "MSK (Kafka)", category: "analytics", color: "#8C4FFF" },
  { id: "opensearch", name: "OpenSearch", category: "analytics", color: "#8C4FFF" },
  { id: "xray", name: "X-Ray", category: "management", color: "#E7157B" },
  { id: "config", name: "Config", category: "management", color: "#E7157B" },
];

type AWSServiceType = typeof AWS_SERVICES[0];

interface BusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: Business | null;
  onComplete: (businessId: string, earnings: number, isPerfect: boolean) => void;
  apiKey?: string | null;
}

// Draggable Service Chip with native HTML5 drag
function DraggableService({ 
  service, 
  onDragStart 
}: { 
  service: AWSServiceType;
  onDragStart: (e: React.DragEvent, service: AWSServiceType) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, service)}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-grab transition-all bg-slate-800 border border-slate-700 hover:border-slate-600 hover:bg-slate-700"
    >
      <GripVertical className="w-3 h-3 text-slate-600" />
      <div 
        className="w-2 h-2 rounded-full" 
        style={{ backgroundColor: service.color }}
      />
      <span className="text-xs text-slate-300">{service.name}</span>
    </div>
  );
}

// Droppable Slot with native HTML5 drop
function DroppableSlot({ 
  index, 
  service, 
  onRemove,
  onDrop,
  isOver,
}: { 
  index: number; 
  service: AWSServiceType | null;
  onRemove: () => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  isOver: boolean;
}) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, index)}
      className={cn(
        "relative h-12 rounded-lg border-2 border-dashed transition-all flex items-center justify-center",
        isOver 
          ? "border-green-500 bg-green-500/10" 
          : service 
            ? "border-slate-600 bg-slate-800" 
            : "border-slate-700 bg-slate-900"
      )}
    >
      {service ? (
        <div className="flex items-center gap-2 px-3">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: service.color }}
          />
          <span className="text-sm text-slate-200">{service.name}</span>
          <button
            onClick={onRemove}
            className="ml-2 text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <span className="text-xs text-slate-600">Drop service here</span>
      )}
    </div>
  );
}

export function BusinessModal({ 
  isOpen, 
  onClose, 
  business, 
  onComplete,
}: BusinessModalProps) {
  const [droppedServices, setDroppedServices] = useState<(AWSServiceType | null)[]>([]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<{
    correct: boolean;
    score: number;
    matched: string[];
    missing: string[];
    extra: string[];
    contract_earned: number;
    feedback: string;
    required_services: RequiredService[];
  } | null>(null);

  // Reset state when business changes
  useEffect(() => {
    if (isOpen && business) {
      setDroppedServices(new Array(business.required_services.length).fill(null));
      setShowHints(false);
      setHintsRevealed(0);
      setResult(null);
      setDragOverIndex(null);
    }
  }, [isOpen, business]);

  const handleDragStart = (e: React.DragEvent, service: AWSServiceType) => {
    e.dataTransfer.setData("application/json", JSON.stringify(service));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    try {
      const serviceData = e.dataTransfer.getData("application/json");
      const service = JSON.parse(serviceData) as AWSServiceType;
      
      setDroppedServices(prev => {
        const newSlots = [...prev];
        // Remove service from any existing slot
        const existingIndex = newSlots.findIndex(s => s?.id === service.id);
        if (existingIndex !== -1) {
          newSlots[existingIndex] = null;
        }
        // Add to new slot
        newSlots[slotIndex] = service;
        return newSlots;
      });
    } catch (err) {
      console.error("Drop error:", err);
    }
  };

  const removeFromSlot = (index: number) => {
    setDroppedServices(prev => {
      const newSlots = [...prev];
      newSlots[index] = null;
      return newSlots;
    });
  };

  const handleSubmit = async () => {
    if (!business) return;
    
    const submittedIds = droppedServices
      .filter((s): s is AWSServiceType => s !== null)
      .map(s => s.id);
    
    if (submittedIds.length === 0) return;
    
    setIsValidating(true);
    
    try {
      const response = await fetch("/api/game/tycoon/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          use_case_id: business.id,
          business_name: business.business_name,
          use_case_title: business.use_case_title,
          use_case_description: business.use_case_description,
          required_services: business.required_services,
          contract_value: business.contract_value,
          difficulty: business.difficulty,
          submitted_services: submittedIds,
        }),
      });
      
      const data = await response.json();
      console.log("Validation response:", data);
      console.log("Business required_services:", business.required_services);
      setResult(data);
    } catch (error) {
      console.error("Validation failed:", error);
    } finally {
      setIsValidating(false);
    }
  };

  const handleComplete = () => {
    if (!business || !result) return;
    onComplete(business.id, result.contract_earned, result.correct);
  };

  const revealHint = () => {
    if (business && hintsRevealed < business.hints.length) {
      setHintsRevealed(prev => prev + 1);
    }
  };

  const filledSlots = droppedServices.filter(s => s !== null).length;
  const difficultyColor = {
    easy: "text-green-400 bg-green-500/20",
    medium: "text-amber-400 bg-amber-500/20",
    hard: "text-red-400 bg-red-500/20",
  }[business?.difficulty || "medium"];

  if (!business) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-4xl h-[85vh] p-0 gap-0 bg-slate-950 border border-slate-800 overflow-hidden flex flex-col"
      >
        <VisuallyHidden>
          <DialogTitle>{business.business_name}</DialogTitle>
        </VisuallyHidden>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{business.icon}</span>
            <div>
              <h2 className="text-xl font-bold text-white">{business.business_name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-500">{business.industry}</span>
                <span className={cn("text-xs px-2 py-0.5 rounded", difficultyColor)}>
                  {business.difficulty}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
              <DollarSign className="w-5 h-5 text-green-400" />
              <span className="text-lg font-bold text-green-400">
                ${business.contract_value.toLocaleString()}
              </span>
            </div>
                      </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left side - Use Case & Slots */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Use Case Description */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-400 mb-2">Use Case</h3>
              <p className="text-slate-200 leading-relaxed">
                {business.use_case_description}
              </p>
              
              {business.compliance_requirements && business.compliance_requirements.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {business.compliance_requirements.map(req => (
                    <span 
                      key={req}
                      className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    >
                      {req}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Service Slots */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-400">
                  Required Services ({filledSlots}/{business.required_services.length})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHints(!showHints)}
                  className="text-amber-400 hover:text-amber-300 gap-1.5"
                >
                  <Lightbulb className="w-4 h-4" />
                  Hints
                </Button>
              </div>
              
              <div 
                className="grid gap-3"
                onDragOver={(e) => e.preventDefault()}
              >
                {droppedServices.map((service, index) => (
                  <div
                    key={index}
                    onDragEnter={() => setDragOverIndex(index)}
                    onDragLeave={() => setDragOverIndex(null)}
                  >
                    <DroppableSlot
                      index={index}
                      service={service}
                      onRemove={() => removeFromSlot(index)}
                      onDrop={handleDrop}
                      isOver={dragOverIndex === index}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Hints */}
            <AnimatePresence>
              {showHints && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6"
                >
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-amber-400">Hints</span>
                      {hintsRevealed < business.hints.length && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={revealHint}
                          className="text-xs text-amber-400"
                        >
                          Reveal hint ({hintsRevealed}/{business.hints.length})
                        </Button>
                      )}
                    </div>
                    <ul className="space-y-1">
                      {business.hints.slice(0, hintsRevealed).map((hint, i) => (
                        <li key={i} className="text-sm text-amber-200">• {hint}</li>
                      ))}
                      {hintsRevealed === 0 && (
                        <li className="text-sm text-slate-500 italic">Click reveal to see hints</li>
                      )}
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            {!result && (
              <Button
                onClick={handleSubmit}
                disabled={filledSlots === 0 || isValidating}
                className="w-full bg-green-600 hover:bg-green-700 gap-2"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Submit Proposal
                  </>
                )}
              </Button>
            )}

            {/* Result */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-6 rounded-lg border",
                    result.correct 
                      ? "bg-green-500/10 border-green-500/30" 
                      : "bg-amber-500/10 border-amber-500/30"
                  )}
                >
                  <div className="flex items-center gap-3 mb-4">
                    {result.correct ? (
                      <CheckCircle2 className="w-8 h-8 text-green-400" />
                    ) : (
                      <XCircle className="w-8 h-8 text-amber-400" />
                    )}
                    <div>
                      <p className="text-lg font-bold text-white">
                        {result.correct ? "Perfect Match!" : "Partial Match"}
                      </p>
                      <p className="text-2xl font-bold text-green-400">
                        +${(result.contract_earned || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-300 mb-4">{result.feedback}</p>
                  
                  {/* Show required services with reasons */}
                  {!result.correct && (
                    <div className="mb-4">
                      <p className="text-xs text-slate-500 mb-2">Correct solution:</p>
                      <div className="space-y-2">
                        {(result.required_services || []).map(svc => (
                          <div 
                            key={svc.service_id}
                            className="flex items-start gap-2 text-sm"
                          >
                            <span className="text-cyan-400 font-medium">{svc.service_name}:</span>
                            <span className="text-slate-400">{svc.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <Button
                    onClick={handleComplete}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Continue Journey
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right side - Service Picker */}
          <div className="w-72 border-l border-slate-800 bg-slate-900 p-4 overflow-y-auto">
            <h3 className="text-sm font-medium text-slate-400 mb-4">AWS Services</h3>
            <p className="text-xs text-slate-600 mb-4">Drag services to the slots</p>
            
            {/* Group by category */}
            {["compute", "containers", "database", "storage", "networking", "security", "integration", "analytics", "management"].map(category => {
              const services = AWS_SERVICES.filter(s => s.category === category);
              if (services.length === 0) return null;
              
              return (
                <div key={category} className="mb-4">
                  <p className="text-xs text-slate-600 uppercase tracking-wider mb-2">
                    {category}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {services.map(service => (
                      <DraggableService 
                        key={service.id} 
                        service={service} 
                        onDragStart={handleDragStart}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
