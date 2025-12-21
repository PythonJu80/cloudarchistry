"""
Web search service using Brave Search API.
"""
from typing import List, Dict, Any
from config.settings import logger
from .deps import get_agent_deps


async def search_web(query: str, max_results: int = 5, language: str = "en") -> List[Dict[str, Any]]:
    """Search the web using Brave Search API"""
    deps = get_agent_deps()
    if not deps.brave_api_key:
        logger.warning("No Brave API key configured")
        return []
    
    try:
        response = await deps.http_client.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={
                "q": query,
                "count": max_results,
                "search_lang": language,
                "result_filter": "web",
            },
            headers={
                "Accept": "application/json",
                "Accept-Language": "en-US,en;q=0.9",
                "X-Subscription-Token": deps.brave_api_key
            }
        )
        response.raise_for_status()
        data = response.json()
        
        # Transform Brave results to match expected format
        results = []
        for item in data.get("web", {}).get("results", []):
            results.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "content": item.get("description", ""),
            })
        return results
    except Exception as e:
        logger.error(f"Brave search failed: {e}")
        return []
