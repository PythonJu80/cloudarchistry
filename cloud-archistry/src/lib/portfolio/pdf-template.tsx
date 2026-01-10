import React from "react";
import path from "path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Rect,
  Path,
  G,
  Text as SvgText,
  Image,
} from "@react-pdf/renderer";
import { AWS_SERVICES, getServiceById } from "@/lib/aws-services";
import { applyDynamicLayout, DiagramNode as LayoutDiagramNode } from "@/lib/diagram-layout";
import fs from "fs";

// Get absolute path to public directory for server-side icon loading
const PUBLIC_DIR = path.join(process.cwd(), "public");
const AWS_ICONS_DIR = path.join(PUBLIC_DIR, "aws-icons");

// Cache for programmatically discovered icons
let iconCache: Map<string, string> | null = null;

// Build icon cache by scanning the aws-icons directory structure
function buildIconCache(): Map<string, string> {
  if (iconCache) return iconCache;
  
  iconCache = new Map<string, string>();
  
  try {
    // Scan Architecture-Service-Icons (main services) - prefer 64px PNGs
    const servicesDir = path.join(AWS_ICONS_DIR, "Architecture-Service-Icons_07312025");
    if (fs.existsSync(servicesDir)) {
      const folders = fs.readdirSync(servicesDir);
      for (const folder of folders) {
        if (folder.startsWith(".")) continue;
        
        // Check for 64px PNGs first (better quality for PDF)
        const size64Dir = path.join(servicesDir, folder, "64");
        const size48Dir = path.join(servicesDir, folder, "48");
        
        const sizeDir = fs.existsSync(size64Dir) ? size64Dir : (fs.existsSync(size48Dir) ? size48Dir : null);
        const sizeSuffix = fs.existsSync(size64Dir) ? "64" : "48";
        
        if (sizeDir) {
          const files = fs.readdirSync(sizeDir);
          for (const file of files) {
            if (!file.endsWith(".png") || file.includes("@5x")) continue;
            
            // Extract service name and create multiple lookup keys
            // e.g., Arch_Amazon-Route-53_64.png -> route53, route-53, amazon-route-53
            // e.g., Arch_AWS-Key-Management-Service_48.png -> kms, key-management-service
            const baseName = file.replace(`_${sizeSuffix}.png`, "").replace("Arch_", "");
            const withHyphens = baseName.toLowerCase().replace(/[^a-z0-9-]/g, "");
            const withoutHyphens = withHyphens.replace(/-/g, "");
            const shortWithHyphens = withHyphens.replace("amazon-", "").replace("aws-", "");
            const shortWithoutHyphens = shortWithHyphens.replace(/-/g, "");
            
            const iconPath = `/aws-icons/Architecture-Service-Icons_07312025/${folder}/${sizeSuffix}/${file}`;
            
            // Add multiple lookup keys - both with and without hyphens
            iconCache.set(shortWithoutHyphens, iconPath);  // e.g., "route53", "keymanagementservice"
            iconCache.set(shortWithHyphens, iconPath);     // e.g., "route-53", "key-management-service"
            iconCache.set(withoutHyphens, iconPath);       // e.g., "amazonroute53"
            iconCache.set(withHyphens, iconPath);          // e.g., "amazon-route-53"
            
            // Generate abbreviations from hyphenated names (e.g., "key-management-service" -> "kms")
            const words = shortWithHyphens.split("-");
            if (words.length > 1) {
              const abbrev = words.map(w => w[0]).join("");
              iconCache.set(abbrev, iconPath);  // e.g., "kms", "cw" for cloudwatch
            }
          }
        }
      }
    }
    
    // Scan Resource-Icons for general icons (users, IGW, ALB, etc.)
    const resourcesDir = path.join(AWS_ICONS_DIR, "Resource-Icons_07312025");
    if (fs.existsSync(resourcesDir)) {
      const folders = fs.readdirSync(resourcesDir);
      for (const folder of folders) {
        if (folder.startsWith(".")) continue;
        const folderPath = path.join(resourcesDir, folder);
        
        // Scan files directly in the folder (e.g., Res_Amazon-VPC_Internet-Gateway_48.png)
        if (fs.statSync(folderPath).isDirectory()) {
          const files = fs.readdirSync(folderPath);
          for (const file of files) {
            if (!file.endsWith("_48.png") || file.includes("@5x")) continue;
            
            // e.g., Res_Amazon-VPC_Internet-Gateway_48.png
            // Pattern: Res_{Service}_{Resource}_48.png
            const baseName = file.replace("_48.png", "").replace("Res_", "");
            const parts = baseName.split("_"); // ["Amazon-VPC", "Internet-Gateway"]
            
            const iconPath = `/aws-icons/Resource-Icons_07312025/${folder}/${file}`;
            
            // Create lookup keys from ALL parts of the filename
            for (const part of parts) {
              const withHyphens = part.toLowerCase();
              const withoutHyphens = withHyphens.replace(/-/g, "");
              const withoutAmazon = withHyphens.replace("amazon-", "").replace("aws-", "");
              const withoutAmazonNoHyphens = withoutAmazon.replace(/-/g, "");
              
              iconCache.set(withHyphens, iconPath);
              iconCache.set(withoutHyphens, iconPath);
              iconCache.set(withoutAmazon, iconPath);
              iconCache.set(withoutAmazonNoHyphens, iconPath);
              
              // Extract abbreviations from hyphenated names (e.g., "Internet-Gateway" -> "IG", "Application-Load-Balancer" -> "ALB")
              const words = part.split("-");
              if (words.length > 1) {
                const abbrev = words.map(w => w[0]).join("").toLowerCase();
                iconCache.set(abbrev, iconPath);
              }
            }
            
            // Also create key from full resource name (last part)
            const resourcePart = parts[parts.length - 1];
            const fullWithHyphens = resourcePart.toLowerCase();
            const fullWithoutHyphens = fullWithHyphens.replace(/-/g, "");
            iconCache.set(fullWithHyphens, iconPath);
            iconCache.set(fullWithoutHyphens, iconPath);
          }
        }
        
        // Also check for Res_48_Light subfolder (common structure for other icons)
        const lightDir = path.join(folderPath, "Res_48_Light");
        if (fs.existsSync(lightDir)) {
          const files = fs.readdirSync(lightDir);
          for (const file of files) {
            if (!file.endsWith(".png") || file.includes("@5x")) continue;
            
            // e.g., Res_Users_48_Light.png -> users, icon-users, iam-user
            const baseName = file.replace("_48_Light.png", "").replace("Res_", "");
            const normalized = baseName.toLowerCase().replace(/[^a-z0-9]/g, "");
            
            const iconPath = `/aws-icons/Resource-Icons_07312025/${folder}/Res_48_Light/${file}`;
            
            iconCache.set(normalized, iconPath);           // e.g., "users"
            iconCache.set(`icon-${normalized}`, iconPath); // e.g., "icon-users"
            iconCache.set(`iam-${normalized}`, iconPath);  // e.g., "iam-users"
            // Handle singular/plural
            if (normalized.endsWith("s")) {
              iconCache.set(`iam-${normalized.slice(0, -1)}`, iconPath); // e.g., "iam-user"
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error building icon cache:", error);
  }
  
  return iconCache;
}

// Get PNG icon path for a service ID by searching the icon directories
function getAwsIconPngPath(serviceId: string): string | undefined {
  const cache = buildIconCache();
  
  // Try direct lookup
  if (cache.has(serviceId)) {
    const iconPath = cache.get(serviceId)!;
    const fullPath = path.join(PUBLIC_DIR, iconPath);
    if (fs.existsSync(fullPath)) return iconPath;
  }
  
  // Try normalized version
  const normalized = serviceId.toLowerCase().replace(/[^a-z0-9]/g, "-");
  if (cache.has(normalized)) {
    const iconPath = cache.get(normalized)!;
    const fullPath = path.join(PUBLIC_DIR, iconPath);
    if (fs.existsSync(fullPath)) return iconPath;
  }
  
  // Try without common prefixes
  const withoutPrefix = normalized.replace("amazon-", "").replace("aws-", "").replace("icon-", "").replace("iam-", "");
  if (cache.has(withoutPrefix)) {
    const iconPath = cache.get(withoutPrefix)!;
    const fullPath = path.join(PUBLIC_DIR, iconPath);
    if (fs.existsSync(fullPath)) return iconPath;
  }
  
  return undefined;
}

// Using built-in Helvetica font for reliability in Docker/server environments
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 30,
    borderBottom: "2px solid #8b5cf6",
    paddingBottom: 20,
  },
  badge: {
    backgroundColor: "#f3e8ff",
    color: "#7c3aed",
    padding: "4 8",
    borderRadius: 4,
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 10,
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: 6,
  },
  paragraph: {
    fontSize: 11,
    lineHeight: 1.6,
    color: "#475569",
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: 20,
    gap: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a",
  },
  statLabel: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 4,
  },
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  tag: {
    backgroundColor: "#fff7ed",
    color: "#c2410c",
    padding: "4 8",
    borderRadius: 4,
    fontSize: 9,
    fontWeight: "normal",
  },
  complianceTag: {
    backgroundColor: "#f0fdf4",
    color: "#166534",
    padding: "4 8",
    borderRadius: 4,
    fontSize: 9,
    fontWeight: "normal",
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 6,
  },
  bullet: {
    width: 15,
    color: "#8b5cf6",
  },
  listText: {
    flex: 1,
    fontSize: 10,
    color: "#475569",
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: "1px solid #e2e8f0",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
    color: "#94a3b8",
  },
  diagramPlaceholder: {
    backgroundColor: "#f1f5f9",
    height: 200,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    border: "1px dashed #cbd5e1",
  },
  diagramText: {
    color: "#64748b",
    fontSize: 12,
  },
  diagramImage: {
    width: "100%",
    height: 250,
    objectFit: "contain",
    marginTop: 10,
    borderRadius: 4,
  },
  diagramPage: {
    padding: 40,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  diagramHeader: {
    marginBottom: 20,
    borderBottom: "2px solid #8b5cf6",
    paddingBottom: 15,
  },
  diagramContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
  },
  diagramImageFull: {
    width: "100%",
    height: "auto",
    maxHeight: 650,
    objectFit: "contain",
  },
  // Pitch Deck Styles (landscape slides for business presentation)
  pitchSlide: {
    padding: 40,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    position: "relative" as const,
  },
  pitchBadge: {
    padding: "4 12",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: "bold" as const,
    marginBottom: 15,
    alignSelf: "flex-start" as const,
  },
  pitchTitle: {
    fontSize: 26,
    fontWeight: "bold" as const,
    color: "#0f172a",
    marginBottom: 15,
  },
  pitchSubtitle: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 20,
    lineHeight: 1.5,
  },
  pitchCard: {
    backgroundColor: "#fafafa",
    padding: 14,
    borderRadius: 6,
    marginBottom: 10,
    borderLeft: "3px solid #dc2626",
  },
  pitchCardText: {
    fontSize: 11,
    color: "#334155",
    lineHeight: 1.4,
  },
  pitchImpactBox: {
    backgroundColor: "#fef2f2",
    padding: 14,
    borderRadius: 6,
    marginTop: 12,
  },
  pitchImpactText: {
    fontSize: 12,
    color: "#dc2626",
    fontWeight: "bold" as const,
    textAlign: "center" as const,
  },
  pitchServicesRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 6,
    marginBottom: 15,
  },
  pitchServiceTag: {
    backgroundColor: "#fff7ed",
    color: "#ea580c",
    padding: "5 10",
    borderRadius: 4,
    fontSize: 9,
    fontWeight: "bold" as const,
  },
  pitchBenefitRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    marginBottom: 8,
  },
  pitchBenefitCheck: {
    width: 16,
    height: 16,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    marginRight: 8,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  pitchBenefitText: {
    flex: 1,
    fontSize: 11,
    color: "#334155",
  },
  pitchPhaseRow: {
    flexDirection: "row" as const,
    gap: 15,
    marginTop: 10,
  },
  pitchPhaseCard: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
  },
  pitchPhaseNumber: {
    fontSize: 9,
    fontWeight: "bold" as const,
    marginBottom: 4,
  },
  pitchPhaseTitle: {
    fontSize: 12,
    fontWeight: "bold" as const,
    color: "#0f172a",
    marginBottom: 6,
  },
  pitchPhaseDesc: {
    fontSize: 9,
    color: "#475569",
    lineHeight: 1.3,
  },
  pitchTimelineBox: {
    backgroundColor: "#eff6ff",
    padding: 12,
    borderRadius: 6,
    marginTop: 15,
    alignItems: "center" as const,
  },
  pitchTimelineText: {
    fontSize: 14,
    fontWeight: "bold" as const,
    color: "#2563eb",
  },
  pitchCostRow: {
    flexDirection: "row" as const,
    gap: 20,
    marginTop: 15,
    marginBottom: 15,
  },
  pitchCostCard: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: "center" as const,
  },
  pitchCostLabel: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 6,
  },
  pitchCostValue: {
    fontSize: 24,
    fontWeight: "bold" as const,
  },
  pitchRoiBox: {
    backgroundColor: "#f0fdf4",
    padding: 14,
    borderRadius: 6,
    alignItems: "center" as const,
    marginBottom: 15,
  },
  pitchRoiText: {
    fontSize: 14,
    fontWeight: "bold" as const,
    color: "#16a34a",
  },
  pitchNextStepRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    marginBottom: 8,
  },
  pitchNextStepNum: {
    width: 20,
    height: 20,
    backgroundColor: "#7c3aed",
    borderRadius: 10,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: 10,
  },
  pitchNextStepNumText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold" as const,
  },
  pitchNextStepText: {
    flex: 1,
    fontSize: 11,
    color: "#334155",
    paddingTop: 2,
  },
  pitchCtaBox: {
    backgroundColor: "#7c3aed",
    padding: 14,
    borderRadius: 6,
    marginTop: 12,
    alignItems: "center" as const,
  },
  pitchCtaText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold" as const,
  },
  pitchFooter: {
    position: "absolute" as const,
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    borderTop: "1px solid #e2e8f0",
    paddingTop: 8,
  },
  pitchFooterText: {
    fontSize: 8,
    color: "#64748b",
  },
  pitchFooterPage: {
    fontSize: 8,
    color: "#7c3aed",
    fontWeight: "bold" as const,
  },
});

interface DiagramNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    serviceId?: string;
    label: string;
    sublabel?: string;
    color?: string;
    subnetType?: "public" | "private";
    icon?: string;
  };
  parentId?: string;
  width?: number;
  height?: number;
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface PortfolioPDFData {
  title: string;
  companyName: string;
  industry: string;
  businessUseCase: string;
  problemStatement: string;
  solutionSummary: string;
  awsServices: string[];
  keyDecisions: string[];
  complianceAchieved: string[];
  technicalHighlights?: string[];
  createdAt: string;
  architectureDiagram?: { nodes: DiagramNode[]; edges: DiagramEdge[] } | null;
  // Pitch deck data (optional - for lead generation)
  pitchDeck?: PitchDeckData | null;
}

// Pitch Deck types for business presentation slides
export interface PitchDeckSlide {
  badge: string;
  title: string;
  subtitle: string;
  content1: string;
  content2: string;
  content3: string;
  footer: string;
}

export interface PitchDeckData {
  authorName: string;
  date: string;
  slides: PitchDeckSlide[];
}

// Build service lookup maps from AWS_SERVICES for efficient label resolution
const serviceByName = new Map<string, { shortName: string; id: string }>();
const serviceById = new Map<string, { shortName: string; name: string }>();
for (const svc of AWS_SERVICES) {
  serviceByName.set(svc.name.toLowerCase(), { shortName: svc.shortName, id: svc.id });
  serviceById.set(svc.id, { shortName: svc.shortName, name: svc.name });
}

// Clean label from Draw.io artifacts like "=e"
function cleanLabel(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#xa;/g, " ")
    .replace(/&#x[0-9a-fA-F]+;/g, " ")
    .replace(/^=+[a-zA-Z]?$/g, "")
    .replace(/=[a-zA-Z](?=\s|$)/g, "")
    .replace(/^[=\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Get abbreviated label for diagram display using aws-services.ts data
function getAbbreviatedLabel(label: string, serviceId?: string): string {
  // Clean the label first to remove Draw.io artifacts
  const cleaned = cleanLabel(label);
  
  // First try to get shortName by serviceId (most reliable)
  if (serviceId) {
    const svc = getServiceById(serviceId);
    if (svc) return svc.shortName;
  }
  
  // Try to match by name
  const byName = serviceByName.get(cleaned.toLowerCase());
  if (byName) return byName.shortName;
  
  // Try partial match on name
  for (const [name, svc] of serviceByName) {
    if (cleaned.toLowerCase().includes(name) || name.includes(cleaned.toLowerCase())) {
      return svc.shortName;
    }
  }
  
  // Truncate long labels as fallback
  if (cleaned.length > 12) {
    return cleaned.substring(0, 10) + "..";
  }
  return cleaned;
}

// Render diagram using react-pdf SVG primitives - matching aws-nodes.tsx styles
function DiagramRenderer({ diagram }: { diagram: { nodes: DiagramNode[]; edges: DiagramEdge[] } }) {
  // Apply dynamic layout to fix overlapping nodes and resize subnets/VPC dynamically
  const layoutNodes = applyDynamicLayout(diagram.nodes as LayoutDiagramNode[]) as DiagramNode[];
  const nodes = layoutNodes;
  const edges = diagram.edges;
  
  // Build a map of all nodes by ID
  const nodeMap = new Map<string, DiagramNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));
  
  // Get node dimensions - use actual width/height if available, otherwise defaults
  const getNodeDimensions = (node: DiagramNode): { w: number; h: number } => {
    if (node.type === "vpc") {
      return { w: node.width || 700, h: node.height || 450 };
    } else if (node.type === "subnet") {
      return { w: node.width || 300, h: node.height || 150 };
    } else {
      // awsResource, genericIcon - use actual dimensions or default
      return { w: node.width || 80, h: node.height || 80 };
    }
  };
  
  // Calculate absolute position by walking up the parent chain
  const getAbsolutePosition = (node: DiagramNode): { x: number; y: number } => {
    let x = node.position.x;
    let y = node.position.y;
    let current = node;
    while (current.parentId) {
      const parent = nodeMap.get(current.parentId);
      if (parent) {
        x += parent.position.x;
        y += parent.position.y;
        current = parent;
      } else break;
    }
    return { x, y };
  };
  
  // Separate node types - include genericIcon with resources
  const vpcNodes = nodes.filter(n => n.type === "vpc");
  const subnetNodes = nodes.filter(n => n.type === "subnet");
  const resourceNodes = nodes.filter(n => n.type === "awsResource" || n.type === "genericIcon");
  
  // Calculate bounds from ALL nodes using actual dimensions
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const absolutePositions = new Map<string, { x: number; y: number }>();
  const nodeDimensions = new Map<string, { w: number; h: number }>();
  
  nodes.forEach(node => {
    const pos = getAbsolutePosition(node);
    const dims = getNodeDimensions(node);
    absolutePositions.set(node.id, pos);
    nodeDimensions.set(node.id, dims);
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + dims.w);
    maxY = Math.max(maxY, pos.y + dims.h);
  });
  
  if (nodes.length === 0) {
    return <View style={styles.diagramContainer}><Text>No diagram data</Text></View>;
  }
  
  const padding = 30;
  const contentWidth = maxX - minX + padding * 2;
  const contentHeight = maxY - minY + padding * 2;
  
  // Scale to fit - use full page width with more space
  const availableWidth = 540;
  const availableHeight = 400;
  const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1);
  
  const transform = (pos: { x: number; y: number }) => ({
    x: (pos.x - minX + padding) * scale,
    y: (pos.y - minY + padding) * scale,
  });

  // Prepare icon data for overlay rendering - track which nodes have icons
  const iconOverlays: Array<{ x: number; y: number; w: number; h: number; iconPath: string; nodeId: string }> = [];
  const nodesWithIcons = new Set<string>();
  resourceNodes.forEach(node => {
    const pos = absolutePositions.get(node.id);
    const dims = nodeDimensions.get(node.id);
    if (!pos || !dims) return;
    const { x, y } = transform(pos);
    const w = Math.max(dims.w * scale, 50);
    const h = Math.max(dims.h * scale, 40);
    const iconRelPath = node.data.serviceId ? getAwsIconPngPath(node.data.serviceId) : undefined;
    if (iconRelPath) {
      const iconPath = path.join(PUBLIC_DIR, iconRelPath);
      iconOverlays.push({ x, y, w, h, iconPath, nodeId: node.id });
      nodesWithIcons.add(node.id);
    }
  });

  return (
    <View style={styles.diagramContainer}>
      {/* Wrapper with fixed dimensions to match SVG - icons positioned relative to this */}
      <View style={{ width: availableWidth, height: availableHeight, position: "relative" }}>
        <Svg width={availableWidth} height={availableHeight}>
          {/* Background */}
          <Rect x={0} y={0} width={availableWidth} height={availableHeight} fill="#f8fafc" rx={6} />
        
        {/* 1. Draw VPC container - subtle light purple, dashed border */}
        {vpcNodes.map(node => {
          const pos = absolutePositions.get(node.id);
          const dims = nodeDimensions.get(node.id);
          if (!pos || !dims) return null;
          const { x, y } = transform(pos);
          const w = dims.w * scale;
          const h = dims.h * scale;
          return (
            <G key={node.id}>
              <Rect x={x} y={y} width={w} height={h} rx={6} fill="#faf5ff" stroke="#c4b5fd" strokeWidth={1.5} strokeDasharray="8,4" />
              <Rect x={x + 10} y={y + 6} width={Math.min(100, w * 0.3)} height={16} rx={3} fill="white" stroke="#a78bfa" strokeWidth={0.75} />
              <SvgText x={x + 10 + Math.min(50, w * 0.15)} y={y + 17} style={{ fontSize: 8 }} fill="#7c3aed" textAnchor="middle">{node.data.label}</SvgText>
            </G>
          );
        })}
        
        {/* 2. Draw Subnet containers - ensure minimum size */}
        {subnetNodes.map(node => {
          const pos = absolutePositions.get(node.id);
          const dims = nodeDimensions.get(node.id);
          if (!pos || !dims) return null;
          const { x, y } = transform(pos);
          const w = Math.max(dims.w * scale, 120);
          const h = Math.max(dims.h * scale, 80);
          const isPublic = node.data.subnetType === "public";
          const borderColor = isPublic ? "#4ade80" : "#60a5fa";
          const bgColor = isPublic ? "#f0fdf4" : "#eff6ff";
          const headerBg = isPublic ? "#bbf7d0" : "#bfdbfe";
          const textColor = isPublic ? "#166534" : "#1e40af";
          return (
            <G key={node.id}>
              <Rect x={x} y={y} width={w} height={h} rx={4} fill={bgColor} stroke={borderColor} strokeWidth={1.5} />
              <Rect x={x} y={y} width={w} height={18} rx={4} fill={headerBg} />
              <SvgText x={x + 8} y={y + 13} style={{ fontSize: 8 }} fill={textColor}>{node.data.label}</SvgText>
            </G>
          );
        })}
        
        {/* 3. Draw edges - smooth step paths with arrows */}
        {edges.map(edge => {
          const sourceNode = nodeMap.get(edge.source);
          const targetNode = nodeMap.get(edge.target);
          const sourcePos = absolutePositions.get(edge.source);
          const targetPos = absolutePositions.get(edge.target);
          const sourceDims = nodeDimensions.get(edge.source);
          const targetDims = nodeDimensions.get(edge.target);
          if (!sourcePos || !targetPos || !sourceDims || !targetDims || !sourceNode || !targetNode) return null;
          
          const src = transform(sourcePos);
          const tgt = transform(targetPos);
          const sw = sourceDims.w * scale;
          const sh = sourceDims.h * scale;
          const tw = targetDims.w * scale;
          const th = targetDims.h * scale;
          
          // Determine connection points based on handles or relative positions
          let x1: number, y1: number, x2: number, y2: number;
          
          // Source point
          if (edge.sourceHandle === "right") {
            x1 = src.x + sw;
            y1 = src.y + sh / 2;
          } else if (edge.sourceHandle === "bottom") {
            x1 = src.x + sw / 2;
            y1 = src.y + sh;
          } else {
            // Default: right side
            x1 = src.x + sw;
            y1 = src.y + sh / 2;
          }
          
          // Target point
          if (edge.targetHandle === "left") {
            x2 = tgt.x;
            y2 = tgt.y + th / 2;
          } else if (edge.targetHandle === "top") {
            x2 = tgt.x + tw / 2;
            y2 = tgt.y;
          } else {
            // Default: left side
            x2 = tgt.x;
            y2 = tgt.y + th / 2;
          }
          
          // Draw smooth step path
          const midX = (x1 + x2) / 2;
          const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
          
          return (
            <G key={edge.id}>
              <Path d={path} stroke="#22d3ee" strokeWidth={1.5} fill="none" />
              {/* Arrow head */}
              <Path d={`M ${x2-6} ${y2-4} L ${x2} ${y2} L ${x2-6} ${y2+4}`} stroke="#22d3ee" strokeWidth={1.5} fill="none" />
            </G>
          );
        })}
        
        {/* 4. Draw resource nodes - clean cards with label or icon placeholder */}
        {resourceNodes.map(node => {
          const pos = absolutePositions.get(node.id);
          const dims = nodeDimensions.get(node.id);
          if (!pos || !dims) return null;
          const { x, y } = transform(pos);
          const w = Math.max(dims.w * scale, 55);
          const h = Math.max(dims.h * scale, 50);
          const color = node.data.color || "#6b7280";
          const displayLabel = getAbbreviatedLabel(node.data.label, node.data.serviceId);
          const hasIcon = nodesWithIcons.has(node.id);
          
          return (
            <G key={node.id}>
              {/* Card shadow */}
              <Rect x={x + 1} y={y + 1} width={w} height={h} rx={4} fill="#e2e8f0" />
              {/* Card background */}
              <Rect x={x} y={y} width={w} height={h} rx={4} fill="white" stroke="#e2e8f0" strokeWidth={1} />
              {/* Left color accent bar */}
              <Rect x={x} y={y} width={4} height={h} rx={2} fill={color} />
              {/* Show label in center only if no icon */}
              {!hasIcon && (
                <SvgText x={x + w/2} y={y + h/2 + 2} style={{ fontSize: 7, fontWeight: "bold" }} fill="#1f2937" textAnchor="middle">{displayLabel}</SvgText>
              )}
              {/* Service label at bottom - always show */}
              <SvgText x={x + w/2} y={y + h - 4} style={{ fontSize: 5 }} fill="#6b7280" textAnchor="middle">{displayLabel}</SvgText>
            </G>
          );
        })}
      </Svg>
      {/* Icon overlay - rendered outside SVG using absolute positioning */}
      {iconOverlays.map(({ x, y, w, h, iconPath, nodeId }) => {
        const iconSize = Math.min(w * 0.5, h * 0.5, 24);
        return (
          <Image
            key={`icon-${nodeId}`}
            src={iconPath}
            style={{
              position: "absolute",
              left: x + (w - iconSize) / 2 + 3,
              top: y + (h - iconSize) / 2 - 2,
              width: iconSize,
              height: iconSize,
            }}
          />
        );
      })}
      </View>
    </View>
  );
}

export function PortfolioPDF({ data }: { data: PortfolioPDFData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.badge}>AWS ARCHITECTURE PORTFOLIO</Text>
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.subtitle}>
            {data.companyName} • {data.industry}
          </Text>
        </View>

        {/* Business Context */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Context</Text>
          <Text style={styles.paragraph}>{data.businessUseCase}</Text>
        </View>

        {/* Problem Statement */}
        {data.problemStatement && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>The Challenge</Text>
            <Text style={styles.paragraph}>{data.problemStatement}</Text>
          </View>
        )}

        {/* Solution Summary */}
        {data.solutionSummary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Solution Architecture</Text>
            <Text style={styles.paragraph}>{data.solutionSummary}</Text>
          </View>
        )}

        {/* AWS Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AWS Services Used</Text>
          <View style={styles.tagContainer}>
            {data.awsServices.map((service, i) => (
              <Text key={i} style={styles.tag}>
                {service}
              </Text>
            ))}
          </View>
        </View>

        {/* Key Decisions */}
        {data.keyDecisions && data.keyDecisions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Architectural Decisions</Text>
            {data.keyDecisions.map((decision, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.listText}>{decision}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Compliance */}
        {data.complianceAchieved && data.complianceAchieved.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compliance Standards</Text>
            <View style={styles.tagContainer}>
              {data.complianceAchieved.map((standard, i) => (
                <Text key={i} style={styles.complianceTag}>
                  {standard}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Generated by Cloud Archistry</Text>
          <Text>{new Date(data.createdAt).toLocaleDateString()}</Text>
        </View>
      </Page>

      {/* Page 2: Technical Highlights (if available) */}
      {data.technicalHighlights && data.technicalHighlights.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.badge}>TECHNICAL EXPERTISE</Text>
            <Text style={styles.title}>Implementation Highlights</Text>
            <Text style={styles.subtitle}>{data.companyName} • {data.industry}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Technical Accomplishments</Text>
            {data.technicalHighlights.map((highlight: string, i: number) => (
              <View key={i} style={styles.listItem}>
                <Text style={[styles.bullet, { color: "#16a34a" }]}>✓</Text>
                <Text style={styles.listText}>{highlight}</Text>
              </View>
            ))}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text>Generated by Cloud Archistry</Text>
            <Text>{new Date(data.createdAt).toLocaleDateString()}</Text>
          </View>
        </Page>
      )}

      {/* Architecture Diagram Page */}
      {data.architectureDiagram && data.architectureDiagram.nodes.length > 0 && (
        <Page size="A4" orientation="landscape" style={styles.diagramPage}>
          <View style={styles.diagramHeader}>
            <Text style={styles.title}>Architecture Diagram</Text>
            <Text style={styles.subtitle}>{data.title}</Text>
          </View>
          <DiagramRenderer diagram={data.architectureDiagram} />
          <View style={styles.footer}>
            <Text>Generated by Cloud Archistry</Text>
            <Text>{new Date(data.createdAt).toLocaleDateString()}</Text>
          </View>
        </Page>
      )}

      {/* ========== PITCH DECK SECTION (Business Presentation) ========== */}
      {data.pitchDeck && data.pitchDeck.slides.length >= 5 && (() => {
        const totalSlides = data.pitchDeck!.slides.length;
        return (
        <>
          {/* Pitch Slide 1: Title */}
          <Page size={[842, 595]} style={styles.pitchSlide}>
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text style={[styles.pitchBadge, { backgroundColor: "#f3e8ff", color: "#7c3aed" }]}>
                {data.pitchDeck!.slides[0].badge}
              </Text>
              <Text style={[styles.pitchTitle, { fontSize: 32, textAlign: "center", marginBottom: 10 }]}>
                {data.pitchDeck!.slides[0].title}
              </Text>
              <Text style={[styles.pitchSubtitle, { textAlign: "center", marginBottom: 15 }]}>
                {data.pitchDeck!.slides[0].subtitle}
              </Text>
              <Text style={{ fontSize: 18, color: "#7c3aed", fontWeight: "bold", marginBottom: 15 }}>
                {data.companyName}
              </Text>
              {data.pitchDeck!.slides[0].content2 && (
                <Text style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>{data.pitchDeck!.slides[0].content2}</Text>
              )}
              {data.pitchDeck!.slides[0].content3 && (
                <Text style={{ fontSize: 10, color: "#64748b", marginBottom: 20, textAlign: "center", maxWidth: 400 }}>{data.pitchDeck!.slides[0].content3}</Text>
              )}
              <View style={{ flexDirection: "row", gap: 20 }}>
                <Text style={{ fontSize: 10, color: "#64748b" }}>Prepared by {data.pitchDeck!.authorName}</Text>
                <Text style={{ fontSize: 10, color: "#64748b" }}>•</Text>
                <Text style={{ fontSize: 10, color: "#64748b" }}>{data.pitchDeck!.date}</Text>
              </View>
            </View>
            <View style={styles.pitchFooter}>
              <Text style={styles.pitchFooterText}>Confidential</Text>
              <Text style={styles.pitchFooterPage}>1 / {totalSlides}</Text>
            </View>
          </Page>

          {/* Pitch Slide 2: The Challenge */}
          <Page size={[842, 595]} style={styles.pitchSlide}>
            <Text style={[styles.pitchBadge, { backgroundColor: "#fef2f2", color: "#dc2626" }]}>
              {data.pitchDeck!.slides[1].badge}
            </Text>
            <Text style={styles.pitchTitle}>{data.pitchDeck!.slides[1].title}</Text>
            {data.pitchDeck!.slides[1].subtitle && (
              <Text style={[styles.pitchSubtitle, { marginBottom: 15 }]}>{data.pitchDeck!.slides[1].subtitle}</Text>
            )}
            <View>
              <View style={styles.pitchCard}>
                <Text style={styles.pitchCardText}>{data.pitchDeck!.slides[1].content1}</Text>
              </View>
              <View style={styles.pitchCard}>
                <Text style={styles.pitchCardText}>{data.pitchDeck!.slides[1].content2}</Text>
              </View>
              <View style={styles.pitchCard}>
                <Text style={styles.pitchCardText}>{data.pitchDeck!.slides[1].content3}</Text>
              </View>
            </View>
            <View style={styles.pitchImpactBox}>
              <Text style={styles.pitchImpactText}>{data.pitchDeck!.slides[1].footer}</Text>
            </View>
            <View style={styles.pitchFooter}>
              <Text style={styles.pitchFooterText}>{data.companyName} • Cloud Migration Proposal</Text>
              <Text style={styles.pitchFooterPage}>2 / {totalSlides}</Text>
            </View>
          </Page>

          {/* Pitch Slide 3: The Solution */}
          <Page size={[842, 595]} style={styles.pitchSlide}>
            <Text style={[styles.pitchBadge, { backgroundColor: "#f0fdf4", color: "#16a34a" }]}>
              {data.pitchDeck!.slides[2].badge}
            </Text>
            <Text style={styles.pitchTitle}>{data.pitchDeck!.slides[2].title}</Text>
            <Text style={styles.pitchSubtitle}>{data.pitchDeck!.slides[2].subtitle}</Text>
            <View style={{ flexDirection: "row", gap: 30 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>AWS Services</Text>
                <View style={styles.pitchServicesRow}>
                  {data.awsServices.slice(0, 8).map((svc, i) => (
                    <Text key={i} style={styles.pitchServiceTag}>{svc}</Text>
                  ))}
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>Key Benefits</Text>
                <View style={styles.pitchBenefitRow}>
                  <View style={styles.pitchBenefitCheck}>
                    <Text style={{ color: "#16a34a", fontSize: 10 }}>✓</Text>
                  </View>
                  <Text style={styles.pitchBenefitText}>{data.pitchDeck!.slides[2].content2}</Text>
                </View>
                <View style={styles.pitchBenefitRow}>
                  <View style={styles.pitchBenefitCheck}>
                    <Text style={{ color: "#16a34a", fontSize: 10 }}>✓</Text>
                  </View>
                  <Text style={styles.pitchBenefitText}>{data.pitchDeck!.slides[2].content3}</Text>
                </View>
              </View>
            </View>
            <View style={styles.pitchFooter}>
              <Text style={styles.pitchFooterText}>{data.companyName} • Cloud Migration Proposal</Text>
              <Text style={styles.pitchFooterPage}>3 / {totalSlides}</Text>
            </View>
          </Page>

          {/* Pitch Slide 4: Architecture Deep Dive (NEW) */}
          {data.pitchDeck!.slides[3] && (
          <Page size={[842, 595]} style={styles.pitchSlide}>
            <Text style={[styles.pitchBadge, { backgroundColor: "#fef3c7", color: "#d97706" }]}>
              {data.pitchDeck!.slides[3].badge}
            </Text>
            <Text style={styles.pitchTitle}>{data.pitchDeck!.slides[3].title}</Text>
            {data.pitchDeck!.slides[3].subtitle && (
              <Text style={[styles.pitchSubtitle, { marginBottom: 15 }]}>{data.pitchDeck!.slides[3].subtitle}</Text>
            )}
            <View style={{ gap: 12 }}>
              <View style={[styles.pitchCard, { backgroundColor: "#eff6ff", borderLeftColor: "#3b82f6", borderLeftWidth: 3 }]}>
                <Text style={styles.pitchCardText}>{data.pitchDeck!.slides[3].content1}</Text>
              </View>
              <View style={[styles.pitchCard, { backgroundColor: "#f0fdf4", borderLeftColor: "#22c55e", borderLeftWidth: 3 }]}>
                <Text style={styles.pitchCardText}>{data.pitchDeck!.slides[3].content2}</Text>
              </View>
              <View style={[styles.pitchCard, { backgroundColor: "#fef2f2", borderLeftColor: "#ef4444", borderLeftWidth: 3 }]}>
                <Text style={styles.pitchCardText}>{data.pitchDeck!.slides[3].content3}</Text>
              </View>
            </View>
            {data.pitchDeck!.slides[3].footer && (
              <View style={[styles.pitchTimelineBox, { marginTop: 15 }]}>
                <Text style={styles.pitchTimelineText}>{data.pitchDeck!.slides[3].footer}</Text>
              </View>
            )}
            <View style={styles.pitchFooter}>
              <Text style={styles.pitchFooterText}>{data.companyName} • Cloud Migration Proposal</Text>
              <Text style={styles.pitchFooterPage}>4 / {totalSlides}</Text>
            </View>
          </Page>
          )}

          {/* Pitch Slide 5: Security & Compliance (NEW) */}
          {data.pitchDeck!.slides[4] && (
          <Page size={[842, 595]} style={styles.pitchSlide}>
            <Text style={[styles.pitchBadge, { backgroundColor: "#fef2f2", color: "#dc2626" }]}>
              {data.pitchDeck!.slides[4].badge}
            </Text>
            <Text style={styles.pitchTitle}>{data.pitchDeck!.slides[4].title}</Text>
            {data.pitchDeck!.slides[4].subtitle && (
              <Text style={[styles.pitchSubtitle, { marginBottom: 15 }]}>{data.pitchDeck!.slides[4].subtitle}</Text>
            )}
            <View style={{ gap: 10 }}>
              <View style={[styles.pitchCard, { backgroundColor: "#f8fafc" }]}>
                <Text style={styles.pitchCardText}>{data.pitchDeck!.slides[4].content1}</Text>
              </View>
              <View style={[styles.pitchCard, { backgroundColor: "#f8fafc" }]}>
                <Text style={styles.pitchCardText}>{data.pitchDeck!.slides[4].content2}</Text>
              </View>
              <View style={[styles.pitchCard, { backgroundColor: "#f8fafc" }]}>
                <Text style={styles.pitchCardText}>{data.pitchDeck!.slides[4].content3}</Text>
              </View>
            </View>
            {data.pitchDeck!.slides[4].footer && (
              <View style={[styles.pitchImpactBox, { backgroundColor: "#f0fdf4", marginTop: 15 }]}>
                <Text style={[styles.pitchImpactText, { color: "#16a34a" }]}>{data.pitchDeck!.slides[4].footer}</Text>
              </View>
            )}
            <View style={styles.pitchFooter}>
              <Text style={styles.pitchFooterText}>{data.companyName} • Cloud Migration Proposal</Text>
              <Text style={styles.pitchFooterPage}>5 / {totalSlides}</Text>
            </View>
          </Page>
          )}

          {/* Pitch Slide 6: Implementation Roadmap */}
          {data.pitchDeck!.slides[5] && (
          <Page size={[842, 595]} style={styles.pitchSlide}>
            <Text style={[styles.pitchBadge, { backgroundColor: "#eff6ff", color: "#2563eb" }]}>
              {data.pitchDeck!.slides[5].badge}
            </Text>
            <Text style={styles.pitchTitle}>{data.pitchDeck!.slides[5].title}</Text>
            <View style={styles.pitchPhaseRow}>
              <View style={[styles.pitchPhaseCard, { backgroundColor: "#eff6ff" }]}>
                <Text style={[styles.pitchPhaseNumber, { color: "#2563eb" }]}>PHASE 1</Text>
                <Text style={styles.pitchPhaseTitle}>Foundation</Text>
                <Text style={styles.pitchPhaseDesc}>{data.pitchDeck!.slides[5].subtitle}</Text>
              </View>
              <View style={[styles.pitchPhaseCard, { backgroundColor: "#f3e8ff" }]}>
                <Text style={[styles.pitchPhaseNumber, { color: "#7c3aed" }]}>PHASE 2</Text>
                <Text style={styles.pitchPhaseTitle}>Migration</Text>
                <Text style={styles.pitchPhaseDesc}>{data.pitchDeck!.slides[5].content1}</Text>
              </View>
              <View style={[styles.pitchPhaseCard, { backgroundColor: "#f0fdf4" }]}>
                <Text style={[styles.pitchPhaseNumber, { color: "#16a34a" }]}>PHASE 3</Text>
                <Text style={styles.pitchPhaseTitle}>Optimization</Text>
                <Text style={styles.pitchPhaseDesc}>{data.pitchDeck!.slides[5].content2}</Text>
              </View>
            </View>
            <View style={styles.pitchTimelineBox}>
              <Text style={styles.pitchTimelineText}>{data.pitchDeck!.slides[5].footer}</Text>
            </View>
            <View style={{ marginTop: 15 }}>
              <Text style={{ fontSize: 11, fontWeight: "bold", color: "#0f172a", marginBottom: 8 }}>Quick Wins</Text>
              <Text style={{ fontSize: 10, color: "#475569" }}>{data.pitchDeck!.slides[5].content3}</Text>
            </View>
            <View style={styles.pitchFooter}>
              <Text style={styles.pitchFooterText}>{data.companyName} • Cloud Migration Proposal</Text>
              <Text style={styles.pitchFooterPage}>6 / {totalSlides}</Text>
            </View>
          </Page>
          )}

          {/* Pitch Slide 7: Investment & ROI */}
          {data.pitchDeck!.slides[6] && (
          <Page size={[842, 595]} style={styles.pitchSlide}>
            <Text style={[styles.pitchBadge, { backgroundColor: "#f3e8ff", color: "#7c3aed" }]}>
              {data.pitchDeck!.slides[6].badge}
            </Text>
            <Text style={styles.pitchTitle}>{data.pitchDeck!.slides[6].title}</Text>
            <View style={styles.pitchCostRow}>
              <View style={[styles.pitchCostCard, { backgroundColor: "#f8fafc" }]}>
                <Text style={styles.pitchCostLabel}>Estimated Monthly</Text>
                <Text style={[styles.pitchCostValue, { color: "#0f172a" }]}>
                  {data.pitchDeck!.slides[6].subtitle.split("|")[0]?.replace("Monthly:", "").trim() || "$5,000"}
                </Text>
              </View>
              <View style={[styles.pitchCostCard, { backgroundColor: "#f0fdf4" }]}>
                <Text style={styles.pitchCostLabel}>Estimated Yearly</Text>
                <Text style={[styles.pitchCostValue, { color: "#16a34a" }]}>
                  {data.pitchDeck!.slides[6].subtitle.split("|")[1]?.replace("Yearly:", "").replace("Annual:", "").trim() || "$60,000"}
                </Text>
              </View>
            </View>
            <View style={{ gap: 8, marginTop: 10 }}>
              <View style={[styles.pitchCard, { backgroundColor: "#f8fafc" }]}>
                <Text style={styles.pitchCardText}>{data.pitchDeck!.slides[6].content1}</Text>
              </View>
              <View style={[styles.pitchCard, { backgroundColor: "#f0fdf4" }]}>
                <Text style={styles.pitchCardText}>{data.pitchDeck!.slides[6].content2}</Text>
              </View>
              <View style={[styles.pitchCard, { backgroundColor: "#eff6ff" }]}>
                <Text style={styles.pitchCardText}>{data.pitchDeck!.slides[6].content3}</Text>
              </View>
            </View>
            {data.pitchDeck!.slides[6].footer && (
              <View style={[styles.pitchTimelineBox, { marginTop: 10 }]}>
                <Text style={styles.pitchTimelineText}>{data.pitchDeck!.slides[6].footer}</Text>
              </View>
            )}
            {/* Pricing Disclaimer */}
            <View style={{ marginTop: 8, paddingHorizontal: 20 }}>
              <Text style={{ fontSize: 7, color: "#94a3b8", fontStyle: "italic", textAlign: "center" }}>
                *Cost estimates based on typical usage patterns and current AWS pricing. Actual costs vary based on usage, configuration, region, and pricing changes. A detailed cost analysis will be provided during discovery.
              </Text>
            </View>
            <View style={styles.pitchFooter}>
              <Text style={styles.pitchFooterText}>{data.companyName} • Cloud Migration Proposal</Text>
              <Text style={styles.pitchFooterPage}>7 / {totalSlides}</Text>
            </View>
          </Page>
          )}

          {/* Pitch Slide 8: Next Steps */}
          {data.pitchDeck!.slides[7] && (
          <Page size={[842, 595]} style={styles.pitchSlide}>
            <Text style={[styles.pitchBadge, { backgroundColor: "#f0fdf4", color: "#16a34a" }]}>
              {data.pitchDeck!.slides[7].badge}
            </Text>
            <Text style={styles.pitchTitle}>{data.pitchDeck!.slides[7].title}</Text>
            {data.pitchDeck!.slides[7].subtitle && (
              <Text style={[styles.pitchSubtitle, { marginBottom: 20 }]}>{data.pitchDeck!.slides[7].subtitle}</Text>
            )}
            <View style={{ gap: 12 }}>
              <View style={styles.pitchNextStepRow}>
                <View style={[styles.pitchNextStepNum, { backgroundColor: "#eff6ff" }]}>
                  <Text style={[styles.pitchNextStepNumText, { color: "#2563eb" }]}>1</Text>
                </View>
                <Text style={[styles.pitchNextStepText, { flex: 1 }]}>{data.pitchDeck!.slides[7].content1}</Text>
              </View>
              <View style={styles.pitchNextStepRow}>
                <View style={[styles.pitchNextStepNum, { backgroundColor: "#f3e8ff" }]}>
                  <Text style={[styles.pitchNextStepNumText, { color: "#7c3aed" }]}>2</Text>
                </View>
                <Text style={[styles.pitchNextStepText, { flex: 1 }]}>{data.pitchDeck!.slides[7].content2}</Text>
              </View>
              <View style={styles.pitchNextStepRow}>
                <View style={[styles.pitchNextStepNum, { backgroundColor: "#f0fdf4" }]}>
                  <Text style={[styles.pitchNextStepNumText, { color: "#16a34a" }]}>3</Text>
                </View>
                <Text style={[styles.pitchNextStepText, { flex: 1 }]}>{data.pitchDeck!.slides[7].content3}</Text>
              </View>
            </View>
            <View style={styles.pitchCtaBox}>
              <Text style={styles.pitchCtaText}>{data.pitchDeck!.slides[7].footer}</Text>
            </View>
            <View style={styles.pitchFooter}>
              <Text style={styles.pitchFooterText}>{data.companyName} • Cloud Migration Proposal</Text>
              <Text style={styles.pitchFooterPage}>8 / {totalSlides}</Text>
            </View>
          </Page>
          )}

          {/* Fallback for old 5-slide format - Slide 4 as Implementation if no slide 5+ */}
          {!data.pitchDeck!.slides[5] && data.pitchDeck!.slides[3] && (
          <Page size={[842, 595]} style={styles.pitchSlide}>
            <Text style={[styles.pitchBadge, { backgroundColor: "#eff6ff", color: "#2563eb" }]}>
              {data.pitchDeck!.slides[3].badge}
            </Text>
            <Text style={styles.pitchTitle}>{data.pitchDeck!.slides[3].title}</Text>
            <View style={styles.pitchPhaseRow}>
              <View style={[styles.pitchPhaseCard, { backgroundColor: "#eff6ff" }]}>
                <Text style={[styles.pitchPhaseNumber, { color: "#2563eb" }]}>PHASE 1</Text>
                <Text style={styles.pitchPhaseTitle}>Foundation</Text>
                <Text style={styles.pitchPhaseDesc}>{data.pitchDeck!.slides[3].subtitle}</Text>
              </View>
              <View style={[styles.pitchPhaseCard, { backgroundColor: "#f3e8ff" }]}>
                <Text style={[styles.pitchPhaseNumber, { color: "#7c3aed" }]}>PHASE 2</Text>
                <Text style={styles.pitchPhaseTitle}>Migration</Text>
                <Text style={styles.pitchPhaseDesc}>{data.pitchDeck!.slides[3].content1}</Text>
              </View>
              <View style={[styles.pitchPhaseCard, { backgroundColor: "#f0fdf4" }]}>
                <Text style={[styles.pitchPhaseNumber, { color: "#16a34a" }]}>PHASE 3</Text>
                <Text style={styles.pitchPhaseTitle}>Optimization</Text>
                <Text style={styles.pitchPhaseDesc}>{data.pitchDeck!.slides[3].content2}</Text>
              </View>
            </View>
            <View style={styles.pitchTimelineBox}>
              <Text style={styles.pitchTimelineText}>{data.pitchDeck!.slides[3].footer}</Text>
            </View>
            <View style={{ marginTop: 15 }}>
              <Text style={{ fontSize: 11, fontWeight: "bold", color: "#0f172a", marginBottom: 8 }}>Quick Wins</Text>
              <Text style={{ fontSize: 10, color: "#475569" }}>{data.pitchDeck!.slides[3].content3}</Text>
            </View>
            <View style={styles.pitchFooter}>
              <Text style={styles.pitchFooterText}>{data.companyName} • Cloud Migration Proposal</Text>
              <Text style={styles.pitchFooterPage}>4 / {totalSlides}</Text>
            </View>
          </Page>
          )}

          {/* Fallback for old 5-slide format - Slide 5 as Investment if no slide 6+ */}
          {!data.pitchDeck!.slides[6] && data.pitchDeck!.slides[4] && (
          <Page size={[842, 595]} style={styles.pitchSlide}>
            <Text style={[styles.pitchBadge, { backgroundColor: "#f3e8ff", color: "#7c3aed" }]}>
              {data.pitchDeck!.slides[4].badge}
            </Text>
            <Text style={styles.pitchTitle}>{data.pitchDeck!.slides[4].title}</Text>
            <View style={styles.pitchCostRow}>
              <View style={[styles.pitchCostCard, { backgroundColor: "#f8fafc" }]}>
                <Text style={styles.pitchCostLabel}>Estimated Monthly</Text>
                <Text style={[styles.pitchCostValue, { color: "#0f172a" }]}>
                  {data.pitchDeck!.slides[4].subtitle.split("|")[0]?.replace("Monthly:", "").trim() || "$5,000"}
                </Text>
              </View>
              <View style={[styles.pitchCostCard, { backgroundColor: "#f0fdf4" }]}>
                <Text style={styles.pitchCostLabel}>Estimated Yearly</Text>
                <Text style={[styles.pitchCostValue, { color: "#16a34a" }]}>
                  {data.pitchDeck!.slides[4].subtitle.split("|")[1]?.replace("Yearly:", "").trim() || "$60,000"}
                </Text>
              </View>
            </View>
            <View style={styles.pitchRoiBox}>
              <Text style={styles.pitchRoiText}>{data.pitchDeck!.slides[4].content1}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 12, fontWeight: "bold", color: "#0f172a", marginBottom: 10 }}>Next Steps</Text>
              {["Schedule technical discovery call", "Finalize project scope", "Begin Phase 1 implementation"].map((step, i) => (
                <View key={i} style={styles.pitchNextStepRow}>
                  <View style={styles.pitchNextStepNum}>
                    <Text style={styles.pitchNextStepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.pitchNextStepText}>{step}</Text>
                </View>
              ))}
            </View>
            <View style={styles.pitchCtaBox}>
              <Text style={styles.pitchCtaText}>{data.pitchDeck!.slides[4].footer}</Text>
            </View>
            {/* Pricing Disclaimer */}
            <View style={{ marginTop: 8, paddingHorizontal: 20 }}>
              <Text style={{ fontSize: 7, color: "#94a3b8", fontStyle: "italic", textAlign: "center" }}>
                *Cost estimates based on typical usage patterns and current AWS pricing. Actual costs vary based on usage, configuration, region, and pricing changes.
              </Text>
            </View>
            <View style={styles.pitchFooter}>
              <Text style={styles.pitchFooterText}>{data.companyName} • Cloud Migration Proposal</Text>
              <Text style={styles.pitchFooterPage}>5 / {totalSlides}</Text>
            </View>
          </Page>
          )}
        </>
        );
      })()}
    </Document>
  );
}
