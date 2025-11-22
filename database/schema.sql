-- Road-Raksha Database Schema
-- PostgreSQL 14+

-- Enable PostGIS for geospatial data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table for authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'control_center', 'hospital', 'ambulance')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Cameras table
CREATE TABLE cameras (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    rtsp_url TEXT NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    address TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    fps INTEGER DEFAULT 30,
    resolution VARCHAR(20) DEFAULT '720p',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP,
    metadata JSONB
);

-- Create spatial index on camera locations
CREATE INDEX idx_cameras_location ON cameras USING GIST(location);

-- Hospitals table
CREATE TABLE hospitals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    capacity INTEGER DEFAULT 0,
    available_beds INTEGER DEFAULT 0,
    emergency_contact VARCHAR(20),
    specializations TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE INDEX idx_hospitals_location ON hospitals USING GIST(location);

-- Ambulances table
CREATE TABLE ambulances (
    id SERIAL PRIMARY KEY,
    vehicle_number VARCHAR(50) UNIQUE NOT NULL,
    current_location GEOGRAPHY(POINT, 4326),
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'dispatched', 'busy', 'offline')),
    driver_name VARCHAR(255),
    driver_phone VARCHAR(20),
    hospital_id INTEGER REFERENCES hospitals(id),
    equipment_level VARCHAR(50) CHECK (equipment_level IN ('basic', 'advanced', 'critical')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE INDEX idx_ambulances_location ON ambulances USING GIST(current_location);
CREATE INDEX idx_ambulances_status ON ambulances(status);

-- Accidents table
CREATE TABLE accidents (
    id SERIAL PRIMARY KEY,
    camera_id INTEGER REFERENCES cameras(id) ON DELETE SET NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    severity VARCHAR(50) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    confidence_score FLOAT,
    status VARCHAR(50) DEFAULT 'detected' CHECK (status IN ('detected', 'dispatched', 'resolved', 'false_positive')),
    ambulance_id INTEGER REFERENCES ambulances(id),
    hospital_id INTEGER REFERENCES hospitals(id),
    response_time INTEGER, -- in seconds
    resolution_time INTEGER, -- in seconds
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accidents_location ON accidents USING GIST(location);
CREATE INDEX idx_accidents_detected_at ON accidents(detected_at DESC);
CREATE INDEX idx_accidents_status ON accidents(status);
CREATE INDEX idx_accidents_camera_id ON accidents(camera_id);

-- Footage table
CREATE TABLE footage (
    id SERIAL PRIMARY KEY,
    accident_id INTEGER REFERENCES accidents(id) ON DELETE CASCADE,
    camera_id INTEGER REFERENCES cameras(id) ON DELETE SET NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    duration INTEGER, -- in seconds
    format VARCHAR(20) DEFAULT 'mp4',
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    thumbnail_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE INDEX idx_footage_accident_id ON footage(accident_id);

-- Routes log table
CREATE TABLE routes_log (
    id SERIAL PRIMARY KEY,
    accident_id INTEGER REFERENCES accidents(id) ON DELETE CASCADE,
    ambulance_id INTEGER REFERENCES ambulances(id),
    hospital_id INTEGER REFERENCES hospitals(id),
    route_type VARCHAR(50) CHECK (route_type IN ('ambulance_to_accident', 'accident_to_hospital')),
    start_location GEOGRAPHY(POINT, 4326) NOT NULL,
    end_location GEOGRAPHY(POINT, 4326) NOT NULL,
    distance_meters FLOAT,
    estimated_duration_seconds INTEGER,
    actual_duration_seconds INTEGER,
    route_geometry JSONB, -- GeoJSON LineString
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_routes_accident_id ON routes_log(accident_id);

-- System metrics table
CREATE TABLE system_metrics (
    id SERIAL PRIMARY KEY,
    camera_id INTEGER REFERENCES cameras(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fps FLOAT,
    inference_time_ms FLOAT,
    cpu_usage FLOAT,
    gpu_usage FLOAT,
    memory_usage FLOAT,
    queue_size INTEGER,
    frames_processed INTEGER,
    detections_count INTEGER,
    metadata JSONB
);

CREATE INDEX idx_metrics_camera_timestamp ON system_metrics(camera_id, timestamp DESC);
CREATE INDEX idx_metrics_timestamp ON system_metrics(timestamp DESC);

-- Notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    accident_id INTEGER REFERENCES accidents(id) ON DELETE CASCADE,
    recipient_type VARCHAR(50) CHECK (recipient_type IN ('control_center', 'hospital', 'ambulance')),
    recipient_id INTEGER,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read')),
    sent_at TIMESTAMP,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX idx_notifications_status ON notifications(status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for accidents table
CREATE TRIGGER update_accidents_updated_at BEFORE UPDATE ON accidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for ambulances table
CREATE TRIGGER update_ambulances_updated_at BEFORE UPDATE ON ambulances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO users (username, email, password_hash, role) VALUES
    ('admin', 'admin@roadraksha.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqNk7Z8.Ke', 'admin'),
    ('control1', 'control@roadraksha.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqNk7Z8.Ke', 'control_center'),
    ('hospital1', 'hospital@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqNk7Z8.Ke', 'hospital'),
    ('ambulance1', 'ambulance@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqNk7Z8.Ke', 'ambulance');

-- Sample cameras (Delhi coordinates)
INSERT INTO cameras (name, rtsp_url, location, address) VALUES
    ('Camera-DL-001', 'rtsp://example.com/stream1', ST_GeogFromText('POINT(77.2090 28.6139)'), 'Connaught Place, New Delhi'),
    ('Camera-DL-002', 'rtsp://example.com/stream2', ST_GeogFromText('POINT(77.2167 28.6358)'), 'Kashmere Gate, Delhi'),
    ('Camera-DL-003', 'rtsp://example.com/stream3', ST_GeogFromText('POINT(77.1025 28.7041)'), 'Rohini, Delhi');

-- Sample hospitals
INSERT INTO hospitals (name, location, address, phone, capacity, available_beds, specializations) VALUES
    ('AIIMS Delhi', ST_GeogFromText('POINT(77.2090 28.5672)'), 'Ansari Nagar, New Delhi', '+91-11-26588500', 2500, 150, ARRAY['Emergency', 'Trauma', 'Cardiology']),
    ('Safdarjung Hospital', ST_GeogFromText('POINT(77.2074 28.5706)'), 'Ring Road, New Delhi', '+91-11-26165060', 1500, 80, ARRAY['Emergency', 'Orthopedics']),
    ('Ram Manohar Lohia Hospital', ST_GeogFromText('POINT(77.2085 28.6328)'), 'Baba Kharak Singh Marg, New Delhi', '+91-11-23404242', 1200, 60, ARRAY['Emergency', 'Surgery']);

-- Sample ambulances
INSERT INTO ambulances (vehicle_number, current_location, status, driver_name, driver_phone, hospital_id, equipment_level) VALUES
    ('DL-01-AB-1234', ST_GeogFromText('POINT(77.2100 28.6100)'), 'available', 'Rajesh Kumar', '+91-9876543210', 1, 'advanced'),
    ('DL-01-AB-5678', ST_GeogFromText('POINT(77.2150 28.6200)'), 'available', 'Amit Singh', '+91-9876543211', 2, 'critical'),
    ('DL-01-AB-9012', ST_GeogFromText('POINT(77.2050 28.6050)'), 'available', 'Suresh Sharma', '+91-9876543212', 3, 'basic');

-- Create views for analytics
CREATE VIEW accident_statistics AS
SELECT 
    DATE(detected_at) as date,
    COUNT(*) as total_accidents,
    COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
    COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
    COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
    COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count,
    AVG(response_time) as avg_response_time,
    AVG(resolution_time) as avg_resolution_time
FROM accidents
WHERE status != 'false_positive'
GROUP BY DATE(detected_at)
ORDER BY date DESC;

CREATE VIEW camera_performance AS
SELECT 
    c.id,
    c.name,
    c.status,
    COUNT(a.id) as total_detections,
    AVG(sm.fps) as avg_fps,
    AVG(sm.inference_time_ms) as avg_inference_time,
    AVG(sm.cpu_usage) as avg_cpu_usage,
    AVG(sm.gpu_usage) as avg_gpu_usage
FROM cameras c
LEFT JOIN accidents a ON c.id = a.camera_id
LEFT JOIN system_metrics sm ON c.id = sm.camera_id
WHERE sm.timestamp > NOW() - INTERVAL '24 hours'
GROUP BY c.id, c.name, c.status;

CREATE VIEW ambulance_availability AS
SELECT 
    h.name as hospital_name,
    COUNT(a.id) as total_ambulances,
    COUNT(CASE WHEN a.status = 'available' THEN 1 END) as available_count,
    COUNT(CASE WHEN a.status = 'dispatched' THEN 1 END) as dispatched_count,
    COUNT(CASE WHEN a.status = 'busy' THEN 1 END) as busy_count
FROM hospitals h
LEFT JOIN ambulances a ON h.id = a.hospital_id
GROUP BY h.id, h.name;
