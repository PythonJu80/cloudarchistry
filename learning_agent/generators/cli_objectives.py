"""
CLI Objectives Generator Module
================================
Generates specific CLI tasks for users to complete based on their challenge.
Tasks relate to their diagram - they deploy what they designed.
"""

import json
import os
import uuid
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from openai import AsyncOpenAI

from utils import get_request_model, ApiKeyRequiredError, DEFAULT_MODEL


# =============================================================================
# DATA MODELS
# =============================================================================

class CLIObjective(BaseModel):
    """A single CLI objective to complete."""
    id: str
    description: str
    command_pattern: str  # Regex pattern or key parts to match
    example_command: str  # Example of a valid command
    hint: Optional[str] = None
    points: int = 20
    service: str  # AWS service this relates to
    difficulty: str = "intermediate"


class CLIObjectivesSet(BaseModel):
    """Set of CLI objectives for a challenge."""
    challenge_id: str
    challenge_title: str
    objectives: List[CLIObjective]
    total_points: int
    estimated_time_minutes: int
    context_message: str  # Message explaining what they need to do


class CLICommandResult(BaseModel):
    """Result of validating a CLI command."""
    command: str
    is_valid: bool
    objective_id: Optional[str] = None  # Which objective this completes
    feedback: str
    points_earned: int = 0


class CLITestResult(BaseModel):
    """Final result of CLI test."""
    challenge_id: str
    objectives: List[Dict]  # Objectives with completion status
    total_objectives: int
    completed_objectives: int
    score: int  # Percentage
    command_history: List[Dict]
    completed_at: Optional[str] = None


# =============================================================================
# PROMPTS
# =============================================================================

CLI_OBJECTIVES_PROMPT = """Generate CLI objectives for this AWS architecture challenge.

CHALLENGE: {challenge_title}
DESCRIPTION: {challenge_description}
SUCCESS CRITERIA: {success_criteria}

BUSINESS CONTEXT:
- Company: {company_name}
- Industry: {industry}
- Context: {business_context}

USER'S DIAGRAM SERVICES: {diagram_services}
USER LEVEL: {user_level}

Generate {objective_count} CLI objectives that:
1. Are SPECIFIC to their architecture - use the services they placed in their diagram
2. Would actually deploy/configure what they designed
3. Match their skill level:
   - beginner: Basic commands with clear parameters
   - intermediate: Commands with multiple options
   - advanced: Complex commands, chained operations
4. Progress logically (create VPC before subnet, etc.)

For each objective, provide:
- A clear description of what to do
- A command pattern (key parts that must be present)
- An example of a valid command
- A hint if they're stuck
- Points (10-30 based on complexity)
- The AWS service involved

Return JSON:
{{
  "context_message": "<1-2 sentences setting up the CLI tasks>",
  "objectives": [
    {{
      "id": "<unique id>",
      "description": "<what they need to do>",
      "command_pattern": "<key parts to match, e.g., 'aws ec2 create-vpc --cidr-block'>",
      "example_command": "<full example command>",
      "hint": "<optional hint>",
      "points": <10-30>,
      "service": "<aws service>",
      "difficulty": "{user_level}"
    }}
  ],
  "estimated_time_minutes": <realistic time>
}}

Make objectives realistic - things they'd actually run in AWS.
"""

CLI_VALIDATE_PROMPT = """Validate if this CLI command completes any of the objectives.

OBJECTIVES:
{objectives_json}

USER'S COMMAND:
{user_command}

COMMAND OUTPUT (simulated):
{command_output}

Determine:
1. Is this a valid AWS CLI command?
2. Does it complete any of the objectives?
3. If not, what's wrong or missing?

Return JSON:
{{
  "is_valid": <true/false>,
  "objective_id": "<id of completed objective or null>",
  "feedback": "<helpful feedback about the command>",
  "points_earned": <points if objective completed, else 0>
}}
"""


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _extract_diagram_services(diagram_data: Optional[Dict]) -> List[str]:
    """Extract service names from diagram nodes."""
    if not diagram_data or not diagram_data.get("nodes"):
        return []
    
    services = []
    for node in diagram_data.get("nodes", []):
        node_type = node.get("type", "")
        if node_type not in ["vpc", "subnet", "availabilityZone"]:
            label = node.get("data", {}).get("label", "")
            if label and label not in services:
                services.append(label)
    
    # Also include VPC/subnet if present
    has_vpc = any(n.get("type") == "vpc" for n in diagram_data.get("nodes", []))
    has_subnet = any(n.get("type") == "subnet" for n in diagram_data.get("nodes", []))
    
    if has_vpc and "VPC" not in services:
        services.insert(0, "VPC")
    if has_subnet and "Subnet" not in services:
        services.insert(1 if has_vpc else 0, "Subnet")
    
    return services


async def _chat_completion(
    messages: List[Dict],
    model: Optional[str] = None,
    json_mode: bool = False,
    temperature: float = 0.7,
) -> str:
    """Get chat completion from OpenAI."""
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ApiKeyRequiredError("OpenAI API key required")
    
    model = model or get_request_model() or DEFAULT_MODEL
    client = AsyncOpenAI(api_key=key)
    
    kwargs = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    
    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message.content


# =============================================================================
# MAIN FUNCTIONS
# =============================================================================

async def generate_cli_objectives(
    challenge: Dict,
    company_name: str,
    industry: str,
    business_context: str,
    diagram_data: Optional[Dict] = None,
    diagram_services: Optional[List[str]] = None,
    user_level: str = "intermediate",
    objective_count: int = 3,
    model: Optional[str] = None,
) -> CLIObjectivesSet:
    """
    Generate CLI objectives for a challenge.
    
    Args:
        challenge: Challenge dict with id, title, description, success_criteria
        company_name: Business name
        industry: Business industry
        business_context: Scenario description
        diagram_data: User's diagram (optional)
        diagram_services: Services in diagram (optional, extracted if not provided)
        user_level: User skill level
        objective_count: Number of objectives to generate
        model: Optional model override
    
    Returns:
        CLIObjectivesSet with objectives tailored to their architecture
    """
    # Extract services from diagram if not provided
    if not diagram_services:
        diagram_services = _extract_diagram_services(diagram_data)
    
    # If still no services, use challenge's relevant services
    if not diagram_services:
        diagram_services = challenge.get("aws_services_relevant", ["EC2", "VPC", "S3"])
    
    # Build prompt
    prompt = CLI_OBJECTIVES_PROMPT.format(
        challenge_title=challenge.get("title", ""),
        challenge_description=challenge.get("description", ""),
        success_criteria=", ".join(challenge.get("success_criteria", [])),
        company_name=company_name,
        industry=industry,
        business_context=business_context,
        diagram_services=", ".join(diagram_services),
        user_level=user_level,
        objective_count=objective_count,
    )
    
    messages = [
        {"role": "system", "content": "You are an AWS CLI expert generating practical hands-on objectives. Return only valid JSON."},
        {"role": "user", "content": prompt},
    ]
    
    response = await _chat_completion(messages, model=model, json_mode=True)
    data = json.loads(response)
    
    # Build objectives
    objectives = []
    total_points = 0
    
    for obj in data.get("objectives", []):
        objective = CLIObjective(
            id=obj.get("id", str(uuid.uuid4())),
            description=obj.get("description", ""),
            command_pattern=obj.get("command_pattern", ""),
            example_command=obj.get("example_command", ""),
            hint=obj.get("hint"),
            points=obj.get("points", 20),
            service=obj.get("service", ""),
            difficulty=obj.get("difficulty", user_level),
        )
        objectives.append(objective)
        total_points += objective.points
    
    return CLIObjectivesSet(
        challenge_id=challenge.get("id", ""),
        challenge_title=challenge.get("title", ""),
        objectives=objectives,
        total_points=total_points,
        estimated_time_minutes=data.get("estimated_time_minutes", 10),
        context_message=data.get("context_message", "Complete the following CLI tasks to deploy your architecture."),
    )


async def validate_cli_command(
    command: str,
    command_output: str,
    objectives: List[CLIObjective],
    model: Optional[str] = None,
) -> CLICommandResult:
    """
    Validate if a CLI command completes any objective.
    
    Args:
        command: The command user executed
        command_output: Simulated output from the command
        objectives: List of objectives to check against
        model: Optional model override
    
    Returns:
        CLICommandResult with validation result
    """
    # Convert objectives to JSON for prompt
    objectives_json = json.dumps([
        {
            "id": obj.id,
            "description": obj.description,
            "command_pattern": obj.command_pattern,
            "points": obj.points,
        }
        for obj in objectives
    ], indent=2)
    
    prompt = CLI_VALIDATE_PROMPT.format(
        objectives_json=objectives_json,
        user_command=command,
        command_output=command_output,
    )
    
    messages = [
        {"role": "system", "content": "You are validating AWS CLI commands against objectives. Return only valid JSON."},
        {"role": "user", "content": prompt},
    ]
    
    response = await _chat_completion(messages, model=model, json_mode=True, temperature=0.3)
    data = json.loads(response)
    
    return CLICommandResult(
        command=command,
        is_valid=data.get("is_valid", False),
        objective_id=data.get("objective_id"),
        feedback=data.get("feedback", ""),
        points_earned=data.get("points_earned", 0),
    )


def calculate_cli_score(objectives: List[Dict]) -> int:
    """Calculate CLI test score as percentage."""
    if not objectives:
        return 0
    
    completed = sum(1 for obj in objectives if obj.get("completed", False))
    return int((completed / len(objectives)) * 100)
