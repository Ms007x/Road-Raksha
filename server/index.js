require('dotenv').config({ path: '../.env' });
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
            hospital TEXT,
            latitude REAL,
            longitude REAL,
            confidence REAL
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
            scrape_session_id TEXT,
            assigned_incident_id INTEGER
        )`);

        // Create Cameras Table
        db.run(`CREATE TABLE IF NOT EXISTS cameras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            location_name TEXT,
            latitude REAL,
            longitude REAL,
            feed_url TEXT,
            status TEXT DEFAULT 'Active'
        )`);

        // Ensure assigned_incident_id column exists
        db.run(`ALTER TABLE ambulances ADD COLUMN assigned_incident_id INTEGER`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding assigned_incident_id column:', err.message);
            }
        });
        // Ensure hospital column exists for older DBs
        db.run(`ALTER TABLE incidents ADD COLUMN hospital TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding hospital column:', err.message);
            }
        });

        // Ensure latitude column exists
        db.run(`ALTER TABLE incidents ADD COLUMN latitude REAL`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding latitude column:', err.message);
            }
        });

        // Ensure longitude column exists
        db.run(`ALTER TABLE incidents ADD COLUMN longitude REAL`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding longitude column:', err.message);
            }
        });

        // Ensure confidence column exists
        db.run(`ALTER TABLE incidents ADD COLUMN confidence REAL`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding confidence column:', err.message);
            }
        });

        // Ensure assigned_ambulance column exists for history
        db.run(`ALTER TABLE incidents ADD COLUMN assigned_ambulance TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding assigned_ambulance column:', err.message);
            }
        });

        // Ensure reached_time column exists for history
        db.run(`ALTER TABLE incidents ADD COLUMN reached_time DATETIME`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding reached_time column:', err.message);
            }
        });

        // Ensure dispatched_at column exists for timeline
        db.run(`ALTER TABLE incidents ADD COLUMN dispatched_at DATETIME`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding dispatched_at column:', err.message);
            }
        });

        // Hospitals table — persists nearby hospitals across restarts
        db.run(`CREATE TABLE IF NOT EXISTS hospitals (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            type TEXT,
            status TEXT DEFAULT 'Open',
            fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error('Error creating hospitals table:', err.message);
        });

        // Settings table — persists user GPS across restarts so geofence is active from start
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )`, (err) => {
            if (err) { console.error('Error creating settings table:', err.message); return; }

            // Load last known user GPS into memory
            db.get(`SELECT value FROM settings WHERE key = 'user_location'`, (err, row) => {
                if (row) {
                    try {
                        const loc = JSON.parse(row.value);
                        if (loc && loc.lat && loc.lng) {
                            lastUserLocation = loc;
                            console.log(`📍 Geofence restored from DB: (${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}) — 40km boundary active`);

                            // Load hospitals from DB into memory
                            db.all(`SELECT * FROM hospitals`, [], (err, rows) => {
                                if (err || !rows || rows.length === 0) {
                                    console.log('🏥 No hospitals in DB — will fetch from Overpass on next location update.');
                                    // Proactively fetch now so dispatch works from startup
                                    fetchAndSaveHospitals(loc.lat, loc.lng);
                                    return;
                                }
                                hospitals = rows.map(r => ({
                                    id: r.id,
                                    name: r.name,
                                    location: { lat: r.latitude, lng: r.longitude },
                                    status: r.status || 'Open',
                                    type: r.type || 'General Hospital'
                                }));
                                console.log(`🏥 Loaded ${hospitals.length} hospitals from DB into memory.`);
                            });
                        }
                    } catch (e) { /* ignore malformed */ }
                } else {
                    console.log('⚠️  No saved user location found. Geofence will activate when browser connects.');
                }
            });
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

// Calculate distance using Haversine formula (in km)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
};




// No Default Location - Client Must Provide
// Default Location (Hitech City, Hyderabad area)
const BASE_LAT = 17.4483;
const BASE_LNG = 78.3915;

// STATEFUL DATA
let ambulances = [];
let hospitals = [];
let globalRoadPoints = []; // Stores OSM road nodes for patrol routing
let lastUpdate = Date.now();
let ambulanceServicesEnabled = true; // Toggle for ambulance services
let lastUserLocation = null; // Real GPS from browser, updated every 2s via /api/ambulances

// ── Route-fetch concurrency limiter ──────────────────────────────────────────
// Prevents all ambulances hitting OSRM simultaneously and blocking the event loop
let _activeRouteFetches = 0;
const MAX_CONCURRENT_ROUTE_FETCHES = 3;
const withRouteConcurrencyLimit = (fn) => {
    return new Promise((resolve, reject) => {
        const attempt = () => {
            if (_activeRouteFetches < MAX_CONCURRENT_ROUTE_FETCHES) {
                _activeRouteFetches++;
                Promise.resolve(fn())
                    .then(resolve, reject)
                    .finally(() => { _activeRouteFetches--; });
            } else {
                setTimeout(attempt, 200 + Math.random() * 300);
            }
        };
        attempt();
    });
};
// ─────────────────────────────────────────────────────────────────────────────


const GRAPHHOPPER_API_KEY = process.env.GRAPHHOPPER_API_KEY;

// OSRM Public API - Robust Road Routing (No Key Required)
const fetchOSRMRoute = async (startLat, startLng, endLat, endLng) => {
    try {
        // Note: OSRM uses [lng,lat] order in coordinates pair
        const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
        const response = await axios.get(url, {
            timeout: 10000,
            headers: { 'User-Agent': 'Road-Raksha-App/1.0' }
        });

        if (response.data.routes && response.data.routes.length > 0) {
            const coordinates = response.data.routes[0].geometry.coordinates;
            return coordinates.map(coord => ({
                lat: coord[1],
                lng: coord[0]
            }));
        }
    } catch (error) {
        console.warn('OSRM Routing Error:', error.message);
    }
    return null;
};

// GraphHopper Directions API - Road-Based Routing
const fetchRoadRoute = async (startLat, startLng, endLat, endLng) => {
    // Skip if ambulance services are disabled
    if (!ambulanceServicesEnabled) {
        return generateStraightLine(startLat, startLng, endLat, endLng);
    }

    // 1. Try GraphHopper first if API key is configured
    if (GRAPHHOPPER_API_KEY && GRAPHHOPPER_API_KEY !== 'your_graphhopper_api_key_here') {
        try {
            const url = `https://graphhopper.com/api/1/route?point=${startLat},${startLng}&point=${endLat},${endLng}&vehicle=car&locale=en&points_encoded=false&key=${GRAPHHOPPER_API_KEY}`;
            const response = await axios.get(url, { timeout: 5000 });

            if (response.data.paths && response.data.paths.length > 0) {
                const path = response.data.paths[0];
                if (path.points && path.points.coordinates) {
                    return path.points.coordinates.map(coord => ({
                        lat: coord[1],
                        lng: coord[0]
                    }));
                }
            }
        } catch (error) {
            // GraphHopper failed silently — fall through to OSRM
        }
    }

    // 2. Fallback to OSRM (Free, no key, very reliable)
    const osrmRoute = await fetchOSRMRoute(startLat, startLng, endLat, endLng);
    if (osrmRoute) {
        console.log("🛣️ Route fetched via OSRM Fallback");
        return osrmRoute;
    }

    // 3. Last Resort Fallback
    console.warn('⚠️ All road-routing services failed. Using straight-line fallback.');
    return generateStraightLine(startLat, startLng, endLat, endLng);
};

// Fallback: Straight Line Generator
const generateStraightLine = (startLat, startLng, endLat, endLng) => {
    const steps = 20;
    const route = [];
    for (let i = 0; i <= steps; i++) {
        route.push({
            lat: startLat + (endLat - startLat) * (i / steps),
            lng: startLng + (endLng - startLng) * (i / steps)
        });
    }
    return route;
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

// Fetch nearby road points using Overpass API
const fetchRoadPoints = async (centerLat, centerLng, radiusKm = 3) => {
    try {
        console.log(`🛣️ Fetching road points within ${radiusKm}km of ${centerLat}, ${centerLng}...`);
        const query = `
            [out:json];
            way["highway"](around:${radiusKm * 1000},${centerLat},${centerLng});
            (._;>;);
            out body;`;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        const response = await axios.get(url, { timeout: 15000 });
        const elements = response.data.elements || [];
        const nodes = elements.filter(el => el.type === 'node');
        globalRoadPoints = nodes.map(n => ({ lat: n.lat, lng: n.lon }));
        console.log(`✅ Found and stored ${globalRoadPoints.length} road nodes.`);
        return globalRoadPoints;
    } catch (err) {
        console.error("❌ Failed to fetch road points:", err.message);
        return globalRoadPoints; // Return whatever we had
    }
};

// --- 1. Hospitals Logic ---


// Initialize Ambulances (Load from DB or Mock)
// Initialize Ambulances (Load from DB or Mock)
const initializeAmbulances = (cLat, cLng) => {
    const centerLat = cLat || BASE_LAT;
    const centerLng = cLng || BASE_LNG;
    return new Promise((resolve, reject) => {
        // 1. Try to load from main ambulances table
        db.all("SELECT * FROM ambulances LIMIT 50", [], async (err, rows) => {
            if (err) {
                console.error("DB Error:", err);
                return resolve();
            }

            // Map loaded rows
            const loadedAmbulances = (rows || []).map((row, index) => ({
                id: row.id.toString(),
                service_name: row.service_name,
                driverName: row.driver_name,
                contact_number: row.contact_number,
                address: row.address,
                location: { lat: row.latitude, lng: row.longitude },
                speed: row.current_speed || 0,
                status: row.status || 'standby',
                heading: row.heading || 0,
                lastUpdated: row.last_updated,
                route: [],
                routeIndex: 0,
                destination: null,
                isHalted: row.status === 'standby',
                haltTimer: 0,
                assignedIncidentId: row.assigned_incident_id,
                showRoute: row.status === 'on_call',
                patrolDirection: index % 8 // 0-7: N, NE, E, SE, S, SW, W, NW
            }));

            // Merge with existing memory (priority to current memory if already exists)
            loadedAmbulances.forEach(loaded => {
                const existing = ambulances.find(a => a.id === loaded.id);
                if (!existing) {
                    ambulances.push(loaded);
                }
            });

            if (ambulances.length > 0) {
                console.log(`📡 Fleet State: ${ambulances.length} units active in memory.`);

                // Ensure minimum 10 ambulances by adding dummy ones if needed
                if (ambulances.length < 10) {
                    const needed = 10 - ambulances.length;
                    console.log(`⚠️ Fleet below minimum. Adding ${needed} dummy ambulances...`);
                    
                    const seedLat = lastUserLocation?.lat ?? centerLat;
                    const seedLng = lastUserLocation?.lng ?? centerLng;
                    
                    for (let i = 0; i < needed; i++) {
                        const dummyAmb = {
                            id: `dummy_${Date.now()}_${i}`,
                            service_name: `Emergency Unit ${ambulances.length + i + 1}`,
                            driverName: 'On Duty',
                            contact_number: '+91-000-000-0000',
                            address: 'City Emergency Response',
                            location: {
                                lat: seedLat + (Math.random() - 0.5) * 0.05,
                                lng: seedLng + (Math.random() - 0.5) * 0.05
                            },
                            speed: Math.random() > 0.4 ? Math.floor(Math.random() * 30) + 20 : 0,
                            status: Math.random() > 0.4 ? 'moving' : 'standby',
                            heading: Math.floor(Math.random() * 360),
                            lastUpdated: new Date().toISOString(),
                            route: [],
                            routeIndex: 0,
                            destination: null,
                            isHalted: Math.random() <= 0.4,
                            haltTimer: 0,
                            assignedIncidentId: null,
                            showRoute: false,
                            patrolDirection: (ambulances.length + i) % 8
                        };
                        ambulances.push(dummyAmb);
                    }
                    console.log(`✅ Fleet now has ${ambulances.length} units.`);
                }

                // Also fetch hospitals and road points for simulation use
                fetchHospitals(centerLat, centerLng, 10).then(hData => {
                    hospitals = hData;
                    console.log(`🏥 Loaded ${hospitals.length} hospitals for dispatch calculation.`);
                }).catch(err => console.error("Hosp fetch fail:", err.message));

                fetchRoadPoints(centerLat, centerLng, 3).catch(err => console.error("Road points fetch fail:", err.message));

                // Start/Resume routes
                ambulances.forEach(amb => {
                    if (amb.status === 'on_call' && amb.assignedIncidentId && (!amb.route || amb.route.length === 0)) {
                        amb.speed = 70; // Ensure speed for dispatch
                        amb.isHalted = false;
                        db.get("SELECT latitude, longitude FROM incidents WHERE id = ?", [amb.assignedIncidentId], (err, inc) => {
                            if (inc) {
                                console.log(`🔄 Resuming Dispatch for ${amb.service_name} -> Incident ${amb.assignedIncidentId}`);
                                assignNewRoute(amb, inc.latitude, inc.longitude, true);
                            }
                        });
                    } else if (amb.status === 'moving' && (!amb.route || amb.route.length === 0)) {
                        if (amb.speed === 0) amb.speed = 40;
                        assignNewRoute(amb, amb.location.lat, amb.location.lng, false);
                    }
                });
                resolve();
            } else {
                // 2. If completely empty, seed from scratch
                console.log("Ambulances table empty. Seeding from scratch...");
                fetchRoadPoints(centerLat, centerLng, 3).then(roadPoints => {
                    db.all("SELECT * FROM scraped_ambulances LIMIT 50", [], (err, sRows) => {
                        if (sRows && sRows.length > 0) {
                            // Ensure at least 10 ambulances
                            while (sRows.length < 10) {
                                sRows.push({...sRows[sRows.length % sRows.length]});
                            }
                            console.log(`Seeding ${sRows.length} units...`);
                            const now = new Date().toISOString();
                            const stmt = db.prepare(`INSERT INTO ambulances (
                                service_name, driver_name, contact_number, address,
                                latitude, longitude, current_speed, status, heading, last_updated
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

                            // ── GEOFENCE: use lastUserLocation as seed centre when available ──
                            const seedLat = lastUserLocation?.lat ?? parseFloat(centerLat);
                            const seedLng = lastUserLocation?.lng ?? parseFloat(centerLng);
                            const SEED_FENCE_KM = 38; // keep well within 40km boundary
                            const inFencePts = roadPoints.filter(pt =>
                                calculateDistance(seedLat, seedLng, pt.lat, pt.lng) <= SEED_FENCE_KM
                            );
                            const seedPool = inFencePts.length > 5 ? inFencePts : roadPoints;

                            sRows.forEach(row => {
                                let rLat, rLng;
                                if (seedPool.length > 5) {
                                    const pt = seedPool[Math.floor(Math.random() * seedPool.length)];
                                    rLat = pt.lat;
                                    rLng = pt.lng;
                                } else {
                                    rLat = seedLat + (Math.random() - 0.5) * 0.1;
                                    rLng = seedLng + (Math.random() - 0.5) * 0.1;
                                }
                                const status = Math.random() > 0.4 ? 'moving' : 'standby';
                                const speed = status === 'moving' ? Math.floor(Math.random() * 30) + 20 : 0;
                                const heading = Math.floor(Math.random() * 360);

                                stmt.run(row.name, "Available Now", row.contact, row.location, rLat, rLng, speed, status, heading, now);

                                // We don't push to memory here yet, we'll reload from DB in the next cycle or just push once
                            });
                            stmt.finalize();
                            // Reload to get DB IDs
                            setTimeout(() => initializeAmbulances(centerLat, centerLng), 200);
                            resolve();
                        } else {
                            // No scraped ambulances data - create 10 dummy ambulances directly
                            console.log("No scraped ambulances found. Creating 10 dummy units...");
                            const seedLat = lastUserLocation?.lat ?? parseFloat(centerLat);
                            const seedLng = lastUserLocation?.lng ?? parseFloat(centerLng);
                            const now = new Date().toISOString();
                            
                            for (let i = 0; i < 10; i++) {
                                const rLat = seedLat + (Math.random() - 0.5) * 0.05;
                                const rLng = seedLng + (Math.random() - 0.5) * 0.05;
                                const status = Math.random() > 0.4 ? 'moving' : 'standby';
                                const speed = status === 'moving' ? Math.floor(Math.random() * 30) + 20 : 0;
                                const heading = Math.floor(Math.random() * 360);
                                
                                db.run(`INSERT INTO ambulances (
                                    service_name, driver_name, contact_number, address,
                                    latitude, longitude, current_speed, status, heading, last_updated
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [`Emergency Unit ${i + 1}`, 'On Duty', '+91-000-000-0000', 'City Emergency Response', 
                                 rLat, rLng, speed, status, heading, now]);
                            }
                            
                            // Reload to get DB IDs
                            setTimeout(() => initializeAmbulances(centerLat, centerLng), 200);
                            resolve();
                        }
                    });
                }).catch(err => {
                    console.error("Seed failed:", err);
                    resolve();
                });
            }
        });
    });
};

const assignNewRoute = async (amb, targetLat, targetLng, isExact = true) => {
    let destLat, destLng;

    if (isExact) {
        // For missions/specific calls, use the exact target
        destLat = parseFloat(targetLat);
        destLng = parseFloat(targetLng);
    } else {
        // For patrols, pick a destination in the ambulance's assigned patrol direction
        const PATROL_FENCE_KM = 40;
        const fenceCentre = lastUserLocation || { lat: parseFloat(targetLat), lng: parseFloat(targetLng) };
        
        // Patrol direction angles (0-7): N, NE, E, SE, S, SW, W, NW
        const directionAngles = [0, 45, 90, 135, 180, 225, 270, 315];
        const directionAngle = directionAngles[amb.patrolDirection || 0];
        
        // Calculate target point in the patrol direction (5-15km out)
        const patrolDistanceKm = 5 + Math.random() * 10; // 5-15km patrol range
        const angleRad = (directionAngle * Math.PI) / 180;
        
        // Approximate conversion: 1 degree lat ≈ 111km, 1 degree lng ≈ 111km * cos(lat)
        const latOffset = (patrolDistanceKm * Math.cos(angleRad)) / 111;
        const lngOffset = (patrolDistanceKm * Math.sin(angleRad)) / (111 * Math.cos(fenceCentre.lat * Math.PI / 180));
        
        let patrolTargetLat = fenceCentre.lat + latOffset;
        let patrolTargetLng = fenceCentre.lng + lngOffset;
        
        // Ensure we stay within 40km geofence
        const distFromCenter = calculateDistance(fenceCentre.lat, fenceCentre.lng, patrolTargetLat, patrolTargetLng);
        if (distFromCenter > PATROL_FENCE_KM) {
            // Scale back to stay within fence
            const scale = PATROL_FENCE_KM / distFromCenter * 0.9;
            patrolTargetLat = fenceCentre.lat + latOffset * scale;
            patrolTargetLng = fenceCentre.lng + lngOffset * scale;
        }
        
        // Find nearest road point to the target location for realistic routing
        const inFenceRoadPoints = globalRoadPoints.filter(pt =>
            calculateDistance(fenceCentre.lat, fenceCentre.lng, pt.lat, pt.lng) <= PATROL_FENCE_KM
        );
        const patrolPool = inFenceRoadPoints.length > 5 ? inFenceRoadPoints : globalRoadPoints;
        
        if (patrolPool.length > 10) {
            // Find road point closest to our directional target
            let nearestRoadPoint = null;
            let minRoadDist = Infinity;
            patrolPool.forEach(pt => {
                const d = calculateDistance(patrolTargetLat, patrolTargetLng, pt.lat, pt.lng);
                if (d < minRoadDist) {
                    minRoadDist = d;
                    nearestRoadPoint = pt;
                }
            });
            
            if (nearestRoadPoint) {
                destLat = nearestRoadPoint.lat;
                destLng = nearestRoadPoint.lng;
            } else {
                destLat = patrolTargetLat;
                destLng = patrolTargetLng;
            }
        } else {
            destLat = patrolTargetLat;
            destLng = patrolTargetLng;
        }
    }

    if (amb.isCalculatingRoute) return;

    // STRICT: If already on a mission to the same place, and we have a route, DO NOT RECALCULATE
    if (amb.destination && Math.abs(amb.destination.lat - destLat) < 0.0001 && Math.abs(amb.destination.lng - destLng) < 0.0001) {
        if (amb.route && amb.route.length > 0) return;
    }

    amb.isCalculatingRoute = true;
    amb.route = []; // Clear old route while thinking
    amb.routeIndex = 0;

    // Only log route plans for on_call missions (not noisy patrol loops)
    if (isExact) {
        console.log(`🛣️ Dispatch Route: ${amb.service_name} → (${destLat.toFixed(4)}, ${destLng.toFixed(4)})`);
    }

    try {
        const route = await withRouteConcurrencyLimit(() =>
            fetchRoadRoute(amb.location.lat, amb.location.lng, destLat, destLng)
        );
        if (route && route.length > 0) {
            amb.route = route;
            amb.routeIndex = 0;
            amb.destination = { lat: destLat, lng: destLng };
            if (isExact) amb.isHalted = false;
        }
    } finally {
        amb.isCalculatingRoute = false;
    }
};

// Update Ambulance Positions
const updateAmbulances = () => {
    if (!ambulanceServicesEnabled) return;

    const now = Date.now();
    const deltaTime = Math.min((now - lastUpdate) / 1000, 2.0);
    lastUpdate = now;

    ambulances.forEach((amb) => {
        if (amb.isHalted || amb.speed === 0 || !amb.route || amb.route.length === 0) return;

        const speedMps = amb.speed / 3.6;
        const distToMove = speedMps * deltaTime;

        if (amb.routeIndex < amb.route.length - 1) {
            const nextPoint = amb.route[amb.routeIndex + 1];
            const currPoint = { ...amb.location };
            const dLat = nextPoint.lat - currPoint.lat;
            const dLng = nextPoint.lng - currPoint.lng;
            const distToNext = Math.sqrt(dLat * dLat + dLng * dLng) * 111000;

            const angle = Math.atan2(dLng, dLat) * 180 / Math.PI;
            amb.heading = angle;

            if (distToMove >= distToNext || distToNext < 0.1) {
                amb.location = { ...nextPoint };
                amb.routeIndex++;
            } else {
                const ratio = distToMove / distToNext;
                amb.location = {
                    lat: currPoint.lat + dLat * ratio,
                    lng: currPoint.lng + dLng * ratio
                };
            }
        } else {
            if (amb.status === 'on_call') {
                console.log(`✅ Ambulance ${amb.service_name} arrived at incident! Waiting 5s before hospital run...`);

                // Update incident status in DB
                if (amb.assignedIncidentId) {
                    db.run("UPDATE incidents SET status = 'Arrived', reached_time = CURRENT_TIMESTAMP WHERE id = ?", [amb.assignedIncidentId]);
                }

                // Stage 2: Wait at scene
                amb.isHalted = true;
                amb.speed = 0;
                amb.haltTimer = 5; // 5 seconds
                amb.status = 'at_incident';
            } else if (amb.status === 'to_hospital') {
                console.log(`🏥 Ambulance ${amb.service_name} arrived at Hospital!`);

                // Close the incident
                if (amb.assignedIncidentId) {
                    db.run("UPDATE incidents SET status = 'Closed' WHERE id = ?", [amb.assignedIncidentId]);
                    console.log(`✅ Incident ${amb.assignedIncidentId} marked as Closed.`);
                }

                amb.status = 'standby';
                amb.isHalted = true;
                amb.speed = 0;
                amb.route = [];
                amb.showRoute = false;
                delete amb.assignedIncidentId;
            } else {
                amb.route = [];
                assignNewRoute(amb, amb.location.lat, amb.location.lng, false);
            }
        }
        amb.lastUpdated = new Date().toISOString();
    });

    // Handle Timers and State Transitions for simulation
    ambulances.forEach(amb => {
        if (amb.status === 'at_incident' && amb.haltTimer > 0) {
            amb.haltTimer -= deltaTime;
            if (amb.haltTimer <= 0) {
                console.log(`🚑 5s wait done. Routing ${amb.service_name} to nearest hospital...`);

                const dispatchToHospital = () => {
                    if (hospitals.length === 0) {
                        console.warn(`🏥 No hospitals in memory! Returning ${amb.service_name} to standby.`);
                        amb.status = 'standby';
                        amb.isHalted = true;
                        amb.speed = 0;
                        amb.route = [];
                        amb.showRoute = false;
                        delete amb.assignedIncidentId;
                        return;
                    }

                    const localHospitals = hospitals.map(h => ({
                        ...h,
                        dist: calculateDistance(amb.location.lat, amb.location.lng, h.location.lat, h.location.lng)
                    })).sort((a, b) => a.dist - b.dist);

                    const nearestHosp = localHospitals[0];
                    console.log(`🏥 Nearest hospital: ${nearestHosp.name} — ${nearestHosp.dist.toFixed(2)}km away`);

                    if (nearestHosp && nearestHosp.dist <= 40) { // Expanded from 20km to 40km
                        console.log(`🚑 Transporting patient to ${nearestHosp.name} (${nearestHosp.dist.toFixed(1)}km)`);

                        // Update DB with hospital
                        if (amb.assignedIncidentId) {
                            db.run("UPDATE incidents SET hospital = ?, status = 'On Scene' WHERE id = ?", [nearestHosp.name, amb.assignedIncidentId]);
                        }

                        amb.status = 'to_hospital';
                        amb.isHalted = true; // keep halted UNTIL route arrives
                        amb.speed = 85;
                        amb.routeIndex = 0;
                        amb.route = [];
                        assignNewRoute(amb, nearestHosp.location.lat, nearestHosp.location.lng, true);
                    } else {
                        console.warn(`⚠️ No hospital within 40km (nearest: ${nearestHosp?.dist?.toFixed(1)}km). Returning unit to standby.`);
                        amb.status = 'standby';
                        amb.isHalted = true;
                        amb.speed = 0;
                        amb.route = [];
                        amb.showRoute = false;
                        delete amb.assignedIncidentId;
                    }
                };

                // If hospitals not yet loaded, try re-fetching first
                if (hospitals.length === 0 && lastUserLocation) {
                    console.log('🏥 Hospitals empty at dispatch time — fetching now...');
                    fetchAndSaveHospitals(lastUserLocation.lat, lastUserLocation.lng, 10)
                        .then(dispatchToHospital);
                } else {
                    dispatchToHospital();
                }
            }
        }
    });

    if (Math.random() < 0.1) {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const stmt = db.prepare("UPDATE ambulances SET latitude = ?, longitude = ?, current_speed = ?, status = ?, heading = ?, last_updated = ?, assigned_incident_id = ? WHERE id = ?");
            ambulances.forEach(amb => {
                if (parseInt(amb.id)) {
                    stmt.run(amb.location.lat, amb.location.lng, amb.speed, amb.status, amb.heading, amb.lastUpdated, amb.assignedIncidentId || null, amb.id);
                }
            });
            stmt.finalize();
            db.run("COMMIT");
        });
    }
};

const autoDispatchOrphans = async () => {
    if (ambulances.length === 0) return;

    // Only fetch incidents that definitely don't have an active mission in memory
    db.all("SELECT * FROM incidents WHERE status = 'Pending' OR status = 'Dispatched' LIMIT 10", [], async (err, rows) => {
        if (err || !rows || rows.length === 0) return;

        for (const inc of rows) {
            // Fix 2: Strictly check mission status to prevent auto-dispatch repetition
            // Check if ANY ambulance in memory is already covering this incident ID
            const isHandled = ambulances.some(a =>
                (a.assignedIncidentId && String(a.assignedIncidentId) === String(inc.id))
            );

            if (!isHandled) {
                const availableAmbulances = ambulances
                    .filter(amb => {
                        if (amb.status !== 'standby' && amb.status !== 'moving') return false;
                        const dist = calculateDistance(amb.location.lat, amb.location.lng, inc.latitude, inc.longitude);
                        return dist <= 40; // Only dispatch ambulances within 40km boundary
                    })
                    .map(amb => ({
                        id: amb.id,
                        distance: calculateDistance(amb.location.lat, amb.location.lng, inc.latitude, inc.longitude)
                    }))
                    .sort((a, b) => a.distance - b.distance);

                const bestMatch = availableAmbulances.length > 0 ? availableAmbulances[0] : null;
                if (bestMatch) {
                    const nearestAmb = ambulances.find(a => a.id === bestMatch.id);
                    console.log(`🚨 Dispatching: ${nearestAmb.service_name} to Incident ${inc.id}`);

                    nearestAmb.status = 'on_call';
                    nearestAmb.isHalted = false;
                    nearestAmb.speed = 75; // Slightly increased speed for dispatch
                    nearestAmb.showRoute = true;
                    nearestAmb.assignedIncidentId = inc.id;
                    nearestAmb.route = []; // Fix 1: Reset route state before new assignment
                    nearestAmb.routeIndex = 0;

                    await assignNewRoute(nearestAmb, inc.latitude, inc.longitude, true);

                    db.run("UPDATE incidents SET status = 'Dispatched', assigned_ambulance = ? WHERE id = ?", [nearestAmb.service_name, inc.id]);
                    db.run("UPDATE ambulances SET status = 'on_call', assigned_incident_id = ? WHERE id = ?", [inc.id, nearestAmb.id]);
                }
            }
            // Removed the `else if (!assignedAmb.route || assignedAmb.route.length === 0)` block
            // as the `isHandled` check now prevents re-dispatching to already assigned incidents.
            // If an assigned ambulance loses its route, it will be handled by the updateAmbulances loop
            // or a more specific re-routing logic if needed.
        }
    });
};

// Periodic Simulation (1 second)
setInterval(() => {
    // Random Simulation Transitions
    ambulances.forEach(amb => {
        if (amb.status === 'standby' && Math.random() < 0.01) {
            amb.status = 'moving';
            amb.isHalted = false;
            amb.speed = Math.floor(getRandom(20, 50));
            assignNewRoute(amb, amb.location.lat, amb.location.lng, false);
        } else if (amb.status === 'moving' && Math.random() < 0.01) {
            amb.status = 'standby';
            amb.isHalted = true;
            amb.speed = 0;
            amb.route = [];
        }
    });

    updateAmbulances();
    autoDispatchOrphans();
}, 1000);

// Clear stale ambulances from DB on startup so fresh ones are seeded at user's real location
db.run("DELETE FROM ambulances WHERE status != 'on_call'", (err) => {
    if (err) console.error('Error clearing stale ambulances:', err.message);
    else console.log('🧹 Cleared stale ambulances from DB. Will re-seed at user location.');
});

// Initialize once with default (will be re-seeded near user when they connect)
initializeAmbulances(BASE_LAT, BASE_LNG);

// Auto-expire stale incidents every 60 seconds (incidents stuck > 20 min get Closed)
setInterval(() => {
    db.run(
        `UPDATE incidents SET status = 'Closed'
         WHERE status IN ('Arrived', 'On Scene', 'Pending', 'Dispatched')
         AND datetime(timestamp) < datetime('now', '-20 minutes')`,
        (err) => { if (err) console.error('Auto-expire error:', err.message); }
    );
}, 60 * 1000);

// --- API Endpoints ---

// NEW: Get Hospitals (fetch from Overpass API)
// ── Helper: fetch hospitals from Overpass, save to DB and memory ──────────────
const fetchAndSaveHospitals = async (lat, lng, radiusKm = 10, attempt = 1) => {
    console.log(`🏥 Fetching hospitals within ${radiusKm}km of (${lat.toFixed(5)}, ${lng.toFixed(5)})... [attempt ${attempt}]`);
    try {
        const fetched = await fetchHospitals(lat, lng, radiusKm);
        let result = fetched;
        if (!result || result.length === 0) {
            console.warn('🏥 Overpass returned 0 hospitals. Retrying with 20km radius...');
            result = await fetchHospitals(lat, lng, 20);
        }

        if (!result || result.length === 0) {
            throw new Error('0 hospitals returned even with 20km radius');
        }

        hospitals = result;
        console.log(`🏥 Fetched ${hospitals.length} hospitals. Saving to DB...`);

        // Persist each hospital to DB (upsert)
        db.serialize(() => {
            const stmt = db.prepare(`
                INSERT INTO hospitals (id, name, latitude, longitude, type, status, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    latitude = excluded.latitude,
                    longitude = excluded.longitude,
                    type = excluded.type,
                    fetched_at = excluded.fetched_at
            `);
            hospitals.forEach(h => {
                stmt.run(
                    h.id.toString(),
                    h.name,
                    h.location.lat,
                    h.location.lng,
                    h.type || 'General Hospital',
                    h.status || 'Open'
                );
            });
            stmt.finalize();
        });
        console.log(`✅ ${hospitals.length} hospitals saved to DB and loaded into memory.`);
    } catch (err) {
        console.error(`🏥 Failed to fetch/save hospitals (attempt ${attempt}): ${err.message}`);
        // Retry up to 3 times with exponential back-off (15s, 30s, 60s)
        if (attempt < 3) {
            const delay = 15000 * attempt;
            console.log(`🏥 Retrying hospital fetch in ${delay / 1000}s...`);
            setTimeout(() => fetchAndSaveHospitals(lat, lng, radiusKm, attempt + 1), delay);
        }
    }
};

// Periodic retry every 2 minutes if hospitals are still empty
setInterval(() => {
    if (hospitals.length === 0 && lastUserLocation) {
        console.log('🏥 Hospitals still empty — retrying fetch from user location...');
        fetchAndSaveHospitals(lastUserLocation.lat, lastUserLocation.lng, 10);
    }
}, 2 * 60 * 1000);


// Store browser's real GPS immediately (called on dashboard load)
app.post('/api/set-user-location', (req, res) => {
    const { lat, lng } = req.body;
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        const prevLoc = lastUserLocation;
        lastUserLocation = { lat: parsedLat, lng: parsedLng };

        // Persist to DB so geofence survives server restarts
        db.run(
            `INSERT INTO settings (key, value) VALUES ('user_location', ?) 
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            [JSON.stringify(lastUserLocation)],
            (err) => { if (err) console.error('Failed to persist user location:', err.message); }
        );

        // Fetch hospitals if: none loaded yet, OR user moved >2km
        const noHospitals = hospitals.length === 0;
        const movedFar = prevLoc
            ? calculateDistance(prevLoc.lat, prevLoc.lng, parsedLat, parsedLng) > 2
            : true;

        if (noHospitals || movedFar) {
            fetchAndSaveHospitals(parsedLat, parsedLng, 10);
        }

        console.log(`📍 Browser GPS saved: (${parsedLat.toFixed(5)}, ${parsedLng.toFixed(5)}) — geofence active. Hospitals: ${hospitals.length}`);
        res.json({ success: true, location: lastUserLocation, hospitalsLoaded: hospitals.length });
    } else {
        res.status(400).json({ success: false, error: 'Invalid lat/lng' });
    }
});

app.get('/api/hospitals', (req, res) => {
    if (hospitals.length === 0 && lastUserLocation) {
        // Trigger background fetch if nothing loaded yet
        fetchAndSaveHospitals(lastUserLocation.lat, lastUserLocation.lng, 10);
        return res.json({ success: true, count: 0, data: [], message: 'Fetching hospitals...' });
    }
    // Return hospitals from memory (already fetched from Overpass and saved to DB)
    const data = hospitals.map(h => ({
        id: h.id,
        name: h.name,
        lat: h.location.lat,
        lng: h.location.lng,
        type: h.type || 'Hospital',
        status: h.status || 'Open'
    }));
    res.json({ success: true, count: data.length, data });
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

    // Update lastUserLocation with real browser GPS every call (and persist to DB)
    if (!isNaN(centerLat) && !isNaN(centerLng)) {
        const newLoc = { lat: centerLat, lng: centerLng };
        // Only persist to DB if location changed significantly (>50m) to avoid hammering DB every 2s
        const locChanged = !lastUserLocation ||
            calculateDistance(lastUserLocation.lat, lastUserLocation.lng, centerLat, centerLng) > 0.05;
        lastUserLocation = newLoc;
        if (locChanged) {
            db.run(
                `INSERT INTO settings (key, value) VALUES ('user_location', ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
                [JSON.stringify(newLoc)]
            );
        }
    }

    // Check if we need to re-initialize (if empty OR if requested location is far from current cluster)
    let shouldReinit = ambulances.length === 0;

    if (!shouldReinit && !isNaN(centerLat) && !isNaN(centerLng)) {
        // Check distance from first ambulance
        const dist = Math.sqrt(
            Math.pow(ambulances[0].location.lat - centerLat, 2) +
            Math.pow(ambulances[0].location.lng - centerLng, 2)
        );

        // If user moved > 0.05 degrees (~5km) from current fleet center, RESPAWN
        const ambLat = ambulances[0]?.location?.lat;
        if (ambLat !== undefined && ambLat !== null && !isNaN(ambLat)) {
            if (dist > 0.05) {
                shouldReinit = true;
                console.log(`User moved far from ${ambLat.toFixed(2)}. Triggering World Respawn.`);
            }
        } else {
            // Invalid location in memory, force reinit
            shouldReinit = true;
        }
    }

    if (shouldReinit) {
        // Respawn BOTH Ambulances and Hospitals at new location
        console.log(`Spawning World at ${centerLat}, ${centerLng}`);

        // Keep active ambulances
        const activeAmbulances = ambulances.filter(a => a.status === 'on_call');

        // Clear stale non-active units from DB
        await new Promise((resolve) => db.run("DELETE FROM ambulances WHERE status != 'on_call'", resolve));

        // Clear everything but active from memory
        ambulances = activeAmbulances;

        await initializeAmbulances(centerLat, centerLng);
    }

    // Filter ambulances to only those within 40km boundary (always include on_call units)
    const BOUNDARY_KM = 40;
    const ambulancesInBoundary = ambulances.filter(amb => {
        if (amb.status === 'on_call' || amb.status === 'to_hospital' || amb.status === 'at_incident') return true; // always include active units
        const dist = calculateDistance(centerLat, centerLng, amb.location.lat, amb.location.lng);
        return dist <= BOUNDARY_KM;
    });

    // Simulation is now handled by background setInterval
    res.json({
        success: true,
        count: ambulancesInBoundary.length,
        timestamp: new Date().toISOString(),
        data: ambulancesInBoundary
    });
});

// 2. Save New Incident (Automatic Dispatch)
app.post('/api/incidents', async (req, res) => {
    // Auto-close any incidents stuck > 20 minutes before checking the count
    await new Promise((resolve) => {
        db.run(
            `UPDATE incidents SET status = 'Closed'
             WHERE status IN ('Arrived', 'On Scene', 'Pending', 'Dispatched')
             AND datetime(timestamp) < datetime('now', '-20 minutes')`,
            resolve
        );
    });

    // Check Active Incidents Limit (max 3 concurrent)
    const activeCount = await new Promise((resolve) => {
        db.get(
            "SELECT COUNT(*) as count FROM incidents WHERE status IN ('Pending', 'Dispatched', 'Arrived', 'On Scene')",
            [],
            (err, row) => resolve(row ? row.count : 0)
        );
    });

    if (activeCount >= 3) {
        console.warn(`⚠️ Filtered Incident: System busy with ${activeCount} active tasks (limit 3).`);
        return res.status(429).json({
            success: false,
            message: "System busy. Max 3 active incidents allowed."
        });
    }

    const { type, location, latitude, longitude, confidence } = req.body;

    // Auto-determine severity based on AI confidence
    let severity;
    if (confidence && confidence >= 0.7) {
        severity = 'Critical';  // High confidence = Critical
    } else if (confidence && confidence >= 0.4) {
        severity = 'Major';     // Medium confidence = Major
    } else if (confidence) {
        severity = 'Minor';     // Low confidence = Minor
    } else {
        severity = 'Major';     // Default if no confidence provided
    }

    console.log(`📊 Incident: Confidence=${confidence}, Auto-Severity=${severity}`);

    // Raw coordinates from request body (before GPS override)
    const rawLat = parseFloat(latitude) || (typeof location === 'object' ? location?.lat : null) || BASE_LAT;
    const rawLng = parseFloat(longitude) || (typeof location === 'object' ? location?.lng : null) || BASE_LNG;

    // Use real browser GPS for incident location (overrides AI IP-based coordinates)
    // MUST happen BEFORE geofence check so AI incidents always resolve to user's location
    const incidentLat = lastUserLocation?.lat ?? rawLat;
    const incidentLng = lastUserLocation?.lng ?? rawLng;
    if (lastUserLocation) {
        console.log(`📍 Using real browser GPS for incident: (${incidentLat.toFixed(5)}, ${incidentLng.toFixed(5)})`);
    }

    // ── 40km Geofence Check (applies to ALL incident types) ──────────────────
    const GEOFENCE_RADIUS_KM = 40;
    if (!lastUserLocation) {
        // Geofence centre unknown — reject until browser sends GPS
        console.warn('🚫 Incident rejected — geofence not yet active (no user GPS received)');
        return res.status(403).json({
            success: false,
            message: 'Geofence not yet active. Please open the dashboard so the app can detect your location.'
        });
    }
    const distFromUser = calculateDistance(
        lastUserLocation.lat, lastUserLocation.lng,
        incidentLat, incidentLng
    );
    if (distFromUser > GEOFENCE_RADIUS_KM) {
        console.warn(`🚫 Incident rejected — outside 40km geofence (${distFromUser.toFixed(1)}km from user)`);
        return res.status(403).json({
            success: false,
            message: `Incident location is ${distFromUser.toFixed(1)}km away — outside the 40km operational boundary.`
        });
    }
    console.log(`✅ Geofence OK — incident is ${distFromUser.toFixed(1)}km from user (within ${GEOFENCE_RADIUS_KM}km)`);
    // ─────────────────────────────────────────────────────────────────────────


    // 1. Find Nearest Available Ambulance within 40km boundary
    const availableAmbulances = ambulances
        .filter(amb => {
            if (amb.status !== 'standby' && amb.status !== 'moving') return false;
            const dist = calculateDistance(amb.location.lat, amb.location.lng, incidentLat, incidentLng);
            return dist <= 40; // Only consider ambulances within 40km
        })
        .map(amb => ({
            ...amb,
            distance: calculateDistance(amb.location.lat, amb.location.lng, incidentLat, incidentLng)
        }))
        .sort((a, b) => a.distance - b.distance);

    let nearestAmb = availableAmbulances.length > 0 ? availableAmbulances[0] : null;
    let nearestDistance = nearestAmb ? nearestAmb.distance : 0;

    if (nearestAmb) {
        console.log(`📍 Nearest available ambulance found: ${nearestAmb.service_name} at ${nearestDistance.toFixed(2)}km`);
    } else {
        console.log(`⚠️ No available ambulances (checks all ${ambulances.length} units, none were standby/moving).`);
    }

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
        const dist = calculateDistance(
            hos.location.lat,
            hos.location.lng,
            incidentLat,
            incidentLng
        );
        if (dist < minHospDist) {
            minHospDist = dist;
            nearestHospital = hos;
        }
    });

    let dispatchMsg = "No ambulances available";
    let status = "Pending";
    let ambulanceInfo = null;

    if (nearestAmb) {
        status = "Dispatched";

        const eta = Math.ceil((nearestDistance / nearestAmb.speed) * 60); // ETA in minutes

        dispatchMsg = `Dispatched ${nearestAmb.service_name} - ETA: ${eta} min (${nearestDistance.toFixed(1)} km away)`;

        ambulanceInfo = {
            id: nearestAmb.id,
            name: nearestAmb.service_name,
            driver: nearestAmb.driverName,
            contact: nearestAmb.contact_number,
            distance: nearestDistance.toFixed(2),
            eta: eta,
            status: 'on_call'
        };

        console.log(`🚑 ${dispatchMsg}`);
    } else {
        console.log(`⚠️  No available ambulances found for incident at (${incidentLat}, ${incidentLng})`);
    }

    // 3. Save to DB with coordinates and confidence
    const dispatchedAt = nearestAmb ? new Date().toISOString() : null;
    const sql = `INSERT INTO incidents (type, severity, location, status, latitude, longitude, confidence${nearestHospital ? ', hospital' : ''}${nearestAmb ? ', assigned_ambulance' : ''}${dispatchedAt ? ', dispatched_at' : ''}) 
                 VALUES (?, ?, ?, ?, ?, ?, ?${nearestHospital ? ', ?' : ''}${nearestAmb ? ', ?' : ''}${dispatchedAt ? ', ?' : ''})`;
    const params = [type, severity, location, status, incidentLat, incidentLng, confidence || null];
    if (nearestHospital) params.push(nearestHospital.name);
    if (nearestAmb) params.push(nearestAmb.service_name);
    if (dispatchedAt) params.push(dispatchedAt);

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });

        const incidentId = this.lastID;
        if (nearestAmb) {
            nearestAmb.status = 'on_call';
            nearestAmb.isHalted = false;
            nearestAmb.showRoute = true;
            nearestAmb.assignedIncidentId = incidentId;
            assignNewRoute(nearestAmb, incidentLat, incidentLng, true);

            // Immediate DB update for the ambulance
            db.run("UPDATE ambulances SET status = 'on_call', assigned_incident_id = ? WHERE id = ?", [incidentId, nearestAmb.id]);
        }

        res.json({
            id: incidentId,
            message: "Incident saved",
            dispatch: dispatchMsg,
            status: status,
            severity: severity,  // Return auto-calculated severity
            latitude: incidentLat,
            longitude: incidentLng,
            confidence: confidence,
            ambulance: ambulanceInfo,  // Include dispatched ambulance info
            hospital: nearestHospital ? {
                id: nearestHospital.id,
                name: nearestHospital.name,
                lat: nearestHospital.location.lat,
                lng: nearestHospital.location.lng,
                distance: minHospDist.toFixed(2)
            } : null
        });
    });
});
// 2.5 Dispatch Manual Endpoint
app.post('/api/incidents/:id/dispatch', async (req, res) => {
    const incidentId = req.params.id;

    // Fetch incident details from DB
    db.get("SELECT * FROM incidents WHERE id = ?", [incidentId], async (err, incident) => {
        if (err || !incident) {
            return res.status(404).json({ success: false, error: "Incident not found" });
        }

        const incidentLat = incident.latitude;
        const incidentLng = incident.longitude;

        if (!incidentLat || !incidentLng) {
            return res.status(400).json({ success: false, error: "Incident coordinates missing" });
        }

        // 1. Find Nearest Available Ambulance
        const availableAmbulances = ambulances
            .filter(amb => amb.status === 'standby' || amb.status === 'moving')
            .map(amb => ({
                ...amb,
                distance: calculateDistance(amb.location.lat, amb.location.lng, incidentLat, incidentLng)
            }))
            .sort((a, b) => a.distance - b.distance);

        let nearestAmb = availableAmbulances.length > 0 ? availableAmbulances[0] : null;
        let nearestDistance = nearestAmb ? nearestAmb.distance : 0;

        if (nearestAmb) {
            // Dispatch
            nearestAmb.status = 'on_call';
            nearestAmb.isHalted = false;
            nearestAmb.destination = { lat: incidentLat, lng: incidentLng };
            nearestAmb.route = [];
            nearestAmb.speed = 70;
            nearestAmb.showRoute = true;
            nearestAmb.assignedIncidentId = incidentId;
            console.log(`🚑 Manually Dispatching Nearest: ${nearestAmb.service_name} (${nearestDistance.toFixed(2)}km)`);
            await assignNewRoute(nearestAmb, incidentLat, incidentLng);

            // Update DB
            db.run("UPDATE incidents SET status = 'Dispatched', dispatched_at = CURRENT_TIMESTAMP WHERE id = ?", [incidentId]);
            db.run("UPDATE ambulances SET status = 'on_call', assigned_incident_id = ? WHERE id = ?", [incidentId, nearestAmb.id]);

            res.json({
                success: true,
                message: "Ambulance dispatched",
                ambulance: nearestAmb.service_name,
                eta: Math.ceil((nearestDistance / nearestAmb.speed) * 60)
            });
        } else {
            res.status(400).json({ success: false, message: "No ambulances available" });
        }
    });
});

// 3. Get All Incidents (History) with Ambulance Details
app.get('/api/incidents', (req, res) => {
    const sql = `
        SELECT 
            incidents.*,
            incidents.assigned_ambulance as historical_ambulance_name,
            incidents.reached_time as historical_reached_time,
            ambulances.service_name as ambulance_name,
            ambulances.contact_number as ambulance_contact,
            ambulances.status as ambulance_status,
            ambulances.last_updated as ambulance_updated,
            ambulances.latitude as ambulance_lat,
            ambulances.longitude as ambulance_lng
        FROM incidents
        LEFT JOIN ambulances ON incidents.id = ambulances.assigned_incident_id
        ORDER BY incidents.timestamp DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, count: rows.length, data: rows });
    });
});

// NEW: Clear All Incidents
app.delete('/api/incidents', (req, res) => {
    db.serialize(() => {
        db.run("DELETE FROM incidents");
        // Reset DB Ambulances
        db.run("UPDATE ambulances SET status = 'standby', assigned_incident_id = NULL, current_speed = 0");

        // Reset In-Memory Ambulances
        ambulances.forEach(amb => {
            amb.status = 'standby';
            amb.assignedIncidentId = null;
            amb.destination = null;
            amb.route = [];
            amb.isHalted = true;
            amb.speed = 0;
            amb.showRoute = false;
        });

        console.log("⚠️ ALL INCIDENTS CLEARED & AMBULANCES RESET");
        res.json({ success: true, message: "All incidents cleared and ambulances reset." });
    });
});

// NEW: Get Accident Locations for Map Markers
app.get('/api/accidents/locations', (req, res) => {
    const sql = `SELECT id, type, severity, location, status, timestamp, latitude, longitude, confidence 
                 FROM incidents 
                 WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                 ORDER BY timestamp DESC`;

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        // Format data for map markers
        const accidents = rows.map(row => ({
            id: row.id,
            type: row.type,
            severity: row.severity,
            location: row.location,
            status: row.status,
            timestamp: row.timestamp,
            lat: row.latitude,
            lng: row.longitude,
            confidence: row.confidence || 0
        }));

        res.json({
            success: true,
            count: accidents.length,
            data: accidents
        });
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

// --- ADMIN SERVER (Port 3001) ---
const adminApp = express();
const ADMIN_PORT = 3001;

adminApp.use(cors());
adminApp.use(express.json());

// Shared Status Endpoint (exists on both)
adminApp.get('/api/ambulance-service-status', (req, res) => {
    res.json({ enabled: ambulanceServicesEnabled });
});

// Admin Control Endpoint (Admin Only)
adminApp.post('/api/set-ambulance-service', (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
        return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
    }
    ambulanceServicesEnabled = enabled;
    console.log(`🚑 Ambulance Services ${enabled ? 'ENABLED' : 'DISABLED'} (via Admin Port)`);
    res.json({ success: true, enabled: ambulanceServicesEnabled });
});

// 1. Get Ambulances (Admin)
adminApp.get('/api/admin/ambulances', (req, res) => {
    db.all("SELECT * FROM ambulances", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, count: rows.length, data: rows });
    });
});

// 2. Add Ambulance (Admin)
adminApp.post('/api/admin/ambulances', (req, res) => {
    const { service_name, driver_name, contact_number, latitude, longitude, status } = req.body;

    // ── GEOFENCE: reject if coordinates are outside the 40km fence ──
    if (lastUserLocation) {
        const dist = calculateDistance(lastUserLocation.lat, lastUserLocation.lng, parseFloat(latitude), parseFloat(longitude));
        if (dist > 40) {
            return res.status(403).json({
                success: false,
                error: `Ambulance position is ${dist.toFixed(1)}km from user — outside the 40km operational boundary.`
            });
        }
    }

    const sql = `INSERT INTO ambulances (service_name, driver_name, contact_number, latitude, longitude, status, current_speed, heading, last_updated) VALUES (?, ?, ?, ?, ?, ?, 0, 0, datetime('now'))`;
    db.run(sql, [service_name, driver_name, contact_number, latitude, longitude, status || 'standby'], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // Refresh In-Memory Array
        initializeAmbulances(latitude, longitude).then(() => {
            res.json({ success: true, id: this.lastID, message: "Ambulance added." });
        });
    });
});

// 3. Update Ambulance (Admin)
adminApp.put('/api/admin/ambulances/:id', (req, res) => {
    const { service_name, driver_name, contact_number, latitude, longitude, status } = req.body;
    const sql = `UPDATE ambulances SET service_name = ?, driver_name = ?, contact_number = ?, latitude = ?, longitude = ?, status = ? WHERE id = ?`;
    db.run(sql, [service_name, driver_name, contact_number, latitude, longitude, status, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        // Refresh In-Memory
        initializeAmbulances().then(() => {
            res.json({ success: true, message: "Ambulance updated." });
        });
    });
});

// 4. Delete Ambulance (Admin)
adminApp.delete('/api/admin/ambulances/:id', (req, res) => {
    db.run("DELETE FROM ambulances WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        // Refresh In-Memory
        ambulances = ambulances.filter(a => a.id != req.params.id);
        res.json({ success: true, message: "Ambulance deleted." });
    });
});

// 5. Get Hospitals (Admin)
adminApp.get('/api/admin/hospitals', (req, res) => {
    res.json({ success: true, count: hospitals.length, data: hospitals });
});

// 6. Add/Delete Hospitals (Admin)
// 6. Add/Update/Delete Hospitals (Admin - DB Backed)
adminApp.post('/api/admin/hospitals', (req, res) => {
    const { name, latitude, longitude, type, status } = req.body;
    const newId = 'manual_' + Date.now();
    const sql = `INSERT INTO hospitals (id, name, latitude, longitude, type, status) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [newId, name, latitude, longitude, type || 'Hospital', status || 'Open'], function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        const newHospital = { id: newId, name, location: { lat: latitude, lng: longitude }, type: type || 'Hospital', status: status || 'Open' };
        hospitals.push(newHospital);
        res.json({ success: true, data: newHospital });
    });
});

adminApp.put('/api/admin/hospitals/:id', (req, res) => {
    const { name, latitude, longitude, type, status } = req.body;
    const sql = `UPDATE hospitals SET name = ?, latitude = ?, longitude = ?, type = ?, status = ? WHERE id = ?`;
    db.run(sql, [name, latitude, longitude, type, status, req.params.id], function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        const idx = hospitals.findIndex(h => h.id == req.params.id);
        if (idx !== -1) {
            hospitals[idx] = { ...hospitals[idx], name, location: { lat: latitude, lng: longitude }, type, status };
        }
        res.json({ success: true, message: "Hospital updated permanently." });
    });
});

adminApp.delete('/api/admin/hospitals/:id', (req, res) => {
    db.run("DELETE FROM hospitals WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        hospitals = hospitals.filter(h => h.id != req.params.id);
        res.json({ success: true, message: "Hospital deleted permanently." });
    });
});

// 7. Cameras (Admin)
adminApp.get('/api/admin/cameras', (req, res) => {
    db.all("SELECT * FROM cameras", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, data: rows });
    });
});

adminApp.post('/api/admin/cameras', (req, res) => {
    const { name, location_name, latitude, longitude, feed_url } = req.body;
    const sql = `INSERT INTO cameras (name, location_name, latitude, longitude, feed_url) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [name, location_name, latitude, longitude, feed_url], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

adminApp.put('/api/admin/cameras/:id', (req, res) => {
    const { name, location_name, latitude, longitude, feed_url } = req.body;
    const sql = `UPDATE cameras SET name = ?, location_name = ?, latitude = ?, longitude = ?, feed_url = ? WHERE id = ?`;
    db.run(sql, [name, location_name, latitude, longitude, feed_url, req.params.id], function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, message: "Camera updated" });
    });
});

adminApp.delete('/api/admin/cameras/:id', (req, res) => {
    db.run("DELETE FROM cameras WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// 8. Incidents (Admin Access)
// Get All Incidents (Simpler version for Admin Table)
adminApp.get('/api/incidents', (req, res) => {
    db.all("SELECT * FROM incidents ORDER BY timestamp DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, data: rows });
    });
});

// Delete Single Incident
adminApp.put('/api/admin/incidents/:id', (req, res) => {
    const { location, latitude, longitude, severity, status } = req.body;
    let sql = "UPDATE incidents SET ";
    let params = [];
    if (location) { sql += "location = ?, "; params.push(location); }
    if (latitude !== undefined) { sql += "latitude = ?, "; params.push(latitude); }
    if (longitude !== undefined) { sql += "longitude = ?, "; params.push(longitude); }
    if (severity) { sql += "severity = ?, "; params.push(severity); }
    if (status) { sql += "status = ? "; params.push(status); }
    if (sql.endsWith(", ")) sql = sql.slice(0, -2);
    sql += " WHERE id = ?";
    params.push(req.params.id);

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, message: "Incident modified completely" });
    });
});

adminApp.delete('/api/admin/incidents/:id', (req, res) => {
    db.run("DELETE FROM incidents WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Incident deleted." });
    });
});

// Delete ALL Incidents (Clear History)
adminApp.delete('/api/incidents', (req, res) => {
    db.run("DELETE FROM incidents", function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "All incidents cleared." });
    });
});

// 9. Force Dispatch (Admin)
adminApp.post('/api/admin/dispatch', (req, res) => {
    const { ambulanceId, incidentId } = req.body;
    const amb = ambulances.find(a => a.id == ambulanceId);
    if (!amb) return res.status(404).json({ success: false, error: 'Ambulance not found' });

    db.get("SELECT * FROM incidents WHERE id = ?", [incidentId], (err, inc) => {
        if (err || !inc) return res.status(404).json({ success: false, error: 'Incident not found' });

        assignNewRoute(amb, inc.latitude, inc.longitude);
        db.run("UPDATE ambulances SET status = 'on_call' WHERE id = ?", [amb.id]);
        db.run("UPDATE incidents SET status = 'Dispatched' WHERE id = ?", [inc.id]);

        res.json({ success: true, message: `Dispatched ${amb.service_name} to Incident #${inc.id}` });
    });
});

// 10. Recall Ambulance (Admin)
adminApp.post('/api/admin/recall/:id', (req, res) => {
    const amb = ambulances.find(a => a.id == req.params.id);
    if (!amb) return res.status(404).json({ success: false, error: 'Ambulance not found' });

    amb.status = 'standby';
    amb.route = [];
    amb.routeIndex = 0;
    amb.destination = null;
    db.run("UPDATE ambulances SET status = 'standby' WHERE id = ?", [amb.id]);

    res.json({ success: true, message: `Recalled ${amb.service_name} to standby` });
});

// 11. Create Manual Incident (Admin)
adminApp.post('/api/admin/incidents', (req, res) => {
    const { latitude, longitude, severity, description } = req.body;
    const sql = `INSERT INTO incidents (type, location, latitude, longitude, severity, confidence, status) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, ['Manual Report', description || 'Manually created by Admin', latitude, longitude, severity || 'Critical', 1.0, 'Pending'], function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, id: this.lastID, message: 'Incident created' });
    });
});

// 12. Change Incident Status (Admin)
adminApp.put('/api/admin/incidents/:id/status', (req, res) => {
    const { status, severity } = req.body;
    let sql = "UPDATE incidents SET ";
    let params = [];
    if (status) { sql += "status = ? "; params.push(status); }
    if (severity) { sql += (status ? ", " : "") + "severity = ? "; params.push(severity); }
    sql += "WHERE id = ?";
    params.push(req.params.id);

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, message: 'Incident updated' });
    });
});

// 13. Export Incidents CSV (Admin)
adminApp.get('/api/admin/incidents/export', (req, res) => {
    db.all("SELECT * FROM incidents ORDER BY timestamp DESC", [], (err, rows) => {
        if (err) return res.status(500).send("Database error");
        if (rows.length === 0) return res.send("No incidents found");

        const headers = Object.keys(rows[0]).join(',');
        const csv = rows.map(row => Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');

        res.header('Content-Type', 'text/csv');
        res.attachment('incidents_export.csv');
        res.send(`${headers}\n${csv}`);
    });
});

// 14. Geofence Control (Admin)
adminApp.get('/api/admin/geofence', (req, res) => {
    res.json({
        success: true,
        center: lastUserLocation,
        active: !!lastUserLocation
    });
});

adminApp.post('/api/admin/geofence', (req, res) => {
    const { lat, lng } = req.body;
    lastUserLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
    fetchAndSaveHospitals(lastUserLocation.lat, lastUserLocation.lng, 10);
    res.json({ success: true, message: 'Geofence origin updated manually' });
});

// 15. Force Refresh Hospitals (Admin)
adminApp.post('/api/admin/hospitals/refresh', (req, res) => {
    if (!lastUserLocation) return res.status(400).json({ success: false, error: 'No geofence center set' });
    fetchAndSaveHospitals(lastUserLocation.lat, lastUserLocation.lng, 10);
    res.json({ success: true, message: 'Triggered Overpass API hospital fetch' });
});

// 16. System Health (Admin)
adminApp.get('/api/admin/system/health', (req, res) => {
    res.json({
        success: true,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        activeRouteFetches: _activeRouteFetches,
        hospitalCount: hospitals.length,
        ambulanceCount: ambulances.length,
        geofenceActive: !!lastUserLocation,
        servicesEnabled: ambulanceServicesEnabled
    });
});

// Driver Status Update Endpoint (for Driver Mobile App)
app.post('/api/driver/status', (req, res) => {
    const { ambulanceId, status, lat, lng } = req.body;
    
    // Find ambulance by ID or service_name
    const amb = ambulances.find(a => a.id === ambulanceId || a.service_name === ambulanceId);
    
    if (!amb) {
        return res.status(404).json({ success: false, error: 'Ambulance not found' });
    }

    // Update location if provided
    if (lat && lng) {
        amb.location = { lat: parseFloat(lat), lng: parseFloat(lng) };
    }

    // Handle status transitions
    switch (status) {
        case 'at_incident':
            amb.status = 'at_incident';
            amb.isHalted = true;
            amb.speed = 0;
            amb.haltTimer = 5; // 5 second wait before hospital
            
            // Update incident status
            if (amb.assignedIncidentId) {
                db.run("UPDATE incidents SET status = 'Arrived', reached_time = CURRENT_TIMESTAMP WHERE id = ?", 
                    [amb.assignedIncidentId]);
            }
            console.log(`🚑 Driver ${amb.service_name} arrived at incident`);
            break;
            
        case 'to_hospital':
            amb.status = 'to_hospital';
            amb.isHalted = false;
            amb.speed = 85;
            
            // Find nearest hospital and route to it
            if (hospitals.length > 0) {
                const sortedHospitals = hospitals.map(h => ({
                    ...h,
                    dist: calculateDistance(amb.location.lat, amb.location.lng, h.location.lat, h.location.lng)
                })).sort((a, b) => a.dist - b.dist);
                
                const nearestHosp = sortedHospitals[0];
                if (nearestHosp && nearestHosp.dist <= 40) {
                    amb.route = [];
                    amb.routeIndex = 0;
                    assignNewRoute(amb, nearestHosp.location.lat, nearestHosp.location.lng, true);
                    
                    // Update DB
                    if (amb.assignedIncidentId) {
                        db.run("UPDATE incidents SET hospital = ?, status = 'On Scene' WHERE id = ?", 
                            [nearestHosp.name, amb.assignedIncidentId]);
                    }
                    console.log(`🚑 Driver ${amb.service_name} transporting to ${nearestHosp.name}`);
                }
            }
            break;
            
        case 'standby':
            amb.status = 'standby';
            amb.isHalted = true;
            amb.speed = 0;
            amb.route = [];
            amb.showRoute = false;
            
            // Close incident if assigned
            if (amb.assignedIncidentId) {
                db.run("UPDATE incidents SET status = 'Closed' WHERE id = ?", [amb.assignedIncidentId]);
                console.log(`✅ Incident ${amb.assignedIncidentId} closed by driver`);
            }
            delete amb.assignedIncidentId;
            break;
            
        default:
            amb.status = status;
    }

    // Update DB
    db.run("UPDATE ambulances SET status = ?, latitude = ?, longitude = ?, current_speed = ?, assigned_incident_id = ? WHERE id = ?",
        [amb.status, amb.location.lat, amb.location.lng, amb.speed, amb.assignedIncidentId || null, amb.id]);

    res.json({ 
        success: true, 
        status: amb.status,
        ambulance: amb.service_name,
        message: `Status updated to ${status}` 
    });
});

// Get single ambulance status (for Driver App)
app.get('/api/driver/ambulance/:id', (req, res) => {
    const { id } = req.params;
    const amb = ambulances.find(a => a.id === id || a.service_name === id);
    
    if (!amb) {
        return res.status(404).json({ success: false, error: 'Ambulance not found' });
    }

    res.json({
        success: true,
        data: {
            id: amb.id,
            service_name: amb.service_name,
            driverName: amb.driverName,
            contact_number: amb.contact_number,
            location: amb.location,
            status: amb.status,
            speed: amb.speed,
            heading: amb.heading,
            assignedIncidentId: amb.assignedIncidentId,
            route: amb.route,
            destination: amb.destination
        }
    });
});

// Start Admin Server
adminApp.listen(ADMIN_PORT, () => {
    console.log(`🛡️ Admin Server running on http://localhost:${ADMIN_PORT}`);
});

// --- MAIN SERVER (Port 3000) ---
// Note: Some endpoints below (like ambulance-service-status) are kept on Main App too for client usage
app.get('/api/ambulance-service-status', (req, res) => {
    res.json({ enabled: ambulanceServicesEnabled });
});

app.listen(PORT, () => {
    console.log(`Ambulance Server running on http://localhost:${PORT}`);
});
