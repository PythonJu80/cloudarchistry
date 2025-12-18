from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class DiagramFormat(str, Enum):
    DRAWIO_XML = "drawio_xml"
    VSDX = "vsdx"


class DiagramStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AWSServiceCategory(str, Enum):
    COMPUTE = "compute"
    STORAGE = "storage"
    DATABASE = "database"
    NETWORKING = "networking"
    SECURITY = "security"
    ANALYTICS = "analytics"
    ML_AI = "ml_ai"
    CONTAINERS = "containers"
    SERVERLESS = "serverless"
    MANAGEMENT = "management"
    INTEGRATION = "integration"
    OTHER = "other"


class DiagramUploadRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    tags: List[str] = Field(default_factory=list)
    format: DiagramFormat
    user_id: str


class DiagramMetadata(BaseModel):
    id: str
    title: str
    description: Optional[str]
    format: DiagramFormat
    status: DiagramStatus
    user_id: str
    username: Optional[str]
    file_url: str
    thumbnail_url: Optional[str]
    tags: List[str]
    services: List[str] = Field(default_factory=list)
    categories: Dict[str, List[str]] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    views: int = 0
    remixes: int = 0
    exports: int = 0


class ParsedService(BaseModel):
    service_id: str
    service_name: str
    service_type: str
    category: AWSServiceCategory
    position: Optional[Dict[str, float]] = None
    properties: Dict[str, Any] = Field(default_factory=dict)


class ParsedDiagram(BaseModel):
    diagram_id: str
    services: List[ParsedService]
    connections: List[Dict[str, Any]] = Field(default_factory=list)
    categories: Dict[str, List[str]]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DiagramSearchRequest(BaseModel):
    query: Optional[str] = None
    categories: Optional[List[AWSServiceCategory]] = None
    services: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    user_id: Optional[str] = None
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class DiagramSearchResponse(BaseModel):
    diagrams: List[DiagramMetadata]
    total: int
    limit: int
    offset: int


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: datetime
