"""
CloudMigrate Learning Agent
============================
Unified AI agent combining:
- Web crawling and RAG (Crawl4AI)
- AWS services knowledge graph (Neo4j)
- Learning scenario generation (Sophia persona)
- Flashcards, notes, quizzes generation
- Interactive coaching chat
"""
from fastapi import FastAPI, Body, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import CrossEncoder
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse, urldefrag
from xml.etree import ElementTree
from dotenv import load_dotenv
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import requests
import asyncio
import json
import os
import re
import concurrent.futures
import uvicorn
import uuid
import logging
import httpx

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode, MemoryAdaptiveDispatcher

from utils import (
    add_documents_to_supabase as add_documents_to_db,
    search_documents,
    extract_code_blocks,
    generate_code_example_summary,
    add_code_examples_to_supabase as add_code_examples_to_db,
    update_source_info,
    extract_source_summary,
    search_code_examples,
    ApiKeyRequiredError,
)

# Neo4j driver for AWS services knowledge graph
from neo4j import AsyncGraphDatabase

# Redis-based job queue with rate limiting
from redis_jobs import (
    create_crawl_job as redis_create_job,
    get_crawl_job as redis_get_job,
    update_crawl_job as redis_update_job,
    check_tenant_rate_limit,
    get_tenant_crawl_stats,
    list_tenant_jobs
)

# OpenAI for chat agent
from openai import OpenAI, AsyncOpenAI

# ============================================
# OPENAI MODEL CONFIGURATION
# ============================================

# Available models for tenant selection
AVAILABLE_MODELS = {
    "gpt-5.1": {
        "id": "gpt-5.1",
        "name": "GPT-5.1",
        "description": "The best model for coding and agentic tasks with configurable reasoning effort",
        "tier": "premium",
        "context_window": 128000,
    },
    "gpt-5-mini": {
        "id": "gpt-5-mini",
        "name": "GPT-5 mini",
        "description": "A faster, cost-efficient version of GPT-5 for well-defined tasks",
        "tier": "standard",
        "context_window": 128000,
    },
    "gpt-5-nano": {
        "id": "gpt-5-nano",
        "name": "GPT-5 nano",
        "description": "Fastest, most cost-efficient version of GPT-5",
        "tier": "basic",
        "context_window": 64000,
    },
    "gpt-5-pro": {
        "id": "gpt-5-pro",
        "name": "GPT-5 pro",
        "description": "Version of GPT-5 that produces smarter and more precise responses",
        "tier": "enterprise",
        "context_window": 256000,
    },
    "gpt-5": {
        "id": "gpt-5",
        "name": "GPT-5",
        "description": "Previous intelligent reasoning model for coding and agentic tasks",
        "tier": "premium",
        "context_window": 128000,
    },
    "gpt-4.1": {
        "id": "gpt-4.1",
        "name": "GPT-4.1",
        "description": "Smartest non-reasoning model",
        "tier": "standard",
        "context_window": 128000,
    },
}

# Default model when tenant hasn't configured one
DEFAULT_MODEL = "gpt-4.1"

# Cache for tenant OpenAI clients (tenant_id -> AsyncOpenAI)
_tenant_clients: Dict[str, AsyncOpenAI] = {}


async def get_tenant_openai_config(tenant_id: str) -> Optional[Dict[str, Any]]:
    """Get tenant's OpenAI configuration from database."""
    try:
        config = await db.get_tenant_ai_config(tenant_id)
        return config
    except Exception as e:
        logger.warning(f"Failed to get tenant AI config: {e}")
        return None


async def get_openai_client_for_tenant(
    tenant_id: Optional[str] = None,
    user_id: Optional[str] = None
) -> tuple[AsyncOpenAI, str]:
    """
    Get OpenAI client and model for a tenant/user.
    
    Priority:
    1. User's own API key (if set in AcademyUserProfile)
    2. Tenant's API key (if set in Tenant)
    
    No fallback to environment variable - user must configure their own key.
    
    Returns: (client, model_id)
    """
    api_key = None
    model = DEFAULT_MODEL
    
    # Try user-level config first
    if user_id:
        try:
            user_config = await db.get_user_ai_config(user_id)
            if user_config and user_config.get("openai_api_key"):
                api_key = user_config["openai_api_key"]
                model = user_config.get("preferred_model", DEFAULT_MODEL)
                logger.debug(f"Using user's own OpenAI key for {user_id}")
        except Exception as e:
            logger.debug(f"No user AI config: {e}")
    
    # Try tenant-level config
    if not api_key and tenant_id:
        try:
            tenant_config = await db.get_tenant_ai_config(tenant_id)
            if tenant_config and tenant_config.get("openai_api_key"):
                api_key = tenant_config["openai_api_key"]
                model = tenant_config.get("preferred_model", DEFAULT_MODEL)
                logger.debug(f"Using tenant's OpenAI key for {tenant_id}")
        except Exception as e:
            logger.debug(f"No tenant AI config: {e}")
    
    # No fallback - require user/tenant to configure their own key
    if not api_key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Please configure your API key in Settings."
        )
    
    # Validate model exists
    if model not in AVAILABLE_MODELS:
        model = DEFAULT_MODEL
    
    # Create or get cached client
    cache_key = f"{tenant_id or 'system'}:{user_id or 'default'}:{api_key[:8]}"
    if cache_key not in _tenant_clients:
        _tenant_clients[cache_key] = AsyncOpenAI(api_key=api_key)
    
    return _tenant_clients[cache_key], model


# Agent prompts
from agent_prompt import SYSTEM_PROMPT, TOOL_DESCRIPTIONS
from prompts import (
    SOPHIA_PERSONA,
    SKILL_DETECTOR_PROMPT,
    SCENARIO_GENERATOR_PROMPT,
    COACH_CHAT_PROMPT,
    SOLUTION_EVALUATOR_PROMPT,
    RAG_CONTEXT_PROMPT,
    AWS_PERSONAS,
    DEFAULT_PERSONA,
    get_persona_prompt,
    get_persona_info,
    get_persona_context,
    PERSONA_SCENARIO_PROMPT,
    PERSONA_FLASHCARD_PROMPT,
    PERSONA_QUIZ_PROMPT,
    PERSONA_NOTES_PROMPT,
    PERSONA_COACH_PROMPT,
)

# Database
import db

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("cloudmigrate-agent")

# Load environment variables from the project root .env file
project_root = Path(__file__).resolve().parent.parent
dotenv_path = project_root / '.env'

# Force override of existing environment variables
load_dotenv(dotenv_path, override=True)

# Helper functions for Neo4j validation and error handling
def validate_neo4j_connection() -> bool:
    """Check if Neo4j environment variables are configured."""
    return all([
        os.getenv("NEO4J_URI"),
        os.getenv("NEO4J_USER"),
        os.getenv("NEO4J_PASSWORD")
    ])

def format_neo4j_error(error: Exception) -> str:
    """Format Neo4j connection errors for user-friendly messages."""
    error_str = str(error).lower()
    if "authentication" in error_str or "unauthorized" in error_str:
        return "Neo4j authentication failed. Check NEO4J_USER and NEO4J_PASSWORD."
    elif "connection" in error_str or "refused" in error_str or "timeout" in error_str:
        return "Cannot connect to Neo4j. Check NEO4J_URI and ensure Neo4j is running."
    elif "database" in error_str:
        return "Neo4j database error. Check if the database exists and is accessible."
    else:
        return f"Neo4j error: {str(error)}"

# AWS Services list for extraction
AWS_SERVICES = {
    # Compute
    "EC2": "Compute", "Lambda": "Compute", "ECS": "Compute", "EKS": "Compute", 
    "Fargate": "Compute", "Lightsail": "Compute", "Batch": "Compute", "Elastic Beanstalk": "Compute",
    "App Runner": "Compute", "Outposts": "Compute",
    # Storage
    "S3": "Storage", "EBS": "Storage", "EFS": "Storage", "FSx": "Storage", 
    "Storage Gateway": "Storage", "Backup": "Storage", "Snow Family": "Storage",
    # Database
    "RDS": "Database", "DynamoDB": "Database", "Aurora": "Database", "ElastiCache": "Database",
    "Neptune": "Database", "DocumentDB": "Database", "Keyspaces": "Database", "QLDB": "Database",
    "Timestream": "Database", "MemoryDB": "Database", "Redshift": "Database",
    # Networking
    "VPC": "Networking", "CloudFront": "Networking", "Route 53": "Networking", 
    "API Gateway": "Networking", "Direct Connect": "Networking", "Global Accelerator": "Networking",
    "Transit Gateway": "Networking", "PrivateLink": "Networking", "App Mesh": "Networking",
    "Cloud Map": "Networking", "ELB": "Networking", "ALB": "Networking", "NLB": "Networking",
    # Security
    "IAM": "Security", "Cognito": "Security", "Secrets Manager": "Security", 
    "KMS": "Security", "CloudHSM": "Security", "WAF": "Security", "Shield": "Security",
    "GuardDuty": "Security", "Inspector": "Security", "Macie": "Security",
    "Security Hub": "Security", "Detective": "Security", "Firewall Manager": "Security",
    # Management
    "CloudWatch": "Management", "CloudTrail": "Management", "Config": "Management",
    "Systems Manager": "Management", "CloudFormation": "Management", "Service Catalog": "Management",
    "Trusted Advisor": "Management", "Control Tower": "Management", "Organizations": "Management",
    "License Manager": "Management", "Cost Explorer": "Management",
    # Migration
    "Migration Hub": "Migration", "Application Migration Service": "Migration", 
    "Database Migration Service": "Migration", "DMS": "Migration", "DataSync": "Migration",
    "Transfer Family": "Migration", "Snow Family": "Migration", "Application Discovery Service": "Migration",
    # Analytics
    "Athena": "Analytics", "EMR": "Analytics", "Kinesis": "Analytics", "QuickSight": "Analytics",
    "Data Pipeline": "Analytics", "Glue": "Analytics", "Lake Formation": "Analytics",
    "MSK": "Analytics", "OpenSearch": "Analytics", "Elasticsearch": "Analytics",
    # AI/ML
    "SageMaker": "AI/ML", "Rekognition": "AI/ML", "Comprehend": "AI/ML", "Polly": "AI/ML",
    "Transcribe": "AI/ML", "Translate": "AI/ML", "Lex": "AI/ML", "Personalize": "AI/ML",
    "Forecast": "AI/ML", "Textract": "AI/ML", "Bedrock": "AI/ML", "CodeWhisperer": "AI/ML",
    # Integration
    "SQS": "Integration", "SNS": "Integration", "EventBridge": "Integration", 
    "Step Functions": "Integration", "MQ": "Integration", "AppFlow": "Integration",
    # Developer Tools
    "CodeCommit": "Developer Tools", "CodeBuild": "Developer Tools", "CodeDeploy": "Developer Tools",
    "CodePipeline": "Developer Tools", "CodeArtifact": "Developer Tools", "X-Ray": "Developer Tools",
    "Cloud9": "Developer Tools", "CloudShell": "Developer Tools",
}

# Common relationship patterns between AWS services
AWS_RELATIONSHIP_PATTERNS = [
    # Compute relationships
    (["Lambda"], ["S3", "DynamoDB", "SQS", "SNS", "API Gateway", "EventBridge", "Kinesis"], "TRIGGERS"),
    (["EC2", "ECS", "EKS"], ["ELB", "ALB", "NLB"], "BEHIND"),
    (["EC2", "ECS", "EKS", "Lambda"], ["RDS", "Aurora", "DynamoDB", "ElastiCache"], "CONNECTS_TO"),
    (["EC2", "ECS", "EKS"], ["EBS", "EFS"], "USES_STORAGE"),
    # Storage relationships
    (["S3"], ["CloudFront"], "DISTRIBUTED_BY"),
    (["S3"], ["Lambda", "Glue", "Athena"], "TRIGGERS"),
    # Database relationships
    (["RDS", "Aurora"], ["Secrets Manager"], "STORES_CREDENTIALS_IN"),
    (["DynamoDB"], ["DAX"], "CACHED_BY"),
    # Security relationships
    (["EC2", "ECS", "EKS", "Lambda", "RDS"], ["IAM"], "AUTHENTICATED_BY"),
    (["Secrets Manager", "KMS"], ["RDS", "Aurora", "S3", "EBS"], "ENCRYPTS"),
    (["CloudFront", "ALB", "API Gateway"], ["WAF"], "PROTECTED_BY"),
    # Monitoring relationships
    (["EC2", "ECS", "EKS", "Lambda", "RDS", "DynamoDB"], ["CloudWatch"], "MONITORED_BY"),
    (["CloudWatch"], ["SNS"], "ALERTS_VIA"),
    # Migration relationships
    (["Migration Hub"], ["Application Migration Service", "Database Migration Service", "DMS"], "TRACKS"),
    (["DMS"], ["RDS", "Aurora", "DynamoDB", "Redshift"], "MIGRATES_TO"),
]

# Default tenant ID for Neo4j (Community Edition - single DB, use tenant_id property)
DEFAULT_TENANT_ID = "cmiq0pitp0001w5fml5rwn1xe"  # Anais Solutions

async def extract_aws_services_to_neo4j(content: str, source_url: str, neo4j_driver, tenant_id: str = None) -> Dict[str, Any]:
    """Extract AWS service mentions from content and store relationships in Neo4j.
    
    Multi-tenant isolation: All nodes have tenant_id property for filtering.
    Community Edition doesn't support multiple databases, so we use property-based isolation.
    """
    if not neo4j_driver:
        return {"extracted": 0, "relationships": 0}
    
    tenant_id = tenant_id or DEFAULT_TENANT_ID
    
    # Find all mentioned services
    mentioned_services = set()
    content_lower = content.lower()
    
    for service, category in AWS_SERVICES.items():
        # Check for service name (case insensitive)
        if service.lower() in content_lower:
            mentioned_services.add(service)
        # Also check for "AWS <service>" pattern
        if f"aws {service.lower()}" in content_lower:
            mentioned_services.add(service)
        # Check for "Amazon <service>" pattern
        if f"amazon {service.lower()}" in content_lower:
            mentioned_services.add(service)
    
    if not mentioned_services:
        return {"extracted": 0, "relationships": 0}
    
    relationships_created = 0
    
    try:
        async with neo4j_driver.session() as session:
            # Create/update service nodes (scoped by tenant_id)
            for service in mentioned_services:
                category = AWS_SERVICES.get(service, "Other")
                await session.run("""
                    MERGE (s:AWSService {name: $name, tenant_id: $tenant_id})
                    SET s.category = $category,
                        s.last_seen = datetime(),
                        s.mention_count = COALESCE(s.mention_count, 0) + 1
                """, name=service, category=category, tenant_id=tenant_id)
            
            # Create relationships based on co-occurrence and known patterns
            service_list = list(mentioned_services)
            for i, service1 in enumerate(service_list):
                for service2 in service_list[i+1:]:
                    # Check if there's a known relationship pattern
                    for sources, targets, rel_type in AWS_RELATIONSHIP_PATTERNS:
                        if service1 in sources and service2 in targets:
                            await session.run(f"""
                                MATCH (s1:AWSService {{name: $s1, tenant_id: $tenant_id}}), 
                                      (s2:AWSService {{name: $s2, tenant_id: $tenant_id}})
                                MERGE (s1)-[r:{rel_type}]->(s2)
                                SET r.source_url = $url, r.updated = datetime()
                            """, s1=service1, s2=service2, url=source_url, tenant_id=tenant_id)
                            relationships_created += 1
                        elif service2 in sources and service1 in targets:
                            await session.run(f"""
                                MATCH (s1:AWSService {{name: $s1, tenant_id: $tenant_id}}), 
                                      (s2:AWSService {{name: $s2, tenant_id: $tenant_id}})
                                MERGE (s1)-[r:{rel_type}]->(s2)
                                SET r.source_url = $url, r.updated = datetime()
                            """, s1=service2, s2=service1, url=source_url, tenant_id=tenant_id)
                            relationships_created += 1
                    
                    # Also create a generic CO_MENTIONED relationship for co-occurring services
                    await session.run("""
                        MATCH (s1:AWSService {name: $s1, tenant_id: $tenant_id}), 
                              (s2:AWSService {name: $s2, tenant_id: $tenant_id})
                        MERGE (s1)-[r:CO_MENTIONED]-(s2)
                        SET r.count = COALESCE(r.count, 0) + 1,
                            r.last_url = $url
                    """, s1=service1, s2=service2, url=source_url, tenant_id=tenant_id)
            
            # Link services to source document (scoped by tenant_id)
            await session.run("""
                MERGE (d:Document {url: $url, tenant_id: $tenant_id})
                SET d.crawled_at = datetime()
            """, url=source_url, tenant_id=tenant_id)
            
            for service in mentioned_services:
                await session.run("""
                    MATCH (s:AWSService {name: $service, tenant_id: $tenant_id}), 
                          (d:Document {url: $url, tenant_id: $tenant_id})
                    MERGE (d)-[:MENTIONS]->(s)
                """, service=service, url=source_url, tenant_id=tenant_id)
        
        return {"extracted": len(mentioned_services), "relationships": relationships_created, "services": list(mentioned_services)}
    
    except Exception as e:
        print(f"Error extracting AWS services to Neo4j: {e}")
        return {"extracted": 0, "relationships": 0, "error": str(e)}


# ============================================
# LEARNING JOURNEY GRAPH (Neo4j)
# ============================================

async def track_learner_scenario_start(
    neo4j_driver,
    profile_id: str,
    tenant_id: str,
    scenario_id: str,
    scenario_title: str,
    company_name: str,
    difficulty: str,
    aws_services: List[str] = None
) -> Dict[str, Any]:
    """Track when a learner starts a scenario in the knowledge graph."""
    if not neo4j_driver:
        return {"success": False, "error": "Neo4j not available"}
    
    try:
        async with neo4j_driver.session() as session:
            # Create/merge learner and scenario nodes, create relationship
            result = await session.run("""
                MERGE (l:Learner {id: $profile_id, tenant_id: $tenant_id})
                MERGE (s:Scenario {id: $scenario_id, tenant_id: $tenant_id})
                ON CREATE SET s.title = $title, s.company = $company, s.difficulty = $difficulty
                MERGE (l)-[r:STARTED]->(s)
                ON CREATE SET r.at = datetime()
                WITH s
                UNWIND $aws_services AS service_name
                MERGE (aws:AWSService {name: service_name, tenant_id: $tenant_id})
                MERGE (s)-[:INVOLVES]->(aws)
                RETURN count(*) as created
            """, profile_id=profile_id, tenant_id=tenant_id, scenario_id=scenario_id,
                title=scenario_title, company=company_name, difficulty=difficulty,
                aws_services=aws_services or [])
            
            return {"success": True, "scenario_id": scenario_id}
    except Exception as e:
        logger.error(f"Error tracking scenario start: {e}")
        return {"success": False, "error": str(e)}


async def track_challenge_completion(
    neo4j_driver,
    profile_id: str,
    tenant_id: str,
    scenario_id: str,
    challenge_id: str,
    challenge_title: str,
    score: int,
    passed: bool,
    aws_services: List[str] = None
) -> Dict[str, Any]:
    """Track when a learner completes a challenge."""
    if not neo4j_driver:
        return {"success": False, "error": "Neo4j not available"}
    
    try:
        async with neo4j_driver.session() as session:
            result = await session.run("""
                MATCH (l:Learner {id: $profile_id, tenant_id: $tenant_id})
                MATCH (s:Scenario {id: $scenario_id, tenant_id: $tenant_id})
                MERGE (c:Challenge {id: $challenge_id, tenant_id: $tenant_id})
                ON CREATE SET c.title = $title
                MERGE (s)-[:CONTAINS]->(c)
                MERGE (l)-[r:COMPLETED]->(c)
                SET r.score = $score, r.passed = $passed, r.at = datetime()
                WITH l, c
                UNWIND $aws_services AS service_name
                MERGE (aws:AWSService {name: service_name, tenant_id: $tenant_id})
                MERGE (c)-[:TEACHES]->(aws)
                MERGE (l)-[learned:LEARNED]->(aws)
                ON CREATE SET learned.first_exposure = datetime()
                SET learned.last_practiced = datetime(),
                    learned.practice_count = COALESCE(learned.practice_count, 0) + 1
                RETURN count(*) as updated
            """, profile_id=profile_id, tenant_id=tenant_id, scenario_id=scenario_id,
                challenge_id=challenge_id, title=challenge_title, score=score, passed=passed,
                aws_services=aws_services or [])
            
            return {"success": True, "challenge_id": challenge_id}
    except Exception as e:
        logger.error(f"Error tracking challenge completion: {e}")
        return {"success": False, "error": str(e)}


async def track_flashcard_study(
    neo4j_driver,
    profile_id: str,
    tenant_id: str,
    deck_id: str,
    deck_title: str,
    cards_studied: int,
    aws_services: List[str] = None
) -> Dict[str, Any]:
    """Track flashcard study session."""
    if not neo4j_driver:
        return {"success": False, "error": "Neo4j not available"}
    
    try:
        async with neo4j_driver.session() as session:
            result = await session.run("""
                MERGE (l:Learner {id: $profile_id, tenant_id: $tenant_id})
                MERGE (d:FlashcardDeck {id: $deck_id, tenant_id: $tenant_id})
                ON CREATE SET d.title = $title
                MERGE (l)-[r:STUDIED]->(d)
                SET r.last_studied = datetime(),
                    r.total_cards_studied = COALESCE(r.total_cards_studied, 0) + $cards_studied,
                    r.session_count = COALESCE(r.session_count, 0) + 1
                WITH l
                UNWIND $aws_services AS service_name
                MERGE (aws:AWSService {name: service_name, tenant_id: $tenant_id})
                MERGE (l)-[learned:LEARNED]->(aws)
                ON CREATE SET learned.first_exposure = datetime()
                SET learned.last_practiced = datetime()
                RETURN count(*) as updated
            """, profile_id=profile_id, tenant_id=tenant_id, deck_id=deck_id,
                title=deck_title, cards_studied=cards_studied, aws_services=aws_services or [])
            
            return {"success": True}
    except Exception as e:
        logger.error(f"Error tracking flashcard study: {e}")
        return {"success": False, "error": str(e)}


async def track_quiz_attempt(
    neo4j_driver,
    profile_id: str,
    tenant_id: str,
    quiz_id: str,
    quiz_title: str,
    score: int,
    passed: bool,
    aws_services: List[str] = None
) -> Dict[str, Any]:
    """Track quiz attempt."""
    if not neo4j_driver:
        return {"success": False, "error": "Neo4j not available"}
    
    try:
        async with neo4j_driver.session() as session:
            result = await session.run("""
                MERGE (l:Learner {id: $profile_id, tenant_id: $tenant_id})
                MERGE (q:Quiz {id: $quiz_id, tenant_id: $tenant_id})
                ON CREATE SET q.title = $title
                MERGE (l)-[r:ATTEMPTED]->(q)
                SET r.last_attempt = datetime(),
                    r.best_score = CASE WHEN $score > COALESCE(r.best_score, 0) THEN $score ELSE r.best_score END,
                    r.attempts = COALESCE(r.attempts, 0) + 1,
                    r.passed = $passed OR COALESCE(r.passed, false)
                WITH l
                UNWIND $aws_services AS service_name
                MERGE (aws:AWSService {name: service_name, tenant_id: $tenant_id})
                MERGE (l)-[learned:LEARNED]->(aws)
                ON CREATE SET learned.first_exposure = datetime()
                SET learned.last_practiced = datetime()
                RETURN count(*) as updated
            """, profile_id=profile_id, tenant_id=tenant_id, quiz_id=quiz_id,
                title=quiz_title, score=score, passed=passed, aws_services=aws_services or [])
            
            return {"success": True}
    except Exception as e:
        logger.error(f"Error tracking quiz attempt: {e}")
        return {"success": False, "error": str(e)}


async def get_learner_journey(
    neo4j_driver,
    profile_id: str,
    tenant_id: str
) -> Dict[str, Any]:
    """Get a learner's complete learning journey from the graph."""
    if not neo4j_driver:
        return {"success": False, "error": "Neo4j not available"}
    
    try:
        async with neo4j_driver.session() as session:
            # Get all learned services with proficiency
            services_result = await session.run("""
                MATCH (l:Learner {id: $profile_id, tenant_id: $tenant_id})-[r:LEARNED]->(aws:AWSService)
                RETURN aws.name as service, aws.category as category,
                       r.practice_count as practice_count,
                       r.first_exposure as first_exposure,
                       r.last_practiced as last_practiced
                ORDER BY r.practice_count DESC
            """, profile_id=profile_id, tenant_id=tenant_id)
            
            services = [dict(record) for record in await services_result.data()]
            
            # Get completed scenarios
            scenarios_result = await session.run("""
                MATCH (l:Learner {id: $profile_id, tenant_id: $tenant_id})-[r:STARTED]->(s:Scenario)
                OPTIONAL MATCH (l)-[c:COMPLETED]->(ch:Challenge)<-[:CONTAINS]-(s)
                WITH s, r, count(c) as challenges_completed
                RETURN s.id as id, s.title as title, s.company as company,
                       s.difficulty as difficulty, r.at as started_at,
                       challenges_completed
                ORDER BY r.at DESC
            """, profile_id=profile_id, tenant_id=tenant_id)
            
            scenarios = [dict(record) for record in await scenarios_result.data()]
            
            # Get study stats
            stats_result = await session.run("""
                MATCH (l:Learner {id: $profile_id, tenant_id: $tenant_id})
                OPTIONAL MATCH (l)-[:COMPLETED]->(c:Challenge)
                OPTIONAL MATCH (l)-[:STUDIED]->(d:FlashcardDeck)
                OPTIONAL MATCH (l)-[:ATTEMPTED]->(q:Quiz)
                OPTIONAL MATCH (l)-[:LEARNED]->(aws:AWSService)
                RETURN count(DISTINCT c) as challenges_completed,
                       count(DISTINCT d) as decks_studied,
                       count(DISTINCT q) as quizzes_attempted,
                       count(DISTINCT aws) as services_learned
            """, profile_id=profile_id, tenant_id=tenant_id)
            
            stats = await stats_result.single()
            
            return {
                "success": True,
                "profile_id": profile_id,
                "services_learned": services,
                "scenarios": scenarios,
                "stats": dict(stats) if stats else {}
            }
    except Exception as e:
        logger.error(f"Error getting learner journey: {e}")
        return {"success": False, "error": str(e)}


async def get_recommended_next_steps(
    neo4j_driver,
    profile_id: str,
    tenant_id: str,
    limit: int = 5
) -> Dict[str, Any]:
    """Get recommended next learning steps based on the learner's journey."""
    if not neo4j_driver:
        return {"success": False, "error": "Neo4j not available"}
    
    try:
        async with neo4j_driver.session() as session:
            # Find AWS services related to what they've learned but haven't practiced much
            result = await session.run("""
                MATCH (l:Learner {id: $profile_id, tenant_id: $tenant_id})-[r:LEARNED]->(known:AWSService)
                MATCH (known)-[:INTEGRATES_WITH|CONNECTS_TO]-(related:AWSService)
                WHERE NOT EXISTS((l)-[:LEARNED]->(related))
                   OR (l)-[lr:LEARNED]->(related) AND lr.practice_count < 3
                RETURN DISTINCT related.name as service, related.category as category,
                       collect(DISTINCT known.name) as related_to,
                       'Based on your experience with ' + 
                       reduce(s = '', svc IN collect(DISTINCT known.name)[0..3] | s + svc + ', ') as reason
                ORDER BY size(collect(DISTINCT known.name)) DESC
                LIMIT $limit
            """, profile_id=profile_id, tenant_id=tenant_id, limit=limit)
            
            recommendations = [dict(record) for record in await result.data()]
            
            return {
                "success": True,
                "recommendations": recommendations
            }
    except Exception as e:
        logger.error(f"Error getting recommendations: {e}")
        return {"success": False, "error": str(e)}


# Create a dataclass for our application context
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

# ============================================
# CRAWL JOB TRACKING (Redis-based)
# ============================================

# Job functions are now async and use Redis for persistence and rate limiting
# See redis_jobs.py for implementation

async def create_crawl_job(url: str, tenant_id: str, params: Dict = None) -> Dict[str, Any]:
    """Create a new crawl job with rate limiting. Returns job data or error."""
    return await redis_create_job(url, tenant_id, params)

async def update_crawl_job(job_id: str, status: str, result: Dict = None, error: str = None):
    """Update a crawl job's status."""
    updates = {"status": status}
    if result:
        updates["result"] = result
    if error:
        updates["error"] = error
    await redis_update_job(job_id, **updates)

async def get_crawl_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Get a crawl job by ID."""
    return await redis_get_job(job_id)

# Initialize FastAPI server
app = FastAPI(title="Crawl4AI RAG API", description="REST API for web crawling and RAG")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


# Global exception handler for API key required errors
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(ApiKeyRequiredError)
async def api_key_required_handler(request: Request, exc: ApiKeyRequiredError):
    """Return 402 Payment Required when API key is not configured."""
    return JSONResponse(
        status_code=402,
        content={
            "error": "OpenAI API key required",
            "message": str(exc),
            "action": "configure_api_key",
            "settingsUrl": "/dashboard/settings"
        }
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "crawl4ai-rag"}

# Request models
class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = None

def rerank_results(model: CrossEncoder, query: str, results: List[Dict[str, Any]], content_key: str = "content") -> List[Dict[str, Any]]:
    """
    Rerank search results using a cross-encoder model.
    
    Args:
        model: The cross-encoder model to use for reranking
        query: The search query
        results: List of search results
        content_key: The key in each result dict that contains the text content
        
    Returns:
        Reranked list of results
    """
    if not model or not results:
        return results
    
    try:
        # Extract content from results
        texts = [result.get(content_key, "") for result in results]
        
        # Create pairs of [query, document] for the cross-encoder
        pairs = [[query, text] for text in texts]
        
        # Get relevance scores from the cross-encoder
        scores = model.predict(pairs)
        
        # Add scores to results and sort by score (descending)
        for i, result in enumerate(results):
            result["rerank_score"] = float(scores[i])
        
        # Sort by rerank score
        reranked = sorted(results, key=lambda x: x.get("rerank_score", 0), reverse=True)
        
        return reranked
    except Exception as e:
        print(f"Error during reranking: {e}")
        return results

def is_sitemap(url: str) -> bool:
    """
    Check if a URL is a sitemap.
    
    Args:
        url: URL to check
        
    Returns:
        True if the URL is a sitemap, False otherwise
    """
    return url.endswith('sitemap.xml') or 'sitemap' in urlparse(url).path

def is_txt(url: str) -> bool:
    """
    Check if a URL is a text file.
    
    Args:
        url: URL to check
        
    Returns:
        True if the URL is a text file, False otherwise
    """
    return url.endswith('.txt')

def parse_sitemap(sitemap_url: str) -> List[str]:
    """
    Parse a sitemap and extract URLs.
    
    Args:
        sitemap_url: URL of the sitemap
        
    Returns:
        List of URLs found in the sitemap
    """
    resp = requests.get(sitemap_url)
    urls = []

    if resp.status_code == 200:
        try:
            tree = ElementTree.fromstring(resp.content)
            urls = [loc.text for loc in tree.findall('.//{*}loc')]
        except Exception as e:
            print(f"Error parsing sitemap XML: {e}")

    return urls

def smart_chunk_markdown(text: str, chunk_size: int = 5000) -> List[str]:
    """Split text into chunks, respecting code blocks and paragraphs."""
    chunks = []
    start = 0
    text_length = len(text)

    while start < text_length:
        # Calculate end position
        end = start + chunk_size

        # If we're at the end of the text, just take what's left
        if end >= text_length:
            chunks.append(text[start:].strip())
            break

        # Try to find a code block boundary first (```)
        chunk = text[start:end]
        code_block = chunk.rfind('```')
        if code_block != -1 and code_block > chunk_size * 0.3:
            end = start + code_block

        # If no code block, try to break at a paragraph
        elif '\n\n' in chunk:
            # Find the last paragraph break
            last_break = chunk.rfind('\n\n')
            if last_break > chunk_size * 0.3:  # Only break if we're past 30% of chunk_size
                end = start + last_break

        # If no paragraph break, try to break at a sentence
        elif '. ' in chunk:
            # Find the last sentence break
            last_period = chunk.rfind('. ')
            if last_period > chunk_size * 0.3:  # Only break if we're past 30% of chunk_size
                end = start + last_period + 1

        # Extract chunk and clean it up
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        # Move start position for next chunk
        start = end

    return chunks

def extract_section_info(chunk: str) -> Dict[str, Any]:
    """
    Extracts headers and stats from a chunk.
    
    Args:
        chunk: Markdown chunk
        
    Returns:
        Dictionary with headers and stats
    """
    headers = re.findall(r'^(#+)\s+(.+)$', chunk, re.MULTILINE)
    header_str = '; '.join([f'{h[0]} {h[1]}' for h in headers]) if headers else ''

    return {
        "headers": header_str,
        "char_count": len(chunk),
        "word_count": len(chunk.split())
    }

def process_code_example(args):
    """
    Process a single code example to generate its summary.
    This function is designed to be used with concurrent.futures.
    
    Args:
        args: Tuple containing (code, context_before, context_after)
        
    Returns:
        The generated summary
    """
    code, context_before, context_after = args
    return generate_code_example_summary(code, context_before, context_after)

@app.post("/api/crawl/single")
async def crawl_single_page(url: str) -> str:
    """Crawl a single web page and store its content."""
    try:
        ctx = await get_context()
        crawler = ctx.crawler
        
        # Configure the crawl
        run_config = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, stream=False)
        
        # Crawl the page
        result = await crawler.arun(url=url, config=run_config)
        
        if result.success and result.markdown:
            # Extract source_id
            parsed_url = urlparse(url)
            source_id = parsed_url.netloc or parsed_url.path
            
            # Chunk the content
            chunks = smart_chunk_markdown(result.markdown)
            
            # Prepare data for database
            urls = []
            chunk_numbers = []
            contents = []
            metadatas = []
            total_word_count = 0
            
            for i, chunk in enumerate(chunks):
                urls.append(url)
                chunk_numbers.append(i)
                contents.append(chunk)
                
                # Extract metadata
                meta = extract_section_info(chunk)
                meta["chunk_index"] = i
                meta["url"] = url
                meta["source"] = source_id
                meta["crawl_time"] = str(asyncio.current_task().get_coro().__name__)
                metadatas.append(meta)
                
                # Accumulate word count
                total_word_count += meta.get("word_count", 0)
            
            # Create url_to_full_document mapping
            url_to_full_document = {url: result.markdown}
            
            # Update source information FIRST (before inserting documents)
            source_summary = extract_source_summary(result.markdown[:5000])
            await update_source_info(source_id, source_summary, total_word_count)
            
            # Add documentation chunks to database (AFTER source exists)
            await add_documents_to_db(urls, chunk_numbers, contents, metadatas, url_to_full_document)
            
            # Extract and process code examples only if enabled
            extract_code_examples = os.getenv("USE_AGENTIC_RAG", "false") == "true"
            if extract_code_examples:
                code_blocks = extract_code_blocks(result.markdown)
                if code_blocks:
                    code_urls = []
                    code_chunk_numbers = []
                    code_examples = []
                    code_summaries = []
                    code_metadatas = []
                    
                    # Process code examples in parallel
                    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                        # Prepare arguments for parallel processing
                        summary_args = [(block['code'], block['context_before'], block['context_after']) 
                                        for block in code_blocks]
                        
                        # Generate summaries in parallel
                        summaries = list(executor.map(process_code_example, summary_args))
                    
                    # Prepare code example data
                    for i, (block, summary) in enumerate(zip(code_blocks, summaries)):
                        code_urls.append(url)
                        code_chunk_numbers.append(i)
                        code_examples.append(block['code'])
                        code_summaries.append(summary)
                        
                        # Create metadata for code example
                        code_meta = {
                            "chunk_index": i,
                            "url": url,
                            "source": source_id,
                            "char_count": len(block['code']),
                            "word_count": len(block['code'].split())
                        }
                        code_metadatas.append(code_meta)
                    
                    # Add code examples to database
                    await add_code_examples_to_db(url, code_blocks, source_id)
            
            # Extract AWS services to Neo4j
            neo4j_result = {"extracted": 0, "relationships": 0}
            if ctx.neo4j_driver:
                neo4j_result = await extract_aws_services_to_neo4j(
                    result.markdown, url, ctx.neo4j_driver
                )
            
            return json.dumps({
                "success": True,
                "url": url,
                "chunks_stored": len(chunks),
                "code_examples_stored": len(code_blocks) if code_blocks else 0,
                "content_length": len(result.markdown),
                "total_word_count": total_word_count,
                "source_id": source_id,
                "aws_services_extracted": neo4j_result.get("extracted", 0),
                "aws_relationships_created": neo4j_result.get("relationships", 0),
                "links_count": {
                    "internal": len(result.links.get("internal", [])),
                    "external": len(result.links.get("external", []))
                }
            }, indent=2)
        else:
            return json.dumps({
                "success": False,
                "url": url,
                "error": result.error_message
            }, indent=2)
    except Exception as e:
        return json.dumps({
            "success": False,
            "url": url,
            "error": str(e)
        }, indent=2)

async def _execute_crawl_job(job_id: str, url: str, max_depth: int, max_concurrent: int, chunk_size: int, tenant_id: str = None):
    """Background task to execute the actual crawling work."""
    tenant_id = tenant_id or DEFAULT_TENANT_ID
    
    # Mark job as running
    await update_crawl_job(job_id, "running")
    
    try:
        ctx = await get_context()
        crawler = ctx.crawler
        
        # Determine the crawl strategy
        crawl_results = []
        crawl_type = None
        
        if is_txt(url):
            crawl_results = await crawl_markdown_file(crawler, url)
            crawl_type = "text_file"
        elif is_sitemap(url):
            sitemap_urls = parse_sitemap(url)
            if not sitemap_urls:
                await update_crawl_job(job_id, "failed", error="No URLs found in sitemap")
                return
            crawl_results = await crawl_batch(crawler, sitemap_urls, max_concurrent=max_concurrent)
            crawl_type = "sitemap"
        else:
            crawl_results = await crawl_recursive_internal_links(crawler, [url], max_depth=max_depth, max_concurrent=max_concurrent)
            crawl_type = "webpage"
        
        if not crawl_results:
            await update_crawl_job(job_id, "failed", error="No content found")
            return
        
        # Process results and store in database
        urls = []
        chunk_numbers = []
        contents = []
        metadatas = []
        chunk_count = 0
        code_examples = []
        
        # Track sources and their content
        source_content_map = {}
        source_word_counts = {}
        
        # Process documentation chunks
        for doc in crawl_results:
            source_url = doc['url']
            md = doc['markdown']
            chunks = smart_chunk_markdown(md, chunk_size=chunk_size)
            
            parsed_url = urlparse(source_url)
            source_id = parsed_url.netloc or parsed_url.path
            
            if source_id not in source_content_map:
                source_content_map[source_id] = md[:5000]
                source_word_counts[source_id] = 0
            
            for i, chunk in enumerate(chunks):
                urls.append(source_url)
                chunk_numbers.append(i)
                contents.append(chunk)
                
                meta = extract_section_info(chunk)
                meta["chunk_index"] = i
                meta["url"] = source_url
                meta["source"] = source_id
                meta["crawl_type"] = crawl_type
                meta["crawl_time"] = datetime.utcnow().isoformat()
                meta["tenant_id"] = tenant_id
                metadatas.append(meta)
                
                source_word_counts[source_id] += meta.get("word_count", 0)
                chunk_count += 1
        
        # Create url_to_full_document mapping
        url_to_full_document = {doc['url']: doc['markdown'] for doc in crawl_results}
        
        # Update source information (with tenant_id)
        for source_id, content in source_content_map.items():
            summary = extract_source_summary(content)
            word_count = source_word_counts.get(source_id, 0)
            await update_source_info(source_id, summary, word_count, tenant_id)
        
        # Add documentation chunks to database (with tenant_id)
        await add_documents_to_db(urls, chunk_numbers, contents, metadatas, url_to_full_document, tenant_id)
        
        # Extract and process code examples if enabled
        extract_code_examples_enabled = os.getenv("USE_AGENTIC_RAG", "false") == "true"
        if extract_code_examples_enabled:
            for doc in crawl_results:
                doc_url = doc['url']
                parsed = urlparse(doc_url)
                doc_source_id = parsed.netloc or parsed.path
                doc_code_blocks = extract_code_blocks(doc['markdown'])
                if doc_code_blocks:
                    code_examples.extend(doc_code_blocks)
                    await add_code_examples_to_db(doc_url, doc_code_blocks, doc_source_id, tenant_id)
        
        # Extract AWS services to Neo4j (with tenant_id)
        neo4j_stats = {"total_services": 0, "total_relationships": 0}
        if ctx.neo4j_driver:
            for doc in crawl_results:
                extraction_result = await extract_aws_services_to_neo4j(
                    doc['markdown'], doc['url'], ctx.neo4j_driver, tenant_id
                )
                neo4j_stats["total_services"] += extraction_result.get("extracted", 0)
                neo4j_stats["total_relationships"] += extraction_result.get("relationships", 0)
        
        # Calculate total word count
        total_words = sum(source_word_counts.values())
        
        # Update job with success result
        await update_crawl_job(job_id, "completed", result={
            "url": url,
            "crawl_type": crawl_type,
            "pages_crawled": len(crawl_results),
            "chunks_stored": chunk_count,
            "code_examples_stored": len(code_examples),
            "sources_updated": len(source_content_map),
            "total_words": total_words,
            "aws_services_extracted": neo4j_stats["total_services"],
            "aws_relationships_created": neo4j_stats["total_relationships"],
            "urls_crawled": [doc['url'] for doc in crawl_results][:10],
            "tenant_id": tenant_id
        })
        
        print(f"✓ Crawl job {job_id} completed: {len(crawl_results)} pages, {chunk_count} chunks, {total_words} words (tenant: {tenant_id})")
        
    except Exception as e:
        await update_crawl_job(job_id, "failed", error=str(e))
        print(f"✗ Crawl job {job_id} failed: {str(e)}")


@app.post("/api/crawl/smart")
async def smart_crawl_url(
    background_tasks: BackgroundTasks,
    url: str, 
    max_depth: int = 3, 
    max_concurrent: int = 10, 
    chunk_size: int = 5000,
    tenant_id: str = None
) -> Dict[str, Any]:
    """
    Start an async crawl job. Returns immediately with job ID.
    Check status with GET /api/crawl/status/{job_id}
    
    Rate limited per tenant:
    - Max 5 concurrent crawls
    - Max 20 crawls per hour
    
    Args:
        tenant_id: Tenant ID for multi-tenant isolation
    """
    tenant_id = tenant_id or DEFAULT_TENANT_ID
    
    # Create job with rate limiting check
    job_result = await create_crawl_job(
        url=url, 
        tenant_id=tenant_id,
        params={"max_depth": max_depth, "max_concurrent": max_concurrent, "chunk_size": chunk_size}
    )
    
    # Check if rate limited
    if not job_result.get("success"):
        return {
            "success": False,
            "error": job_result.get("error", "Failed to create job"),
            "rate_limit": job_result.get("rate_limit")
        }
    
    job = job_result["job"]
    job_id = job["id"]
    
    # Start background task
    background_tasks.add_task(_execute_crawl_job, job_id, url, max_depth, max_concurrent, chunk_size, tenant_id)
    
    return {
        "success": True,
        "message": "Crawl started! Check back soon for your new knowledge.",
        "job_id": job_id,
        "url": url,
        "tenant_id": tenant_id,
        "status": "queued",
        "check_status_url": f"/api/crawl/status/{job_id}"
    }


@app.get("/api/crawl/status/{job_id}")
async def get_crawl_status(job_id: str) -> Dict[str, Any]:
    """Check the status of a crawl job."""
    job = await get_crawl_job(job_id)
    
    if not job:
        return {
            "success": False,
            "error": f"Job '{job_id}' not found"
        }
    
    response = {
        "success": True,
        "job_id": job["id"],
        "url": job["url"],
        "status": job["status"],
        "started_at": job.get("started_at"),
        "tenant_id": job.get("tenant_id")
    }
    
    if job["status"] == "completed":
        response["completed_at"] = job.get("completed_at")
        response["result"] = job.get("result")
        result = job.get("result", {})
        response["message"] = f"✓ Crawl complete! {result.get('pages_crawled', 0)} pages indexed with {result.get('total_words', 0):,} words."
    elif job["status"] == "failed":
        response["completed_at"] = job.get("completed_at")
        response["error"] = job.get("error")
        response["message"] = f"✗ Crawl failed: {job.get('error')}"
    elif job["status"] == "running":
        response["message"] = "Crawling in progress..."
    else:
        response["message"] = "Job queued, starting soon..."
    
    return response


@app.get("/api/crawl/jobs")
async def list_crawl_jobs_endpoint(tenant_id: str = None) -> Dict[str, Any]:
    """List crawl jobs for a tenant (recent first)."""
    tenant_id = tenant_id or DEFAULT_TENANT_ID
    jobs = await list_tenant_jobs(tenant_id, limit=20)
    
    return {
        "success": True,
        "jobs": [{
            "job_id": j["id"],
            "url": j["url"],
            "status": j["status"],
            "started_at": j.get("started_at"),
            "completed_at": j.get("completed_at"),
            "tenant_id": j.get("tenant_id")
        } for j in jobs],
        "count": len(jobs),
        "tenant_id": tenant_id
    }


@app.get("/api/crawl/stats")
async def get_crawl_stats(tenant_id: str = None) -> Dict[str, Any]:
    """Get crawl rate limit stats for a tenant."""
    tenant_id = tenant_id or DEFAULT_TENANT_ID
    stats = await get_tenant_crawl_stats(tenant_id)
    return {
        "success": True,
        **stats
    }

@app.get("/api/sources")
async def get_available_sources(tenant_id: str = None) -> str:
    """Get all available sources from the knowledge base."""
    try:
        sources_data = await db.get_knowledge_sources(limit=100)
        
        # Format the sources with their details
        sources = []
        for source in sources_data:
            sources.append({
                "source_id": source.get("id"),
                "summary": source.get("summary"),
                "total_words": source.get("total_word_count"),
                "chunk_count": source.get("chunk_count"),
                "created_at": source.get("created_at")
            })
        
        return json.dumps({
            "success": True,
            "sources": sources,
            "count": len(sources),
            "tenant_id": tenant_id
        }, indent=2)
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        }, indent=2)

@app.post("/api/search")
async def perform_rag_query(query: str, source: str = None, match_count: int = 5) -> str:
    """Perform a RAG query on the stored content."""
    try:
        ctx = await get_context()
        
        # Vector search
        results = await search_documents(
            query=query,
            source_id=source if source and source.strip() else None,
            match_count=match_count
        )
        
        # Apply reranking if enabled
        use_reranking = os.getenv("USE_RERANKING", "false") == "true"
        if use_reranking and ctx.reranking_model:
            results = rerank_results(ctx.reranking_model, query, results, content_key="content")
        
        # Format the results
        formatted_results = []
        for result in results:
            formatted_result = {
                "url": result.get("url"),
                "content": result.get("content"),
                "metadata": result.get("metadata"),
                "similarity": result.get("similarity")
            }
            # Include rerank score if available
            if "rerank_score" in result:
                formatted_result["rerank_score"] = result["rerank_score"]
            formatted_results.append(formatted_result)
        
        return json.dumps({
            "success": True,
            "query": query,
            "source_filter": source,
            "search_mode": "vector",
            "reranking_applied": use_reranking and ctx.reranking_model is not None,
            "results": formatted_results,
            "count": len(formatted_results)
        }, indent=2)
    except Exception as e:
        return json.dumps({
            "success": False,
            "query": query,
            "error": str(e)
        }, indent=2)

# ============================================
# CHAT AGENT ENDPOINT
# ============================================

# Define tools for OpenAI function calling
CHAT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_documentation",
            "description": TOOL_DESCRIPTIONS["search_documentation"],
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to find relevant documentation"
                    },
                    "source": {
                        "type": "string",
                        "description": "Optional: filter by source domain (e.g., 'docs.aws.amazon.com')"
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_sources",
            "description": TOOL_DESCRIPTIONS["get_sources"],
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_aws_services",
            "description": TOOL_DESCRIPTIONS["get_aws_services"],
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Optional: filter by category (e.g., 'Compute', 'Storage', 'Database')"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_aws_service_details",
            "description": TOOL_DESCRIPTIONS["get_aws_service_details"],
            "parameters": {
                "type": "object",
                "properties": {
                    "service_name": {
                        "type": "string",
                        "description": "The AWS service name (e.g., 'EC2', 'S3', 'Lambda')"
                    }
                },
                "required": ["service_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_aws_architecture",
            "description": TOOL_DESCRIPTIONS["get_aws_architecture"],
            "parameters": {
                "type": "object",
                "properties": {
                    "use_case": {
                        "type": "string",
                        "description": "Description of what you want to build (e.g., 'serverless API', 'data lake')"
                    }
                },
                "required": ["use_case"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_aws_graph",
            "description": TOOL_DESCRIPTIONS["query_aws_graph"],
            "parameters": {
                "type": "object",
                "properties": {
                    "cypher": {
                        "type": "string",
                        "description": "Cypher query to execute on the AWS services graph (e.g., 'MATCH (s:AWSService)-[r]->(t:AWSService) RETURN s.name, type(r), t.name LIMIT 10')"
                    }
                },
                "required": ["cypher"]
            }
        }
    },
    # Learning Content Generation Tools
    {
        "type": "function",
        "function": {
            "name": "generate_scenario",
            "description": TOOL_DESCRIPTIONS["generate_scenario"],
            "parameters": {
                "type": "object",
                "properties": {
                    "company_name": {
                        "type": "string",
                        "description": "Name of the company for the scenario"
                    },
                    "industry": {
                        "type": "string",
                        "description": "Industry (e.g., 'healthcare', 'fintech', 'retail')"
                    },
                    "business_context": {
                        "type": "string",
                        "description": "Brief description of the business problem"
                    }
                },
                "required": ["company_name", "industry", "business_context"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_flashcards",
            "description": TOOL_DESCRIPTIONS["generate_flashcards"],
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "Topic for flashcards (e.g., 'VPC networking', 'IAM policies', 'S3 storage classes')"
                    },
                    "card_count": {
                        "type": "integer",
                        "description": "Number of flashcards to generate (default: 10)"
                    }
                },
                "required": ["topic"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_quiz",
            "description": TOOL_DESCRIPTIONS["generate_quiz"],
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "Topic for the quiz"
                    },
                    "question_count": {
                        "type": "integer",
                        "description": "Number of questions (default: 5)"
                    },
                    "difficulty": {
                        "type": "string",
                        "description": "Difficulty level: 'easy', 'medium', 'hard', or 'mixed'"
                    }
                },
                "required": ["topic"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_study_notes",
            "description": "Generate comprehensive study notes on an AWS topic. Use when users want to learn about a topic in depth.",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "Topic for study notes (e.g., 'AWS Lambda best practices', 'DynamoDB design patterns')"
                    }
                },
                "required": ["topic"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "evaluate_solution",
            "description": TOOL_DESCRIPTIONS["evaluate_solution"],
            "parameters": {
                "type": "object",
                "properties": {
                    "scenario_id": {
                        "type": "string",
                        "description": "ID of the scenario being solved"
                    },
                    "challenge_id": {
                        "type": "string",
                        "description": "ID of the specific challenge"
                    },
                    "solution": {
                        "type": "string",
                        "description": "The user's proposed solution (architecture description, services used, etc.)"
                    }
                },
                "required": ["scenario_id", "challenge_id", "solution"]
            }
        }
    }
]


async def execute_tool(tool_name: str, tool_args: dict) -> str:
    """Execute a tool and return the result as a string."""
    try:
        if tool_name == "search_documentation":
            results = await search_documents(
                query=tool_args.get("query", ""),
                source_id=tool_args.get("source"),
                match_count=5
            )
            if results:
                formatted = []
                for r in results:
                    formatted.append(f"**Source:** {r.get('url', 'Unknown')}\n{r.get('content', '')[:1000]}")
                return "\n\n---\n\n".join(formatted)
            return "No relevant documentation found."
        
        elif tool_name == "get_sources":
            sources = await db.get_knowledge_sources(limit=50)
            if sources:
                return "\n".join([f"- **{s['id']}**: {s.get('summary', 'No summary')[:100]}..." for s in sources])
            return "No sources available. Crawl some documentation first."
        
        elif tool_name == "get_aws_services":
            result = await list_aws_services(category=tool_args.get("category"))
            return result
        
        elif tool_name == "get_aws_service_details":
            result = await get_aws_service(service_name=tool_args.get("service_name", ""))
            return result
        
        elif tool_name == "get_aws_architecture":
            result = await get_aws_architecture(use_case=tool_args.get("use_case", ""))
            return result
        
        elif tool_name == "query_aws_graph":
            result = await query_aws_graph(cypher=tool_args.get("cypher", ""))
            return result
        
        elif tool_name == "generate_scenario":
            # Generate a learning scenario using the generator
            from generators.scenario import generate_scenario_from_location
            scenario = await generate_scenario_from_location(
                company_name=tool_args.get("company_name", "Unknown Company"),
                industry=tool_args.get("industry", "Technology"),
                address=tool_args.get("address"),
                user_level=tool_args.get("user_level", "intermediate"),
            )
            return json.dumps({
                "success": True,
                "scenario_id": scenario.id,
                "title": scenario.scenario_title,
                "company": scenario.company_name,
                "description": scenario.scenario_description,
                "challenges": [{"id": c.id, "title": c.title, "difficulty": c.difficulty} for c in scenario.challenges],
                "difficulty": scenario.difficulty,
                "estimated_time": scenario.estimated_total_time_minutes,
            })
        
        elif tool_name == "generate_flashcards":
            from generators.flashcards import generate_flashcards_for_service
            topic = tool_args.get("topic", "AWS")
            card_count = tool_args.get("card_count", 10)
            deck = await generate_flashcards_for_service(
                service_name=topic,
                card_count=card_count,
            )
            # Return formatted flashcards
            cards_text = []
            for i, card in enumerate(deck.cards[:5], 1):  # Show first 5
                cards_text.append(f"**Card {i}:**\n- Q: {card.front}\n- A: {card.back}")
            return f"Generated {deck.total_cards} flashcards on '{topic}':\n\n" + "\n\n".join(cards_text) + f"\n\n... and {max(0, deck.total_cards - 5)} more cards."
        
        elif tool_name == "generate_quiz":
            from generators.quiz import generate_quiz_for_topic
            topic = tool_args.get("topic", "AWS")
            question_count = tool_args.get("question_count", 5)
            try:
                quiz = await generate_quiz_for_topic(
                    topic=topic,
                    question_count=question_count,
                )
                questions_text = []
                for i, q in enumerate(quiz.questions[:3], 1):  # Show first 3
                    questions_text.append(f"**Q{i}:** {q.question}")
                return f"Generated {quiz.total_questions} questions on '{topic}':\n\n" + "\n".join(questions_text) + f"\n\n... and {max(0, quiz.total_questions - 3)} more questions."
            except Exception as e:
                return f"Quiz generation in progress. Use /api/learning/generate-quiz endpoint for full quiz. Error: {str(e)}"
        
        elif tool_name == "generate_study_notes":
            topic = tool_args.get("topic", "AWS")
            return f"Study notes on '{topic}' - Use /api/learning/generate-notes endpoint for comprehensive notes. I can explain key concepts about {topic} directly in our conversation."
        
        elif tool_name == "evaluate_solution":
            scenario_id = tool_args.get("scenario_id")
            challenge_id = tool_args.get("challenge_id")
            solution = tool_args.get("solution")
            # Call the evaluation endpoint logic
            try:
                result = await evaluate_solution(
                    scenario_id=scenario_id,
                    challenge_id=challenge_id,
                    solution={"description": solution}
                )
                return json.dumps(result, indent=2)
            except Exception as e:
                return f"Could not evaluate solution: {str(e)}"
        
        else:
            return f"Unknown tool: {tool_name}"
    
    except Exception as e:
        return f"Error executing {tool_name}: {str(e)}"


@app.post("/api/chat")
async def chat(request: ChatRequest) -> Dict[str, Any]:
    """
    Chat with the CloudMigrate AI assistant.
    
    Args:
        request: ChatRequest with message and optional conversation_history
    
    Returns:
        JSON with the assistant's response and updated conversation history
    """
    try:
        message = request.message
        conversation_history = request.conversation_history
        
        # Get API key from request context (set by endpoint) - no env fallback
        from utils import get_request_api_key
        api_key = get_request_api_key()
        if not api_key:
            raise ApiKeyRequiredError(
                "OpenAI API key required. Please configure your API key in Settings."
            )
        
        client = OpenAI(api_key=api_key)
        from utils import get_request_model
        model = get_request_model()
        
        # Build messages array
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        # Add conversation history if provided
        if conversation_history:
            messages.extend(conversation_history)
        
        # Add current user message
        messages.append({"role": "user", "content": message})
        
        # Initial API call with tools
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=CHAT_TOOLS,
            tool_choice="auto",
            temperature=0.7,
            max_tokens=2000
        )
        
        assistant_message = response.choices[0].message
        
        # Handle tool calls if any
        tool_calls_made = []
        while assistant_message.tool_calls:
            # Process each tool call
            tool_results = []
            for tool_call in assistant_message.tool_calls:
                tool_name = tool_call.function.name
                tool_args = json.loads(tool_call.function.arguments)
                
                # Execute the tool
                result = await execute_tool(tool_name, tool_args)
                
                tool_calls_made.append({
                    "tool": tool_name,
                    "args": tool_args,
                    "result_preview": result[:200] + "..." if len(result) > 200 else result
                })
                
                tool_results.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "content": result
                })
            
            # Add assistant message with tool calls to messages
            messages.append({
                "role": "assistant",
                "content": assistant_message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    }
                    for tc in assistant_message.tool_calls
                ]
            })
            
            # Add tool results
            messages.extend(tool_results)
            
            # Get next response
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                tools=CHAT_TOOLS,
                tool_choice="auto",
                temperature=0.7,
                max_tokens=2000
            )
            
            assistant_message = response.choices[0].message
        
        # Final response
        final_content = assistant_message.content or "I apologize, but I couldn't generate a response."
        
        # Build updated conversation history for the client
        updated_history = conversation_history or []
        updated_history.append({"role": "user", "content": message})
        updated_history.append({"role": "assistant", "content": final_content})
        
        return {
            "success": True,
            "response": final_content,
            "tools_used": tool_calls_made,
            "conversation_history": updated_history,
            "model": model
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


# ============================================
# AWS SERVICES KNOWLEDGE GRAPH ENDPOINTS
# ============================================

@app.get("/api/aws/services")
async def list_aws_services(category: str = None, tenant_id: str = None) -> str:
    """
    List all AWS services in the knowledge graph for a tenant.
    
    Args:
        category: Optional category filter (e.g., 'Compute', 'Storage', 'Database')
        tenant_id: Tenant ID for multi-tenant isolation
    
    Returns:
        JSON with list of AWS services
    """
    try:
        ctx = await get_context()
        tenant_id = tenant_id or DEFAULT_TENANT_ID
        
        if not ctx.neo4j_driver:
            return json.dumps({
                "success": False,
                "error": "AWS Services graph not available. Set USE_KNOWLEDGE_GRAPH=true and configure Neo4j."
            }, indent=2)
        
        async with ctx.neo4j_driver.session() as session:
            if category:
                query = """
                MATCH (s:AWSService {category: $category, tenant_id: $tenant_id})
                RETURN s.name as name, s.category as category, s.description as description
                ORDER BY s.name
                """
                result = await session.run(query, category=category, tenant_id=tenant_id)
            else:
                query = """
                MATCH (s:AWSService {tenant_id: $tenant_id})
                RETURN s.name as name, s.category as category, s.description as description
                ORDER BY s.category, s.name
                """
                result = await session.run(query, tenant_id=tenant_id)
            
            services = []
            async for record in result:
                services.append({
                    "name": record["name"],
                    "category": record["category"],
                    "description": record["description"]
                })
            
            # Get unique categories for this tenant
            cat_result = await session.run(
                "MATCH (s:AWSService {tenant_id: $tenant_id}) RETURN DISTINCT s.category as category ORDER BY category",
                tenant_id=tenant_id
            )
            categories = [r["category"] async for r in cat_result]
            
            return json.dumps({
                "success": True,
                "services": services,
                "count": len(services),
                "categories": categories,
                "filter": category,
                "tenant_id": tenant_id
            }, indent=2)
            
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        }, indent=2)


@app.get("/api/aws/service/{service_name}")
async def get_aws_service(service_name: str, tenant_id: str = None) -> str:
    """
    Get details and relationships for a specific AWS service.
    
    Args:
        service_name: AWS service name (e.g., 'EC2', 'S3', 'Lambda')
        tenant_id: Tenant ID for multi-tenant isolation
    
    Returns:
        JSON with service details and all its relationships
    """
    try:
        ctx = await get_context()
        tenant_id = tenant_id or DEFAULT_TENANT_ID
        
        if not ctx.neo4j_driver:
            return json.dumps({
                "success": False,
                "error": "AWS Services graph not available. Set USE_KNOWLEDGE_GRAPH=true and configure Neo4j."
            }, indent=2)
        
        async with ctx.neo4j_driver.session() as session:
            # Get service details (scoped by tenant)
            service_query = """
            MATCH (s:AWSService {tenant_id: $tenant_id})
            WHERE toLower(s.name) = toLower($name)
            RETURN s.name as name, s.category as category, s.description as description,
                   s.pricing_model as pricing_model, s.use_cases as use_cases
            """
            result = await session.run(service_query, name=service_name, tenant_id=tenant_id)
            service_record = await result.single()
            
            if not service_record:
                return json.dumps({
                    "success": False,
                    "error": f"Service '{service_name}' not found"
                }, indent=2)
            
            service = {
                "name": service_record["name"],
                "category": service_record["category"],
                "description": service_record["description"],
                "pricing_model": service_record["pricing_model"],
                "use_cases": service_record["use_cases"]
            }
            
            # Get all relationships (scoped by tenant)
            rel_query = """
            MATCH (s:AWSService {tenant_id: $tenant_id})-[r]-(other:AWSService {tenant_id: $tenant_id})
            WHERE toLower(s.name) = toLower($name)
            RETURN type(r) as relationship, other.name as service, other.category as category,
                   CASE WHEN startNode(r) = s THEN 'outgoing' ELSE 'incoming' END as direction
            ORDER BY type(r), other.name
            """
            rel_result = await session.run(rel_query, name=service_name, tenant_id=tenant_id)
            
            relationships = {
                "connects_to": [],
                "requires": [],
                "triggers": [],
                "stores_in": [],
                "authenticates_with": [],
                "other": []
            }
            
            async for record in rel_result:
                rel_type = record["relationship"].lower()
                rel_data = {
                    "service": record["service"],
                    "category": record["category"],
                    "direction": record["direction"]
                }
                
                if rel_type in relationships:
                    relationships[rel_type].append(rel_data)
                else:
                    relationships["other"].append({**rel_data, "type": record["relationship"]})
            
            return json.dumps({
                "success": True,
                "service": service,
                "relationships": relationships
            }, indent=2)
            
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        }, indent=2)


@app.post("/api/aws/architecture")
async def get_aws_architecture(use_case: str, tenant_id: str = None) -> str:
    """
    Get recommended AWS architecture for a use case.
    
    Args:
        use_case: Description of what you're building (e.g., 'serverless API', 'data lake', 'web application')
        tenant_id: Tenant ID for multi-tenant isolation
    
    Returns:
        JSON with recommended services and architecture pattern
    """
    try:
        ctx = await get_context()
        tenant_id = tenant_id or DEFAULT_TENANT_ID
        
        if not ctx.neo4j_driver:
            return json.dumps({
                "success": False,
                "error": "AWS Services graph not available. Set USE_KNOWLEDGE_GRAPH=true and configure Neo4j."
            }, indent=2)
        
        async with ctx.neo4j_driver.session() as session:
            # Search for services related to the use case (scoped by tenant)
            query = """
            MATCH (s:AWSService {tenant_id: $tenant_id})
            WHERE toLower(s.description) CONTAINS toLower($use_case)
               OR toLower(s.name) CONTAINS toLower($use_case)
               OR ANY(uc IN s.use_cases WHERE toLower(uc) CONTAINS toLower($use_case))
            WITH s
            OPTIONAL MATCH (s)-[r]-(related:AWSService {tenant_id: $tenant_id})
            RETURN s.name as name, s.category as category, s.description as description,
                   collect(DISTINCT {name: related.name, relationship: type(r)}) as related_services
            ORDER BY s.category
            """
            result = await session.run(query, use_case=use_case, tenant_id=tenant_id)
            
            recommended = []
            async for record in result:
                recommended.append({
                    "name": record["name"],
                    "category": record["category"],
                    "description": record["description"],
                    "related_services": [r for r in record["related_services"] if r["name"]]
                })
            
            if not recommended:
                return json.dumps({
                    "success": True,
                    "use_case": use_case,
                    "message": "No specific services found for this use case. Try broader terms like 'compute', 'storage', 'database', 'serverless', 'containers'.",
                    "recommended_services": []
                }, indent=2)
            
            return json.dumps({
                "success": True,
                "use_case": use_case,
                "recommended_services": recommended,
                "count": len(recommended)
            }, indent=2)
            
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e)
        }, indent=2)


@app.post("/api/aws/query")
async def query_aws_graph(cypher: str, tenant_id: str = None) -> str:
    """
    Execute a custom Cypher query on the AWS services graph.
    
    Note: For security, queries are automatically scoped to tenant_id.
    Use $tenant_id parameter in your Cypher query for tenant filtering.
    
    Args:
        cypher: Cypher query to execute
        tenant_id: Tenant ID for multi-tenant isolation
    
    Returns:
        JSON with query results
    """
    try:
        ctx = await get_context()
        tenant_id = tenant_id or DEFAULT_TENANT_ID
        
        if not ctx.neo4j_driver:
            return json.dumps({
                "success": False,
                "error": "AWS Services graph not available. Set USE_KNOWLEDGE_GRAPH=true and configure Neo4j."
            }, indent=2)
        
        async with ctx.neo4j_driver.session() as session:
            # Pass tenant_id as parameter so queries can use it
            result = await session.run(cypher, tenant_id=tenant_id)
            
            records = []
            count = 0
            async for record in result:
                records.append(dict(record))
                count += 1
                if count >= 50:  # Limit results
                    break
            
            return json.dumps({
                "success": True,
                "query": cypher,
                "results": records,
                "count": len(records),
                "limited": count >= 50,
                "tenant_id": tenant_id
            }, indent=2)
            
    except Exception as e:
        return json.dumps({
            "success": False,
            "query": cypher,
            "error": str(e)
        }, indent=2)

async def crawl_markdown_file(crawler: AsyncWebCrawler, url: str) -> List[Dict[str, Any]]:
    """
    Crawl a .txt or markdown file.
    
    Args:
        crawler: AsyncWebCrawler instance
        url: URL of the file
        
    Returns:
        List of dictionaries with URL and markdown content
    """
    crawl_config = CrawlerRunConfig()

    result = await crawler.arun(url=url, config=crawl_config)
    if result.success and result.markdown:
        return [{'url': url, 'markdown': result.markdown}]
    else:
        print(f"Failed to crawl {url}: {result.error_message}")
        return []

async def crawl_batch(crawler: AsyncWebCrawler, urls: List[str], max_concurrent: int = 10) -> List[Dict[str, Any]]:
    """
    Batch crawl multiple URLs in parallel.
    
    Args:
        crawler: AsyncWebCrawler instance
        urls: List of URLs to crawl
        max_concurrent: Maximum number of concurrent browser sessions
        
    Returns:
        List of dictionaries with URL and markdown content
    """
    crawl_config = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, stream=False)
    dispatcher = MemoryAdaptiveDispatcher(
        memory_threshold_percent=70.0,
        check_interval=1.0,
        max_session_permit=max_concurrent
    )

    results = await crawler.arun_many(urls=urls, config=crawl_config, dispatcher=dispatcher)
    return [{'url': r.url, 'markdown': r.markdown} for r in results if r.success and r.markdown]

async def crawl_recursive_internal_links(crawler: AsyncWebCrawler, start_urls: List[str], max_depth: int = 3, max_concurrent: int = 10) -> List[Dict[str, Any]]:
    """
    Recursively crawl internal links from start URLs up to a maximum depth.
    
    Args:
        crawler: AsyncWebCrawler instance
        start_urls: List of starting URLs
        max_depth: Maximum recursion depth
        max_concurrent: Maximum number of concurrent browser sessions
        
    Returns:
        List of dictionaries with URL and markdown content
    """
    run_config = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, stream=False)
    dispatcher = MemoryAdaptiveDispatcher(
        memory_threshold_percent=70.0,
        check_interval=1.0,
        max_session_permit=max_concurrent
    )

    visited = set()

    def normalize_url(url):
        return urldefrag(url)[0]

    current_urls = set([normalize_url(u) for u in start_urls])
    results_all = []

    for depth in range(max_depth):
        urls_to_crawl = [normalize_url(url) for url in current_urls if normalize_url(url) not in visited]
        if not urls_to_crawl:
            break

        results = await crawler.arun_many(urls=urls_to_crawl, config=run_config, dispatcher=dispatcher)
        next_level_urls = set()

        for result in results:
            norm_url = normalize_url(result.url)
            visited.add(norm_url)

            if result.success and result.markdown:
                results_all.append({'url': result.url, 'markdown': result.markdown})
                for link in result.links.get("internal", []):
                    next_url = normalize_url(link["href"])
                    if next_url not in visited:
                        next_level_urls.add(next_url)

        current_urls = next_level_urls

    return results_all


# ============================================
# LEARNING AGENT - MODELS
# ============================================

class CompanyInfo(BaseModel):
    """Information about a company gathered from research"""
    name: str
    industry: str
    description: str
    headquarters: Optional[str] = None
    employee_count: Optional[str] = None
    revenue: Optional[str] = None
    key_services: List[str] = []
    technology_stack: List[str] = []
    compliance_requirements: List[str] = []
    business_challenges: List[str] = []
    data_types: List[str] = []
    traffic_patterns: Optional[str] = None
    global_presence: Optional[str] = None


class ScenarioChallenge(BaseModel):
    """A single challenge within a scenario"""
    id: str
    title: str
    description: str
    difficulty: str
    points: int
    hints: List[str] = []
    success_criteria: List[str] = []
    aws_services_relevant: List[str] = []
    estimated_time_minutes: int = 30


class CloudScenario(BaseModel):
    """A complete cloud architecture scenario"""
    id: str
    company_name: str
    scenario_title: str
    scenario_description: str
    business_context: str
    technical_requirements: List[str]
    compliance_requirements: List[str]
    constraints: List[str]
    challenges: List[ScenarioChallenge]
    learning_objectives: List[str]
    difficulty: str
    estimated_total_time_minutes: int
    tags: List[str]


class LocationRequest(BaseModel):
    """Request to generate scenario/challenge for a location"""
    place_id: Optional[str] = None
    company_name: str
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    industry: Optional[str] = None
    user_level: str = "intermediate"
    cert_code: Optional[str] = None  # e.g. "SAA", "DVA", "SOA" - triggers persona
    openai_api_key: Optional[str] = None  # BYOK - user's own API key
    preferred_model: Optional[str] = None  # User's preferred model


class ResearchResult(BaseModel):
    """Result from researching a company"""
    company_info: CompanyInfo
    sources: List[str] = []
    confidence: float = 0.0


class ScenarioResponse(BaseModel):
    """Response containing generated scenario/challenge"""
    success: bool
    scenario: Optional[CloudScenario] = None
    company_info: Optional[CompanyInfo] = None
    cert_code: Optional[str] = None  # Which cert persona was used
    cert_name: Optional[str] = None  # Full cert name
    error: Optional[str] = None




class GenerateContentRequest(BaseModel):
    """Request to generate learning content"""
    scenario_id: str
    content_type: str
    user_level: str = "intermediate"
    user_id: Optional[str] = None  # To fetch user's persona
    persona_id: Optional[str] = None  # Override persona
    options: Optional[Dict[str, Any]] = None
    openai_api_key: Optional[str] = None  # BYOK - user's own API key
    preferred_model: Optional[str] = None  # User's preferred model


# ============================================
# LEARNING AGENT - DEPENDENCIES
# ============================================

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
_async_openai: Optional[AsyncOpenAI] = None


def get_agent_deps() -> AgentDeps:
    global _agent_deps
    if _agent_deps is None:
        _agent_deps = AgentDeps()
    return _agent_deps


def get_async_openai(api_key: Optional[str] = None) -> AsyncOpenAI:
    """Get AsyncOpenAI client. Requires API key from request context or explicit param."""
    from utils import get_request_api_key
    key = api_key or get_request_api_key()
    if not key:
        raise ApiKeyRequiredError(
            "OpenAI API key required. Please configure your API key in Settings."
        )
    return AsyncOpenAI(api_key=key)


# ============================================
# LEARNING AGENT - TAVILY WEB SEARCH
# ============================================

async def search_web(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """Search the web using Tavily API"""
    deps = get_agent_deps()
    if not deps.tavily_api_key:
        logger.warning("No Tavily API key configured")
        return []
    
    try:
        response = await deps.http_client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": deps.tavily_api_key,
                "query": query,
                "max_results": max_results,
                "include_answer": True,
                "include_raw_content": False,
                "search_depth": "advanced"
            }
        )
        response.raise_for_status()
        data = response.json()
        return data.get("results", [])
    except Exception as e:
        logger.error(f"Tavily search failed: {e}")
        return []


# ============================================
# LEARNING AGENT - OPENAI HELPERS
# ============================================

async def async_chat_completion(
    messages: List[Dict[str, str]],
    model: str = "gpt-4o",
    temperature: float = 0.7,
    response_format: Optional[Dict] = None,
) -> str:
    """Async chat completion wrapper."""
    client = get_async_openai()
    
    kwargs = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if response_format:
        kwargs["response_format"] = response_format
    
    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message.content


async def async_chat_completion_json(
    messages: List[Dict[str, str]],
    model: str = "gpt-4o",
    temperature: float = 0.7,
) -> Dict:
    """Chat completion that returns JSON."""
    content = await async_chat_completion(
        messages=messages,
        model=model,
        temperature=temperature,
        response_format={"type": "json_object"},
    )
    return json.loads(content)


async def detect_skill_level(message: str) -> str:
    """Detect user's skill level from their message."""
    try:
        response = await async_chat_completion(
            messages=[
                {"role": "system", "content": SKILL_DETECTOR_PROMPT},
                {"role": "user", "content": message},
            ],
            model="gpt-4o-mini",
            temperature=0.3,
        )
        level = response.strip().lower()
        if level in ["beginner", "intermediate", "advanced", "expert"]:
            return level
        return "intermediate"
    except Exception:
        return "intermediate"


# ============================================
# LEARNING AGENT - CORE FUNCTIONS
# ============================================

async def research_company(company_name: str, industry: Optional[str] = None) -> ResearchResult:
    """Research a company using web search and AI analysis"""
    logger.info(f"Researching company: {company_name}")
    
    queries = [
        f"{company_name} company overview business",
        f"{company_name} technology infrastructure cloud",
        f"{company_name} data privacy compliance regulations",
    ]
    
    if industry:
        queries.append(f"{company_name} {industry} industry challenges")
    
    all_results = []
    sources = []
    for query in queries:
        results = await search_web(query, max_results=3)
        for r in results:
            all_results.append(r.get("content", ""))
            if r.get("url"):
                sources.append(r["url"])
    
    combined_info = "\n\n".join(all_results[:10])
    
    if not combined_info:
        combined_info = f"Company: {company_name}. Industry: {industry or 'Unknown'}. Please infer typical business operations and cloud needs based on the company name and industry."
    
    try:
        system_prompt = """You are a business research specialist. Analyze company information and return JSON with these fields:
- name: company name
- industry: industry sector
- description: brief description
- headquarters: location (optional)
- employee_count: size (optional)
- key_services: list of main services
- technology_stack: list of technologies used
- compliance_requirements: list of compliance needs (HIPAA, PCI-DSS, GDPR, etc.)
- business_challenges: list of challenges
- data_types: list of data types handled
- traffic_patterns: traffic description (optional)
- global_presence: geographic presence (optional)"""

        result = await async_chat_completion_json(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"""Analyze this company:

Company Name: {company_name}
Industry Hint: {industry or 'Unknown'}

Research Data:
{combined_info}"""},
            ],
            model="gpt-4o-mini",
        )
        
        return ResearchResult(
            company_info=CompanyInfo(**result),
            sources=list(set(sources))[:5],
            confidence=0.8 if all_results else 0.5
        )
    except Exception as e:
        logger.error(f"Research failed: {e}")
        return ResearchResult(
            company_info=CompanyInfo(
                name=company_name,
                industry=industry or "Technology",
                description=f"{company_name} is a company in the {industry or 'technology'} sector.",
                key_services=["Core business operations"],
                compliance_requirements=["SOC 2", "GDPR"] if industry else [],
            ),
            sources=[],
            confidence=0.3
        )


# NOTE: generate_scenario moved to generators/scenario.py


async def get_coaching_response(
    message: str,
    scenario: Optional[CloudScenario] = None,
    challenge_id: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None
) -> str:
    """Get a coaching response for the user's message"""
    
    context_parts = []
    
    if scenario:
        context_parts.append(f"Current Scenario: {scenario.scenario_title}")
        context_parts.append(f"Company: {scenario.company_name}")
        context_parts.append(f"Business Context: {scenario.business_context}")
        
        if challenge_id:
            challenge = next((c for c in scenario.challenges if c.id == challenge_id), None)
            if challenge:
                context_parts.append(f"\nCurrent Challenge: {challenge.title}")
                context_parts.append(f"Challenge Description: {challenge.description}")
                context_parts.append(f"Success Criteria: {', '.join(challenge.success_criteria)}")
                context_parts.append(f"Relevant AWS Services: {', '.join(challenge.aws_services_relevant)}")
    
    if context:
        context_parts.append(f"\nAdditional Context: {json.dumps(context)}")
    
    system_context = "\n".join(context_parts) if context_parts else "General cloud architecture discussion"
    
    system_prompt = f"""{SOPHIA_PERSONA}

CURRENT CONTEXT:
{system_context}"""

    try:
        response = await async_chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message},
            ],
            model="gpt-4o",
            temperature=0.7,
        )
        return response
    except Exception as e:
        logger.error(f"Coach response failed: {e}")
        return "I'm having trouble processing that. Could you rephrase your question?"


# ============================================
# LEARNING AGENT - ENDPOINTS
# ============================================

@app.get("/api/learning/certifications")
async def list_certifications():
    """List available AWS certifications for challenge generation"""
    from prompts import CERTIFICATION_PERSONAS
    
    certs = []
    for code, persona in CERTIFICATION_PERSONAS.items():
        certs.append({
            "code": code,
            "name": persona["cert"],
            "level": persona["level"],
            "focus": persona["focus"],
        })
    
    # Sort by level: foundational, associate, professional, specialty
    level_order = {"foundational": 0, "associate": 1, "professional": 2, "specialty": 3}
    certs.sort(key=lambda x: (level_order.get(x["level"], 99), x["name"]))
    
    return {"certifications": certs}


@app.post("/api/learning/research", response_model=ResearchResult)
async def research_endpoint(request: LocationRequest):
    """Research a company and gather information"""
    try:
        # Set request-scoped API key and model if provided (BYOK)
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        result = await research_company(
            company_name=request.company_name,
            industry=request.industry
        )
        return result
    except Exception as e:
        logger.error(f"Research endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clear request-scoped context
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@app.post("/api/learning/generate-scenario", response_model=ScenarioResponse)
async def generate_scenario_endpoint(request: LocationRequest):
    """Generate a complete training scenario/challenge for a location/company"""
    try:
        # Set request-scoped API key and model if provided (BYOK)
        from utils import set_request_api_key, set_request_model
        from generators.scenario import generate_scenario as gen_scenario, CompanyInfo as GenCompanyInfo
        from prompts import CERTIFICATION_PERSONAS
        
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        research = await research_company(
            company_name=request.company_name,
            industry=request.industry
        )
        
        # Convert to generator's CompanyInfo format
        company_info = GenCompanyInfo(
            name=research.company_info.name,
            industry=research.company_info.industry,
            description=research.company_info.description,
            key_services=research.company_info.key_services,
            technology_stack=research.company_info.technology_stack,
            compliance_requirements=research.company_info.compliance_requirements,
            data_types=research.company_info.data_types,
            employee_count=research.company_info.employee_count,
        )
        
        # Build persona context if cert_code provided
        persona_context = None
        if request.cert_code and request.cert_code in CERTIFICATION_PERSONAS:
            persona = CERTIFICATION_PERSONAS[request.cert_code]
            persona_context = {
                "cert_code": request.cert_code,
                "cert_name": persona["cert"],
                "level": persona["level"],
                "focus_areas": ", ".join(persona["focus"]),
                "style": persona["style"],
            }
            logger.info(f"Using persona for {request.cert_code}: {persona['cert']}")
        
        scenario = await gen_scenario(
            company_info=company_info,
            user_level=request.user_level,
            persona_context=persona_context,
        )
        
        if request.place_id:
            try:
                await db.save_scenario(
                    location_id=request.place_id,
                    scenario_data=scenario.model_dump(),
                    company_info=research.company_info.model_dump(),
                )
                logger.info(f"Saved scenario {scenario.id} to database")
            except Exception as db_err:
                logger.warning(f"Failed to save scenario to DB: {db_err}")
        
        return ScenarioResponse(
            success=True,
            scenario=scenario,
            company_info=research.company_info,
            cert_code=request.cert_code,
            cert_name=persona_context["cert_name"] if persona_context else None,
        )
    except Exception as e:
        logger.error(f"Scenario generation error: {e}")
        return ScenarioResponse(success=False, error=str(e))
    finally:
        # Clear request-scoped context
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@app.post("/api/learning/generate-scenario-stream")
async def generate_scenario_stream_endpoint(request: LocationRequest):
    """Generate scenario with SSE streaming for real-time progress updates"""
    
    async def event_stream():
        from utils import set_request_api_key, set_request_model
        from generators.scenario import generate_scenario as gen_scenario, CompanyInfo as GenCompanyInfo
        from prompts import CERTIFICATION_PERSONAS
        
        try:
            # Set request-scoped API key
            if request.openai_api_key:
                set_request_api_key(request.openai_api_key)
            if request.preferred_model:
                set_request_model(request.preferred_model)
            
            # Step 1: Starting
            yield f"data: {json.dumps({'type': 'status', 'message': '🚀 Starting scenario generation...', 'step': 1, 'total_steps': 5})}\n\n"
            await asyncio.sleep(0.1)
            
            # Step 2: Research
            yield f"data: {json.dumps({'type': 'status', 'message': f'🔍 Researching {request.company_name}...', 'step': 2, 'total_steps': 5})}\n\n"
            
            # Perform web search
            queries = [
                f"{request.company_name} company overview business",
                f"{request.company_name} technology infrastructure cloud",
            ]
            if request.industry:
                queries.append(f"{request.company_name} {request.industry} industry")
            
            all_sources = []
            for query in queries:
                yield f"data: {json.dumps({'type': 'search', 'message': f'🌐 Searching: {query}'})}\n\n"
                results = await search_web(query, max_results=3)
                for r in results:
                    if r.get("url"):
                        all_sources.append(r["url"])
                        yield f"data: {json.dumps({'type': 'source', 'url': r['url'], 'title': r.get('title', 'Source')})}\n\n"
                await asyncio.sleep(0.1)
            
            # Step 3: Analyzing
            yield f"data: {json.dumps({'type': 'status', 'message': '🧠 Analyzing company information...', 'step': 3, 'total_steps': 5})}\n\n"
            
            research = await research_company(
                company_name=request.company_name,
                industry=request.industry
            )
            
            yield f"data: {json.dumps({'type': 'research', 'company': research.company_info.model_dump(), 'sources': list(set(all_sources))[:5]})}\n\n"
            
            # Step 3.5: Search AWS knowledge base for relevant content
            yield f"data: {json.dumps({'type': 'status', 'message': '📚 Searching AWS knowledge base...', 'step': 3, 'total_steps': 6})}\n\n"
            
            knowledge_context = ""
            knowledge_topics = []  # Track specific topics for challenge variety
            try:
                # Build SPECIFIC search query using cert focus areas + skill level for variety
                import random as kb_random
                
                # Map skill level to complexity keywords
                skill_keywords = {
                    "beginner": "basics fundamentals getting started",
                    "intermediate": "best practices configuration",
                    "advanced": "optimization multi-region high availability",
                    "expert": "enterprise scale architecture patterns"
                }
                skill_context = skill_keywords.get(request.user_level, "best practices")
                
                if request.cert_code and request.cert_code in CERTIFICATION_PERSONAS:
                    cert_focus = CERTIFICATION_PERSONAS[request.cert_code]["focus"]
                    # Randomly select 2-3 focus areas each time for variety
                    selected_focus = kb_random.sample(cert_focus, min(3, len(cert_focus)))
                    kb_query = f"{' '.join(selected_focus)} {skill_context} AWS {research.company_info.industry}"
                    yield f"data: {json.dumps({'type': 'status', 'message': f'🎲 Focus: {', '.join(selected_focus)} ({request.user_level})'})}\n\n"
                else:
                    kb_query = f"{research.company_info.industry} {skill_context} AWS architecture"
                
                # Get embedding for the query
                from openai import AsyncOpenAI
                from utils import get_request_api_key
                
                client = AsyncOpenAI(api_key=get_request_api_key())
                embed_response = await client.embeddings.create(
                    model="text-embedding-3-small",
                    input=kb_query
                )
                query_embedding = embed_response.data[0].embedding
                
                # Search knowledge chunks
                kb_results = await db.search_knowledge_chunks(
                    query_embedding=query_embedding,
                    limit=5
                )
                
                if kb_results:
                    yield f"data: {json.dumps({'type': 'status', 'message': f'📖 Found {len(kb_results)} relevant AWS knowledge chunks'})}\n\n"
                    for chunk in kb_results:
                        yield f"data: {json.dumps({'type': 'knowledge', 'url': chunk['url'], 'similarity': round(chunk['similarity'], 2)})}\n\n"
                        knowledge_context += f"\n\nAWS Knowledge ({chunk['url']}):\n{chunk['content'][:500]}"
                        # Extract AWS services mentioned for topic variety
                        chunk_content = chunk['content'].lower()
                        for svc in ['s3', 'ec2', 'lambda', 'rds', 'dynamodb', 'cloudwatch', 'iam', 'vpc', 'cloudfront', 'sns', 'sqs', 'kms', 'cloudtrail', 'config']:
                            if svc in chunk_content and svc.upper() not in knowledge_topics:
                                knowledge_topics.append(svc.upper())
                    
                    # Add variety instruction based on found topics
                    if knowledge_topics:
                        knowledge_context += f"\n\n⚡ IMPORTANT: Base your challenge titles on these specific AWS topics found: {', '.join(knowledge_topics[:5])}. Create action-oriented titles like 'Secure the S3 Buckets' or 'Configure CloudWatch Alarms' - NOT generic titles like 'Understanding X'."
                else:
                    yield f"data: {json.dumps({'type': 'status', 'message': '📖 No specific knowledge chunks found, using general AWS knowledge'})}\n\n"
            except Exception as kb_err:
                logger.warning(f"Knowledge base search failed: {kb_err}")
                yield f"data: {json.dumps({'type': 'status', 'message': '⚠️ Knowledge base search skipped'})}\n\n"
            
            # Step 4: Building persona
            persona_context = None
            if request.cert_code and request.cert_code in CERTIFICATION_PERSONAS:
                persona = CERTIFICATION_PERSONAS[request.cert_code]
                persona_context = {
                    "cert_code": request.cert_code,
                    "cert_name": persona["cert"],
                    "level": persona["level"],
                    "focus_areas": ", ".join(persona["focus"]),
                    "style": persona["style"],
                }
                cert_name = persona["cert"]
                yield f"data: {json.dumps({'type': 'status', 'message': f'🎯 Applying {cert_name} certification focus...', 'step': 4, 'total_steps': 5})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'status', 'message': '🎯 Building general cloud scenario...', 'step': 4, 'total_steps': 5})}\n\n"
            
            await asyncio.sleep(0.1)
            
            # Step 5: Generating scenario
            yield f"data: {json.dumps({'type': 'status', 'message': '⚡ Generating challenges and learning objectives...', 'step': 5, 'total_steps': 5})}\n\n"
            
            company_info = GenCompanyInfo(
                name=research.company_info.name,
                industry=research.company_info.industry,
                description=research.company_info.description,
                key_services=research.company_info.key_services,
                technology_stack=research.company_info.technology_stack,
                compliance_requirements=research.company_info.compliance_requirements,
                data_types=research.company_info.data_types,
                employee_count=research.company_info.employee_count,
            )
            
            scenario = await gen_scenario(
                company_info=company_info,
                user_level=request.user_level,
                persona_context=persona_context,
                knowledge_context=knowledge_context if knowledge_context else None,
            )
            
            # Save to database if place_id provided
            if request.place_id:
                try:
                    await db.save_scenario(
                        location_id=request.place_id,
                        scenario_data=scenario.model_dump(),
                        company_info=research.company_info.model_dump(),
                    )
                except Exception as db_err:
                    logger.warning(f"Failed to save scenario to DB: {db_err}")
            
            # Final result
            yield f"data: {json.dumps({'type': 'complete', 'scenario': scenario.model_dump(), 'company_info': research.company_info.model_dump(), 'cert_code': request.cert_code, 'cert_name': persona_context['cert_name'] if persona_context else None})}\n\n"
            
        except Exception as e:
            logger.error(f"Stream generation error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            set_request_api_key(None)
            set_request_model(None)
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


class LearningChatRequestWithSession(BaseModel):
    """Request for learning chat with session tracking"""
    message: str
    session_id: Optional[str] = None  # For continuing conversations
    scenario_id: Optional[str] = None
    challenge_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None  # For personalization
    openai_api_key: Optional[str] = None  # BYOK - user's own API key
    preferred_model: Optional[str] = None  # User's preferred model (can be changed dynamically)


@app.post("/api/learning/chat")
async def learning_chat_endpoint(request: LearningChatRequestWithSession):
    """Interactive coaching chat with Sophia - saves to DB for continuity"""
    try:
        # Set request-scoped API key and model if provided (BYOK + dynamic model switching)
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        # Create or use existing session
        session_id = request.session_id
        if not session_id:
            session_id = str(uuid.uuid4())
            # Create new coaching session
            try:
                await db.create_coaching_session(
                    session_id=session_id,
                    scenario_id=request.scenario_id,
                    user_id=request.user_id,
                )
            except Exception as db_err:
                logger.warning(f"Failed to create session: {db_err}")
        
        # Load scenario if provided
        scenario = None
        if request.scenario_id:
            scenario_data = await db.get_scenario(request.scenario_id)
            if scenario_data:
                scenario = CloudScenario(**scenario_data)
        
        # Save user message to DB
        try:
            await db.save_coaching_message(
                session_id=session_id,
                role="user",
                content=request.message,
                metadata={"challenge_id": request.challenge_id} if request.challenge_id else None,
            )
        except Exception as db_err:
            logger.warning(f"Failed to save user message: {db_err}")
        
        # Get coaching response
        response = await get_coaching_response(
            message=request.message,
            scenario=scenario,
            challenge_id=request.challenge_id,
            context=request.context
        )
        
        # Save assistant response to DB
        try:
            await db.save_coaching_message(
                session_id=session_id,
                role="assistant",
                content=response,
            )
        except Exception as db_err:
            logger.warning(f"Failed to save assistant message: {db_err}")
        
        return {
            "response": response,
            "session_id": session_id,
            "scenario_id": request.scenario_id,
            "challenge_id": request.challenge_id
        }
    except Exception as e:
        logger.error(f"Learning chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clear request-scoped context
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@app.get("/api/learning/chat/history/{session_id}")
async def get_chat_history(session_id: str, limit: int = 50):
    """Get chat history for a session"""
    try:
        messages = await db.get_session_history(session_id, limit=limit)
        return {"session_id": session_id, "messages": messages}
    except Exception as e:
        logger.error(f"Get chat history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/learning/evaluate-solution")
async def evaluate_solution_endpoint(
    scenario_id: str,
    challenge_id: str,
    solution: Dict[str, Any]
):
    """Evaluate a user's solution to a challenge"""
    scenario = await db.get_scenario(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    challenge = next((c for c in scenario.get("challenges", []) if c["id"] == challenge_id), None)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    system_prompt = f"""{SOLUTION_EVALUATOR_PROMPT.format(
        challenge_title=challenge["title"],
        challenge_description=challenge["description"],
        success_criteria=", ".join(challenge.get("success_criteria", [])),
        aws_services=", ".join(challenge.get("aws_services_relevant", [])),
        solution=json.dumps(solution),
    )}

Return JSON with: score (0-100), passed (boolean), strengths (list), improvements (list), feedback (string)"""
    
    result = await async_chat_completion_json(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Evaluate this solution."},
        ],
        model="gpt-4o",
    )
    
    return {
        "score": result.get("score", 0),
        "feedback": result.get("feedback", ""),
        "passed": result.get("passed", False),
        "strengths": result.get("strengths", []),
        "improvements": result.get("improvements", []),
    }


# ============================================
# ARCHITECTURE DIAGRAM AUDITING
# ============================================

class DiagramNode(BaseModel):
    """A node in the architecture diagram"""
    id: str
    type: str  # AWS service type (ec2, rds, vpc, etc.)
    label: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    parent_id: Optional[str] = None  # Which container this node is inside
    position: Optional[Dict[str, float]] = None  # x, y coordinates

class DiagramConnection(BaseModel):
    """A connection between nodes"""
    from_node: str = Field(alias="from")
    to_node: str = Field(alias="to")
    
    class Config:
        populate_by_name = True

class AuditDiagramRequest(BaseModel):
    """Request to audit an architecture diagram"""
    nodes: List[DiagramNode]
    connections: List[DiagramConnection]
    challenge_id: Optional[str] = None
    challenge_title: Optional[str] = None
    challenge_brief: Optional[str] = None
    expected_services: Optional[List[str]] = None  # AWS services expected in solution
    session_id: Optional[str] = None
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None

class AuditDiagramResponse(BaseModel):
    """Structured response from diagram audit"""
    score: int = Field(ge=0, le=100, description="Score out of 100")
    correct: List[str] = Field(description="What the user got right")
    missing: List[str] = Field(description="What's missing from the architecture")
    suggestions: List[str] = Field(description="Specific improvement suggestions")
    feedback: str = Field(description="Overall feedback paragraph")
    session_id: Optional[str] = None


DIAGRAM_AUDIT_PROMPT = """You are Sophia, an expert AWS Solutions Architect coaching a learner on their architecture diagram.

## Challenge Context
Title: {challenge_title}
Brief: {challenge_brief}
Expected AWS Services: {expected_services}

## User's Architecture Diagram
```json
{diagram_json}
```

## Understanding the Diagram Structure
The diagram data shows:
- **architecture_hierarchy**: Nested structure showing what's INSIDE what (e.g., EC2 inside Subnet inside VPC)
- **all_nodes**: Flat list with "inside" field showing parent container
- **connections**: Data flow/dependencies between services

**CRITICAL: Analyze the NESTING carefully!**
- Is the database inside a PRIVATE subnet? (security best practice)
- Are web servers in a PUBLIC subnet with the load balancer?
- Is there proper network isolation (VPC → Subnets → Security Groups)?
- Are global services (S3, CloudFront, DynamoDB) correctly OUTSIDE the VPC?

## CRITICAL COACHING RULES
You are a COACH, not a cheat sheet. You must NEVER give away answers directly.

**NEVER say things like:**
- "Add an Application Load Balancer"
- "You're missing Auto Scaling"
- "Move RDS to a private subnet"
- "Add a NAT Gateway"

**INSTEAD, guide them to discover the answer:**
- "What happens when traffic spikes? How would your single EC2 handle 10x the load?"
- "If one instance fails, what happens to your users? Think about resilience..."
- "Look at where your database is placed - who can reach it from the internet right now?"
- "Think about the network path - how does traffic flow from users to your app to your data?"
- "Consider the blast radius - if this subnet is compromised, what else is exposed?"

## Your Coaching Approach
1. **Analyze the hierarchy** - is the nesting correct for security/best practices?
2. **Ask leading questions** that make them think about placement
3. **Describe the PROBLEM**, not the solution
4. **Use scenarios**: "Imagine if a hacker..." or "What happens when..."
5. **Celebrate correct nesting** - "Good job putting X inside Y!"

## Response Format
Return ONLY valid JSON (no markdown, no explanation outside JSON):
{{
  "score": <0-100>,
  "correct": ["things they got right - especially correct PLACEMENT/NESTING"],
  "missing": ["describe the GAP or PROBLEM, not the solution - focus on placement issues"],
  "suggestions": ["coaching questions about WHERE things should be, not WHAT to add"],
  "feedback": "2-3 sentence coaching message - acknowledge progress, hint at placement/nesting issues"
}}

Remember: A good coach helps learners discover answers themselves. The "aha!" moment is theirs to have."""


@app.post("/api/learning/audit-diagram", response_model=AuditDiagramResponse)
async def audit_diagram_endpoint(request: AuditDiagramRequest):
    """
    Audit a user's AWS architecture diagram.
    
    Analyzes the diagram against challenge requirements and returns
    structured feedback with score, correct elements, missing elements,
    and suggestions for improvement.
    """
    try:
        # Set request-scoped API key and model if provided (BYOK)
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        # Build hierarchical structure for the agent to understand nesting
        # First, create a lookup of all nodes
        nodes_by_id = {n.id: n for n in request.nodes}
        
        # Build the hierarchy - group children under parents
        def build_node_data(node: DiagramNode) -> Dict:
            data = {
                "id": node.id,
                "type": node.type,
                "label": node.label,
            }
            if node.config:
                data["config"] = node.config
            if node.parent_id:
                data["inside"] = node.parent_id  # More readable than parent_id
            return data
        
        # Separate into containers and resources for clearer structure
        containers = [n for n in request.nodes if n.type in ("vpc", "subnet", "subnet-public", "subnet-private", "security-group", "auto-scaling")]
        resources = [n for n in request.nodes if n not in containers]
        
        # Build a hierarchical view
        hierarchy = {}
        for node in request.nodes:
            if not node.parent_id:
                # Top-level node
                if node.id not in hierarchy:
                    hierarchy[node.id] = {"node": build_node_data(node), "children": []}
            else:
                # Child node - add to parent's children
                if node.parent_id not in hierarchy:
                    parent = nodes_by_id.get(node.parent_id)
                    if parent:
                        hierarchy[node.parent_id] = {"node": build_node_data(parent), "children": []}
                if node.parent_id in hierarchy:
                    hierarchy[node.parent_id]["children"].append(build_node_data(node))
        
        # Prepare diagram JSON for the prompt
        diagram_data = {
            "architecture_hierarchy": [
                {
                    **h["node"],
                    "contains": h["children"] if h["children"] else None
                }
                for h in hierarchy.values()
            ],
            "all_nodes": [build_node_data(n) for n in request.nodes],
            "connections": [
                {"from": c.from_node, "to": c.to_node}
                for c in request.connections
            ]
        }
        
        # Build the audit prompt
        system_prompt = DIAGRAM_AUDIT_PROMPT.format(
            challenge_title=request.challenge_title or "AWS Architecture Challenge",
            challenge_brief=request.challenge_brief or "Design a secure, scalable AWS architecture.",
            expected_services=", ".join(request.expected_services) if request.expected_services else "Not specified",
            diagram_json=json.dumps(diagram_data, indent=2),
        )
        
        # Get OpenAI client using request-scoped key
        from utils import get_request_api_key, get_request_model
        api_key = get_request_api_key()
        if not api_key:
            raise HTTPException(status_code=402, detail="OpenAI API key required. Please configure your API key in Settings.")
        
        client = AsyncOpenAI(api_key=api_key)
        model = get_request_model() or "gpt-4o"
        
        # Call OpenAI for structured audit
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Audit this architecture diagram and return JSON."},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,  # Lower temperature for consistent scoring
        )
        
        # Parse response
        result_text = response.choices[0].message.content
        result = json.loads(result_text)
        
        # Ensure all required fields
        audit_result = AuditDiagramResponse(
            score=result.get("score", 50),
            correct=result.get("correct", []),
            missing=result.get("missing", []),
            suggestions=result.get("suggestions", []),
            feedback=result.get("feedback", "Unable to generate feedback."),
            session_id=request.session_id,
        )
        
        logger.info(f"Diagram audit complete: score={audit_result.score}, nodes={len(request.nodes)}")
        return audit_result
        
    except Exception as e:
        logger.error(f"Diagram audit error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clear request-scoped context
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


class ChallengeQuestionsRequest(BaseModel):
    """Request to generate questions for a specific challenge"""
    challenge: Dict[str, Any]  # id, title, description, hints, success_criteria, aws_services_relevant
    company_name: str
    industry: str
    business_context: str
    user_level: str = "intermediate"
    cert_code: Optional[str] = None
    question_count: int = 5
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


class GradeChallengeAnswerRequest(BaseModel):
    """Request to grade a challenge question answer"""
    question: Dict[str, Any]  # The question object
    user_answer: str
    company_context: str
    user_level: str = "intermediate"
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


@app.post("/api/learning/challenge-questions")
async def generate_challenge_questions_endpoint(request: ChallengeQuestionsRequest):
    """Generate questions for a specific challenge, tailored to the business case"""
    from generators.challenge_questions import generate_challenge_questions
    
    try:
        # Set request-scoped API key and model if provided (BYOK)
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        result = await generate_challenge_questions(
            challenge=request.challenge,
            company_name=request.company_name,
            industry=request.industry,
            business_context=request.business_context,
            user_level=request.user_level,
            cert_code=request.cert_code,
            question_count=request.question_count,
        )
        
        return {
            "success": True,
            "challenge_id": result.challenge_id,
            "challenge_title": result.challenge_title,
            "brief": result.brief,
            "questions": [q.model_dump() for q in result.questions],
            "total_points": result.total_points,
            "estimated_time_minutes": result.estimated_time_minutes,
        }
    except Exception as e:
        logger.error(f"Challenge questions generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@app.post("/api/learning/grade-challenge-answer")
async def grade_challenge_answer_endpoint(request: GradeChallengeAnswerRequest):
    """Grade a user's answer to a challenge question"""
    from generators.challenge_questions import grade_challenge_answer, ChallengeQuestion, QuestionOption
    
    try:
        # Set request-scoped API key and model if provided (BYOK)
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        # Reconstruct the question object
        q = request.question
        options = None
        if q.get("options"):
            options = [QuestionOption(**o) for o in q["options"]]
        
        question = ChallengeQuestion(
            id=q.get("id", ""),
            question=q.get("question", ""),
            question_type=q.get("question_type", "multiple_choice"),
            options=options,
            correct_answer=q.get("correct_answer", ""),
            explanation=q.get("explanation", ""),
            hint=q.get("hint"),
            points=q.get("points", 20),
            aws_services=q.get("aws_services", []),
            difficulty=q.get("difficulty", "intermediate"),
        )
        
        result = await grade_challenge_answer(
            question=question,
            user_answer=request.user_answer,
            company_context=request.company_context,
            user_level=request.user_level,
        )
        
        return {"success": True, **result}
    except Exception as e:
        logger.error(f"Grade challenge answer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@app.post("/api/learning/generate-flashcards")
async def generate_flashcards_endpoint(request: GenerateContentRequest):
    """Generate flashcards for a scenario - persona-aware"""
    from generators.flashcards import generate_flashcards
    
    try:
        # Set request-scoped API key and model if provided (BYOK)
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        scenario = await db.get_scenario(request.scenario_id)
        if not scenario:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        # Get persona - from request, user settings, or default
        persona_id = request.persona_id
        if not persona_id and request.user_id:
            persona_id = await db.get_user_persona(request.user_id)
        if not persona_id:
            persona_id = DEFAULT_PERSONA
        
        persona_ctx = get_persona_context(persona_id)
        
        aws_services = set()
        for c in scenario.get("challenges", []):
            aws_services.update(c.get("aws_services_relevant", []))
        
        deck = await generate_flashcards(
            scenario_title=scenario["scenario_title"],
            business_context=scenario["business_context"],
            aws_services=list(aws_services),
            user_level=request.user_level,
            card_count=request.options.get("card_count", 20) if request.options else 20,
            challenges=scenario.get("challenges"),
            persona_context=persona_ctx,  # Pass persona context
        )
        
        deck_id = await db.save_flashcard_deck(
            scenario_id=request.scenario_id,
            deck_data=deck.model_dump(),
        )
        
        return {"success": True, "deck_id": deck_id, "deck": deck.model_dump(), "persona": persona_id}
    finally:
        # Clear request-scoped context
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@app.post("/api/learning/generate-notes")
async def generate_notes_endpoint(request: GenerateContentRequest):
    """Generate study notes for a scenario - persona-aware"""
    from generators.notes import generate_notes
    
    try:
        # Set request-scoped API key and model if provided (BYOK)
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        scenario = await db.get_scenario(request.scenario_id)
        if not scenario:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        # Get persona
        persona_id = request.persona_id
        if not persona_id and request.user_id:
            persona_id = await db.get_user_persona(request.user_id)
        if not persona_id:
            persona_id = DEFAULT_PERSONA
        
        persona_ctx = get_persona_context(persona_id)
        
        aws_services = set()
        for c in scenario.get("challenges", []):
            aws_services.update(c.get("aws_services_relevant", []))
        
        notes = await generate_notes(
            scenario_title=scenario["scenario_title"],
            business_context=scenario["business_context"],
            technical_requirements=scenario.get("technical_requirements", []),
            compliance_requirements=scenario.get("compliance_requirements", []),
            aws_services=list(aws_services),
            user_level=request.user_level,
            challenges=scenario.get("challenges"),
            persona_context=persona_ctx,
        )
        
        notes_id = await db.save_study_notes(
            scenario_id=request.scenario_id,
            notes_data=notes.model_dump(),
        )
        
        return {"success": True, "notes_id": notes_id, "notes": notes.model_dump(), "persona": persona_id}
    finally:
        # Clear request-scoped context
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@app.post("/api/learning/generate-quiz")
async def generate_quiz_endpoint(request: GenerateContentRequest):
    """Generate a quiz for a scenario - persona-aware"""
    from generators.quiz import generate_quiz
    
    try:
        # Set request-scoped API key and model if provided (BYOK)
        from utils import set_request_api_key, set_request_model
        if request.openai_api_key:
            set_request_api_key(request.openai_api_key)
        if request.preferred_model:
            set_request_model(request.preferred_model)
        
        scenario = await db.get_scenario(request.scenario_id)
        if not scenario:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        # Get persona
        persona_id = request.persona_id
        if not persona_id and request.user_id:
            persona_id = await db.get_user_persona(request.user_id)
        if not persona_id:
            persona_id = DEFAULT_PERSONA
        
        persona_ctx = get_persona_context(persona_id)
        
        aws_services = set()
        for c in scenario.get("challenges", []):
            aws_services.update(c.get("aws_services_relevant", []))
        
        quiz = await generate_quiz(
            scenario_title=scenario["scenario_title"],
            business_context=scenario["business_context"],
            aws_services=list(aws_services),
            learning_objectives=scenario.get("learning_objectives", []),
            user_level=request.user_level,
            question_count=request.options.get("question_count", 10) if request.options else 10,
            challenges=scenario.get("challenges"),
            persona_context=persona_ctx,
        )
        
        quiz_id = await db.save_quiz(
            scenario_id=request.scenario_id,
            quiz_data=quiz.model_dump(),
        )
        
        return {"success": True, "quiz_id": quiz_id, "quiz": quiz.model_dump(), "persona": persona_id}
    finally:
        # Clear request-scoped context
        from utils import set_request_api_key, set_request_model
        set_request_api_key(None)
        set_request_model(None)


@app.post("/api/learning/detect-skill")
async def detect_skill_endpoint(message: str):
    """Detect user's skill level from a message"""
    level = await detect_skill_level(message)
    return {"skill_level": level}


# ============================================
# LEARNING JOURNEY ENDPOINTS
# ============================================

class LearningJourneyRequest(BaseModel):
    """Request for learning journey operations"""
    profile_id: str
    tenant_id: str


class TrackScenarioRequest(LearningJourneyRequest):
    """Track scenario start"""
    scenario_id: str
    scenario_title: str
    company_name: str
    difficulty: str
    aws_services: Optional[List[str]] = None


class TrackChallengeRequest(LearningJourneyRequest):
    """Track challenge completion"""
    scenario_id: str
    challenge_id: str
    challenge_title: str
    score: int
    passed: bool
    aws_services: Optional[List[str]] = None


class TrackFlashcardRequest(LearningJourneyRequest):
    """Track flashcard study"""
    deck_id: str
    deck_title: str
    cards_studied: int
    aws_services: Optional[List[str]] = None


class TrackQuizRequest(LearningJourneyRequest):
    """Track quiz attempt"""
    quiz_id: str
    quiz_title: str
    score: int
    passed: bool
    aws_services: Optional[List[str]] = None


@app.post("/api/learning/journey/track-scenario")
async def track_scenario_start_endpoint(request: TrackScenarioRequest):
    """Track when a learner starts a scenario"""
    ctx = await get_context()
    result = await track_learner_scenario_start(
        neo4j_driver=ctx.neo4j_driver,
        profile_id=request.profile_id,
        tenant_id=request.tenant_id,
        scenario_id=request.scenario_id,
        scenario_title=request.scenario_title,
        company_name=request.company_name,
        difficulty=request.difficulty,
        aws_services=request.aws_services
    )
    return result


@app.post("/api/learning/journey/track-challenge")
async def track_challenge_endpoint(request: TrackChallengeRequest):
    """Track when a learner completes a challenge"""
    ctx = await get_context()
    result = await track_challenge_completion(
        neo4j_driver=ctx.neo4j_driver,
        profile_id=request.profile_id,
        tenant_id=request.tenant_id,
        scenario_id=request.scenario_id,
        challenge_id=request.challenge_id,
        challenge_title=request.challenge_title,
        score=request.score,
        passed=request.passed,
        aws_services=request.aws_services
    )
    return result


@app.post("/api/learning/journey/track-flashcards")
async def track_flashcard_endpoint(request: TrackFlashcardRequest):
    """Track flashcard study session"""
    ctx = await get_context()
    result = await track_flashcard_study(
        neo4j_driver=ctx.neo4j_driver,
        profile_id=request.profile_id,
        tenant_id=request.tenant_id,
        deck_id=request.deck_id,
        deck_title=request.deck_title,
        cards_studied=request.cards_studied,
        aws_services=request.aws_services
    )
    return result


@app.post("/api/learning/journey/track-quiz")
async def track_quiz_endpoint(request: TrackQuizRequest):
    """Track quiz attempt"""
    ctx = await get_context()
    result = await track_quiz_attempt(
        neo4j_driver=ctx.neo4j_driver,
        profile_id=request.profile_id,
        tenant_id=request.tenant_id,
        quiz_id=request.quiz_id,
        quiz_title=request.quiz_title,
        score=request.score,
        passed=request.passed,
        aws_services=request.aws_services
    )
    return result


@app.get("/api/learning/journey/{profile_id}")
async def get_journey_endpoint(profile_id: str, tenant_id: str):
    """Get a learner's complete learning journey"""
    ctx = await get_context()
    result = await get_learner_journey(
        neo4j_driver=ctx.neo4j_driver,
        profile_id=profile_id,
        tenant_id=tenant_id
    )
    return result


@app.get("/api/learning/journey/{profile_id}/recommendations")
async def get_recommendations_endpoint(profile_id: str, tenant_id: str, limit: int = 5):
    """Get recommended next learning steps"""
    ctx = await get_context()
    result = await get_recommended_next_steps(
        neo4j_driver=ctx.neo4j_driver,
        profile_id=profile_id,
        tenant_id=tenant_id,
        limit=limit
    )
    return result


# ============================================
# LEARNER JOURNEY REPORTS
# ============================================

class GenerateReportRequest(BaseModel):
    """Request to generate a learning journey report"""
    report_type: str = "progress"  # progress, strengths, recommendations, full


@app.post("/api/learning/journey/{profile_id}/report")
async def generate_journey_report(profile_id: str, request: GenerateReportRequest):
    """Generate a learning journey report for a user"""
    
    # Get journey data from DB
    journey_data = await db.get_learner_journey_data(profile_id)
    if not journey_data:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Get strengths/weaknesses analysis
    analysis = await db.get_learner_strengths_weaknesses(profile_id)
    
    # Get user's persona for personalized report
    persona_id = await db.get_user_persona(profile_id)
    persona = get_persona_info(persona_id or DEFAULT_PERSONA)
    
    # Build report prompt based on type
    report_prompts = {
        "progress": f"""Generate a learning progress report for this AWS learner.
Focus on: scenarios completed, quiz scores, flashcard mastery, time spent.
Be encouraging but honest about areas needing work.""",
        
        "strengths": f"""Analyze this learner's strengths and weaknesses.
Identify AWS services/topics they excel at and struggle with.
Provide specific recommendations for improvement.""",
        
        "recommendations": f"""Create a personalized learning plan for this learner.
Based on their progress and the {persona['cert']} certification track.
Suggest next scenarios, topics to study, and skills to develop.""",
        
        "full": f"""Generate a comprehensive learning journey report including:
1. Progress Summary - scenarios, quizzes, flashcards, time
2. Strengths & Weaknesses - what they know vs need to learn
3. Certification Readiness - for {persona['cert']}
4. Recommended Next Steps - prioritized learning plan
5. Achievements & Milestones"""
    }
    
    prompt = report_prompts.get(request.report_type, report_prompts["progress"])
    
    system_prompt = f"""You are generating a learning journey report.
    
Learner Profile:
- Name: {journey_data['profile'].get('displayName', 'Learner')}
- Skill Level: {journey_data['profile'].get('skillLevel', 'beginner')}
- Total Points: {journey_data['profile'].get('totalPoints', 0)}
- Current Level: {journey_data['profile'].get('currentLevel', 1)}
- Time Spent: {journey_data['profile'].get('totalTimeMinutes', 0)} minutes

Scenarios Attempted: {len(journey_data.get('scenarios', []))}
Quiz Stats: {json.dumps(journey_data.get('quiz_stats', {}))}
Flashcard Stats: {json.dumps(journey_data.get('flashcard_stats', {}))}
Coaching Sessions: {len(journey_data.get('coaching_sessions', []))}

Strengths: {json.dumps(analysis.get('strong_areas', []))}
Weaknesses: {json.dumps(analysis.get('weak_areas', []))}

Certification Track: {persona['cert']}
Focus Areas: {', '.join(persona['focus'])}

{prompt}

Format the report in clean Markdown. Be specific and actionable."""

    # Generate report
    from utils import get_request_model
    result = await async_chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Generate a {request.report_type} report for this learner."},
        ],
        model=get_request_model(),
    )
    
    report_content = result
    
    # Generate summary
    summary = f"{request.report_type.title()} Report - {journey_data['profile'].get('displayName', 'Learner')}"
    
    # Save report
    report_id = await db.save_journey_report(
        profile_id=profile_id,
        report_type=request.report_type,
        content=report_content,
        summary=summary,
        metadata={
            "persona": persona_id,
            "cert_track": persona['cert'],
        }
    )
    
    return {
        "success": True,
        "report_id": report_id,
        "report_type": request.report_type,
        "content": report_content,
        "summary": summary,
    }


@app.get("/api/learning/journey/{profile_id}/reports")
async def get_journey_reports_endpoint(profile_id: str, limit: int = 10):
    """Get saved journey reports for a user"""
    reports = await db.get_journey_reports(profile_id, limit)
    return {"success": True, "reports": reports, "count": len(reports)}


@app.get("/api/learning/journey/{profile_id}/data")
async def get_journey_data_endpoint(profile_id: str):
    """Get raw learning journey data for a user"""
    data = await db.get_learner_journey_data(profile_id)
    if not data:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    analysis = await db.get_learner_strengths_weaknesses(profile_id)
    
    return {
        "success": True,
        "journey": data,
        "analysis": analysis,
    }


# ============================================
# AI MODEL CONFIGURATION ENDPOINTS
# ============================================

@app.get("/api/models")
async def list_available_models():
    """List all available OpenAI models for selection"""
    return {
        "models": list(AVAILABLE_MODELS.values()),
        "default": DEFAULT_MODEL
    }


class UpdateAIConfigRequest(BaseModel):
    """Request to update AI configuration"""
    openai_api_key: Optional[str] = None
    preferred_model: Optional[str] = None


@app.get("/api/tenant/{tenant_id}/ai-config")
async def get_tenant_ai_config_endpoint(tenant_id: str):
    """Get tenant's AI configuration"""
    config = await db.get_tenant_ai_config(tenant_id)
    if not config:
        return {"success": False, "error": "Tenant not found"}
    
    # Mask the API key for security
    if config.get("openai_api_key"):
        key = config["openai_api_key"]
        config["openai_api_key_masked"] = f"sk-...{key[-4:]}" if len(key) > 4 else "***"
        config["has_custom_key"] = True
        del config["openai_api_key"]
    else:
        config["has_custom_key"] = False
    
    return {"success": True, **config}


@app.put("/api/tenant/{tenant_id}/ai-config")
async def update_tenant_ai_config_endpoint(tenant_id: str, request: UpdateAIConfigRequest):
    """Update tenant's AI configuration (API key and/or model)"""
    # Validate model if provided
    if request.preferred_model and request.preferred_model not in AVAILABLE_MODELS:
        return {
            "success": False,
            "error": f"Invalid model. Available: {list(AVAILABLE_MODELS.keys())}"
        }
    
    # Validate API key format if provided
    if request.openai_api_key:
        if not request.openai_api_key.startswith("sk-"):
            return {"success": False, "error": "Invalid API key format"}
    
    success = await db.update_tenant_ai_config(
        tenant_id=tenant_id,
        openai_api_key=request.openai_api_key,
        preferred_model=request.preferred_model
    )
    
    if success:
        # Clear cached client for this tenant
        keys_to_remove = [k for k in _tenant_clients.keys() if k.startswith(f"{tenant_id}:")]
        for k in keys_to_remove:
            del _tenant_clients[k]
        
        return {"success": True, "message": "AI configuration updated"}
    
    return {"success": False, "error": "Failed to update configuration"}


@app.delete("/api/tenant/{tenant_id}/ai-config/key")
async def remove_tenant_api_key(tenant_id: str):
    """Remove tenant's custom API key (will fall back to system default)"""
    success = await db.update_tenant_ai_config(
        tenant_id=tenant_id,
        openai_api_key=""  # Empty string to clear
    )
    
    if success:
        # Clear cached client
        keys_to_remove = [k for k in _tenant_clients.keys() if k.startswith(f"{tenant_id}:")]
        for k in keys_to_remove:
            del _tenant_clients[k]
        
        return {"success": True, "message": "API key removed, using system default"}
    
    return {"success": False, "error": "Failed to remove API key"}


@app.get("/api/user/{user_id}/ai-config")
async def get_user_ai_config_endpoint(user_id: str):
    """Get user's AI configuration"""
    config = await db.get_user_ai_config(user_id)
    if not config:
        return {"success": False, "error": "User not found"}
    
    # Mask the API key for security
    if config.get("openai_api_key"):
        key = config["openai_api_key"]
        config["openai_api_key_masked"] = f"sk-...{key[-4:]}" if len(key) > 4 else "***"
        config["has_custom_key"] = True
        del config["openai_api_key"]
    else:
        config["has_custom_key"] = False
    
    return {"success": True, **config}


@app.put("/api/user/{user_id}/ai-config")
async def update_user_ai_config_endpoint(user_id: str, request: UpdateAIConfigRequest):
    """Update user's AI configuration"""
    if request.preferred_model and request.preferred_model not in AVAILABLE_MODELS:
        return {
            "success": False,
            "error": f"Invalid model. Available: {list(AVAILABLE_MODELS.keys())}"
        }
    
    if request.openai_api_key and not request.openai_api_key.startswith("sk-"):
        return {"success": False, "error": "Invalid API key format"}
    
    success = await db.update_user_ai_config(
        user_id=user_id,
        openai_api_key=request.openai_api_key,
        preferred_model=request.preferred_model
    )
    
    if success:
        # Clear cached client for this user
        keys_to_remove = [k for k in _tenant_clients.keys() if f":{user_id}:" in k]
        for k in keys_to_remove:
            del _tenant_clients[k]
        
        return {"success": True, "message": "AI configuration updated"}
    
    return {"success": False, "error": "Failed to update configuration"}


# ============================================
# PERSONA SWITCHING ENDPOINTS
# ============================================

@app.get("/api/personas")
async def list_personas():
    """List all available AWS certification-based personas"""
    personas = []
    for pid, p in AWS_PERSONAS.items():
        personas.append({
            "id": p["id"],
            "name": p["name"],
            "cert": p["cert"],
            "level": p["level"],
            "focus": p["focus"],
            "style": p["style"],
        })
    
    # Group by level
    grouped = {
        "foundational": [p for p in personas if p["level"] == "foundational"],
        "associate": [p for p in personas if p["level"] == "associate"],
        "professional": [p for p in personas if p["level"] == "professional"],
        "specialty": [p for p in personas if p["level"] == "specialty"],
    }
    
    return {
        "personas": personas,
        "grouped": grouped,
        "default": DEFAULT_PERSONA,
        "count": len(personas)
    }


@app.get("/api/personas/{persona_id}")
async def get_persona(persona_id: str):
    """Get details for a specific persona"""
    if persona_id not in AWS_PERSONAS:
        return {"success": False, "error": f"Persona '{persona_id}' not found"}
    
    return {"success": True, **get_persona_info(persona_id)}


class SetPersonaRequest(BaseModel):
    """Request to set user's active persona"""
    persona_id: str


@app.put("/api/user/{user_id}/persona")
async def set_user_persona(user_id: str, request: SetPersonaRequest):
    """Set user's active learning persona"""
    if request.persona_id not in AWS_PERSONAS:
        return {
            "success": False,
            "error": f"Invalid persona. Available: {list(AWS_PERSONAS.keys())}"
        }
    
    # Store in user settings
    success = await db.update_user_persona(user_id, request.persona_id)
    
    if success:
        persona = get_persona_info(request.persona_id)
        return {
            "success": True,
            "message": f"Persona set to {persona['name']}",
            "persona": persona
        }
    
    return {"success": False, "error": "Failed to update persona"}


@app.get("/api/user/{user_id}/persona")
async def get_user_persona(user_id: str):
    """Get user's current active persona"""
    persona_id = await db.get_user_persona(user_id)
    
    if not persona_id:
        persona_id = DEFAULT_PERSONA
    
    return {
        "success": True,
        "persona_id": persona_id,
        **get_persona_info(persona_id)
    }


# ============================================
# MAIN
# ============================================

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "1027"))
    print(f"Starting CloudMigrate Learning Agent on {host}:{port}")
    uvicorn.run(app, host=host, port=port)