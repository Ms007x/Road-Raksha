"""
Accident API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List
from geoalchemy2.functions import ST_GeogFromText, ST_AsGeoJSON, ST_Distance
from datetime import datetime
import json

from database import get_db
from models.database import Accident, Camera, Ambulance, Hospital
from models.schemas import AccidentCreate, AccidentUpdate, AccidentResponse
from websocket import ConnectionManager

router = APIRouter()
manager = ConnectionManager()


@router.get("/", response_model=List[AccidentResponse])
async def get_accidents(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    severity: str = None,
    db: Session = Depends(get_db)
):
    """Get all accidents"""
    query = db.query(Accident)
    
    if status:
        query = query.filter(Accident.status == status)
    if severity:
        query = query.filter(Accident.severity == severity)
        
    accidents = query.order_by(desc(Accident.detected_at)).offset(skip).limit(limit).all()
    
    result = []
    for accident in accidents:
        result.append({
            'id': accident.id,
            'camera_id': accident.camera_id,
            'location': json.loads(db.scalar(ST_AsGeoJSON(accident.location))),
            'detected_at': accident.detected_at,
            'severity': accident.severity,
            'confidence_score': accident.confidence_score,
            'status': accident.status,
            'ambulance_id': accident.ambulance_id,
            'hospital_id': accident.hospital_id,
            'response_time': accident.response_time,
            'resolution_time': accident.resolution_time,
            'description': accident.description,
            'metadata': accident.metadata,
            'created_at': accident.created_at,
            'updated_at': accident.updated_at
        })
        
    return result


@router.get("/{accident_id}", response_model=AccidentResponse)
async def get_accident(accident_id: int, db: Session = Depends(get_db)):
    """Get accident by ID"""
    accident = db.query(Accident).filter(Accident.id == accident_id).first()
    
    if not accident:
        raise HTTPException(status_code=404, detail="Accident not found")
        
    return {
        'id': accident.id,
        'camera_id': accident.camera_id,
        'location': json.loads(db.scalar(ST_AsGeoJSON(accident.location))),
        'detected_at': accident.detected_at,
        'severity': accident.severity,
        'confidence_score': accident.confidence_score,
        'status': accident.status,
        'ambulance_id': accident.ambulance_id,
        'hospital_id': accident.hospital_id,
        'response_time': accident.response_time,
        'resolution_time': accident.resolution_time,
        'description': accident.description,
        'metadata': accident.metadata,
        'created_at': accident.created_at,
        'updated_at': accident.updated_at
    }


@router.post("/report", response_model=AccidentResponse, status_code=status.HTTP_201_CREATED)
async def report_accident(
    accident: AccidentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Report new accident"""
    # Create location point
    location_wkt = f"POINT({accident.location.longitude} {accident.location.latitude})"
    
    db_accident = Accident(
        camera_id=accident.camera_id,
        location=ST_GeogFromText(location_wkt),
        detected_at=accident.detected_at or datetime.utcnow(),
        severity=accident.severity,
        confidence_score=accident.confidence_score,
        description=accident.description,
        metadata=accident.metadata
    )
    
    db.add(db_accident)
    db.commit()
    db.refresh(db_accident)
    
    # Notify via WebSocket
    background_tasks.add_task(
        manager.notify_accident,
        {
            'id': db_accident.id,
            'location': accident.location.model_dump(),
            'severity': accident.severity,
            'confidence_score': accident.confidence_score,
            'detected_at': db_accident.detected_at.isoformat()
        }
    )
    
    return {
        'id': db_accident.id,
        'camera_id': db_accident.camera_id,
        'location': accident.location.model_dump(),
        'detected_at': db_accident.detected_at,
        'severity': db_accident.severity,
        'confidence_score': db_accident.confidence_score,
        'status': db_accident.status,
        'ambulance_id': db_accident.ambulance_id,
        'hospital_id': db_accident.hospital_id,
        'response_time': db_accident.response_time,
        'resolution_time': db_accident.resolution_time,
        'description': db_accident.description,
        'metadata': db_accident.metadata,
        'created_at': db_accident.created_at,
        'updated_at': db_accident.updated_at
    }


@router.patch("/{accident_id}", response_model=AccidentResponse)
async def update_accident(
    accident_id: int,
    accident_update: AccidentUpdate,
    db: Session = Depends(get_db)
):
    """Update accident"""
    db_accident = db.query(Accident).filter(Accident.id == accident_id).first()
    
    if not db_accident:
        raise HTTPException(status_code=404, detail="Accident not found")
        
    update_data = accident_update.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(db_accident, key, value)
        
    db.commit()
    db.refresh(db_accident)
    
    return {
        'id': db_accident.id,
        'camera_id': db_accident.camera_id,
        'location': json.loads(db.scalar(ST_AsGeoJSON(db_accident.location))),
        'detected_at': db_accident.detected_at,
        'severity': db_accident.severity,
        'confidence_score': db_accident.confidence_score,
        'status': db_accident.status,
        'ambulance_id': db_accident.ambulance_id,
        'hospital_id': db_accident.hospital_id,
        'response_time': db_accident.response_time,
        'resolution_time': db_accident.resolution_time,
        'description': db_accident.description,
        'metadata': db_accident.metadata,
        'created_at': db_accident.created_at,
        'updated_at': db_accident.updated_at
    }
