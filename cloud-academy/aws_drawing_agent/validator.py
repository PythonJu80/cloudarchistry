"""
Architecture Validator
======================
Validates AWS architectures against best practices and security standards.
"""

import logging
from typing import Dict, List

logger = logging.getLogger(__name__)


class ArchitectureValidator:
    """
    Validates AWS architecture diagrams against:
    - AWS Well-Architected Framework
    - Security best practices
    - Cost optimization
    - Performance guidelines
    """
    
    def __init__(self):
        """Initialize validator with rules and best practices."""
        self.rules = self._load_validation_rules()
    
    def validate(self, diagram: Dict) -> Dict:
        """
        Validate a diagram against all rules.
        
        Args:
            diagram: React Flow diagram with nodes and edges
            
        Returns:
            Validation results with warnings and suggestions
        """
        logger.info("Validating architecture diagram")
        
        results = {
            "valid": True,
            "warnings": [],
            "suggestions": [],
            "best_practices": [],
        }
        
        # Extract services from diagram
        services = self._extract_services(diagram)
        
        # Run validation rules
        for rule in self.rules:
            rule_result = rule(services, diagram)
            if rule_result:
                results["warnings"].extend(rule_result.get("warnings", []))
                results["suggestions"].extend(rule_result.get("suggestions", []))
        
        results["valid"] = len(results["warnings"]) == 0
        
        return results
    
    def _extract_services(self, diagram: Dict) -> List[str]:
        """Extract service IDs from diagram nodes."""
        services = []
        for node in diagram.get("nodes", []):
            service_id = node.get("data", {}).get("service_id")
            if service_id:
                services.append(service_id)
        return services
    
    def _load_validation_rules(self) -> List:
        """Load validation rules."""
        # Return list of validation functions
        return [
            self._validate_vpc_usage,
            self._validate_high_availability,
            self._validate_security,
        ]
    
    def _validate_vpc_usage(self, services: List[str], diagram: Dict) -> Dict:
        """Validate VPC usage for services that require it."""
        warnings = []
        
        if "ec2" in services and "vpc" not in services:
            warnings.append("EC2 instances should be in a VPC")
        
        if "rds" in services and "vpc" not in services:
            warnings.append("RDS should be in a VPC")
        
        return {"warnings": warnings}
    
    def _validate_high_availability(self, services: List[str], diagram: Dict) -> Dict:
        """Validate high availability setup."""
        suggestions = []
        
        if "ec2" in services and "alb" not in services and "nlb" not in services:
            suggestions.append("Consider adding a load balancer for high availability")
        
        if "rds" in services:
            suggestions.append("Consider using Multi-AZ for RDS in production")
        
        return {"suggestions": suggestions}
    
    def _validate_security(self, services: List[str], diagram: Dict) -> Dict:
        """Validate security best practices."""
        suggestions = []
        
        if "lambda" in services and "rds" in services:
            suggestions.append("Lambda accessing RDS should be in a VPC")
        
        if "ec2" in services and "s3" in services:
            suggestions.append("Consider using IAM roles instead of access keys")
        
        return {"suggestions": suggestions}
