const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use('/storage', express.static(path.join(__dirname, 'storage/videos')));

// Database & Storage Setup
const db = require('./db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'storage/videos');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });


// Helper to get random number between min and max
const getRandom = (min, max) => Math.random() * (max - min) + min;

// Helper to get random item from array
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Mock Data Sources
const driverNames = [
    "Rahul Singh", "Vikram Malhotra", "Amit Kumar", "Suresh Raina",
    "Chandu Model", "Anjali Gupta", "Rohan Das", "Karan Johar",
    "Sneha Reddy", "Arjun Kapoor"
];

const statuses = ["Available", "En Route", "Busy"];

// Base Location (New Delhi)
const BASE_LAT = 28.6139;
const BASE_LNG = 77.2090;

// STATEFUL DATA
let ambulances = [];
let lastUpdate = Date.now();

// OSRM API Helper
const fetchRoute = async (startLat, startLng, endLat, endLng) => {
    try {
        const url = `http://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
        const response = await axios.get(url);
        if (response.data.routes && response.data.routes.length > 0) {
            return response.data.routes[0].geometry.coordinates.map(coord => ({
                lat: coord[1],
                lng: coord[0]
            }));
        }
    } catch (error) {
        console.error("OSRM Error:", error.message);
    }
    return null;
};

// Snap to nearest road helper with timeout
const snapToRoad = async (lat, lng, timeoutMs = 1000) => {
    try {
        const url = `http://router.project-osrm.org/nearest/v1/driving/${lng},${lat}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await axios.get(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (response.data.waypoints && response.data.waypoints.length > 0) {
            const location = response.data.waypoints[0].location;
            return { lat: location[1], lng: location[0] };
        }
    } catch (error) {
        if (error.name === 'CanceledError' || error.code === 'ECONNABORTED') {
            console.warn("OSRM Nearest timeout, using original coordinates");
        } else {
            console.error("OSRM Nearest Error:", error.message);
        }
    }
    // Fallback to original coordinates
    return { lat, lng };
};

// Initialize Ambulances (non-blocking)
const initializeAmbulances = (centerLat, centerLng) => {
    ambulances = [];

    // Create ambulances synchronously first with approximate positions
    for (let i = 1; i <= 10; i++) {
        const id = `AMB${i.toString().padStart(3, '0')}`;

        // Start nearby - Random buffer
        const startLat = parseFloat(centerLat) + getRandom(-0.02, 0.02);
        const startLng = parseFloat(centerLng) + getRandom(-0.02, 0.02);

        const amb = {
            id: id,
            driverName: driverNames[i - 1],
            status: getRandomItem(statuses),
            speed: Math.floor(getRandom(30, 60)), // km/h
            location: { lat: startLat, lng: startLng },
            lastUpdated: new Date().toISOString(),
            route: [],
            routeIndex: 0,
            destination: null
        };

        ambulances.push(amb);
    }

    // Then snap to roads asynchronously without blocking
    ambulances.forEach(async (amb) => {
        try {
            const snapped = await snapToRoad(amb.location.lat, amb.location.lng);
            amb.location.lat = snapped.lat;
            amb.location.lng = snapped.lng;

            // Assign initial route after snapping
            assignNewRoute(amb, centerLat, centerLng);
        } catch (error) {
            console.error(`Failed to snap ambulance ${amb.id}:`, error.message);
            // Assign route with original position
            assignNewRoute(amb, centerLat, centerLng);
        }
    });
};

const assignNewRoute = async (amb, centerLat, centerLng) => {
    // Pick a random destination within range
    // We don't strictly need to snap destination because fetchRoute will snap the *end* point of the route automatically.
    // But generating a random point close to roads helps.
    const destLat = parseFloat(centerLat) + getRandom(-0.03, 0.03);
    const destLng = parseFloat(centerLng) + getRandom(-0.03, 0.03);

    const route = await fetchRoute(amb.location.lat, amb.location.lng, destLat, destLng);

    if (route) {
        amb.route = route;
        amb.routeIndex = 0;
        // The actual destination is the last point of the route (snapped)
        const actualDest = route[route.length - 1];
        amb.destination = { lat: actualDest.lat, lng: actualDest.lng };
    }
};

// Update Ambulance Positions
const updateAmbulances = () => {
    const now = Date.now();
    // Limit delta time to avoid huge jumps if server sleeps
    const deltaTime = Math.min((now - lastUpdate) / 1000, 2.0);

    ambulances.forEach(async (amb) => {
        if (!amb.route || amb.route.length === 0) return;

        // Calculate distance to move: speed (km/h) -> m/s * time
        const speedMps = amb.speed / 3.6;
        const distToMove = speedMps * deltaTime; // meters

        // Simple movement: jump to next point if close enough
        // In a real app, we'd interpolate. Here we just advance index based on speed.
        // Approx: 1 degree ~ 111km. 0.0001 deg ~ 11 meters.
        // Let's just advance 1 point every X ticks based on speed for simplicity, 
        // or better: calculate distance to next point.

        if (amb.routeIndex < amb.route.length - 1) {
            const nextPoint = amb.route[amb.routeIndex + 1];
            const currPoint = amb.location;

            // Distance to next point (Haversine or simple Euclidean for short dist)
            const dLat = nextPoint.lat - currPoint.lat;
            const dLng = nextPoint.lng - currPoint.lng;
            const distToNext = Math.sqrt(dLat * dLat + dLng * dLng) * 111000; // meters

            if (distToMove >= distToNext) {
                // Reached next point, move there
                amb.location = nextPoint;
                amb.routeIndex++;
            } else {
                // Move towards next point
                const ratio = distToMove / distToNext;
                amb.location.lat += dLat * ratio;
                amb.location.lng += dLng * ratio;
            }
        } else {
            // Reached destination, get new route
            // We can't await here easily in forEach, but it's fine if it pauses briefly
            // We'll just clear route and let the next tick pick it up or do it now
            amb.route = [];
            // Use current location as center for next random point to keep them wandering
            assignNewRoute(amb, amb.location.lat, amb.location.lng);
        }

        amb.lastUpdated = new Date().toISOString();
    });

    lastUpdate = now;
};

// Initialize once with default
// --- Local Storage API Endpoints ---

// Upload Video
app.post('/api/upload', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { originalname, filename, path: filePath, size } = req.file;

    const sql = `INSERT INTO videos (filename, original_name, path, size) VALUES (?, ?, ?, ?)`;
    db.run(sql, [filename, originalname, filePath, size], function (err) {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({
            success: true,
            message: 'Video uploaded successfully',
            videoId: this.lastID,
            file: req.file
        });
    });
});

// Save Analysis/Alert
app.post('/api/analysis', (req, res) => {
    const { videoId, incidentType, confidence, details } = req.body;

    const sql = `INSERT INTO analysis_logs (video_id, incident_type, confidence, details) VALUES (?, ?, ?, ?)`;
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details;

    db.run(sql, [videoId, incidentType, confidence, detailsStr], function (err) {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, logId: this.lastID });
    });
});

// Get All Videos/History
app.get('/api/history', (req, res) => {
    const sql = `
        SELECT v.id, v.filename, v.original_name, v.created_at as video_date, 
               l.incident_type, l.confidence, l.details, l.created_at as alert_date
        FROM videos v
        LEFT JOIN analysis_logs l ON v.id = l.video_id
        ORDER BY v.created_at DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, data: rows });
    });
});

// ============================================
// INCIDENT MANAGEMENT ENDPOINTS
// ============================================

// Create new incident
app.post('/api/incidents', (req, res) => {
    const { incident_type, severity, location_lat, location_lng, location_address, description, reporter_name, reporter_contact } = req.body;

    const sql = `INSERT INTO incidents 
        (incident_type, severity, location_lat, location_lng, location_address, description, reporter_name, reporter_contact) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [incident_type, severity, location_lat, location_lng, location_address, description, reporter_name, reporter_contact], function (err) {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, incidentId: this.lastID });
    });
});

// Get all incidents
app.get('/api/incidents', (req, res) => {
    const { status, severity } = req.query;

    let sql = `SELECT * FROM incidents WHERE 1=1`;
    const params = [];

    if (status) {
        sql += ` AND status = ?`;
        params.push(status);
    }
    if (severity) {
        sql += ` AND severity = ?`;
        params.push(severity);
    }

    sql += ` ORDER BY created_at DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, data: rows });
    });
});

// Get single incident
app.get('/api/incidents/:id', (req, res) => {
    const sql = `SELECT * FROM incidents WHERE id = ?`;
    db.get(sql, [req.params.id], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        if (!row) {
            return res.status(404).json({ success: false, error: 'Incident not found' });
        }
        res.json({ success: true, data: row });
    });
});

// Update incident
app.put('/api/incidents/:id', (req, res) => {
    const { status, severity, description, resolved_at } = req.body;

    const sql = `UPDATE incidents SET status = ?, severity = ?, description = ?, resolved_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

    db.run(sql, [status, severity, description, resolved_at, req.params.id], function (err) {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, changes: this.changes });
    });
});

// ============================================
// RESOURCE MANAGEMENT ENDPOINTS
// ============================================

// Get all resources
app.get('/api/resources', (req, res) => {
    const { type, status } = req.query;

    let sql = `SELECT * FROM resources WHERE 1=1`;
    const params = [];

    if (type) {
        sql += ` AND type = ?`;
        params.push(type);
    }
    if (status) {
        sql += ` AND status = ?`;
        params.push(status);
    }

    sql += ` ORDER BY resource_id`;

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, count: rows.length, data: rows });
    });
});

// Update resource status/location
app.put('/api/resources/:id', (req, res) => {
    const { status, battery_level, fuel_level, current_location_lat, current_location_lng, location_name } = req.body;

    const sql = `UPDATE resources 
        SET status = ?, battery_level = ?, fuel_level = ?, 
            current_location_lat = ?, current_location_lng = ?, location_name = ?,
            last_updated = CURRENT_TIMESTAMP
        WHERE resource_id = ?`;

    db.run(sql, [status, battery_level, fuel_level, current_location_lat, current_location_lng, location_name, req.params.id], function (err) {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, changes: this.changes });
    });
});

// Add new resource
app.post('/api/resources', (req, res) => {
    const { resource_id, type, driver_name, status, battery_level, fuel_level, current_location_lat, current_location_lng, location_name } = req.body;

    const sql = `INSERT INTO resources 
        (resource_id, type, driver_name, status, battery_level, fuel_level, current_location_lat, current_location_lng, location_name) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [resource_id, type, driver_name, status, battery_level, fuel_level, current_location_lat, current_location_lng, location_name], function (err) {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, resourceId: this.lastID });
    });
});

// ============================================
// DISPATCH MANAGEMENT ENDPOINTS
// ============================================

// Create dispatch
app.post('/api/dispatch', (req, res) => {
    const { incident_id, resource_id, driver_name, route_data, notes } = req.body;

    const sql = `INSERT INTO ambulance_dispatches 
        (incident_id, resource_id, driver_name, route_data, notes) 
        VALUES (?, ?, ?, ?, ?)`;

    db.run(sql, [incident_id, resource_id, driver_name, route_data, notes], function (err) {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        // Update resource status
        db.run(`UPDATE resources SET status = 'On Mission' WHERE resource_id = ?`, [resource_id]);

        res.json({ success: true, dispatchId: this.lastID });
    });
});

// Get all dispatches
app.get('/api/dispatch', (req, res) => {
    const sql = `
        SELECT d.*, i.incident_type, i.severity, i.location_address 
        FROM ambulance_dispatches d
        LEFT JOIN incidents i ON d.incident_id = i.id
        ORDER BY d.dispatch_time DESC
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, data: rows });
    });
});

// Update dispatch status
app.put('/api/dispatch/:id', (req, res) => {
    const { status, arrival_time, completion_time, notes } = req.body;

    const sql = `UPDATE ambulance_dispatches 
        SET status = ?, arrival_time = ?, completion_time = ?, notes = ?
        WHERE id = ?`;

    db.run(sql, [status, arrival_time, completion_time, notes, req.params.id], function (err) {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        // If completed, update resource status
        if (status === 'Completed') {
            db.get(`SELECT resource_id FROM ambulance_dispatches WHERE id = ?`, [req.params.id], (err, row) => {
                if (row) {
                    db.run(`UPDATE resources SET status = 'Available' WHERE resource_id = ?`, [row.resource_id]);
                }
            });
        }

        res.json({ success: true, changes: this.changes });
    });
});

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

// Get dashboard summary
app.get('/api/analytics/summary', (req, res) => {
    const queries = {
        totalIncidents: `SELECT COUNT(*) as count FROM incidents`,
        activeIncidents: `SELECT COUNT(*) as count FROM incidents WHERE status != 'Resolved'`,
        totalResources: `SELECT COUNT(*) as count FROM resources`,
        availableResources: `SELECT COUNT(*) as count FROM resources WHERE status = 'Available'`,
        activeDispatches: `SELECT COUNT(*) as count FROM ambulance_dispatches WHERE status IN ('Dispatched', 'En Route')`,
    };

    const summary = {};
    let completed = 0;
    const total = Object.keys(queries).length;

    Object.keys(queries).forEach((key) => {
        db.get(queries[key], [], (err, row) => {
            if (!err) {
                summary[key] = row.count || 0;
            }
            completed++;

            if (completed === total) {
                res.json({ success: true, data: summary });
            }
        });
    });
});

// Get metrics/trends
app.get('/api/analytics/trends', (req, res) => {
    const sql = `SELECT * FROM metrics ORDER BY recorded_at DESC LIMIT 100`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, data: rows });
    });
});

initializeAmbulances(BASE_LAT, BASE_LNG);

// API Endpoint
app.get('/api/ambulances', (req, res) => {
    const { lat, lng } = req.query;

    const centerLat = parseFloat(lat) || BASE_LAT;
    const centerLng = parseFloat(lng) || BASE_LNG;

    // Check if we need to re-initialize (if empty OR if requested location is far from current cluster)
    let shouldReinit = ambulances.length === 0;

    if (!shouldReinit && lat && lng) {
        // Check distance from first ambulance
        const dist = Math.sqrt(
            Math.pow(ambulances[0].location.lat - centerLat, 2) +
            Math.pow(ambulances[0].location.lng - centerLng, 2)
        );

        if (dist > 0.1) {
            shouldReinit = true;
            console.log("Distance too large, triggering respawn.");
        }
    }

    if (shouldReinit) {
        console.log(`Spawning ambulances at ${centerLat}, ${centerLng}`);
        initializeAmbulances(centerLat, centerLng);
    }

    // Update positions before sending
    updateAmbulances();

    res.json({
        success: true,
        count: ambulances.length,
        timestamp: new Date().toISOString(),
        data: ambulances
    });
});

app.listen(PORT, () => {
    console.log(`Ambulance Server running on http://localhost:${PORT}`);
});
