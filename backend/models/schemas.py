"""
Pydantic schemas for request/response validation
"""

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    CONTROL_CENTER = "control_center"
    HOSPITAL = "hospital"
    AMBULANCE = "ambulance"


class CameraStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    MAINTENANCE = "maintenance"


class AccidentSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AccidentStatus(str, Enum):
    DETECTED = "detected"
    DISPATCHED = "dispatched"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"


class AmbulanceStatus(str, Enum):
    AVAILABLE = "available"
    DISPATCHED = "dispatched"
    BUSY = "busy"
    OFFLINE = "offline"


# Location schemas
class LocationSchema(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


# User schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: UserRole


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    created_at: datetime
    last_login: Optional[datetime] = None
    is_active: bool
    
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


# Camera schemas
class CameraBase(BaseModel):
    name: str
    rtsp_url: str
    location: LocationSchema
    address: Optional[str] = None
    fps: int = 30
    resolution: str = "720p"


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    rtsp_url: Optional[str] = None
    status: Optional[CameraStatus] = None
    location: Optional[LocationSchema] = None
    address: Optional[str] = None


class CameraResponse(CameraBase):
    id: int
    status: CameraStatus
    created_at: datetime
    last_seen: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None
    
    model_config = ConfigDict(from_attributes=True)


# Hospital schemas
class HospitalBase(BaseModel):
    name: str
    location: LocationSchema
    address: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    capacity: int = 0
    available_beds: int = 0
    emergency_contact: Optional[str] = None
    specializations: Optional[List[str]] = None


class HospitalCreate(HospitalBase):
    pass


class HospitalResponse(HospitalBase):
    id: int
    is_active: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Ambulance schemas
class AmbulanceBase(BaseModel):
    vehicle_number: str
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    hospital_id: Optional[int] = None
    equipment_level: Optional[str] = None


class AmbulanceCreate(AmbulanceBase):
    current_location: Optional[LocationSchema] = None


class AmbulanceUpdate(BaseModel):
    current_location: Optional[LocationSchema] = None
    status: Optional[AmbulanceStatus] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None


class AmbulanceResponse(AmbulanceBase):
    id: int
    current_location: Optional[LocationSchema] = None
    status: AmbulanceStatus
    created_at: datetime
    last_updated: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Accident schemas
class AccidentCreate(BaseModel):
    camera_id: Optional[int] = None
    location: LocationSchema
    detected_at: Optional[datetime] = None
    severity: AccidentSeverity
    confidence_score: float = Field(..., ge=0, le=1)
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class AccidentUpdate(BaseModel):
    status: Optional[AccidentStatus] = None
    ambulance_id: Optional[int] = None
    hospital_id: Optional[int] = None
    description: Optional[str] = None


class AccidentResponse(BaseModel):
    id: int
    camera_id: Optional[int] = None
    location: LocationSchema
    detected_at: datetime
    severity: AccidentSeverity
    confidence_score: float
    status: AccidentStatus
    ambulance_id: Optional[int] = None
    hospital_id: Optional[int] = None
    response_time: Optional[int] = None
    resolution_time: Optional[int] = None
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Footage schemas
class FootageCreate(BaseModel):
    accident_id: int
    camera_id: Optional[int] = None
    file_path: str
    file_size: Optional[int] = None
    duration: Optional[int] = None
    start_time: datetime
    end_time: datetime
    thumbnail_path: Optional[str] = None


class FootageResponse(FootageCreate):
    id: int
    format: str
    created_at: datetime
    metadata: Optional[Dict[str, Any]] = None
    
    model_config = ConfigDict(from_attributes=True)


# Route schemas
class RouteRequest(BaseModel):
    start_location: LocationSchema
    end_location: LocationSchema


class RouteResponse(BaseModel):
    distance_meters: float
    duration_seconds: int
    geometry: Dict[str, Any]  # GeoJSON LineString


class NearestResourceRequest(BaseModel):
    location: LocationSchema
    limit: int = Field(default=5, ge=1, le=20)


class NearestAmbulanceResponse(BaseModel):
    ambulance: AmbulanceResponse
    distance_meters: float
    eta_seconds: int


class NearestHospitalResponse(BaseModel):
    hospital: HospitalResponse
    distance_meters: float
    eta_seconds: int


# Analytics schemas
class AccidentStatistics(BaseModel):
    date: datetime
    total_accidents: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    avg_response_time: Optional[float] = None
    avg_resolution_time: Optional[float] = None


class CameraPerformance(BaseModel):
    id: int
    name: str
    status: CameraStatus
    total_detections: int
    avg_fps: Optional[float] = None
    avg_inference_time: Optional[float] = None
    avg_cpu_usage: Optional[float] = None
    avg_gpu_usage: Optional[float] = None


# System metrics schemas
class SystemMetricCreate(BaseModel):
    camera_id: int
    fps: Optional[float] = None
    inference_time_ms: Optional[float] = None
    cpu_usage: Optional[float] = None
    gpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    queue_size: Optional[int] = None
    frames_processed: Optional[int] = None
    detections_count: Optional[int] = None


class SystemMetricResponse(SystemMetricCreate):
    id: int
    timestamp: datetime
    
    model_config = ConfigDict(from_attributes=True)


# WebSocket message schemas
class WSMessage(BaseModel):
    type: str
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
