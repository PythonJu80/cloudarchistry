"""
AWS Knowledge Base
==================
Centralized knowledge repository for AWS services, architectures, and best practices.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class AWSKnowledgeBase:
    """
    Knowledge base containing:
    - 132 AWS services from the user's system
    - 70 reference architecture templates
    - Service relationships and connection patterns
    - Best practices and validation rules
    """
    
    def __init__(self, services_file: str = None, architectures_dir: str = None):
        """
        Initialize the AWS knowledge base.
        
        Args:
            services_file: Path to AWS services TypeScript/JSON file
            architectures_dir: Directory containing PowerPoint architecture files
        """
        self.services = {}
        self.architectures = {}
        self.service_relationships = {}
        self.best_practices = {}
        
        if services_file:
            self.load_services(services_file)
        
        if architectures_dir:
            self.load_architectures(architectures_dir)
    
    def load_services(self, services_file: str = None):
        """
        Load AWS services from the user's system.
        Supports both TypeScript and JSON formats.
        """
        logger.info("Loading AWS services")
        
        # Load AWS service URL mapping
        try:
            from aws_service_url_mapping import AWS_SERVICE_URL_MAPPING
            
            # Convert to service metadata format
            for service_id, url_patterns in AWS_SERVICE_URL_MAPPING.items():
                self.services[service_id] = {
                    "id": service_id,
                    "name": self._format_service_name(service_id),
                    "url_patterns": url_patterns,
                    "category": self._infer_category(service_id),
                }
            
            logger.info(f"Loaded {len(self.services)} AWS services")
        except ImportError as e:
            logger.warning(f"Could not load AWS service mapping: {e}")
            logger.info("Agent will run with 0 services")
    
    def load_architectures(self, architectures_dir: str):
        """
        Load reference architectures from converted JSON files (with full diagram structure).
        Falls back to PPTX file paths if JSON not available.
        """
        import json
        logger.info(f"Loading architectures from {architectures_dir}")
        
        arch_path = Path(architectures_dir)
        if not arch_path.exists():
            logger.warning(f"Architecture directory not found: {architectures_dir}")
            return
        
        # First, try to load from converted JSON files (these have positions and structure)
        converted_dir = arch_path / "converted"
        json_loaded = 0
        
        if converted_dir.exists():
            json_files = list(converted_dir.glob("*.json"))
            for json_file in json_files:
                # Skip macOS metadata files
                if json_file.name.startswith("._"):
                    continue
                arch_id = json_file.stem
                try:
                    with open(json_file, 'r') as f:
                        diagram_data = json.load(f)
                    
                    self.architectures[arch_id] = {
                        "id": arch_id,
                        "name": self._format_architecture_name(arch_id),
                        "file_path": str(json_file),
                        "diagram": diagram_data,  # Full diagram with nodes, edges, positions
                        "loaded": True,
                    }
                    json_loaded += 1
                except Exception as e:
                    logger.warning(f"Failed to load {json_file}: {e}")
            
            logger.info(f"Loaded {json_loaded} reference architectures from JSON")
        
        # Also find PPTX files that don't have JSON conversions yet
        pptx_files = list(arch_path.glob("*.pptx"))
        for pptx_file in pptx_files:
            # Skip macOS metadata files
            if pptx_file.name.startswith("._"):
                continue
            arch_id = pptx_file.stem
            if arch_id not in self.architectures:
                self.architectures[arch_id] = {
                    "id": arch_id,
                    "name": self._format_architecture_name(arch_id),
                    "file_path": str(pptx_file),
                    "loaded": False,  # Will be parsed on-demand
                }
        
        logger.info(f"Total reference architectures: {len(self.architectures)} ({json_loaded} with full diagrams)")
    
    def get_service(self, service_id: str) -> Optional[Dict]:
        """Get service metadata by ID."""
        return self.services.get(service_id)
    
    def search_services(self, query: str) -> List[Dict]:
        """Search services by name or ID."""
        query_lower = query.lower()
        results = []
        
        for service_id, service in self.services.items():
            if query_lower in service_id.lower() or query_lower in service["name"].lower():
                results.append(service)
        
        return results
    
    def get_architecture(self, arch_id: str) -> Optional[Dict]:
        """Get architecture metadata by ID."""
        return self.architectures.get(arch_id)
    
    def list_architectures(self, category: str = None) -> List[Dict]:
        """List all architectures, optionally filtered by category."""
        architectures = list(self.architectures.values())
        
        if category:
            # Filter by category (would need categorization logic)
            pass
        
        return architectures
    
    def get_service_relationships(self, service_id: str) -> List[Dict]:
        """
        Get common relationships for a service.
        E.g., EC2 commonly connects to: VPC, Security Groups, EBS, ALB, etc.
        """
        # This would be populated from the Neo4j graph or documentation analysis
        return self.service_relationships.get(service_id, [])
    
    def validate_connection(self, source_service: str, target_service: str) -> Dict:
        """
        Validate if a connection between two services makes sense.
        Returns validation result with suggestions.
        """
        # Check if connection is valid and common
        valid = True
        suggestions = []
        warnings = []
        
        # Example validation rules
        if source_service == "lambda" and target_service == "rds":
            warnings.append("Lambda accessing RDS should be in a VPC")
            suggestions.append("Add VPC configuration to Lambda")
        
        if source_service == "ec2" and target_service == "s3":
            suggestions.append("Consider using IAM role instead of access keys")
        
        return {
            "valid": valid,
            "suggestions": suggestions,
            "warnings": warnings,
        }
    
    def _format_service_name(self, service_id: str) -> str:
        """Convert service ID to human-readable name."""
        # Simple conversion: vpc -> VPC, ec2 -> EC2, etc.
        return service_id.upper().replace("-", " ").title()
    
    def _format_architecture_name(self, arch_id: str) -> str:
        """Convert architecture ID to human-readable name."""
        return arch_id.replace("-", " ").title()
    
    def _infer_category(self, service_id: str) -> str:
        """Infer service category from ID."""
        # Basic categorization logic
        compute_services = ["ec2", "lambda", "ecs", "eks", "fargate", "batch", "lightsail"]
        storage_services = ["s3", "ebs", "efs", "fsx", "glacier", "backup"]
        database_services = ["rds", "dynamodb", "aurora", "elasticache", "redshift", "neptune", "documentdb"]
        networking_services = ["vpc", "cloudfront", "route53", "alb", "nlb", "vpn-gateway", "direct-connect"]
        security_services = ["iam", "kms", "secrets-manager", "cognito", "waf", "shield", "guardduty"]
        
        if service_id in compute_services:
            return "compute"
        elif service_id in storage_services:
            return "storage"
        elif service_id in database_services:
            return "database"
        elif service_id in networking_services:
            return "networking"
        elif service_id in security_services:
            return "security"
        else:
            return "other"
    
    def get_best_practices(self, service_id: str) -> List[str]:
        """Get best practices for a specific service."""
        # This would be populated from documentation chunks
        practices = {
            "ec2": [
                "Use Auto Scaling for high availability",
                "Enable detailed monitoring",
                "Use IAM roles instead of access keys",
                "Keep instances in private subnets",
            ],
            "s3": [
                "Enable versioning for important data",
                "Use bucket policies and IAM policies together",
                "Enable encryption at rest",
                "Use lifecycle policies to manage costs",
            ],
            "rds": [
                "Enable automated backups",
                "Use Multi-AZ for production",
                "Keep in private subnets",
                "Use security groups to restrict access",
            ],
        }
        
        return practices.get(service_id, [])
    
    def suggest_architecture(self, requirements: str) -> List[Dict]:
        """
        Suggest reference architectures based on requirements.
        Uses semantic search on architecture descriptions.
        """
        # This would use embeddings to find similar architectures
        # For now, return all architectures
        return list(self.architectures.values())[:5]
