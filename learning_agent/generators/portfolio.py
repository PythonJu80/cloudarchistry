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
    PitchDeckData,
    PitchDeckSlide,
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

## Architecture Building Journey
{placement_journey_summary}

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


PITCH_DECK_PROMPT = """You are a cloud solutions consultant creating a professional pitch deck for a prospective client.

Based on the completed architecture work, create a 5-slide pitch deck that the engineer can present to this business to win their cloud migration project.

## Client Information
**Company:** {company_name}
**Industry:** {industry}
**Business Challenge:** {business_context}

## Proposed Solution
**AWS Services:** {services_used}
**Architecture Summary:** {solution_summary}
**Key Benefits:** {key_decisions}

## Your Task
Generate a JSON response with exactly 5 slides for a professional pitch deck:

{{
  "slides": [
    {{
      "badge": "AWS ARCHITECTURE PROPOSAL",
      "title": "Cloud Migration Proposal for {company_name}",
      "subtitle": "Modernizing {industry} Infrastructure with AWS",
      "content1": "{company_name}",
      "content2": "",
      "content3": "",
      "footer": ""
    }},
    {{
      "badge": "THE CHALLENGE",
      "title": "Current Infrastructure Limitations",
      "subtitle": "",
      "content1": "• [Specific pain point 1 with business impact - be detailed and realistic]",
      "content2": "• [Specific pain point 2 with business impact - be detailed and realistic]",
      "content3": "• [Specific pain point 3 with business impact - be detailed and realistic]",
      "footer": "These challenges cost {company_name} in [specific measurable ways - lost revenue, inefficiency, etc.]"
    }},
    {{
      "badge": "THE SOLUTION",
      "title": "AWS-Powered Architecture",
      "subtitle": "[2-3 sentence summary of the proposed solution and its key benefits]",
      "content1": "AWS Services: [List all services from the architecture]",
      "content2": "[Key benefit 1] | [Key benefit 2]",
      "content3": "[Key benefit 3] | [Key benefit 4]",
      "footer": ""
    }},
    {{
      "badge": "IMPLEMENTATION",
      "title": "3-Phase Roadmap",
      "subtitle": "[Phase 1 description - Foundation work] (2-3 weeks)",
      "content1": "[Phase 2 description - Migration work] (4-6 weeks)",
      "content2": "[Phase 3 description - Optimization] (ongoing)",
      "content3": "[Quick win 1] | [Quick win 2] | [Quick win 3]",
      "footer": "Total Timeline: 8-12 Weeks"
    }},
    {{
      "badge": "INVESTMENT & NEXT STEPS",
      "title": "Projected Costs & ROI",
      "subtitle": "Monthly: $X,XXX | Yearly: $XX,XXX",
      "content1": "Projected ROI: XX% cost reduction in Year 1",
      "content2": "",
      "content3": "",
      "footer": "Let's transform {company_name}'s infrastructure together"
    }}
  ]
}}

IMPORTANT:
- Be specific and use real details from the architecture
- Make cost estimates realistic (small business: $500-2000/mo, medium: $2000-10000/mo, enterprise: $10000+/mo)
- Frame everything as business value
- Use professional, confident language
- Return ONLY valid JSON"""


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


def _summarize_placement_journey(placement_journey: Optional[Dict[str, Any]]) -> str:
    """Generate a summary of the user's learning journey during diagram building.
    
    This captures:
    - Pro tips shown and whether the user corrected their mistakes
    - Final placement issues that remained
    - Overall placement accuracy
    """
    if not placement_journey:
        return ""
    
    parts = []
    stats = placement_journey.get("stats", {})
    placement_history = placement_journey.get("placementHistory", []) or []
    placement_issues = placement_journey.get("placementIssues", []) or []
    
    # Calculate accuracy
    total = stats.get("totalPlacements", 0)
    correct = stats.get("correctPlacements", 0)
    incorrect = stats.get("incorrectAttempts", 0)
    
    if total > 0:
        accuracy = round((correct / total) * 100)
        parts.append(f"**Architecture Building Process:**")
        parts.append(f"- Made {total} placement decisions with {accuracy}% accuracy")
        
        if incorrect > 0:
            # Find unique corrections made (incorrect placements that were later corrected)
            incorrect_tips = [p.get("proTip") for p in placement_history if not p.get("isValid") and p.get("proTip")]
            unique_tips = list(set(incorrect_tips))[:3]  # Limit to 3 examples
            
            if unique_tips:
                parts.append(f"- Received and acted on {len(unique_tips)} architectural guidance tips:")
                for tip in unique_tips:
                    # Clean up the tip for display
                    clean_tip = tip.replace("🏗️ ", "").replace("💡 ", "").replace("🌐 ", "").replace("☁️ ", "")
                    parts.append(f"  • {clean_tip[:100]}..." if len(clean_tip) > 100 else f"  • {clean_tip}")
    
    # Final issues (things that weren't corrected)
    final_issues = stats.get("finalPlacementIssues", 0)
    if final_issues > 0 and placement_issues:
        error_issues = [i for i in placement_issues if i.get("severity") == "error"]
        warning_issues = [i for i in placement_issues if i.get("severity") == "warning"]
        
        if error_issues:
            parts.append(f"- {len(error_issues)} placement(s) flagged for review in final audit")
    
    return "\n".join(parts) if parts else ""


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
    placement_journey_summary = _summarize_placement_journey(
        request.placementJourney.model_dump() if request.placementJourney else None
    )
    
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
        placement_journey_summary=placement_journey_summary or "Diagram built with standard placement workflow.",
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
        
        # Now generate pitch deck content (second OpenAI call)
        pitch_deck = await _generate_pitch_deck(
            openai_client=openai_client,
            model=model,
            company_name=location.company if location else "Unknown Company",
            industry=location.industry if location else "Technology",
            business_context=scenario.businessContext if scenario else "Cloud architecture solution",
            services_used=", ".join(all_services) if all_services else "Various AWS services",
            solution_summary=result["solutionSummary"],
            key_decisions=", ".join(result["keyDecisions"][:3]) if result.get("keyDecisions") else "",
        )
        
        return PortfolioContent(
            title=result["title"],
            solutionSummary=result["solutionSummary"],
            keyDecisions=result["keyDecisions"],
            complianceAchieved=result["complianceAchieved"],
            awsServicesUsed=all_services,
            technicalHighlights=result["technicalHighlights"],
            pitchDeck=pitch_deck,
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


async def _generate_pitch_deck(
    openai_client,
    model: str,
    company_name: str,
    industry: str,
    business_context: str,
    services_used: str,
    solution_summary: str,
    key_decisions: str,
) -> Optional[PitchDeckData]:
    """Generate pitch deck slides for business presentation."""
    from datetime import datetime
    
    try:
        prompt = PITCH_DECK_PROMPT.format(
            company_name=company_name,
            industry=industry,
            business_context=business_context,
            services_used=services_used,
            solution_summary=solution_summary,
            key_decisions=key_decisions,
        )
        
        response = await openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a cloud solutions consultant creating pitch decks. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        result = json.loads(content)
        
        slides = []
        for slide_data in result.get("slides", []):
            slides.append(PitchDeckSlide(
                badge=slide_data.get("badge", ""),
                title=slide_data.get("title", ""),
                subtitle=slide_data.get("subtitle", ""),
                content1=slide_data.get("content1", ""),
                content2=slide_data.get("content2", ""),
                content3=slide_data.get("content3", ""),
                footer=slide_data.get("footer", ""),
            ))
        
        if len(slides) >= 5:
            return PitchDeckData(
                authorName="Cloud Architect",
                date=datetime.now().strftime("%B %Y"),
                slides=slides,
            )
        else:
            logger.warning(f"Pitch deck generation returned {len(slides)} slides, expected 5")
            return None
            
    except Exception as e:
        logger.error(f"Pitch deck generation failed: {e}")
        return None
