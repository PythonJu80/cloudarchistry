"""
Learning API routes - scenarios, chat, challenges, content generation.
"""
import json
import uuid
import asyncio
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from config.settings import logger, DEFAULT_TENANT_ID
from models.learning import (
    LocationRequest,
    ResearchResult,
    ScenarioResponse,
    GenerateContentRequest,
    LearningChatRequestWithSession,
    CloudScenario,
)
from models.diagram import AuditDiagramRequest, AuditDiagramResponse
from models.challenge import ChallengeQuestionsRequest, GradeChallengeAnswerRequest
from models.cli import CLISimulatorRequest, CLIHelpRequest, CLIValidateRequest
from services.research import research_company
from services.web_search import search_web

import db
from prompts import CERTIFICATION_PERSONAS, SOLUTION_EVALUATOR_PROMPT

router = APIRouter()


@router.get("/certifications")
async def list_certifications():
    """List available AWS certifications for challenge generation"""
    certs = []
    for code, persona in CERTIFICATION_PERSONAS.items():
        certs.append({
            "code": code,
            "name": persona["cert"],
            "level": persona["level"],
            "focus": persona["focus"],
        })
    
    # Sort by level: foundational, associate, professional, specialty
    level_order = {"foundational": 0, "associate": 1, "professional": 2, "specialty": 3}
    certs.sort(key=lambda x: (level_order.get(x["level"], 99), x["name"]))
    
    return {"certifications": certs}


@router.post("/research", response_model=ResearchResult)
async def research_endpoint(request: LocationRequest):
    """Research a company and gather information"""
    try:
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        result = await research_company(
            company_name=request.company_name,
            industry=request.industry
        )
        return result
    except Exception as e:
        logger.error(f"Research endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@router.post("/generate-scenario", response_model=ScenarioResponse)
async def generate_scenario_endpoint(request: LocationRequest):
    """Generate a complete training scenario/challenge for a location/company"""
    try:
        from utils import set_request_api_key, set_request_model
        from generators.scenario import generate_scenario as gen_scenario, CompanyInfo as GenCompanyInfo
        
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        research = await research_company(
            company_name=request.company_name,
            industry=request.industry
        )
        
        company_info = GenCompanyInfo(
            name=research.company_info.name,
            industry=research.company_info.industry,
            description=research.company_info.description,
            key_services=research.company_info.key_services,
            technology_stack=research.company_info.technology_stack,
            compliance_requirements=research.company_info.compliance_requirements,
            data_types=research.company_info.data_types,
            employee_count=research.company_info.employee_count,
        )
        
        persona_context = None
        if request.cert_code and request.cert_code in CERTIFICATION_PERSONAS:
            persona = CERTIFICATION_PERSONAS[request.cert_code]
            persona_context = {
                "cert_code": request.cert_code,
                "cert_name": persona["cert"],
                "level": persona["level"],
                "focus_areas": ", ".join(persona["focus"]),
                "style": persona["style"],
            }
        
        scenario = await gen_scenario(
            company_info=company_info,
            user_level=request.user_level,
            persona_context=persona_context,
        )
        
        if request.place_id:
            try:
                await db.save_scenario(
                    location_id=request.place_id,
                    scenario_data=scenario.model_dump(),
                    company_info=research.company_info.model_dump(),
                )
            except Exception as db_err:
                logger.warning(f"Failed to save scenario to DB: {db_err}")
        
        return ScenarioResponse(
            success=True,
            scenario=scenario,
            company_info=research.company_info,
            cert_code=request.cert_code,
            cert_name=persona_context["cert_name"] if persona_context else None,
        )
    except Exception as e:
        logger.error(f"Scenario generation error: {e}")
        return ScenarioResponse(success=False, error=str(e))
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@router.post("/chat")
async def learning_chat_endpoint(request: LearningChatRequestWithSession):
    """Interactive coaching chat with Sophia"""
    # Import the full implementation from the original file for now
    # This will be fully migrated in a future refactor
    from crawl4ai_mcp import learning_chat_endpoint as original_endpoint
    return await original_endpoint(request)


@router.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str, limit: int = 50):
    """Get chat history for a session"""
    try:
        messages = await db.get_session_history(session_id, limit=limit)
        return {"session_id": session_id, "messages": messages}
    except Exception as e:
        logger.error(f"Get chat history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evaluate-solution")
async def evaluate_solution_endpoint(
    scenario_id: str,
    challenge_id: str,
    solution: Dict[str, Any]
):
    """Evaluate a user's solution to a challenge"""
    from crawl4ai_mcp import evaluate_solution_endpoint as original_endpoint
    return await original_endpoint(scenario_id, challenge_id, solution)


@router.post("/audit-diagram", response_model=AuditDiagramResponse)
async def audit_diagram_endpoint(request: AuditDiagramRequest):
    """Audit a user's AWS architecture diagram"""
    from crawl4ai_mcp import audit_diagram_endpoint as original_endpoint
    return await original_endpoint(request)


@router.post("/challenge-questions")
async def generate_challenge_questions_endpoint(request: ChallengeQuestionsRequest):
    """Generate challenge questions"""
    from crawl4ai_mcp import generate_challenge_questions_endpoint as original_endpoint
    return await original_endpoint(request)


@router.post("/grade-challenge-answer")
async def grade_challenge_answer_endpoint(request: GradeChallengeAnswerRequest):
    """Grade a challenge answer"""
    from crawl4ai_mcp import grade_challenge_answer_endpoint as original_endpoint
    return await original_endpoint(request)


@router.post("/cli-simulate")
async def cli_simulate_endpoint(request: CLISimulatorRequest):
    """Simulate CLI command"""
    from crawl4ai_mcp import cli_simulate_endpoint as original_endpoint
    return await original_endpoint(request)


@router.post("/cli-help")
async def cli_help_endpoint(request: CLIHelpRequest):
    """Get CLI help"""
    from crawl4ai_mcp import cli_help_endpoint as original_endpoint
    return await original_endpoint(request)


@router.delete("/cli-session/{session_id}")
async def cli_session_delete(session_id: str):
    """Delete CLI session"""
    from crawl4ai_mcp import cli_session_delete as original_endpoint
    return await original_endpoint(session_id)


@router.get("/cli-session/{session_id}/stats")
async def cli_session_stats(session_id: str):
    """Get CLI session stats"""
    from crawl4ai_mcp import cli_session_stats as original_endpoint
    return await original_endpoint(session_id)


@router.post("/cli-validate")
async def cli_validate_endpoint(request: CLIValidateRequest):
    """Validate CLI challenge"""
    from crawl4ai_mcp import cli_validate_endpoint as original_endpoint
    return await original_endpoint(request)


@router.post("/generate-flashcards")
async def generate_flashcards_endpoint(request: GenerateContentRequest):
    """Generate flashcards"""
    from crawl4ai_mcp import generate_flashcards_endpoint as original_endpoint
    return await original_endpoint(request)


@router.post("/generate-notes")
async def generate_notes_endpoint(request: GenerateContentRequest):
    """Generate study notes"""
    from crawl4ai_mcp import generate_notes_endpoint as original_endpoint
    return await original_endpoint(request)


@router.post("/generate-quiz")
async def generate_quiz_endpoint(request: GenerateContentRequest):
    """Generate quiz"""
    from crawl4ai_mcp import generate_quiz_endpoint as original_endpoint
    return await original_endpoint(request)


@router.post("/detect-skill")
async def detect_skill_endpoint(message: str):
    """Detect user skill level"""
    from crawl4ai_mcp import detect_skill_endpoint as original_endpoint
    return await original_endpoint(message)
