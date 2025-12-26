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
  ChevronRight,
  ChevronDown,
  Network,
  Server,
  Container,
  Database,
  HardDrive,
  Shield,
  FileText,
  BarChart3,
  Workflow,
  GitBranch,
  Settings,
  Building,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Business, RequiredService } from "./types";
import { AWS_SERVICES, AWS_CATEGORIES, type AWSService } from "@/lib/aws-services";

// Use the full AWS services from the shared registry
type AWSServiceType = AWSService;

// Icon map for categories
const categoryIconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Network,
  Server,
  Container,
  Database,
  HardDrive,
  Shield,
  FileText,
  BarChart3,
  Workflow,
  GitBranch,
  Settings,
  Building,
};

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
      <span className="text-xs text-slate-300">{service.shortName}</span>
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
          <span className="text-sm text-slate-200">{service.shortName}</span>
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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set()); // All collapsed by default
  const [searchQuery, setSearchQuery] = useState("");
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
      const response = await fetch("/api/gaming/tycoon/validate", {
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
          <div className="w-72 border-l border-slate-800 bg-slate-900 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-300">AWS Services</h3>
                <span className="text-[10px] text-slate-600">{AWS_SERVICES.length}</span>
              </div>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-slate-600"
                />
              </div>
            </div>
            
            {/* Categories - Collapsible */}
            <div className="flex-1 overflow-y-auto p-2">
              {searchQuery ? (
                // Search results
                <div className="space-y-0.5">
                  {AWS_SERVICES.filter(s => 
                    s.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    s.name.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map(service => (
                    <DraggableService 
                      key={service.id} 
                      service={service} 
                      onDragStart={handleDragStart}
                    />
                  ))}
                </div>
              ) : (
                // Category view
                <div className="space-y-1">
                  {AWS_CATEGORIES.map(cat => {
                    const CategoryIcon = categoryIconMap[cat.icon] || Network;
                    const isExpanded = expandedCategories.has(cat.id);
                    const services = AWS_SERVICES.filter(s => s.category === cat.id);
                    if (services.length === 0) return null;
                    
                    return (
                      <div key={cat.id}>
                        {/* Category header */}
                        <button
                          onClick={() => {
                            setExpandedCategories(prev => {
                              const next = new Set(prev);
                              if (next.has(cat.id)) {
                                next.delete(cat.id);
                              } else {
                                next.add(cat.id);
                              }
                              return next;
                            });
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <CategoryIcon className="w-4 h-4" style={{ color: cat.color }} />
                          <span className="text-xs font-medium text-slate-300">{cat.name}</span>
                          <span className="text-[10px] text-slate-600 ml-auto">{services.length}</span>
                        </button>
                        
                        {/* Services in category */}
                        {isExpanded && (
                          <div className="ml-5 mt-1 space-y-0.5">
                            {services.map(service => (
                              <DraggableService 
                                key={service.id} 
                                service={service} 
                                onDragStart={handleDragStart}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-2 border-t border-slate-800">
              <p className="text-[10px] text-slate-600 text-center">
                Drag services to the slots
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
