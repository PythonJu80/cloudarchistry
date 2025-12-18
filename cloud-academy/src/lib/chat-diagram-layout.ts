/**
 * AWS-Style Diagram Layout Engine for Chat Messages
 * ==================================================
 * 
 * Transforms raw diagram schema from the agent into a professionally
 * laid out AWS architecture diagram matching PowerPoint reference style.
 * 
 * Key features:
 * - Column-based layout (left-to-right data flow)
 * - Proper spacing to prevent label overlaps
 * - AWS Cloud container properly sized
 * - Numbered step indicators positioned correctly
 * - Consistent grid alignment
 */

interface RawNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };  // Optional - layout engine assigns positions
  data: Record<string, unknown>;
}

interface RawEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
}

interface LayoutConfig {
  // Canvas dimensions
  canvasWidth: number;
  canvasHeight: number;
  
  // Spacing
  columnWidth: number;
  rowHeight: number;
  nodeWidth: number;
  nodeHeight: number;
  
  // Margins
  marginTop: number;
  marginLeft: number;
  marginRight: number;
  marginBottom: number;
  
  // Header row height
  headerHeight: number;
  
  // Step indicator offset from node
  stepIndicatorOffset: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  canvasWidth: 1400,
  canvasHeight: 800,
  columnWidth: 280,
  rowHeight: 220,
  nodeWidth: 180,
  nodeHeight: 160,
  marginTop: 80,
  marginLeft: 140,
  marginRight: 140,
  marginBottom: 80,
  headerHeight: 50,
  stepIndicatorOffset: -20,
};

/**
 * Analyze the diagram structure to understand columns and rows
 */
function analyzeDiagramStructure(nodes: RawNode[], edges: RawEdge[]) {
  // Separate node types
  const services = nodes.filter(n => n.type === "awsService" || !n.type || n.type === "default");
  const groups = nodes.filter(n => n.type === "group");
  const labels = nodes.filter(n => n.type === "label");
  
  // Separate headers (text labels) from step numbers
  const headers = labels.filter(n => {
    const label = String(n.data?.label || "");
    return !/^\d+$/.test(label.trim());
  });
  
  const stepNumbers = labels.filter(n => {
    const label = String(n.data?.label || "");
    return /^\d+$/.test(label.trim());
  });
  
  // Build adjacency list from edges to determine flow order
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  
  services.forEach(s => {
    adjacency.set(s.id, []);
    inDegree.set(s.id, 0);
  });
  
  edges.forEach(e => {
    const sourceIsService = services.some(s => s.id === e.source);
    const targetIsService = services.some(s => s.id === e.target);
    
    if (sourceIsService && targetIsService) {
      adjacency.get(e.source)?.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
  });
  
  // Topological sort to determine column order
  const columns: RawNode[][] = [];
  const visited = new Set<string>();
  const nodeToColumn = new Map<string, number>();
  
  // Find starting nodes (in-degree 0)
  let currentColumn: RawNode[] = [];
  services.forEach(s => {
    if ((inDegree.get(s.id) || 0) === 0) {
      currentColumn.push(s);
      visited.add(s.id);
      nodeToColumn.set(s.id, 0);
    }
  });
  
  if (currentColumn.length > 0) {
    columns.push(currentColumn);
  }
  
  // BFS to assign columns
  while (visited.size < services.length) {
    const nextColumn: RawNode[] = [];
    const colIndex = columns.length;
    
    currentColumn.forEach(node => {
      const targets = adjacency.get(node.id) || [];
      targets.forEach(targetId => {
        if (!visited.has(targetId)) {
          const targetNode = services.find(s => s.id === targetId);
          if (targetNode) {
            nextColumn.push(targetNode);
            visited.add(targetId);
            nodeToColumn.set(targetId, colIndex);
          }
        }
      });
    });
    
    // If no new nodes found via edges, add remaining unvisited nodes
    if (nextColumn.length === 0) {
      services.forEach(s => {
        if (!visited.has(s.id)) {
          nextColumn.push(s);
          visited.add(s.id);
          nodeToColumn.set(s.id, colIndex);
        }
      });
    }
    
    if (nextColumn.length > 0) {
      columns.push(nextColumn);
      currentColumn = nextColumn;
    } else {
      break;
    }
  }
  
  return {
    services,
    groups,
    headers,
    stepNumbers,
    columns,
    nodeToColumn,
  };
}

/**
 * Apply professional AWS-style layout to diagram nodes
 * Based on analysis of 70+ AWS reference architecture PowerPoint diagrams
 */
export function applyAWSLayout(
  nodes: RawNode[],
  edges: RawEdge[],
  config: Partial<LayoutConfig> = {}
): { nodes: RawNode[]; cloudBounds: { x: number; y: number; width: number; height: number } } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const result: RawNode[] = [];
  
  const { groups, headers, columns } = 
    analyzeDiagramStructure(nodes, edges);
  
  // Calculate layout dimensions based on content
  const numColumns = Math.max(columns.length, 1);
  const maxNodesInColumn = Math.max(...columns.map(c => c.length), 1);
  
  // AWS diagrams use generous spacing - calculate based on content
  const contentWidth = Math.max(numColumns * cfg.columnWidth, 400);
  const contentHeight = Math.max(cfg.headerHeight + (maxNodesInColumn * cfg.rowHeight), 300);
  
  // Track step number assignments
  let stepCounter = 1;
  const nodeStepMap = new Map<string, number>();
  
  // Cloud container starts below headers
  const cloudStartY = cfg.marginTop + cfg.headerHeight + 30;
  
  // Position services in columns with proper AWS-style spacing
  columns.forEach((column, colIndex) => {
    // Center nodes within their column
    const columnCenterX = cfg.marginLeft + (colIndex * cfg.columnWidth) + (cfg.columnWidth / 2);
    const nodeX = columnCenterX - (cfg.nodeWidth / 2);
    
    column.forEach((node, rowIndex) => {
      // Vertical positioning - inside the cloud container with padding
      const nodeY = cloudStartY + 50 + (rowIndex * cfg.rowHeight);
      
      // Assign step number based on flow order
      nodeStepMap.set(node.id, stepCounter++);
      
      result.push({
        ...node,
        type: "awsService",
        position: { x: nodeX, y: nodeY },
        data: {
          ...node.data,
          label: node.data?.label || "Service",
        },
      });
    });
  });
  
  // Position headers above each column - OUTSIDE the AWS Cloud container
  const headerY = cfg.marginTop; // Headers at top margin
  
  if (headers.length > 0) {
    const sortedHeaders = [...headers].sort((a, b) => (a.position?.x || 0) - (b.position?.x || 0));
    
    sortedHeaders.forEach((header, index) => {
      if (index < numColumns) {
        const columnCenterX = cfg.marginLeft + (index * cfg.columnWidth) + (cfg.columnWidth / 2);
        result.push({
          ...header,
          type: "label",
          position: { x: columnCenterX - 40, y: headerY },
        });
      }
    });
  } else if (numColumns > 1) {
    // Generate default column headers if none provided
    const defaultHeaders = generateColumnHeaders(columns);
    defaultHeaders.forEach((headerLabel, index) => {
      const columnCenterX = cfg.marginLeft + (index * cfg.columnWidth) + (cfg.columnWidth / 2);
      result.push({
        id: `header-${index}`,
        type: "label",
        position: { x: columnCenterX - 40, y: headerY },
        data: { label: headerLabel },
      });
    });
  }
  
  // Position step numbers next to their corresponding services (top-left corner)
  const serviceNodes = result.filter(n => n.type === "awsService" && n.position);
  serviceNodes.forEach(node => {
    const stepNum = nodeStepMap.get(node.id);
    if (stepNum && node.position) {
      result.push({
        id: `step-${node.id}`,
        type: "label",
        position: {
          x: node.position.x + cfg.stepIndicatorOffset,
          y: node.position.y + cfg.stepIndicatorOffset,
        },
        data: { label: String(stepNum) },
      });
    }
  });
  
  // Calculate cloud container bounds based on actual content
  const allServiceNodes = result.filter(n => n.type === "awsService");
  
  // Cloud container should be BELOW headers
  const cloudTop = cfg.marginTop + cfg.headerHeight + 20;
  let minX = cfg.marginLeft - 20;
  let minY = cloudTop;
  let maxX = cfg.marginLeft + contentWidth + 20;
  let maxY = cloudTop + contentHeight + 40;
  
  const nodesWithPositions = allServiceNodes.filter(n => n.position);
  if (nodesWithPositions.length > 0) {
    minX = Math.min(...nodesWithPositions.map(n => n.position!.x)) - 40;
    minY = Math.min(...nodesWithPositions.map(n => n.position!.y)) - 50;
    maxX = Math.max(...nodesWithPositions.map(n => n.position!.x + cfg.nodeWidth)) + 40;
    maxY = Math.max(...nodesWithPositions.map(n => n.position!.y + cfg.nodeHeight)) + 40;
  }
  
  const cloudBounds = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
  
  // Handle AWS Cloud container - always add one if there are services
  const awsCloudGroup = groups.find(g => 
    String(g.data?.label || "").toLowerCase().includes("aws") ||
    String(g.data?.label || "").toLowerCase().includes("cloud")
  );
  
  if (awsCloudGroup || allServiceNodes.length > 0) {
    result.unshift({
      id: awsCloudGroup?.id || "aws-cloud",
      type: "group",
      position: { x: cloudBounds.x, y: cloudBounds.y },
      data: {
        label: awsCloudGroup?.data?.label || "AWS Cloud",
        width: cloudBounds.width,
        height: cloudBounds.height,
      },
    });
  }
  
  // Add any other groups (VPC, subnets, etc.)
  groups.filter(g => g !== awsCloudGroup).forEach(group => {
    result.push({
      ...group,
      type: "group",
      position: group.position,
    });
  });
  
  return { nodes: result, cloudBounds };
}

/**
 * Generate column headers based on service types
 */
export function generateColumnHeaders(columns: RawNode[][]): string[] {
  const categoryMap: Record<string, string> = {
    // Ingestion/Sources
    "s3": "Data Sources",
    "kinesis": "Data Sources",
    "msk": "Data Sources",
    "sqs": "Data Sources",
    
    // API/Edge
    "api-gateway": "API",
    "apigateway": "API",
    "cloudfront": "Edge",
    "route53": "Edge",
    "alb": "Load Balancing",
    "nlb": "Load Balancing",
    
    // Compute/Processing
    "lambda": "Processing",
    "ec2": "Compute",
    "ecs": "Compute",
    "eks": "Compute",
    "fargate": "Compute",
    "sagemaker": "ML/AI",
    "bedrock": "ML/AI",
    
    // Data/Storage
    "rds": "Data",
    "aurora": "Data",
    "dynamodb": "Data",
    "elasticache": "Cache",
    "redshift": "Analytics",
    "neptune": "Graph",
    
    // Integration
    "sns": "Messaging",
    "eventbridge": "Events",
    "step-functions": "Orchestration",
  };
  
  return columns.map(column => {
    // Find the most common category in this column
    const categories = column.map(node => {
      const serviceId = String(node.data?.service_id || "").toLowerCase();
      return categoryMap[serviceId] || "Services";
    });
    
    // Return most common or first
    const categoryCount = new Map<string, number>();
    categories.forEach(c => categoryCount.set(c, (categoryCount.get(c) || 0) + 1));
    
    let maxCategory = "Services";
    let maxCount = 0;
    categoryCount.forEach((count, category) => {
      if (count > maxCount) {
        maxCount = count;
        maxCategory = category;
      }
    });
    
    return maxCategory;
  });
}

/**
 * Calculate optimal canvas size based on diagram content
 * Matches AWS reference architecture proportions (1200x800 base)
 */
export function calculateCanvasSize(
  nodes: RawNode[],
  edges: RawEdge[]
): { width: number; height: number } {
  const { columns } = analyzeDiagramStructure(nodes, edges);
  
  const numColumns = Math.max(columns.length, 1);
  const maxNodesInColumn = Math.max(...columns.map(c => c.length), 1);
  
  // Base dimensions with generous padding for professional look
  const width = Math.max(900, 280 + numColumns * 280);
  const height = Math.max(550, 240 + maxNodesInColumn * 220);
  
  return { width, height };
}
