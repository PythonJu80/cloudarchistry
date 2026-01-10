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


PITCH_DECK_PROMPT = """You are a senior cloud solutions consultant creating a comprehensive, professional pitch deck for a prospective client.

Based on the completed architecture work, create an 8-slide pitch deck that the engineer can present to this business to win their cloud migration project. This should be detailed enough to stand alone as a complete business proposal.

## Client Information
**Company:** {company_name}
**Industry:** {industry}
**Business Challenge:** {business_context}

## Proposed Solution
**AWS Services:** {services_used}
**Architecture Summary:** {solution_summary}
**Key Benefits:** {key_decisions}

## Your Task
Generate a JSON response with exactly 8 slides for a comprehensive professional pitch deck:

{{
  "slides": [
    {{
      "badge": "AWS ARCHITECTURE PROPOSAL",
      "title": "Cloud Migration Proposal for {company_name}",
      "subtitle": "Modernizing {industry} Infrastructure with AWS",
      "content1": "{company_name}",
      "content2": "Prepared by [Your Name], AWS Solutions Architect",
      "content3": "Transforming infrastructure for scalability, security, and cost efficiency",
      "footer": ""
    }},
    {{
      "badge": "THE CHALLENGE",
      "title": "Current Infrastructure Limitations",
      "subtitle": "Understanding the pain points holding {company_name} back",
      "content1": "• [Specific pain point 1 - be detailed: e.g., 'Legacy on-premises servers experiencing 15+ hours of unplanned downtime monthly, resulting in lost revenue and customer trust']",
      "content2": "• [Specific pain point 2 - e.g., 'Manual scaling processes taking 2-3 days to provision new capacity, missing critical business opportunities during peak demand']",
      "content3": "• [Specific pain point 3 - e.g., 'Security vulnerabilities from outdated infrastructure putting sensitive customer data at risk of breach and regulatory non-compliance']",
      "footer": "These challenges are costing {company_name} an estimated $XXX,XXX annually in lost productivity, missed opportunities, and operational overhead"
    }},
    {{
      "badge": "THE SOLUTION",
      "title": "AWS-Powered Architecture",
      "subtitle": "[3-4 sentence comprehensive summary of the proposed solution, its architecture approach, and transformative benefits for the business]",
      "content1": "Core AWS Services: [List primary compute/database services] | Supporting Services: [List networking/security services]",
      "content2": "✓ [Key benefit 1 with metric] | ✓ [Key benefit 2 with metric]",
      "content3": "✓ [Key benefit 3 with metric] | ✓ [Key benefit 4 with metric]",
      "footer": "This architecture delivers enterprise-grade reliability with startup-level agility"
    }},
    {{
      "badge": "ARCHITECTURE DEEP DIVE",
      "title": "Technical Architecture Overview",
      "subtitle": "How the AWS services work together to solve {company_name}'s challenges",
      "content1": "**Compute Layer:** [Describe compute strategy - e.g., 'Auto-scaling EC2 instances behind Application Load Balancer for high availability and automatic capacity management']",
      "content2": "**Data Layer:** [Describe data strategy - e.g., 'Multi-AZ RDS deployment with automated backups and read replicas for performance and disaster recovery']",
      "content3": "**Security Layer:** [Describe security strategy - e.g., 'VPC with public/private subnet isolation, WAF protection, and IAM least-privilege access controls']",
      "footer": "Built following AWS Well-Architected Framework best practices"
    }},
    {{
      "badge": "SECURITY & COMPLIANCE",
      "title": "Enterprise-Grade Security",
      "subtitle": "Protecting {company_name}'s data and meeting regulatory requirements",
      "content1": "• **Data Protection:** Encryption at rest (KMS) and in transit (TLS 1.3), automated key rotation, secure secrets management",
      "content2": "• **Access Control:** IAM roles with least-privilege, MFA enforcement, CloudTrail audit logging, Security Hub monitoring",
      "content3": "• **Compliance Ready:** Architecture designed for [relevant compliance - HIPAA/SOC2/GDPR/PCI-DSS] with automated compliance checks",
      "footer": "Security is built-in, not bolted-on"
    }},
    {{
      "badge": "IMPLEMENTATION ROADMAP",
      "title": "3-Phase Delivery Plan",
      "subtitle": "Phase 1: Foundation & Setup (Weeks 1-3)",
      "content1": "Phase 2: Migration & Integration (Weeks 4-8) - [Describe migration approach: lift-and-shift, re-platform, or re-architect strategy with specific milestones]",
      "content2": "Phase 3: Optimization & Handover (Weeks 9-12) - [Describe optimization: performance tuning, cost optimization, documentation, and team training]",
      "content3": "**Quick Wins (Week 1):** [3 immediate improvements that show value fast - e.g., 'Automated backups | Monitoring dashboards | Security hardening']",
      "footer": "Total Timeline: 10-12 Weeks | Minimal business disruption with parallel running"
    }},
    {{
      "badge": "INVESTMENT & ROI",
      "title": "Cost Analysis & Return on Investment",
      "subtitle": "Monthly: $X,XXX - $X,XXX | Annual: $XX,XXX - $XX,XXX",
      "content1": "**Cost Breakdown:** Compute: XX% | Storage: XX% | Data Transfer: XX% | Management: XX% — Includes Reserved Instance savings and Savings Plans optimization",
      "content2": "**Projected Savings:** XX% reduction in infrastructure costs | XX% reduction in operational overhead | XX hours/month saved on maintenance",
      "content3": "**ROI Timeline:** Break-even in X months | Year 1 net savings: $XX,XXX | 3-year TCO reduction: XX%",
      "footer": "Pay only for what you use with full cost visibility and optimization recommendations"
    }},
    {{
      "badge": "NEXT STEPS",
      "title": "Let's Get Started",
      "subtitle": "Your path to cloud transformation",
      "content1": "1. **Discovery Call** (This Week) - Deep dive into your current infrastructure and requirements",
      "content2": "2. **Detailed Proposal** (Week 2) - Finalized architecture, timeline, and investment breakdown",
      "content3": "3. **Kickoff** (Week 3) - Begin Phase 1 implementation with your dedicated cloud team",
      "footer": "Let's transform {company_name}'s infrastructure together — Contact: [your-email] | Schedule: [calendar-link]"
    }}
  ]
}}

IMPORTANT:
- Be SPECIFIC and use real details from the architecture - no generic placeholders
- Fill in ALL content fields with substantive, detailed information
- Make cost estimates realistic based on industry: Healthcare/Finance: $5,000-15,000/mo, E-commerce: $2,000-8,000/mo, Startup: $500-2,000/mo
- Include specific metrics and percentages where possible (e.g., "99.99% uptime", "40% cost reduction")
- Frame everything as business value and outcomes
- Use professional, confident, consultative language
- The deck should be comprehensive enough to present to C-level executives
- Return ONLY valid JSON"""


def _extract_services_from_diagram(diagram: Dict[str, Any]) -> List[str]:
    """Extract AWS service names from diagram nodes, filtering out non-AWS items."""
    services = []
    nodes = diagram.get("nodes", [])
    
    # Non-AWS items to exclude (actors, generic items, etc.)
    excluded_labels = {
        "users", "user", "client", "clients", "customer", "customers",
        "internet", "on-premises", "on-premise", "datacenter", "data center",
        "mobile", "browser", "device", "devices", "application", "app",
        "external", "third party", "3rd party", "partner", "partners",
    }
    
    for node in nodes:
        node_type = node.get("type", "")
        data = node.get("data", {})
        
        # Skip container nodes (VPC, subnet)
        if node_type in ["vpc", "subnet"]:
            continue
        
        # Get service label and serviceId
        label = data.get("label", "")
        service_id = data.get("serviceId", "")
        
        # Skip if it's a non-AWS item
        if label.lower() in excluded_labels:
            continue
        
        # Only include if it has a valid AWS serviceId or looks like an AWS service
        if service_id and label and label not in services:
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
        
        # Use only services detected from the user's diagram (not AI suggestions)
        all_services = list(services_used)
        
        # Calculate live pricing estimate based on services used
        from services.aws_pricing import estimate_architecture_cost
        pricing_estimate = estimate_architecture_cost(all_services)
        logger.info(f"Pricing estimate: ${pricing_estimate['total_monthly']}/mo for {len(all_services)} services")
        
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
            pricing_estimate=pricing_estimate,
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
    pricing_estimate: Optional[Dict[str, Any]] = None,
) -> Optional[PitchDeckData]:
    """Generate pitch deck slides for business presentation."""
    from datetime import datetime
    
    # Build pricing context for the prompt
    pricing_context = ""
    if pricing_estimate:
        monthly = pricing_estimate.get("total_monthly", 0)
        yearly = pricing_estimate.get("total_yearly", 0)
        breakdown = pricing_estimate.get("breakdown", [])
        
        pricing_context = f"""
## REAL PRICING DATA (Use these exact figures)
**Estimated Monthly Cost:** ${monthly:,.2f}
**Estimated Yearly Cost:** ${yearly:,.2f}

**Cost Breakdown by Service:**
"""
        for item in breakdown[:8]:  # Top 8 services
            pricing_context += f"- {item['service']}: ${item['monthly_usd']:.2f}/month\n"
        
        pricing_context += f"""
**Note:** {pricing_estimate.get('disclaimer', 'Estimates based on typical usage patterns.')}

IMPORTANT: Use the EXACT pricing figures above in the Investment & ROI slide. Do NOT make up different numbers.
"""
    
    try:
        prompt = PITCH_DECK_PROMPT.format(
            company_name=company_name,
            industry=industry,
            business_context=business_context,
            services_used=services_used,
            solution_summary=solution_summary,
            key_decisions=key_decisions,
        )
        
        # Inject pricing data into prompt
        if pricing_context:
            prompt = prompt.replace("## Your Task", f"{pricing_context}\n## Your Task")
        
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
        
        if len(slides) >= 5:  # Accept 5+ slides (we request 8 but accept fewer for backwards compatibility)
            return PitchDeckData(
                authorName="Cloud Architect",
                date=datetime.now().strftime("%B %Y"),
                slides=slides,
            )
        else:
            logger.warning(f"Pitch deck generation returned {len(slides)} slides, expected 8")
            return None
            
    except Exception as e:
        logger.error(f"Pitch deck generation failed: {e}")
        return None
