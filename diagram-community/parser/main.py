from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import sys
import os
import xml.etree.ElementTree as ET
from datetime import datetime
from io import BytesIO
import logging
import json
import re
import httpx
from typing import Dict, List, Set

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from shared.models import (
    DiagramStatus, AWSServiceCategory, ParsedService, 
    ParsedDiagram, HealthResponse, DiagramFormat
)
from shared.database import Diagram, get_session_maker, init_db
from shared.storage import MinioStorage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Diagram Parser Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

storage = MinioStorage()
SessionLocal = get_session_maker()

AWS_SERVICE_MAPPING = {
    "ec2": {"name": "EC2", "category": AWSServiceCategory.COMPUTE},
    "lambda": {"name": "Lambda", "category": AWSServiceCategory.SERVERLESS},
    "s3": {"name": "S3", "category": AWSServiceCategory.STORAGE},
    "rds": {"name": "RDS", "category": AWSServiceCategory.DATABASE},
    "dynamodb": {"name": "DynamoDB", "category": AWSServiceCategory.DATABASE},
    "vpc": {"name": "VPC", "category": AWSServiceCategory.NETWORKING},
    "elb": {"name": "ELB", "category": AWSServiceCategory.NETWORKING},
    "alb": {"name": "ALB", "category": AWSServiceCategory.NETWORKING},
    "cloudfront": {"name": "CloudFront", "category": AWSServiceCategory.NETWORKING},
    "route53": {"name": "Route 53", "category": AWSServiceCategory.NETWORKING},
    "iam": {"name": "IAM", "category": AWSServiceCategory.SECURITY},
    "cognito": {"name": "Cognito", "category": AWSServiceCategory.SECURITY},
    "kms": {"name": "KMS", "category": AWSServiceCategory.SECURITY},
    "cloudwatch": {"name": "CloudWatch", "category": AWSServiceCategory.MANAGEMENT},
    "sns": {"name": "SNS", "category": AWSServiceCategory.INTEGRATION},
    "sqs": {"name": "SQS", "category": AWSServiceCategory.INTEGRATION},
    "api gateway": {"name": "API Gateway", "category": AWSServiceCategory.INTEGRATION},
    "ecs": {"name": "ECS", "category": AWSServiceCategory.CONTAINERS},
    "eks": {"name": "EKS", "category": AWSServiceCategory.CONTAINERS},
    "fargate": {"name": "Fargate", "category": AWSServiceCategory.CONTAINERS},
    "sagemaker": {"name": "SageMaker", "category": AWSServiceCategory.ML_AI},
    "athena": {"name": "Athena", "category": AWSServiceCategory.ANALYTICS},
    "redshift": {"name": "Redshift", "category": AWSServiceCategory.ANALYTICS},
    "glue": {"name": "Glue", "category": AWSServiceCategory.ANALYTICS},
    "kinesis": {"name": "Kinesis", "category": AWSServiceCategory.ANALYTICS},
}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
async def startup_event():
    init_db()
    logger.info("Diagram Parser Service started")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service="diagram-parser",
        timestamp=datetime.utcnow()
    )


def extract_services_from_drawio(xml_content: bytes) -> Set[str]:
    services = set()
    try:
        root = ET.fromstring(xml_content)
        
        for cell in root.findall('.//*[@value]'):
            value = cell.get('value', '').lower()
            style = cell.get('style', '').lower()
            
            for service_key, service_info in AWS_SERVICE_MAPPING.items():
                if service_key in value or service_key in style:
                    services.add(service_info['name'])
        
        for cell in root.findall('.//*'):
            text = ''.join(cell.itertext()).lower()
            for service_key, service_info in AWS_SERVICE_MAPPING.items():
                if service_key in text:
                    services.add(service_info['name'])
    
    except ET.ParseError as e:
        logger.error(f"Error parsing Draw.io XML: {e}")
    
    return services


def extract_services_from_vsdx(vsdx_content: bytes) -> Set[str]:
    services = set()
    try:
        import zipfile
        with zipfile.ZipFile(BytesIO(vsdx_content)) as zf:
            for filename in zf.namelist():
                if filename.endswith('.xml'):
                    with zf.open(filename) as xml_file:
                        content = xml_file.read().decode('utf-8', errors='ignore').lower()
                        for service_key, service_info in AWS_SERVICE_MAPPING.items():
                            if service_key in content:
                                services.add(service_info['name'])
    except Exception as e:
        logger.error(f"Error parsing VSDX: {e}")
    
    return services


def categorize_services(services: Set[str]) -> Dict[str, List[str]]:
    categories = {}
    
    for service in services:
        for service_key, service_info in AWS_SERVICE_MAPPING.items():
            if service_info['name'] == service:
                category = service_info['category'].value
                if category not in categories:
                    categories[category] = []
                categories[category].append(service)
                break
    
    return categories


async def parse_diagram_task(diagram_id: str):
    db = SessionLocal()
    try:
        diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
        if not diagram:
            logger.error(f"Diagram {diagram_id} not found")
            return
        
        diagram.status = DiagramStatus.PROCESSING.value
        db.commit()
        
        file_extension = "xml" if diagram.format == DiagramFormat.DRAWIO_XML.value else "vsdx"
        object_name = f"diagrams/{diagram.user_id}/{diagram_id}.{file_extension}"
        
        file_content = storage.download_file(object_name)
        
        if diagram.format == DiagramFormat.DRAWIO_XML.value:
            services = extract_services_from_drawio(file_content)
        else:
            services = extract_services_from_vsdx(file_content)
        
        categories = categorize_services(services)
        
        diagram.services = list(services)
        diagram.categories = categories
        diagram.status = DiagramStatus.COMPLETED.value
        diagram.updated_at = datetime.utcnow()
        
        db.commit()
        logger.info(f"Successfully parsed diagram {diagram_id}: {len(services)} services found")
        
    except Exception as e:
        logger.error(f"Error parsing diagram {diagram_id}: {e}")
        diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
        if diagram:
            diagram.status = DiagramStatus.FAILED.value
            db.commit()
    finally:
        db.close()


@app.post("/parse/{diagram_id}")
async def parse_diagram(diagram_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    
    if diagram.status == DiagramStatus.PROCESSING.value:
        raise HTTPException(status_code=409, detail="Diagram is already being processed")
    
    background_tasks.add_task(parse_diagram_task, diagram_id)
    
    return {"message": "Diagram parsing started", "diagram_id": diagram_id}


@app.get("/parse/{diagram_id}/status")
async def get_parse_status(diagram_id: str, db: Session = Depends(get_db)):
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    
    return {
        "diagram_id": diagram_id,
        "status": diagram.status,
        "services": diagram.services,
        "categories": diagram.categories,
        "updated_at": diagram.updated_at
    }


@app.get("/services/mapping")
async def get_service_mapping():
    return {
        "services": AWS_SERVICE_MAPPING,
        "categories": [cat.value for cat in AWSServiceCategory]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
