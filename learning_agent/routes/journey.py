"""
Learning Journey API routes - tracking and reports.
"""
from fastapi import APIRouter

from models.journey import (
    TrackScenarioRequest,
    TrackChallengeRequest,
    TrackFlashcardRequest,
    TrackQuizRequest,
    GenerateReportRequest,
)

router = APIRouter()


@router.post("/track-scenario")
async def track_scenario_start_endpoint(request: TrackScenarioRequest):
    """Track scenario start"""
    from crawl4ai_mcp import track_scenario_start_endpoint as original_endpoint
    return await original_endpoint(request)


@router.post("/track-challenge")
async def track_challenge_endpoint(request: TrackChallengeRequest):
    """Track challenge completion"""
    from crawl4ai_mcp import track_challenge_endpoint as original_endpoint
    return await original_endpoint(request)


@router.post("/track-flashcards")
async def track_flashcard_endpoint(request: TrackFlashcardRequest):
    """Track flashcard study"""
    from crawl4ai_mcp import track_flashcard_endpoint as original_endpoint
    return await original_endpoint(request)


@router.post("/track-quiz")
async def track_quiz_endpoint(request: TrackQuizRequest):
    """Track quiz attempt"""
    from crawl4ai_mcp import track_quiz_endpoint as original_endpoint
    return await original_endpoint(request)


@router.get("/{profile_id}")
async def get_journey_endpoint(profile_id: str, tenant_id: str):
    """Get learner journey"""
    from crawl4ai_mcp import get_journey_endpoint as original_endpoint
    return await original_endpoint(profile_id, tenant_id)


@router.get("/{profile_id}/recommendations")
async def get_recommendations_endpoint(profile_id: str, tenant_id: str, limit: int = 5):
    """Get learning recommendations"""
    from crawl4ai_mcp import get_recommendations_endpoint as original_endpoint
    return await original_endpoint(profile_id, tenant_id, limit)


@router.post("/{profile_id}/report")
async def generate_journey_report(profile_id: str, request: GenerateReportRequest):
    """Generate journey report"""
    from crawl4ai_mcp import generate_journey_report as original_endpoint
    return await original_endpoint(profile_id, request)


@router.get("/{profile_id}/reports")
async def get_journey_reports_endpoint(profile_id: str, limit: int = 10):
    """Get journey reports"""
    from crawl4ai_mcp import get_journey_reports_endpoint as original_endpoint
    return await original_endpoint(profile_id, limit)


@router.get("/{profile_id}/data")
async def get_journey_data_endpoint(profile_id: str):
    """Get journey data"""
    from crawl4ai_mcp import get_journey_data_endpoint as original_endpoint
    return await original_endpoint(profile_id)
