from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import sys
import os
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime
from io import BytesIO
import logging

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from shared.models import DiagramFormat, DiagramStatus, DiagramMetadata, HealthResponse
from shared.database import Diagram, get_session_maker, init_db
from shared.storage import MinioStorage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Diagram Ingestion Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

storage = MinioStorage()
SessionLocal = get_session_maker()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
async def startup_event():
    init_db()
    logger.info("Diagram Ingestion Service started")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service="diagram-ingestion",
        timestamp=datetime.utcnow()
    )


def validate_drawio_xml(content: bytes) -> bool:
    try:
        root = ET.fromstring(content)
        if root.tag not in ['mxfile', 'mxGraphModel']:
            return False
        diagrams = root.findall('.//diagram') or root.findall('.//mxGraphModel')
        return len(diagrams) > 0
    except ET.ParseError:
        return False


def validate_vsdx(content: bytes) -> bool:
    try:
        import zipfile
        with zipfile.ZipFile(BytesIO(content)) as zf:
            return 'visio/document.xml' in zf.namelist() or 'document.xml' in zf.namelist()
    except:
        return False


@app.post("/upload", response_model=DiagramMetadata)
async def upload_diagram(
    title: str = Form(...),
    description: str = Form(None),
    tags: str = Form("[]"),
    format: str = Form(...),
    user_id: str = Form(...),
    username: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        diagram_format = DiagramFormat(format)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid format. Must be one of: {[f.value for f in DiagramFormat]}")
    
    max_size = int(os.getenv("MAX_FILE_SIZE_MB", "50")) * 1024 * 1024
    content = await file.read()
    
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail=f"File size exceeds {max_size / (1024*1024)}MB limit")
    
    if diagram_format == DiagramFormat.DRAWIO_XML:
        if not validate_drawio_xml(content):
            raise HTTPException(status_code=400, detail="Invalid Draw.io XML format")
    elif diagram_format == DiagramFormat.VSDX:
        if not validate_vsdx(content):
            raise HTTPException(status_code=400, detail="Invalid VSDX format")
    
    diagram_id = str(uuid.uuid4())
    file_extension = "xml" if diagram_format == DiagramFormat.DRAWIO_XML else "vsdx"
    object_name = f"diagrams/{user_id}/{diagram_id}.{file_extension}"
    
    content_type = "application/xml" if diagram_format == DiagramFormat.DRAWIO_XML else "application/vnd.visio"
    file_url = storage.upload_file(object_name, BytesIO(content), len(content), content_type)
    
    import json
    tags_list = json.loads(tags) if tags else []
    
    diagram = Diagram(
        id=diagram_id,
        title=title,
        description=description,
        format=diagram_format.value,
        status=DiagramStatus.PENDING.value,
        user_id=user_id,
        username=username,
        file_url=file_url,
        tags=tags_list,
        services=[],
        categories={},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(diagram)
    db.commit()
    db.refresh(diagram)
    
    logger.info(f"Uploaded diagram {diagram_id} for user {user_id}")
    
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


@app.get("/diagram/{diagram_id}", response_model=DiagramMetadata)
async def get_diagram(diagram_id: str, db: Session = Depends(get_db)):
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    
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


@app.delete("/diagram/{diagram_id}")
async def delete_diagram(diagram_id: str, user_id: str, db: Session = Depends(get_db)):
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    
    if diagram.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this diagram")
    
    file_extension = "xml" if diagram.format == DiagramFormat.DRAWIO_XML.value else "vsdx"
    object_name = f"diagrams/{user_id}/{diagram_id}.{file_extension}"
    storage.delete_file(object_name)
    
    db.delete(diagram)
    db.commit()
    
    logger.info(f"Deleted diagram {diagram_id}")
    return {"message": "Diagram deleted successfully"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
