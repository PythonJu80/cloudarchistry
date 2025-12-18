/**
 * Draw.io XML Parser for ArcHub
 * 
 * Parses Draw.io XML files and extracts AWS services, converting them
 * to React Flow nodes that can be rendered with the existing diagram components.
 */

import { DiagramNode, DiagramEdge } from "@/components/diagram";
import { AWS_SERVICES, getServiceById } from "@/lib/aws-services";

// Draw.io AWS shape patterns to service ID mapping
const DRAWIO_AWS_PATTERNS: Record<string, string> = {
  // Compute
  "mxgraph.aws4.ec2": "ec2",
  "mxgraph.aws4.instance": "ec2",
  "mxgraph.aws4.instances": "ec2",
  "mxgraph.aws4.lambda": "lambda",
  "mxgraph.aws4.lambda_function": "lambda",
  "mxgraph.aws4.auto_scaling": "auto-scaling",
  "mxgraph.aws4.auto_scaling2": "auto-scaling",
  "mxgraph.aws4.elastic_beanstalk": "ec2",
  "mxgraph.aws4.batch": "batch",
  "mxgraph.aws4.lightsail": "lightsail",
  
  // Storage
  "mxgraph.aws4.s3": "s3",
  "mxgraph.aws4.bucket": "s3",
  "mxgraph.aws4.simple_storage_service": "s3",
  "mxgraph.aws4.glacier": "glacier",
  "mxgraph.aws4.efs": "efs",
  "mxgraph.aws4.elastic_file_system": "efs",
  "mxgraph.aws4.ebs": "ebs",
  "mxgraph.aws4.elastic_block_store": "ebs",
  "mxgraph.aws4.fsx": "fsx",
  "mxgraph.aws4.backup": "backup",
  "mxgraph.aws4.storage_gateway": "storage-gateway",
  
  // Database
  "mxgraph.aws4.rds": "rds",
  "mxgraph.aws4.database": "rds",
  "mxgraph.aws4.aurora": "aurora",
  "mxgraph.aws4.dynamodb": "dynamodb",
  "mxgraph.aws4.elasticache": "elasticache",
  "mxgraph.aws4.redshift": "redshift",
  "mxgraph.aws4.neptune": "neptune",
  "mxgraph.aws4.documentdb": "documentdb",
  "mxgraph.aws4.memorydb": "memorydb",
  "mxgraph.aws4.rds_db_instance": "rds",
  
  // Networking
  "mxgraph.aws4.vpc": "vpc",
  "mxgraph.aws4.virtual_private_cloud": "vpc",
  "mxgraph.aws4.route_53": "route53",
  "mxgraph.aws4.cloudfront": "cloudfront",
  "mxgraph.aws4.api_gateway": "api-gateway",
  "mxgraph.aws4.application_load_balancer": "alb",
  "mxgraph.aws4.network_load_balancer": "nlb",
  "mxgraph.aws4.elastic_load_balancing": "alb",
  "mxgraph.aws4.internet_gateway": "internet-gateway",
  "mxgraph.aws4.nat_gateway": "nat-gateway",
  "mxgraph.aws4.transit_gateway": "transit-gateway",
  "mxgraph.aws4.direct_connect": "direct-connect",
  "mxgraph.aws4.global_accelerator": "global-accelerator",
  "mxgraph.aws4.privatelink": "privatelink",
  "mxgraph.aws4.vpn_gateway": "vpn-gateway",
  
  // Containers
  "mxgraph.aws4.ecs": "ecs",
  "mxgraph.aws4.elastic_container_service": "ecs",
  "mxgraph.aws4.eks": "eks",
  "mxgraph.aws4.elastic_kubernetes_service": "eks",
  "mxgraph.aws4.fargate": "fargate",
  "mxgraph.aws4.ecr": "ecr",
  "mxgraph.aws4.elastic_container_registry": "ecr",
  
  // Security
  "mxgraph.aws4.iam": "iam",
  "mxgraph.aws4.identity_and_access_management": "iam",
  "mxgraph.aws4.cognito": "cognito",
  "mxgraph.aws4.waf": "waf",
  "mxgraph.aws4.shield": "shield",
  "mxgraph.aws4.guardduty": "guardduty",
  "mxgraph.aws4.kms": "kms",
  "mxgraph.aws4.key_management_service": "kms",
  "mxgraph.aws4.secrets_manager": "secrets-manager",
  "mxgraph.aws4.acm": "acm",
  "mxgraph.aws4.certificate_manager": "acm",
  "mxgraph.aws4.inspector": "inspector",
  "mxgraph.aws4.macie": "macie",
  "mxgraph.aws4.security_hub": "security-hub",
  "mxgraph.aws4.detective": "detective",
  
  // Integration
  "mxgraph.aws4.sqs": "sqs",
  "mxgraph.aws4.simple_queue_service": "sqs",
  "mxgraph.aws4.sns": "sns",
  "mxgraph.aws4.simple_notification_service": "sns",
  "mxgraph.aws4.eventbridge": "eventbridge",
  "mxgraph.aws4.step_functions": "step-functions",
  "mxgraph.aws4.appsync": "appsync",
  "mxgraph.aws4.mq": "mq",
  "mxgraph.aws4.ses": "ses",
  
  // Management
  "mxgraph.aws4.cloudwatch": "cloudwatch",
  "mxgraph.aws4.cloudtrail": "cloudtrail",
  "mxgraph.aws4.systems_manager": "systems-manager",
  "mxgraph.aws4.config": "config",
  "mxgraph.aws4.xray": "xray",
  "mxgraph.aws4.cloudformation": "cloudformation",
  "mxgraph.aws4.trusted_advisor": "trusted-advisor",
  
  // Analytics
  "mxgraph.aws4.kinesis": "kinesis-streams",
  "mxgraph.aws4.kinesis_data_streams": "kinesis-streams",
  "mxgraph.aws4.kinesis_data_firehose": "kinesis-firehose",
  "mxgraph.aws4.kinesis_data_analytics": "kinesis-analytics",
  "mxgraph.aws4.athena": "athena",
  "mxgraph.aws4.glue": "glue",
  "mxgraph.aws4.quicksight": "quicksight",
  "mxgraph.aws4.opensearch": "opensearch",
  "mxgraph.aws4.elasticsearch": "opensearch",
  "mxgraph.aws4.msk": "msk",
  
  // DevOps
  "mxgraph.aws4.codecommit": "codecommit",
  "mxgraph.aws4.codepipeline": "codepipeline",
  "mxgraph.aws4.codebuild": "codebuild",
  "mxgraph.aws4.codedeploy": "codedeploy",
  
  // General icons
  "mxgraph.aws4.users": "iam-user",
  "mxgraph.aws4.user": "iam-user",
  "mxgraph.aws4.client": "iam-user",
  "mxgraph.aws4.mobile_client": "iam-user",
};

// Color mapping for categories
const CATEGORY_COLORS: Record<string, string> = {
  compute: "#ED7100",
  containers: "#ED7100",
  database: "#3B48CC",
  storage: "#3F8624",
  networking: "#8C4FFF",
  security: "#DD344C",
  analytics: "#8C4FFF",
  integration: "#E7157B",
  management: "#E7157B",
  devops: "#3F8624",
  governance: "#232F3E",
  policies: "#7C3AED",
};

export interface ParsedDiagram {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  services: string[];
  categories: string[];
  metadata: {
    title?: string;
    pageWidth?: number;
    pageHeight?: number;
  };
}

/**
 * Parse Draw.io XML and extract AWS services as React Flow nodes
 */
export function parseDrawioXml(xmlContent: string): ParsedDiagram {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, "text/xml");
  
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  const servicesSet = new Set<string>();
  const categoriesSet = new Set<string>();
  
  // Get diagram metadata
  const mxGraphModel = doc.querySelector("mxGraphModel");
  const metadata = {
    pageWidth: mxGraphModel ? parseInt(mxGraphModel.getAttribute("pageWidth") || "1700") : 1700,
    pageHeight: mxGraphModel ? parseInt(mxGraphModel.getAttribute("pageHeight") || "1100") : 1100,
  };
  
  // Find all mxCell elements
  const cells = doc.querySelectorAll("mxCell");
  const cellMap = new Map<string, Element>();
  
  // First pass: collect all cells
  cells.forEach(cell => {
    const id = cell.getAttribute("id");
    if (id) {
      cellMap.set(id, cell);
    }
  });
  
  // Second pass: process cells
  cells.forEach(cell => {
    const id = cell.getAttribute("id");
    const style = cell.getAttribute("style") || "";
    const value = cell.getAttribute("value") || "";
    const vertex = cell.getAttribute("vertex");
    const edge = cell.getAttribute("edge");
    const geometry = cell.querySelector("mxGeometry");
    
    if (!id || id === "0" || id === "1") return;
    
    // Process vertices (nodes)
    if (vertex === "1" && geometry) {
      const x = parseFloat(geometry.getAttribute("x") || "0");
      const y = parseFloat(geometry.getAttribute("y") || "0");
      const width = parseFloat(geometry.getAttribute("width") || "60");
      const height = parseFloat(geometry.getAttribute("height") || "60");
      
      // Try to identify AWS service from style
      const serviceId = identifyAwsService(style, value);
      const service = serviceId ? getServiceById(serviceId) : null;
      
      if (service) {
        servicesSet.add(service.id);
        categoriesSet.add(service.category);
        
        const node: DiagramNode = {
          id,
          type: getNodeType(service.id),
          position: { x, y },
          data: {
            serviceId: service.id,
            label: service.shortName || service.name,
            sublabel: cleanLabel(value),
            color: service.color,
          },
          style: {
            width,
            height,
          },
        };
        
        nodes.push(node);
      } else if (value && !isContainerElement(style)) {
        // Generic node with label
        const node: DiagramNode = {
          id,
          type: "awsResource",
          position: { x, y },
          data: {
            serviceId: "generic",
            label: cleanLabel(value),
            color: "#6B7280",
          },
          style: {
            width,
            height,
          },
        };
        nodes.push(node);
      }
    }
    
    // Process edges (connections)
    if (edge === "1") {
      const source = cell.getAttribute("source");
      const target = cell.getAttribute("target");
      
      if (source && target && cellMap.has(source) && cellMap.has(target)) {
        const edgeData: DiagramEdge = {
          id,
          source,
          target,
          type: "smoothstep",
          animated: false,
          data: {
            dataFlow: cleanLabel(value),
          },
        };
        edges.push(edgeData);
      }
    }
  });
  
  return {
    nodes,
    edges,
    services: Array.from(servicesSet),
    categories: Array.from(categoriesSet),
    metadata,
  };
}

/**
 * Identify AWS service from Draw.io style string
 */
function identifyAwsService(style: string, value: string): string | null {
  // Check style for AWS shape patterns
  for (const [pattern, serviceId] of Object.entries(DRAWIO_AWS_PATTERNS)) {
    if (style.toLowerCase().includes(pattern.toLowerCase())) {
      return serviceId;
    }
  }
  
  // Check for shape= attribute
  const shapeMatch = style.match(/shape=([^;]+)/);
  if (shapeMatch) {
    const shape = shapeMatch[1].toLowerCase();
    for (const [pattern, serviceId] of Object.entries(DRAWIO_AWS_PATTERNS)) {
      if (shape.includes(pattern.toLowerCase().replace("mxgraph.", ""))) {
        return serviceId;
      }
    }
  }
  
  // Check for resIcon= attribute (common in AWS4 shapes)
  const resIconMatch = style.match(/resIcon=([^;]+)/);
  if (resIconMatch) {
    const resIcon = resIconMatch[1].toLowerCase();
    for (const [pattern, serviceId] of Object.entries(DRAWIO_AWS_PATTERNS)) {
      if (resIcon.includes(pattern.toLowerCase().replace("mxgraph.", ""))) {
        return serviceId;
      }
    }
  }
  
  // Check for prIcon= attribute
  const prIconMatch = style.match(/prIcon=([^;]+)/);
  if (prIconMatch) {
    const prIcon = prIconMatch[1].toLowerCase();
    for (const [pattern, serviceId] of Object.entries(DRAWIO_AWS_PATTERNS)) {
      if (prIcon.includes(pattern.toLowerCase().replace("mxgraph.", ""))) {
        return serviceId;
      }
    }
  }
  
  // Try to identify from value/label text
  const valueLower = value.toLowerCase().replace(/<[^>]*>/g, "").trim();
  
  // Direct service name matching
  const serviceNameMap: Record<string, string> = {
    "ec2": "ec2",
    "lambda": "lambda",
    "s3": "s3",
    "rds": "rds",
    "dynamodb": "dynamodb",
    "cloudfront": "cloudfront",
    "route 53": "route53",
    "route53": "route53",
    "api gateway": "api-gateway",
    "sqs": "sqs",
    "sns": "sns",
    "ecs": "ecs",
    "eks": "eks",
    "fargate": "fargate",
    "aurora": "aurora",
    "elasticache": "elasticache",
    "cognito": "cognito",
    "iam": "iam",
    "waf": "waf",
    "cloudwatch": "cloudwatch",
    "vpc": "vpc",
    "alb": "alb",
    "nlb": "nlb",
    "load balancer": "alb",
    "nat gateway": "nat-gateway",
    "internet gateway": "internet-gateway",
  };
  
  for (const [name, serviceId] of Object.entries(serviceNameMap)) {
    if (valueLower.includes(name)) {
      return serviceId;
    }
  }
  
  return null;
}

/**
 * Get React Flow node type based on service ID
 */
function getNodeType(serviceId: string): string {
  switch (serviceId) {
    case "vpc":
      return "vpc";
    case "subnet-public":
    case "subnet-private":
      return "subnet";
    case "security-group":
      return "securityGroup";
    case "auto-scaling":
      return "autoScaling";
    default:
      return "awsResource";
  }
}

/**
 * Check if element is a container (VPC, region, etc.)
 */
function isContainerElement(style: string): boolean {
  const containerPatterns = [
    "rounded=1",
    "fillColor=none",
    "dashed=1",
    "strokeColor=#",
  ];
  
  const hasMultiple = containerPatterns.filter(p => style.includes(p)).length >= 2;
  return hasMultiple && !style.includes("mxgraph.aws4");
}

/**
 * Clean HTML tags and entities from label
 */
function cleanLabel(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#xa;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Get category color
 */
export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || "#6B7280";
}

/**
 * Get all available AWS services for reference
 */
export function getAllAwsServices() {
  return AWS_SERVICES;
}
