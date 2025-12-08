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


@router.post("/generate-scenario-stream")
async def generate_scenario_stream_endpoint(request: LocationRequest):
    """Generate scenario with SSE streaming for real-time progress updates"""

    async def event_stream():
        from utils import set_request_api_key, set_request_model, get_request_api_key
        from generators.scenario import generate_scenario as gen_scenario, CompanyInfo as GenCompanyInfo
        from prompts import CERTIFICATION_PERSONAS
        from openai import AsyncOpenAI

        try:
            # Set request-scoped API key
            if request.openai_api_key:
                set_request_api_key(request.openai_api_key)
            if request.preferred_model:
                set_request_model(request.preferred_model)

            # Step 1: Starting
            yield f"data: {json.dumps({'type': 'status', 'message': '🚀 Starting scenario generation...', 'step': 1, 'total_steps': 5})}\n\n"
            await asyncio.sleep(0.1)

            # Step 2: Research
            yield f"data: {json.dumps({'type': 'status', 'message': f'🔍 Researching {request.company_name}...', 'step': 2, 'total_steps': 5})}\n\n"

            # Perform web search
            queries = [
                f"{request.company_name} company overview business",
                f"{request.company_name} technology infrastructure cloud",
            ]
            if request.industry:
                queries.append(f"{request.company_name} {request.industry} industry")

            all_sources = []
            for query in queries:
                yield f"data: {json.dumps({'type': 'search', 'message': f'🌐 Searching: {query}'})}\n\n"
                results = await search_web(query, max_results=3)
                for r in results:
                    if r.get("url"):
                        all_sources.append(r["url"])
                        yield f"data: {json.dumps({'type': 'source', 'url': r['url'], 'title': r.get('title', 'Source')})}\n\n"
                await asyncio.sleep(0.1)

            # Step 3: Analyzing
            yield f"data: {json.dumps({'type': 'status', 'message': '🧠 Analyzing company information...', 'step': 3, 'total_steps': 5})}\n\n"

            research = await research_company(
                company_name=request.company_name,
                industry=request.industry
            )

            yield f"data: {json.dumps({'type': 'research', 'company': research.company_info.model_dump(), 'sources': list(set(all_sources))[:5]})}\n\n"

            # Step 3.5: Search AWS knowledge base for relevant content
            yield f"data: {json.dumps({'type': 'status', 'message': '📚 Searching AWS knowledge base...', 'step': 3, 'total_steps': 6})}\n\n"

            knowledge_context = ""
            knowledge_topics = []
            try:
                import random as kb_random

                skill_keywords = {
                    "beginner": "basics fundamentals getting started",
                    "intermediate": "best practices configuration",
                    "advanced": "optimization multi-region high availability",
                    "expert": "enterprise scale architecture patterns",
                }
                skill_context = skill_keywords.get(request.user_level, "best practices")

                if request.cert_code and request.cert_code in CERTIFICATION_PERSONAS:
                    cert_focus = CERTIFICATION_PERSONAS[request.cert_code]["focus"]
                    selected_focus = kb_random.sample(cert_focus, min(3, len(cert_focus)))
                    kb_query = f"{' '.join(selected_focus)} {skill_context} AWS {research.company_info.industry}"
                    focus_str = ", ".join(selected_focus)
                    yield f"data: {json.dumps({'type': 'status', 'message': f'🎲 Focus: {focus_str} ({request.user_level})'})}\n\n"
                else:
                    kb_query = f"{research.company_info.industry} {skill_context} AWS architecture"

                client = AsyncOpenAI(api_key=get_request_api_key())
                embed_response = await client.embeddings.create(
                    model="text-embedding-3-small",
                    input=kb_query
                )
                query_embedding = embed_response.data[0].embedding

                kb_results = await db.search_knowledge_chunks(
                    query_embedding=query_embedding,
                    limit=5
                )

                if kb_results:
                    yield f"data: {json.dumps({'type': 'status', 'message': f'📖 Found {len(kb_results)} relevant AWS knowledge chunks'})}\n\n"
                    for chunk in kb_results:
                        yield f"data: {json.dumps({'type': 'knowledge', 'url': chunk['url'], 'similarity': round(chunk['similarity'], 2)})}\n\n"
                        knowledge_context += f"\n\nAWS Knowledge ({chunk['url']}):\n{chunk['content'][:500]}"
                        chunk_content = chunk['content'].lower()
                        for svc in ['s3', 'ec2', 'lambda', 'rds', 'dynamodb', 'cloudwatch', 'iam', 'vpc', 'cloudfront', 'sns', 'sqs', 'kms', 'cloudtrail', 'config']:
                            if svc in chunk_content and svc.upper() not in knowledge_topics:
                                knowledge_topics.append(svc.upper())

                    if knowledge_topics:
                        knowledge_context += f"\n\n⚡ IMPORTANT: Base your challenge titles on these specific AWS topics found: {', '.join(knowledge_topics[:5])}. Create action-oriented titles like 'Secure the S3 Buckets' or 'Configure CloudWatch Alarms' - NOT generic titles like 'Understanding X'."
                else:
                    yield f"data: {json.dumps({'type': 'status', 'message': '📖 No specific knowledge chunks found, using general AWS knowledge'})}\n\n"
            except Exception as kb_err:
                logger.warning(f"Knowledge base search failed: {kb_err}")
                yield f"data: {json.dumps({'type': 'status', 'message': '⚠️ Knowledge base search skipped'})}\n\n"

            # Step 4: Building persona
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
                cert_name = persona["cert"]
                yield f"data: {json.dumps({'type': 'status', 'message': f'🎯 Applying {cert_name} certification focus...', 'step': 4, 'total_steps': 5})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'status', 'message': '🎯 Building general cloud scenario...', 'step': 4, 'total_steps': 5})}\n\n"

            await asyncio.sleep(0.1)

            # Step 5: Generating scenario
            yield f"data: {json.dumps({'type': 'status', 'message': '⚡ Generating challenges and learning objectives...', 'step': 5, 'total_steps': 5})}\n\n"

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

            scenario = await gen_scenario(
                company_info=company_info,
                user_level=request.user_level,
                persona_context=persona_context,
                knowledge_context=knowledge_context if knowledge_context else None,
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

            yield f"data: {json.dumps({'type': 'complete', 'scenario': scenario.model_dump(), 'company_info': research.company_info.model_dump(), 'cert_code': request.cert_code, 'cert_name': persona_context['cert_name'] if persona_context else None})}\n\n"

        except Exception as e:
            logger.error(f"Stream generation error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            set_request_api_key(None)
            set_request_model(None)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


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
