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


PORTFOLIO_GENERATION_PROMPT = """You are an AWS Solutions Architect reviewing a candidate's completed cloud architecture challenge.

## Challenge Context
**Company:** {company_name}
**Industry:** {industry}
**Scenario:** {scenario_title}
**Business Context:** {business_context}

**Technical Requirements:**
{technical_requirements}

**Compliance Requirements:**
{compliance_requirements}

## Candidate's Solution

### Architecture Diagram
The candidate designed an architecture with these AWS services:
{services_used}

**Architecture Structure:**
{architecture_structure}

### CLI Proficiency
{cli_summary}

### Performance
- Score: {score}/{max_score} ({score_percent}%)
- Completion Time: {completion_time} minutes
- Hints Used: {hints_used}

## Your Task
Generate professional portfolio content that showcases this candidate's work. Be specific about THEIR solution, not generic AWS best practices.

Return JSON with exactly these fields:
{{
  "title": "A compelling portfolio title (e.g., 'High-Availability Banking Platform for HSBC')",
  "solutionSummary": "2-3 paragraphs describing what the candidate built, why they made key choices, and how it addresses the business requirements. Be specific to their actual architecture.",
  "keyDecisions": ["List 4-6 specific architectural decisions the candidate made and WHY they were good choices for this scenario"],
  "complianceAchieved": ["List compliance standards their architecture helps achieve based on the services used and requirements"],
  "awsServicesUsed": ["List of AWS services used in their solution"]
}}

Focus on:
1. What makes THIS solution appropriate for THIS business
2. Specific architectural patterns they implemented
3. How their choices address the stated requirements
4. Real compliance implications of their service choices"""


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


def _summarize_cli_progress(cli_progress: Optional[Dict[str, Any]]) -> str:
    """Generate a summary of CLI proficiency."""
    if not cli_progress:
        return "CLI practice not completed for this challenge."
    
    total = cli_progress.get("totalCommands", 0)
    correct = cli_progress.get("correctCommands", 0)
    score = cli_progress.get("cliScore", 0)
    resources = cli_progress.get("resourcesCreated", {})
    objectives = cli_progress.get("objectivesCompleted", [])
    
    if total == 0:
        return "CLI practice not attempted."
    
    accuracy = (correct / total * 100) if total > 0 else 0
    
    parts = [
        f"- Executed {total} CLI commands with {accuracy:.0f}% accuracy",
        f"- CLI proficiency score: {score}/100",
    ]
    
    if resources:
        resource_list = []
        for service, ids in resources.items():
            resource_list.append(f"{len(ids)} {service.upper()}")
        parts.append(f"- Resources created: {', '.join(resource_list)}")
    
    if objectives:
        parts.append(f"- Completed {len(objectives)} CLI objectives")
    
    return "\n".join(parts)


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
    scenario = request.scenarioContext
    location = request.locationContext
    
    # Build context strings
    services_used = _extract_services_from_diagram(diagram)
    architecture_structure = _describe_architecture_structure(diagram)
    cli_summary = _summarize_cli_progress(cli_progress)
    
    # Format requirements
    tech_reqs = "\n".join([f"- {r}" for r in (scenario.technicalRequirements if scenario else [])]) or "- Not specified"
    compliance_reqs = "\n".join([f"- {r}" for r in (scenario.complianceRequirements if scenario else [])]) or "- Not specified"
    
    # Calculate score percentage
    score_percent = round((request.challengeScore / request.maxScore * 100)) if request.maxScore > 0 else 0
    
    # Build the prompt
    prompt = PORTFOLIO_GENERATION_PROMPT.format(
        company_name=location.company if location else "Unknown Company",
        industry=location.industry if location else "Technology",
        scenario_title=scenario.scenarioTitle if scenario else "Cloud Architecture Challenge",
        business_context=scenario.businessContext if scenario else "Build a cloud architecture solution.",
        technical_requirements=tech_reqs,
        compliance_requirements=compliance_reqs,
        services_used=", ".join(services_used) if services_used else "No services identified",
        architecture_structure=architecture_structure,
        cli_summary=cli_summary,
        score=request.challengeScore,
        max_score=request.maxScore,
        score_percent=score_percent,
        completion_time=request.completionTimeMinutes,
        hints_used=request.hintsUsed,
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
            title=result.get("title", f"{location.company if location else 'Cloud'} Architecture Portfolio"),
            solutionSummary=result.get("solutionSummary", ""),
            keyDecisions=result.get("keyDecisions", []),
            complianceAchieved=result.get("complianceAchieved", []),
            awsServicesUsed=all_services,
        )
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse portfolio generation response: {e}")
        # Return basic content on parse failure
        return PortfolioContent(
            title=f"{location.company if location else 'Cloud'} Architecture Portfolio",
            solutionSummary=f"Completed cloud architecture challenge with a score of {score_percent}%.",
            keyDecisions=["Architecture designed to meet business requirements"],
            complianceAchieved=scenario.complianceRequirements if scenario else [],
            awsServicesUsed=services_used,
        )
    except Exception as e:
        logger.error(f"Portfolio generation failed: {e}")
        raise
