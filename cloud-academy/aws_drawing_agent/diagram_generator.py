"""
Diagram Generator
=================
Generates AWS architecture diagrams from text descriptions using LLM.
"""

import logging
from typing import Dict, Optional
from llm_generator import LLMDiagramGenerator

logger = logging.getLogger(__name__)


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
    
    def generate_with_explanation(self, description: str) -> Dict:
        """
        Generate a diagram AND explanation from text description.
        Uses reference architectures from PPTX files as examples.
        
        Args:
            description: Natural language description of architecture
            
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
            # Find similar reference architectures to use as examples
            reference_example = self._find_similar_architecture(description)
            
            result = self.llm_generator.generate_diagram_with_explanation(
                description=description,
                services_list=self.services_list,
                reference_example=reference_example
            )
            
            diagram = result.get("diagram", {})
            explanation = result.get("explanation", "")
            
            # Add metadata
            metadata = {
                "generated_from": description,
                "status": "success",
                "nodes_count": len(diagram.get("nodes", [])),
                "edges_count": len(diagram.get("edges", [])),
                "reference_used": reference_example.get("name") if reference_example else None
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
        Find a similar reference architecture from PPTX data to use as example.
        Extracts AWS service nodes from the reference to guide generation.
        """
        if not self.reference_architectures:
            return None
        
        description_lower = description.lower()
        
        # Keywords to match against architecture names
        keywords = {
            "serverless": ["serverless", "lambda", "api-gateway"],
            "api": ["api", "gateway", "rest"],
            "data": ["data", "pipeline", "kinesis", "stream"],
            "web": ["web", "application", "tier"],
            "microservices": ["microservice", "ecs", "container"],
            "ml": ["machine", "learning", "sagemaker", "ml"],
            "iot": ["iot", "sensor", "device"],
        }
        
        # Find matching architectures
        best_match = None
        best_score = 0
        
        for arch_id, arch_data in self.reference_architectures.items():
            score = 0
            arch_name = arch_data.get("name", "").lower()
            
            # Check keyword matches
            for keyword_group, terms in keywords.items():
                if any(term in description_lower for term in terms):
                    if any(term in arch_name for term in terms):
                        score += 2
            
            # Check direct word matches
            for word in description_lower.split():
                if len(word) > 3 and word in arch_name:
                    score += 1
            
            if score > best_score:
                best_score = score
                best_match = arch_data
        
        if best_match and best_score > 0:
            # Extract AWS service nodes from the reference
            diagram = best_match.get("diagram", {})
            aws_services = []
            for node in diagram.get("nodes", []):
                if node.get("data", {}).get("service_id"):
                    aws_services.append({
                        "service_id": node["data"]["service_id"],
                        "label": node["data"].get("label", ""),
                    })
            
            return {
                "name": best_match.get("name"),
                "services": aws_services[:10],  # Limit to 10 services
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
