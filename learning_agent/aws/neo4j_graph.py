"""
Neo4j graph operations for AWS services.
"""
import os
from typing import Dict, Any, List
from config.settings import AWS_SERVICES, AWS_RELATIONSHIP_PATTERNS, DEFAULT_TENANT_ID


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
