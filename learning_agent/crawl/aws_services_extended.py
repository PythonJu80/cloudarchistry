#!/usr/bin/env python3
"""
Extended AWS Services List - 50+ Additional Services
Beyond the core 51 services already crawled
"""

# Already crawled (51 services):
# Compute: Lambda, EC2, ECS, EKS, Batch
# Storage: S3, EFS, EBS, FSx
# Database: RDS, ElastiCache, Redshift, DocumentDB, Neptune, DynamoDB
# Networking: VPC, Route53, ELB, API Gateway, CloudFront, Direct Connect
# Security: IAM, Cognito, KMS, Secrets Manager, WAF, GuardDuty
# Monitoring: CloudWatch, CloudTrail, Systems Manager, Config, X-Ray
# Integration: SNS, SQS, EventBridge, Step Functions
# IaC: CloudFormation, CDK, SAM
# Analytics: Kinesis, Athena, Glue, EMR, QuickSight
# Containers: ECR, App Runner
# DevOps: CodeBuild, CodeDeploy, CodePipeline, CodeCommit

ADDITIONAL_AWS_SERVICES = [
    # AI/ML Services (10)
    "https://docs.aws.amazon.com/sagemaker/latest/dg/whatis.html",  # SageMaker
    "https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html",  # Bedrock
    "https://docs.aws.amazon.com/rekognition/latest/dg/what-is.html",  # Rekognition
    "https://docs.aws.amazon.com/comprehend/latest/dg/what-is.html",  # Comprehend
    "https://docs.aws.amazon.com/polly/latest/dg/what-is.html",  # Polly
    "https://docs.aws.amazon.com/transcribe/latest/dg/what-is.html",  # Transcribe
    "https://docs.aws.amazon.com/translate/latest/dg/what-is.html",  # Translate
    "https://docs.aws.amazon.com/lex/latest/dg/what-is.html",  # Lex
    "https://docs.aws.amazon.com/personalize/latest/dg/what-is-personalize.html",  # Personalize
    "https://docs.aws.amazon.com/forecast/latest/dg/what-is-forecast.html",  # Forecast
    
    # Additional Compute (5)
    "https://docs.aws.amazon.com/lightsail/latest/userguide/what-is-amazon-lightsail.html",  # Lightsail
    "https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/Welcome.html",  # Elastic Beanstalk
    "https://docs.aws.amazon.com/outposts/latest/userguide/what-is-outposts.html",  # Outposts
    "https://docs.aws.amazon.com/wavelength/latest/developerguide/what-is-wavelength.html",  # Wavelength
    "https://docs.aws.amazon.com/local-zones/latest/ug/what-is-aws-local-zones.html",  # Local Zones
    
    # Additional Database (6)
    "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DAX.html",  # DynamoDB DAX
    "https://docs.aws.amazon.com/memorydb/latest/devguide/what-is-memorydb-for-redis.html",  # MemoryDB
    "https://docs.aws.amazon.com/timestream/latest/developerguide/what-is-timestream.html",  # Timestream
    "https://docs.aws.amazon.com/keyspaces/latest/devguide/what-is-keyspaces.html",  # Keyspaces (Cassandra)
    "https://docs.aws.amazon.com/qldb/latest/developerguide/what-is.html",  # QLDB
    "https://docs.aws.amazon.com/neptune/latest/userguide/neptune-analytics-intro.html",  # Neptune Analytics
    
    # Additional Storage (4)
    "https://docs.aws.amazon.com/storagegateway/latest/userguide/WhatIsStorageGateway.html",  # Storage Gateway
    "https://docs.aws.amazon.com/aws-backup/latest/devguide/whatisbackup.html",  # AWS Backup
    "https://docs.aws.amazon.com/datasync/latest/userguide/what-is-datasync.html",  # DataSync
    "https://docs.aws.amazon.com/snowball/latest/developer-guide/whatissnowball.html",  # Snow Family
    
    # Additional Networking (5)
    "https://docs.aws.amazon.com/global-accelerator/latest/dg/what-is-global-accelerator.html",  # Global Accelerator
    "https://docs.aws.amazon.com/app-mesh/latest/userguide/what-is-app-mesh.html",  # App Mesh
    "https://docs.aws.amazon.com/cloud-map/latest/dg/what-is-cloud-map.html",  # Cloud Map
    "https://docs.aws.amazon.com/privateca/latest/userguide/PcaWelcome.html",  # Private CA
    "https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html",  # Site-to-Site VPN
    
    # Additional Security (6)
    "https://docs.aws.amazon.com/securityhub/latest/userguide/what-is-securityhub.html",  # Security Hub
    "https://docs.aws.amazon.com/inspector/latest/user/what-is-inspector.html",  # Inspector
    "https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html",  # Macie
    "https://docs.aws.amazon.com/detective/latest/adminguide/detective-investigation-about.html",  # Detective
    "https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html",  # Organizations
    "https://docs.aws.amazon.com/controltower/latest/userguide/what-is-control-tower.html",  # Control Tower
    
    # Additional Analytics (6)
    "https://docs.aws.amazon.com/opensearch-service/latest/developerguide/what-is.html",  # OpenSearch
    "https://docs.aws.amazon.com/msk/latest/developerguide/what-is-msk.html",  # MSK (Kafka)
    "https://docs.aws.amazon.com/redshift/latest/mgmt/serverless-whatis.html",  # Redshift Serverless
    "https://docs.aws.amazon.com/lake-formation/latest/dg/what-is-lake-formation.html",  # Lake Formation
    "https://docs.aws.amazon.com/databrew/latest/dg/what-is.html",  # DataBrew
    "https://docs.aws.amazon.com/datazone/latest/userguide/what-is-datazone.html",  # DataZone
    
    # Application Integration (4)
    "https://docs.aws.amazon.com/appsync/latest/devguide/what-is-appsync.html",  # AppSync
    "https://docs.aws.amazon.com/mq/latest/developer-guide/welcome.html",  # Amazon MQ
    "https://docs.aws.amazon.com/amazonswf/latest/developerguide/swf-welcome.html",  # SWF
    "https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes.html",  # EventBridge Pipes
    
    # Developer Tools (5)
    "https://docs.aws.amazon.com/cloud9/latest/user-guide/welcome.html",  # Cloud9
    "https://docs.aws.amazon.com/codestar/latest/userguide/welcome.html",  # CodeStar
    "https://docs.aws.amazon.com/codeguru/latest/reviewer-ug/welcome.html",  # CodeGuru
    "https://docs.aws.amazon.com/codeartifact/latest/ug/welcome.html",  # CodeArtifact
    "https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html",  # Amplify
    
    # Management & Governance (4)
    "https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html",  # Well-Architected Tool
    "https://docs.aws.amazon.com/servicecatalog/latest/adminguide/introduction.html",  # Service Catalog
    "https://docs.aws.amazon.com/license-manager/latest/userguide/license-manager.html",  # License Manager
    "https://docs.aws.amazon.com/cost-management/latest/userguide/what-is-costmanagement.html",  # Cost Explorer
    
    # Migration & Transfer (3)
    "https://docs.aws.amazon.com/dms/latest/userguide/Welcome.html",  # Database Migration Service
    "https://docs.aws.amazon.com/mgn/latest/ug/what-is-application-migration-service.html",  # Application Migration
    "https://docs.aws.amazon.com/transfer/latest/userguide/what-is-aws-transfer-family.html",  # Transfer Family
    
    # End User Computing (2)
    "https://docs.aws.amazon.com/workspaces/latest/adminguide/amazon-workspaces.html",  # WorkSpaces
    "https://docs.aws.amazon.com/appstream2/latest/developerguide/what-is-appstream.html",  # AppStream
]

# Service categories for organization
SERVICE_CATEGORIES = {
    "AI/ML": 10,
    "Compute": 5,
    "Database": 6,
    "Storage": 4,
    "Networking": 5,
    "Security": 6,
    "Analytics": 6,
    "Integration": 4,
    "Developer Tools": 5,
    "Management": 4,
    "Migration": 3,
    "End User Computing": 2
}

print(f"Total additional services: {len(ADDITIONAL_AWS_SERVICES)}")
print(f"\nBreakdown by category:")
for category, count in SERVICE_CATEGORIES.items():
    print(f"  {category}: {count} services")
