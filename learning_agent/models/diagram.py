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


class AuditDiagramRequest(BaseModel):
    """Request to audit an architecture diagram"""
    nodes: List[DiagramNode]
    connections: List[DiagramConnection]
    challenge_id: Optional[str] = None
    challenge_title: Optional[str] = None
    challenge_brief: Optional[str] = None
    expected_services: Optional[List[str]] = None
    session_id: Optional[str] = None
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class AuditDiagramResponse(BaseModel):
    """Structured response from diagram audit"""
    score: int
    correct: List[str] = []
    missing: List[str] = []
    suggestions: List[str] = []
    feedback: str = ""
    session_id: Optional[str] = None
