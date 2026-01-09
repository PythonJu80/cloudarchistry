"""
Diagram-related Pydantic models.

These models are synced with cloud-archistry/src/lib/aws-placement-rules.ts
to ensure single source of truth for AWS architecture validation.
"""
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


class DiagramNode(BaseModel):
    """A node in the architecture diagram"""
    model_config = ConfigDict(populate_by_name=True)
    
    id: str
    type: str  # 'vpc', 'subnet', 'auto-scaling', 'awsResource', etc.
    label: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    parent_id: Optional[str] = None  # For hierarchy analysis
    position: Optional[Dict[str, float]] = None  # {x, y}


class DiagramConnection(BaseModel):
    """A connection between nodes"""
    model_config = ConfigDict(populate_by_name=True)
    
    from_node: str = Field(alias='from')  # 'from' is reserved in Python
    to_node: str = Field(alias='to')      # 'to' for consistency


# ============================================
# ENI Info - describes how services create ENIs
# ============================================
class ENIInfo(BaseModel):
    """Information about how a service creates Elastic Network Interfaces"""
    eni_count: str = Field(alias='eniCount')  # e.g., "1", "1-8", "per-AZ"
    description: str


# ============================================
# Available Service - enhanced with placement rules
# ============================================
class AvailableService(BaseModel):
    """A service available in the system for diagram building.
    
    Enhanced with fields from aws-placement-rules.ts for accurate validation.
    """
    model_config = ConfigDict(populate_by_name=True)
    
    id: str
    name: str
    category: str
    # Scope: where this service exists in AWS hierarchy
    scope: Optional[Literal["global", "edge", "regional", "az", "vpc"]] = "regional"
    # Connection rules
    can_connect_to: Optional[List[str]] = None
    must_be_inside: Optional[List[str]] = None
    # Container behavior
    is_container: Optional[bool] = False
    is_vpc_resource: Optional[bool] = Field(default=False, alias='is_vpc_resource')
    # ENI information for network understanding
    eni_info: Optional[ENIInfo] = None


# ============================================
# Edge Types - relationship definitions
# ============================================
class EdgeType(BaseModel):
    """Defines a valid relationship type between AWS services"""
    id: str
    name: str
    category: str  # 'attachment', 'endpoint', 'trust', 'data', 'control'
    description: str
    valid_sources: List[str] = Field(alias='validSources')
    valid_targets: List[str] = Field(alias='validTargets')
    source_cardinality: Optional[str] = Field(default="many", alias='sourceCardinality')
    target_cardinality: Optional[str] = Field(default="many", alias='targetCardinality')
    requires_subnet: Optional[bool] = Field(default=False, alias='requiresSubnet')
    requires_vpc: Optional[bool] = Field(default=False, alias='requiresVpc')
    cross_az: Optional[bool] = Field(default=False, alias='crossAZ')
    cross_vpc: Optional[bool] = Field(default=False, alias='crossVpc')
    cross_region: Optional[bool] = Field(default=False, alias='crossRegion')


class EdgeTypes(BaseModel):
    """Collection of edge type definitions by category"""
    attachment: Optional[List[EdgeType]] = []
    endpoint: Optional[List[EdgeType]] = []
    trust: Optional[List[EdgeType]] = []
    data_flow: Optional[List[EdgeType]] = []


# ============================================
# Local Audit Result - from client-side validation
# ============================================
class PlacementIssue(BaseModel):
    """A placement issue detected by local audit
    
    Severity levels:
    - error: Hard invalid (RDS in public subnet, CloudFront in VPC, EC2 in SG)
    - warning: Soft architectural improvement (single NAT, single-AZ cache)
    - note: Diagram abstraction nuance (IGW→ALB, RDS→RDS replication edge)
    """
    node_id: str
    service_id: str
    issue: str
    suggestion: str
    severity: Literal["error", "warning", "note"] = "error"


class ConnectionIssue(BaseModel):
    """A connection issue detected by local audit
    
    Severity levels:
    - error: Invalid connection (EC2→VPC, Subnet→EC2)
    - warning: Suboptimal pattern (missing redundancy)
    - note: Diagram abstraction (IGW→ALB, RDS replication, CloudWatch edges)
    """
    source_id: str
    target_id: str
    issue: str
    suggestion: str
    severity: Literal["error", "warning", "note"] = "warning"


class LocalAuditResult(BaseModel):
    """Results from client-side audit using aws-placement-rules.ts"""
    score: int
    max_score: int
    placement_issues: Optional[List[PlacementIssue]] = []
    connection_issues: Optional[List[ConnectionIssue]] = []


# ============================================
# Audit Request/Response
# ============================================
class AuditDiagramRequest(BaseModel):
    """Request to audit an architecture diagram.
    
    Enhanced to receive placement rules from aws-placement-rules.ts,
    ensuring single source of truth between UI and audit.
    """
    model_config = ConfigDict(populate_by_name=True)
    
    # Core diagram data
    nodes: List[DiagramNode]
    connections: List[DiagramConnection]
    
    # Challenge context
    challenge_id: Optional[str] = None
    challenge_title: Optional[str] = None
    challenge_brief: Optional[str] = None
    expected_services: Optional[List[str]] = None
    
    # Placement rules from aws-placement-rules.ts (SINGLE SOURCE OF TRUTH)
    available_services: Optional[List[AvailableService]] = None
    edge_types: Optional[EdgeTypes] = None
    
    # Local audit results (already validated client-side)
    local_audit: Optional[LocalAuditResult] = None
    
    # Session and auth
    session_id: Optional[str] = None
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class AuditDiagramResponse(BaseModel):
    """Structured response from diagram audit"""
    score: int
    max_score: Optional[int] = 100
    is_complete: bool = False  # True if score >= 75 and challenge brief is satisfied
    is_valid: Optional[bool] = True  # True if no placement/connection issues
    correct: List[str] = []
    incorrect: Optional[List[str]] = []
    missing: List[str] = []
    suggestions: List[str] = []
    placement_issues: Optional[List[PlacementIssue]] = []
    connection_issues: Optional[List[ConnectionIssue]] = []
    feedback: str = ""
    session_id: Optional[str] = None
