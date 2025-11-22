"""
Analytics API endpoints
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List
from datetime import datetime, timedelta

from database import get_db
from models.database import Accident, Camera, SystemMetric
from models.schemas import AccidentStatistics, CameraPerformance

router = APIRouter()


@router.get("/accident-statistics", response_model=List[AccidentStatistics])
async def get_accident_statistics(
    days: int = 30,
    db: Session = Depends(get_db)
):
    """Get accident statistics for the last N days"""
    start_date = datetime.utcnow() - timedelta(days=days)
    
    stats = db.query(
        func.date(Accident.detected_at).label('date'),
        func.count(Accident.id).label('total_accidents'),
        func.count(func.nullif(Accident.severity == 'critical', False)).label('critical_count'),
        func.count(func.nullif(Accident.severity == 'high', False)).label('high_count'),
        func.count(func.nullif(Accident.severity == 'medium', False)).label('medium_count'),
        func.count(func.nullif(Accident.severity == 'low', False)).label('low_count'),
        func.avg(Accident.response_time).label('avg_response_time'),
        func.avg(Accident.resolution_time).label('avg_resolution_time')
    ).filter(
        Accident.detected_at >= start_date,
        Accident.status != 'false_positive'
    ).group_by(
        func.date(Accident.detected_at)
    ).order_by(
        desc('date')
    ).all()
    
    return [
        {
            'date': stat.date,
            'total_accidents': stat.total_accidents,
            'critical_count': stat.critical_count or 0,
            'high_count': stat.high_count or 0,
            'medium_count': stat.medium_count or 0,
            'low_count': stat.low_count or 0,
            'avg_response_time': stat.avg_response_time,
            'avg_resolution_time': stat.avg_resolution_time
        }
        for stat in stats
    ]


@router.get("/camera-performance", response_model=List[CameraPerformance])
async def get_camera_performance(
    hours: int = 24,
    db: Session = Depends(get_db)
):
    """Get camera performance metrics"""
    start_time = datetime.utcnow() - timedelta(hours=hours)
    
    # Get camera stats
    camera_stats = db.query(
        Camera.id,
        Camera.name,
        Camera.status,
        func.count(Accident.id).label('total_detections')
    ).outerjoin(
        Accident, Camera.id == Accident.camera_id
    ).group_by(
        Camera.id, Camera.name, Camera.status
    ).all()
    
    result = []
    for cam_stat in camera_stats:
        # Get metrics for this camera
        metrics = db.query(
            func.avg(SystemMetric.fps).label('avg_fps'),
            func.avg(SystemMetric.inference_time_ms).label('avg_inference_time'),
            func.avg(SystemMetric.cpu_usage).label('avg_cpu_usage'),
            func.avg(SystemMetric.gpu_usage).label('avg_gpu_usage')
        ).filter(
            SystemMetric.camera_id == cam_stat.id,
            SystemMetric.timestamp >= start_time
        ).first()
        
        result.append({
            'id': cam_stat.id,
            'name': cam_stat.name,
            'status': cam_stat.status,
            'total_detections': cam_stat.total_detections,
            'avg_fps': metrics.avg_fps if metrics else None,
            'avg_inference_time': metrics.avg_inference_time if metrics else None,
            'avg_cpu_usage': metrics.avg_cpu_usage if metrics else None,
            'avg_gpu_usage': metrics.avg_gpu_usage if metrics else None
        })
        
    return result


@router.get("/summary")
async def get_summary_statistics(db: Session = Depends(get_db)):
    """Get overall summary statistics"""
    # Count totals
    total_cameras = db.query(func.count(Camera.id)).filter(Camera.status == 'active').scalar()
    total_accidents_today = db.query(func.count(Accident.id)).filter(
        func.date(Accident.detected_at) == datetime.utcnow().date()
    ).scalar()
    
    # Active incidents
    active_incidents = db.query(func.count(Accident.id)).filter(
        Accident.status.in_(['detected', 'dispatched'])
    ).scalar()
    
    # Average response time (last 24 hours)
    avg_response = db.query(func.avg(Accident.response_time)).filter(
        Accident.detected_at >= datetime.utcnow() - timedelta(hours=24),
        Accident.response_time.isnot(None)
    ).scalar()
    
    return {
        'active_cameras': total_cameras,
        'accidents_today': total_accidents_today,
        'active_incidents': active_incidents,
        'avg_response_time_seconds': avg_response
    }
