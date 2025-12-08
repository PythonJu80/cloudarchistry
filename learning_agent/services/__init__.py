"""
Shared services for the Learning Agent.
"""
from .openai_service import (
    async_chat_completion,
    async_chat_completion_json,
    detect_skill_level,
)
from .web_search import search_web
from .research import research_company
from .deps import AgentDeps, get_agent_deps
