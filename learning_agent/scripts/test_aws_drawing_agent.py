#!/usr/bin/env python3
"""
Test AWS Drawing Agent
======================
Demonstrates the capabilities of the AWS Drawing Agent.
"""

import sys
import os
import json

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from aws_drawing_agent import AWSDrawingAgent


def main():
    """Test the AWS Drawing Agent."""
    print("=" * 80)
    print("AWS DRAWING AGENT - TEST")
    print("=" * 80)
    print()
    
    # Initialize agent
    print("Initializing AWS Drawing Agent...")
    agent = AWSDrawingAgent(
        architectures_dir="/home/kingju/Documents/cloudmigrate-saas/aws_architecture_diagrams"
    )
    print()
    
    # Show stats
    print("Agent Statistics:")
    stats = agent.get_stats()
    print(f"  Services loaded: {stats['services_loaded']}")
    print(f"  Architectures loaded: {stats['architectures_loaded']}")
    print(f"  Categories:")
    for category, count in stats['categories'].items():
        print(f"    - {category}: {count}")
    print()
    
    # Test 1: Search for services
    print("-" * 80)
    print("TEST 1: Search for services")
    print("-" * 80)
    query = "lambda"
    results = agent.search_services(query)
    print(f"Search query: '{query}'")
    print(f"Found {len(results)} services:")
    for service in results[:5]:
        print(f"  - {service['id']}: {service['name']} ({service['category']})")
    print()
    
    # Test 2: Get service info with best practices
    print("-" * 80)
    print("TEST 2: Get service information")
    print("-" * 80)
    service_id = "ec2"
    service_info = agent.get_service_info(service_id)
    if service_info:
        print(f"Service: {service_info['name']}")
        print(f"Category: {service_info['category']}")
        print(f"Best Practices:")
        for practice in service_info.get('best_practices', []):
            print(f"  - {practice}")
    print()
    
    # Test 3: List reference architectures
    print("-" * 80)
    print("TEST 3: List reference architectures")
    print("-" * 80)
    architectures = agent.list_architectures()
    print(f"Found {len(architectures)} reference architectures:")
    for arch in architectures[:10]:
        print(f"  - {arch['name']}")
    print()
    
    # Test 4: Convert a single architecture
    print("-" * 80)
    print("TEST 4: Convert PowerPoint to React Flow")
    print("-" * 80)
    arch_id = "knowledge-graphs-and-graphrag-with-neo4j"
    arch = agent.get_architecture(arch_id)
    if arch:
        print(f"Architecture: {arch['name']}")
        diagram = arch.get('diagram', {})
        print(f"Nodes: {len(diagram.get('nodes', []))}")
        print(f"Edges: {len(diagram.get('edges', []))}")
        
        # Show first few nodes
        print("\nFirst 5 nodes:")
        for node in diagram.get('nodes', [])[:5]:
            label = node.get('data', {}).get('label', 'No label')
            service_id = node.get('data', {}).get('service_id', 'Unknown')
            print(f"  - {node['id']}: {label[:50]} (service: {service_id})")
    print()
    
    # Test 5: Validate a diagram
    print("-" * 80)
    print("TEST 5: Validate diagram")
    print("-" * 80)
    test_diagram = {
        "nodes": [
            {"id": "1", "data": {"service_id": "ec2"}},
            {"id": "2", "data": {"service_id": "rds"}},
            {"id": "3", "data": {"service_id": "lambda"}},
        ],
        "edges": [
            {"id": "e1", "source": "1", "target": "2"},
            {"id": "e2", "source": "3", "target": "2"},
        ]
    }
    validation = agent.validate_diagram(test_diagram)
    print(f"Valid: {validation['valid']}")
    if validation['warnings']:
        print("Warnings:")
        for warning in validation['warnings']:
            print(f"  - {warning}")
    if validation['suggestions']:
        print("Suggestions:")
        for suggestion in validation['suggestions']:
            print(f"  - {suggestion}")
    print()
    
    # Test 6: Convert all architectures (optional - takes time)
    print("-" * 80)
    print("TEST 6: Convert all architectures (optional)")
    print("-" * 80)
    response = input("Convert all 70 architectures? This will take a few minutes. (y/n): ")
    if response.lower() == 'y':
        print("Converting all architectures...")
        results = agent.convert_all_architectures()
        print(f"Converted {len(results)} architectures")
        
        # Show summary
        total_nodes = sum(r['nodes'] for r in results)
        total_edges = sum(r['edges'] for r in results)
        print(f"Total nodes: {total_nodes}")
        print(f"Total edges: {total_edges}")
        print(f"Average nodes per diagram: {total_nodes / len(results):.1f}")
        
        # Show first few results
        print("\nFirst 5 conversions:")
        for result in results[:5]:
            print(f"  - {result['file']}: {result['nodes']} nodes, {result['edges']} edges")
    else:
        print("Skipped bulk conversion")
    print()
    
    print("=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    main()
