"""
Diagram-related Pydantic models.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class DiagramNode(BaseModel):
    """A node in the architecture diagram"""
    id: str
    type: str  # 'vpc', 'subnet', 'securityGroup', 'autoScaling', 'awsResource'
    service: Optional[str] = None  # AWS service name for awsResource nodes
    label: Optional[str] = None
    position: Dict[str, float]  # {x, y}
    parentId: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class DiagramConnection(BaseModel):
    """A connection between nodes"""
    id: str
    source: str
    target: str
    label: Optional[str] = None
    animated: Optional[bool] = False


class AuditDiagramRequest(BaseModel):
    """Request to audit an architecture diagram"""
    session_id: str
    scenario_id: str
    challenge_id: str
    nodes: List[DiagramNode]
    connections: List[DiagramConnection]
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class AuditDiagramResponse(BaseModel):
    """Response from diagram audit"""
    score: int
    max_score: int
    feedback: str
    issues: List[Dict[str, Any]] = []
    suggestions: List[str] = []
    services_used: List[str] = []
    missing_services: List[str] = []
