"""
Architect Arena Puzzle Generator
=================================
Generates AI-powered architecture puzzles where users must assemble
AWS service "pieces" into a correct architecture diagram.

The puzzle includes:
- A scenario/brief describing what needs to be built
- Pre-generated AWS service nodes (the "puzzle pieces")
- Objectives to achieve
- Penalties to avoid
- Expected connections between services
"""

import json
import uuid
import httpx
from typing import List, Optional, Dict, Any, Set
from pydantic import BaseModel
from openai import AsyncOpenAI
import os
import logging

logger = logging.getLogger(__name__)

from prompts import CERTIFICATION_PERSONAS
from utils import get_request_api_key, get_request_model, ApiKeyRequiredError

# Cloud Academy API URL for fetching AWS services
CLOUD_ACADEMY_URL = os.getenv("CLOUD_ACADEMY_URL", "http://cloud-academy:3000")

# Map cert codes to persona IDs (same as game_modes.py)
CERT_CODE_TO_PERSONA = {
    "SAA": "solutions-architect-associate",
    "SAA-C03": "solutions-architect-associate",
    "SAP": "solutions-architect-professional",
    "SAP-C02": "solutions-architect-professional",
    "DVA": "developer-associate",
    "DVA-C02": "developer-associate",
    "SOA": "sysops-associate",
    "SOA-C02": "sysops-associate",
    "DOP": "devops-professional",
    "DOP-C02": "devops-professional",
    "ANS": "advanced-networking",
    "ANS-C01": "advanced-networking",
    "SCS": "security-specialty",
    "SCS-C02": "security-specialty",
    "DBS": "database-specialty",
    "DBS-C01": "database-specialty",
    "MLS": "machine-learning",
    "MLS-C01": "machine-learning",
    "PAS": "data-analytics",
    "DAS-C01": "data-analytics",
    "CLF": "cloud-practitioner",
    "CLF-C02": "cloud-practitioner",
}


class PuzzlePiece(BaseModel):
    """A single AWS service piece for the puzzle"""
    id: str
    service_id: str  # Maps to aws-services.ts (e.g., "ec2", "rds", "vpc")
    label: str  # Display name (e.g., "Web Server", "Primary Database")
    sublabel: Optional[str] = None  # Additional context
    hint: Optional[str] = None  # Placement hint for the user
    required: bool = True  # Must be placed to complete puzzle
    category: str = "compute"  # For grouping in sidebar


class ExpectedConnection(BaseModel):
    """An expected connection between two pieces"""
    from_piece: str  # Piece ID
    to_piece: str  # Piece ID
    description: str  # What this connection represents
    required: bool = True


class PuzzleObjective(BaseModel):
    """An objective the user should achieve"""
    id: str
    text: str
    points: int = 10
    hint: Optional[str] = None


class PuzzlePenalty(BaseModel):
    """A penalty for incorrect placement"""
    id: str
    text: str
    points: int = -5  # Negative points


class ArchitectArenaPuzzle(BaseModel):
    """Complete puzzle payload for Architect Arena"""
    id: str
    title: str
    brief: str  # The scenario description
    difficulty: str  # easy, medium, hard, expert
    time_limit_seconds: int = 300  # 5 minutes default
    target_score: int = 100
    
    # The puzzle pieces (AWS services to place)
    pieces: List[PuzzlePiece]
    
    # Expected architecture
    expected_connections: List[ExpectedConnection]
    expected_hierarchy: Dict[str, List[str]]  # parent_id -> [child_ids]
    
    # Scoring
    objectives: List[PuzzleObjective]
    penalties: List[PuzzlePenalty]
    
    # Metadata
    aws_services: List[str]  # Services covered
    topics: List[str]  # Topics covered


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
        temperature=0.95,
    )
    return json.loads(response.choices[0].message.content)


async def _fetch_aws_services() -> Dict[str, List[str]]:
    """Fetch AWS services from Cloud Academy API (single source of truth)."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{CLOUD_ACADEMY_URL}/api/services/list", timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                return data.get("byCategory", {})
    except Exception as e:
        print(f"Warning: Could not fetch AWS services from Cloud Academy: {e}")
    
    # Fallback to basic list if API unavailable
    return {
        "Compute": ["ec2", "lambda", "ecs", "eks"],
        "Database": ["rds", "dynamodb", "aurora"],
        "Storage": ["s3", "efs", "ebs"],
        "Networking": ["vpc", "alb", "cloudfront"],
    }


def _format_services_for_prompt(by_category: Dict[str, List[str]]) -> str:
    """Format services by category for the prompt."""
    lines = []
    for category, services in sorted(by_category.items()):
        lines.append(f"   - {category}: {', '.join(services[:10])}")
    return "\n".join(lines)


ARCHITECT_ARENA_PROMPT = """You are an expert AWS Solutions Architect generating architecture puzzles for the "Architect Arena" game.

The user must assemble pre-generated AWS service "pieces" into a correct architecture diagram.
Think of it like a jigsaw puzzle where each piece is an AWS service.

## CRITICAL UNIQUENESS REQUIREMENTS
You MUST generate a completely unique puzzle every single time. Never repeat scenarios.

To ensure uniqueness, you will:
1. INVENT a novel business scenario relevant to the certification focus areas
2. CREATE a unique company name, industry context, and specific business problem
3. SELECT services that match the scenario (not just common patterns)
4. VARY the architecture style based on the business requirements

Do NOT fall back to generic patterns like "3-tier web app" or "serverless API" unless the scenario specifically demands it.

## USER PROFILE
- Skill Level: {user_level}
- Target Certification: {cert_name}
- Focus Areas: {focus_areas}
- Unique Request ID: {request_id}

## DIFFICULTY: {difficulty}
- easy: 4-6 pieces, simple 2-tier architecture
- medium: 6-8 pieces, 3-tier architecture  
- hard: 8-12 pieces, multi-AZ, security groups
- expert: 12+ pieces, multi-region, complex networking

## AVAILABLE AWS SERVICES (use ONLY these service_id values)
{services_list}

## SCENARIO GENERATION GUIDELINES
Based on the focus areas ({focus_areas}), create a scenario that:
- Tests knowledge specific to {cert_name}
- Involves a realistic business with a specific problem to solve
- Requires the user to understand WHY services connect, not just memorize patterns
- Has a creative, memorable title that reflects the business scenario

## RULES
1. Use ONLY service_id values from the list above (lowercase, hyphenated)
2. Each piece needs a contextual label specific to YOUR generated scenario
3. Define hierarchy (what goes inside what) and connections
4. PENALTIES must be ELUSIVE HINTS, not explicit answers!
   - BAD: "Placing EC2 in the public subnet" (gives away the answer)
   - GOOD: "Exposure risk" or "Security boundary violation"
   - Keep penalty text short (2-4 words) and cryptic

Return JSON with this SCHEMA:
{{
  "title": "<creative title reflecting YOUR unique scenario>",
  "brief": "<2-3 sentence business scenario - include company name, industry, specific problem>",
  "difficulty": "{difficulty}",
  "time_limit_seconds": <180-600 based on difficulty>,
  "target_score": 100,
  "pieces": [
    {{
      "id": "<unique_id>",
      "service_id": "<MUST be from the service list above>",
      "label": "<contextual name for YOUR scenario>",
      "sublabel": "<optional technical detail>",
      "hint": "<helpful hint for placement>",
      "required": true,
      "category": "<networking|compute|database|storage|security|integration|monitoring>"
    }}
  ],
  "expected_connections": [
    {{
      "from_piece": "<piece_id>",
      "to_piece": "<piece_id>",
      "description": "<why these connect>",
      "required": true
    }}
  ],
  "expected_hierarchy": {{
    "<container_piece_id>": ["<child_piece_id>", "..."]
  }},
  "objectives": [
    {{"id": "<unique>", "text": "<short goal>", "points": <10-25>, "hint": "<cryptic hint>"}}
  ],
  "penalties": [
    {{"id": "<unique>", "text": "<2-4 word cryptic risk>", "points": <-5 to -15>}}
  ],
  "aws_services": ["<list of services used>"],
  "topics": ["<relevant AWS topics>"]
}}
"""


async def generate_architect_arena_puzzle(
    user_level: str = "intermediate",
    cert_code: Optional[str] = None,
    difficulty: Optional[str] = None,
    api_key: Optional[str] = None,
) -> ArchitectArenaPuzzle:
    """
    Generate an Architect Arena puzzle based on user profile.
    
    Args:
        user_level: User's skill level (beginner/intermediate/advanced/expert)
        cert_code: Target certification code (e.g., "SAA-C03")
        difficulty: Override difficulty (easy/medium/hard/expert)
        api_key: Optional OpenAI API key
    
    Returns:
        ArchitectArenaPuzzle with all pieces and scoring rules
    """
    
    # Build cert context
    cert_name = "AWS Solutions Architect"
    focus_areas = ["Compute", "Networking", "Storage", "Database", "Security"]
    
    # Map cert code to persona
    persona_id = None
    if cert_code:
        upper_code = cert_code.upper()
        persona_id = CERT_CODE_TO_PERSONA.get(upper_code)
        if not persona_id:
            base_code = upper_code.split("-")[0] if "-" in upper_code else upper_code
            persona_id = CERT_CODE_TO_PERSONA.get(base_code)
    
    if persona_id and persona_id in CERTIFICATION_PERSONAS:
        persona = CERTIFICATION_PERSONAS[persona_id]
        cert_name = persona.get("cert", cert_name)
        focus_areas = persona.get("focus", focus_areas)
    
    # Determine difficulty based on skill level if not specified
    if not difficulty:
        difficulty_map = {
            "beginner": "easy",
            "intermediate": "medium",
            "advanced": "hard",
            "expert": "expert",
        }
        difficulty = difficulty_map.get(user_level, "medium")
    
    # Fetch AWS services from Cloud Academy (single source of truth)
    services_by_category = await _fetch_aws_services()
    
    # Generate a unique request ID to encourage LLM variation
    request_id = uuid.uuid4().hex
    
    # Build the prompt with dynamic services list
    system_prompt = ARCHITECT_ARENA_PROMPT.format(
        user_level=user_level,
        cert_name=cert_name,
        focus_areas=", ".join(focus_areas),
        difficulty=difficulty,
        services_list=_format_services_for_prompt(services_by_category),
        request_id=request_id,
    )
    
    # User prompt focuses on what makes THIS request unique
    # The LLM generates the scenario - we don't constrain it with hardcoded lists
    user_prompt = f"""Generate a completely unique Architect Arena puzzle.

Context:
- Certification: {cert_name}
- Skill Level: {user_level}  
- Difficulty: {difficulty}
- Focus Areas: {', '.join(focus_areas)}
- Request ID: {request_id}

Requirements:
1. INVENT a unique business scenario - do not reuse common patterns
2. Create a memorable company/situation that tests {cert_name} knowledge
3. Select services that naturally fit YOUR invented scenario
4. Ensure the puzzle teaches something specific about the focus areas

Be creative. Be specific. Be unique."""

    result = await _chat_json(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        api_key=api_key,
    )
    
    # Build set of valid service IDs for validation
    valid_service_ids: Set[str] = set()
    for services in services_by_category.values():
        valid_service_ids.update(services)
    # Add common container types that may not be in the list
    valid_service_ids.update(["vpc", "subnet-public", "subnet-private", "security-group", "auto-scaling"])
    
    # Parse pieces with validation
    pieces = []
    for p in result.get("pieces", []):
        service_id = p.get("service_id", "ec2")
        
        # Validate service_id against known services
        if service_id not in valid_service_ids:
            logger.warning(f"Hallucinated service_id '{service_id}', falling back to 'ec2'")
            service_id = "ec2"
        
        # Normalize category to lowercase
        category = p.get("category", "compute").lower()
        
        pieces.append(PuzzlePiece(
            id=p.get("id", f"piece_{uuid.uuid4().hex[:8]}"),
            service_id=service_id,
            label=p.get("label", "Service"),
            sublabel=p.get("sublabel"),
            hint=p.get("hint"),
            required=p.get("required", True),
            category=category,
        ))
    
    # Build set of valid piece IDs for connection/hierarchy validation
    piece_ids: Set[str] = {p.id for p in pieces}
    
    # Parse connections with validation
    connections = []
    for c in result.get("expected_connections", []):
        from_piece = c.get("from_piece", "")
        to_piece = c.get("to_piece", "")
        
        # Validate that both piece IDs exist
        if from_piece not in piece_ids:
            logger.warning(f"Invalid connection from_piece '{from_piece}' - skipping")
            continue
        if to_piece not in piece_ids:
            logger.warning(f"Invalid connection to_piece '{to_piece}' - skipping")
            continue
        
        connections.append(ExpectedConnection(
            from_piece=from_piece,
            to_piece=to_piece,
            description=c.get("description", ""),
            required=c.get("required", True),
        ))
    
    # Parse objectives
    objectives = []
    for o in result.get("objectives", []):
        objectives.append(PuzzleObjective(
            id=o.get("id", f"obj_{uuid.uuid4().hex[:8]}"),
            text=o.get("text", "Complete the architecture"),
            points=o.get("points", 10),
            hint=o.get("hint"),
        ))
    
    # Parse penalties
    penalties = []
    for pen in result.get("penalties", []):
        penalties.append(PuzzlePenalty(
            id=pen.get("id", f"pen_{uuid.uuid4().hex[:8]}"),
            text=pen.get("text", "Incorrect placement"),
            points=pen.get("points", -5),
        ))
    
    # Validate and clean expected_hierarchy
    raw_hierarchy = result.get("expected_hierarchy", {})
    validated_hierarchy = {}
    for parent_id, children in raw_hierarchy.items():
        if parent_id not in piece_ids:
            logger.warning(f"Invalid hierarchy parent '{parent_id}' - skipping")
            continue
        valid_children = [c for c in children if c in piece_ids]
        if len(valid_children) != len(children):
            logger.warning(f"Some children of '{parent_id}' were invalid - filtered")
        if valid_children:
            validated_hierarchy[parent_id] = valid_children
    
    return ArchitectArenaPuzzle(
        id=f"puzzle_{uuid.uuid4().hex[:12]}",
        title=result.get("title", "AWS Architecture Challenge"),
        brief=result.get("brief", "Design a secure, scalable AWS architecture."),
        difficulty=result.get("difficulty", difficulty),
        time_limit_seconds=result.get("time_limit_seconds", 300),
        target_score=result.get("target_score", 100),
        pieces=pieces,
        expected_connections=connections,
        expected_hierarchy=validated_hierarchy,
        objectives=objectives,
        penalties=penalties,
        aws_services=result.get("aws_services", []),
        topics=result.get("topics", []),
    )


# Quick test
if __name__ == "__main__":
    import asyncio
    
    async def test():
        result = await generate_architect_arena_puzzle(
            user_level="intermediate",
            cert_code="SAA-C03",
            difficulty="medium",
        )
        print(f"Generated puzzle: {result.title}")
        print(f"Brief: {result.brief}")
        print(f"Pieces: {len(result.pieces)}")
        for p in result.pieces:
            print(f"  - {p.label} ({p.service_id})")
    
    asyncio.run(test())
