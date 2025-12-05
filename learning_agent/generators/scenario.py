"""
Scenario Generator Module
=========================
Generates cloud architecture training scenarios from company research.
"""

import json
import uuid
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from openai import AsyncOpenAI

from prompts import SCENARIO_GENERATOR_PROMPT, PERSONA_SCENARIO_PROMPT
from utils import get_request_api_key, get_request_model, ApiKeyRequiredError


class Challenge(BaseModel):
    """Single challenge within a scenario"""
    id: str
    title: str
    description: str
    difficulty: str  # beginner, intermediate, advanced, expert
    points: int
    hints: List[str] = []
    success_criteria: List[str] = []
    aws_services_relevant: List[str] = []
    estimated_time_minutes: int = 30


class CloudScenario(BaseModel):
    """Complete training scenario"""
    id: str
    company_name: str
    scenario_title: str
    scenario_description: str
    business_context: str
    technical_requirements: List[str] = []
    compliance_requirements: List[str] = []
    constraints: List[str] = []
    challenges: List[Challenge] = []
    learning_objectives: List[str] = []
    difficulty: str = "intermediate"
    estimated_total_time_minutes: int = 120
    tags: List[str] = []


class CompanyInfo(BaseModel):
    """Company information from research"""
    name: str
    industry: str
    description: str = ""
    key_services: List[str] = []
    technology_stack: List[str] = []
    compliance_requirements: List[str] = []
    data_types: List[str] = []
    employee_count: Optional[str] = None


async def _chat_json(
    messages: List[Dict], 
    model: Optional[str] = None, 
    api_key: Optional[str] = None
) -> Dict:
    """JSON chat completion with request-scoped key support."""
    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Please configure your API key in Settings."
        )
    
    model = model or get_request_model() or "gpt-4o"
    client = AsyncOpenAI(api_key=key)
    
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.9,  # Higher temp for more creative/varied scenarios
    )
    return json.loads(response.choices[0].message.content)


async def generate_scenario(
    company_info: CompanyInfo,
    user_level: str = "intermediate",
    research_data: Optional[str] = None,
    persona_context: Optional[Dict] = None,
    knowledge_context: Optional[str] = None,
) -> CloudScenario:
    """
    Generate a cloud architecture scenario based on company info.
    
    Args:
        company_info: Company details from research
        user_level: Target difficulty level
        research_data: Optional raw research data
        persona_context: Optional certification persona context
    
    Returns:
        CloudScenario with challenges
    """
    
    # Build the prompt based on whether we have persona context
    if persona_context:
        base_prompt = PERSONA_SCENARIO_PROMPT.format(
            company_name=company_info.name,
            industry=company_info.industry,
            business_context=company_info.description,
            cert_name=persona_context.get("cert_name", "AWS Certification"),
            focus_areas=persona_context.get("focus_areas", ""),
            level=persona_context.get("level", "associate"),
            user_level=user_level,
        )
    else:
        base_prompt = SCENARIO_GENERATOR_PROMPT.format(
            company_name=company_info.name,
            industry=company_info.industry,
            business_context=company_info.description,
            key_services=", ".join(company_info.key_services),
            research_data=research_data or "No additional research data",
            user_level=user_level,
        )
    
    system_prompt = f"""You are a senior AWS Solutions Architect creating training scenarios.

{base_prompt}

Return JSON with these exact fields:
- id: unique identifier (generate a UUID)
- company_name: the company name
- scenario_title: compelling title
- scenario_description: brief description
- business_context: the business problem
- technical_requirements: list of technical needs
- compliance_requirements: list of compliance needs
- constraints: list of constraints (budget, timeline, etc.)
- challenges: list of challenge objects, each with:
  - id: unique id
  - title: challenge title
  - description: what to do
  - difficulty: beginner/intermediate/advanced/expert
  - points: point value (100-500)
  - hints: list of hints
  - success_criteria: list of success criteria
  - aws_services_relevant: list of AWS services
  - estimated_time_minutes: time estimate
- learning_objectives: list of what they'll learn
- difficulty: overall difficulty
- estimated_total_time_minutes: total time
- tags: list of tags"""

    user_prompt = f"""Create a scenario for:

COMPANY: {company_info.name}
INDUSTRY: {company_info.industry}
DESCRIPTION: {company_info.description}
SERVICES: {', '.join(company_info.key_services)}
TECH STACK: {', '.join(company_info.technology_stack) if company_info.technology_stack else 'Not specified'}
COMPLIANCE: {', '.join(company_info.compliance_requirements) if company_info.compliance_requirements else 'Standard'}
DATA TYPES: {', '.join(company_info.data_types) if company_info.data_types else 'Business data'}
SCALE: {company_info.employee_count or 'Medium-sized'} employees

USER LEVEL: {user_level}

Create 3-5 progressive challenges. Make it feel like a real consulting engagement."""

    if persona_context:
        user_prompt += f"\n\nFocus on {persona_context.get('cert_name', 'AWS')} certification topics: {persona_context.get('focus_areas', '')}"

    if knowledge_context:
        user_prompt += f"\n\nRELEVANT AWS KNOWLEDGE BASE CONTENT:\n{knowledge_context}\n\nUse this AWS knowledge to inform the challenges and ensure they align with AWS best practices."

    result = await _chat_json([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ])
    
    # Ensure we have an ID
    if not result.get("id"):
        result["id"] = str(uuid.uuid4())
    
    # Parse challenges
    challenges = []
    for c in result.get("challenges", []):
        if not c.get("id"):
            c["id"] = str(uuid.uuid4())
        challenges.append(Challenge(**c))
    
    result["challenges"] = challenges
    
    return CloudScenario(**result)


async def generate_scenario_from_location(
    company_name: str,
    industry: str,
    address: Optional[str] = None,
    user_level: str = "intermediate",
    persona_context: Optional[Dict] = None,
) -> CloudScenario:
    """
    Generate a scenario from basic location/business info.
    Useful for map-based challenge creation.
    
    Args:
        company_name: Business name
        industry: Industry type
        address: Optional business address
        user_level: Target difficulty
        persona_context: Optional certification context
    
    Returns:
        CloudScenario
    """
    company_info = CompanyInfo(
        name=company_name,
        industry=industry,
        description=f"A {industry} business" + (f" located at {address}" if address else ""),
        key_services=[industry],
    )
    
    return await generate_scenario(
        company_info=company_info,
        user_level=user_level,
        persona_context=persona_context,
    )


async def evaluate_solution(
    scenario: CloudScenario,
    challenge_id: str,
    user_solution: str,
    user_level: str = "intermediate",
) -> Dict[str, Any]:
    """
    Evaluate a user's solution to a challenge.
    
    Args:
        scenario: The scenario context
        challenge_id: Which challenge they're solving
        user_solution: Their proposed solution
        user_level: Their skill level
    
    Returns:
        Evaluation with score, feedback, and suggestions
    """
    challenge = next((c for c in scenario.challenges if c.id == challenge_id), None)
    if not challenge:
        return {"error": "Challenge not found", "score": 0}
    
    system_prompt = f"""You are evaluating a cloud architecture solution.

SCENARIO: {scenario.scenario_title}
COMPANY: {scenario.company_name}
BUSINESS CONTEXT: {scenario.business_context}

CHALLENGE: {challenge.title}
DESCRIPTION: {challenge.description}
SUCCESS CRITERIA: {', '.join(challenge.success_criteria)}
RELEVANT AWS SERVICES: {', '.join(challenge.aws_services_relevant)}

USER LEVEL: {user_level}

Evaluate the solution and return JSON with:
- score: 0-100
- passed: boolean (true if score >= 70)
- feedback: detailed feedback string
- strengths: list of what they did well
- improvements: list of suggestions
- missing_criteria: list of success criteria not met
- aws_services_used_correctly: list of services used appropriately
- aws_services_missing: list of services they should have considered
- next_steps: list of recommended next steps"""

    result = await _chat_json([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Evaluate this solution:\n\n{user_solution}"},
    ])
    
    return result
