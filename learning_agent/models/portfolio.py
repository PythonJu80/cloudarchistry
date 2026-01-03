"""
Portfolio-related Pydantic models.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class DiagramNodeData(BaseModel):
    """Data for a diagram node"""
    serviceId: Optional[str] = None
    label: str
    sublabel: Optional[str] = None
    color: Optional[str] = None
    subnetType: Optional[str] = None  # 'public' or 'private'


class DiagramNode(BaseModel):
    """A node in the architecture diagram (React Flow format)"""
    id: str
    type: str  # 'vpc', 'subnet', 'awsResource'
    position: Dict[str, float]  # {x, y}
    data: DiagramNodeData
    parentId: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


class DiagramEdge(BaseModel):
    """An edge/connection in the diagram"""
    id: str
    source: str
    target: str
    label: Optional[str] = None
    type: Optional[str] = None
    animated: Optional[bool] = None


class CLICommand(BaseModel):
    """A CLI command executed by the user"""
    command: str
    timestamp: Optional[str] = None
    exitCode: Optional[int] = None
    isCorrect: Optional[bool] = None
    output: Optional[str] = None


class CLIProgressData(BaseModel):
    """CLI progress data from challenge"""
    commandsRun: List[CLICommand] = []
    totalCommands: int = 0
    correctCommands: int = 0
    syntaxErrors: int = 0
    resourcesCreated: Dict[str, List[str]] = {}  # {"vpc": ["vpc-123"], "ec2": ["i-456"]}
    objectivesCompleted: List[str] = []
    cliScore: int = 0


class ProficiencyTestData(BaseModel):
    """Proficiency test results from challenge chat"""
    score: int = 0  # 0-100
    summary: Optional[str] = None
    strengths: List[str] = []
    areasForImprovement: List[str] = []
    questionsAsked: int = 0
    completedAt: Optional[str] = None


class CLIObjectivesData(BaseModel):
    """CLI objectives test results"""
    completedObjectives: int = 0
    totalObjectives: int = 0
    score: int = 0  # percentage
    earnedPoints: int = 0
    totalPoints: int = 0
    completedAt: Optional[str] = None


class ScenarioContext(BaseModel):
    """Context from the scenario/challenge"""
    scenarioTitle: Optional[str] = None
    scenarioDescription: Optional[str] = None
    businessContext: Optional[str] = None
    technicalRequirements: List[str] = []
    complianceRequirements: List[str] = []
    constraints: List[str] = []
    learningObjectives: List[str] = []
    challengeTitle: Optional[str] = None
    challengeDescription: Optional[str] = None
    successCriteria: List[str] = []
    awsServices: List[str] = []


class LocationContext(BaseModel):
    """Context from the location/company"""
    slug: Optional[str] = None
    name: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    compliance: List[str] = []


class GeneratePortfolioRequest(BaseModel):
    """Request to generate portfolio content from completed challenge"""
    profileId: str
    scenarioAttemptId: str
    challengeProgressId: Optional[str] = None
    
    # Diagram data (from ChallengeProgress.solution)
    diagram: Optional[Dict[str, Any]] = None  # {nodes: [], edges: []}
    diagramAuditScore: Optional[int] = None  # AI audit score (0-100) for diagram quality
    
    # CLI data (from CLIProgress)
    cliProgress: Optional[CLIProgressData] = None
    
    # Proficiency test data (from ChallengeProgress.solution.proficiencyTest)
    proficiencyTest: Optional[ProficiencyTestData] = None
    
    # CLI objectives data (from ChallengeProgress.solution.cliTest)
    cliObjectives: Optional[CLIObjectivesData] = None
    
    # Context
    scenarioContext: Optional[ScenarioContext] = None
    locationContext: Optional[LocationContext] = None
    
    # Scoring
    challengeScore: int = 0
    maxScore: int = 0
    completionTimeMinutes: int = 0
    hintsUsed: int = 0
    
    # User context
    skillLevel: str = "intermediate"
    targetCertification: Optional[str] = None
    
    # API config
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class PortfolioContent(BaseModel):
    """AI-generated portfolio content"""
    title: str
    solutionSummary: str
    keyDecisions: List[str]
    complianceAchieved: List[str]
    awsServicesUsed: List[str]
    technicalHighlights: List[str]  # Technical accomplishments demonstrating expertise


class GeneratePortfolioResponse(BaseModel):
    """Response from portfolio generation"""
    success: bool
    portfolioId: Optional[str] = None
    content: Optional[PortfolioContent] = None
    error: Optional[str] = None
