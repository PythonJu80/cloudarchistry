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


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 6098))
    uvicorn.run(app, host="0.0.0.0", port=port)
