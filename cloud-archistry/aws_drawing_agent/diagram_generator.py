"""
Diagram Generator
=================
Generates AWS architecture diagrams from text descriptions using LLM.
Now with RAG support - queries pgvector for architecture knowledge.
"""

import logging
import asyncio
from typing import Dict, Optional, List
from llm_generator import LLMDiagramGenerator

logger = logging.getLogger(__name__)


def get_rag_context_sync(description: str, api_key: str, limit: int = 5) -> str:
    """
    Query pgvector for relevant architecture knowledge (synchronous version).
    Returns context string to inject into LLM prompt.
    """
    import os
    import json
    import psycopg2
    from openai import OpenAI
    
    try:
        client = OpenAI(api_key=api_key)
        
        # Get embedding for the description
        embed_response = client.embeddings.create(
            model="text-embedding-3-small",
            input=description[:8000]
        )
        query_embedding = embed_response.data[0].embedding
        
        # Connect to postgres directly (sync)
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            logger.warning("DATABASE_URL not set for RAG")
            return ""
        
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        
        # Search pgvector
        embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
        cur.execute("""
            SELECT url, content, 1 - (embedding <=> %s::vector) as similarity
            FROM "AcademyKnowledgeChunk"
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """, (embedding_str, embedding_str, limit))
        
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        if not rows:
            logger.info("No RAG results found")
            return ""
        
        # Build context string from top results
        context_parts = []
        for url, content, similarity in rows:
            if similarity > 0.4:
                context_parts.append(f"[From {url}]:\n{content[:800]}")
        
        if context_parts:
            context = "\n\n".join(context_parts)
            logger.info(f"RAG context: {len(context_parts)} chunks, {len(context)} chars")
            return f"\n\nREFERENCE ARCHITECTURE KNOWLEDGE:\n{context}"
        
        return ""
        
    except Exception as e:
        logger.warning(f"RAG query failed: {e}")
        return ""


class DiagramGenerator:
    """
    Generates diagrams from natural language descriptions.
    Uses LLM to understand requirements and create React Flow diagrams.
    """
    
    def __init__(self, openai_api_key: str = None, services_list: list = None, reference_architectures: dict = None):
        """
        Initialize diagram generator with OpenAI API key.
        
        Args:
            openai_api_key: OpenAI API key for LLM operations
            services_list: List of available AWS services
            reference_architectures: Dict of reference architectures from PPTX files
        """
        self.openai_api_key = openai_api_key
        self.services_list = services_list
        self.reference_architectures = reference_architectures or {}
        self.llm_generator = None
        
        if openai_api_key:
            try:
                self.llm_generator = LLMDiagramGenerator(api_key=openai_api_key)
                logger.info("LLM diagram generator initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize LLM generator: {e}")
    
    def generate(self, description: str) -> Dict:
        """
        Generate a diagram from text description.
        
        Args:
            description: Natural language description of architecture
            
        Returns:
            React Flow diagram with nodes and edges
        """
        logger.info(f"Generating diagram from: {description[:100]}...")
        
        if not self.llm_generator:
            return {
                "nodes": [],
                "edges": [],
                "metadata": {
                    "generated_from": description,
                    "status": "error",
                    "error": "OpenAI API key not configured"
                }
            }
        
        try:
            diagram = self.llm_generator.generate_diagram(
                description=description,
                services_list=self.services_list
            )
            
            # Add metadata
            diagram["metadata"] = {
                "generated_from": description,
                "status": "success",
                "nodes_count": len(diagram.get("nodes", [])),
                "edges_count": len(diagram.get("edges", []))
            }
            
            return diagram
            
        except Exception as e:
            logger.error(f"Failed to generate diagram: {e}")
            return {
                "nodes": [],
                "edges": [],
                "metadata": {
                    "generated_from": description,
                    "status": "error",
                    "error": str(e)
                }
            }
    
    def generate_with_explanation(self, description: str, use_rag: bool = True) -> Dict:
        """
        Generate a diagram AND explanation from text description.
        Uses RAG (pgvector) for architecture knowledge + reference architectures from PPTX files.
        
        Args:
            description: Natural language description of architecture
            use_rag: Whether to query pgvector for architecture knowledge (default: True)
            
        Returns:
            Dict with 'diagram' (nodes/edges), 'explanation' (markdown), and 'metadata'
        """
        logger.info(f"Generating diagram with explanation: {description[:100]}...")
        
        if not self.llm_generator:
            return {
                "diagram": {"nodes": [], "edges": []},
                "explanation": "OpenAI API key not configured",
                "metadata": {"status": "error", "error": "OpenAI API key not configured"}
            }
        
        try:
            # Get RAG context from pgvector (AWS documentation knowledge)
            rag_context = ""
            if use_rag and self.openai_api_key:
                try:
                    rag_context = get_rag_context_sync(description, self.openai_api_key, limit=5)
                    if rag_context:
                        logger.info(f"RAG context added: {len(rag_context)} chars")
                except Exception as e:
                    logger.warning(f"RAG failed, continuing without: {e}")
            
            # Combine description with RAG context
            enhanced_description = description + rag_context
            
            result = self.llm_generator.generate_diagram_with_explanation(
                description=enhanced_description,
                services_list=self.services_list
            )
            
            diagram = result.get("diagram", {})
            explanation = result.get("explanation", "")
            
            # Add metadata
            metadata = {
                "generated_from": description,
                "status": "success",
                "nodes_count": len(diagram.get("nodes", [])),
                "edges_count": len(diagram.get("edges", [])),
                "rag_used": bool(rag_context),
                "rag_context_length": len(rag_context) if rag_context else 0
            }
            
            return {
                "diagram": diagram,
                "explanation": explanation,
                "metadata": metadata
            }
            
        except Exception as e:
            logger.error(f"Failed to generate diagram with explanation: {e}")
            return {
                "diagram": {"nodes": [], "edges": []},
                "explanation": f"Generation failed: {str(e)}",
                "metadata": {"status": "error", "error": str(e)}
            }
    
    def _find_similar_architecture(self, description: str) -> Optional[Dict]:
        """
        Find a similar reference architecture from converted JSON data.
        Returns the full diagram structure (nodes with positions, edges) to use as template.
        """
        if not self.reference_architectures:
            return None
        
        description_lower = description.lower()
        
        # Keywords to match against architecture names
        keywords = {
            "serverless": ["serverless", "lambda", "api-gateway", "function"],
            "api": ["api", "gateway", "rest", "graphql"],
            "data": ["data", "pipeline", "kinesis", "stream", "analytics", "lake"],
            "web": ["web", "application", "tier", "frontend", "hosting"],
            "microservices": ["microservice", "ecs", "container", "docker", "kubernetes"],
            "ml": ["machine", "learning", "sagemaker", "ml", "ai", "model"],
            "iot": ["iot", "sensor", "device", "edge", "connected"],
            "ecommerce": ["ecommerce", "commerce", "shop", "retail", "payment", "cart"],
            "mobile": ["mobile", "app", "ios", "android"],
            "gaming": ["game", "gaming", "multiplayer", "session"],
            "healthcare": ["health", "medical", "patient", "clinical"],
            "financial": ["financial", "banking", "payment", "fraud"],
        }
        
        # Find matching architectures
        best_match = None
        best_score = 0
        
        for arch_id, arch_data in self.reference_architectures.items():
            # Only consider architectures with loaded diagrams
            if not arch_data.get("loaded") or not arch_data.get("diagram"):
                continue
                
            score = 0
            arch_name = arch_data.get("name", "").lower()
            
            # Check keyword matches
            for keyword_group, terms in keywords.items():
                if any(term in description_lower for term in terms):
                    if any(term in arch_name for term in terms):
                        score += 3
            
            # Check direct word matches
            for word in description_lower.split():
                if len(word) > 3 and word in arch_name:
                    score += 1
            
            if score > best_score:
                best_score = score
                best_match = arch_data
        
        if best_match and best_score > 0:
            diagram = best_match.get("diagram", {})
            nodes = diagram.get("nodes", [])
            edges = diagram.get("edges", [])
            
            # Extract nodes with service_id and their positions
            service_nodes = []
            for node in nodes:
                data = node.get("data", {})
                if data.get("service_id"):
                    service_nodes.append({
                        "id": node.get("id"),
                        "service_id": data["service_id"],
                        "label": data.get("label", ""),
                        "position": node.get("position", {}),
                        "type": node.get("type", "awsService"),
                    })
            
            # Extract all positions to understand the layout pattern
            all_positions = []
            for node in nodes:
                pos = node.get("position", {})
                if pos.get("x") is not None and pos.get("y") is not None:
                    all_positions.append(pos)
            
            # Calculate layout bounds
            if all_positions:
                min_x = min(p["x"] for p in all_positions)
                max_x = max(p["x"] for p in all_positions)
                min_y = min(p["y"] for p in all_positions)
                max_y = max(p["y"] for p in all_positions)
            else:
                min_x, max_x, min_y, max_y = 0, 1200, 0, 800
            
            logger.info(f"Found reference architecture: {best_match.get('name')} with {len(service_nodes)} service nodes")
            
            return {
                "name": best_match.get("name"),
                "services": service_nodes[:15],  # Service nodes with positions
                "edges": edges[:20],  # Connection patterns
                "layout_bounds": {
                    "min_x": min_x, "max_x": max_x,
                    "min_y": min_y, "max_y": max_y,
                },
                "total_nodes": len(nodes),
            }
        
        return None
    
    def enhance_with_validation(self, diagram: Dict, validation_results: Dict) -> Dict:
        """
        Enhance diagram based on validation results.
        
        Args:
            diagram: Original diagram
            validation_results: Validation results with warnings/suggestions
            
        Returns:
            Enhanced diagram
        """
        if not self.llm_generator:
            logger.warning("Cannot enhance diagram - LLM generator not available")
            return diagram
        
        try:
            return self.llm_generator.enhance_diagram_with_validation(
                diagram=diagram,
                validation_results=validation_results
            )
        except Exception as e:
            logger.error(f"Failed to enhance diagram: {e}")
            return diagram
