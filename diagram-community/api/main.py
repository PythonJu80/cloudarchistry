from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
import sys
import os
from datetime import datetime
from typing import Optional, List
import logging
import httpx

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from shared.models import (
    DiagramMetadata, DiagramSearchRequest, DiagramSearchResponse,
    HealthResponse, DiagramStatus, DiagramFormat, AWSServiceCategory
)
from shared.database import Diagram, get_session_maker, init_db
from shared.storage import MinioStorage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Diagram API Gateway", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

storage = MinioStorage()
SessionLocal = get_session_maker()

INGESTION_SERVICE_URL = os.getenv("INGESTION_SERVICE_URL", "http://diagram-ingestion:8000")
PARSER_SERVICE_URL = os.getenv("PARSER_SERVICE_URL", "http://diagram-parser:8001")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
async def startup_event():
    init_db()
    logger.info("Diagram API Gateway started")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service="diagram-api",
        timestamp=datetime.utcnow()
    )


@app.get("/diagrams", response_model=DiagramSearchResponse)
async def search_diagrams(
    query: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    service: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    query_filter = []
    
    if query:
        query_filter.append(
            or_(
                Diagram.title.ilike(f"%{query}%"),
                Diagram.description.ilike(f"%{query}%")
            )
        )
    
    if user_id:
        query_filter.append(Diagram.user_id == user_id)
    
    if status:
        query_filter.append(Diagram.status == status)
    
    if service:
        query_filter.append(Diagram.services.contains([service]))
    
    if tag:
        query_filter.append(Diagram.tags.contains([tag]))
    
    base_query = db.query(Diagram)
    if query_filter:
        base_query = base_query.filter(and_(*query_filter))
    
    total = base_query.count()
    
    diagrams = base_query.order_by(Diagram.created_at.desc()).offset(offset).limit(limit).all()
    
    diagram_list = [
        DiagramMetadata(
            id=d.id,
            title=d.title,
            description=d.description,
            format=DiagramFormat(d.format),
            status=DiagramStatus(d.status),
            user_id=d.user_id,
            username=d.username,
            file_url=d.file_url,
            thumbnail_url=d.thumbnail_url,
            tags=d.tags,
            services=d.services,
            categories=d.categories,
            created_at=d.created_at,
            updated_at=d.updated_at,
            views=d.views,
            remixes=d.remixes,
            exports=d.exports
        )
        for d in diagrams
    ]
    
    return DiagramSearchResponse(
        diagrams=diagram_list,
        total=total,
        limit=limit,
        offset=offset
    )


@app.get("/diagrams/{diagram_id}", response_model=DiagramMetadata)
async def get_diagram(diagram_id: str, db: Session = Depends(get_db)):
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    
    diagram.views += 1
    db.commit()
    
    return DiagramMetadata(
        id=diagram.id,
        title=diagram.title,
        description=diagram.description,
        format=DiagramFormat(diagram.format),
        status=DiagramStatus(diagram.status),
        user_id=diagram.user_id,
        username=diagram.username,
        file_url=diagram.file_url,
        thumbnail_url=diagram.thumbnail_url,
        tags=diagram.tags,
        services=diagram.services,
        categories=diagram.categories,
        created_at=diagram.created_at,
        updated_at=diagram.updated_at,
        views=diagram.views,
        remixes=diagram.remixes,
        exports=diagram.exports
    )


@app.post("/diagrams/{diagram_id}/remix")
async def remix_diagram(diagram_id: str, user_id: str, db: Session = Depends(get_db)):
    original = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Diagram not found")
    
    original.remixes += 1
    db.commit()
    
    return {"message": "Diagram remixed", "original_id": diagram_id, "remixes": original.remixes}


@app.post("/diagrams/{diagram_id}/export")
async def export_diagram(diagram_id: str, format: str, db: Session = Depends(get_db)):
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    
    diagram.exports += 1
    db.commit()
    
    return {
        "message": "Diagram exported",
        "diagram_id": diagram_id,
        "file_url": diagram.file_url,
        "format": format
    }


@app.get("/categories")
async def get_categories(db: Session = Depends(get_db)):
    diagrams = db.query(Diagram).filter(Diagram.status == DiagramStatus.COMPLETED.value).all()
    
    category_counts = {}
    service_counts = {}
    
    for diagram in diagrams:
        for category, services in diagram.categories.items():
            category_counts[category] = category_counts.get(category, 0) + 1
            for service in services:
                service_counts[service] = service_counts.get(service, 0) + 1
    
    return {
        "categories": category_counts,
        "services": service_counts,
        "total_diagrams": len(diagrams)
    }


@app.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    total_diagrams = db.query(Diagram).count()
    completed_diagrams = db.query(Diagram).filter(Diagram.status == DiagramStatus.COMPLETED.value).count()
    total_users = db.query(Diagram.user_id).distinct().count()
    total_views = db.query(Diagram).with_entities(Diagram.views).all()
    total_remixes = db.query(Diagram).with_entities(Diagram.remixes).all()
    
    return {
        "total_diagrams": total_diagrams,
        "completed_diagrams": completed_diagrams,
        "total_users": total_users,
        "total_views": sum([v[0] for v in total_views]),
        "total_remixes": sum([r[0] for r in total_remixes])
    }


@app.get("/users/{user_id}/diagrams", response_model=DiagramSearchResponse)
async def get_user_diagrams(
    user_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    total = db.query(Diagram).filter(Diagram.user_id == user_id).count()
    diagrams = db.query(Diagram).filter(Diagram.user_id == user_id).order_by(Diagram.created_at.desc()).offset(offset).limit(limit).all()
    
    diagram_list = [
        DiagramMetadata(
            id=d.id,
            title=d.title,
            description=d.description,
            format=DiagramFormat(d.format),
            status=DiagramStatus(d.status),
            user_id=d.user_id,
            username=d.username,
            file_url=d.file_url,
            thumbnail_url=d.thumbnail_url,
            tags=d.tags,
            services=d.services,
            categories=d.categories,
            created_at=d.created_at,
            updated_at=d.updated_at,
            views=d.views,
            remixes=d.remixes,
            exports=d.exports
        )
        for d in diagrams
    ]
    
    return DiagramSearchResponse(
        diagrams=diagram_list,
        total=total,
        limit=limit,
        offset=offset
    )


@app.get("/trending")
async def get_trending_diagrams(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    diagrams = db.query(Diagram).filter(
        Diagram.status == DiagramStatus.COMPLETED.value
    ).order_by(
        (Diagram.views + Diagram.remixes * 3).desc()
    ).limit(limit).all()
    
    return [
        DiagramMetadata(
            id=d.id,
            title=d.title,
            description=d.description,
            format=DiagramFormat(d.format),
            status=DiagramStatus(d.status),
            user_id=d.user_id,
            username=d.username,
            file_url=d.file_url,
            thumbnail_url=d.thumbnail_url,
            tags=d.tags,
            services=d.services,
            categories=d.categories,
            created_at=d.created_at,
            updated_at=d.updated_at,
            views=d.views,
            remixes=d.remixes,
            exports=d.exports
        )
        for d in diagrams
    ]


@app.get("/storage/{path:path}")
async def get_storage_file(path: str):
    """
    Proxy endpoint to fetch files from MinIO with proper authentication.
    This allows the frontend to access diagram files without exposing MinIO credentials.
    """
    try:
        file_data = storage.get_file(path)
        
        # Determine content type based on file extension
        content_type = "application/octet-stream"
        if path.endswith(".xml"):
            content_type = "application/xml"
        elif path.endswith(".vsdx"):
            content_type = "application/vnd.ms-visio.drawing"
        elif path.endswith(".png"):
            content_type = "image/png"
        elif path.endswith(".jpg") or path.endswith(".jpeg"):
            content_type = "image/jpeg"
        
        from fastapi.responses import Response
        return Response(
            content=file_data,
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=31536000",
            }
        )
    except Exception as e:
        logger.error(f"Error fetching storage file {path}: {e}")
        raise HTTPException(status_code=404, detail=f"File not found: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
