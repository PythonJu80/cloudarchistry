"use client";

/**
 * Service Picker Sidebar
 * 
 * Canva/Draw.io style sidebar with icon strip navigation.
 * Displays AWS services, shapes, styles, and controls.
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
  ArrowLeft,
  Save,
  Undo2,
  Redo2,
  Copy,
  Clipboard,
  Trash2,
  Grid3X3,
  ZoomIn,
  ZoomOut,
  Maximize,
  MousePointer2,
  RotateCcw,
  Loader2,
  // New icons for sidebar tabs
  LayoutGrid,
  Shapes,
  Palette,
  FileText,
  ScrollText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Sidebar tab types
type SidebarTab = "services" | "shapes" | "style" | "controls";

// Local storage key for custom services
const CUSTOM_SERVICES_KEY = "cloud-academy-custom-services";

// Icon mapping for all 95+ core services + custom
const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  // Networking (19)
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
  "global-accelerator": Globe,
  "vpn-gateway": Network,
  "direct-connect": Network,
  "privatelink": Network,
  "elastic-ip": Network,
  // Compute (7)
  "ec2": Server,
  "auto-scaling": Boxes,
  "lambda": Zap,
  "ebs": HardDrive,
  "efs": HardDrive,
  "batch": Server,
  "lightsail": Server,
  // Containers (4)
  "ecs": Container,
  "eks": Container,
  "fargate": Container,
  "ecr": Box,
  // Database (9)
  "rds": Database,
  "aurora": Database,
  "dynamodb": Database,
  "elasticache": Database,
  "redshift": Database,
  "neptune": Database,
  "documentdb": Database,
  "memorydb": Database,
  "rds-replica": Database,
  // Storage (6)
  "s3": HardDrive,
  "glacier": HardDrive,
  "backup": HardDrive,
  "fsx": HardDrive,
  "storage-gateway": HardDrive,
  "datasync": HardDrive,
  // Security (21)
  "iam": Users,
  "kms": Key,
  "secrets-manager": Key,
  "cognito": Users,
  "waf": Shield,
  "shield": Shield,
  "guardduty": Shield,
  "iam-role": Users,
  "iam-policy": Shield,
  "permission-boundary": Shield,
  "acm": Key,
  "inspector": Shield,
  "macie": Shield,
  "security-hub": Shield,
  "detective": Shield,
  "iam-user": Users,
  "iam-group": Users,
  "resource-policy": Shield,
  "trust-policy": Shield,
  "identity-provider": Users,
  "iam-identity-center": Users,
  // Integration (8)
  "api-gateway": Workflow,
  "eventbridge": Activity,
  "sns": Bell,
  "sqs": Box,
  "step-functions": Workflow,
  "appsync": Workflow,
  "mq": Box,
  "ses": Bell,
  // Management (10)
  "cloudwatch": BarChart3,
  "cloudtrail": Activity,
  "systems-manager": Settings,
  "config": Settings,
  "xray": Activity,
  "cloudwatch-logs": BarChart3,
  "cloudwatch-alarms": Bell,
  "cloudformation": Settings,
  "health-dashboard": Activity,
  "trusted-advisor": Settings,
  // DevOps & CI/CD (6)
  "codecommit": Box,
  "codepipeline": Workflow,
  "codebuild": Server,
  "codedeploy": Boxes,
  "codeartifact": Box,
  "cloud9": Server,
  // Analytics & Streaming (8)
  "kinesis-streams": Activity,
  "kinesis-firehose": Activity,
  "kinesis-analytics": BarChart3,
  "msk": Activity,
  "athena": Database,
  "glue": Settings,
  "quicksight": BarChart3,
  "opensearch": Database,
  // Governance (6)
  "organizations": Users,
  "scp": Shield,
  "control-tower": Settings,
  "service-catalog": Box,
  "license-manager": Key,
  "resource-groups": Boxes,
  // Policies & Rules (15)
  "s3-lifecycle-policy": ScrollText,
  "s3-bucket-policy": FileText,
  "iam-identity-policy": FileText,
  "iam-trust-policy": FileText,
  "resource-based-policy": FileText,
  "vpc-endpoint-policy": FileText,
  "backup-policy": ScrollText,
  "scaling-policy": ScrollText,
  "dlm-policy": ScrollText,
  "ecr-lifecycle-policy": ScrollText,
  "scp-policy": Shield,
  "permission-boundary-policy": Shield,
  "rds-parameter-group": Settings,
  "elasticache-parameter-group": Settings,
  "waf-rules": Shield,
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
  "GitBranch": Workflow,
  "Building": Users,
  "FileText": FileText,
  // Default for custom services
  "custom": Box,
};

// Icon search result type
interface IconSearchResult {
  id: string;
  name: string;
  category: string;
  iconPath: string;
  type: "service" | "resource" | "category" | "group";
}

// Sidebar view modes
type SidebarView = "services" | "add" | "controls";

// Text style type
interface TextStyleUpdate {
  fontSize?: number;
  fontFamily?: "sans" | "serif" | "mono";
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline" | "line-through";
  textColor?: string;
}

// Node style type for styling any selected node
export interface NodeStyleUpdate {
  backgroundColor?: string;
  borderColor?: string;
  borderStyle?: "solid" | "dashed" | "dotted";
  opacity?: number;
}

// Selected node info passed from diagram canvas
export interface SelectedNodeInfo {
  id: string;
  type?: string;
  serviceId?: string;
  label?: string;
  currentStyle?: NodeStyleUpdate;
}

interface ServicePickerProps {
  onDragStart: (event: React.DragEvent, service: AWSService) => void;
  suggestedServices?: string[]; // Service IDs to highlight
  // Diagram control callbacks
  onUndo?: () => void;
  onRedo?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onSelectAll?: () => void;
  onToggleGrid?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onClear?: () => void;
  // Layer control callbacks
  onSendToBack?: () => void;
  onBringToFront?: () => void;
  onSendBackward?: () => void;
  onBringForward?: () => void;
  // State for controls
  canUndo?: boolean;
  canRedo?: boolean;
  hasSelection?: boolean;
  showGrid?: boolean;
  zoomLevel?: number;
  // Text style controls
  onUpdateTextStyle?: (style: TextStyleUpdate) => void;
  isTextNodeSelected?: boolean;
  selectedTextStyle?: TextStyleUpdate;
  // Node style controls
  selectedNode?: SelectedNodeInfo | null;
}

export function ServicePicker({ 
  onDragStart, 
  suggestedServices = [],
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onSelectAll,
  onToggleGrid,
  onZoomIn,
  onZoomOut,
  onFitView,
  onClear,
  onSendToBack,
  onBringToFront,
  onSendBackward,
  onBringForward,
  canUndo = false,
  canRedo = false,
  hasSelection = false,
  showGrid = true,
  zoomLevel = 100,
  onUpdateTextStyle,
  isTextNodeSelected = false,
  selectedTextStyle,
  selectedNode,
}: ServicePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<AWSCategory>>(
    new Set() // All categories collapsed by default
  );
  
  // Main sidebar tab (icon strip)
  const [activeTab, setActiveTab] = useState<SidebarTab>("services");
  
  // Sub-view within each tab
  const [sidebarView, setSidebarView] = useState<SidebarView>("services");
  
  // Custom services state
  const [customServices, setCustomServices] = useState<AWSService[]>([]);
  
  // Icon search state
  const [iconSearchQuery, setIconSearchQuery] = useState("");
  const [iconSearchResults, setIconSearchResults] = useState<IconSearchResult[]>([]);
  const [isSearchingIcons, setIsSearchingIcons] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<IconSearchResult | null>(null);
  
  const [newService, setNewService] = useState({
    name: "",
    shortName: "",
    category: "compute" as AWSCategory,
    description: "",
    iconPath: "" as string,
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

  // Search for AWS icons
  const searchIcons = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setIconSearchResults([]);
      return;
    }
    
    setIsSearchingIcons(true);
    try {
      const response = await fetch(`/api/aws-icons/search?q=${encodeURIComponent(query)}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setIconSearchResults(data.icons || []);
      }
    } catch (error) {
      console.error("Icon search failed:", error);
    } finally {
      setIsSearchingIcons(false);
    }
  }, []);

  // Debounced icon search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchIcons(iconSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [iconSearchQuery, searchIcons]);

  // State for saving status
  const [isSavingService, setIsSavingService] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Add a new custom service - saves to aws-services.ts file via API
  const handleAddService = async () => {
    if (!newService.name.trim() || !newService.shortName.trim() || !selectedIcon) return;
    
    setIsSavingService(true);
    setSaveError(null);
    setSaveSuccess(null);
    
    const id = newService.shortName.toLowerCase().replace(/\s+/g, "-");
    const color = AWS_CATEGORY_COLORS[newService.category] || "#666666";
    
    const serviceData = {
      id,
      name: newService.name,
      shortName: newService.shortName,
      category: newService.category,
      color,
      description: newService.description || `Custom ${newService.category} service`,
      iconPath: selectedIcon.iconPath,
    };
    
    try {
      const response = await fetch("/api/services/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serviceData),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        setSaveError(result.error || "Failed to save service");
        return;
      }
      
      setSaveSuccess(`${newService.name} added! Refresh to see in picker.`);
      
      // Reset form after short delay
      setTimeout(() => {
        setSidebarView("services");
        setSelectedIcon(null);
        setIconSearchQuery("");
        setIconSearchResults([]);
        setNewService({ name: "", shortName: "", category: "compute", description: "", iconPath: "" });
        setSaveSuccess(null);
      }, 2000);
      
    } catch (error) {
      setSaveError("Network error: " + (error as Error).message);
    } finally {
      setIsSavingService(false);
    }
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

  // ========================================
  // RENDER ADD SERVICE PANEL
  // ========================================
  const renderAddServicePanel = () => (
    <div className="flex-1 flex flex-col h-full bg-slate-900">
      {/* Header - Add Service Mode */}
      <div className="p-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarView("services")}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-sm font-medium text-slate-200">Add Custom Service</h3>
        </div>
      </div>

      {/* Add Service Form */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Service Name</label>
          <Input
            value={newService.name}
            onChange={(e) => setNewService(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Amazon MQ"
            className="h-8 text-xs bg-slate-800 border-slate-700 text-slate-200"
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Short Name</label>
          <Input
            value={newService.shortName}
            onChange={(e) => setNewService(prev => ({ ...prev, shortName: e.target.value }))}
            placeholder="e.g., MQ"
            className="h-8 text-xs bg-slate-800 border-slate-700 text-slate-200"
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Category</label>
          <select
            value={newService.category}
            onChange={(e) => setNewService(prev => ({ ...prev, category: e.target.value as AWSCategory }))}
            className="w-full h-8 px-2 rounded-md bg-slate-800 border border-slate-700 text-slate-200 text-xs"
          >
            {AWS_CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Search AWS Icon</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input
              value={iconSearchQuery}
              onChange={(e) => setIconSearchQuery(e.target.value)}
              placeholder="Search icons..."
              className="h-8 pl-7 text-xs bg-slate-800 border-slate-700 text-slate-200"
            />
          </div>
          
          {/* Selected Icon Preview */}
          {selectedIcon && (
            <div className="flex items-center gap-2 p-2 rounded bg-cyan-500/10 border border-cyan-500/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedIcon.iconPath} alt={selectedIcon.name} className="w-8 h-8" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-cyan-300 truncate">{selectedIcon.name}</p>
                <p className="text-[10px] text-slate-500">{selectedIcon.category}</p>
              </div>
              <button onClick={() => setSelectedIcon(null)} className="text-slate-500 hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          
          {/* Icon Search Results */}
          {isSearchingIcons && <div className="text-xs text-slate-500 text-center py-2">Searching...</div>}
          
          {!isSearchingIcons && iconSearchResults.length > 0 && !selectedIcon && (
            <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-700 rounded p-1 bg-slate-800/50">
              {iconSearchResults.map((icon) => (
                <button
                  key={icon.id}
                  onClick={() => { setSelectedIcon(icon); setIconSearchResults([]); }}
                  className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-slate-700 transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={icon.iconPath} alt={icon.name} className="w-6 h-6" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs text-slate-200 truncate">{icon.name}</p>
                    <p className="text-[9px] text-slate-500">{icon.category}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {!isSearchingIcons && iconSearchQuery.length >= 2 && iconSearchResults.length === 0 && !selectedIcon && (
            <p className="text-xs text-slate-500 text-center py-2">No icons found</p>
          )}
        </div>
        
      </div>

      {/* Save Button & Status */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        {saveError && (
          <p className="text-[10px] text-red-400 text-center bg-red-500/10 rounded p-1.5">{saveError}</p>
        )}
        {saveSuccess && (
          <p className="text-[10px] text-green-400 text-center bg-green-500/10 rounded p-1.5">{saveSuccess}</p>
        )}
        <Button
          onClick={handleAddService}
          disabled={!newService.name.trim() || !newService.shortName.trim() || !selectedIcon || isSavingService}
          className="w-full h-8 text-xs bg-cyan-600 hover:bg-cyan-700 gap-1.5"
        >
          {isSavingService ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving to file...
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              Save Service (Permanent)
            </>
          )}
        </Button>
        {!selectedIcon && newService.name.trim() && (
          <p className="text-[10px] text-amber-400 text-center">Search and select an icon above</p>
        )}
        <p className="text-[9px] text-slate-600 text-center">Saves directly to aws-services.ts</p>
      </div>
    </div>
  );

  // ========================================
  // RENDER SHAPES PANEL - Group Containers & General Icons
  // ========================================
  const renderShapesPanel = () => (
    <div className="flex-1 flex flex-col h-full bg-slate-900">
      <div className="p-3 border-b border-slate-800">
        <h3 className="text-sm font-medium text-slate-200">Shapes & Elements</h3>
        <p className="text-[10px] text-slate-500 mt-1">Drag to add to canvas</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* General Icons - Users, Devices, etc. */}
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">General Icons</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: "👤", label: "User" },
              { icon: "👥", label: "Users" },
              { icon: "📱", label: "Mobile" },
              { icon: "💻", label: "Laptop" },
              { icon: "🖥️", label: "Desktop" },
              { icon: "🌐", label: "Internet" },
              { icon: "☁️", label: "Cloud" },
              { icon: "🏢", label: "Corporate" },
              { icon: "🏭", label: "On-Prem" },
              { icon: "🗄️", label: "Server" },
              { icon: "💾", label: "Database" },
              { icon: "🔒", label: "Security" },
            ].map(({ icon, label }) => (
              <div
                key={label}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/diagram-shape", JSON.stringify({
                    type: "icon",
                    label,
                    icon,
                  }));
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="aspect-square rounded-lg bg-slate-800/50 hover:bg-slate-700 flex flex-col items-center justify-center text-slate-400 hover:text-slate-200 transition-colors cursor-grab active:cursor-grabbing p-1"
                title={label}
              >
                <span className="text-lg">{icon}</span>
                <span className="text-[8px] mt-0.5 text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Text Elements */}
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Text Elements</p>
          <div className="space-y-1.5">
            {[
              { label: "Text Box", icon: "📝", type: "textbox" },
              { label: "Note", icon: "📌", type: "note" },
            ].map(({ label, icon, type }) => (
              <div
                key={type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/diagram-shape", JSON.stringify({
                    type: "text",
                    label,
                    icon,
                    textType: type,
                  }));
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="w-full h-10 rounded-lg bg-slate-800/50 hover:bg-slate-700 flex items-center gap-2 px-3 text-slate-300 hover:text-slate-100 transition-colors text-xs cursor-grab active:cursor-grabbing"
                title={`Drag to add ${label}`}
              >
                <span className="text-base">{icon}</span>
                <span className="flex-1 text-left">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Architecture Annotations */}
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Architecture Annotations</p>
          <p className="text-[9px] text-slate-600 -mt-1">Document policies, flows, and metadata</p>
          <div className="space-y-1.5">
            {[
              { label: "Legend", icon: "📋", type: "legendNode", description: "Color key & ownership" },
              { label: "Lifecycle Policy", icon: "📜", type: "lifecycleNode", description: "S3/backup rules" },
              { label: "CI/CD Pipeline", icon: "🔧", type: "pipelineNode", description: "Pipeline stages" },
              { label: "Scaling Policy", icon: "📈", type: "scalingPolicyNode", description: "Auto scaling config" },
              { label: "Backup Plan", icon: "💾", type: "backupPlanNode", description: "Backup schedule" },
              { label: "Data Flow", icon: "↕️", type: "dataFlowNode", description: "Traffic annotation" },
              { label: "IAM Policy", icon: "🔐", type: "policyDocumentNode", description: "IAM policy document" },
            ].map(({ label, icon, type, description }) => (
              <div
                key={type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/diagram-shape", JSON.stringify({
                    type: "annotation",
                    nodeType: type,
                    label,
                    icon,
                  }));
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="w-full h-12 rounded-lg bg-slate-800/50 hover:bg-slate-700 flex items-center gap-2 px-3 text-slate-300 hover:text-slate-100 transition-colors cursor-grab active:cursor-grabbing"
                title={description}
              >
                <span className="text-base">{icon}</span>
                <div className="flex-1 text-left">
                  <span className="text-xs block">{label}</span>
                  <span className="text-[9px] text-slate-500">{description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Multi-Account Structures */}
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Multi-Account</p>
          <p className="text-[9px] text-slate-600 -mt-1">AWS Organizations & Accounts</p>
          <div className="space-y-1.5">
            {[
              { label: "AWS Organization", icon: "🏛️", type: "orgNode", description: "Multi-account boundary" },
              { label: "AWS Account", icon: "🏢", type: "accountNode", description: "Account boundary" },
            ].map(({ label, icon, type, description }) => (
              <div
                key={type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/diagram-shape", JSON.stringify({
                    type: "container",
                    nodeType: type,
                    label,
                    icon,
                  }));
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="w-full h-12 rounded-lg bg-slate-800/50 hover:bg-slate-700 flex items-center gap-2 px-3 text-slate-300 hover:text-slate-100 transition-colors cursor-grab active:cursor-grabbing"
                title={description}
              >
                <span className="text-base">{icon}</span>
                <div className="flex-1 text-left">
                  <span className="text-xs block">{label}</span>
                  <span className="text-[9px] text-slate-500">{description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ========================================
  // RENDER STYLE PANEL
  // ========================================
  const renderStylePanel = () => {
    const hasNodeSelected = !!selectedNode;
    
    return (
    <div className="flex-1 flex flex-col h-full bg-slate-900">
      <div className="p-3 border-b border-slate-800">
        <h3 className="text-sm font-medium text-slate-200">Style & Colors</h3>
        <p className="text-[10px] text-slate-500 mt-1">
          {hasNodeSelected 
            ? `Styling: ${selectedNode?.label || selectedNode?.serviceId || "Node"}`
            : "Select a node to customize"
          }
        </p>
      </div>
      {/* No Selection Banner */}
      {!hasNodeSelected && (
        <div className="mx-3 mt-3 p-2 bg-slate-800/50 border border-slate-700 rounded-lg">
          <p className="text-[10px] text-slate-400 text-center">
            👆 Click on a node in the canvas to style it
          </p>
        </div>
      )}
      <div className={cn("flex-1 overflow-y-auto p-3 space-y-4", !hasNodeSelected && "opacity-50 pointer-events-none")}>
        {/* Text Styling (for Text Box elements) */}
        <div className={cn("space-y-2", !isTextNodeSelected && "opacity-50")}>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Text Style</p>
          <p className="text-[9px] text-slate-600">
            {isTextNodeSelected ? "Style the selected text box" : "Select a Text Box to style"}
          </p>
          
          {/* Font Size */}
          <div className="space-y-1">
            <p className="text-[9px] text-slate-500">Size</p>
            <div className="grid grid-cols-5 gap-1">
              {[10, 12, 14, 16, 20].map((size) => (
                <button
                  key={size}
                  onMouseDown={(e) => e.preventDefault()} // Prevent stealing focus from textarea
                  onClick={() => onUpdateTextStyle?.({ fontSize: size })}
                  disabled={!isTextNodeSelected}
                  className={cn(
                    "h-7 rounded text-xs transition-colors",
                    (selectedTextStyle?.fontSize ?? 14) === size
                      ? "bg-cyan-500/30 text-cyan-400 ring-1 ring-cyan-500"
                      : "bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-slate-200",
                    !isTextNodeSelected && "cursor-not-allowed"
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          
          {/* Font Family */}
          <div className="space-y-1">
            <p className="text-[9px] text-slate-500">Font</p>
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: "Sans", value: "sans" as const },
                { label: "Serif", value: "serif" as const },
                { label: "Mono", value: "mono" as const },
              ].map(({ label, value }) => (
                <button
                  key={value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onUpdateTextStyle?.({ fontFamily: value })}
                  disabled={!isTextNodeSelected}
                  className={cn(
                    "h-7 rounded text-xs transition-colors",
                    value === "serif" && "font-serif",
                    value === "mono" && "font-mono",
                    (selectedTextStyle?.fontFamily ?? "sans") === value
                      ? "bg-cyan-500/30 text-cyan-400 ring-1 ring-cyan-500"
                      : "bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-slate-200",
                    !isTextNodeSelected && "cursor-not-allowed"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Text Formatting */}
          <div className="space-y-1">
            <p className="text-[9px] text-slate-500">Format</p>
            <div className="grid grid-cols-5 gap-1">
              <button 
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateTextStyle?.({ fontWeight: "normal", fontStyle: "normal", textDecoration: "none" })}
                disabled={!isTextNodeSelected}
                className={cn(
                  "h-7 rounded text-[10px] transition-colors",
                  (selectedTextStyle?.fontWeight ?? "normal") === "normal" && 
                  (selectedTextStyle?.fontStyle ?? "normal") === "normal" && 
                  (selectedTextStyle?.textDecoration ?? "none") === "none"
                    ? "bg-cyan-500/30 text-cyan-400 ring-1 ring-cyan-500"
                    : "bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-slate-200",
                  !isTextNodeSelected && "cursor-not-allowed"
                )}
              >
                Aa
              </button>
              <button 
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateTextStyle?.({ fontWeight: "bold" })}
                disabled={!isTextNodeSelected}
                className={cn(
                  "h-7 rounded text-xs font-bold transition-colors",
                  selectedTextStyle?.fontWeight === "bold"
                    ? "bg-cyan-500/30 text-cyan-400 ring-1 ring-cyan-500"
                    : "bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-slate-200",
                  !isTextNodeSelected && "cursor-not-allowed"
                )}
              >
                B
              </button>
              <button 
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateTextStyle?.({ fontStyle: "italic" })}
                disabled={!isTextNodeSelected}
                className={cn(
                  "h-7 rounded text-xs italic transition-colors",
                  selectedTextStyle?.fontStyle === "italic"
                    ? "bg-cyan-500/30 text-cyan-400 ring-1 ring-cyan-500"
                    : "bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-slate-200",
                  !isTextNodeSelected && "cursor-not-allowed"
                )}
              >
                I
              </button>
              <button 
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateTextStyle?.({ textDecoration: "underline" })}
                disabled={!isTextNodeSelected}
                className={cn(
                  "h-7 rounded text-xs underline transition-colors",
                  selectedTextStyle?.textDecoration === "underline"
                    ? "bg-cyan-500/30 text-cyan-400 ring-1 ring-cyan-500"
                    : "bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-slate-200",
                  !isTextNodeSelected && "cursor-not-allowed"
                )}
              >
                U
              </button>
              <button 
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateTextStyle?.({ textDecoration: "line-through" })}
                disabled={!isTextNodeSelected}
                className={cn(
                  "h-7 rounded text-xs line-through transition-colors",
                  selectedTextStyle?.textDecoration === "line-through"
                    ? "bg-cyan-500/30 text-cyan-400 ring-1 ring-cyan-500"
                    : "bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-slate-200",
                  !isTextNodeSelected && "cursor-not-allowed"
                )}
              >
                S
              </button>
            </div>
          </div>
          
          {/* Text Color */}
          <div className="space-y-1">
            <p className="text-[9px] text-slate-500">Text Color</p>
            <div className="grid grid-cols-6 gap-1">
              {[
                "#000000", "#374151", "#6b7280", "#9ca3af",
                "#ffffff", "#ef4444", "#f97316", "#eab308",
                "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6",
              ].map((color) => (
                <button
                  key={color}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onUpdateTextStyle?.({ textColor: color })}
                  disabled={!isTextNodeSelected}
                  className={cn(
                    "aspect-square rounded border hover:scale-110 transition-transform",
                    (selectedTextStyle?.textColor ?? "#374151") === color
                      ? "ring-2 ring-cyan-500 border-cyan-500"
                      : "border-slate-700",
                    !isTextNodeSelected && "cursor-not-allowed hover:scale-100"
                  )}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  };

  // ========================================
  // RENDER CONTROLS PANEL
  // ========================================
  const renderControlsPanel = () => (
    <div className="flex-1 flex flex-col h-full bg-slate-900">
      <div className="p-3 border-b border-slate-800">
        <h3 className="text-sm font-medium text-slate-200">Controls</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* History Row */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider px-1">History</p>
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={cn(
                "flex-1 h-8 rounded flex items-center justify-center transition-colors",
                canUndo ? "hover:bg-slate-700 text-slate-300" : "text-slate-600 cursor-not-allowed"
              )}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-700" />
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={cn(
                "flex-1 h-8 rounded flex items-center justify-center transition-colors",
                canRedo ? "hover:bg-slate-700 text-slate-300" : "text-slate-600 cursor-not-allowed"
              )}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Edit Row */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider px-1">Edit</p>
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
            <button
              onClick={onCopy}
              disabled={!hasSelection}
              className={cn(
                "flex-1 h-8 rounded flex items-center justify-center transition-colors",
                hasSelection ? "hover:bg-slate-700 text-slate-300" : "text-slate-600 cursor-not-allowed"
              )}
              title="Copy (Ctrl+C)"
            >
              <Copy className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-700" />
            <button
              onClick={onPaste}
              className="flex-1 h-8 rounded flex items-center justify-center hover:bg-slate-700 text-slate-300 transition-colors"
              title="Paste (Ctrl+V)"
            >
              <Clipboard className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-700" />
            <button
              onClick={onDuplicate}
              disabled={!hasSelection}
              className={cn(
                "flex-1 h-8 rounded flex items-center justify-center transition-colors",
                hasSelection ? "hover:bg-slate-700 text-slate-300" : "text-slate-600 cursor-not-allowed"
              )}
              title="Duplicate (Ctrl+D)"
            >
              <Copy className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-700" />
            <button
              onClick={onDelete}
              disabled={!hasSelection}
              className={cn(
                "flex-1 h-8 rounded flex items-center justify-center transition-colors",
                hasSelection ? "hover:bg-red-900/50 text-red-400" : "text-slate-600 cursor-not-allowed"
              )}
              title="Delete (Del)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Row */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider px-1">View</p>
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
            <button
              onClick={onToggleGrid}
              className={cn(
                "flex-1 h-8 rounded flex items-center justify-center transition-colors",
                showGrid ? "bg-cyan-500/20 text-cyan-400" : "hover:bg-slate-700 text-slate-300"
              )}
              title="Toggle Grid"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-700" />
            <button
              onClick={onZoomOut}
              className="flex-1 h-8 rounded flex items-center justify-center hover:bg-slate-700 text-slate-300 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] text-slate-400 w-10 text-center">{zoomLevel}%</span>
            <button
              onClick={onZoomIn}
              className="flex-1 h-8 rounded flex items-center justify-center hover:bg-slate-700 text-slate-300 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-700" />
            <button
              onClick={onFitView}
              className="flex-1 h-8 rounded flex items-center justify-center hover:bg-slate-700 text-slate-300 transition-colors"
              title="Fit to View"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Layer Controls */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider px-1">Arrange</p>
          <div className="space-y-1">
            <button
              onClick={onBringToFront}
              disabled={!hasSelection}
              className={cn(
                "w-full h-8 rounded bg-slate-800/50 flex items-center justify-between px-2 text-[10px] transition-colors",
                hasSelection ? "hover:bg-slate-700 text-slate-300" : "text-slate-600 cursor-not-allowed"
              )}
              title="Bring to Front (⌘⇧])"
            >
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Bring to Front</span>
              </div>
              <span className="text-slate-500">⌘⇧]</span>
            </button>
            <button
              onClick={onBringForward}
              disabled={!hasSelection}
              className={cn(
                "w-full h-8 rounded bg-slate-800/50 flex items-center justify-between px-2 text-[10px] transition-colors",
                hasSelection ? "hover:bg-slate-700 text-slate-300" : "text-slate-600 cursor-not-allowed"
              )}
              title="Bring Forward (⌘])"
            >
              <div className="flex items-center gap-1.5">
                <ChevronRight className="w-3.5 h-3.5" />
                <span>Bring Forward</span>
              </div>
              <span className="text-slate-500">⌘]</span>
            </button>
            <button
              onClick={onSendBackward}
              disabled={!hasSelection}
              className={cn(
                "w-full h-8 rounded bg-slate-800/50 flex items-center justify-between px-2 text-[10px] transition-colors",
                hasSelection ? "hover:bg-slate-700 text-slate-300" : "text-slate-600 cursor-not-allowed"
              )}
              title="Send Backward (⌘[)"
            >
              <div className="flex items-center gap-1.5">
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                <span>Send Backward</span>
              </div>
              <span className="text-slate-500">⌘[</span>
            </button>
            <button
              onClick={onSendToBack}
              disabled={!hasSelection}
              className={cn(
                "w-full h-8 rounded bg-slate-800/50 flex items-center justify-between px-2 text-[10px] transition-colors",
                hasSelection ? "hover:bg-slate-700 text-slate-300" : "text-slate-600 cursor-not-allowed"
              )}
              title="Send to Back (⌘⇧[)"
            >
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Send to Back</span>
              </div>
              <span className="text-slate-500">⌘⇧[</span>
            </button>
          </div>
        </div>

        {/* Selection */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider px-1">Selection</p>
          <button
            onClick={onSelectAll}
            className="w-full h-8 rounded bg-slate-800/50 flex items-center justify-center gap-2 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
            title="Select All (Ctrl+A)"
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            Select All
          </button>
        </div>

        {/* Clear */}
        <div className="pt-2 border-t border-slate-800">
          <button
            onClick={onClear}
            className="w-full h-8 rounded bg-slate-800/50 flex items-center justify-center gap-2 hover:bg-red-900/30 text-red-400 text-xs transition-colors"
            title="Clear Canvas"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear All
          </button>
        </div>
      </div>

      {/* Shortcuts */}
      <div className="p-2 border-t border-slate-800">
        <div className="text-[9px] text-slate-600 space-y-0.5">
          <p>⌘Z Undo • ⌘Y Redo • ⌘C Copy</p>
          <p>⌘V Paste • ⌘D Duplicate • Del Delete</p>
        </div>
      </div>
    </div>
  );

  // ========================================
  // RENDER SERVICES PANEL
  // ========================================
  const renderServicesPanel = () => (
    <div className="flex-1 flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="p-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-slate-200">AWS Services</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarView("add")}
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

      {/* Custom Services (if any) */}
      {customServices.length > 0 && !searchQuery && (
        <div className="p-2 border-b border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 px-1">Custom Services</p>
          <div className="space-y-1">
            {customServices.map((service) => {
              const serviceWithIcon = service as AWSService & { iconPath?: string };
              return (
                <div
                  key={service.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, service)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded bg-amber-500/10 border border-amber-500/30 cursor-grab hover:bg-amber-500/20 transition-colors group"
                >
                  <GripVertical className="w-3 h-3 text-slate-600 group-hover:text-slate-400" />
                  <div className="w-6 h-6 rounded flex items-center justify-center overflow-hidden">
                    {serviceWithIcon.iconPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={serviceWithIcon.iconPath} alt={service.name} className="w-5 h-5" />
                    ) : (
                      <Box className="w-4 h-4" style={{ color: service.color }} />
                    )}
                  </div>
                  <span className="text-xs text-amber-300 flex-1">{service.shortName}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveService(service.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
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
    </div>
  );

  // ========================================
  // MAIN RETURN - Icon Strip + Panel
  // ========================================
  return (
    <div className="flex h-full">
      {/* Left Icon Strip - Canva style */}
      <div className="w-12 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-2 gap-1">
        {/* Services Tab */}
        <button
          onClick={() => { setActiveTab("services"); setSidebarView("services"); }}
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
            activeTab === "services"
              ? "bg-cyan-500/20 text-cyan-400"
              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
          )}
          title="AWS Services"
        >
          <LayoutGrid className="w-5 h-5" />
        </button>
        
        {/* Shapes Tab */}
        <button
          onClick={() => { setActiveTab("shapes"); setSidebarView("services"); }}
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
            activeTab === "shapes"
              ? "bg-cyan-500/20 text-cyan-400"
              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
          )}
          title="Shapes & Elements"
        >
          <Shapes className="w-5 h-5" />
        </button>
        
        {/* Style Tab */}
        <button
          onClick={() => { setActiveTab("style"); setSidebarView("services"); }}
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
            activeTab === "style"
              ? "bg-cyan-500/20 text-cyan-400"
              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
          )}
          title="Style & Colors"
        >
          <Palette className="w-5 h-5" />
        </button>
        
        {/* Divider */}
        <div className="w-6 h-px bg-slate-800 my-2" />
        
        {/* Controls Tab */}
        <button
          onClick={() => { setActiveTab("controls"); setSidebarView("services"); }}
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
            activeTab === "controls"
              ? "bg-cyan-500/20 text-cyan-400"
              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
          )}
          title="Controls"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Panel Content */}
      <div className="w-52 border-r border-slate-800 flex flex-col h-full">
        {sidebarView === "add" ? (
          renderAddServicePanel()
        ) : activeTab === "services" ? (
          renderServicesPanel()
        ) : activeTab === "shapes" ? (
          renderShapesPanel()
        ) : activeTab === "style" ? (
          renderStylePanel()
        ) : activeTab === "controls" ? (
          renderControlsPanel()
        ) : null}
      </div>
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
