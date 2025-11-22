# 🚧 Road-Raksha

**Intelligent Accident Detection and Emergency Response System**

Road-Raksha is an end-to-end computer vision + IoT + cloud system that automatically detects accidents from CCTV feeds, dispatches emergency services, and provides real-time monitoring through multiple dashboards.

---

## 🌟 Features

### Core Capabilities
- **Real-time Accident Detection** using YOLOv8n computer vision
- **Multi-camera RTSP Stream Processing** with concurrent handling
- **Automatic Emergency Dispatch** to nearest ambulances and hospitals
- **Intelligent Routing** using OSRM for optimal paths
- **Video Clip Extraction** (10-15 seconds around incidents)
- **Real-time WebSocket Notifications** across all dashboards
- **Geospatial Analysis** with PostGIS for location-based queries

### Three Specialized Dashboards
1. **Control Center** - Live monitoring, alerts, analytics, performance metrics
2. **Hospital** - Incoming patient notifications, severity assessment, regional stats
3. **Ambulance** - Navigation, route optimization, incident details

---

## 🏗️ Architecture

```
┌─────────────┐
│ CCTV Cameras│
└──────┬──────┘
       │ RTSP
       ▼
┌──────────────────┐
│   CV Engine      │
│  (YOLOv8n)       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐      ┌─────────────┐
│  FastAPI Backend │◄────►│  PostgreSQL │
│                  │      │  + PostGIS  │
└────────┬─────────┘      └─────────────┘
         │
         ├──────►┌──────────┐
         │       │  Redis   │
         │       └──────────┘
         │
         ├──────►┌──────────┐
         │       │   OSRM   │
         │       └──────────┘
         │
         ▼
┌──────────────────┐
│  React Frontend  │
│  (3 Dashboards)  │
└──────────────────┘
```

---

## 📋 Prerequisites

- **Docker** and **Docker Compose**
- **NVIDIA GPU** (optional, for faster CV processing)
- **8GB RAM** minimum (16GB recommended)
- **50GB disk space** for footage storage

---

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone <repository-url>
cd Road-Raksha
```

### 2. Download OSRM Map Data
```bash
# Download India map data (or your region)
cd routing-engine
wget http://download.geofabrik.de/asia/india-latest.osm.pbf

# Process for OSRM
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/india-latest.osm.pbf
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-partition /data/india-latest.osrm
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-customize /data/india-latest.osrm

cd ..
```

### 3. Configure Environment
```bash
# Create .env file in backend/
cat > backend/.env << EOF
DATABASE_URL=postgresql://roadraksha:roadraksha@postgres:5432/roadraksha
REDIS_HOST=redis
REDIS_PORT=6379
OSRM_URL=http://osrm:5000
EOF
```

### 4. Start All Services
```bash
docker-compose up -d
```

### 5. Initialize Database
```bash
# Database is auto-initialized from schema.sql
# Verify with:
docker-compose logs postgres
```

### 6. Access Dashboards
- **Control Center**: http://localhost:3000/control-center
- **Hospital**: http://localhost:3000/hospital
- **Ambulance**: http://localhost:3000/ambulance
- **API Docs**: http://localhost:8000/docs

---

## 📁 Project Structure

```
Road-Raksha/
├── backend/                 # FastAPI application
│   ├── api/                # API endpoints
│   │   ├── cameras.py
│   │   ├── accidents.py
│   │   ├── emergency.py
│   │   ├── routing.py
│   │   ├── analytics.py
│   │   └── footage.py
│   ├── models/             # Database models & schemas
│   │   ├── database.py
│   │   └── schemas.py
│   ├── main.py             # FastAPI app
│   ├── database.py         # DB configuration
│   ├── websocket.py        # WebSocket manager
│   └── requirements.txt
│
├── cv-engine/              # Computer vision pipeline
│   ├── accident_detector.py
│   ├── stream_processor.py
│   ├── clip_extractor.py
│   ├── main.py
│   └── requirements.txt
│
├── frontend/               # React dashboards
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ControlCenter/
│   │   │   ├── Hospital/
│   │   │   └── Ambulance/
│   │   ├── components/
│   │   └── services/
│   └── package.json
│
├── database/
│   └── schema.sql          # PostgreSQL schema
│
├── docker/
│   └── nginx.conf          # Reverse proxy config
│
├── routing-engine/         # OSRM setup
│
├── docker-compose.yml      # Service orchestration
└── README.md
```

---

## 🎯 Usage

### Adding a New Camera

**Via API:**
```bash
curl -X POST http://localhost:8000/api/cameras \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Camera-DL-004",
    "rtsp_url": "rtsp://your-camera-ip/stream",
    "location": {
      "latitude": 28.6139,
      "longitude": 77.2090
    },
    "address": "New Delhi, India",
    "fps": 30,
    "resolution": "720p"
  }'
```

**Via Database:**
```sql
INSERT INTO cameras (name, rtsp_url, location, address)
VALUES (
  'Camera-DL-004',
  'rtsp://your-camera-ip/stream',
  ST_GeogFromText('POINT(77.2090 28.6139)'),
  'New Delhi, India'
);
```

### Adding Ambulances/Hospitals

```sql
-- Add Hospital
INSERT INTO hospitals (name, location, address, phone, capacity, available_beds, specializations)
VALUES (
  'City Hospital',
  ST_GeogFromText('POINT(77.2090 28.5672)'),
  'New Delhi',
  '+91-11-12345678',
  500,
  50,
  ARRAY['Emergency', 'Trauma']
);

-- Add Ambulance
INSERT INTO ambulances (vehicle_number, current_location, status, hospital_id, equipment_level)
VALUES (
  'DL-01-AB-9999',
  ST_GeogFromText('POINT(77.2100 28.6100)'),
  'available',
  1,
  'advanced'
);
```

---

## 🔧 Configuration

### CV Engine Settings
Edit `cv-engine/main.py`:
```python
engine = CVEngine(
    backend_url="http://localhost:8000",
    confidence_threshold=0.5,  # Adjust detection sensitivity
    footage_dir="./footage"
)
```

### Accident Detection Tuning
Edit `cv-engine/accident_detector.py`:
```python
self.accident_indicators = {
    'vehicle_overlap_threshold': 0.3,  # IoU for collision
    'person_near_vehicle_distance': 50,  # pixels
    'minimum_vehicles': 2
}
```

---

## 📊 API Documentation

### Key Endpoints

#### Cameras
- `GET /api/cameras` - List all cameras
- `POST /api/cameras` - Add new camera
- `PATCH /api/cameras/{id}` - Update camera
- `DELETE /api/cameras/{id}` - Remove camera

#### Accidents
- `GET /api/accidents` - List accidents
- `POST /api/accidents/report` - Report new accident
- `PATCH /api/accidents/{id}` - Update accident status

#### Emergency Services
- `POST /api/emergency/nearest-ambulance` - Find nearest ambulances
- `POST /api/emergency/nearest-hospital` - Find nearest hospitals

#### Routing
- `POST /api/routing/route` - Calculate shortest path

#### Analytics
- `GET /api/analytics/accident-statistics` - Get statistics
- `GET /api/analytics/camera-performance` - Performance metrics
- `GET /api/analytics/summary` - Dashboard summary

#### Footage
- `GET /api/footage` - List all footage
- `GET /api/footage/{id}/download` - Download video
- `GET /api/footage/{id}/thumbnail` - Get thumbnail

**Full API documentation**: http://localhost:8000/docs

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest tests/ -v --cov
```

### Frontend Tests
```bash
cd frontend
npm test -- --coverage
```

### CV Pipeline Tests
```bash
cd cv-engine
pytest tests/ -v
```

### Manual Testing
```bash
# Test accident detection with sample video
python cv-engine/accident_detector.py

# Test routing
curl -X POST http://localhost:8000/api/routing/route \
  -H "Content-Type: application/json" \
  -d '{
    "start_location": {"latitude": 28.6139, "longitude": 77.2090},
    "end_location": {"latitude": 28.5672, "longitude": 77.2090}
  }'
```

---

## 🚀 Deployment

### Production Deployment

1. **Update Environment Variables**
```bash
# backend/.env
DATABASE_URL=postgresql://user:pass@production-db:5432/roadraksha
REDIS_HOST=production-redis
SECRET_KEY=your-secret-key
```

2. **Enable SSL**
```bash
# Get SSL certificates
certbot certonly --standalone -d your-domain.com

# Update docker/nginx.conf to enable HTTPS
```

3. **Deploy**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Scaling

**Multiple CV Engines:**
```bash
docker-compose up -d --scale cv-engine=3
```

**Load Balancing:**
```yaml
# Add to docker-compose.yml
backend:
  deploy:
    replicas: 3
```

---

## 🔐 Security

- Change default database credentials
- Enable SSL/TLS for all connections
- Use environment variables for secrets
- Implement API authentication (JWT)
- Rate limiting via Nginx
- Regular security updates

---

## 📈 Performance Optimization

### CV Engine
- Adjust `skip_frames` in stream processor (higher = faster, less accurate)
- Use GPU for inference (10x faster)
- Reduce input resolution for faster processing

### Database
- Create indexes on frequently queried columns
- Use connection pooling
- Regular VACUUM and ANALYZE

### Caching
- Redis for frequently accessed data
- CDN for static assets

---

## 🐛 Troubleshooting

### OSRM Not Starting
```bash
# Check if map data is processed
ls routing-engine/*.osrm

# Reprocess if needed
docker run -t -v "${PWD}/routing-engine:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/india-latest.osm.pbf
```

### CV Engine Not Detecting
- Check camera RTSP URL is accessible
- Verify confidence threshold (lower = more sensitive)
- Check logs: `docker-compose logs cv-engine`

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres
```

---

## 📚 Additional Documentation

- [Installation Guide](docs/INSTALLATION.md)
- [API Reference](docs/API.md)
- [Camera Setup](docs/CAMERA_SETUP.md)
- [Model Training](docs/MODEL_TRAINING.md)
- [Architecture Details](docs/ARCHITECTURE.md)

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👥 Team

Built with ❤️ for safer roads

---

## 🙏 Acknowledgments

- **YOLOv8** by Ultralytics
- **OSRM** for routing
- **OpenStreetMap** for map data
- **FastAPI** framework
- **React** and **Leaflet.js**

---

## 📞 Support

For issues and questions:
- GitHub Issues: [Create Issue]
- Email: support@roadraksha.com
- Documentation: [Wiki]

---

**⚠️ Important**: This system is designed to assist emergency response but should not replace existing emergency protocols. Always verify automated detections and maintain human oversight.
