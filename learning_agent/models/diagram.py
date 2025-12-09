"""
Diagram-related Pydantic models.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class DiagramNode(BaseModel):
    """A node in the architecture diagram"""
    id: str
    type: str  # 'vpc', 'subnet', 'securityGroup', 'autoScaling', 'awsResource'
    label: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    parent_id: Optional[str] = None  # For hierarchy analysis
    position: Optional[Dict[str, float]] = None  # {x, y}
    
    class Config:
        populate_by_name = True


class DiagramConnection(BaseModel):
    """A connection between nodes"""
    from_node: str  # 'from' is reserved in Python
    to_node: str    # 'to' for consistency
    
    class Config:
        populate_by_name = True
        fields = {
            'from_node': {'alias': 'from'},
            'to_node': {'alias': 'to'}
        }


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
