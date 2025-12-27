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
    StudyPlanRequest,
    StudyGuideRequest,
    FormatStudyGuideRequest,
    GenerateFlashcardsFromCertRequest,
    DiagnosticsRequest,
)
from models.diagram import AuditDiagramRequest, AuditDiagramResponse
from models.challenge import ChallengeQuestionsRequest, GradeChallengeAnswerRequest
from models.cli import CLISimulatorRequest, CLIHelpRequest, CLIValidateRequest
from services.research import research_company
from services.web_search import search_web

import db
from prompts import CERTIFICATION_PERSONAS, SOLUTION_EVALUATOR_PROMPT
from generators import generate_study_plan, StudyPlanContext
from generators.study_plan import generate_study_guide, StudyGuideContext
from utils import ApiKeyRequiredError

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
        
        # Ensure cert_code is provided (required by generator)
        if not request.cert_code:
            raise HTTPException(
                status_code=400,
                detail="cert_code is required for scenario generation"
            )
        
        scenario = await gen_scenario(
            company_info=company_info,
            target_cert=request.cert_code,
            user_level=request.user_level,
        )
        
        # Get cert name for response
        cert_name = None
        if request.cert_code in CERTIFICATION_PERSONAS:
            cert_name = CERTIFICATION_PERSONAS[request.cert_code]["cert"]
        
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
            cert_name=cert_name,
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

            # Step 4: Validate cert_code (required by generator)
            if not request.cert_code:
                yield f"data: {json.dumps({'type': 'error', 'message': 'cert_code is required for scenario generation'})}\n\n"
                return
            
            # Get cert name for status messages
            cert_name = None
            if request.cert_code in CERTIFICATION_PERSONAS:
                cert_name = CERTIFICATION_PERSONAS[request.cert_code]["cert"]
                yield f"data: {json.dumps({'type': 'status', 'message': f'🎯 Applying {cert_name} certification focus...', 'step': 4, 'total_steps': 5})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'status', 'message': '🎯 Building cloud scenario...', 'step': 4, 'total_steps': 5})}\n\n"

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
                target_cert=request.cert_code,
                user_level=request.user_level,
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

            yield f"data: {json.dumps({'type': 'complete', 'scenario': scenario.model_dump(), 'company_info': research.company_info.model_dump(), 'cert_code': request.cert_code, 'cert_name': cert_name})}\n\n"

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
    """Generate flashcards (legacy - scenario-based)"""
    from crawl4ai_mcp import generate_flashcards_endpoint as original_endpoint
    return await original_endpoint(request)


@router.post("/generate-flashcards-from-cert")
async def generate_flashcards_from_cert_endpoint(request: GenerateFlashcardsFromCertRequest):
    """
    Generate flashcards from user's certification + telemetry (no scenario required).
    
    This is the NEW simplified approach:
    1. Uses user's target certification (SAA, DVA, SOA, etc.)
    2. Uses user's skill level (beginner, intermediate, advanced)
    3. Uses user telemetry (challenges completed, points, level) to personalize difficulty
    4. Searches knowledge base for relevant AWS content
    5. AI generates flashcards based on cert focus areas
    """
    from utils import set_request_api_key, set_request_model, get_request_api_key, ApiKeyRequiredError
    from openai import AsyncOpenAI
    
    try:
        # Set API key
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        api_key = get_request_api_key()
        if not api_key:
            raise ApiKeyRequiredError("OpenAI API key required")
        
        # Get certification persona
        cert_code = request.certification_code.upper()
        if cert_code not in CERTIFICATION_PERSONAS:
            # Default to SAA if unknown
            cert_code = "SAA"
        
        persona = CERTIFICATION_PERSONAS[cert_code]
        cert_name = persona["cert"]
        cert_level = persona["level"]
        focus_areas = persona["focus"]
        
        # Build difficulty distribution based on skill level
        skill_level = request.skill_level.lower()
        if skill_level == "beginner":
            difficulty_dist = {"easy": 0.5, "medium": 0.4, "hard": 0.1}
        elif skill_level == "advanced":
            difficulty_dist = {"easy": 0.1, "medium": 0.4, "hard": 0.5}
        else:  # intermediate
            difficulty_dist = {"easy": 0.25, "medium": 0.5, "hard": 0.25}
        
        # Search knowledge base for relevant content
        knowledge_context = ""
        try:
            # Build search query from cert focus areas
            import random
            selected_focus = random.sample(focus_areas, min(3, len(focus_areas)))
            search_query = f"{cert_name} {' '.join(selected_focus)} AWS best practices"
            
            client = AsyncOpenAI(api_key=api_key)
            embed_response = await client.embeddings.create(
                model="text-embedding-3-small",
                input=search_query
            )
            query_embedding = embed_response.data[0].embedding
            
            kb_results = await db.search_knowledge_chunks(
                query_embedding=query_embedding,
                limit=8
            )
            
            if kb_results:
                for chunk in kb_results[:5]:
                    knowledge_context += f"\n\n{chunk['content'][:600]}"
        except Exception as kb_err:
            logger.warning(f"Knowledge base search failed: {kb_err}")
        
        # Build telemetry context
        telemetry_context = ""
        if request.telemetry:
            t = request.telemetry
            telemetry_context = f"""
User Progress:
- Skill Level: {t.get('skillLevel', 'intermediate')}
- Challenges Completed: {t.get('challengesCompleted', 0)}
- Scenarios Completed: {t.get('scenariosCompleted', 0)}
- Total Points: {t.get('totalPoints', 0)}
- Level: {t.get('level', 1)}
"""
        
        # Generate flashcards with AI
        client = AsyncOpenAI(api_key=api_key)
        model = request.preferred_model or "gpt-4o"
        
        prompt = f"""Generate {request.card_count} flashcards for the {cert_name} certification exam.

Target Audience: {skill_level} level learner
Focus Areas: {', '.join(focus_areas)}

Difficulty Distribution:
- Easy cards: {int(difficulty_dist['easy'] * request.card_count)}
- Medium cards: {int(difficulty_dist['medium'] * request.card_count)}
- Hard cards: {int(difficulty_dist['hard'] * request.card_count)}

{telemetry_context}

{f"Relevant AWS Knowledge:{knowledge_context}" if knowledge_context else ""}

Generate flashcards that:
1. Cover key concepts for the {cert_name} exam
2. Include practical scenarios and use cases
3. Test understanding of AWS services and best practices
4. Match the difficulty distribution above

Return a JSON object with this structure:
{{
  "title": "Deck title",
  "description": "Brief description",
  "cards": [
    {{
      "front": "Question or concept",
      "back": "Answer or explanation",
      "difficulty": "easy|medium|hard",
      "tags": ["tag1", "tag2"],
      "awsServices": ["S3", "EC2"]
    }}
  ]
}}

Return ONLY valid JSON, no markdown or explanation."""

        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are an AWS certification exam preparation expert. Generate high-quality flashcards that help learners prepare for AWS certification exams."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
        )
        
        import json
        deck_data = json.loads(response.choices[0].message.content)
        
        # Ensure title and description
        if not deck_data.get("title"):
            deck_data["title"] = f"{cert_name} Flashcards"
        if not deck_data.get("description"):
            deck_data["description"] = f"AI-generated flashcards for {cert_name} certification preparation"
        
        return {
            "success": True,
            "deck": deck_data,
            "certification": cert_code,
            "cert_name": cert_name,
            "card_count": len(deck_data.get("cards", [])),
        }
        
    except ApiKeyRequiredError:
        raise HTTPException(status_code=402, detail="OpenAI API key required")
    except Exception as exc:
        logger.error(f"Flashcard generation from cert failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        set_request_api_key(None)
        set_request_model(None)


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


@router.post("/generate-study-plan")
async def generate_study_plan_endpoint(request: StudyPlanRequest):
    """Generate a SMART study plan grounded in telemetry."""
    try:
        from utils import set_request_api_key, set_request_model

        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)

        telemetry_summary = request.telemetry_summary or "No telemetry available"

        context = StudyPlanContext(
            target_exam=request.target_exam,
            time_horizon=f"{request.time_horizon_weeks} weeks",
            study_hours_per_week=request.study_hours_per_week,
            confidence_level=request.confidence_level,
            weak_areas=request.weak_areas,
            focus_domains=request.focus_domains,
            preferred_formats=request.preferred_formats,
            learner_notes=request.learner_notes,
            telemetry_summary=telemetry_summary,
        )

        plan = await generate_study_plan(context)
        return {"success": True, "plan": plan}
    except ApiKeyRequiredError as key_err:
        raise HTTPException(status_code=402, detail=str(key_err)) from key_err
    except Exception as exc:
        logger.error("Study plan generation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Study plan generation failed") from exc
    finally:
        from utils import set_request_api_key, set_request_model

        set_request_api_key(None)
        set_request_model(None)


@router.post("/format-study-guide")
async def format_study_guide_endpoint(request: FormatStudyGuideRequest):
    """FORMAT a study guide from pre-selected content.
    
    The tool has already decided what content goes in the plan.
    The AI just formats it nicely with themes, descriptions, and accountability tips.
    """
    try:
        from utils import set_request_api_key, set_request_model

        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)

        # Import the formatter function
        from generators.study_plan import format_study_guide

        plan = await format_study_guide(
            target_certification=request.target_certification,
            skill_level=request.skill_level,
            time_horizon_weeks=request.time_horizon_weeks,
            hours_per_week=request.hours_per_week,
            learning_styles=request.learning_styles,
            coach_notes=request.coach_notes,
            structured_content=request.structured_content,
        )
        return {"success": True, "plan": plan}
    except ApiKeyRequiredError as key_err:
        raise HTTPException(status_code=402, detail=str(key_err)) from key_err
    except Exception as exc:
        logger.error("Study guide formatting failed: %s", exc)
        raise HTTPException(status_code=500, detail="Study guide formatting failed") from exc
    finally:
        from utils import set_request_api_key, set_request_model

        set_request_api_key(None)
        set_request_model(None)


@router.post("/detect-skill")
async def detect_skill_endpoint(message: str):
    """Detect user skill level"""
    from crawl4ai_mcp import detect_skill_endpoint as original_endpoint
    return await original_endpoint(message)


@router.post("/generate-diagnostics")
async def generate_diagnostics_endpoint(request: DiagnosticsRequest):
    """
    Generate comprehensive learner diagnostics based on their platform activity.
    
    Analyzes all user data to identify:
    - Strengths and weaknesses
    - Exam readiness score
    - Domain-specific scores
    - Learning patterns
    - Personalized recommendations
    """
    try:
        from utils import set_request_api_key, set_request_model
        from generators.diagnostics import generate_diagnostics, DiagnosticsContext
        
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        # Build context from request
        context = DiagnosticsContext(
            profile_id=request.profile_id,
            display_name=request.display_name,
            skill_level=request.skill_level,
            target_certification=request.target_certification,
            subscription_tier=request.subscription_tier,
            total_points=request.total_points,
            level=request.level,
            xp=request.xp,
            current_streak=request.current_streak,
            longest_streak=request.longest_streak,
            achievements_count=request.achievements_count,
            challenges_total=request.challenges_total,
            challenges_completed=request.challenges_completed,
            challenges_completion_rate=request.challenges_completion_rate,
            challenges_avg_score=request.challenges_avg_score,
            challenges_hints_used=request.challenges_hints_used,
            challenges_avg_hints=request.challenges_avg_hints,
            difficulty_breakdown=request.difficulty_breakdown,
            scenarios_total=request.scenarios_total,
            scenarios_completed=request.scenarios_completed,
            scenarios_completion_rate=request.scenarios_completion_rate,
            top_services=request.top_services,
            industry_breakdown=request.industry_breakdown,
            chat_sessions=request.chat_sessions,
            questions_asked=request.questions_asked,
            top_keywords=request.top_keywords,
            total_time_minutes=request.total_time_minutes,
            avg_time_per_scenario=request.avg_time_per_scenario,
            activity_timeline=request.activity_timeline,
            recent_scenarios=request.recent_scenarios,
        )
        
        result = await generate_diagnostics(context)
        
        return {
            "success": True,
            "diagnostics": result.model_dump(),
        }
    except ApiKeyRequiredError as key_err:
        raise HTTPException(status_code=402, detail=str(key_err)) from key_err
    except Exception as exc:
        logger.error("Diagnostics generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Diagnostics generation failed: {str(exc)}") from exc
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)
