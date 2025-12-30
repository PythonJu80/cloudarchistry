"""
AWS Drawing Agent API
=====================
FastAPI service for AWS architecture diagram operations.
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
import logging

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from agent import AWSDrawingAgent
from bug_bounty_generator import BugBountyGenerator
import db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="AWS Drawing Agent",
    description="Specialized AI agent for AWS architecture diagrams",
    version="1.0.0"
)

# Security: Restrict CORS to trusted origins only
ALLOWED_ORIGINS = [
    "https://cloudarchistry.com",
    "https://www.cloudarchistry.com",
    "http://localhost:6060",  # Development only
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AWS Drawing Agent
ARCHITECTURES_DIR = os.getenv("ARCHITECTURES_DIR", "/app/aws_architecture_diagrams")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
agent = AWSDrawingAgent(
    architectures_dir=ARCHITECTURES_DIR,
    openai_api_key=OPENAI_API_KEY
)

# Initialize Bug Bounty Generator
bug_bounty_generator = BugBountyGenerator(openai_api_key=OPENAI_API_KEY)

# Store active challenges (in production, use Redis or database)
active_challenges = {}

# Pydantic models
class ServiceSearchRequest(BaseModel):
    query: str

class DiagramValidationRequest(BaseModel):
    diagram: Dict

class ArchitectureRequest(BaseModel):
    requirements: str

class DiagramGenerationRequest(BaseModel):
    description: str
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    certification_code: Optional[str] = None
    difficulty: Optional[str] = None  # beginner, intermediate, advanced

class BugBountyGenerateRequest(BaseModel):
    user_level: str = "intermediate"  # beginner, intermediate, advanced, expert (from AcademyUserProfile.skillLevel)
    target_cert: Optional[str] = None  # AWS certification goal (from AcademyUserProfile.targetCertification)
    scenario_type: str = "ecommerce"
    openai_api_key: Optional[str] = None
    profile_id: Optional[str] = None  # For database persistence

class BugBountyValidateRequest(BaseModel):
    challenge_id: str
    target_id: str
    bug_type: str
    severity: str
    claim: str
    evidence: List[str]
    confidence: int
    cert_code: Optional[str] = None
    user_level: Optional[str] = None
    openai_api_key: Optional[str] = None


@app.on_event("startup")
async def startup():
    """Initialize database connection on startup."""
    try:
        await db.get_pool()
        logger.info("Database connection established")
        # Clean up old abandoned challenges on startup
        cleaned = await db.cleanup_old_bug_bounty_challenges(hours_old=24)
        if cleaned > 0:
            logger.info(f"Cleaned up {cleaned} old Bug Bounty challenges on startup")
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")


@app.on_event("shutdown")
async def shutdown():
    """Close database connection on shutdown."""
    await db.close_pool()


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "aws-drawing-agent"}


@app.get("/stats")
async def get_stats():
    """Get agent statistics."""
    return agent.get_stats()


@app.get("/services")
async def list_services():
    """List all AWS services."""
    return {"services": list(agent.knowledge_base.services.values())}


@app.get("/services/{service_id}")
async def get_service(service_id: str):
    """Get detailed information about a specific AWS service."""
    service = agent.get_service_info(service_id)
    if not service:
        raise HTTPException(status_code=404, detail=f"Service '{service_id}' not found")
    return service


@app.post("/services/search")
async def search_services(request: ServiceSearchRequest):
    """Search for AWS services."""
    results = agent.search_services(request.query)
    return {"query": request.query, "results": results}


@app.get("/architectures")
async def list_architectures():
    """List all reference architectures."""
    architectures = agent.list_architectures()
    return {"architectures": architectures}


@app.get("/architectures/{arch_id}")
async def get_architecture(arch_id: str):
    """Get a specific reference architecture with diagram."""
    arch = agent.get_architecture(arch_id)
    if not arch:
        raise HTTPException(status_code=404, detail=f"Architecture '{arch_id}' not found")
    return arch


@app.post("/architectures/suggest")
async def suggest_architectures(request: ArchitectureRequest):
    """Suggest reference architectures based on requirements."""
    suggestions = agent.suggest_architecture(request.requirements)
    return {"requirements": request.requirements, "suggestions": suggestions}


@app.post("/diagrams/validate")
async def validate_diagram(request: DiagramValidationRequest):
    """Validate a diagram against AWS best practices."""
    validation = agent.validate_diagram(request.diagram)
    return validation


@app.post("/diagrams/convert")
async def convert_pptx(file_path: str):
    """Convert a PowerPoint file to React Flow format."""
    # Security: Validate path to prevent directory traversal
    ALLOWED_DIRS = ["/app/diagrams", "/app/aws_architecture_diagrams", ARCHITECTURES_DIR]
    try:
        resolved_path = Path(file_path).resolve()
        if not any(str(resolved_path).startswith(str(Path(d).resolve())) for d in ALLOWED_DIRS):
            raise HTTPException(status_code=403, detail="Access to this path is not allowed")
        if '..' in file_path or file_path.startswith('/etc') or file_path.startswith('/root'):
            raise HTTPException(status_code=403, detail="Invalid path")
    except (ValueError, OSError):
        raise HTTPException(status_code=400, detail="Invalid file path")
    
    if not resolved_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found")
    
    try:
        diagram = agent.convert_architecture(str(resolved_path))
        return diagram
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")


@app.post("/diagrams/generate")
async def generate_diagram(request: DiagramGenerationRequest):
    """
    Generate an AWS architecture diagram from text description.
    Returns BOTH the diagram AND an explanation of the architecture.
    Context-aware: Uses user's certification target and skill level.
    Requires OpenAI API key to be configured.
    """
    try:
        # Get user context if user_id and tenant_id provided
        user_context = {}
        if request.user_id and request.tenant_id:
            user_profile = await db.get_user_profile(request.user_id, request.tenant_id)
            if user_profile:
                user_context = {
                    "target_certification": user_profile.get("target_certification") or request.certification_code,
                    "skill_level": user_profile.get("skill_level", "intermediate"),
                    "level": user_profile.get("level", 1),
                }
        
        # Override with request parameters if provided
        if request.certification_code:
            user_context["target_certification"] = request.certification_code
        if request.difficulty:
            user_context["skill_level"] = request.difficulty
        
        # Enhance description with user context
        enhanced_description = request.description
        if user_context:
            context_info = []
            if user_context.get("target_certification"):
                context_info.append(f"Target certification: {user_context['target_certification']}")
            if user_context.get("skill_level"):
                context_info.append(f"Skill level: {user_context['skill_level']}")
            
            if context_info:
                enhanced_description = f"{request.description}\n\nContext: {', '.join(context_info)}"
        
        # Generate diagram WITH explanation
        result = agent.generate_diagram_with_explanation(enhanced_description)
        
        diagram = result.get("diagram", {})
        explanation = result.get("explanation", "")
        metadata = result.get("metadata", {})
        
        # Add user context to metadata
        metadata["user_context"] = user_context
        metadata["generated_from"] = request.description
        
        # Return both diagram and explanation
        return {
            "nodes": diagram.get("nodes", []),
            "edges": diagram.get("edges", []),
            "explanation": explanation,
            "metadata": metadata
        }
    except Exception as e:
        logger.error(f"Diagram generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@app.post("/bug-bounty/generate")
async def generate_bug_bounty(request: BugBountyGenerateRequest):
    """
    Generate a Bug Bounty challenge with flawed architecture and fake AWS logs.
    Returns diagram, description, AWS environment (logs, metrics, etc.), and metadata.
    Challenge is persisted to database for validation and history.
    """
    try:
        # Use provided API key or fallback to environment
        api_key = request.openai_api_key or OPENAI_API_KEY
        if not api_key:
            raise HTTPException(status_code=400, detail="OpenAI API key required")
        
        # Initialize generator with API key
        generator = BugBountyGenerator(openai_api_key=api_key)
        
        # Generate challenge (now async with knowledge base integration)
        challenge = await generator.generate_challenge(
            user_level=request.user_level,
            target_cert=request.target_cert,
            scenario_type=request.scenario_type,
        )
        
        # Prepare AWS environment for storage
        aws_env_dict = {
            "cloudwatch_logs": [log.model_dump() for log in challenge.aws_environment.cloudwatch_logs],
            "cloudwatch_metrics": {k: v.model_dump() for k, v in challenge.aws_environment.cloudwatch_metrics.items()},
            "vpc_flow_logs": challenge.aws_environment.vpc_flow_logs,
            "iam_policies": challenge.aws_environment.iam_policies,
            "cost_data": challenge.aws_environment.cost_data,
            "xray_traces": [trace.model_dump() for trace in challenge.aws_environment.xray_traces],
            "config_compliance": [rule.model_dump() for rule in challenge.aws_environment.config_compliance],
        }
        
        # Prepare hidden bugs for storage
        hidden_bugs_list = [bug.model_dump() for bug in challenge.hidden_bugs]
        
        # Save challenge to database (persists answers for later validation)
        await db.save_bug_bounty_challenge(
            challenge_id=challenge.challenge_id,
            profile_id=request.profile_id,
            user_level=challenge.user_level,
            scenario_type=request.scenario_type,
            target_cert=request.target_cert,
            description=challenge.description,
            diagram=challenge.diagram,
            aws_environment=aws_env_dict,
            hidden_bugs=hidden_bugs_list,
            bug_count=len(challenge.hidden_bugs),
            bounty_value=challenge.bounty_value,
            time_limit=challenge.time_limit,
        )
        
        # Also keep in memory for faster access during active session
        active_challenges[challenge.challenge_id] = challenge
        
        # Return challenge WITHOUT hidden bugs (those are secret!)
        return {
            "challenge_id": challenge.challenge_id,
            "diagram": challenge.diagram,
            "description": challenge.description,
            "aws_environment": aws_env_dict,
            "user_level": challenge.user_level,
            "target_cert": request.target_cert,
            "bounty_value": challenge.bounty_value,
            "time_limit": challenge.time_limit,
            "bug_count": len(challenge.hidden_bugs),
        }
    except Exception as e:
        logger.error(f"Bug Bounty generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@app.post("/bug-bounty/validate")
async def validate_bug_claim(request: BugBountyValidateRequest):
    """
    Validate a user's bug claim against the hidden bugs in the challenge.
    Fetches challenge from database if not in memory.
    Returns whether the claim is correct, points awarded, and explanation.
    """
    try:
        # Try memory first, then database
        challenge = active_challenges.get(request.challenge_id)
        challenge_data = None
        
        if not challenge:
            # Fetch from database
            challenge_data = await db.get_bug_bounty_challenge(request.challenge_id)
            if not challenge_data:
                raise HTTPException(status_code=404, detail="Challenge not found or expired")
        
        # Validate claim
        claim_data = {
            "target_id": request.target_id,
            "bug_type": request.bug_type,
            "severity": request.severity,
            "claim": request.claim,
            "evidence": request.evidence,
            "confidence": request.confidence,
        }
        
        # Use provided API key or default for LLM-based validation
        api_key = request.openai_api_key or OPENAI_API_KEY
        generator = BugBountyGenerator(openai_api_key=api_key)
        
        # Validate using either in-memory challenge or database data
        if challenge:
            result = generator.validate_claim(
                challenge, 
                claim_data,
                cert_code=request.cert_code,
                user_level=request.user_level
            )
        else:
            # Reconstruct minimal challenge object from database for validation
            from bug_bounty_generator import BugBountyChallenge, BugDefinition, AWSEnvironment
            hidden_bugs = [
                BugDefinition(**bug) for bug in challenge_data["hidden_bugs"]
            ]
            result = generator.validate_claim_from_bugs(
                hidden_bugs, 
                claim_data,
                cert_code=request.cert_code,
                user_level=request.user_level
            )
        
        # Update progress in database
        if challenge_data:
            new_bugs_found = challenge_data["bugs_found"] + (1 if result.get("correct") else 0)
            new_score = challenge_data["score"] + result.get("points", 0)
        else:
            # Get current state from memory
            new_bugs_found = result.get("correct", False) and 1 or 0
            new_score = result.get("points", 0)
        
        claim_entry = {
            "claim": claim_data,
            "result": result,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        await db.update_bug_bounty_progress(
            challenge_id=request.challenge_id,
            bugs_found=new_bugs_found,
            score=new_score,
            claim_entry=claim_entry,
        )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bug claim validation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@app.get("/bug-bounty/{challenge_id}/reveal")
async def reveal_bugs(challenge_id: str):
    """
    Reveal all bugs in a challenge (after time expires or user gives up).
    Fetches from database if not in memory.
    Returns the complete list of bugs with explanations.
    Then DELETES the challenge from database to keep it clean.
    """
    try:
        # Try memory first
        challenge = active_challenges.get(challenge_id)
        challenge_data = None
        
        if challenge:
            bugs = [bug.model_dump() for bug in challenge.hidden_bugs]
        else:
            # Fetch from database
            challenge_data = await db.get_bug_bounty_challenge(challenge_id)
            if not challenge_data:
                raise HTTPException(status_code=404, detail="Challenge not found")
            bugs = challenge_data["hidden_bugs"]
        
        # Delete from database to keep it clean
        await db.delete_bug_bounty_challenge(challenge_id)
        
        # Remove from memory too
        if challenge_id in active_challenges:
            del active_challenges[challenge_id]
        
        return {
            "challenge_id": challenge_id,
            "bugs": bugs,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bug reveal failed: {e}")
        raise HTTPException(status_code=500, detail=f"Reveal failed: {str(e)}")


@app.delete("/bug-bounty/{challenge_id}")
async def delete_challenge(challenge_id: str):
    """
    Delete a Bug Bounty challenge (user exits without finishing).
    Cleans up database and memory.
    """
    try:
        # Delete from database
        await db.delete_bug_bounty_challenge(challenge_id)
        
        # Remove from memory
        if challenge_id in active_challenges:
            del active_challenges[challenge_id]
        
        return {"success": True, "message": "Challenge deleted"}
    except Exception as e:
        logger.error(f"Challenge delete failed: {e}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


# ============================================
# PORTFOLIO DIAGRAM ENHANCEMENT
# ============================================

class PortfolioDiagramRequest(BaseModel):
    """Request to enhance a diagram for portfolio display."""
    diagram: Dict  # {nodes: [], edges: []} from ChallengeProgress.solution
    scenario_context: Optional[Dict] = None  # Business context for better enhancement
    location_context: Optional[Dict] = None  # Company/industry info
    openai_api_key: Optional[str] = None


@app.post("/portfolio/enhance-diagram")
async def enhance_portfolio_diagram(request: PortfolioDiagramRequest):
    """
    Enhance a user's architecture diagram for portfolio display.
    
    Takes the raw diagram from challenge completion and:
    1. Validates against AWS best practices
    2. Improves layout and structure
    3. Adds missing best-practice components
    4. Generates a clean SVG representation
    5. Returns enhanced diagram + explanation
    
    Called by client app when generating portfolio PDF.
    """
    try:
        api_key = request.openai_api_key or OPENAI_API_KEY
        if not api_key:
            raise HTTPException(status_code=400, detail="OpenAI API key required")
        
        diagram = request.diagram
        if not diagram or not diagram.get("nodes"):
            raise HTTPException(status_code=400, detail="Diagram with nodes required")
        
        # Step 1: Validate the diagram
        validation = agent.validate_diagram(diagram)
        
        # Step 2: Build context for enhancement
        context_parts = []
        if request.scenario_context:
            if request.scenario_context.get("scenarioTitle"):
                context_parts.append(f"Scenario: {request.scenario_context['scenarioTitle']}")
            if request.scenario_context.get("businessContext"):
                context_parts.append(f"Business: {request.scenario_context['businessContext']}")
            if request.scenario_context.get("complianceRequirements"):
                context_parts.append(f"Compliance: {', '.join(request.scenario_context['complianceRequirements'])}")
        
        if request.location_context:
            if request.location_context.get("company"):
                context_parts.append(f"Company: {request.location_context['company']}")
            if request.location_context.get("industry"):
                context_parts.append(f"Industry: {request.location_context['industry']}")
        
        context_str = "\n".join(context_parts) if context_parts else ""
        
        # Step 3: Enhance diagram using LLM
        from llm_generator import LLMDiagramGenerator
        llm_gen = LLMDiagramGenerator(api_key=api_key)
        
        # Build enhancement prompt
        enhancement_prompt = f"""Enhance this AWS architecture diagram for a professional portfolio.

Current diagram:
- Nodes: {len(diagram.get('nodes', []))}
- Edges: {len(diagram.get('edges', []))}
- Services: {[n.get('data', {}).get('label', n.get('type')) for n in diagram.get('nodes', []) if n.get('type') != 'vpc' and n.get('type') != 'subnet']}

{f"Context: {context_str}" if context_str else ""}

Validation feedback:
- Warnings: {validation.get('warnings', [])}
- Suggestions: {validation.get('suggestions', [])}

Requirements:
1. Keep all existing services the user placed
2. Ensure proper VPC/subnet structure if missing
3. Add any critical missing components (load balancers, security groups conceptually)
4. Optimize node positions for clean visual layout
5. Ensure edges connect logically

Return the enhanced React Flow diagram JSON with improved structure."""

        # Generate enhanced diagram
        result = llm_gen.generate_diagram_with_explanation(enhancement_prompt)
        enhanced_diagram = result.get("diagram", diagram)
        explanation = result.get("explanation", "")
        
        # Step 4: Extract services list for portfolio
        services_used = []
        for node in enhanced_diagram.get("nodes", []):
            label = node.get("data", {}).get("label")
            if label and node.get("type") not in ["vpc", "subnet"]:
                if label not in services_used:
                    services_used.append(label)
        
        return {
            "success": True,
            "original_diagram": diagram,
            "enhanced_diagram": enhanced_diagram,
            "explanation": explanation,
            "validation": validation,
            "services_used": services_used,
            "node_count": len(enhanced_diagram.get("nodes", [])),
            "edge_count": len(enhanced_diagram.get("edges", []))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Portfolio diagram enhancement failed: {e}")
        raise HTTPException(status_code=500, detail=f"Enhancement failed: {str(e)}")


# ============================================
# AWS CONSOLE MOCK DATA GENERATOR
# ============================================

class ConsoleGeneratorRequest(BaseModel):
    """Request to generate realistic AWS console mock data for a challenge."""
    challenge_id: str
    challenge_title: str
    challenge_description: str
    aws_services: List[str]
    success_criteria: List[str]
    company_name: str
    industry: str
    business_context: Optional[str] = None
    region: Optional[str] = "eu-west-2"
    openai_api_key: Optional[str] = None


class AWSResource(BaseModel):
    """A mock AWS resource."""
    id: str
    name: str
    type: str
    status: str  # running, stopped, available, etc.
    created_at: str
    details: Dict


class ConsoleData(BaseModel):
    """Generated AWS console mock data."""
    account_id: str
    account_alias: str
    region: str
    
    # Recently visited services with icons
    recently_visited: List[Dict]
    
    # Resource counts by service
    resource_counts: Dict[str, int]
    
    # Mock resources (VPCs, instances, buckets, etc.)
    resources: List[AWSResource]
    
    # Cost & usage
    cost_current_month: float
    cost_forecast: float
    cost_by_service: List[Dict]
    cost_trend: List[float]  # Last 7 days
    
    # Health status
    health_open_issues: int
    health_scheduled_changes: int
    health_notifications: int
    
    # IAM summary
    iam_users: int
    iam_roles: int
    iam_policies: int
    
    # Knowledge base context for services (from AWS documentation)
    service_context: Optional[Dict[str, List[Dict]]] = None


@app.post("/console/generate")
async def generate_console_data(request: ConsoleGeneratorRequest):
    """
    Generate realistic AWS console mock data based on challenge context.
    
    Creates contextual mock data including:
    - Resource counts based on services in the challenge
    - Realistic cost estimates for the industry
    - Health status (typically clean for learning)
    - IAM summary
    - Recently visited services
    - Knowledge base context for AWS services
    
    This data populates the AWS Console-like UI in the CLI workspace.
    """
    try:
        api_key = request.openai_api_key or OPENAI_API_KEY
        
        # Generate account info from company name
        company_slug = request.company_name.lower().replace(" ", "-").replace("'", "")[:20]
        account_id = f"{hash(request.company_name) % 900000000000 + 100000000000}"
        
        # Search knowledge base for AWS service context
        service_context = {}
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key)
            
            # Build search query from challenge services
            search_query = f"AWS {' '.join(request.aws_services[:5])} architecture best practices {request.industry}"
            
            # Get embedding for search
            embed_response = await client.embeddings.create(
                model="text-embedding-3-small",
                input=search_query
            )
            query_embedding = embed_response.data[0].embedding
            
            # Search knowledge base
            kb_results = await db.search_knowledge_chunks(
                query_embedding=query_embedding,
                limit=5
            )
            
            if kb_results:
                # Extract relevant facts from knowledge base
                for chunk in kb_results[:3]:
                    content = chunk.get("content", "")[:500]
                    url = chunk.get("url", "")
                    # Try to identify which service this is about
                    for service in request.aws_services:
                        if service.lower() in content.lower() or service.lower() in url.lower():
                            if service not in service_context:
                                service_context[service] = []
                            service_context[service].append({
                                "fact": content[:200],
                                "source": url
                            })
                
                logger.info(f"Found {len(kb_results)} knowledge chunks for console context")
        except Exception as kb_err:
            logger.warning(f"Knowledge base search failed (non-critical): {kb_err}")
        
        # Map services to AWS service icons/colors
        service_icons = {
            "EC2": {"color": "#FF9900", "abbr": "EC"},
            "S3": {"color": "#569A31", "abbr": "S3"},
            "RDS": {"color": "#3B48CC", "abbr": "RD"},
            "Lambda": {"color": "#FF9900", "abbr": "λ"},
            "DynamoDB": {"color": "#3B48CC", "abbr": "DB"},
            "VPC": {"color": "#8C4FFF", "abbr": "VP"},
            "CloudFront": {"color": "#8C4FFF", "abbr": "CF"},
            "Route 53": {"color": "#8C4FFF", "abbr": "53"},
            "ELB": {"color": "#8C4FFF", "abbr": "EL"},
            "ALB": {"color": "#8C4FFF", "abbr": "AL"},
            "API Gateway": {"color": "#FF4F8B", "abbr": "AG"},
            "SNS": {"color": "#FF4F8B", "abbr": "SN"},
            "SQS": {"color": "#FF4F8B", "abbr": "SQ"},
            "CloudWatch": {"color": "#FF4F8B", "abbr": "CW"},
            "IAM": {"color": "#DD344C", "abbr": "IA"},
            "Cognito": {"color": "#DD344C", "abbr": "CG"},
            "ECS": {"color": "#FF9900", "abbr": "EC"},
            "EKS": {"color": "#FF9900", "abbr": "EK"},
            "Fargate": {"color": "#FF9900", "abbr": "FG"},
            "ElastiCache": {"color": "#3B48CC", "abbr": "EC"},
            "Redshift": {"color": "#3B48CC", "abbr": "RS"},
            "Athena": {"color": "#3B48CC", "abbr": "AT"},
            "Glue": {"color": "#3B48CC", "abbr": "GL"},
            "SageMaker": {"color": "#01A88D", "abbr": "SM"},
            "Kinesis": {"color": "#8C4FFF", "abbr": "KN"},
            "Step Functions": {"color": "#FF4F8B", "abbr": "SF"},
            "Secrets Manager": {"color": "#DD344C", "abbr": "SM"},
            "KMS": {"color": "#DD344C", "abbr": "KM"},
            "WAF": {"color": "#DD344C", "abbr": "WF"},
            "CloudFormation": {"color": "#FF4F8B", "abbr": "CF"},
        }
        
        # Build recently visited with proper icons
        recently_visited = []
        for service in request.aws_services[:8]:
            icon_info = service_icons.get(service, {"color": "#FF9900", "abbr": service[:2].upper()})
            recently_visited.append({
                "name": service,
                "color": icon_info["color"],
                "abbr": icon_info["abbr"],
                "url": f"/{service.lower().replace(' ', '-')}"
            })
        
        # Generate realistic resource counts based on services
        resource_counts = {}
        resources = []
        
        # Base resources that most architectures have
        if any(s in request.aws_services for s in ["VPC", "EC2", "RDS", "Lambda"]):
            resource_counts["VPCs"] = 2
            resource_counts["Subnets"] = 4
            resource_counts["Security Groups"] = 3
            resource_counts["Route Tables"] = 2
            
            # Add VPC resources
            resources.append(AWSResource(
                id=f"vpc-{hash(request.company_name) % 10000000:08x}",
                name=f"{company_slug}-prod-vpc",
                type="VPC",
                status="available",
                created_at="2024-01-15T10:30:00Z",
                details={"cidr": "10.0.0.0/16", "tenancy": "default"}
            ))
            resources.append(AWSResource(
                id=f"vpc-{(hash(request.company_name) + 1) % 10000000:08x}",
                name=f"{company_slug}-dev-vpc",
                type="VPC",
                status="available",
                created_at="2024-01-15T10:35:00Z",
                details={"cidr": "10.1.0.0/16", "tenancy": "default"}
            ))
        
        if "EC2" in request.aws_services:
            resource_counts["EC2 Instances"] = 0  # Start with 0, user will create
            resource_counts["AMIs"] = 3
            resource_counts["EBS Volumes"] = 2
        
        if "S3" in request.aws_services:
            resource_counts["S3 Buckets"] = 2
            resources.append(AWSResource(
                id=f"{company_slug}-assets-{request.region}",
                name=f"{company_slug}-assets-{request.region}",
                type="S3 Bucket",
                status="available",
                created_at="2024-01-10T08:00:00Z",
                details={"versioning": "enabled", "encryption": "AES-256"}
            ))
            resources.append(AWSResource(
                id=f"{company_slug}-logs-{request.region}",
                name=f"{company_slug}-logs-{request.region}",
                type="S3 Bucket",
                status="available",
                created_at="2024-01-10T08:05:00Z",
                details={"versioning": "disabled", "encryption": "AES-256"}
            ))
        
        if "RDS" in request.aws_services:
            resource_counts["RDS Instances"] = 0  # Start with 0
            resource_counts["DB Snapshots"] = 1
        
        if "Lambda" in request.aws_services:
            resource_counts["Lambda Functions"] = 0
        
        if "DynamoDB" in request.aws_services:
            resource_counts["DynamoDB Tables"] = 0
        
        if "ECS" in request.aws_services or "EKS" in request.aws_services:
            resource_counts["ECS Clusters"] = 0
        
        if "CloudFront" in request.aws_services:
            resource_counts["CloudFront Distributions"] = 0
        
        if "API Gateway" in request.aws_services:
            resource_counts["API Gateway APIs"] = 0
        
        # Generate realistic costs based on industry
        industry_cost_multipliers = {
            "Restaurant": 0.3,
            "Retail": 0.5,
            "Healthcare": 0.8,
            "Finance": 1.2,
            "Technology": 0.7,
            "Manufacturing": 0.6,
            "Education": 0.4,
            "Media": 0.9,
        }
        
        base_cost = 150.0  # Base monthly cost
        multiplier = industry_cost_multipliers.get(request.industry, 0.5)
        current_cost = round(base_cost * multiplier * (len(request.aws_services) / 5), 2)
        
        # Cost breakdown by service
        cost_by_service = []
        remaining_cost = current_cost
        for i, service in enumerate(request.aws_services[:5]):
            if i == len(request.aws_services[:5]) - 1:
                service_cost = remaining_cost
            else:
                service_cost = round(remaining_cost * (0.3 + (i * 0.1)), 2)
                remaining_cost -= service_cost
            cost_by_service.append({
                "service": service,
                "cost": max(0, service_cost),
                "percentage": round((service_cost / current_cost) * 100) if current_cost > 0 else 0
            })
        
        # Cost trend (last 7 days - slight variation)
        import random
        cost_trend = [round(current_cost / 30 * (0.8 + random.random() * 0.4), 2) for _ in range(7)]
        
        # Health status - clean for learning environment
        health_open_issues = 0
        health_scheduled_changes = 1 if random.random() > 0.7 else 0
        health_notifications = 0
        
        # IAM summary
        iam_users = 3
        iam_roles = 5 + len(request.aws_services)
        iam_policies = 8 + len(request.aws_services)
        
        console_data = ConsoleData(
            account_id=account_id,
            account_alias=f"{company_slug}-account",
            region=request.region,
            recently_visited=recently_visited,
            resource_counts=resource_counts,
            resources=resources,
            cost_current_month=current_cost,
            cost_forecast=round(current_cost * 1.1, 2),
            cost_by_service=cost_by_service,
            cost_trend=cost_trend,
            health_open_issues=health_open_issues,
            health_scheduled_changes=health_scheduled_changes,
            health_notifications=health_notifications,
            iam_users=iam_users,
            iam_roles=iam_roles,
            iam_policies=iam_policies,
            service_context=service_context if service_context else None,
        )
        
        logger.info(f"Generated console data for challenge {request.challenge_id}")
        
        return {
            "success": True,
            "console_data": console_data.model_dump(),
            "challenge_id": request.challenge_id,
        }
        
    except Exception as e:
        logger.error(f"Console generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Console generation failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 6098))
    uvicorn.run(app, host="0.0.0.0", port=port)
