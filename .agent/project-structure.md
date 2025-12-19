# Road Raksha - Complete Project File Structure & Guide

## 📚 Table of Contents
1. [What is seed.js?](#what-is-seedjs)
2. [Backend Files (Server)](#backend-files-server)
3. [Frontend Files (React)](#frontend-files-react)
4. [Configuration Files](#configuration-files)
5. [Database Files](#database-files)
6. [How Everything Works Together](#how-everything-works-together)

---

## 🌱 What is seed.js?

### **Purpose**
`seed.js` is a **database seeding script** that populates your database with initial test data so you can immediately start using your application without manually entering data.

### **Location**
`server/seed.js`

### **What It Does**
When you run `node seed.js` in the server directory, it:

1. **Connects to the SQLite database** (`storage/database.sqlite`)
2. **Inserts sample emergency resources** into the `resources` table:
   - 3 Ambulances (AMB-01, AMB-02, AMB-03)
   - 2 Patrol Units (PTR-01, PTR-02)
   - 1 Fire Truck (FIR-01)
   - 1 Drone Unit (DRN-01)

3. **Populates initial metrics** for the analytics dashboard:
   - Average response time
   - Detection accuracy
   - Active ambulances count
   - Total incidents today

### **When to Use It**
- ✅ When you first set up the project
- ✅ After deleting the database to start fresh
- ✅ When testing with realistic sample data
- ✅ Before showing a demo of the application

### **How to Run**
```bash
cd server
node seed.js
```

**Output Example:**
```
🌱 Starting database seeding...
✓ Inserted resource: AMB-01 (Ambulance)
✓ Inserted resource: AMB-02 (Ambulance)
⊙ Resource AMB-03 already exists, skipped
...
🎉 Seeding complete!
📊 7 resources processed
```

---

## 🔧 Backend Files (Server)

### **1. `server/index.js`** - Main Server Application
**Role**: The heart of your backend - Express.js server

**What it does:**
- 🌐 Creates HTTP server running on port 3000
- 🛣️ Defines all API endpoints (routes)
- 📹 Handles video uploads using Multer
- 🚑 Simulates real-time ambulance movement
- 🗺️ Integrates with OSRM for route calculations
- 📊 Serves data to the React frontend

**Key Features:**
```javascript
// Video Management
POST   /api/upload          - Upload video files
POST   /api/analysis        - Save AI analysis results
GET    /api/history         - Get all video/incident history

// Incident Management (NEW)
POST   /api/incidents       - Create incident
GET    /api/incidents       - List all incidents
PUT    /api/incidents/:id   - Update incident status

// Resource Management (NEW)
GET    /api/resources       - Get all emergency resources
POST   /api/resources       - Add new resource
PUT    /api/resources/:id   - Update resource status

// Dispatch Management (NEW)
POST   /api/dispatch        - Dispatch ambulance to incident
GET    /api/dispatch        - Get all dispatches
PUT    /api/dispatch/:id    - Update dispatch status

// Analytics (NEW)
GET    /api/analytics/summary  - Dashboard statistics
GET    /api/analytics/trends   - Historical metrics

// Live Tracking
GET    /api/ambulances      - Real-time ambulance positions
```

**Dependencies Used:**
- `express` - Web server framework
- `cors` - Allow cross-origin requests from React
- `multer` - Handle file uploads
- `axios` - Make HTTP requests to OSRM

---

### **2. `server/db.js`** - Database Configuration
**Role**: Database initialization and schema management

**What it does:**
- 📂 Creates `storage/database.sqlite` file
- 🏗️ Defines all database tables on startup
- ✅ Uses `CREATE TABLE IF NOT EXISTS` (safe, won't overwrite)
- 🔌 Exports database connection for other files

**Tables Created:**
1. **videos** - Metadata about uploaded videos
2. **analysis_logs** - AI/ML detection results
3. **incidents** - Accident/incident records *(NEW)*
4. **incident_videos** - Links videos to incidents *(NEW)*
5. **resources** - Emergency fleet (ambulances, etc.) *(NEW)*
6. **ambulance_dispatches** - Response tracking *(NEW)*
7. **metrics** - Analytics data *(NEW)*

**Why SQLite?**
- ✅ No separate database server needed
- ✅ Single file storage (portable)
- ✅ Perfect for local development
- ✅ Fast and reliable for this use case

---

### **3. `server/seed.js`** - Database Seeding Script
**Role**: Populate database with test data

**What it does:**
- 📥 Inserts 7 sample emergency resources
- 📊 Adds initial analytics metrics
- 🔒 Uses `INSERT OR IGNORE` to prevent duplicates
- 📝 Provides detailed console output

**Sample Data Includes:**
```javascript
AMB-01: Ambulance in Sector 4 (On Mission, 85% battery)
AMB-02: Ambulance at Base Station (Available, 100% battery)
PTR-01: Patrol Unit on Highway 8 (Patrolling, 60% battery)
FIR-01: Fire Truck at Station 1 (Available, 95% battery)
DRN-01: Drone Unit in Sector 7 (Airborne, 45% battery)
```

---

### **4. `server/package.json`** - Backend Dependencies
**Role**: Lists all Node.js packages required by the server

**Key Dependencies:**
```json
{
  "express": "Web server framework",
  "sqlite3": "Local database driver",
  "cors": "Enable frontend-backend communication",
  "multer": "Handle file uploads",
  "axios": "Make external API calls (OSRM)",
  "fs-extra": "File system operations"
}
```

**Scripts:**
- `npm start` - Run server in production mode
- `npm run dev` - Run with auto-restart (nodemon)

---

### **5. `server/storage/` Directory**
**Role**: Stores persistent data

**Contains:**
- `database.sqlite` - The actual SQLite database file
- `videos/` - Uploaded video files

**Structure:**
```
storage/
├── database.sqlite       (Database file - auto-created)
└── videos/               (Video uploads - auto-created)
    ├── 1734583921234-987654321.mp4
    ├── 1734583922345-123456789.mp4
    └── ...
```

---

## ⚛️ Frontend Files (React)

### **6. `src/App.jsx`** - Main Application Router
**Role**: Application structure and routing

**What it does:**
- 🧭 Defines all page routes using React Router
- 🔐 Could add authentication guards here
- 🎨 Sets up overall app layout

**Routes:**
```javascript
/ → LoginPage
/dashboard → DashboardPage
/incidents → IncidentsPage
/analytics → AnalyticsPage
/resources → ResourcesPage
/settings → SettingsPage
```

---

### **7. `src/pages/` Directory** - Page Components

#### **a. `DashboardPage.jsx`**
- 🏠 Main control center
- 🗺️ Shows live map with ambulances
- 📊 Displays key metrics and stats
- 📹 Mock CCTV feed

#### **b. `IncidentsPage.jsx`** *(DATABASE-CONNECTED)*
- 📋 List all video uploads and analysis results
- 🔍 Search and filter functionality
- ⬆️ Upload new videos
- 🎥 View uploaded videos

**API Connection:**
```javascript
GET /api/history - Fetches all videos + analysis results
POST /api/upload - Uploads new video
POST /api/analysis - Saves analysis results
```

#### **c. `ResourcesPage.jsx`** *(DATABASE-CONNECTED - NEW)*
- 🚑 Display all emergency resources from database
- 🔄 Real-time updates every 10 seconds
- 📍 Shows location, battery, status
- 🎯 Replaces old hard-coded data

**API Connection:**
```javascript
GET /api/resources - Fetches all resources from database
```

#### **d. `AnalyticsPage.jsx`**
- 📈 Charts and graphs (using Recharts)
- 📊 Response time trends
- 🎯 Incident type breakdown
- ⏱️ Performance metrics

#### **e. `SettingsPage.jsx`**
- ⚙️ Application configuration
- 🔔 Notification settings
- 👤 Profile management

#### **f. `LoginPage.jsx`**
- 🔐 Simple login interface
- 🎨 Landing page design

---

### **8. `src/components/` Directory** - Reusable Components

#### **a. `Header.jsx`**
- 🧭 Navigation bar
- 🔗 Links to all pages
- 🎨 Consistent across all routes

#### **b. `Footer.jsx`**
- 📝 Footer information
- 📧 Contact details
- 🏢 Branding

#### **c. `MapComponent.jsx`**
- 🗺️ Leaflet map integration
- 📍 Shows ambulance markers
- 🛣️ Displays routes

#### **d. `RightPanel.jsx`**
- 📊 Side panel with stats
- 📈 Quick metrics
- 🔔 Alerts

#### **e. `CCTVFeed.jsx`**
- 📹 Simulated camera feed
- 🎥 Mock video stream
- 🚨 Live detection demo

---

### **9. `src/main.jsx`** - Application Entry Point
**Role**: Renders the React app into the DOM

**What it does:**
```javascript
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
```

---

### **10. `src/index.css`** - Global Styles
**Role**: Tailwind CSS configuration and custom styles

**Contains:**
- 🎨 Tailwind directives
- 🌈 Custom color variables
- 📏 Global utility classes

---

## ⚙️ Configuration Files

### **11. `package.json`** - Frontend Dependencies
**Role**: React app configuration

**Key Dependencies:**
```json
{
  "react": "UI library",
  "react-router-dom": "Routing",
  "leaflet": "Interactive maps",
  "react-leaflet": "React wrapper for Leaflet",
  "recharts": "Charts and graphs",
  "lucide-react": "Icons"
}
```

**Scripts:**
- `npm run dev` - Start development server (port 5173)
- `npm start` - Run both frontend + backend concurrently
- `npm run build` - Build for production

---

### **12. `vite.config.js`** - Build Tool Configuration
**Role**: Configure Vite bundler

**What it does:**
- ⚡ Fast development server with HMR
- 📦 Optimizes production builds
- 🔌 Loads React plugin

---

### **13. `tailwind.config.js`** - Styling Configuration
**Role**: Customize Tailwind CSS

**Defines:**
- 🎨 Custom colors (primary, darker, panel-border, etc.)
- 📐 Custom spacing and breakpoints
- 🌈 Theme extensions

**Custom Colors:**
```javascript
primary: '#3B82F6'      // Blue
success: '#10B981'      // Green
warning: '#F59E0B'      // Orange
critical: '#EF4444'     // Red
darker: '#0F172A'       // Dark background
```

---

### **14. `index.html`** - HTML Entry Point
**Role**: Single HTML page that loads React

**Contains:**
- 📄 Basic HTML structure
- 🔗 Loads main.jsx
- 🎯 Root div for React mounting

---

## 🗄️ Database Files

### **15. `server/storage/database.sqlite`**
**Role**: The actual database (binary file)

**Auto-created by:** `server/db.js` on first run

**Contains:**
- All 7 tables with their data
- Indexes and constraints
- Transaction logs

**Size:** Starts ~100KB, grows with data

**Can be viewed with:**
- DB Browser for SQLite
- SQLite command line: `sqlite3 database.sqlite`

---

## 🔄 How Everything Works Together

### **Full Request Flow Example:**

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER INTERACTION                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  1. User opens ResourcesPage (http://localhost:5173/resources)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. ResourcesPage.jsx calls useEffect() on mount                 │
│     → fetch('http://localhost:3000/api/resources')               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. Request hits server/index.js                                 │
│     → app.get('/api/resources', handler)                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. Server queries database via server/db.js                     │
│     → db.all('SELECT * FROM resources')                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. SQLite reads from server/storage/database.sqlite             │
│     → Returns resource rows from resources table                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. Server sends JSON response back to frontend                  │
│     → { success: true, data: [...resources] }                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  7. ResourcesPage.jsx updates state with data                    │
│     → setResources(data.data)                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  8. React re-renders with ResourceCard components                │
│     → User sees ambulances, patrol units, etc.                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Complete File Tree with Roles

```
Road-Raksha/
│
├── 📁 server/                          [Backend]
│   ├── index.js                        ⭐ Main server (API endpoints)
│   ├── db.js                           🗄️ Database setup (7 tables)
│   ├── seed.js                         🌱 Populate test data
│   ├── package.json                    📦 Backend dependencies
│   └── storage/                        💾 Data storage
│       ├── database.sqlite             🗄️ SQLite database file
│       └── videos/                     🎥 Uploaded videos
│
├── 📁 src/                             [Frontend]
│   ├── main.jsx                        🚀 App entry point
│   ├── App.jsx                         🧭 Router & routes
│   ├── index.css                       🎨 Global styles
│   │
│   ├── 📁 pages/                       [Main Pages]
│   │   ├── DashboardPage.jsx           🏠 Control center + map
│   │   ├── IncidentsPage.jsx           📋 Video management (DB-connected)
│   │   ├── ResourcesPage.jsx           🚑 Fleet tracking (DB-connected)
│   │   ├── AnalyticsPage.jsx           📈 Charts & metrics
│   │   ├── SettingsPage.jsx            ⚙️ App configuration
│   │   └── LoginPage.jsx               🔐 Login screen
│   │
│   └── 📁 components/                  [Reusable UI]
│       ├── Header.jsx                  🧭 Navigation bar
│       ├── Footer.jsx                  📝 Footer
│       ├── MapComponent.jsx            🗺️ Leaflet map
│       ├── RightPanel.jsx              📊 Stats panel
│       └── CCTVFeed.jsx                📹 Mock camera feed
│
├── 📁 .agent/                          [Documentation]
│   ├── database-analysis.md            📚 Database guide
│   └── project-structure.md            📄 This file!
│
├── index.html                          📄 HTML entry
├── package.json                        📦 Frontend dependencies
├── vite.config.js                      ⚡ Vite bundler config
├── tailwind.config.js                  🎨 Tailwind config
├── README.md                           📖 Project readme
└── INSTRUCTIONS.md                     📝 Setup guide
```

---

## 🎯 Quick Reference

### **To Start the Project:**
```bash
npm start               # Runs both frontend + backend
```

### **To Populate Database:**
```bash
cd server
node seed.js           # Run seeding script
```

### **To View Database:**
```bash
cd server/storage
sqlite3 database.sqlite
.tables                # List all tables
SELECT * FROM resources;  # View resources
```

### **Frontend URL:**
`http://localhost:5173`

### **Backend URL:**
`http://localhost:3000`

---

## ✅ Summary

| File | Purpose | Database Connected? |
|------|---------|-------------------|
| **server/index.js** | API server with all endpoints | ✅ Yes (all endpoints) |
| **server/db.js** | Database initialization | ✅ Yes (creates schema) |
| **server/seed.js** | Populate test data | ✅ Yes (inserts data) |
| **IncidentsPage.jsx** | Video/incident management | ✅ Yes (/api/history) |
| **ResourcesPage.jsx** | Fleet tracking | ✅ Yes (/api/resources) |
| **DashboardPage.jsx** | Control center | ⚠️ Partial (ambulances) |
| **AnalyticsPage.jsx** | Charts and metrics | ❌ Not yet (use /api/analytics) |

---

**🎉 You now have a complete understanding of every file in the Road Raksha project!**
