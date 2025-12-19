# Road Raksha - Database Backend Analysis

## 📊 Current Database Setup

### **Technology Stack**
Your project currently uses **SQLite3** as the local database solution.

- **Location**: `server/storage/database.sqlite`
- **Schema Management**: `server/db.js`
- **File Storage**: `server/storage/videos/`

---

## 🗄️ Current Database Schema

### **1. Videos Table**
Stores metadata about uploaded video files.

```sql
CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,              -- Unique system filename (timestamp-based)
    original_name TEXT,                  -- Original upload filename
    path TEXT NOT NULL,                  -- File system path
    size INTEGER,                        -- File size in bytes
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Purpose**: Track all uploaded videos for incident analysis

---

### **2. Analysis Logs Table**
Stores AI/ML analysis results for each video.

```sql
CREATE TABLE IF NOT EXISTS analysis_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER,                    -- Foreign key to videos table
    timestamp TEXT,                      -- Analysis timestamp
    incident_type TEXT,                  -- Type: Accident, Traffic Violation, etc.
    confidence REAL,                     -- ML model confidence score (0-1)
    details TEXT,                        -- JSON string with additional info
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos (id)
)
```

**Purpose**: Store analysis results from YOLOv8 or other detection models

---

## 🔄 Current Data Flow

```
┌─────────────────┐
│ Frontend Upload │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Multer Receives │ ──> Stores video in /server/storage/videos/
│   Video File    │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  INSERT into    │ ──> Saves metadata (filename, size, path)
│  videos table   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Run Analysis   │ ──> YOLOv8 processes video (currently mocked)
│  (YOLOv8)       │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  INSERT into    │ ──> Saves detection results
│ analysis_logs   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Display in      │ ──> Shows incidents with confidence, type, etc.
│ IncidentsPage   │
└─────────────────┘
```

---

## 🎯 Recommended Database Enhancements

### **Option 1: Keep SQLite with Enhanced Schema** ✅ *RECOMMENDED FOR YOUR USE CASE*

**Why SQLite is Good Here:**
- ✅ Zero configuration, embedded database
- ✅ Perfect for local deployments and demos
- ✅ Handles video metadata efficiently
- ✅ Supports complex queries and joins
- ✅ No separate database server needed
- ✅ Your videos are already stored locally

**Enhanced Schema Suggestions:**

#### **A. Add Incidents Table**
Track actual incident events separate from videos:

```sql
CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_type TEXT NOT NULL,         -- Accident, Violation, Hazard
    severity TEXT,                       -- Critical, High, Medium, Low
    status TEXT DEFAULT 'Reported',      -- Reported, Under Review, Resolved
    location_lat REAL,                   -- GPS coordinates
    location_lng REAL,
    location_address TEXT,               -- Human-readable address
    description TEXT,
    reporter_name TEXT,
    reporter_contact TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
)
```

#### **B. Link Videos to Incidents**
Create a many-to-many relationship:

```sql
CREATE TABLE IF NOT EXISTS incident_videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id INTEGER NOT NULL,
    video_id INTEGER NOT NULL,
    is_primary BOOLEAN DEFAULT 0,        -- Mark main evidence video
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (incident_id) REFERENCES incidents (id),
    FOREIGN KEY (video_id) REFERENCES videos (id)
)
```

#### **C. Ambulance Dispatch Table**
Track ambulance assignments:

```sql
CREATE TABLE IF NOT EXISTS ambulance_dispatches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id INTEGER NOT NULL,
    ambulance_id TEXT NOT NULL,          -- e.g., AMB001
    driver_name TEXT,
    status TEXT,                         -- Dispatched, En Route, Arrived, Completed
    dispatch_time DATETIME,
    arrival_time DATETIME,
    completion_time DATETIME,
    route_data TEXT,                     -- JSON: store OSRM route
    notes TEXT,
    FOREIGN KEY (incident_id) REFERENCES incidents (id)
)
```

#### **D. Resource Tracking Table**
Store emergency resources data (currently hard-coded):

```sql
CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT UNIQUE NOT NULL,    -- AMB-01, PTR-01, etc.
    type TEXT NOT NULL,                  -- Ambulance, Patrol Unit, Fire Truck, Drone
    driver_name TEXT,
    status TEXT DEFAULT 'Available',     -- Available, On Mission, Maintenance
    battery_level INTEGER DEFAULT 100,   -- Percentage
    fuel_level INTEGER DEFAULT 100,      -- Percentage
    current_location_lat REAL,
    current_location_lng REAL,
    location_name TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### **E. Analytics/Metrics Table**
Store aggregated metrics for dashboard:

```sql
CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_type TEXT NOT NULL,           -- response_time, detection_accuracy, etc.
    metric_value REAL,
    metadata TEXT,                       -- JSON for additional details
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

### **Option 2: Upgrade to PostgreSQL** (For Production/Scalability)

**When to Consider:**
- 🌐 You need multi-user access across network
- 📈 Expecting high traffic/concurrent users
- 🔐 Need advanced authentication/role-based access
- 🌍 Want to deploy on cloud (AWS RDS, Heroku, etc.)
- 📊 Need advanced analytics and reporting

**Migration Steps:**
1. Install PostgreSQL locally
2. Replace `sqlite3` with `pg` (node-postgres)
3. Convert schema to PostgreSQL syntax (very similar)
4. Use environment variables for connection strings

**Example Connection:**
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: 'road_raksha',
  password: process.env.DB_PASSWORD,
  port: 5432,
});
```

---

### **Option 3: MongoDB (NoSQL)** (Not Recommended for This Project)

**Why Not MongoDB:**
- ❌ Your data is highly relational (videos → incidents → ambulances)
- ❌ You benefit from SQL joins and foreign keys
- ❌ SQLite/PostgreSQL better suit structured data
- ❌ Overkill for local file-based storage

---

## 🛠️ Implementation Recommendations

### **Phase 1: Enhance Current SQLite Schema** (IMMEDIATE)

Update `server/db.js` to add these tables:

1. **incidents** - Central incident tracking
2. **incident_videos** - Link videos to incidents
3. **ambulance_dispatches** - Track emergency responses
4. **resources** - Store fleet data
5. **metrics** - Analytics data

### **Phase 2: Refactor Backend API** (NEXT)

Create RESTful endpoints:

```javascript
// Incidents
POST   /api/incidents          - Create new incident
GET    /api/incidents          - List all incidents
GET    /api/incidents/:id      - Get incident details
PUT    /api/incidents/:id      - Update incident
DELETE /api/incidents/:id      - Delete incident

// Resources (Ambulances, etc.)
GET    /api/resources          - List all resources
POST   /api/resources          - Add new resource
PUT    /api/resources/:id      - Update resource status
GET    /api/resources/nearby   - Get resources near location

// Dispatch
POST   /api/dispatch           - Dispatch ambulance to incident
GET    /api/dispatch/:id       - Get dispatch details
PUT    /api/dispatch/:id       - Update dispatch status

// Analytics
GET    /api/analytics/summary  - Dashboard stats
GET    /api/analytics/trends   - Historical trends
```

### **Phase 3: Frontend Integration** (AFTER)

Update pages to use real database data:

1. **IncidentsPage.jsx** - Already connected to `/api/history`
2. **ResourcesPage.jsx** - Replace mock data with `/api/resources`
3. **DashboardPage.jsx** - Use `/api/analytics/summary`
4. **AnalyticsPage.jsx** - Fetch from `/api/analytics/trends`

### **Phase 4: Real-Time Features** (FUTURE)

Add WebSocket support for live updates:
- Real-time ambulance position updates
- Live incident notifications
- Dashboard metrics refresh

```bash
npm install socket.io
```

---

## 📈 Data Model Relationships

```
┌──────────────┐
│  incidents   │
│   (main)     │
└──────┬───────┘
       │
       ├──────────────────┐
       │                  │
       v                  v
┌──────────────┐   ┌──────────────┐
│incident_     │   │ambulance_    │
│videos        │   │dispatches    │
└──────┬───────┘   └──────┬───────┘
       │                  │
       v                  v
┌──────────────┐   ┌──────────────┐
│   videos     │   │  resources   │
│(physical     │   │ (ambulances, │
│ files)       │   │  vehicles)   │
└──────┬───────┘   └──────────────┘
       │
       v
┌──────────────┐
│analysis_logs │
│(AI results)  │
└──────────────┘
```

---

## 💡 Key Insights from Your Code

### **What's Working Well:**
1. ✅ SQLite is already set up and functioning
2. ✅ Video upload pipeline works (Multer → SQLite)
3. ✅ Analysis logging structure is in place
4. ✅ Frontend successfully fetches from `/api/history`

### **What Needs Enhancement:**
1. ⚠️ **ResourcesPage** uses hard-coded mock data (line 6-13 in ResourcesPage.jsx)
2. ⚠️ **Ambulance data** is stateful/in-memory (resets on server restart)
3. ⚠️ No incident management system (videos exist but no incident entities)
4. ⚠️ No dispatch tracking
5. ⚠️ Analytics are not persisted

---

## 🚀 Quick Start: Implementing Enhanced Schema

I can help you implement the enhanced SQLite schema right now. This will:

1. Add new tables (incidents, resources, dispatches, etc.)
2. Preserve existing data
3. Create migration-safe code
4. Add new API endpoints
5. Update frontend to use real data

Would you like me to proceed with implementing these database enhancements? I'll:

1. ✅ Update `server/db.js` with new tables
2. ✅ Add new API endpoints in `server/index.js`
3. ✅ Update frontend pages to fetch from database
4. ✅ Add seed data for testing
5. ✅ Maintain backward compatibility

Let me know if you want to proceed, or if you have specific requirements!
