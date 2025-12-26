# ArcHub - Architecture Diagram Community

ArcHub is a GitHub-style community platform for AWS architecture diagrams, integrated as a "site within a page" in Cloud Academy.

## Overview

ArcHub allows users to:
- Upload Draw.io XML and VSDX architecture diagrams
- Browse diagrams via virtual file system navigation (by AWS service categories)
- Remix and export community diagrams
- Build their ArcHub profile linked to their AcademyUserProfile

## Architecture

### Database Models

**ArcHubProfile** - Extends AcademyUserProfile
- Links to AcademyUserProfile via `profileId`
- Separate username, bio, avatar for ArcHub identity
- Social links (GitHub, LinkedIn, website)
- Stats: diagrams uploaded, views, remixes, exports, reputation
- Preferences: default visibility, allow remixes, allow comments

**ArcHubDiagram** - Community diagrams
- Owned by ArcHubProfile
- Metadata: title, description, format (drawio_xml/vsdx)
- Storage: file URL, thumbnail URL
- Categorization: tags, detected AWS services, categories
- Stats: views, remixes, exports
- Remix tracking

### Backend Services

Three microservices in `diagram-community/`:

1. **Ingestion Service** (Port 6095)
   - Validates XML/VSDX uploads
   - Stores files in MinIO
   - Creates metadata in PostgreSQL

2. **Parser Service** (Port 6096)
   - Extracts AWS services from diagrams
   - Categorizes into virtual file system
   - Integrates with Neo4j knowledge graph

3. **API Gateway** (Port 6097)
   - REST API for cloud-academy
   - Search, browse, stats endpoints
   - Tracks views, remixes, exports

### Frontend Pages

All pages in `src/app/archub/`:

- `/archub` - Main page with virtual file system navigation
- `/archub/upload` - Upload new blueprint
- `/archub/blueprint/[id]` - Blueprint detail view
- `/archub/profile` - User's ArcHub profile settings

### API Routes

All routes in `src/app/api/archub/`:

- `GET/PUT /api/archub/profile` - Get/update ArcHub profile
- `GET/POST /api/archub/diagrams` - List/upload diagrams
- `GET/DELETE /api/archub/diagrams/[id]` - Get/delete specific diagram
- `GET /api/archub/stats` - Platform statistics

## GitHub-Style Terminology

- **Blueprint** (repo) - Architecture diagram
- **Remix** (fork) - Create variation of existing diagram
- **Export** (clone) - Download to Draw.io/Visio
- **Categories** (directories) - AWS service categories
- **Services** (files) - Individual AWS services

## Virtual File System

Diagrams are organized by AWS service categories:

- 💻 Compute (EC2, Lambda)
- 💾 Storage (S3, EBS)
- 🗄️ Database (RDS, DynamoDB)
- 🌐 Networking (VPC, CloudFront, Route 53)
- 🔒 Security (IAM, Cognito, KMS)
- 📊 Analytics (Athena, Redshift, Kinesis)
- 🤖 ML & AI (SageMaker)
- 📦 Containers (ECS, EKS, Fargate)
- ⚡ Serverless (Lambda, API Gateway)
- 🔗 Integration (SNS, SQS, API Gateway)
- ⚙️ Management (CloudWatch)

## Workflow

1. User uploads XML/VSDX via `/archub/upload`
2. File validated and stored in MinIO
3. Metadata saved to PostgreSQL (ArcHubDiagram)
4. Parser extracts AWS services asynchronously
5. Services categorized into virtual file system
6. Users browse via category navigation
7. Users can view, remix, export diagrams

## Integration with Cloud Academy

- ArcHub profile extends AcademyUserProfile
- Shared authentication via NextAuth
- Stats contribute to overall gamification
- Potential to use diagrams as challenge templates
- AI analysis via learning-agent integration

## Setup

1. Update Prisma schema:
```bash
cd cloud-academy
npx prisma generate
npx prisma db push
```

2. Start diagram services:
```bash
# Development
docker-compose --profile dev up

# Production
docker-compose --profile prod up
```

3. Access ArcHub:
- Main page: http://localhost:6060/archub
- Upload: http://localhost:6060/archub/upload
- Profile: http://localhost:6060/archub/profile

## Environment Variables

Cloud Academy needs:
```
DIAGRAM_API_URL=http://diagram-api:8002  # Production
DIAGRAM_API_URL=http://diagram-api-dev:8002  # Development
```

## Supported Formats

- **Draw.io XML** (.xml) - Most common format
- **VSDX** (.vsdx) - Microsoft Visio format

## Future Enhancements

- Native Draw.io integration
- AI-powered diagram suggestions
- Collaborative editing
- Diagram versioning
- Comments and discussions
- Terraform/CloudFormation export
- Architecture scoring and best practices
- Integration with challenge system
