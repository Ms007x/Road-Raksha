"""
Camera API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from geoalchemy2.functions import ST_GeogFromText, ST_AsGeoJSON
import json

from database import get_db
from models.database import Camera
from models.schemas import CameraCreate, CameraUpdate, CameraResponse, LocationSchema

router = APIRouter()


@router.get("/", response_model=List[CameraResponse])
async def get_cameras(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    db: Session = Depends(get_db)
):
    """Get all cameras"""
    query = db.query(Camera)
    
    if status:
        query = query.filter(Camera.status == status)
        
    cameras = query.offset(skip).limit(limit).all()
    
    # Convert location to dict
    result = []
    for camera in cameras:
        camera_dict = {
            'id': camera.id,
            'name': camera.name,
            'rtsp_url': camera.rtsp_url,
            'location': json.loads(db.scalar(ST_AsGeoJSON(camera.location))),
            'address': camera.address,
            'status': camera.status,
            'fps': camera.fps,
            'resolution': camera.resolution,
            'created_at': camera.created_at,
            'last_seen': camera.last_seen,
            'metadata': camera.metadata
        }
        result.append(camera_dict)
        
    return result


@router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(camera_id: int, db: Session = Depends(get_db)):
    """Get camera by ID"""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
        
    return {
        'id': camera.id,
        'name': camera.name,
        'rtsp_url': camera.rtsp_url,
        'location': json.loads(db.scalar(ST_AsGeoJSON(camera.location))),
        'address': camera.address,
        'status': camera.status,
        'fps': camera.fps,
        'resolution': camera.resolution,
        'created_at': camera.created_at,
        'last_seen': camera.last_seen,
        'metadata': camera.metadata
    }


@router.post("/", response_model=CameraResponse, status_code=status.HTTP_201_CREATED)
async def create_camera(camera: CameraCreate, db: Session = Depends(get_db)):
    """Create new camera"""
    # Create location point
    location_wkt = f"POINT({camera.location.longitude} {camera.location.latitude})"
    
    db_camera = Camera(
        name=camera.name,
        rtsp_url=camera.rtsp_url,
        location=ST_GeogFromText(location_wkt),
        address=camera.address,
        fps=camera.fps,
        resolution=camera.resolution
    )
    
    db.add(db_camera)
    db.commit()
    db.refresh(db_camera)
    
    return {
        'id': db_camera.id,
        'name': db_camera.name,
        'rtsp_url': db_camera.rtsp_url,
        'location': camera.location,
        'address': db_camera.address,
        'status': db_camera.status,
        'fps': db_camera.fps,
        'resolution': db_camera.resolution,
        'created_at': db_camera.created_at,
        'last_seen': db_camera.last_seen,
        'metadata': db_camera.metadata
    }


@router.patch("/{camera_id}", response_model=CameraResponse)
async def update_camera(
    camera_id: int,
    camera_update: CameraUpdate,
    db: Session = Depends(get_db)
):
    """Update camera"""
    db_camera = db.query(Camera).filter(Camera.id == camera_id).first()
    
    if not db_camera:
        raise HTTPException(status_code=404, detail="Camera not found")
        
    update_data = camera_update.model_dump(exclude_unset=True)
    
    if 'location' in update_data:
        loc = update_data['location']
        location_wkt = f"POINT({loc['longitude']} {loc['latitude']})"
        db_camera.location = ST_GeogFromText(location_wkt)
        del update_data['location']
        
    for key, value in update_data.items():
        setattr(db_camera, key, value)
        
    db.commit()
    db.refresh(db_camera)
    
    return {
        'id': db_camera.id,
        'name': db_camera.name,
        'rtsp_url': db_camera.rtsp_url,
        'location': json.loads(db.scalar(ST_AsGeoJSON(db_camera.location))),
        'address': db_camera.address,
        'status': db_camera.status,
        'fps': db_camera.fps,
        'resolution': db_camera.resolution,
        'created_at': db_camera.created_at,
        'last_seen': db_camera.last_seen,
        'metadata': db_camera.metadata
    }


@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_camera(camera_id: int, db: Session = Depends(get_db)):
    """Delete camera"""
    db_camera = db.query(Camera).filter(Camera.id == camera_id).first()
    
    if not db_camera:
        raise HTTPException(status_code=404, detail="Camera not found")
        
    db.delete(db_camera)
    db.commit()
    
    return None
