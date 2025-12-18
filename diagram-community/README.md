# Architecture Diagram Community Platform

A GitHub-style community repository for AWS architecture diagrams that accepts standardized formats (XML from Draw.io and VSDX from Visio/Lucid).

## Architecture

The platform consists of three microservices:

### 1. Ingestion Service (Port 6095)
- Accepts XML/VSDX diagram uploads
- Validates file formats and schemas
- Stores files in MinIO object storage
- Creates metadata entries in PostgreSQL

**Endpoints:**
- `POST /upload` - Upload a new diagram
- `GET /diagram/{diagram_id}` - Get diagram metadata
- `DELETE /diagram/{diagram_id}` - Delete a diagram
- `GET /health` - Health check

### 2. Parser Service (Port 6096)
- Extracts AWS service nodes from diagrams
- Categorizes services into virtual file system structure
- Integrates with Neo4j knowledge graph
- Connects to learning-agent for AI analysis

**Endpoints:**
- `POST /parse/{diagram_id}` - Start parsing a diagram
- `GET /parse/{diagram_id}/status` - Get parsing status
- `GET /services/mapping` - Get AWS service mappings
- `GET /health` - Health check

### 3. API Gateway (Port 6097)
- REST API consumed by cloud-academy
- Search and browse diagrams
- Track views, remixes, and exports
- Trending and statistics

**Endpoints:**
- `GET /diagrams` - Search diagrams with filters
- `GET /diagrams/{diagram_id}` - Get specific diagram
- `POST /diagrams/{diagram_id}/remix` - Remix a diagram
- `POST /diagrams/{diagram_id}/export` - Export a diagram
- `GET /categories` - Get category statistics
- `GET /stats` - Platform statistics
- `GET /users/{user_id}/diagrams` - User's diagrams
- `GET /trending` - Trending diagrams
- `GET /health` - Health check

## Infrastructure

### Storage
- **MinIO** (Ports 6093-6094): Object storage for diagram files
- **PostgreSQL**: Metadata, user profiles, tags, votes
- **Redis**: Caching and job queues
- **Neo4j**: AWS service knowledge graph

### Shared Components
- `shared/models.py` - Pydantic models for all services
- `shared/database.py` - SQLAlchemy models and database utilities
- `shared/storage.py` - MinIO storage client

## Deployment

### Development
```bash
docker-compose --profile dev up
```

Services will run with hot-reload:
- diagram-ingestion-dev: http://localhost:6095
- diagram-parser-dev: http://localhost:6096
- diagram-api-dev: http://localhost:6097
- MinIO Console: http://localhost:6094

### Production
```bash
docker-compose --profile prod up
```

Services will run as built containers:
- diagram-ingestion: http://localhost:6095
- diagram-parser: http://localhost:6096
- diagram-api: http://localhost:6097

## Workflow

1. **Upload**: User uploads XML/VSDX via ingestion service
2. **Validate**: File format and schema validation
3. **Store**: File saved to MinIO, metadata to PostgreSQL
4. **Parse**: Parser extracts AWS services and categorizes them
5. **Browse**: Users browse via virtual file system (Compute, Networking, etc.)
6. **Interact**: View, remix, export diagrams

## GitHub-Style Terminology

- **Blueprint** (repo): Architecture diagram
- **Remix** (fork): Create variation of existing diagram
- **Export** (clone): Download to Draw.io/Visio
- **Categories** (directories): AWS service categories
- **Services** (files): Individual AWS services used

## Supported Formats

- **Draw.io XML** (.xml): Most common format
- **VSDX** (.vsdx): Microsoft Visio format

## AWS Service Categories

- Compute (EC2, Lambda)
- Storage (S3, EBS)
- Database (RDS, DynamoDB)
- Networking (VPC, CloudFront, Route 53)
- Security (IAM, Cognito, KMS)
- Analytics (Athena, Redshift, Kinesis)
- ML/AI (SageMaker)
- Containers (ECS, EKS, Fargate)
- Serverless (Lambda, API Gateway)
- Management (CloudWatch)
- Integration (SNS, SQS, API Gateway)

## Integration with Cloud Academy

The diagram-api service is consumed by cloud-academy via the `DIAGRAM_API_URL` environment variable. This enables:

- Browsing community diagrams
- Using diagrams as challenge templates
- AI-generated explanations and improvements
- Real-world architecture pattern learning

## Environment Variables

### Ingestion Service
- `DATABASE_URL`: PostgreSQL connection string
- `MINIO_ENDPOINT`: MinIO server endpoint
- `MINIO_ACCESS_KEY`: MinIO access key
- `MINIO_SECRET_KEY`: MinIO secret key
- `MINIO_BUCKET`: Bucket name for diagrams
- `REDIS_URL`: Redis connection string
- `MAX_FILE_SIZE_MB`: Maximum upload size (default: 50)

### Parser Service
- All ingestion variables plus:
- `NEO4J_URI`: Neo4j connection URI
- `NEO4J_USER`: Neo4j username
- `NEO4J_PASSWORD`: Neo4j password
- `LEARNING_AGENT_URL`: Learning agent service URL

### API Gateway
- All ingestion variables plus:
- `INGESTION_SERVICE_URL`: Ingestion service URL
- `PARSER_SERVICE_URL`: Parser service URL

## Future Enhancements

- Native Draw.io integration (export directly to platform)
- AI-powered diagram suggestions
- Collaborative editing
- Diagram versioning
- Comments and discussions
- Terraform export
- CloudFormation export
- Architecture scoring and best practices
