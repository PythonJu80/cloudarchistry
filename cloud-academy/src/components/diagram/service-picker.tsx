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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  // State for controls
  canUndo?: boolean;
  canRedo?: boolean;
  hasSelection?: boolean;
  showGrid?: boolean;
  zoomLevel?: number;
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
  canUndo = false,
  canRedo = false,
  hasSelection = false,
  showGrid = true,
  zoomLevel = 100,
}: ServicePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<AWSCategory>>(
    new Set() // All categories collapsed by default
  );
  
  // Sidebar view state
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

  // Add a new custom service
  const handleAddService = () => {
    if (!newService.name.trim() || !newService.shortName.trim() || !selectedIcon) return;
    
    const id = `custom-${newService.shortName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    const color = AWS_CATEGORY_COLORS[newService.category] || "#666666";
    
    const service: AWSService & { iconPath?: string } = {
      id,
      name: newService.name,
      shortName: newService.shortName,
      category: newService.category,
      color,
      description: newService.description || `Custom ${newService.category} service`,
      iconPath: selectedIcon.iconPath,
    };
    
    saveCustomServices([...customServices, service as AWSService]);
    setSidebarView("services");
    setSelectedIcon(null);
    setIconSearchQuery("");
    setIconSearchResults([]);
    setNewService({ name: "", shortName: "", category: "compute", description: "", iconPath: "" });
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
  // CONTROLS VIEW - Compact icon-based like Canva
  // ========================================
  if (sidebarView === "controls") {
    return (
      <div className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
        {/* Header */}
        <div className="p-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarView("services")}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-medium text-slate-200">Controls</h3>
          </div>
        </div>

        {/* Compact Controls */}
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
  }

  // ========================================
  // ADD SERVICE VIEW
  // ========================================
  if (sidebarView === "add") {
    return (
      <div className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
        {/* Header - Add Service Mode */}
        <div className="p-3 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-3">
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
                placeholder="Search icons (e.g., Lambda, SageMaker)..."
                className="h-8 pl-7 text-xs bg-slate-800 border-slate-700 text-slate-200"
              />
            </div>
            
            {/* Selected Icon Preview */}
            {selectedIcon && (
              <div className="flex items-center gap-2 p-2 rounded bg-cyan-500/10 border border-cyan-500/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={selectedIcon.iconPath} 
                  alt={selectedIcon.name} 
                  className="w-8 h-8"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-cyan-300 truncate">{selectedIcon.name}</p>
                  <p className="text-[10px] text-slate-500">{selectedIcon.category}</p>
                </div>
                <button
                  onClick={() => setSelectedIcon(null)}
                  className="text-slate-500 hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            
            {/* Icon Search Results */}
            {isSearchingIcons && (
              <div className="text-xs text-slate-500 text-center py-2">Searching...</div>
            )}
            
            {!isSearchingIcons && iconSearchResults.length > 0 && !selectedIcon && (
              <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-700 rounded p-1 bg-slate-800/50">
                {iconSearchResults.map((icon) => (
                  <button
                    key={icon.id}
                    onClick={() => {
                      setSelectedIcon(icon);
                      setIconSearchResults([]);
                    }}
                    className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-slate-700 transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={icon.iconPath} 
                      alt={icon.name} 
                      className="w-6 h-6"
                    />
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
          
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">Description</label>
            <Input
              value={newService.description}
              onChange={(e) => setNewService(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description..."
              className="h-8 text-xs bg-slate-800 border-slate-700 text-slate-200"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="p-3 border-t border-slate-800">
          <Button
            onClick={handleAddService}
            disabled={!newService.name.trim() || !newService.shortName.trim() || !selectedIcon}
            className="w-full h-8 text-xs bg-cyan-600 hover:bg-cyan-700 gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            Save Service
          </Button>
          {!selectedIcon && newService.name.trim() && (
            <p className="text-[10px] text-amber-400 text-center mt-2">Search and select an icon above</p>
          )}
        </div>
      </div>
    );
  }

  // ========================================
  // SERVICES VIEW (Default)
  // ========================================
  return (
    <div className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-slate-200">AWS Services</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarView("controls")}
              className="h-6 w-6 p-0 text-slate-400 hover:text-cyan-400"
              title="Diagram controls"
            >
              <Settings className="w-4 h-4" />
            </Button>
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
