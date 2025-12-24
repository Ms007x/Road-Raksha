const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;

// Initialize Database
const db = new sqlite3.Database('./road_raksha.db', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            severity TEXT,
            location TEXT,
            status TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            hospital TEXT
        )`);
        // Ensure hospital column exists for older DBs
        db.run(`ALTER TABLE incidents ADD COLUMN hospital TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding hospital column:', err.message);
            }
        });
    }
});

app.use(cors());
app.use(express.json());
// Initialize hospitals on server start
// fetchHospitals will be called after BASE_LAT is defined if needed

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
let hospitals = [];
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

// Fetch nearby hospitals using Overpass API
const fetchHospitals = async (centerLat, centerLng, radiusKm = 5) => {
    const query = `
        [out:json];
        (
            node["amenity"="hospital"](around:${radiusKm * 1000},${centerLat},${centerLng});
            way["amenity"="hospital"](around:${radiusKm * 1000},${centerLat},${centerLng});
            relation["amenity"="hospital"](around:${radiusKm * 1000},${centerLat},${centerLng});
        );
        out center;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const response = await axios.get(url);
    const elements = response.data.elements || [];
    return elements.map(el => ({
        id: el.id,
        name: el.tags?.name || "Unnamed Hospital",
        lat: el.lat || el.center?.lat,
        lng: el.lon || el.center?.lon
    }));
};
// Removed stray top-level async call; fetchRoute now handles its own requests

// --- 1. Hospitals Logic ---


// Initialize Ambulances with smarter placement
const initializeAmbulances = async (centerLat, centerLng) => {
    ambulances = [];
    console.log(`Initializing Ambulances around ${centerLat}, ${centerLng}`);
    for (let i = 1; i <= 10; i++) {
        const id = `AMB${i.toString().padStart(3, '0')}`;

        // 1. Generate random point in 50km radius
        const randLat = parseFloat(centerLat) + getRandom(-0.45, 0.45);
        const randLng = parseFloat(centerLng) + getRandom(-0.45, 0.45);

        // 2. Validate "Not in water" by snapping to nearest road via OSRM
        // We do this by asking for a route from/to the SAME point. OSRM snaps to nearest segment.
        let startLat = randLat;
        let startLng = randLng;

        try {
            // Tiny route just to get snapped coordinate
            const snapRoute = await fetchRoute(randLat, randLng, randLat + 0.001, randLng + 0.001);
            if (snapRoute && snapRoute.length > 0) {
                // Use the first valid road coordinate
                startLat = snapRoute[0].lat;
                startLng = snapRoute[0].lng;
            }
        } catch (e) {
            console.log("Snap failed, using random");
        }

        const amb = {
            id: id,
            driverName: driverNames[i - 1],
            status: getRandomItem(statuses),
            // Start either moving or halted
            speed: Math.random() > 0.3 ? Math.floor(getRandom(30, 80)) : 0,
            location: { lat: startLat, lng: startLng },
            lastUpdated: new Date().toISOString(),
            route: [],
            routeIndex: 0,
            destination: null,
            isHalted: false,
            haltTimer: 0 // frames until un-halt
        };

        if (amb.speed === 0) {
            amb.isHalted = true;
            amb.status = "Available"; // Halted usually means waiting
            amb.haltTimer = Math.floor(getRandom(50, 200)); // Wait for 50-200 ticks
        }

        ambulances.push(amb);

        // Assign initial route only if moving
        if (!amb.isHalted) {
            assignNewRoute(amb, startLat, startLng);
        }
    }
};

const assignNewRoute = async (amb, centerLat, centerLng) => {
    // Pick a random destination within range (relative to self to keep moving locally)
    const destLat = parseFloat(centerLat) + getRandom(-0.1, 0.1);
    const destLng = parseFloat(centerLng) + getRandom(-0.1, 0.1);

    const route = await fetchRoute(amb.location.lat, amb.location.lng, destLat, destLng);

    if (route) {
        amb.route = route;
        amb.routeIndex = 0;
        amb.destination = { lat: destLat, lng: destLng };
    }
};

// Update Ambulance Positions
const updateAmbulances = () => {
    const now = Date.now();
    const deltaTime = Math.min((now - lastUpdate) / 1000, 2.0);

    ambulances.forEach(async (amb) => {
        // --- Random Speed & Halt Logic ---
        // 10% chance to change speed behavior per tick if not busy
        if (amb.status !== 'Busy' && Math.random() < 0.1) {
            if (amb.isHalted) {
                // Maybe start moving?
                if (amb.haltTimer > 0) {
                    amb.haltTimer--;
                } else {
                    // Start moving
                    amb.isHalted = false;
                    amb.speed = Math.floor(getRandom(30, 80));
                    assignNewRoute(amb, amb.location.lat, amb.location.lng);
                }
            } else {
                // Maybe stop? (5% chance)
                if (Math.random() < 0.05) {
                    amb.isHalted = true;
                    amb.speed = 0;
                    amb.haltTimer = Math.floor(getRandom(50, 200));
                } else {
                    // Just change speed
                    amb.speed = Math.floor(getRandom(30, 80));
                }
            }
        }

        if (amb.isHalted || amb.speed === 0 || !amb.route || amb.route.length === 0) return;

        // Calculate distance to move: speed (km/h) -> m/s * time
        const speedMps = amb.speed / 3.6;
        const distToMove = speedMps * deltaTime; // meters

        if (amb.routeIndex < amb.route.length - 1) {
            const nextPoint = amb.route[amb.routeIndex + 1];
            const currPoint = amb.location;
            const dLat = nextPoint.lat - currPoint.lat;
            const dLng = nextPoint.lng - currPoint.lng;
            const distToNext = Math.sqrt(dLat * dLat + dLng * dLng) * 111000;

            if (distToMove >= distToNext) {
                amb.location = nextPoint;
                amb.routeIndex++;
            } else {
                const ratio = distToMove / distToNext;
                amb.location.lat += dLat * ratio;
                amb.location.lng += dLng * ratio;
            }
        } else {
            amb.route = [];
            assignNewRoute(amb, amb.location.lat, amb.location.lng); // Wander
        }
        amb.lastUpdated = new Date().toISOString();
    });

    lastUpdate = now;
};

// ... existing helper functions ...

// Initialize once with default
initializeAmbulances(BASE_LAT, BASE_LNG);

// --- API Endpoints ---

// NEW: Get Hospitals (fetch from Overpass API)
app.get('/api/hospitals', async (req, res) => {
    const lat = parseFloat(req.query.lat) || BASE_LAT;
    const lng = parseFloat(req.query.lng) || BASE_LNG;
    const radius = parseFloat(req.query.radius) || 5; // km
    try {
        const data = await fetchHospitals(lat, lng, radius);
        res.json({ success: true, count: data.length, data });
    } catch (e) {
        console.error('Failed to fetch hospitals', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 1. Get Ambulances (Existing)
app.get('/api/ambulances', (req, res) => {
    // ... same logic ...
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

        // If user moved > 0.5 degrees (~50km) from current fleet center, RESPAWN EVERYTHING
        if (dist > 0.5) {
            shouldReinit = true;
            console.log("User moved far. Triggering World Respawn.");
        }
    }

    if (shouldReinit) {
        // Respawn BOTH Ambulances and Hospitals at new location
        console.log(`Spawning World at ${centerLat}, ${centerLng}`);
        initializeAmbulances(centerLat, centerLng);
        // initializeHospitals(centerLat, centerLng); // Removed
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

// 2. Save New Incident (Automatic Dispatch)
app.post('/api/incidents', async (req, res) => {
    const { type, severity, location } = req.body;

    // 1. Find Nearest Available Ambulance
    let nearestAmb = null;
    let minDist = Infinity;

    // For now, use provided location if present, otherwise base location
    const incidentLat = location?.lat || BASE_LAT;
    const incidentLng = location?.lng || BASE_LNG;

    ambulances.forEach(amb => {
        if (amb.status === 'Available') {
            const d = Math.sqrt(
                Math.pow(amb.location.lat - incidentLat, 2) +
                Math.pow(amb.location.lng - incidentLng, 2)
            );
            if (d < minDist) {
                minDist = d;
                nearestAmb = amb;
            }
        }
    });

    // 2. Find Nearest Hospital (ensure hospitals list is populated)
    if (hospitals.length === 0) {
        // Populate hospitals around incident location
        try {
            hospitals = await fetchHospitals(incidentLat, incidentLng, 5);
        } catch (e) {
            console.error('Failed to fetch hospitals for incident', e);
        }
    }
    let nearestHospital = null;
    let minHospDist = Infinity;
    hospitals.forEach(hos => {
        const d = Math.sqrt(
            Math.pow(hos.lat - incidentLat, 2) +
            Math.pow(hos.lng - incidentLng, 2)
        );
        if (d < minHospDist) {
            minHospDist = d;
            nearestHospital = hos;
        }
    });

    let dispatchMsg = "No ambulances available";
    let status = "Pending";

    if (nearestAmb) {
        // Dispatch ambulance to incident
        nearestAmb.status = 'Busy';
        nearestAmb.destination = { lat: incidentLat, lng: incidentLng };
        nearestAmb.route = [];
        assignNewRoute(nearestAmb, incidentLat, incidentLng);
        status = "Dispatched";
        dispatchMsg = `Dispatched Ambulance ${nearestAmb.id} (${nearestAmb.driverName})`;
        console.log(dispatchMsg);
    }

    // 3. Save to DB (store hospital name if available)
    const sql = `INSERT INTO incidents (type, severity, location, status${nearestHospital ? ', hospital' : ''}) VALUES (?, ?, ?, ?${nearestHospital ? ', ?' : ''})`;
    const params = [type, severity, location, status];
    if (nearestHospital) params.push(nearestHospital.name);
    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            id: this.lastID,
            message: "Incident saved",
            dispatch: dispatchMsg,
            status: status,
            hospital: nearestHospital ? { id: nearestHospital.id, name: nearestHospital.name, lat: nearestHospital.lat, lng: nearestHospital.lng } : null
        });
    });
});

// 3. Get All Incidents (History)
app.get('/api/incidents', (req, res) => {
    const sql = `SELECT * FROM incidents ORDER BY timestamp DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, count: rows.length, data: rows });
    });
});

// 4. Get Analytics Stats
app.get('/api/analytics', (req, res) => {
    // Aggregate data for charts
    const sql = `SELECT * FROM incidents`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Process data for charts
        const severityCount = { Critical: 0, Major: 0, Minor: 0 };
        const hourlyCount = {};

        rows.forEach(row => {
            // Severity
            if (severityCount[row.severity] !== undefined) severityCount[row.severity]++;

            // Hourly
            const date = new Date(row.timestamp);
            const hour = date.getHours();
            hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
        });

        res.json({
            success: true,
            total: rows.length,
            severityData: [
                { name: 'Critical', value: severityCount.Critical, color: '#ef4444' },
                { name: 'Major', value: severityCount.Major, color: '#f97316' },
                { name: 'Minor', value: severityCount.Minor, color: '#eab308' }
            ],
            hourlyData: Object.entries(hourlyCount).map(([hour, count]) => ({
                name: `${hour}:00`,
                incidents: count
            })).sort((a, b) => parseInt(a.name) - parseInt(b.name))
        });
    });
});

app.listen(PORT, () => {
    console.log(`Ambulance Server running on http://localhost:${PORT}`);
});
