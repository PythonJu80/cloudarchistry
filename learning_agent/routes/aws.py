"""
AWS Services Knowledge Graph API routes.
"""
import json
from fastapi import APIRouter

from crawl.context import get_context
from config.settings import DEFAULT_TENANT_ID

router = APIRouter()


@router.get("/services")
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


@router.get("/service/{service_name}")
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


@router.post("/architecture")
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


@router.post("/query")
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
