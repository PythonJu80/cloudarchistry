"""
Chat API routes - RAG search and chat completion.
"""
from fastapi import APIRouter

from models.chat import ChatRequest

router = APIRouter()


@router.get("/sources")
async def get_available_sources(tenant_id: str = None):
    """Get available sources for RAG"""
    from crawl4ai_mcp import get_available_sources as original_endpoint
    return await original_endpoint(tenant_id)


@router.post("/search")
async def perform_rag_query(query: str, source: str = None, match_count: int = 5):
    """Perform RAG query"""
    from crawl4ai_mcp import perform_rag_query as original_endpoint
    return await original_endpoint(query, source, match_count)


@router.post("/chat")
async def chat(request: ChatRequest):
    """Chat completion with RAG"""
    from crawl4ai_mcp import chat as original_endpoint
    return await original_endpoint(request)
