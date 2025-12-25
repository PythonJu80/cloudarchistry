"""
Scenario Generator Module
=========================
Generates cloud architecture training scenarios from company research.
"""

import json
import os
import uuid
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from openai import AsyncOpenAI

from prompts import SCENARIO_GENERATOR_PROMPT, PERSONA_SCENARIO_PROMPT, AWS_PERSONAS
from utils import get_request_model, ApiKeyRequiredError, DEFAULT_MODEL


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


# Valid certification IDs and user levels
VALID_CERTIFICATIONS = list(AWS_PERSONAS.keys())
VALID_USER_LEVELS = ["beginner", "intermediate", "advanced", "expert"]


class ScenarioValidationError(Exception):
    """Raised when scenario parameters are invalid"""
    pass


def validate_scenario_params(target_cert: str, user_level: str) -> None:
    """
    Validate that target_cert and user_level are provided and valid.
    
    Args:
        target_cert: AWS certification ID (e.g., 'solutions-architect-associate')
        user_level: User skill level ('beginner', 'intermediate', 'advanced', 'expert')
    
    Raises:
        ScenarioValidationError: If parameters are missing or invalid
    """
    if not target_cert:
        raise ScenarioValidationError(
            "target_cert is required. Each scenario must be certification-specific. "
            f"Valid certifications: {', '.join(VALID_CERTIFICATIONS)}"
        )
    
    if not user_level:
        raise ScenarioValidationError(
            "user_level is required. Each scenario must be user-level specific. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )
    
    if target_cert not in VALID_CERTIFICATIONS:
        raise ScenarioValidationError(
            f"Invalid target_cert '{target_cert}'. "
            f"Valid certifications: {', '.join(VALID_CERTIFICATIONS)}"
        )
    
    if user_level not in VALID_USER_LEVELS:
        raise ScenarioValidationError(
            f"Invalid user_level '{user_level}'. "
            f"Valid levels: {', '.join(VALID_USER_LEVELS)}"
        )


async def _chat_json(
    messages: List[Dict], 
    model: Optional[str] = None, 
    api_key: Optional[str] = None
) -> Dict:
    """JSON chat completion with .env only."""
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Set OPENAI_API_KEY in .env file."
        )
    
    model = model or get_request_model() or DEFAULT_MODEL
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
    target_cert: str,
    user_level: str,
    research_data: Optional[str] = None,
    knowledge_context: Optional[str] = None,
) -> CloudScenario:
    """
    Generate a cloud architecture scenario based on company info.
    
    IMPORTANT: Both target_cert and user_level are REQUIRED.
    Each scenario must be certification-specific and user-level specific.
    
    Args:
        company_info: Company details from research
        target_cert: AWS certification ID (REQUIRED, e.g., 'solutions-architect-associate')
        user_level: User skill level (REQUIRED: 'beginner', 'intermediate', 'advanced', 'expert')
        research_data: Optional raw research data
        knowledge_context: Optional AWS knowledge base content
    
    Returns:
        CloudScenario with challenges tailored to certification and user level
    
    Raises:
        ScenarioValidationError: If target_cert or user_level are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_scenario_params(target_cert, user_level)
    
    # Fetch current AWS knowledge from database if not provided
    if not knowledge_context:
        from utils import fetch_knowledge_for_generation
        knowledge_context = await fetch_knowledge_for_generation(
            cert_code=target_cert,
            topic=f"{company_info.industry} AWS architecture",
            limit=5
        )
    
    # Get persona context from target certification
    persona = AWS_PERSONAS.get(target_cert)
    if not persona:
        raise ScenarioValidationError(f"Unknown certification: {target_cert}")
    
    persona_context = {
        "cert_name": persona["cert"],
        "focus_areas": ", ".join(persona["focus"]),
        "level": persona["level"],
        "style": persona["style"],
    }
    
    # Build certification-specific prompt
    base_prompt = PERSONA_SCENARIO_PROMPT.format(
        company_name=company_info.name,
        industry=company_info.industry,
        business_context=company_info.description,
        cert_name=persona_context["cert_name"],
        focus_areas=persona_context["focus_areas"],
        level=persona_context["level"],
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

    user_prompt += f"\n\nCERTIFICATION FOCUS: {persona_context['cert_name']}\nKey Topics: {persona_context['focus_areas']}\nCert Level: {persona_context['level']}\nUser Skill: {user_level}"

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
    target_cert: str,
    user_level: str,
    address: Optional[str] = None,
) -> CloudScenario:
    """
    Generate a scenario from basic location/business info.
    Useful for map-based challenge creation.
    
    IMPORTANT: Both target_cert and user_level are REQUIRED.
    
    Args:
        company_name: Business name
        industry: Industry type
        target_cert: AWS certification ID (REQUIRED)
        user_level: User skill level (REQUIRED)
        address: Optional business address
    
    Returns:
        CloudScenario tailored to certification and user level
    
    Raises:
        ScenarioValidationError: If target_cert or user_level are missing/invalid
    """
    
    # CRITICAL: Validate required parameters
    validate_scenario_params(target_cert, user_level)
    company_info = CompanyInfo(
        name=company_name,
        industry=industry,
        description=f"A {industry} business" + (f" located at {address}" if address else ""),
        key_services=[industry],
    )
    
    return await generate_scenario(
        company_info=company_info,
        target_cert=target_cert,
        user_level=user_level,
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
