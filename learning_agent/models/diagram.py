"""
Diagram-related Pydantic models.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict


class DiagramNode(BaseModel):
    """A node in the architecture diagram"""
    model_config = ConfigDict(populate_by_name=True)
    
    id: str
    type: str  # 'vpc', 'subnet', 'securityGroup', 'autoScaling', 'awsResource'
    label: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    parent_id: Optional[str] = None  # For hierarchy analysis
    position: Optional[Dict[str, float]] = None  # {x, y}


class DiagramConnection(BaseModel):
    """A connection between nodes"""
    model_config = ConfigDict(populate_by_name=True)
    
    from_node: str = Field(alias='from')  # 'from' is reserved in Python
    to_node: str = Field(alias='to')      # 'to' for consistency


class AvailableService(BaseModel):
    """A service available in the system for diagram building"""
    id: str
    name: str
    category: str
    can_connect_to: Optional[List[str]] = None
    must_be_inside: Optional[List[str]] = None
    is_container: Optional[bool] = False


class AuditDiagramRequest(BaseModel):
    """Request to audit an architecture diagram"""
    nodes: List[DiagramNode]
    connections: List[DiagramConnection]
    challenge_id: Optional[str] = None
    challenge_title: Optional[str] = None
    challenge_brief: Optional[str] = None
    expected_services: Optional[List[str]] = None
    available_services: Optional[List[AvailableService]] = None  # System's available services
    session_id: Optional[str] = None
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class AuditDiagramResponse(BaseModel):
    """Structured response from diagram audit"""
    score: int
    is_complete: bool = False  # True if score >= 75 and challenge brief is satisfied
    correct: List[str] = []
    missing: List[str] = []
    suggestions: List[str] = []
    feedback: str = ""
    session_id: Optional[str] = None
