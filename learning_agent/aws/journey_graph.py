"""
Learning journey graph operations in Neo4j.
"""
from typing import Dict, Any, List
from config.settings import logger


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
    topic: str,
    cards_studied: int,
    cards_correct: int,
    aws_services: List[str] = None
) -> Dict[str, Any]:
    """Track flashcard study session."""
    if not neo4j_driver:
        return {"success": False, "error": "Neo4j not available"}
    
    try:
        async with neo4j_driver.session() as session:
            result = await session.run("""
                MERGE (l:Learner {id: $profile_id, tenant_id: $tenant_id})
                MERGE (t:Topic {name: $topic, tenant_id: $tenant_id})
                MERGE (l)-[r:STUDIED_FLASHCARDS]->(t)
                SET r.cards_studied = COALESCE(r.cards_studied, 0) + $cards_studied,
                    r.cards_correct = COALESCE(r.cards_correct, 0) + $cards_correct,
                    r.last_studied = datetime()
                WITH l
                UNWIND $aws_services AS service_name
                MERGE (aws:AWSService {name: service_name, tenant_id: $tenant_id})
                MERGE (l)-[learned:LEARNED]->(aws)
                ON CREATE SET learned.first_exposure = datetime()
                SET learned.last_practiced = datetime()
                RETURN count(*) as updated
            """, profile_id=profile_id, tenant_id=tenant_id, topic=topic,
                cards_studied=cards_studied, cards_correct=cards_correct,
                aws_services=aws_services or [])
            
            return {"success": True, "topic": topic}
    except Exception as e:
        logger.error(f"Error tracking flashcard study: {e}")
        return {"success": False, "error": str(e)}


async def track_quiz_attempt(
    neo4j_driver,
    profile_id: str,
    tenant_id: str,
    quiz_id: str,
    topic: str,
    score: int,
    total_questions: int,
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
                ON CREATE SET q.topic = $topic
                MERGE (l)-[r:ATTEMPTED]->(q)
                SET r.score = $score, r.total = $total_questions, r.passed = $passed, r.at = datetime()
                WITH l
                UNWIND $aws_services AS service_name
                MERGE (aws:AWSService {name: service_name, tenant_id: $tenant_id})
                MERGE (l)-[learned:LEARNED]->(aws)
                ON CREATE SET learned.first_exposure = datetime()
                SET learned.last_practiced = datetime()
                RETURN count(*) as updated
            """, profile_id=profile_id, tenant_id=tenant_id, quiz_id=quiz_id,
                topic=topic, score=score, total_questions=total_questions, passed=passed,
                aws_services=aws_services or [])
            
            return {"success": True, "quiz_id": quiz_id}
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
            # Get scenarios started
            scenarios_result = await session.run("""
                MATCH (l:Learner {id: $profile_id, tenant_id: $tenant_id})-[r:STARTED]->(s:Scenario)
                RETURN s.id as id, s.title as title, s.company as company, s.difficulty as difficulty, r.at as started_at
                ORDER BY r.at DESC
            """, profile_id=profile_id, tenant_id=tenant_id)
            scenarios = [dict(r) async for r in scenarios_result]
            
            # Get challenges completed
            challenges_result = await session.run("""
                MATCH (l:Learner {id: $profile_id, tenant_id: $tenant_id})-[r:COMPLETED]->(c:Challenge)
                RETURN c.id as id, c.title as title, r.score as score, r.passed as passed, r.at as completed_at
                ORDER BY r.at DESC
            """, profile_id=profile_id, tenant_id=tenant_id)
            challenges = [dict(r) async for r in challenges_result]
            
            # Get AWS services learned
            services_result = await session.run("""
                MATCH (l:Learner {id: $profile_id, tenant_id: $tenant_id})-[r:LEARNED]->(aws:AWSService)
                RETURN aws.name as service, aws.category as category, 
                       r.first_exposure as first_exposure, r.last_practiced as last_practiced,
                       r.practice_count as practice_count
                ORDER BY r.practice_count DESC
            """, profile_id=profile_id, tenant_id=tenant_id)
            services = [dict(r) async for r in services_result]
            
            return {
                "success": True,
                "profile_id": profile_id,
                "scenarios": scenarios,
                "challenges": challenges,
                "aws_services_learned": services,
                "stats": {
                    "scenarios_started": len(scenarios),
                    "challenges_completed": len(challenges),
                    "services_learned": len(services)
                }
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
    """Get recommended next steps based on learner's journey."""
    if not neo4j_driver:
        return {"success": False, "error": "Neo4j not available"}
    
    try:
        async with neo4j_driver.session() as session:
            # Find AWS services the learner hasn't practiced recently or at all
            result = await session.run("""
                // Get services the learner has learned
                MATCH (l:Learner {id: $profile_id, tenant_id: $tenant_id})-[r:LEARNED]->(known:AWSService)
                WITH l, collect(known.name) as known_services
                
                // Find related services they haven't learned
                MATCH (known:AWSService {tenant_id: $tenant_id})-[:CO_MENTIONED]-(recommended:AWSService {tenant_id: $tenant_id})
                WHERE known.name IN known_services AND NOT recommended.name IN known_services
                RETURN recommended.name as service, recommended.category as category,
                       count(*) as relevance_score
                ORDER BY relevance_score DESC
                LIMIT $limit
            """, profile_id=profile_id, tenant_id=tenant_id, limit=limit)
            
            recommendations = [dict(r) async for r in result]
            
            return {
                "success": True,
                "recommendations": recommendations
            }
    except Exception as e:
        logger.error(f"Error getting recommendations: {e}")
        return {"success": False, "error": str(e)}
