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
from PIL import Image, ImageDraw, ImageFont
import re

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


def generate_thumbnail(content: bytes, diagram_format: DiagramFormat, title: str) -> BytesIO:
    """
    Generate a simple thumbnail preview for the diagram.
    For Draw.io XML, we extract service count and create a visual preview.
    """
    try:
        # Create a 400x300 thumbnail with a gradient background
        width, height = 400, 300
        img = Image.new('RGB', (width, height), color='#1e293b')
        draw = ImageDraw.Draw(img)
        
        # Draw gradient background
        for y in range(height):
            color_value = int(30 + (y / height) * 40)
            draw.rectangle([(0, y), (width, y+1)], fill=(color_value, color_value + 20, color_value + 40))
        
        # Extract service info from diagram
        service_count = 0
        services_text = ""
        
        if diagram_format == DiagramFormat.DRAWIO_XML:
            try:
                root = ET.fromstring(content)
                # Count AWS service nodes
                aws_patterns = ['mxgraph.aws4', 'aws4.', 'amazon', 'aws']
                cells = root.findall('.//*[@style]')
                
                found_services = set()
                for cell in cells:
                    style = cell.get('style', '').lower()
                    value = cell.get('value', '').lower()
                    
                    if any(pattern in style or pattern in value for pattern in aws_patterns):
                        # Extract service name
                        for word in (value + ' ' + style).split():
                            if len(word) > 2:
                                found_services.add(word[:15])
                
                service_count = len(found_services)
                services_text = f"{service_count} AWS Services"
            except:
                services_text = "AWS Architecture"
        else:
            services_text = "Architecture Diagram"
        
        # Draw diagram icon (simple representation)
        icon_size = 80
        icon_x = (width - icon_size) // 2
        icon_y = 60
        
        # Draw nodes representation
        node_positions = [
            (icon_x + 10, icon_y + 10),
            (icon_x + 50, icon_y + 10),
            (icon_x + 30, icon_y + 40),
            (icon_x + 10, icon_y + 60),
            (icon_x + 50, icon_y + 60),
        ]
        
        for x, y in node_positions:
            draw.ellipse([x, y, x+20, y+20], fill='#3b82f6', outline='#60a5fa', width=2)
        
        # Draw connections
        draw.line([icon_x + 20, icon_y + 20, icon_x + 40, icon_y + 50], fill='#94a3b8', width=2)
        draw.line([icon_x + 60, icon_y + 20, icon_x + 40, icon_y + 50], fill='#94a3b8', width=2)
        draw.line([icon_x + 20, icon_y + 70, icon_x + 40, icon_y + 50], fill='#94a3b8', width=2)
        draw.line([icon_x + 60, icon_y + 70, icon_x + 40, icon_y + 50], fill='#94a3b8', width=2)
        
        # Draw title (truncated if too long)
        title_text = title[:30] + "..." if len(title) > 30 else title
        try:
            # Try to use a nice font, fallback to default
            font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
            font_subtitle = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
        except:
            font_title = ImageFont.load_default()
            font_subtitle = ImageFont.load_default()
        
        # Draw title
        title_bbox = draw.textbbox((0, 0), title_text, font=font_title)
        title_width = title_bbox[2] - title_bbox[0]
        draw.text(((width - title_width) // 2, 170), title_text, fill='#f1f5f9', font=font_title)
        
        # Draw service count
        subtitle_bbox = draw.textbbox((0, 0), services_text, font=font_subtitle)
        subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
        draw.text(((width - subtitle_width) // 2, 200), services_text, fill='#94a3b8', font=font_subtitle)
        
        # Draw format badge
        format_text = "Draw.io" if diagram_format == DiagramFormat.DRAWIO_XML else "Visio"
        draw.rectangle([10, height - 30, 80, height - 10], fill='#3b82f6', outline='#60a5fa')
        format_bbox = draw.textbbox((0, 0), format_text, font=font_subtitle)
        format_width = format_bbox[2] - format_bbox[0]
        draw.text((45 - format_width // 2, height - 25), format_text, fill='#ffffff', font=font_subtitle)
        
        # Save to BytesIO
        thumbnail_io = BytesIO()
        img.save(thumbnail_io, format='PNG', optimize=True)
        thumbnail_io.seek(0)
        
        return thumbnail_io
        
    except Exception as e:
        logger.error(f"Error generating thumbnail: {e}")
        # Return a simple fallback thumbnail
        img = Image.new('RGB', (400, 300), color='#1e293b')
        draw = ImageDraw.Draw(img)
        draw.text((150, 140), "Diagram", fill='#94a3b8')
        thumbnail_io = BytesIO()
        img.save(thumbnail_io, format='PNG')
        thumbnail_io.seek(0)
        return thumbnail_io


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
    
    # Generate and upload thumbnail
    thumbnail_url = None
    try:
        thumbnail_io = generate_thumbnail(content, diagram_format, title)
        thumbnail_object_name = f"diagrams/{user_id}/{diagram_id}_thumb.png"
        thumbnail_url = storage.upload_file(thumbnail_object_name, thumbnail_io, thumbnail_io.getbuffer().nbytes, "image/png")
        logger.info(f"Generated thumbnail for diagram {diagram_id}")
    except Exception as e:
        logger.error(f"Failed to generate thumbnail for diagram {diagram_id}: {e}")
    
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
        thumbnail_url=thumbnail_url,
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
