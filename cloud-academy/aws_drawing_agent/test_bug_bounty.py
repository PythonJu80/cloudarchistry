"""
Test Bug Bounty Generator
=========================
Test script to verify Bug Bounty challenge generation and validation.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from bug_bounty_generator import BugBountyGenerator
import json


def test_challenge_generation():
    """Test challenge generation."""
    print("=" * 60)
    print("Testing Bug Bounty Challenge Generation")
    print("=" * 60)
    
    generator = BugBountyGenerator()
    
    # Generate challenge
    print("\n1. Generating intermediate difficulty challenge...")
    challenge = generator.generate_challenge(
        difficulty="intermediate",
        certification_code="SAA",
        scenario_type="ecommerce"
    )
    
    print(f"✓ Challenge ID: {challenge.challenge_id}")
    print(f"✓ Difficulty: {challenge.difficulty}")
    print(f"✓ Bounty Value: ${challenge.bounty_value}")
    print(f"✓ Time Limit: {challenge.time_limit}s")
    print(f"✓ Bug Count: {len(challenge.hidden_bugs)}")
    
    # Check diagram
    print(f"\n2. Diagram:")
    print(f"   - Nodes: {len(challenge.diagram['nodes'])}")
    print(f"   - Edges: {len(challenge.diagram['edges'])}")
    
    # Check description
    print(f"\n3. Description:")
    print(f"   {challenge.description[:100]}...")
    
    # Check AWS environment
    print(f"\n4. AWS Environment:")
    print(f"   - CloudWatch Logs: {len(challenge.aws_environment.cloudwatch_logs)}")
    print(f"   - Metrics: {len(challenge.aws_environment.cloudwatch_metrics)}")
    print(f"   - VPC Flow Logs: {len(challenge.aws_environment.vpc_flow_logs)}")
    print(f"   - IAM Policies: {len(challenge.aws_environment.iam_policies)}")
    print(f"   - X-Ray Traces: {len(challenge.aws_environment.xray_traces)}")
    print(f"   - Config Rules: {len(challenge.aws_environment.config_compliance)}")
    
    # Check bugs
    print(f"\n5. Hidden Bugs:")
    for bug in challenge.hidden_bugs:
        print(f"   - {bug.id}: {bug.type} ({bug.severity}) - {bug.description}")
    
    return challenge


def test_claim_validation(challenge):
    """Test claim validation."""
    print("\n" + "=" * 60)
    print("Testing Bug Claim Validation")
    print("=" * 60)
    
    generator = BugBountyGenerator()
    
    # Test correct claim
    print("\n1. Testing CORRECT claim (RDS bug)...")
    correct_claim = {
        "target_id": "node_rds_1",
        "bug_type": "security",
        "severity": "critical",
        "claim": "RDS instance is publicly accessible without encryption",
        "evidence": ["cloudwatch_log_2", "config_rule_1"],
        "confidence": 90,
    }
    
    result = generator.validate_claim(challenge, correct_claim)
    print(f"   Result: {'✓ CORRECT' if result['correct'] else '✗ INCORRECT'}")
    print(f"   Points: {result['points']}")
    if result.get('explanation'):
        print(f"   Explanation: {result['explanation']}")
    
    # Test incorrect claim
    print("\n2. Testing INCORRECT claim (false positive)...")
    incorrect_claim = {
        "target_id": "node_s3_1",
        "bug_type": "security",
        "severity": "high",
        "claim": "S3 bucket is publicly accessible",
        "evidence": [],
        "confidence": 60,
    }
    
    result = generator.validate_claim(challenge, incorrect_claim)
    print(f"   Result: {'✓ CORRECT' if result['correct'] else '✗ INCORRECT'}")
    print(f"   Points: {result['points']}")
    if result.get('pushback'):
        print(f"   Pushback: {result['pushback']}")
    
    # Test another correct claim
    print("\n3. Testing CORRECT claim (IAM bug)...")
    iam_claim = {
        "target_id": "iam_policy",
        "bug_type": "security",
        "severity": "high",
        "claim": "IAM role has overly permissive wildcard permissions",
        "evidence": ["iam_policy_1"],
        "confidence": 85,
    }
    
    result = generator.validate_claim(challenge, iam_claim)
    print(f"   Result: {'✓ CORRECT' if result['correct'] else '✗ INCORRECT'}")
    print(f"   Points: {result['points']}")
    if result.get('explanation'):
        print(f"   Explanation: {result['explanation']}")


def test_json_serialization(challenge):
    """Test that challenge can be serialized to JSON."""
    print("\n" + "=" * 60)
    print("Testing JSON Serialization")
    print("=" * 60)
    
    try:
        # Convert to dict (without hidden bugs for client)
        client_data = {
            "challenge_id": challenge.challenge_id,
            "diagram": challenge.diagram,
            "description": challenge.description,
            "aws_environment": {
                "cloudwatch_logs": [log.dict() for log in challenge.aws_environment.cloudwatch_logs],
                "cloudwatch_metrics": {k: v.dict() for k, v in challenge.aws_environment.cloudwatch_metrics.items()},
                "vpc_flow_logs": challenge.aws_environment.vpc_flow_logs,
                "iam_policies": challenge.aws_environment.iam_policies,
                "cost_data": challenge.aws_environment.cost_data,
                "xray_traces": [trace.dict() for trace in challenge.aws_environment.xray_traces],
                "config_compliance": [rule.dict() for rule in challenge.aws_environment.config_compliance],
            },
            "difficulty": challenge.difficulty,
            "bounty_value": challenge.bounty_value,
            "time_limit": challenge.time_limit,
            "bug_count": len(challenge.hidden_bugs),
        }
        
        json_str = json.dumps(client_data, indent=2)
        print(f"✓ Successfully serialized to JSON ({len(json_str)} bytes)")
        print(f"✓ Sample CloudWatch log:")
        print(f"   {json.dumps(client_data['aws_environment']['cloudwatch_logs'][0], indent=4)}")
        
    except Exception as e:
        print(f"✗ Serialization failed: {e}")


def main():
    """Run all tests."""
    print("\n🐛 Bug Bounty Generator Test Suite\n")
    
    try:
        # Test 1: Generate challenge
        challenge = test_challenge_generation()
        
        # Test 2: Validate claims
        test_claim_validation(challenge)
        
        # Test 3: JSON serialization
        test_json_serialization(challenge)
        
        print("\n" + "=" * 60)
        print("✓ All tests passed!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
