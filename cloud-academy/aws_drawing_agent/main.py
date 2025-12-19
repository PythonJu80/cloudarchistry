"""
AWS Drawing Agent API
=====================
FastAPI service for AWS architecture diagram operations.
"""

import sys
import os
from pathlib import Path
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

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    difficulty: str = "intermediate"  # beginner, intermediate, advanced
    certification_code: Optional[str] = None
    scenario_type: str = "ecommerce"
    openai_api_key: Optional[str] = None

class BugBountyValidateRequest(BaseModel):
    challenge_id: str
    target_id: str
    bug_type: str
    severity: str
    claim: str
    evidence: List[str]
    confidence: int


@app.on_event("startup")
async def startup():
    """Initialize database connection on startup."""
    try:
        await db.get_pool()
        logger.info("Database connection established")
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
    if not Path(file_path).exists():
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    
    try:
        diagram = agent.convert_architecture(file_path)
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
    Hidden bugs are stored server-side for validation.
    """
    try:
        # Use provided API key or default
        api_key = request.openai_api_key or OPENAI_API_KEY
        generator = BugBountyGenerator(openai_api_key=api_key)
        
        # Generate challenge
        challenge = generator.generate_challenge(
            difficulty=request.difficulty,
            certification_code=request.certification_code,
            scenario_type=request.scenario_type,
        )
        
        # Store challenge for validation (use challenge_id as key)
        active_challenges[challenge.challenge_id] = challenge
        
        # Return challenge WITHOUT hidden bugs (those are secret!)
        return {
            "challenge_id": challenge.challenge_id,
            "diagram": challenge.diagram,
            "description": challenge.description,
            "aws_environment": {
                "cloudwatch_logs": [log.model_dump() for log in challenge.aws_environment.cloudwatch_logs],
                "cloudwatch_metrics": {k: v.model_dump() for k, v in challenge.aws_environment.cloudwatch_metrics.items()},
                "vpc_flow_logs": challenge.aws_environment.vpc_flow_logs,
                "iam_policies": challenge.aws_environment.iam_policies,
                "cost_data": challenge.aws_environment.cost_data,
                "xray_traces": [trace.model_dump() for trace in challenge.aws_environment.xray_traces],
                "config_compliance": [rule.model_dump() for rule in challenge.aws_environment.config_compliance],
            },
            "difficulty": challenge.difficulty,
            "bounty_value": challenge.bounty_value,
            "time_limit": challenge.time_limit,
            "bug_count": len(challenge.hidden_bugs),  # Tell them how many bugs exist
        }
    except Exception as e:
        logger.error(f"Bug Bounty generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@app.post("/bug-bounty/validate")
async def validate_bug_claim(request: BugBountyValidateRequest):
    """
    Validate a user's bug claim against the hidden bugs in the challenge.
    Returns whether the claim is correct, points awarded, and explanation.
    """
    try:
        # Get challenge
        challenge = active_challenges.get(request.challenge_id)
        if not challenge:
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
        
        result = bug_bounty_generator.validate_claim(challenge, claim_data)
        
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
    Returns the complete list of bugs with explanations.
    """
    try:
        challenge = active_challenges.get(challenge_id)
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        return {
            "challenge_id": challenge_id,
            "bugs": [bug.model_dump() for bug in challenge.hidden_bugs],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bug reveal failed: {e}")
        raise HTTPException(status_code=500, detail=f"Reveal failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 6098))
    uvicorn.run(app, host="0.0.0.0", port=port)
