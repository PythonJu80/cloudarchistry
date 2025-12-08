"""
CloudMigrate Learning Agent - Main Entry Point
===============================================
Refactored modular structure. This file initializes the FastAPI app
and registers all routes from the modular route files.

For backwards compatibility, crawl4ai_mcp.py still works but is deprecated.
New development should use this modular structure.
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from utils import ApiKeyRequiredError
from config.settings import logger

# Initialize FastAPI app
app = FastAPI(
    title="CloudMigrate Learning Agent",
    description="AI-powered learning agent for AWS cloud architecture training",
    version="2.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler for API key required errors
@app.exception_handler(ApiKeyRequiredError)
async def api_key_required_handler(request: Request, exc: ApiKeyRequiredError):
    """Return 402 Payment Required when API key is not configured."""
    return JSONResponse(
        status_code=402,
        content={
            "error": "OpenAI API key required",
            "message": str(exc),
            "action": "configure_api_key",
            "settingsUrl": "/dashboard/settings"
        }
    )


# Register all routes
from routes import register_routes
register_routes(app)


# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 CloudMigrate Learning Agent starting...")
    # Initialize context (crawler, neo4j, etc.)
    from crawl.context import get_context
    try:
        await get_context()
        logger.info("✓ Application context initialized")
    except Exception as e:
        logger.warning(f"Context initialization warning: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
