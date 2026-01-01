import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Rect,
  Line,
  G,
  Text as SvgText,
} from "@react-pdf/renderer";

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
});

interface DiagramNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    serviceId: string;
    label: string;
    sublabel?: string;
    color: string;
    subnetType?: "public" | "private";
  };
  parentId?: string;
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
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
  challengeScore: number;
  maxScore: number;
  completionTimeMinutes: number;
  createdAt: string;
  architectureDiagram?: { nodes: DiagramNode[]; edges: DiagramEdge[] } | null;
  // New fields for stage completion data
  auditScore?: number | null;
  auditPassed?: boolean;
  proficiencyTest?: {
    score: number;
    summary: string;
    strengths: string[];
    areasForImprovement: string[];
  } | null;
  cliObjectives?: {
    completedCount: number;
    totalCount: number;
    earnedPoints: number;
    totalPoints: number;
    objectives: Array<{ description: string; completed: boolean; service: string }>;
  } | null;
}

// AWS service name to acronym mapping - only abbreviate long names
const SERVICE_ACRONYMS: Record<string, string> = {
  // Load balancers - always abbreviate
  "Application Load Balancer": "ALB",
  "Network Load Balancer": "NLB",
  "Classic Load Balancer": "CLB",
  "Elastic Load Balancer": "ELB",
  // Gateways
  "NAT Gateway": "NAT GW",
  "Internet Gateway": "IGW",
  "API Gateway": "API GW",
  // Long service names
  "Virtual Private Cloud": "VPC",
  "Elastic Compute Cloud": "EC2",
  "Relational Database Service": "RDS",
  "Simple Storage Service": "S3",
  "Elastic Container Service": "ECS",
  "Elastic Kubernetes Service": "EKS",
  "Key Management Service": "KMS",
  "Identity and Access Management": "IAM",
  "Simple Queue Service": "SQS",
  "Simple Notification Service": "SNS",
  "Web Application Firewall": "WAF",
  "Auto Scaling Group": "ASG",
  "Systems Manager": "SSM",
  "Certificate Manager": "ACM",
  // Keep these readable
  "CloudFront Distribution": "CloudFront",
  "S3 Bucket": "S3",
  "ECS Fargate": "Fargate",
  "Lambda Function": "Lambda",
};

// Get abbreviated label for diagram display
function getAbbreviatedLabel(label: string): string {
  // Check exact match first
  if (SERVICE_ACRONYMS[label]) return SERVICE_ACRONYMS[label];
  
  // Check if label contains any key
  for (const [full, abbrev] of Object.entries(SERVICE_ACRONYMS)) {
    if (label.toLowerCase().includes(full.toLowerCase())) return abbrev;
  }
  
  // Truncate long labels
  if (label.length > 12) {
    return label.substring(0, 10) + "..";
  }
  return label;
}

// Render diagram using react-pdf SVG primitives - matching aws-nodes.tsx styles
function DiagramRenderer({ diagram }: { diagram: { nodes: DiagramNode[]; edges: DiagramEdge[] } }) {
  const { nodes, edges } = diagram;
  
  // Build a map of all nodes by ID
  const nodeMap = new Map<string, DiagramNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));
  
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
  
  // Separate node types
  const vpcNodes = nodes.filter(n => n.type === "vpc");
  const subnetNodes = nodes.filter(n => n.type === "subnet");
  const resourceNodes = nodes.filter(n => n.type === "awsResource");
  
  // Calculate bounds from ALL nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const absolutePositions = new Map<string, { x: number; y: number }>();
  
  nodes.forEach(node => {
    const pos = getAbsolutePosition(node);
    absolutePositions.set(node.id, pos);
    const w = node.type === "vpc" ? 600 : node.type === "subnet" ? 250 : 70;
    const h = node.type === "vpc" ? 400 : node.type === "subnet" ? 180 : 40;
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + w);
    maxY = Math.max(maxY, pos.y + h);
  });
  
  if (nodes.length === 0) {
    return <View style={styles.diagramContainer}><Text>No diagram data</Text></View>;
  }
  
  const padding = 20;
  const contentWidth = maxX - minX + padding * 2;
  const contentHeight = maxY - minY + padding * 2;
  
  // Scale to fit landscape A4
  const availableWidth = 700;
  const availableHeight = 400;
  const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 0.9);
  
  const transform = (pos: { x: number; y: number }) => ({
    x: (pos.x - minX + padding) * scale,
    y: (pos.y - minY + padding) * scale,
  });

  return (
    <View style={styles.diagramContainer}>
      <Svg width={availableWidth} height={availableHeight}>
        {/* Background */}
        <Rect x={0} y={0} width={availableWidth} height={availableHeight} fill="#f1f5f9" rx={4} />
        
        {/* 1. Draw VPC container - subtle light purple, dashed border */}
        {vpcNodes.map(node => {
          const pos = absolutePositions.get(node.id);
          if (!pos) return null;
          const { x, y } = transform(pos);
          const w = 600 * scale;
          const h = 400 * scale;
          return (
            <G key={node.id}>
              <Rect x={x} y={y} width={w} height={h} rx={4} fill="#faf8ff" stroke="#c4b5fd" strokeWidth={1} strokeDasharray="6,3" />
              <Rect x={x + 8} y={y + 4} width={80} height={14} rx={2} fill="white" stroke="#a78bfa" strokeWidth={0.5} />
              <SvgText x={x + 48} y={y + 13} fontSize={7} fill="#7c3aed" textAnchor="middle">{node.data.label}</SvgText>
            </G>
          );
        })}
        
        {/* 2. Draw Subnet containers - very subtle backgrounds */}
        {subnetNodes.map(node => {
          const pos = absolutePositions.get(node.id);
          if (!pos) return null;
          const { x, y } = transform(pos);
          const w = 250 * scale;
          const h = 180 * scale;
          const isPublic = node.data.subnetType === "public";
          const borderColor = isPublic ? "#86efac" : "#93c5fd";
          const bgColor = isPublic ? "#f0fdf4" : "#eff6ff";
          const textColor = isPublic ? "#166534" : "#1e40af";
          return (
            <G key={node.id}>
              <Rect x={x} y={y} width={w} height={h} rx={3} fill={bgColor} stroke={borderColor} strokeWidth={1} />
              <Rect x={x + 4} y={y + 4} width={w - 8} height={12} rx={2} fill={isPublic ? "#dcfce7" : "#dbeafe"} />
              <SvgText x={x + 8} y={y + 12} fontSize={6} fill={textColor}>{node.data.label}</SvgText>
            </G>
          );
        })}
        
        {/* 3. Draw edges - orthogonal paths */}
        {edges.map(edge => {
          const sourcePos = absolutePositions.get(edge.source);
          const targetPos = absolutePositions.get(edge.target);
          if (!sourcePos || !targetPos) return null;
          const src = transform(sourcePos);
          const tgt = transform(targetPos);
          // Center of nodes (70x40)
          const x1 = src.x + 35;
          const y1 = src.y + 20;
          const x2 = tgt.x + 35;
          const y2 = tgt.y + 20;
          const midY = (y1 + y2) / 2;
          return (
            <G key={edge.id}>
              <Line x1={x1} y1={y1} x2={x1} y2={midY} stroke="#94a3b8" strokeWidth={1} />
              <Line x1={x1} y1={midY} x2={x2} y2={midY} stroke="#94a3b8" strokeWidth={1} />
              <Line x1={x2} y1={midY} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={1} />
            </G>
          );
        })}
        
        {/* 4. Draw resource nodes - white cards with abbreviated service name */}
        {resourceNodes.map(node => {
          const pos = absolutePositions.get(node.id);
          if (!pos) return null;
          const { x, y } = transform(pos);
          const w = 70;
          const h = 40;
          const color = node.data.color || "#6b7280";
          const displayLabel = getAbbreviatedLabel(node.data.label);
          const displaySublabel = node.data.sublabel ? getAbbreviatedLabel(node.data.sublabel) : null;
          return (
            <G key={node.id}>
              {/* Card background */}
              <Rect x={x} y={y} width={w} height={h} rx={3} fill="white" stroke="#e5e7eb" strokeWidth={0.75} />
              {/* Left color accent */}
              <Rect x={x} y={y} width={3} height={h} rx={1.5} fill={color} />
              {/* Label */}
              <SvgText x={x + w/2 + 1} y={y + (displaySublabel ? 15 : 22)} fontSize={7} fill="#1f2937" textAnchor="middle" fontWeight="bold">{displayLabel}</SvgText>
              {displaySublabel && (
                <SvgText x={x + w/2 + 1} y={y + 28} fontSize={5} fill="#6b7280" textAnchor="middle">{displaySublabel}</SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

export function PortfolioPDF({ data }: { data: PortfolioPDFData }) {
  const scorePercentage = Math.round((data.challengeScore / data.maxScore) * 100);
  
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

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{scorePercentage}%</Text>
            <Text style={styles.statLabel}>Score</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{data.challengeScore}</Text>
            <Text style={styles.statLabel}>Points Earned</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{data.completionTimeMinutes}</Text>
            <Text style={styles.statLabel}>Minutes</Text>
          </View>
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

      {/* Page 2: Skills Assessment */}
      {(data.auditScore !== undefined || data.proficiencyTest || data.cliObjectives) && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.badge}>SKILLS ASSESSMENT</Text>
            <Text style={styles.title}>Challenge Performance</Text>
            <Text style={styles.subtitle}>{data.companyName} • {data.industry}</Text>
          </View>

          {/* Stage Completion Stats */}
          <View style={styles.statsRow}>
            {data.auditScore !== undefined && data.auditScore !== null && (
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: data.auditPassed ? "#16a34a" : "#dc2626" }]}>
                  {data.auditScore}%
                </Text>
                <Text style={styles.statLabel}>Drawing Audit</Text>
              </View>
            )}
            {data.proficiencyTest && (
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: data.proficiencyTest.score >= 70 ? "#16a34a" : "#dc2626" }]}>
                  {data.proficiencyTest.score}%
                </Text>
                <Text style={styles.statLabel}>Proficiency Test</Text>
              </View>
            )}
            {data.cliObjectives && (
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  {data.cliObjectives.completedCount}/{data.cliObjectives.totalCount}
                </Text>
                <Text style={styles.statLabel}>CLI Objectives</Text>
              </View>
            )}
          </View>

          {/* Drawing Audit Results */}
          {data.auditScore !== undefined && data.auditScore !== null && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Architecture Drawing Audit</Text>
              <Text style={styles.paragraph}>
                The architecture diagram was evaluated against best practices and scenario requirements.
                {data.auditPassed 
                  ? " The diagram successfully passed the automated audit, demonstrating solid understanding of AWS architecture patterns."
                  : " The diagram shows room for improvement in meeting all architectural requirements."}
              </Text>
              <View style={[styles.tagContainer, { marginTop: 8 }]}>
                <Text style={data.auditPassed ? styles.complianceTag : styles.tag}>
                  {data.auditPassed ? "✓ Audit Passed" : "Needs Improvement"}
                </Text>
              </View>
            </View>
          )}

          {/* Proficiency Test Results */}
          {data.proficiencyTest && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Proficiency Assessment</Text>
              <Text style={styles.paragraph}>{data.proficiencyTest.summary}</Text>
              
              {data.proficiencyTest.strengths && data.proficiencyTest.strengths.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: "bold", marginBottom: 6, color: "#166534" }}>Strengths</Text>
                  {data.proficiencyTest.strengths.map((strength, i) => (
                    <View key={i} style={styles.listItem}>
                      <Text style={[styles.bullet, { color: "#16a34a" }]}>✓</Text>
                      <Text style={styles.listText}>{strength}</Text>
                    </View>
                  ))}
                </View>
              )}
              
              {data.proficiencyTest.areasForImprovement && data.proficiencyTest.areasForImprovement.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: "bold", marginBottom: 6, color: "#b45309" }}>Areas for Growth</Text>
                  {data.proficiencyTest.areasForImprovement.map((area, i) => (
                    <View key={i} style={styles.listItem}>
                      <Text style={[styles.bullet, { color: "#f59e0b" }]}>→</Text>
                      <Text style={styles.listText}>{area}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* CLI Objectives */}
          {data.cliObjectives && data.cliObjectives.objectives && data.cliObjectives.objectives.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CLI Training Objectives</Text>
              <Text style={styles.paragraph}>
                Completed {data.cliObjectives.completedCount} of {data.cliObjectives.totalCount} CLI objectives, 
                earning {data.cliObjectives.earnedPoints} of {data.cliObjectives.totalPoints} possible points.
              </Text>
              <View style={{ marginTop: 8 }}>
                {data.cliObjectives.objectives.map((obj, i) => (
                  <View key={i} style={styles.listItem}>
                    <Text style={[styles.bullet, { color: obj.completed ? "#16a34a" : "#94a3b8" }]}>
                      {obj.completed ? "✓" : "○"}
                    </Text>
                    <Text style={styles.listText}>
                      {obj.description} ({obj.service})
                    </Text>
                  </View>
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
      )}

      {/* Page 2: Architecture Diagram */}
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
    </Document>
  );
}
