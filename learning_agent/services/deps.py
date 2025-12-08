"""
Agent dependencies.
"""
import os
from typing import Optional
import httpx


class AgentDeps:
    """Dependencies for the agent"""
    def __init__(self):
        self.tavily_api_key = os.getenv("TAVILY_API_KEY")
        # No OpenAI key from env - must come from user's settings
        self.http_client = httpx.AsyncClient(timeout=30.0)
    
    async def close(self):
        await self.http_client.aclose()


# Global deps
_agent_deps: Optional[AgentDeps] = None


def get_agent_deps() -> AgentDeps:
    global _agent_deps
    if _agent_deps is None:
        _agent_deps = AgentDeps()
    return _agent_deps
