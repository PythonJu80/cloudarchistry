"""
Web search service using Tavily API.
"""
from typing import List, Dict, Any
from config.settings import logger
from .deps import get_agent_deps


async def search_web(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """Search the web using Tavily API"""
    deps = get_agent_deps()
    if not deps.tavily_api_key:
        logger.warning("No Tavily API key configured")
        return []
    
    try:
        response = await deps.http_client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": deps.tavily_api_key,
                "query": query,
                "max_results": max_results,
                "include_answer": True,
                "include_raw_content": False,
                "search_depth": "advanced"
            }
        )
        response.raise_for_status()
        data = response.json()
        return data.get("results", [])
    except Exception as e:
        logger.error(f"Tavily search failed: {e}")
        return []
