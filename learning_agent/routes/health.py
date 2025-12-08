"""
Health check endpoint.
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "service": "crawl4ai-rag"}
