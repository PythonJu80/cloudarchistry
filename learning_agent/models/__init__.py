"""
Pydantic models for the Learning Agent API.
"""
from .learning import (
    CompanyInfo,
    ScenarioChallenge,
    CloudScenario,
    LocationRequest,
    ResearchResult,
    ScenarioResponse,
    GenerateContentRequest,
    LearningChatRequestWithSession,
)
from .diagram import (
    DiagramNode,
    DiagramConnection,
    AuditDiagramRequest,
    AuditDiagramResponse,
)
from .challenge import (
    ChallengeQuestionsRequest,
    GradeChallengeAnswerRequest,
)
from .cli import (
    CLISimulatorRequest,
    CLIHelpRequest,
    CLIValidateRequest,
)
from .journey import (
    LearningJourneyRequest,
    TrackScenarioRequest,
    TrackChallengeRequest,
    TrackFlashcardRequest,
    TrackQuizRequest,
    GenerateReportRequest,
)
from .config import (
    UpdateAIConfigRequest,
    SetPersonaRequest,
)
from .chat import ChatRequest
