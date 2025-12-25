"""
LLM-Based Diagram Generator
============================
Generates AWS architecture diagrams from natural language descriptions using OpenAI.
Inspired by pptAgent's code generation pattern with retry mechanism.
"""

import json
import re
import logging
from typing import Dict, Optional
from openai import OpenAI

logger = logging.getLogger(__name__)


class LLMDiagramGenerator:
    """
    Generates React Flow diagrams from text descriptions using OpenAI.
    Uses code generation pattern with error feedback and retry mechanism.
    """
    
    def __init__(self, api_key: str, model: str = "gpt-4.1"):
        """
        Initialize LLM diagram generator.
        
        Args:
            api_key: OpenAI API key
            model: Model to use (default: gpt-4.1)
        """
        import httpx
        # Use httpx client without proxies to avoid version conflicts
        http_client = httpx.Client()
        self.client = OpenAI(api_key=api_key, http_client=http_client)
        self.model = model
        self.max_retries = 3
    
    def generate_diagram_with_explanation(self, description: str, services_list: list = None) -> Dict:
        """
        Generate a React Flow diagram AND an explanation from text description.
        Creates original diagrams dynamically based on the description.
        
        Args:
            description: Natural language description of architecture
            services_list: List of available AWS services (optional)
            
        Returns:
            Dict with 'diagram' (nodes/edges) and 'explanation' (markdown text)
        """
        logger.info(f"Generating diagram with explanation: {description[:100]}...")
        
        # First generate the diagram
        diagram = self.generate_diagram(description, services_list)
        
        if diagram.get("error"):
            return {
                "diagram": diagram,
                "explanation": f"Failed to generate diagram: {diagram.get('error')}"
            }
        
        # Now generate an explanation of the diagram
        explanation = self._generate_explanation(description, diagram)
        
        return {
            "diagram": diagram,
            "explanation": explanation
        }
    
    def _generate_explanation(self, description: str, diagram: Dict) -> str:
        """Generate a markdown explanation of the architecture diagram."""
        try:
            # Extract service names from diagram
            services = []
            for node in diagram.get("nodes", []):
                if node.get("type") == "awsService":
                    label = node.get("data", {}).get("label", "")
                    desc = node.get("data", {}).get("description", "")
                    service_id = node.get("data", {}).get("service_id", "")
                    if label:
                        services.append({"name": label, "description": desc, "id": service_id})
            
            # Build explanation prompt
            explanation_prompt = f"""You are an AWS Solutions Architect explaining an architecture diagram to a student.

The user requested: "{description}"

The diagram contains these AWS services:
{chr(10).join([f"- **{s['name']}**: {s['description']}" for s in services])}

Write a clear, educational explanation of this architecture:
1. Start with a brief overview of what this architecture does
2. Explain each numbered step in the data flow
3. Describe why each service was chosen
4. Mention any best practices or considerations
5. Keep it concise but informative (3-4 paragraphs)

Use markdown formatting with headers and bullet points."""

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "user", "content": explanation_prompt}
                ],
                temperature=0.8,
                max_tokens=1000
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.warning(f"Failed to generate explanation: {e}")
            # Return a basic explanation if LLM fails
            service_names = [s['name'] for s in services] if services else []
            return f"This architecture uses {', '.join(service_names)} to implement {description}."

    def generate_diagram(self, description: str, services_list: list = None) -> Dict:
        """
        Generate a React Flow diagram from text description.
        
        Args:
            description: Natural language description of architecture
            services_list: List of available AWS services (optional)
            
        Returns:
            React Flow diagram with nodes and edges
        """
        logger.info(f"Generating diagram from description: {description[:100]}...")
        
        # Build system prompt with AWS knowledge
        system_prompt = self._build_system_prompt(services_list)
        
        # Build user prompt
        user_prompt = self._build_user_prompt(description)
        
        # Try to generate diagram with retries
        for attempt in range(self.max_retries):
            try:
                logger.info(f"Generation attempt {attempt + 1}/{self.max_retries}")
                
                # Call OpenAI
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.7,
                    max_tokens=10000,
                    response_format={"type": "json_object"}
                )
                
                # Extract JSON from response
                content = response.choices[0].message.content
                diagram = self._extract_json(content)
                
                # Validate diagram structure
                self._validate_diagram(diagram)
                
                logger.info(f"Successfully generated diagram with {len(diagram.get('nodes', []))} nodes")
                return diagram
                
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed: {e}")
                
                if attempt < self.max_retries - 1:
                    # Update prompt with error feedback
                    user_prompt = self._build_retry_prompt(description, str(e))
                else:
                    # Final attempt failed
                    logger.error(f"Failed to generate diagram after {self.max_retries} attempts")
                    return {
                        "nodes": [],
                        "edges": [],
                        "error": f"Generation failed: {str(e)}"
                    }
        
        return {"nodes": [], "edges": [], "error": "Unknown error"}
    
    def _build_system_prompt(self, services_list: list = None) -> str:
        """Build system prompt with AWS architecture knowledge."""
        prompt = """You are an expert AWS Solutions Architect. Design complete, production-grade AWS architectures.

Return JSON with "services" array and "connections" array.

Each service object needs: id (svc1, svc2...), service_id (the AWS service), label (descriptive name), tier (string for layout).

VALID tier values (MUST be one of these strings):
- "edge" = External/CDN services (CloudFront, Route53, WAF)
- "public" = Public-facing services in public subnet (ALB, NLB, API Gateway, NAT Gateway)
- "compute" = Application/compute tier in private subnet (EC2, Lambda, ECS, EKS, Fargate)
- "data" = Data/storage tier in private subnet (RDS, DynamoDB, S3, ElastiCache, Aurora)
- "security" = Security services (IAM, Cognito, KMS, Secrets Manager, GuardDuty)
- "integration" = Integration/messaging services (SQS, SNS, EventBridge, Step Functions)

VALID service_id: ec2, lambda, dynamodb, rds, s3, api-gateway, cloudfront, alb, nlb, ecs, eks, sqs, sns, kinesis-streams, kinesis-firehose, elasticache, cloudwatch, cognito, waf, route53, vpc, iam, step-functions, eventbridge, appsync, athena, glue, emr, redshift, neptune, documentdb, aurora, fargate, ecr, secrets-manager, kms, guardduty, shield, nat-gateway, internet-gateway, auto-scaling, batch, opensearch, msk, acm, ses, backup, xray, cloudtrail, config

Connections: {"from": "svc1", "to": "svc2"}

Design the architecture YOU would build as a Solutions Architect. Include everything needed for production: networking, compute, databases, caching, queues, security, monitoring, DR, backups. Be thorough.

"""
        
        if services_list:
            prompt += f"\nAvailable AWS services: {', '.join(services_list[:50])}\n"
        
        return prompt
    
    def _build_user_prompt(self, description: str) -> str:
        """Build user prompt from description."""
        return f"""Create an AWS architecture diagram for:

{description}

Generate the React Flow JSON now (JSON only, no markdown):"""
    
    def _build_retry_prompt(self, description: str, error: str) -> str:
        """Build retry prompt with error feedback."""
        return f"""Previous attempt failed with error:
{error}

Please try again to create an AWS architecture diagram for:

{description}

Generate valid React Flow JSON (JSON only, no markdown):"""
    
    def _extract_json(self, content: str) -> Dict:
        """Extract JSON from LLM response, handling markdown code blocks."""
        # Remove markdown code blocks if present
        content = re.sub(r'```json\s*', '', content)
        content = re.sub(r'```\s*', '', content)
        content = content.strip()
        
        # Try to parse JSON
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            # Try to find JSON object in content
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
            raise ValueError(f"Could not extract valid JSON: {e}")
    
    def _validate_diagram(self, diagram: Dict):
        """Validate diagram structure and convert new format if needed."""
        if not isinstance(diagram, dict):
            raise ValueError("Diagram must be a dictionary")
        
        # New format: services/connections - convert to nodes/edges
        if "services" in diagram:
            services = diagram.get("services", [])
            connections = diagram.get("connections", [])
            
            if not isinstance(services, list):
                raise ValueError("'services' must be a list")
            
            # Convert services to nodes (frontend will handle positioning)
            nodes = []
            for svc in services:
                if not isinstance(svc, dict) or "id" not in svc:
                    continue
                nodes.append({
                    "id": svc["id"],
                    "type": "awsService",
                    "data": {
                        "label": svc.get("label", ""),
                        "service_id": svc.get("service_id", ""),
                        "tier": svc.get("tier", "compute"),
                    }
                })
            
            # Convert connections to edges
            edges = []
            for i, conn in enumerate(connections if isinstance(connections, list) else []):
                if isinstance(conn, dict) and "from" in conn and "to" in conn:
                    edges.append({
                        "id": f"edge-{i}",
                        "source": conn["from"],
                        "target": conn["to"],
                    })
            
            # Replace with converted format
            diagram["nodes"] = nodes
            diagram["edges"] = edges
            diagram["services"] = services  # Keep for frontend template engine
            diagram["connections"] = connections
            return
        
        # Old format: nodes/edges
        if "nodes" not in diagram:
            raise ValueError("Diagram must have 'nodes' or 'services' key")
        
        if "edges" not in diagram:
            diagram["edges"] = []
        
        if not isinstance(diagram["nodes"], list):
            raise ValueError("'nodes' must be a list")
        
        if not isinstance(diagram["edges"], list):
            raise ValueError("'edges' must be a list")
    
    def enhance_diagram_with_validation(
        self, 
        diagram: Dict, 
        validation_results: Dict
    ) -> Dict:
        """
        Enhance diagram based on validation results.
        Uses LLM to suggest improvements.
        
        Args:
            diagram: Original diagram
            validation_results: Results from validation
            
        Returns:
            Enhanced diagram with improvements
        """
        if validation_results.get("valid"):
            return diagram
        
        logger.info("Enhancing diagram based on validation feedback")
        
        # Build prompt with validation feedback
        prompt = f"""The following AWS architecture diagram has validation issues:

Original diagram:
{json.dumps(diagram, indent=2)}

Validation results:
- Warnings: {validation_results.get('warnings', [])}
- Suggestions: {validation_results.get('suggestions', [])}

Please improve the diagram by addressing these issues. Add missing components like VPC, load balancers, etc.

Generate the improved React Flow JSON (JSON only, no markdown):"""
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self._build_system_prompt()},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2000
            )
            
            content = response.choices[0].message.content
            enhanced = self._extract_json(content)
            self._validate_diagram(enhanced)
            
            logger.info("Successfully enhanced diagram")
            return enhanced
            
        except Exception as e:
            logger.error(f"Failed to enhance diagram: {e}")
            return diagram
