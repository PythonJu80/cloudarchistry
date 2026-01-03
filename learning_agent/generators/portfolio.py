"""
Portfolio Generator
====================
AI-powered portfolio content generation from completed challenges.
Analyzes diagram, CLI commands, and scenario context to generate:
- Solution summary
- Key architectural decisions
- Compliance achievements
"""
import json
import logging
from typing import Dict, Any, List, Optional

from models.portfolio import (
    GeneratePortfolioRequest,
    PortfolioContent,
)

logger = logging.getLogger(__name__)


PORTFOLIO_GENERATION_PROMPT = """You are a technical writer creating a professional AWS architecture portfolio for a cloud engineer to present to potential employers or clients.

## Project Context
**Client:** {company_name}
**Industry:** {industry}
**Project:** {scenario_title}
**Business Challenge:** {business_context}

**Technical Requirements:**
{technical_requirements}

**Compliance Requirements:**
{compliance_requirements}

## Architecture Implemented
The engineer designed and implemented an architecture using these AWS services:
{services_used}

**Infrastructure Overview:**
{architecture_structure}

## Engineer's Demonstrated Expertise (from technical discussion)
{proficiency_summary}

## Hands-On CLI Implementation
{cli_summary}

## Your Task
Create a PROFESSIONAL PORTFOLIO that this engineer can present to employers or clients. This should read like a case study or project portfolio - NOT a test results page.

Write as if the engineer actually completed this project for a real client. The portfolio should:
- Present the work as a completed consulting engagement or project
- Highlight the engineer's technical decisions and problem-solving
- Demonstrate business value delivered to the client
- Show depth of AWS knowledge through specific implementation details
- EXPLICITLY incorporate the demonstrated expertise and CLI implementation details into the technical highlights

DO NOT include:
- Scores, percentages, or test results
- Language like "candidate", "challenge", "assessment", or "test"
- Any indication this was a training exercise

Return JSON with exactly these fields:
{{
  "title": "Professional project title (e.g., 'Enterprise E-Commerce Platform Migration for {company_name}')",
  "solutionSummary": "3-4 paragraphs written in first person ('I designed...', 'My approach was...') describing the architecture, key technical decisions, and business outcomes. Include specific details from the demonstrated expertise section to show depth of knowledge.",
  "keyDecisions": ["4-6 architectural decisions framed as 'Implemented X to achieve Y' or 'Selected X over Y because...' - specific technical choices with business justification"],
  "complianceAchieved": ["Compliance standards and security measures implemented in the solution"],
  "awsServicesUsed": ["AWS services implemented in the solution"],
  "technicalHighlights": ["5-7 specific technical accomplishments - MUST include items from both the 'Demonstrated Expertise' section (showing conceptual understanding) AND the 'CLI Implementation' section (showing hands-on skills). Format as concrete achievements like 'Provisioned Lambda functions with strict payload validation and custom error handling' or 'Demonstrated deep understanding of multi-AZ deployment strategies for high availability'"]
}}

IMPORTANT for technicalHighlights:
- Include at least 2-3 items derived from the engineer's demonstrated expertise/competencies
- Include at least 2-3 items derived from the CLI implementation work
- Frame everything as professional accomplishments, not test results

Write with confidence and specificity. This portfolio represents real work the engineer can discuss in interviews."""


def _extract_services_from_diagram(diagram: Dict[str, Any]) -> List[str]:
    """Extract AWS service names from diagram nodes."""
    services = []
    nodes = diagram.get("nodes", [])
    
    for node in nodes:
        node_type = node.get("type", "")
        data = node.get("data", {})
        
        # Skip container nodes (VPC, subnet)
        if node_type in ["vpc", "subnet"]:
            continue
        
        # Get service label
        label = data.get("label", "")
        service_id = data.get("serviceId", "")
        
        if label and label not in services:
            services.append(label)
        elif service_id and service_id not in services:
            services.append(service_id)
    
    return services


def _describe_architecture_structure(diagram: Dict[str, Any]) -> str:
    """Generate a text description of the architecture structure."""
    nodes = diagram.get("nodes", [])
    edges = diagram.get("edges", [])
    
    if not nodes:
        return "No architecture diagram provided."
    
    # Count node types
    vpcs = [n for n in nodes if n.get("type") == "vpc"]
    subnets = [n for n in nodes if n.get("type") == "subnet"]
    resources = [n for n in nodes if n.get("type") not in ["vpc", "subnet"]]
    
    # Categorize subnets
    public_subnets = [s for s in subnets if s.get("data", {}).get("subnetType") == "public"]
    private_subnets = [s for s in subnets if s.get("data", {}).get("subnetType") == "private"]
    
    description_parts = []
    
    if vpcs:
        description_parts.append(f"- {len(vpcs)} VPC(s) for network isolation")
    
    if public_subnets or private_subnets:
        subnet_desc = []
        if public_subnets:
            subnet_desc.append(f"{len(public_subnets)} public")
        if private_subnets:
            subnet_desc.append(f"{len(private_subnets)} private")
        description_parts.append(f"- {' and '.join(subnet_desc)} subnet(s) for proper network segmentation")
    
    if resources:
        description_parts.append(f"- {len(resources)} AWS service(s) deployed")
    
    if edges:
        description_parts.append(f"- {len(edges)} connection(s) between services")
    
    return "\n".join(description_parts) if description_parts else "Basic architecture with minimal structure."


def _summarize_cli_progress(cli_progress: Optional[Dict[str, Any]], cli_objectives: Optional[Dict[str, Any]] = None) -> str:
    """Generate a summary of hands-on implementation work."""
    parts = []
    
    # Handle new CLI objectives format
    if cli_objectives:
        objectives = cli_objectives.get("objectives", [])
        completed = [o for o in objectives if o.get("completed")]
        
        if completed:
            parts.append("**Infrastructure Provisioned via AWS CLI:**")
            for obj in completed:
                service = obj.get("service", "AWS")
                desc = obj.get("description", "")
                parts.append(f"- {desc} ({service})")
    
    # Handle legacy CLI progress format
    if cli_progress:
        resources = cli_progress.get("resourcesCreated", {})
        if resources:
            if not parts:
                parts.append("**Resources Provisioned:**")
            for service, ids in resources.items():
                parts.append(f"- Deployed {len(ids)} {service.upper()} resource(s)")
    
    return "\n".join(parts) if parts else "Infrastructure deployed via AWS Console and IaC."


def _summarize_proficiency_test(proficiency_test: Optional[Dict[str, Any]]) -> str:
    """Generate a summary of demonstrated expertise from proficiency assessment."""
    if not proficiency_test:
        return "No additional expertise documentation available."
    
    summary = proficiency_test.get("summary", "")
    strengths = proficiency_test.get("strengths", [])
    
    parts = []
    
    if summary:
        parts.append(f"**Technical Understanding:** {summary}")
    
    if strengths:
        parts.append("**Demonstrated Competencies:**")
        for strength in strengths:
            parts.append(f"- {strength}")
    
    return "\n".join(parts) if parts else "No additional expertise documentation available."


async def generate_portfolio_content(
    request: GeneratePortfolioRequest,
    openai_client,
    model: str = "gpt-4.1"
) -> PortfolioContent:
    """
    Generate portfolio content from completed challenge data.
    
    Args:
        request: The portfolio generation request with all context
        openai_client: AsyncOpenAI client
        model: Model to use for generation
        
    Returns:
        PortfolioContent with AI-generated fields
    """
    # Extract data from request
    diagram = request.diagram or {"nodes": [], "edges": []}
    cli_progress = request.cliProgress.model_dump() if request.cliProgress else None
    proficiency_test = request.proficiencyTest.model_dump() if request.proficiencyTest else None
    cli_objectives = request.cliObjectives.model_dump() if request.cliObjectives else None
    scenario = request.scenarioContext
    location = request.locationContext
    
    # Build context strings
    services_used = _extract_services_from_diagram(diagram)
    architecture_structure = _describe_architecture_structure(diagram)
    cli_summary = _summarize_cli_progress(cli_progress, cli_objectives)
    proficiency_summary = _summarize_proficiency_test(proficiency_test)
    
    # Format requirements
    tech_reqs = "\n".join([f"- {r}" for r in (scenario.technicalRequirements if scenario else [])]) or "- Not specified"
    compliance_reqs = "\n".join([f"- {r}" for r in (scenario.complianceRequirements if scenario else [])]) or "- Not specified"
    
    # Build the prompt - no scores, just professional context
    prompt = PORTFOLIO_GENERATION_PROMPT.format(
        company_name=location.company if location else "Unknown Company",
        industry=location.industry if location else "Technology",
        scenario_title=scenario.scenarioTitle if scenario else "Cloud Architecture Project",
        business_context=scenario.businessContext if scenario else "Design and implement a cloud architecture solution.",
        technical_requirements=tech_reqs,
        compliance_requirements=compliance_reqs,
        services_used=", ".join(services_used) if services_used else "Various AWS services",
        architecture_structure=architecture_structure,
        proficiency_summary=proficiency_summary,
        cli_summary=cli_summary,
    )
    
    logger.info(f"Generating portfolio content for profile {request.profileId}")
    
    try:
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are an AWS Solutions Architect creating professional portfolio documentation. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        result = json.loads(content)
        
        # Ensure awsServicesUsed includes what we detected
        detected_services = set(services_used)
        ai_services = set(result.get("awsServicesUsed", []))
        all_services = list(detected_services.union(ai_services))
        
        return PortfolioContent(
            title=result["title"],
            solutionSummary=result["solutionSummary"],
            keyDecisions=result["keyDecisions"],
            complianceAchieved=result["complianceAchieved"],
            awsServicesUsed=all_services,
            technicalHighlights=result["technicalHighlights"],
        )
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse portfolio generation response: {e}")
        raise ValueError(f"AI response was not valid JSON: {e}")
    except KeyError as e:
        logger.error(f"AI response missing required field: {e}")
        raise ValueError(f"AI response missing required field: {e}")
    except Exception as e:
        logger.error(f"Portfolio generation failed: {e}")
        raise
