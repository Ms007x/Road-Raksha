"""
Emergency services API endpoints (ambulance and hospital lookup)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from geoalchemy2.functions import ST_GeogFromText, ST_AsGeoJSON, ST_Distance
import json

from database import get_db
from models.database import Ambulance, Hospital
from models.schemas import (
    NearestResourceRequest,
    NearestAmbulanceResponse,
    NearestHospitalResponse,
    AmbulanceResponse,
    HospitalResponse
)

router = APIRouter()


@router.post("/nearest-ambulance", response_model=List[NearestAmbulanceResponse])
async def find_nearest_ambulance(
    request: NearestResourceRequest,
    db: Session = Depends(get_db)
):
    """Find nearest available ambulances"""
    location_wkt = f"POINT({request.location.longitude} {request.location.latitude})"
    location_point = ST_GeogFromText(location_wkt)
    
    # Query available ambulances ordered by distance
    ambulances = db.query(
        Ambulance,
        ST_Distance(Ambulance.current_location, location_point).label('distance')
    ).filter(
        Ambulance.status == 'available',
        Ambulance.current_location.isnot(None)
    ).order_by(
        'distance'
    ).limit(request.limit).all()
    
    result = []
    for ambulance, distance in ambulances:
        # Calculate ETA (assuming 40 km/h average speed)
        eta_seconds = int((distance / 1000) / 40 * 3600)
        
        result.append({
            'ambulance': {
                'id': ambulance.id,
                'vehicle_number': ambulance.vehicle_number,
                'current_location': json.loads(db.scalar(ST_AsGeoJSON(ambulance.current_location))),
                'status': ambulance.status,
                'driver_name': ambulance.driver_name,
                'driver_phone': ambulance.driver_phone,
                'hospital_id': ambulance.hospital_id,
                'equipment_level': ambulance.equipment_level,
                'created_at': ambulance.created_at,
                'last_updated': ambulance.last_updated
            },
            'distance_meters': distance,
            'eta_seconds': eta_seconds
        })
        
    return result


@router.post("/nearest-hospital", response_model=List[NearestHospitalResponse])
async def find_nearest_hospital(
    request: NearestResourceRequest,
    db: Session = Depends(get_db)
):
    """Find nearest hospitals with available beds"""
    location_wkt = f"POINT({request.location.longitude} {request.location.latitude})"
    location_point = ST_GeogFromText(location_wkt)
    
    # Query hospitals ordered by distance
    hospitals = db.query(
        Hospital,
        ST_Distance(Hospital.location, location_point).label('distance')
    ).filter(
        Hospital.is_active == True,
        Hospital.available_beds > 0
    ).order_by(
        'distance'
    ).limit(request.limit).all()
    
    result = []
    for hospital, distance in hospitals:
        # Calculate ETA (assuming 40 km/h average speed)
        eta_seconds = int((distance / 1000) / 40 * 3600)
        
        result.append({
            'hospital': {
                'id': hospital.id,
                'name': hospital.name,
                'location': json.loads(db.scalar(ST_AsGeoJSON(hospital.location))),
                'address': hospital.address,
                'phone': hospital.phone,
                'email': hospital.email,
                'capacity': hospital.capacity,
                'available_beds': hospital.available_beds,
                'emergency_contact': hospital.emergency_contact,
                'specializations': hospital.specializations,
                'is_active': hospital.is_active,
                'created_at': hospital.created_at
            },
            'distance_meters': distance,
            'eta_seconds': eta_seconds
        })
        
    return result
