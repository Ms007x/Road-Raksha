"""
Database models using SQLAlchemy with PostGIS support
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ARRAY, JSON, ForeignKey, CheckConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geography
from datetime import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)
    is_active = Column(Boolean, default=True)
    
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'control_center', 'hospital', 'ambulance')"),
    )


class Camera(Base):
    __tablename__ = "cameras"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    rtsp_url = Column(Text, nullable=False)
    location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    address = Column(Text)
    status = Column(String(50), default='active')
    fps = Column(Integer, default=30)
    resolution = Column(String(20), default='720p')
    created_at = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime)
    metadata = Column(JSON)
    
    # Relationships
    accidents = relationship("Accident", back_populates="camera")
    footage = relationship("Footage", back_populates="camera")
    metrics = relationship("SystemMetric", back_populates="camera")
    
    __table_args__ = (
        CheckConstraint("status IN ('active', 'inactive', 'maintenance')"),
    )


class Hospital(Base):
    __tablename__ = "hospitals"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    address = Column(Text, nullable=False)
    phone = Column(String(20))
    email = Column(String(255))
    capacity = Column(Integer, default=0)
    available_beds = Column(Integer, default=0)
    emergency_contact = Column(String(20))
    specializations = Column(ARRAY(Text))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    metadata = Column(JSON)
    
    # Relationships
    ambulances = relationship("Ambulance", back_populates="hospital")
    accidents = relationship("Accident", back_populates="hospital")


class Ambulance(Base):
    __tablename__ = "ambulances"
    
    id = Column(Integer, primary_key=True, index=True)
    vehicle_number = Column(String(50), unique=True, nullable=False)
    current_location = Column(Geography(geometry_type='POINT', srid=4326))
    status = Column(String(50), default='available', index=True)
    driver_name = Column(String(255))
    driver_phone = Column(String(20))
    hospital_id = Column(Integer, ForeignKey('hospitals.id'))
    equipment_level = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    metadata = Column(JSON)
    
    # Relationships
    hospital = relationship("Hospital", back_populates="ambulances")
    accidents = relationship("Accident", back_populates="ambulance")
    
    __table_args__ = (
        CheckConstraint("status IN ('available', 'dispatched', 'busy', 'offline')"),
        CheckConstraint("equipment_level IN ('basic', 'advanced', 'critical')"),
    )


class Accident(Base):
    __tablename__ = "accidents"
    
    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey('cameras.id', ondelete='SET NULL'))
    location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    detected_at = Column(DateTime, default=datetime.utcnow, index=True)
    severity = Column(String(50))
    confidence_score = Column(Float)
    status = Column(String(50), default='detected', index=True)
    ambulance_id = Column(Integer, ForeignKey('ambulances.id'))
    hospital_id = Column(Integer, ForeignKey('hospitals.id'))
    response_time = Column(Integer)  # seconds
    resolution_time = Column(Integer)  # seconds
    description = Column(Text)
    metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    camera = relationship("Camera", back_populates="accidents")
    ambulance = relationship("Ambulance", back_populates="accidents")
    hospital = relationship("Hospital", back_populates="accidents")
    footage = relationship("Footage", back_populates="accident", cascade="all, delete-orphan")
    routes = relationship("RouteLog", back_populates="accident", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="accident", cascade="all, delete-orphan")
    
    __table_args__ = (
        CheckConstraint("severity IN ('low', 'medium', 'high', 'critical')"),
        CheckConstraint("status IN ('detected', 'dispatched', 'resolved', 'false_positive')"),
    )


class Footage(Base):
    __tablename__ = "footage"
    
    id = Column(Integer, primary_key=True, index=True)
    accident_id = Column(Integer, ForeignKey('accidents.id', ondelete='CASCADE'), index=True)
    camera_id = Column(Integer, ForeignKey('cameras.id', ondelete='SET NULL'))
    file_path = Column(Text, nullable=False)
    file_size = Column(Integer)
    duration = Column(Integer)  # seconds
    format = Column(String(20), default='mp4')
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    thumbnail_path = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    metadata = Column(JSON)
    
    # Relationships
    accident = relationship("Accident", back_populates="footage")
    camera = relationship("Camera", back_populates="footage")


class RouteLog(Base):
    __tablename__ = "routes_log"
    
    id = Column(Integer, primary_key=True, index=True)
    accident_id = Column(Integer, ForeignKey('accidents.id', ondelete='CASCADE'), index=True)
    ambulance_id = Column(Integer, ForeignKey('ambulances.id'))
    hospital_id = Column(Integer, ForeignKey('hospitals.id'))
    route_type = Column(String(50))
    start_location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    end_location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    distance_meters = Column(Float)
    estimated_duration_seconds = Column(Integer)
    actual_duration_seconds = Column(Integer)
    route_geometry = Column(JSON)  # GeoJSON LineString
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    
    # Relationships
    accident = relationship("Accident", back_populates="routes")
    
    __table_args__ = (
        CheckConstraint("route_type IN ('ambulance_to_accident', 'accident_to_hospital')"),
    )


class SystemMetric(Base):
    __tablename__ = "system_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey('cameras.id', ondelete='CASCADE'), index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    fps = Column(Float)
    inference_time_ms = Column(Float)
    cpu_usage = Column(Float)
    gpu_usage = Column(Float)
    memory_usage = Column(Float)
    queue_size = Column(Integer)
    frames_processed = Column(Integer)
    detections_count = Column(Integer)
    metadata = Column(JSON)
    
    # Relationships
    camera = relationship("Camera", back_populates="metrics")


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    accident_id = Column(Integer, ForeignKey('accidents.id', ondelete='CASCADE'))
    recipient_type = Column(String(50), index=True)
    recipient_id = Column(Integer)
    message = Column(Text, nullable=False)
    status = Column(String(50), default='pending', index=True)
    sent_at = Column(DateTime)
    read_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    metadata = Column(JSON)
    
    # Relationships
    accident = relationship("Accident", back_populates="notifications")
    
    __table_args__ = (
        CheckConstraint("recipient_type IN ('control_center', 'hospital', 'ambulance')"),
        CheckConstraint("status IN ('pending', 'sent', 'delivered', 'read')"),
    )
