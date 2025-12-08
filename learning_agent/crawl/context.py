"""
Application context for the crawler.
"""
import os
from dataclasses import dataclass
from typing import Any, Optional
from sentence_transformers import CrossEncoder
from crawl4ai import AsyncWebCrawler, BrowserConfig
from neo4j import AsyncGraphDatabase

from aws.neo4j_graph import format_neo4j_error


@dataclass
class Crawl4AIContext:
    """Context for the Crawl4AI API server."""
    crawler: AsyncWebCrawler
    reranking_model: Optional[CrossEncoder] = None
    neo4j_driver: Optional[Any] = None  # Neo4j driver for AWS services graph


# Global context - initialized on first use
_app_context = None


async def get_context() -> Crawl4AIContext:
    """Get or initialize the application context."""
    global _app_context
    if _app_context is None:
        # Create browser configuration
        browser_config = BrowserConfig(headless=True, verbose=False)
        
        # Initialize the crawler
        crawler = AsyncWebCrawler(config=browser_config)
        await crawler.__aenter__()
        
        # Initialize cross-encoder model for reranking if enabled
        reranking_model = None
        if os.getenv("USE_RERANKING", "false") == "true":
            try:
                reranking_model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
                print("✓ Reranking model loaded")
            except Exception as e:
                print(f"Failed to load reranking model: {e}")
        
        # Initialize Neo4j driver for AWS services graph if enabled
        neo4j_driver = None
        knowledge_graph_enabled = os.getenv("USE_KNOWLEDGE_GRAPH", "false") == "true"
        
        if knowledge_graph_enabled:
            neo4j_uri = os.getenv("NEO4J_URI")
            neo4j_user = os.getenv("NEO4J_USER")
            neo4j_password = os.getenv("NEO4J_PASSWORD")
            
            if neo4j_uri and neo4j_user and neo4j_password:
                try:
                    print("Initializing Neo4j driver for AWS services graph...")
                    neo4j_driver = AsyncGraphDatabase.driver(
                        neo4j_uri,
                        auth=(neo4j_user, neo4j_password)
                    )
                    # Test connection
                    async with neo4j_driver.session() as session:
                        await session.run("RETURN 1")
                    print("✓ Neo4j driver initialized")
                except Exception as e:
                    print(f"Failed to initialize Neo4j: {format_neo4j_error(e)}")
                    neo4j_driver = None
            else:
                print("Neo4j credentials not configured - AWS services graph unavailable")
        else:
            print("AWS services graph disabled - set USE_KNOWLEDGE_GRAPH=true to enable")
        
        _app_context = Crawl4AIContext(
            crawler=crawler,
            reranking_model=reranking_model,
            neo4j_driver=neo4j_driver
        )
    return _app_context
