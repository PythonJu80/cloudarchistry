/**
 * Dynamic Diagram Layout Engine - AWS Conventions
 * 
 * AWS ARCHITECTURE DIAGRAM RULES:
 * ================================
 * HORIZONTAL (X-axis) = Availability Zones
 *   - AZ-1 on left, AZ-2 on right
 *   - Same-tier services side by side within a subnet
 * 
 * VERTICAL (Y-axis) = Tiers/Layers (top to bottom)
 *   1. Internet/Edge (Route 53, CloudFront, WAF)
 *   2. Load Balancers (ALB, NLB)
 *   3. Public Subnets (NAT GW, Bastion, IGW)
 *   4. Private Subnets - App Tier (ECS, EC2, Lambda)
 *   5. Private Subnets - Data Tier (RDS, ElastiCache)
 * 
 * EXTERNAL SERVICES = Right side of VPC
 *   - Security (KMS, Secrets Manager, IAM)
 *   - Monitoring (CloudWatch, X-Ray)
 * 
 * HIERARCHY-BASED SIZING:
 * 1. Each NODE has exclusive padding (bounding box) - no overlaps
 * 2. SUBNETS size to fit child node bounding boxes (horizontal + vertical)
 * 3. VPC sizes to fit all subnet bounding boxes
 */

export interface DiagramNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  parentId?: string;
  width?: number;
  height?: number;
}

export interface LayoutConfig {
  // === NODE LEVEL ===
  nodeWidth: number;
  nodeHeight: number;
  nodePadding: number;           // EXCLUSIVE padding around each node - nothing can enter this space
  
  // === SUBNET LEVEL ===
  subnetPadding: number;         // Padding inside subnet (from edge to first node bounding box)
  subnetHeaderHeight: number;    // Space for subnet label at top
  subnetMinWidth: number;        // Minimum subnet width even if empty
  subnetMinHeight: number;       // Minimum subnet height even if empty
  
  // === VPC LEVEL ===
  vpcPadding: number;            // Padding inside VPC (from edge to first subnet)
  vpcHeaderHeight: number;       // Space for VPC label
  subnetGapX: number;            // Horizontal gap between subnets (AZ-1 to AZ-2)
  subnetGapY: number;            // Vertical gap between subnet rows (public to private)
}

const DEFAULT_CONFIG: LayoutConfig = {
  // Node level
  nodeWidth: 100,
  nodeHeight: 80,
  nodePadding: 15,               // Exclusive space around each node
  
  // Subnet level  
  subnetPadding: 20,
  subnetHeaderHeight: 28,
  subnetMinWidth: 150,
  subnetMinHeight: 120,
  
  // VPC level
  vpcPadding: 20,
  vpcHeaderHeight: 20,
  subnetGapX: 25,                // Gap between AZ columns
  subnetGapY: 15,                // Gap between public/private rows
};

/**
 * AWS Service Tiers - determines vertical positioning within subnets
 * Services in the same tier are placed HORIZONTALLY (side by side)
 * Different tiers are stacked VERTICALLY
 */
const SERVICE_TIERS: Record<string, number> = {
  // Tier 1: Network/Gateway (top of subnet)
  "internet-gateway": 1,
  "nat-gateway": 1,
  "vpn-gateway": 1,
  "transit-gateway": 1,
  "bastion": 1,
  
  // Tier 2: Compute/App (middle)
  "ec2": 2,
  "ecs": 2,
  "fargate": 2,
  "eks": 2,
  "lambda": 2,
  "auto-scaling": 2,
  
  // Tier 3: Cache/Session (middle-lower)
  "elasticache": 3,
  "memcached": 3,
  "redis": 3,
  
  // Tier 4: Database (bottom)
  "rds": 4,
  "aurora": 4,
  "dynamodb": 4,
  "redshift": 4,
  "neptune": 4,
};

function getServiceTier(serviceId: string): number {
  return SERVICE_TIERS[serviceId] || 2; // Default to compute tier
}


/**
 * Get the BOUNDING BOX for a node (node dimensions + exclusive padding)
 * This is the space that belongs to this node - nothing else can enter it
 */
function getNodeBoundingBox(node: DiagramNode, cfg: LayoutConfig) {
  return {
    width: cfg.nodeWidth + (cfg.nodePadding * 2),
    height: cfg.nodeHeight + (cfg.nodePadding * 2),
  };
}

/**
 * STEP 1: Position nodes within a subnet using AWS conventions
 * - Group nodes by TIER (gateway, compute, cache, database)
 * - Same-tier nodes are placed HORIZONTALLY (side by side)
 * - Different tiers are stacked VERTICALLY (top to bottom)
 */
function layoutSubnet(
  subnet: DiagramNode,
  childNodes: DiagramNode[],
  cfg: LayoutConfig
): void {
  if (childNodes.length === 0) {
    subnet.width = cfg.subnetMinWidth;
    subnet.height = cfg.subnetMinHeight;
    return;
  }

  const nodeBB = getNodeBoundingBox(childNodes[0], cfg);
  
  // Group nodes by tier
  const tierGroups = new Map<number, DiagramNode[]>();
  childNodes.forEach(node => {
    const serviceId = node.data.serviceId as string || "";
    const tier = getServiceTier(serviceId);
    if (!tierGroups.has(tier)) {
      tierGroups.set(tier, []);
    }
    tierGroups.get(tier)!.push(node);
  });

  // Sort tiers (1, 2, 3, 4 = top to bottom)
  const sortedTiers = Array.from(tierGroups.keys()).sort((a, b) => a - b);

  // Calculate max nodes in any tier (determines subnet width)
  const maxNodesInTier = Math.max(...Array.from(tierGroups.values()).map(g => g.length));
  
  // Calculate required width: padding + (nodes * bounding box) + padding
  const requiredWidth = cfg.subnetPadding + (maxNodesInTier * nodeBB.width) + cfg.subnetPadding;
  subnet.width = Math.max(requiredWidth, cfg.subnetMinWidth);

  // Position nodes tier by tier
  let currentY = cfg.subnetHeaderHeight + cfg.subnetPadding;
  
  sortedTiers.forEach(tier => {
    const nodesInTier = tierGroups.get(tier)!;
    const tierWidth = nodesInTier.length * nodeBB.width;
    const startX = (subnet.width! - tierWidth) / 2; // Center the tier row
    
    // Position nodes horizontally within this tier
    nodesInTier.forEach((node, index) => {
      node.position.x = startX + (index * nodeBB.width) + cfg.nodePadding;
      node.position.y = currentY + cfg.nodePadding;
    });
    
    // Move Y down for next tier
    currentY += nodeBB.height;
  });

  // Calculate required height
  const requiredHeight = currentY + cfg.subnetPadding;
  subnet.height = Math.max(requiredHeight, cfg.subnetMinHeight);
}

/**
 * STEP 2: Position subnets within VPC and calculate VPC size
 * Subnets are arranged in rows (public row, private row) with gaps
 */
function layoutVPC(
  vpc: DiagramNode,
  publicSubnets: DiagramNode[],
  privateSubnets: DiagramNode[],
  cfg: LayoutConfig
): void {
  const albSpace = cfg.vpcHeaderHeight + 80; // Space for ALB at top

  // Position public subnets in a row
  let currentX = cfg.vpcPadding;
  let maxPublicHeight = 0;
  
  publicSubnets.forEach((subnet) => {
    subnet.position.x = currentX;
    subnet.position.y = albSpace;
    currentX += (subnet.width || cfg.subnetMinWidth) + cfg.subnetGapX;
    maxPublicHeight = Math.max(maxPublicHeight, subnet.height || cfg.subnetMinHeight);
  });

  // Position private subnets in a row below public
  currentX = cfg.vpcPadding;
  const privateRowY = albSpace + maxPublicHeight + cfg.subnetGapY;
  let maxPrivateHeight = 0;
  
  privateSubnets.forEach((subnet) => {
    subnet.position.x = currentX;
    subnet.position.y = privateRowY;
    currentX += (subnet.width || cfg.subnetMinWidth) + cfg.subnetGapX;
    maxPrivateHeight = Math.max(maxPrivateHeight, subnet.height || cfg.subnetMinHeight);
  });

  // Normalize heights within each row
  publicSubnets.forEach(s => s.height = maxPublicHeight);
  privateSubnets.forEach(s => s.height = maxPrivateHeight);

  // Calculate VPC size based on subnet bounding boxes
  const allSubnets = [...publicSubnets, ...privateSubnets];
  if (allSubnets.length > 0) {
    const maxRight = Math.max(...allSubnets.map(s => s.position.x + (s.width || cfg.subnetMinWidth)));
    const maxBottom = Math.max(...allSubnets.map(s => s.position.y + (s.height || cfg.subnetMinHeight)));
    
    vpc.width = maxRight + cfg.vpcPadding;
    vpc.height = maxBottom + cfg.vpcPadding;
  }
}

/**
 * Main layout function - BOTTOM-UP hierarchy
 * 1. Layout nodes within subnets (nodes determine subnet size)
 * 2. Layout subnets within VPC (subnets determine VPC size)
 */
export function applyDynamicLayout(
  nodes: DiagramNode[],
  config: Partial<LayoutConfig> = {}
): DiagramNode[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const result = JSON.parse(JSON.stringify(nodes)) as DiagramNode[];

  // Find VPC
  const vpc = result.find(n => n.type === "vpc");
  if (!vpc) return result;

  // Find and categorize subnets
  const subnets = result.filter(n => n.type === "subnet" && n.parentId === vpc.id);
  const publicSubnets = subnets.filter(s => s.data.subnetType === "public");
  const privateSubnets = subnets.filter(s => s.data.subnetType === "private");

  // STEP 1: Layout each subnet based on its children
  [...publicSubnets, ...privateSubnets].forEach(subnet => {
    const children = result.filter(n => n.parentId === subnet.id && n.type === "awsResource");
    layoutSubnet(subnet, children, cfg);
  });

  // STEP 2: Layout VPC based on subnets
  layoutVPC(vpc, publicSubnets, privateSubnets, cfg);

  // STEP 3: Position ALB centered at top of VPC
  const alb = result.find(n => n.parentId === vpc.id && n.data.serviceId === "alb");
  if (alb && vpc.width) {
    alb.position.x = (vpc.width - cfg.nodeWidth) / 2;
    alb.position.y = cfg.vpcHeaderHeight + 10;
  }

  // STEP 4: Position external services to the right of VPC
  const externalServices = result.filter(n => 
    !n.parentId && n.type === "awsResource" && n.position.x > 500
  );
  
  if (externalServices.length > 0 && vpc.width) {
    const externalX = vpc.position.x + vpc.width + 30;
    const startY = vpc.position.y + 50;
    
    externalServices.forEach((service, index) => {
      service.position.x = externalX;
      service.position.y = startY + (index * (cfg.nodeHeight + cfg.nodePadding * 2 + 20));
    });
  }

  return result;
}

/**
 * Convenience function to apply layout and return formatted diagram data
 */
export function layoutDiagram(
  diagram: { nodes: DiagramNode[]; edges: unknown[] },
  config?: Partial<LayoutConfig>
): { nodes: DiagramNode[]; edges: unknown[] } {
  return {
    nodes: applyDynamicLayout(diagram.nodes, config),
    edges: diagram.edges,
  };
}
