"use client";

/**
 * Service Picker Sidebar
 * 
 * Displays AWS services organized by category for drag-and-drop onto the canvas.
 * Supports user-defined custom services that persist in localStorage.
 */

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  AWS_CATEGORIES,
  AWS_SERVICES,
  AWS_CATEGORY_COLORS,
  type AWSService,
  type AWSCategory,
} from "@/lib/aws-services";
import {
  Server,
  Database,
  HardDrive,
  Globe,
  Shield,
  Network,
  Layers,
  Cloud,
  Container,
  Zap,
  Box,
  Key,
  Users,
  Workflow,
  BarChart3,
  Bell,
  Activity,
  Route,
  Boxes,
  ChevronDown,
  ChevronRight,
  Search,
  GripVertical,
  Plus,
  X,
  Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Local storage key for custom services
const CUSTOM_SERVICES_KEY = "cloud-academy-custom-services";

// Icon mapping for all 47 core services + custom
const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  // Networking (14)
  "vpc": Network,
  "subnet-public": Layers,
  "subnet-private": Layers,
  "route-table": Route,
  "nacl": Shield,
  "security-group": Shield,
  "internet-gateway": Globe,
  "nat-gateway": Route,
  "vpc-peering": Network,
  "transit-gateway": Network,
  "alb": Boxes,
  "nlb": Boxes,
  "route53": Globe,
  "cloudfront": Cloud,
  // Compute (5)
  "ec2": Server,
  "auto-scaling": Boxes,
  "lambda": Zap,
  "ebs": HardDrive,
  "efs": HardDrive,
  // Containers (4)
  "ecs": Container,
  "eks": Container,
  "fargate": Container,
  "ecr": Box,
  // Database (6)
  "rds": Database,
  "aurora": Database,
  "dynamodb": Database,
  "elasticache": Database,
  "redshift": Database,
  "neptune": Database,
  // Storage (3)
  "s3": HardDrive,
  "glacier": HardDrive,
  "backup": HardDrive,
  // Security (7)
  "iam": Users,
  "kms": Key,
  "secrets-manager": Key,
  "cognito": Users,
  "waf": Shield,
  "shield": Shield,
  "guardduty": Shield,
  // Integration (4)
  "api-gateway": Workflow,
  "eventbridge": Activity,
  "sns": Bell,
  "sqs": Box,
  // Management (4)
  "cloudwatch": BarChart3,
  "cloudtrail": Activity,
  "systems-manager": Settings,
  "config": Settings,
  // Category icons
  "Network": Network,
  "Server": Server,
  "Container": Container,
  "Database": Database,
  "HardDrive": HardDrive,
  "Shield": Shield,
  "BarChart3": BarChart3,
  "Workflow": Workflow,
  "Settings": Settings,
  // Default for custom services
  "custom": Box,
};

// Available icons for custom services
const AVAILABLE_ICONS = [
  { id: "Server", label: "Server", icon: Server },
  { id: "Database", label: "Database", icon: Database },
  { id: "HardDrive", label: "Storage", icon: HardDrive },
  { id: "Network", label: "Network", icon: Network },
  { id: "Shield", label: "Security", icon: Shield },
  { id: "Cloud", label: "Cloud", icon: Cloud },
  { id: "Container", label: "Container", icon: Container },
  { id: "Zap", label: "Function", icon: Zap },
  { id: "Workflow", label: "Workflow", icon: Workflow },
  { id: "Box", label: "Generic", icon: Box },
];

interface ServicePickerProps {
  onDragStart: (event: React.DragEvent, service: AWSService) => void;
  suggestedServices?: string[]; // Service IDs to highlight
}

export function ServicePicker({ onDragStart, suggestedServices = [] }: ServicePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<AWSCategory>>(
    new Set(["networking", "compute", "database"])
  );
  
  // Custom services state
  const [customServices, setCustomServices] = useState<AWSService[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newService, setNewService] = useState({
    name: "",
    shortName: "",
    category: "compute" as AWSCategory,
    description: "",
    iconId: "Box",
  });

  // Load custom services from localStorage on mount
  useEffect(() => {
    // This is a valid use of setState in useEffect - loading initial state from external storage
    const loadCustomServices = () => {
      try {
        const saved = localStorage.getItem(CUSTOM_SERVICES_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setCustomServices(parsed);
        }
      } catch (e) {
        console.error("Failed to load custom services:", e);
      }
    };
    loadCustomServices();
  }, []);

  // Save custom services to localStorage
  const saveCustomServices = useCallback((services: AWSService[]) => {
    setCustomServices(services);
    localStorage.setItem(CUSTOM_SERVICES_KEY, JSON.stringify(services));
  }, []);

  // Add a new custom service
  const handleAddService = () => {
    if (!newService.name.trim() || !newService.shortName.trim()) return;
    
    const id = `custom-${newService.shortName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    const color = AWS_CATEGORY_COLORS[newService.category] || "#666666";
    
    const service: AWSService = {
      id,
      name: newService.name,
      shortName: newService.shortName,
      category: newService.category,
      color,
      description: newService.description || `Custom ${newService.category} service`,
    };
    
    // Add to icon map dynamically
    iconMap[id] = iconMap[newService.iconId] || Box;
    
    saveCustomServices([...customServices, service]);
    setShowAddDialog(false);
    setNewService({ name: "", shortName: "", category: "compute", description: "", iconId: "Box" });
  };

  // Remove a custom service
  const handleRemoveService = (serviceId: string) => {
    saveCustomServices(customServices.filter(s => s.id !== serviceId));
  };

  // Combine core and custom services
  const allServices = [...AWS_SERVICES, ...customServices];

  const toggleCategory = (category: AWSCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Filter services based on search (including custom)
  const filteredServices = searchQuery.trim()
    ? allServices.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;
  
  // Get services by category (including custom)
  const getServicesForCategory = (category: AWSCategory) => {
    return allServices.filter(s => s.category === category);
  };

  const handleDragStart = (event: React.DragEvent, service: AWSService) => {
    event.dataTransfer.effectAllowed = "move";
    onDragStart(event, service);
  };

  return (
    <div className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-slate-200">AWS Services</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="h-6 w-6 p-0 text-slate-400 hover:text-cyan-400"
            title="Add custom service"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search services..."
            className="h-8 pl-7 text-xs bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Suggested Services (if any) */}
      {suggestedServices.length > 0 && !searchQuery && (
        <div className="p-2 border-b border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 px-1">Suggested</p>
          <div className="space-y-1">
            {suggestedServices.map((serviceId) => {
              const service = AWS_SERVICES.find((s) => s.id === serviceId);
              if (!service) return null;
              const Icon = iconMap[service.id] || Server;
              return (
                <div
                  key={service.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, service)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded bg-cyan-500/10 border border-cyan-500/30 cursor-grab hover:bg-cyan-500/20 transition-colors group"
                >
                  <GripVertical className="w-3 h-3 text-slate-600 group-hover:text-slate-400" />
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${service.color}20` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: service.color }} />
                  </div>
                  <span className="text-xs text-cyan-300">{service.shortName}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Service List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredServices ? (
          // Search results
          <div className="space-y-1">
            {filteredServices.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No services found</p>
            ) : (
              filteredServices.map((service) => (
                <ServiceItem
                  key={service.id}
                  service={service}
                  onDragStart={handleDragStart}
                  isSuggested={suggestedServices.includes(service.id)}
                />
              ))
            )}
          </div>
        ) : (
          // Category view
          <div className="space-y-1">
            {AWS_CATEGORIES.map((category) => {
              const CategoryIcon = iconMap[category.icon] || Network;
              const isExpanded = expandedCategories.has(category.id);
              const services = getServicesForCategory(category.id);

              return (
                <div key={category.id}>
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <CategoryIcon className="w-4 h-4" style={{ color: category.color }} />
                    <span className="text-xs font-medium text-slate-300">{category.name}</span>
                    <span className="text-[10px] text-slate-600 ml-auto">{services.length}</span>
                  </button>

                  {/* Services in category */}
                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-0.5">
                      {services.map((service) => (
                        <ServiceItem
                          key={service.id}
                          service={service}
                          onDragStart={handleDragStart}
                          isSuggested={suggestedServices.includes(service.id)}
                          isCustom={service.id.startsWith("custom-")}
                          onRemove={service.id.startsWith("custom-") ? () => handleRemoveService(service.id) : undefined}
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

      {/* Footer hint */}
      <div className="p-2 border-t border-slate-800">
        <p className="text-[10px] text-slate-600 text-center">
          Drag services onto the canvas
        </p>
      </div>

      {/* Add Custom Service Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Add Custom Service</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Service Name</label>
              <Input
                value={newService.name}
                onChange={(e) => setNewService(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Amazon MQ"
                className="bg-slate-800 border-slate-700 text-slate-200"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Short Name (for diagram)</label>
              <Input
                value={newService.shortName}
                onChange={(e) => setNewService(prev => ({ ...prev, shortName: e.target.value }))}
                placeholder="e.g., MQ"
                className="bg-slate-800 border-slate-700 text-slate-200"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Category</label>
              <select
                value={newService.category}
                onChange={(e) => setNewService(prev => ({ ...prev, category: e.target.value as AWSCategory }))}
                className="w-full h-9 px-3 rounded-md bg-slate-800 border border-slate-700 text-slate-200 text-sm"
              >
                {AWS_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Icon</label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_ICONS.map(({ id, label, icon: IconComp }) => (
                  <button
                    key={id}
                    onClick={() => setNewService(prev => ({ ...prev, iconId: id }))}
                    className={cn(
                      "w-10 h-10 rounded flex items-center justify-center border transition-colors",
                      newService.iconId === id
                        ? "border-cyan-500 bg-cyan-500/20"
                        : "border-slate-700 hover:border-slate-600"
                    )}
                    title={label}
                  >
                    <IconComp className="w-5 h-5 text-slate-300" />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Description (optional)</label>
              <Input
                value={newService.description}
                onChange={(e) => setNewService(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description..."
                className="bg-slate-800 border-slate-700 text-slate-200"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowAddDialog(false)}
              className="text-slate-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddService}
              disabled={!newService.name.trim() || !newService.shortName.trim()}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              Add Service
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Individual service item
function ServiceItem({
  service,
  onDragStart,
  isSuggested,
  isCustom,
  onRemove,
}: {
  service: AWSService;
  onDragStart: (event: React.DragEvent, service: AWSService) => void;
  isSuggested: boolean;
  isCustom?: boolean;
  onRemove?: () => void;
}) {
  const Icon = iconMap[service.id] || iconMap[service.id.split("-")[0]] || Server;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, service)}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded cursor-grab transition-colors group",
        isSuggested
          ? "bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20"
          : isCustom
          ? "bg-amber-500/5 hover:bg-amber-500/10"
          : "hover:bg-slate-800"
      )}
    >
      <GripVertical className="w-3 h-3 text-slate-700 group-hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div
        className="w-5 h-5 rounded flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${service.color}15` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: service.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs truncate",
          isSuggested ? "text-cyan-300" : isCustom ? "text-amber-300" : "text-slate-300"
        )}>
          {service.shortName}
        </p>
      </div>
      {isCustom && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"
          title="Remove custom service"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      {service.isContainer && !isCustom && (
        <span className="text-[8px] text-slate-600 bg-slate-800 px-1 rounded">box</span>
      )}
    </div>
  );
}
