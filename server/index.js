const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const { scrapeJustDial } = require('./scraper');


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

        // Create Ambulances Table
        db.run(`CREATE TABLE IF NOT EXISTS ambulances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service_name TEXT,
            driver_name TEXT,
            contact_number TEXT,
            address TEXT,
            latitude REAL,
            longitude REAL,
            current_speed INTEGER,
            status TEXT, -- 'moving', 'standby', 'on_call'
            heading REAL,
            last_updated DATETIME,
            scrape_session_id TEXT
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




// Base Location (New Delhi)
// No Default Location - Client Must Provide
const BASE_LAT = null;
const BASE_LNG = null;

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
        id: el.id.toString(),
        name: el.tags?.name || "Unnamed Hospital",
        location: { // UI expects object for coordinates
            lat: el.lat || el.center?.lat,
            lng: el.lon || el.center?.lon
        },
        // Enriched Fields (Mocked for UI demo as OSM doesn't have live beds)
        status: Math.random() > 0.3 ? 'Open' : 'Busy',
        beds: `${Math.floor(Math.random() * 20)}/${Math.floor(Math.random() * 50) + 20}`,
        type: el.tags?.healthcare || "General Hospital",
        trauma: "Level 1"
    }));
};
// Removed stray top-level async call; fetchRoute now handles its own requests

// --- 1. Hospitals Logic ---


// Initialize Ambulances (Load from DB or Mock)
const initializeAmbulances = (centerLat, centerLng) => {
    return new Promise((resolve, reject) => {
        // 1. Try to load key from DB
        db.all("SELECT * FROM ambulances", [], (err, rows) => {
            if (err) {
                console.error("DB Error:", err);
                return resolve(); // Resolve anyway to avoid hanging
            }

            if (rows && rows.length > 0) {
                console.log(`Loaded ${rows.length} ambulances from DB.`);
                ambulances = rows.map(row => ({
                    id: row.id.toString(),
                    service_name: row.service_name,
                    driverName: row.driver_name,
                    contact_number: row.contact_number,
                    address: row.address,
                    location: { lat: row.latitude, lng: row.longitude },
                    speed: row.current_speed,
                    status: row.status || 'moving',
                    heading: row.heading || 0,
                    lastUpdated: row.last_updated,
                    // Simulation State
                    route: [],
                    routeIndex: 0,
                    destination: null,
                    isHalted: row.status === 'standby',
                    haltTimer: 0
                }));

                // Restart routes for moving ones
                ambulances.forEach(amb => {
                    if (amb.status !== 'standby') {
                        assignNewRoute(amb, amb.location.lat, amb.location.lng);
                    }
                });
            } else {
                console.log("DB Empty. Waiting for Client to Scrape...");
                ambulances = [];
            }
            resolve();
        });
    });
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
        // --- Status State Machine ---
        // Standby (Green) <-> Moving (Blue) <-> On Call (Red, triggered by incident)

        // Random transition for simulation: Standby -> Moving (1% chance)
        if (amb.status === 'standby' && Math.random() < 0.005) {
            amb.status = 'moving';
            amb.isHalted = false;
            amb.speed = Math.floor(getRandom(20, 60));
            assignNewRoute(amb, amb.location.lat, amb.location.lng);
        }

        // Moving -> Standby (0.5% chance)
        if (amb.status === 'moving' && Math.random() < 0.005) {
            amb.status = 'standby';
            amb.isHalted = true;
            amb.speed = 0;
            amb.route = [];
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

            // Calc Heading
            const angle = Math.atan2(dLng, dLat) * 180 / Math.PI;
            amb.heading = angle;

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

    // Valid DB persistence: Update every 5 seconds (approx 1 in 3 calls if interval is 2s)
    // Or just simple check:
    if (Math.random() < 0.3) {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const stmt = db.prepare("UPDATE ambulances SET latitude = ?, longitude = ?, current_speed = ?, status = ?, heading = ?, last_updated = ? WHERE id = ?");
            ambulances.forEach(amb => {
                // If ID is numeric (from DB) use it, else skip
                if (parseInt(amb.id)) {
                    stmt.run(amb.location.lat, amb.location.lng, amb.speed, amb.status, amb.heading, amb.lastUpdated, amb.id);
                }
            });
            stmt.finalize();
            db.run("COMMIT");
        });
    }

    lastUpdate = now;
};

// ... existing helper functions ...

// Initialize once with default
initializeAmbulances(BASE_LAT, BASE_LNG);

// --- API Endpoints ---

// NEW: Get Hospitals (fetch from Overpass API)
app.get('/api/hospitals', async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = parseFloat(req.query.radius) || 5; // km

    if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ success: false, error: "Missing lat/lng parameters" });
    }
    try {
        const data = await fetchHospitals(lat, lng, radius);
        res.json({ success: true, count: data.length, data });
    } catch (e) {
        console.error('Failed to fetch hospitals', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// NEW: Trigger Scrape
app.post('/api/scrape', async (req, res) => {
    const { lat, lng } = req.body;

    const searchLat = lat;
    const searchLng = lng;

    if (!searchLat || !searchLng) {
        return res.status(400).json({ success: false, error: "Missing lat/lng for scraping" });
    }

    try {
        console.log(`Starting Scrape for ${searchLat}, ${searchLng}...`);

        // 1. Scrape Data
        const { city, ambulances: scrapedData } = await scrapeJustDial(searchLat, searchLng);

        if (!scrapedData || scrapedData.length === 0) {
            return res.json({ success: false, message: "No ambulances found during scrape." });
        }

        // 2. Clear Old Data (optional: or just clear for this city?)
        // For this project, we replace the fleet.
        await new Promise((resolve) => db.run("DELETE FROM ambulances", resolve));

        // 3. Insert New Data
        const stmt = db.prepare(`INSERT INTO ambulances (
            service_name, driver_name, contact_number, address,
            latitude, longitude, current_speed, status, heading, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        // Generate Random Initial Positions around the City Center
        // We use the searchLat/Lng as the center
        ambulances = []; // Clear in-memory array

        const now = new Date().toISOString();

        scrapedData.forEach(amb => {
            // Random Pos within ~10km (0.1 deg)
            const rLat = parseFloat(searchLat) + (Math.random() - 0.5) * 0.15;
            const rLng = parseFloat(searchLng) + (Math.random() - 0.5) * 0.15;

            // Random Status
            const rand = Math.random();
            let status = 'moving';
            let speed = Math.floor(Math.random() * 40) + 20; // 20-60
            if (rand < 0.3) {
                status = 'standby';
                speed = 0;
            } else if (rand > 0.9) {
                status = 'on_call';
                speed = 60 + Math.floor(Math.random() * 20); // 60-80
            }

            const heading = Math.floor(Math.random() * 360);

            // Add to DB
            stmt.run(
                amb.service_name,
                amb.driver_name || "Unknown Driver",
                amb.contact_number,
                amb.address,
                rLat,
                rLng,
                speed,
                status,
                heading,
                now
            );

            // Add to In-Memory (for simulation loop)
            ambulances.push({
                id: `AMB-${Math.floor(Math.random() * 10000)}`, // Temp ID until we reload from DB or just use this
                // We should really reload from DB to get the real IDs, but for speed we construct:
                service_name: amb.service_name,
                driverName: amb.driver_name || "Unknown Driver", // mapping to old prop name 'driverName' for frontend compatibility?
                // Frontend expects: id, driverName, status, speed, location, etc.
                // We need to map the new schema to the old object structure if we want to preserve frontend compat perfectly.
                // Or update frontend.
                // Let's map it:
                driverName: amb.driver_name || "Unknown Driver",
                contact_number: amb.contact_number,
                status: status,
                speed: speed,
                location: { lat: rLat, lng: rLng },
                heading: heading,
                destination: null,
                route: [],
                routeIndex: 0,
                isHalted: status === 'standby'
            });
        });

        stmt.finalize();

        res.json({ success: true, count: scrapedData.length, city, message: `Scraped ${scrapedData.length} ambulances` });

    } catch (e) {
        console.error("Scrape Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 1. Get Ambulances (Existing)
app.get('/api/ambulances', async (req, res) => {
    // ... same logic ...
    const { lat, lng } = req.query;

    const centerLat = parseFloat(lat);
    const centerLng = parseFloat(lng);

    // Require Location
    if (isNaN(centerLat) || isNaN(centerLng)) {
        return res.status(400).json({ success: false, error: "Location required" });
    }

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
        await initializeAmbulances(centerLat, centerLng);
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
