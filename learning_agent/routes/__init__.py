"""
API Routes for the Learning Agent.
"""
from fastapi import APIRouter

from .health import router as health_router
from .crawl import router as crawl_router
from .aws import router as aws_router
from .learning import router as learning_router
from .journey import router as journey_router
from .config import router as config_router
from .chat import router as chat_router
from .game import router as game_router
from .cloud_tycoon import router as cloud_tycoon_router
from .service_slots import router as service_slots_router

# Create main router that includes all sub-routers
def register_routes(app):
    """Register all routes with the FastAPI app."""
    app.include_router(health_router, tags=["Health"])
    app.include_router(crawl_router, prefix="/api/crawl", tags=["Crawl"])
    app.include_router(aws_router, prefix="/api/aws", tags=["AWS"])
    app.include_router(learning_router, prefix="/api/learning", tags=["Learning"])
    app.include_router(journey_router, prefix="/api/learning/journey", tags=["Journey"])
    app.include_router(config_router, prefix="/api", tags=["Config"])
    app.include_router(chat_router, prefix="/api", tags=["Chat"])
    app.include_router(game_router, prefix="/api/game", tags=["Game Modes"])
    app.include_router(cloud_tycoon_router, prefix="/api/tycoon", tags=["Cloud Tycoon"])
    app.include_router(service_slots_router, prefix="/api/slots", tags=["Service Slots"])
