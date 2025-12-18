/**
 * AWS Diagram Template Engine
 * ============================
 * 
 * Dynamically calculates positions based on actual services.
 * Layout is built from the inside out:
 * 1. Place services in columns by tier
 * 2. Calculate container sizes to fit their children
 * 3. No hardcoded positions - everything is relative
 */

interface ServiceInput {
  id: string;
  service_id: string;
  label: string;
  tier: "edge" | "public" | "compute" | "data" | "security" | "integration";
}

interface ConnectionInput {
  from: string;
  to: string;
}

interface AgentPayload {
  services: ServiceInput[];
  connections: ConnectionInput[];
}

interface DiagramNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
}

// Base units - everything scales from these
const U = {
  nodeW: 100,      // Node width
  nodeH: 80,       // Node height  
  gapX: 40,        // Horizontal gap between nodes
  gapY: 20,        // Vertical gap between nodes
  pad: 30,         // Container padding
  header: 35,      // Container header height
};

/**
 * Transform agent payload into React Flow diagram with proper AWS layout
 */
export function buildAWSDiagram(payload: AgentPayload): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  
  // Group services by tier
  const tiers: Record<string, ServiceInput[]> = {
    edge: [],
    public: [],
    compute: [],
    data: [],
    security: [],
    integration: [],
  };
  
  payload.services.forEach(svc => {
    const tier = svc.tier || "compute";
    if (tiers[tier]) {
      tiers[tier].push(svc);
    } else {
      tiers.compute.push(svc);
    }
  });
  
  // Count services in each zone
  const edgeCount = tiers.edge.length;
  const publicCount = tiers.public.length;
  const computeCount = tiers.compute.length;
  const dataCount = tiers.data.length;
  
  // Calculate how many columns we need inside private subnet
  const privateColumns = (computeCount > 0 ? 1 : 0) + (dataCount > 0 ? 1 : 0);
  const maxPrivateRows = Math.max(computeCount, dataCount, 1);
  const maxPublicRows = Math.max(publicCount, 1);
  const maxVpcRows = Math.max(maxPrivateRows, maxPublicRows);
  
  // Calculate dimensions dynamically
  const colWidth = U.nodeW + U.gapX;
  
  // Private subnet width: fits compute + data columns
  const privateSubnetW = privateColumns * colWidth + U.pad * 2;
  const privateSubnetH = maxPrivateRows * (U.nodeH + U.gapY) + U.header + U.pad;
  
  // Public subnet width: fits public column
  const publicSubnetW = publicCount > 0 ? colWidth + U.pad * 2 : 0;
  const publicSubnetH = maxPublicRows * (U.nodeH + U.gapY) + U.header + U.pad;
  
  // VPC width: fits all subnets
  const hasPublic = publicCount > 0;
  const hasPrivate = computeCount > 0 || dataCount > 0;
  const vpcW = (hasPublic ? publicSubnetW + U.gapX : 0) + (hasPrivate ? privateSubnetW : 0) + U.pad * 2;
  const vpcH = Math.max(publicSubnetH, privateSubnetH) + U.header + U.pad;
  
  // Edge column position (outside VPC, to the left)
  const edgeX = U.pad;
  
  // VPC position (after edge column)
  const vpcX = edgeCount > 0 ? edgeX + colWidth + U.gapX : U.pad;
  const vpcY = U.pad + U.header;
  
  // Cloud dimensions (wraps everything)
  const cloudW = vpcX + vpcW + U.pad;
  const cloudH = vpcY + vpcH + U.pad;
  
  // Starting Y for services (inside containers)
  const serviceStartY = vpcY + U.header + U.pad + U.header;
  
  // === ADD CONTAINERS ===
  
  // AWS Cloud
  nodes.push({
    id: "aws-cloud",
    type: "group",
    position: { x: 20, y: 20 },
    data: { label: "AWS Cloud", width: cloudW, height: cloudH },
  });
  
  // VPC (if we have any VPC services)
  if (hasPublic || hasPrivate) {
    nodes.push({
      id: "vpc",
      type: "group",
      position: { x: vpcX, y: vpcY },
      data: { label: "VPC", width: vpcW, height: vpcH, isVPC: true },
    });
    
    // Public Subnet
    if (hasPublic) {
      nodes.push({
        id: "public-subnet",
        type: "group",
        position: { x: vpcX + U.pad, y: vpcY + U.header },
        data: { label: "Public Subnet", width: publicSubnetW, height: publicSubnetH - U.header, isPublic: true },
      });
    }
    
    // Private Subnet
    if (hasPrivate) {
      const privateX = hasPublic ? vpcX + U.pad + publicSubnetW + U.gapX : vpcX + U.pad;
      nodes.push({
        id: "private-subnet",
        type: "group",
        position: { x: privateX, y: vpcY + U.header },
        data: { label: "Private Subnet", width: privateSubnetW, height: privateSubnetH - U.header, isPrivate: true },
      });
    }
  }
  
  // === ADD SERVICES ===
  
  // Edge tier (outside VPC)
  tiers.edge.forEach((svc, i) => {
    nodes.push({
      id: svc.id,
      type: "awsService",
      position: { x: edgeX, y: serviceStartY + i * (U.nodeH + U.gapY) },
      data: { label: svc.label, service_id: svc.service_id },
    });
  });
  
  // Public tier (inside public subnet)
  const publicX = vpcX + U.pad + U.pad;
  tiers.public.forEach((svc, i) => {
    nodes.push({
      id: svc.id,
      type: "awsService",
      position: { x: publicX, y: serviceStartY + i * (U.nodeH + U.gapY) },
      data: { label: svc.label, service_id: svc.service_id },
    });
  });
  
  // Compute tier (inside private subnet, first column)
  const privateStartX = hasPublic ? vpcX + U.pad + publicSubnetW + U.gapX : vpcX + U.pad;
  const computeX = privateStartX + U.pad;
  tiers.compute.forEach((svc, i) => {
    nodes.push({
      id: svc.id,
      type: "awsService",
      position: { x: computeX, y: serviceStartY + i * (U.nodeH + U.gapY) },
      data: { label: svc.label, service_id: svc.service_id },
    });
  });
  
  // Data tier (inside private subnet, second column)
  const dataX = computeCount > 0 ? computeX + colWidth : computeX;
  tiers.data.forEach((svc, i) => {
    nodes.push({
      id: svc.id,
      type: "awsService",
      position: { x: dataX, y: serviceStartY + i * (U.nodeH + U.gapY) },
      data: { label: svc.label, service_id: svc.service_id },
    });
  });
  
  // Security tier (above everything)
  tiers.security.forEach((svc, i) => {
    nodes.push({
      id: svc.id,
      type: "awsService",
      position: { x: U.pad + i * colWidth, y: U.pad },
      data: { label: svc.label, service_id: svc.service_id },
    });
  });
  
  // Integration tier (below VPC)
  tiers.integration.forEach((svc, i) => {
    nodes.push({
      id: svc.id,
      type: "awsService",
      position: { x: vpcX + U.pad + i * colWidth, y: vpcY + vpcH + U.gapY },
      data: { label: svc.label, service_id: svc.service_id },
    });
  });
  
  // === ADD EDGES ===
  payload.connections.forEach((conn, i) => {
    edges.push({
      id: `edge-${i}`,
      source: conn.from,
      target: conn.to,
      type: "smoothstep",
    });
  });
  
  return { nodes, edges };
}

/**
 * Check if payload is in new format (services/connections) vs old format (nodes/edges)
 */
export function isNewPayloadFormat(data: unknown): data is AgentPayload {
  return (
    typeof data === "object" &&
    data !== null &&
    "services" in data &&
    Array.isArray((data as AgentPayload).services)
  );
}
