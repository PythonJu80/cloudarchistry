# AWS Drawing Agent

A specialized AI agent focused exclusively on AWS architecture diagrams. This agent knows all 132 AWS services, 70 reference architectures, and AWS best practices inside and out.

## Features

### 🎯 Core Capabilities

1. **PowerPoint to React Flow Conversion**
   - Converts 70 AWS reference architecture PowerPoint files to interactive diagrams
   - Extracts shapes, positions, connections, and service identifications
   - Generates React Flow JSON format for web integration

2. **AWS Service Knowledge Base**
   - 132 AWS services from your system
   - Service metadata, categories, and relationships
   - Best practices for each service
   - Connection validation rules

3. **Architecture Validation**
   - Validates diagrams against AWS best practices
   - Identifies missing components (VPC, security groups, etc.)
   - Suggests improvements for high availability and security
   - Checks service compatibility

4. **Reference Architecture Library**
   - 70 AWS reference architectures as templates
   - Searchable by requirements
   - Ready-to-use diagram blueprints

5. **Diagram Generation** (Coming Soon)
   - Generate diagrams from text descriptions
   - LLM-powered architecture design
   - Automatic service selection and layout

## Architecture

```
AWS Drawing Agent
├── Knowledge Base
│   ├── 132 AWS Services (from your system)
│   ├── 70 Reference Architectures (PowerPoint files)
│   ├── Service Relationships
│   └── Best Practices
│
├── PPTX Converter
│   ├── Shape extraction
│   ├── Coordinate conversion (EMU → pixels)
│   ├── Service identification
│   └── React Flow JSON generation
│
├── Validator
│   ├── Best practice checks
│   ├── Connection validation
│   └── Security audits
│
└── Generator (Future)
    ├── Text → Diagram
    ├── LLM integration
    └── Auto-layout
```

## Usage

### Initialize the Agent

```python
from aws_drawing_agent import AWSDrawingAgent

agent = AWSDrawingAgent(
    architectures_dir="/path/to/aws_architecture_diagrams"
)
```

### Convert PowerPoint to React Flow

```python
# Convert a single architecture
diagram = agent.convert_architecture("path/to/architecture.pptx")

# Convert all 70 architectures
results = agent.convert_all_architectures(output_dir="./converted")
```

### Search and Get Service Info

```python
# Search for services
services = agent.search_services("lambda")

# Get detailed service info with best practices
service = agent.get_service_info("ec2")
print(service['best_practices'])
```

### List Reference Architectures

```python
# List all architectures
architectures = agent.list_architectures()

# Get specific architecture with diagram
arch = agent.get_architecture("knowledge-graphs-and-graphrag-with-neo4j")
diagram = arch['diagram']
```

### Validate Diagrams

```python
# Validate against best practices
validation = agent.validate_diagram(diagram)

if not validation['valid']:
    print("Warnings:", validation['warnings'])
    print("Suggestions:", validation['suggestions'])
```

### Get Agent Stats

```python
stats = agent.get_stats()
print(f"Services: {stats['services_loaded']}")
print(f"Architectures: {stats['architectures_loaded']}")
```

## Testing

Run the test script to see all capabilities:

```bash
cd /home/kingju/Documents/cloudmigrate-saas/learning_agent/scripts
python3 test_aws_drawing_agent.py
```

## Integration Points

### ArcHub (Community Diagrams)
- Users can import AWS reference architectures as starting points
- Export community diagrams to PowerPoint
- Validate shared diagrams

### Architect Arena (Game)
- Generate challenge architectures
- Validate player solutions
- Provide hints based on best practices

### Learning Centre
- Generate study diagrams
- Visualize AWS concepts
- Create certification prep materials

### Certification Tracker
- Generate exam-focused diagrams
- Practice architecture design
- Review reference patterns

## File Structure

```
aws_drawing_agent/
├── __init__.py           # Package initialization
├── agent.py              # Main agent orchestration
├── knowledge_base.py     # AWS services and architectures
├── pptx_converter.py     # PowerPoint to React Flow
├── diagram_generator.py  # Text to diagram (future)
├── validator.py          # Architecture validation (future)
└── README.md            # This file
```

## Data Sources

1. **AWS Services**: 132 services from `cloud-academy/src/lib/aws-services.ts`
2. **Reference Architectures**: 70 PowerPoint files in `aws_architecture_diagrams/`
3. **Documentation**: 968 chunks from AWS docs crawl
4. **Service Graph**: Neo4j relationships between services

## Future Enhancements

- [ ] LLM-based diagram generation from text
- [ ] Cost estimation for architectures
- [ ] Security audit with detailed reports
- [ ] Multi-cloud support (Azure, GCP)
- [ ] Real-time collaboration features
- [ ] Version control for diagrams
- [ ] Export to Terraform/CloudFormation
- [ ] Architecture diff and comparison
- [ ] Performance optimization suggestions
- [ ] Compliance checking (HIPAA, PCI-DSS, etc.)

## License

MIT
