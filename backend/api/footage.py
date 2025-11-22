"""
Footage API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from pathlib import Path

from database import get_db
from models.database import Footage
from models.schemas import FootageCreate, FootageResponse

router = APIRouter()


@router.get("/", response_model=List[FootageResponse])
async def get_all_footage(
    skip: int = 0,
    limit: int = 100,
    accident_id: int = None,
    db: Session = Depends(get_db)
):
    """Get all footage"""
    query = db.query(Footage)
    
    if accident_id:
        query = query.filter(Footage.accident_id == accident_id)
        
    footage = query.offset(skip).limit(limit).all()
    return footage


@router.get("/{footage_id}", response_model=FootageResponse)
async def get_footage(footage_id: int, db: Session = Depends(get_db)):
    """Get footage by ID"""
    footage = db.query(Footage).filter(Footage.id == footage_id).first()
    
    if not footage:
        raise HTTPException(status_code=404, detail="Footage not found")
        
    return footage


@router.post("/", response_model=FootageResponse, status_code=status.HTTP_201_CREATED)
async def create_footage(footage: FootageCreate, db: Session = Depends(get_db)):
    """Create footage record"""
    db_footage = Footage(**footage.model_dump())
    
    db.add(db_footage)
    db.commit()
    db.refresh(db_footage)
    
    return db_footage


@router.get("/{footage_id}/download")
async def download_footage(footage_id: int, db: Session = Depends(get_db)):
    """Download footage file"""
    footage = db.query(Footage).filter(Footage.id == footage_id).first()
    
    if not footage:
        raise HTTPException(status_code=404, detail="Footage not found")
        
    file_path = Path(footage.file_path)
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Footage file not found")
        
    return FileResponse(
        path=str(file_path),
        media_type='video/mp4',
        filename=file_path.name
    )


@router.get("/{footage_id}/thumbnail")
async def get_thumbnail(footage_id: int, db: Session = Depends(get_db)):
    """Get footage thumbnail"""
    footage = db.query(Footage).filter(Footage.id == footage_id).first()
    
    if not footage or not footage.thumbnail_path:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
        
    thumbnail_path = Path(footage.thumbnail_path)
    
    if not thumbnail_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail file not found")
        
    return FileResponse(
        path=str(thumbnail_path),
        media_type='image/jpeg'
    )
