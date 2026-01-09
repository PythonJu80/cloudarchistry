"use client";

/**
 * Diagram Hierarchy Panel
 * 
 * VS Code-style tree view showing the diagram structure with AWS placement rules.
 * Allows clicking on elements to select them in the canvas.
 */

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Cloud,
  Globe,
  MapPin,
  Layers,
  Network,
  Server,
  Shield,
  Box,
  AlertTriangle,
  CheckCircle,
  Info,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  SERVICE_METADATA,
  PLACEMENT_RULES,
} from "@/lib/aws-placement-rules";
import { getServiceById } from "@/lib/aws-services";

// Node type from diagram-canvas
interface DiagramNode {
  id: string;
  type?: string;
  parentId?: string;
  data: {
    serviceId: string;
    label: string;
    sublabel?: string;
    color: string;
  };
}

interface DiagramHierarchyPanelProps {
  nodes: DiagramNode[];
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  onNodeFocus?: (nodeId: string) => void;
  className?: string;
}

// Icon mapping for node types
const nodeTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  awsCloud: Cloud,
  region: Globe,
  availabilityZone: MapPin,
  vpc: Network,
  subnet: Layers,
  "auto-scaling": Server,
  awsResource: Box,
  orgNode: Cloud,
  accountNode: Shield,
};

// Build tree structure from flat nodes
interface TreeNode {
  node: DiagramNode;
  children: TreeNode[];
  depth: number;
  hasPlacementIssue: boolean;
  placementInfo: {
    scope?: string;
    mustBeInside?: string[];
    canConnectTo?: string[];
    isContainer?: boolean;
  };
}

function buildTree(nodes: DiagramNode[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  // First pass: create TreeNode for each node
  nodes.forEach(node => {
    const serviceId = node.data?.serviceId;
    const metadata = serviceId ? SERVICE_METADATA[serviceId] : null;
    const service = serviceId ? getServiceById(serviceId) : null;
    
    // Check for placement issues
    let hasPlacementIssue = false;
    if (metadata && node.parentId) {
      const parentNode = nodes.find(n => n.id === node.parentId);
      if (parentNode) {
        const parentType = parentNode.type || "canvas";
        const rules = PLACEMENT_RULES[parentType];
        if (rules && !rules.allowedChildren.includes(serviceId || "")) {
          hasPlacementIssue = true;
        }
      }
    }

    nodeMap.set(node.id, {
      node,
      children: [],
      depth: 0,
      hasPlacementIssue,
      placementInfo: {
        scope: metadata?.scope,
        mustBeInside: service?.mustBeInside,
        canConnectTo: service?.canConnectTo,
        isContainer: service?.isContainer,
      },
    });
  });

  // Second pass: build parent-child relationships
  nodes.forEach(node => {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId)!;
      parent.children.push(treeNode);
      treeNode.depth = parent.depth + 1;
    } else {
      rootNodes.push(treeNode);
    }
  });

  // Sort children by type (containers first, then by label)
  const sortChildren = (children: TreeNode[]) => {
    children.sort((a, b) => {
      const aIsContainer = a.placementInfo.isContainer ? 0 : 1;
      const bIsContainer = b.placementInfo.isContainer ? 0 : 1;
      if (aIsContainer !== bIsContainer) return aIsContainer - bIsContainer;
      return (a.node.data?.label || "").localeCompare(b.node.data?.label || "");
    });
    children.forEach(child => sortChildren(child.children));
  };
  sortChildren(rootNodes);

  return rootNodes;
}

// Scope badge colors
const scopeColors: Record<string, string> = {
  global: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  edge: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  regional: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  az: "bg-green-500/20 text-green-400 border-green-500/30",
  vpc: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

// Tree node component
function TreeNodeItem({
  treeNode,
  selectedNodeId,
  onNodeSelect,
  onNodeFocus,
  expandedNodes,
  toggleExpanded,
}: {
  treeNode: TreeNode;
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  onNodeFocus?: (nodeId: string) => void;
  expandedNodes: Set<string>;
  toggleExpanded: (nodeId: string) => void;
}) {
  const { node, children, placementInfo, hasPlacementIssue } = treeNode;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const hasChildren = children.length > 0;
  
  const Icon = nodeTypeIcons[node.type || "awsResource"] || Box;
  const serviceId = node.data?.serviceId;
  const label = node.data?.label || serviceId || "Unknown";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeSelect(node.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeFocus?.(node.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleExpanded(node.id);
  };

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 cursor-pointer rounded-sm transition-colors",
          "hover:bg-slate-700/50",
          isSelected && "bg-blue-600/30 border-l-2 border-blue-500"
        )}
        style={{ paddingLeft: `${treeNode.depth * 12 + 4}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={handleToggle}
          className={cn(
            "w-4 h-4 flex items-center justify-center",
            !hasChildren && "invisible"
          )}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-slate-400" />
            )
          )}
        </button>

        {/* Node icon */}
        <Icon 
          className={cn(
            "w-4 h-4 flex-shrink-0",
            hasPlacementIssue ? "text-amber-400" : "text-slate-400"
          )} 
        />

        {/* Label */}
        <span className={cn(
          "text-xs truncate flex-1",
          isSelected ? "text-white font-medium" : "text-slate-300"
        )}>
          {label}
        </span>

        {/* Scope badge */}
        {placementInfo.scope && (
          <span className={cn(
            "text-[9px] px-1 py-0.5 rounded border",
            scopeColors[placementInfo.scope] || "bg-slate-500/20 text-slate-400"
          )}>
            {placementInfo.scope}
          </span>
        )}

        {/* Issue indicator */}
        {hasPlacementIssue && (
          <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {children.map(child => (
            <TreeNodeItem
              key={child.node.id}
              treeNode={child}
              selectedNodeId={selectedNodeId}
              onNodeSelect={onNodeSelect}
              onNodeFocus={onNodeFocus}
              expandedNodes={expandedNodes}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Rules panel for selected node
function NodeRulesPanel({ node, nodes }: { node: DiagramNode; nodes: DiagramNode[] }) {
  const serviceId = node.data?.serviceId;
  const metadata = serviceId ? SERVICE_METADATA[serviceId] : null;
  const service = serviceId ? getServiceById(serviceId) : null;

  if (!serviceId) {
    return (
      <div className="p-3 text-xs text-slate-400">
        No service information available
      </div>
    );
  }

  // Find parent for placement validation
  const parentNode = node.parentId ? nodes.find(n => n.id === node.parentId) : null;
  const parentType = parentNode?.type || "canvas";
  const parentLabel = parentNode?.data?.label || parentType;

  // Check if current placement is valid
  const rules = PLACEMENT_RULES[parentType];
  const isValidPlacement = rules?.allowedChildren.includes(serviceId) ?? true;

  return (
    <div className="p-3 space-y-3 text-xs border-t border-slate-700">
      {/* Service header */}
      <div className="flex items-center gap-2">
        <div 
          className="w-3 h-3 rounded"
          style={{ backgroundColor: node.data?.color || "#64748b" }}
        />
        <span className="font-medium text-white">{node.data?.label}</span>
        {metadata?.scope && (
          <span className={cn(
            "text-[9px] px-1 py-0.5 rounded border",
            scopeColors[metadata.scope]
          )}>
            {metadata.scope}
          </span>
        )}
      </div>

      {/* Current placement */}
      <div className="space-y-1">
        <div className="text-slate-400 font-medium">Current Placement</div>
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded",
          isValidPlacement ? "bg-green-500/10" : "bg-amber-500/10"
        )}>
          {isValidPlacement ? (
            <CheckCircle className="w-3 h-3 text-green-400" />
          ) : (
            <AlertTriangle className="w-3 h-3 text-amber-400" />
          )}
          <span className={isValidPlacement ? "text-green-300" : "text-amber-300"}>
            Inside: {parentLabel}
          </span>
        </div>
      </div>

      {/* Valid placements */}
      {service?.mustBeInside && service.mustBeInside.length > 0 && (
        <div className="space-y-1">
          <div className="text-slate-400 font-medium flex items-center gap-1">
            <Layers className="w-3 h-3" />
            Must Be Inside
          </div>
          <div className="flex flex-wrap gap-1">
            {service.mustBeInside.map(container => (
              <span
                key={container}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] border",
                  parentType === container || (parentType === "subnet" && container.startsWith("subnet"))
                    ? "bg-green-500/20 text-green-300 border-green-500/30"
                    : "bg-slate-700 text-slate-300 border-slate-600"
                )}
              >
                {container}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Can connect to */}
      {service?.canConnectTo && service.canConnectTo.length > 0 && (
        <div className="space-y-1">
          <div className="text-slate-400 font-medium flex items-center gap-1">
            <Network className="w-3 h-3" />
            Can Connect To
          </div>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {service.canConnectTo.slice(0, 12).map(target => (
              <span
                key={target}
                className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30"
              >
                {target}
              </span>
            ))}
            {service.canConnectTo.length > 12 && (
              <span className="px-1.5 py-0.5 text-[10px] text-slate-400">
                +{service.canConnectTo.length - 12} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Container info */}
      {service?.isContainer && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-500/10">
          <Box className="w-3 h-3 text-purple-400" />
          <span className="text-purple-300">Container - can hold other services</span>
        </div>
      )}

      {/* Scope explanation */}
      {metadata?.scope && (
        <div className="space-y-1">
          <div className="text-slate-400 font-medium flex items-center gap-1">
            <Info className="w-3 h-3" />
            Scope Info
          </div>
          <div className="text-slate-400 text-[10px] leading-relaxed">
            {metadata.scope === "global" && "Global service - exists outside regions, place on canvas"}
            {metadata.scope === "edge" && "Edge service - runs at edge locations, place on canvas"}
            {metadata.scope === "regional" && "Regional service - exists in a region"}
            {metadata.scope === "az" && "AZ-scoped - tied to a specific Availability Zone"}
            {metadata.scope === "vpc" && "VPC resource - requires VPC/subnet placement"}
          </div>
        </div>
      )}
    </div>
  );
}

export function DiagramHierarchyPanel({
  nodes,
  selectedNodeId,
  onNodeSelect,
  onNodeFocus,
  className,
}: DiagramHierarchyPanelProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showRules, setShowRules] = useState(true);

  // Build tree structure
  const tree = useMemo(() => buildTree(nodes), [nodes]);

  // Auto-expand to show selected node
  useMemo(() => {
    if (selectedNodeId) {
      const findPath = (treeNodes: TreeNode[], targetId: string, path: string[] = []): string[] | null => {
        for (const treeNode of treeNodes) {
          if (treeNode.node.id === targetId) {
            return path;
          }
          const found = findPath(treeNode.children, targetId, [...path, treeNode.node.id]);
          if (found) return found;
        }
        return null;
      };
      const path = findPath(tree, selectedNodeId);
      if (path) {
        setExpandedNodes(prev => {
          const next = new Set(prev);
          path.forEach(id => next.add(id));
          return next;
        });
      }
    }
  }, [selectedNodeId, tree]);

  const toggleExpanded = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds = new Set<string>();
    const collectIds = (treeNodes: TreeNode[]) => {
      treeNodes.forEach(tn => {
        if (tn.children.length > 0) {
          allIds.add(tn.node.id);
          collectIds(tn.children);
        }
      });
    };
    collectIds(tree);
    setExpandedNodes(allIds);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  const selectedNode = selectedNodeId 
    ? nodes.find(n => n.id === selectedNodeId) 
    : null;

  // Count stats
  const stats = useMemo(() => {
    let containers = 0;
    let resources = 0;
    let issues = 0;
    
    const countNodes = (treeNodes: TreeNode[]) => {
      treeNodes.forEach(tn => {
        if (tn.placementInfo.isContainer) {
          containers++;
        } else {
          resources++;
        }
        if (tn.hasPlacementIssue) issues++;
        countNodes(tn.children);
      });
    };
    countNodes(tree);
    
    return { containers, resources, issues };
  }, [tree]);

  return (
    <div className={cn(
      "flex flex-col bg-slate-800 border-l border-slate-700 text-white",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium">Hierarchy</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={expandAll}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
            title="Expand all"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
          <button
            onClick={collapseAll}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
            title="Collapse all"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
          <button
            onClick={() => setShowRules(!showRules)}
            className={cn(
              "p-1 hover:bg-slate-700 rounded",
              showRules ? "text-blue-400" : "text-slate-400 hover:text-white"
            )}
            title={showRules ? "Hide rules" : "Show rules"}
          >
            {showRules ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] text-slate-400 border-b border-slate-700/50">
        <span>{stats.containers} containers</span>
        <span>{stats.resources} resources</span>
        {stats.issues > 0 && (
          <span className="text-amber-400 flex items-center gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5" />
            {stats.issues} issues
          </span>
        )}
      </div>

      {/* Tree view */}
      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 ? (
          <div className="px-3 py-4 text-xs text-slate-500 text-center">
            No elements in diagram
          </div>
        ) : (
          tree.map(treeNode => (
            <TreeNodeItem
              key={treeNode.node.id}
              treeNode={treeNode}
              selectedNodeId={selectedNodeId}
              onNodeSelect={onNodeSelect}
              onNodeFocus={onNodeFocus}
              expandedNodes={expandedNodes}
              toggleExpanded={toggleExpanded}
            />
          ))
        )}
      </div>

      {/* Rules panel for selected node */}
      {showRules && selectedNode && (
        <NodeRulesPanel node={selectedNode} nodes={nodes} />
      )}
    </div>
  );
}
