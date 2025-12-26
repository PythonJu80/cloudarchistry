"""
AWS Drawing Agent
=================
The main agent that orchestrates all AWS architecture drawing capabilities.
"""

import logging
from typing import Dict, List, Optional
from pathlib import Path

from knowledge_base import AWSKnowledgeBase
from pptx_converter import PPTXToReactFlowConverter

logger = logging.getLogger(__name__)


class AWSDrawingAgent:
    """
    Specialized AI agent for AWS architecture diagrams.
    
    Capabilities:
    - Convert PowerPoint architectures to React Flow diagrams
    - Generate diagrams from text descriptions
    - Validate architectures against best practices
    - Suggest improvements and alternatives
    - Export diagrams to multiple formats
    """
    
    def __init__(
        self,
        services_file: str = None,
        architectures_dir: str = None,
        openai_api_key: str = None
    ):
        """
        Initialize the AWS Drawing Agent.
        
        Args:
            services_file: Path to AWS services definition file
            architectures_dir: Directory containing PowerPoint architecture files
            openai_api_key: OpenAI API key for LLM capabilities
        """
        logger.info("Initializing AWS Drawing Agent")
        
        # Initialize knowledge base
        self.knowledge_base = AWSKnowledgeBase(
            services_file="auto",  # Will auto-load from aws_service_url_mapping.py
            architectures_dir=architectures_dir
        )
        
        # Initialize PPTX converter
        self.pptx_converter = PPTXToReactFlowConverter()
        
        # Store API key for LLM operations
        self.openai_api_key = openai_api_key
        
        # Initialize diagram generator with LLM support and reference architectures
        from diagram_generator import DiagramGenerator
        services_list = list(self.knowledge_base.services.keys()) if self.knowledge_base.services else None
        self.diagram_generator = DiagramGenerator(
            openai_api_key=openai_api_key,
            services_list=services_list,
            reference_architectures=self.knowledge_base.architectures
        )
        
        logger.info(f"Agent initialized with {len(self.knowledge_base.services)} services "
                   f"and {len(self.knowledge_base.architectures)} reference architectures")
    
    def convert_architecture(self, pptx_path: str) -> Dict:
        """
        Convert a PowerPoint architecture to React Flow format.
        
        Args:
            pptx_path: Path to PowerPoint file
            
        Returns:
            React Flow diagram with nodes and edges
        """
        logger.info(f"Converting architecture: {pptx_path}")
        return self.pptx_converter.convert_file(pptx_path)
    
    def convert_all_architectures(self, output_dir: str = None) -> List[Dict]:
        """
        Convert all 70 reference architectures to React Flow format.
        
        Args:
            output_dir: Directory to save converted diagrams
            
        Returns:
            List of conversion results
        """
        if not output_dir:
            output_dir = "/home/kingju/Documents/cloudmigrate-saas/aws_architecture_diagrams/converted"
        
        # Get architectures directory from knowledge base
        architectures = self.knowledge_base.list_architectures()
        if not architectures:
            logger.warning("No architectures found in knowledge base")
            return []
        
        # Get directory from first architecture
        first_arch = architectures[0]
        arch_dir = Path(first_arch["file_path"]).parent
        
        logger.info(f"Converting all architectures from {arch_dir}")
        return self.pptx_converter.convert_all_architectures(str(arch_dir), output_dir)
    
    def get_service_info(self, service_id: str) -> Optional[Dict]:
        """
        Get detailed information about an AWS service.
        
        Args:
            service_id: Service identifier (e.g., 'ec2', 's3', 'lambda')
            
        Returns:
            Service metadata including best practices
        """
        service = self.knowledge_base.get_service(service_id)
        if not service:
            return None
        
        # Enhance with best practices
        service["best_practices"] = self.knowledge_base.get_best_practices(service_id)
        
        return service
    
    def search_services(self, query: str) -> List[Dict]:
        """
        Search for AWS services by name or description.
        
        Args:
            query: Search query
            
        Returns:
            List of matching services
        """
        return self.knowledge_base.search_services(query)
    
    def list_architectures(self, category: str = None) -> List[Dict]:
        """
        List available reference architectures.
        
        Args:
            category: Optional category filter
            
        Returns:
            List of architecture metadata
        """
        return self.knowledge_base.list_architectures(category)
    
    def get_architecture(self, arch_id: str) -> Optional[Dict]:
        """
        Get a specific reference architecture.
        
        Args:
            arch_id: Architecture identifier
            
        Returns:
            Architecture metadata and diagram
        """
        arch = self.knowledge_base.get_architecture(arch_id)
        if not arch:
            return None
        
        # Convert to React Flow if not already done
        if not arch.get("loaded"):
            diagram = self.convert_architecture(arch["file_path"])
            arch["diagram"] = diagram
            arch["loaded"] = True
        
        return arch
    
    def validate_diagram(self, diagram: Dict) -> Dict:
        """
        Validate a diagram against AWS best practices.
        
        Args:
            diagram: React Flow diagram with nodes and edges
            
        Returns:
            Validation results with suggestions and warnings
        """
        results = {
            "valid": True,
            "warnings": [],
            "suggestions": [],
            "best_practices": [],
        }
        
        # Extract services from diagram
        services = []
        for node in diagram.get("nodes", []):
            service_id = node.get("data", {}).get("service_id")
            if service_id:
                services.append(service_id)
        
        # Check for common patterns and best practices
        if "ec2" in services and "vpc" not in services:
            results["warnings"].append("EC2 instances should be in a VPC")
        
        if "rds" in services and "vpc" not in services:
            results["warnings"].append("RDS should be in a VPC")
        
        if "lambda" in services and "rds" in services:
            results["suggestions"].append("Lambda accessing RDS should be in a VPC")
        
        if "ec2" in services and "alb" not in services and "nlb" not in services:
            results["suggestions"].append("Consider adding a load balancer for high availability")
        
        # Add best practices for each service
        for service_id in set(services):
            practices = self.knowledge_base.get_best_practices(service_id)
            if practices:
                results["best_practices"].extend([
                    {"service": service_id, "practice": practice}
                    for practice in practices
                ])
        
        results["valid"] = len(results["warnings"]) == 0
        
        return results
    
    def suggest_architecture(self, requirements: str) -> List[Dict]:
        """
        Suggest reference architectures based on requirements.
        
        Args:
            requirements: Text description of requirements
            
        Returns:
            List of suggested architectures
        """
        return self.knowledge_base.suggest_architecture(requirements)
    
    def generate_diagram_from_text(self, description: str) -> Dict:
        """
        Generate a diagram from a text description.
        Uses LLM to understand requirements and create diagram.
        
        Args:
            description: Text description of desired architecture
            
        Returns:
            Generated React Flow diagram
        """
        logger.info(f"Generating diagram from: {description[:100]}...")
        
        if not self.diagram_generator:
            return {
                "nodes": [],
                "edges": [],
                "metadata": {
                    "generated_from": description,
                    "status": "error",
                    "error": "Diagram generator not initialized"
                }
            }
        
        return self.diagram_generator.generate(description)
    
    def generate_diagram_with_explanation(self, description: str) -> Dict:
        """
        Generate a diagram AND explanation from a text description.
        Uses LLM to create diagram and explain the architecture.
        
        Args:
            description: Text description of desired architecture
            
        Returns:
            Dict with 'diagram', 'explanation', and 'metadata'
        """
        logger.info(f"Generating diagram with explanation: {description[:100]}...")
        
        if not self.diagram_generator:
            return {
                "diagram": {"nodes": [], "edges": []},
                "explanation": "Diagram generator not initialized",
                "metadata": {"status": "error", "error": "Diagram generator not initialized"}
            }
        
        return self.diagram_generator.generate_with_explanation(description)
    
    def export_diagram(self, diagram: Dict, format: str = "json") -> str:
        """
        Export diagram to various formats.
        
        Args:
            diagram: React Flow diagram
            format: Export format (json, png, svg, pptx)
            
        Returns:
            Path to exported file
        """
        # This would handle different export formats
        # For now, just return the diagram as JSON
        import json
        return json.dumps(diagram, indent=2)
    
    def get_stats(self) -> Dict:
        """Get agent statistics."""
        return {
            "services_loaded": len(self.knowledge_base.services),
            "architectures_loaded": len(self.knowledge_base.architectures),
            "categories": {
                "compute": len([s for s in self.knowledge_base.services.values() if s["category"] == "compute"]),
                "storage": len([s for s in self.knowledge_base.services.values() if s["category"] == "storage"]),
                "database": len([s for s in self.knowledge_base.services.values() if s["category"] == "database"]),
                "networking": len([s for s in self.knowledge_base.services.values() if s["category"] == "networking"]),
                "security": len([s for s in self.knowledge_base.services.values() if s["category"] == "security"]),
                "other": len([s for s in self.knowledge_base.services.values() if s["category"] == "other"]),
            }
        }
