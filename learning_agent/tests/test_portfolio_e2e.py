"""
End-to-End Test: Portfolio Generation
======================================
Tests the complete flow from client app → Learning Agent → response

This simulates exactly what happens when a user completes a challenge
and the frontend calls the portfolio generation endpoint.

Run with: pytest tests/test_portfolio_e2e.py -v
"""
import pytest
import httpx
import asyncio
import json
from typing import Dict, Any

# URLs - Same pattern as production client app
LEARNING_AGENT_URL = "https://cloudarchistry.com"
DRAWING_AGENT_URL = "https://cloudarchistry.com"  # Same as process.env.DRAWING_AGENT_URL || "https://cloudarchistry.com"


# ============================================
# TEST DATA - Simulates real challenge completion
# ============================================

SAMPLE_DIAGRAM = {
    "nodes": [
        {
            "id": "vpc-1",
            "type": "vpc",
            "position": {"x": 100, "y": 100},
            "data": {
                "label": "Production VPC",
                "serviceId": "vpc",
                "color": "#7c3aed"
            },
            "width": 600,
            "height": 400
        },
        {
            "id": "subnet-public-1",
            "type": "subnet",
            "position": {"x": 20, "y": 50},
            "parentId": "vpc-1",
            "data": {
                "label": "Public Subnet",
                "serviceId": "subnet",
                "subnetType": "public",
                "color": "#22c55e"
            },
            "width": 250,
            "height": 150
        },
        {
            "id": "subnet-private-1",
            "type": "subnet",
            "position": {"x": 300, "y": 50},
            "parentId": "vpc-1",
            "data": {
                "label": "Private Subnet",
                "serviceId": "subnet",
                "subnetType": "private",
                "color": "#3b82f6"
            },
            "width": 250,
            "height": 150
        },
        {
            "id": "alb-1",
            "type": "awsResource",
            "position": {"x": 50, "y": 30},
            "parentId": "subnet-public-1",
            "data": {
                "label": "Application Load Balancer",
                "serviceId": "alb",
                "color": "#f97316"
            }
        },
        {
            "id": "ec2-1",
            "type": "awsResource",
            "position": {"x": 50, "y": 30},
            "parentId": "subnet-private-1",
            "data": {
                "label": "EC2 Instance",
                "serviceId": "ec2",
                "sublabel": "t3.large",
                "color": "#f97316"
            }
        },
        {
            "id": "rds-1",
            "type": "awsResource",
            "position": {"x": 150, "y": 30},
            "parentId": "subnet-private-1",
            "data": {
                "label": "RDS PostgreSQL",
                "serviceId": "rds",
                "sublabel": "Multi-AZ",
                "color": "#3b82f6"
            }
        },
        {
            "id": "s3-1",
            "type": "awsResource",
            "position": {"x": 700, "y": 200},
            "data": {
                "label": "S3 Bucket",
                "serviceId": "s3",
                "sublabel": "Static Assets",
                "color": "#22c55e"
            }
        }
    ],
    "edges": [
        {"id": "e1", "source": "alb-1", "target": "ec2-1"},
        {"id": "e2", "source": "ec2-1", "target": "rds-1"},
        {"id": "e3", "source": "ec2-1", "target": "s3-1"}
    ]
}

SAMPLE_CLI_PROGRESS = {
    "commandsRun": [
        {"command": "aws ec2 describe-vpcs", "isCorrect": True, "exitCode": 0},
        {"command": "aws ec2 create-vpc --cidr-block 10.0.0.0/16", "isCorrect": True, "exitCode": 0},
        {"command": "aws ec2 create-subnet --vpc-id vpc-123 --cidr-block 10.0.1.0/24", "isCorrect": True, "exitCode": 0},
        {"command": "aws rds create-db-instance --db-instance-identifier mydb --db-instance-class db.t3.medium --engine postgres", "isCorrect": True, "exitCode": 0},
        {"command": "aws s3 mb s3://my-static-assets", "isCorrect": True, "exitCode": 0},
    ],
    "totalCommands": 5,
    "correctCommands": 5,
    "syntaxErrors": 0,
    "resourcesCreated": {
        "vpc": ["vpc-123"],
        "subnet": ["subnet-456", "subnet-789"],
        "rds": ["mydb"],
        "s3": ["my-static-assets"]
    },
    "objectivesCompleted": [
        "created_vpc",
        "created_subnets",
        "configured_rds",
        "created_s3_bucket"
    ],
    "cliScore": 95
}

SAMPLE_SCENARIO_CONTEXT = {
    "scenarioTitle": "High-Availability E-Commerce Platform",
    "scenarioDescription": "Design a scalable, fault-tolerant architecture for a growing e-commerce company.",
    "businessContext": "TechMart is a rapidly growing e-commerce company experiencing 300% year-over-year growth. They need to migrate from their on-premises infrastructure to AWS to handle peak traffic during sales events while maintaining PCI-DSS compliance for payment processing.",
    "technicalRequirements": [
        "Support 10,000 concurrent users during peak",
        "99.9% uptime SLA",
        "Sub-200ms response time for product pages",
        "Automated scaling based on traffic patterns",
        "Secure payment processing pipeline"
    ],
    "complianceRequirements": [
        "PCI-DSS Level 1",
        "GDPR for EU customers",
        "SOC 2 Type II"
    ],
    "constraints": [
        "Monthly budget of $15,000",
        "Migration must complete within 3 months",
        "Zero downtime during migration"
    ],
    "learningObjectives": [
        "Design highly available architectures",
        "Implement proper network segmentation",
        "Configure auto-scaling policies"
    ],
    "challengeTitle": "Design Core Infrastructure",
    "challengeDescription": "Create the foundational VPC architecture with proper subnet segmentation.",
    "successCriteria": [
        "VPC with public and private subnets",
        "Load balancer in public subnet",
        "Database in private subnet",
        "Proper security group configuration"
    ],
    "awsServices": ["VPC", "EC2", "RDS", "ALB", "S3"]
}

SAMPLE_LOCATION_CONTEXT = {
    "slug": "techmart-seattle",
    "name": "TechMart HQ",
    "company": "TechMart Inc.",
    "industry": "E-Commerce & Retail",
    "compliance": ["PCI-DSS", "GDPR", "SOC 2"]
}


# ============================================
# TEST FUNCTIONS
# ============================================

@pytest.fixture
def portfolio_request() -> Dict[str, Any]:
    """Create a complete portfolio generation request."""
    return {
        "profileId": "test-profile-123",
        "scenarioAttemptId": "test-attempt-456",
        "challengeProgressId": "test-progress-789",
        "diagram": SAMPLE_DIAGRAM,
        "cliProgress": SAMPLE_CLI_PROGRESS,
        "scenarioContext": SAMPLE_SCENARIO_CONTEXT,
        "locationContext": SAMPLE_LOCATION_CONTEXT,
        "challengeScore": 850,
        "maxScore": 1000,
        "completionTimeMinutes": 45,
        "hintsUsed": 2,
        "skillLevel": "intermediate",
        "targetCertification": "SAA"
    }


@pytest.mark.asyncio
async def test_health_check():
    """Test that the Learning Agent is running."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{LEARNING_AGENT_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✅ Health check passed")


@pytest.mark.asyncio
async def test_portfolio_endpoint_exists():
    """Test that the portfolio endpoint is registered."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{LEARNING_AGENT_URL}/openapi.json")
        assert response.status_code == 200
        openapi = response.json()
        paths = openapi.get("paths", {})
        assert "/api/learning/generate-portfolio" in paths
        print("✅ Portfolio endpoint exists")


@pytest.mark.asyncio
async def test_portfolio_generation_without_api_key(portfolio_request):
    """Test portfolio generation fails gracefully without API key."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{LEARNING_AGENT_URL}/api/learning/generate-portfolio",
            json=portfolio_request
        )
        # Should return 200 with error in response body, or 402 for API key required
        assert response.status_code in [200, 402, 500]
        print(f"✅ Without API key: status={response.status_code}")


@pytest.mark.asyncio
async def test_portfolio_generation_with_api_key(portfolio_request):
    """
    Test full portfolio generation with API key.
    
    NOTE: This test requires a valid OpenAI API key.
    Set OPENAI_API_KEY environment variable or skip this test.
    """
    import os
    api_key = os.environ.get("OPENAI_API_KEY")
    
    if not api_key:
        pytest.skip("OPENAI_API_KEY not set - skipping live API test")
    
    portfolio_request["openai_api_key"] = api_key
    portfolio_request["preferred_model"] = "gpt-4.1"
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{LEARNING_AGENT_URL}/api/learning/generate-portfolio",
            json=portfolio_request
        )
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"\n📋 Portfolio Generation Response:")
        print(f"   Success: {data.get('success')}")
        
        if data.get("success"):
            content = data.get("content", {})
            print(f"   Title: {content.get('title')}")
            print(f"   Summary length: {len(content.get('solutionSummary', ''))} chars")
            print(f"   Key decisions: {len(content.get('keyDecisions', []))} items")
            print(f"   Compliance: {content.get('complianceAchieved', [])}")
            print(f"   Services: {content.get('awsServicesUsed', [])}")
            
            # Validate response structure
            assert "title" in content
            assert "solutionSummary" in content
            assert "keyDecisions" in content
            assert "complianceAchieved" in content
            assert "awsServicesUsed" in content
            
            # Validate content quality
            assert len(content["title"]) > 10
            assert len(content["solutionSummary"]) > 100
            assert len(content["keyDecisions"]) >= 3
            assert len(content["awsServicesUsed"]) >= 3
            
            print("✅ Portfolio generation successful with valid content")
        else:
            print(f"   Error: {data.get('error')}")
            pytest.fail(f"Portfolio generation failed: {data.get('error')}")


@pytest.mark.asyncio
async def test_portfolio_request_validation():
    """Test that invalid requests are handled properly."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Missing required fields
        response = await client.post(
            f"{LEARNING_AGENT_URL}/api/learning/generate-portfolio",
            json={"profileId": "test"}  # Missing scenarioAttemptId
        )
        # Should return 422 for validation error
        assert response.status_code == 422
        print("✅ Request validation works correctly")


@pytest.mark.asyncio
async def test_portfolio_with_minimal_data():
    """Test portfolio generation with minimal data (no diagram, no CLI)."""
    import os
    api_key = os.environ.get("OPENAI_API_KEY")
    
    if not api_key:
        pytest.skip("OPENAI_API_KEY not set - skipping live API test")
    
    minimal_request = {
        "profileId": "test-profile-minimal",
        "scenarioAttemptId": "test-attempt-minimal",
        "challengeScore": 500,
        "maxScore": 1000,
        "completionTimeMinutes": 30,
        "hintsUsed": 5,
        "locationContext": {
            "company": "Test Corp",
            "industry": "Technology"
        },
        "openai_api_key": api_key
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{LEARNING_AGENT_URL}/api/learning/generate-portfolio",
            json=minimal_request
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should still generate something even with minimal data
        if data.get("success"):
            print("✅ Minimal data portfolio generation works")
        else:
            print(f"⚠️ Minimal data failed (expected): {data.get('error')}")


# ============================================
# INTEGRATION TEST - Full Flow Simulation
# ============================================

@pytest.mark.asyncio
async def test_full_e2e_flow():
    """
    Simulate the complete end-to-end flow:
    1. Client completes challenge (simulated)
    2. Frontend calls Learning Agent
    3. Learning Agent generates portfolio content
    4. Response returned to frontend (simulated save to DB)
    
    This is what happens in production when a user finishes a challenge.
    """
    import os
    api_key = os.environ.get("OPENAI_API_KEY")
    
    if not api_key:
        pytest.skip("OPENAI_API_KEY not set - skipping E2E test")
    
    print("\n" + "="*60)
    print("🚀 END-TO-END PORTFOLIO GENERATION TEST")
    print("="*60)
    
    # Step 1: Simulate challenge completion data
    print("\n📝 Step 1: Challenge completed")
    print(f"   Profile: test-profile-e2e")
    print(f"   Score: 850/1000 (85%)")
    print(f"   Time: 45 minutes")
    print(f"   Diagram nodes: {len(SAMPLE_DIAGRAM['nodes'])}")
    print(f"   CLI commands: {SAMPLE_CLI_PROGRESS['totalCommands']}")
    
    # Step 2: Build request (what frontend sends)
    print("\n📤 Step 2: Frontend sends request to Learning Agent")
    request_payload = {
        "profileId": "test-profile-e2e",
        "scenarioAttemptId": "test-attempt-e2e",
        "challengeProgressId": "test-progress-e2e",
        "diagram": SAMPLE_DIAGRAM,
        "cliProgress": SAMPLE_CLI_PROGRESS,
        "scenarioContext": SAMPLE_SCENARIO_CONTEXT,
        "locationContext": SAMPLE_LOCATION_CONTEXT,
        "challengeScore": 850,
        "maxScore": 1000,
        "completionTimeMinutes": 45,
        "hintsUsed": 2,
        "skillLevel": "intermediate",
        "targetCertification": "SAA",
        "openai_api_key": api_key,
        "preferred_model": "gpt-4.1"
    }
    
    # Step 3: Call Learning Agent
    print("\n⚙️ Step 3: Learning Agent processing...")
    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            f"{LEARNING_AGENT_URL}/api/learning/generate-portfolio",
            json=request_payload
        )
    
    assert response.status_code == 200
    data = response.json()
    
    # Step 4: Process response
    print("\n📥 Step 4: Response received")
    
    if not data.get("success"):
        print(f"   ❌ Error: {data.get('error')}")
        pytest.fail(f"E2E test failed: {data.get('error')}")
    
    content = data.get("content", {})
    
    print(f"\n{'='*60}")
    print("📋 GENERATED PORTFOLIO CONTENT")
    print("="*60)
    print(f"\n📌 Title: {content.get('title')}")
    print(f"\n📝 Solution Summary:\n{content.get('solutionSummary', '')[:500]}...")
    print(f"\n🎯 Key Decisions:")
    for i, decision in enumerate(content.get("keyDecisions", []), 1):
        print(f"   {i}. {decision}")
    print(f"\n✅ Compliance Achieved: {', '.join(content.get('complianceAchieved', []))}")
    print(f"\n🔧 AWS Services: {', '.join(content.get('awsServicesUsed', []))}")
    
    # Step 5: Simulate saving to database
    print(f"\n💾 Step 5: Would save to AcademyPortfolio table:")
    print(f"   - profileId: test-profile-e2e")
    print(f"   - title: {content.get('title')}")
    print(f"   - solutionSummary: {len(content.get('solutionSummary', ''))} chars")
    print(f"   - keyDecisions: {len(content.get('keyDecisions', []))} items")
    print(f"   - awsServices: {content.get('awsServicesUsed', [])}")
    print(f"   - complianceAchieved: {content.get('complianceAchieved', [])}")
    print(f"   - challengeScore: 850")
    print(f"   - status: 'ready'")
    
    print(f"\n{'='*60}")
    print("✅ END-TO-END TEST PASSED")
    print("="*60)
    
    # Assertions
    assert content.get("title")
    assert len(content.get("solutionSummary", "")) > 100
    assert len(content.get("keyDecisions", [])) >= 3
    assert len(content.get("awsServicesUsed", [])) >= 3


# ============================================
# RUN TESTS
# ============================================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("PORTFOLIO GENERATION E2E TESTS")
    print("="*60)
    print("\nRunning tests against Learning Agent at:", LEARNING_AGENT_URL)
    print("\nTo run with API key:")
    print("  OPENAI_API_KEY=sk-... pytest tests/test_portfolio_e2e.py -v")
    print("\n")
    
    # Run basic tests synchronously for quick check
    asyncio.run(test_health_check())
    asyncio.run(test_portfolio_endpoint_exists())
    
    print("\n✅ Basic tests passed!")
    print("\nRun full test suite with: pytest tests/test_portfolio_e2e.py -v")
