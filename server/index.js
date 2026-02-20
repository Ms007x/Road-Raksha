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
                    console.log("🛣️ Route fetched via GraphHopper");
                    return path.points.coordinates.map(coord => ({
                        lat: coord[1],
                        lng: coord[0]
                    }));
                }
            }
        } catch (error) {
            console.warn('GraphHopper Failed, attempting OSRM fallback...');
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
            const loadedAmbulances = (rows || []).map(row => ({
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
                showRoute: row.status === 'on_call'
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
                            console.log(`Seeding ${sRows.length} units...`);
                            const now = new Date().toISOString();
                            const stmt = db.prepare(`INSERT INTO ambulances (
                                service_name, driver_name, contact_number, address,
                                latitude, longitude, current_speed, status, heading, last_updated
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

                            sRows.forEach(row => {
                                let rLat, rLng;
                                if (roadPoints.length > 5) {
                                    const pt = roadPoints[Math.floor(Math.random() * roadPoints.length)];
                                    rLat = pt.lat;
                                    rLng = pt.lng;
                                } else {
                                    rLat = parseFloat(centerLat) + (Math.random() - 0.5) * 0.08;
                                    rLng = parseFloat(centerLng) + (Math.random() - 0.5) * 0.08;
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
        // For random patrols, pick a known road point to ensure we stay on-road
        if (globalRoadPoints.length > 10) {
            const randomNode = globalRoadPoints[Math.floor(Math.random() * globalRoadPoints.length)];
            destLat = randomNode.lat;
            destLng = randomNode.lng;
        } else {
            // Fallback to jitter if no road nodes are available
            destLat = parseFloat(targetLat) + getRandom(-0.02, 0.02);
            destLng = parseFloat(targetLng) + getRandom(-0.02, 0.02);
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

    console.log(`🛣️ Route Plan: ${amb.service_name} from (${amb.location.lat.toFixed(4)}, ${amb.location.lng.toFixed(4)}) to (${destLat.toFixed(4)}, ${destLng.toFixed(4)})`);

    try {
        const route = await fetchRoadRoute(amb.location.lat, amb.location.lng, destLat, destLng);
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
            if (amb.status === 'on_call') {
                console.log(`🚑 Moving: ${amb.service_name} at (${amb.location.lat.toFixed(4)}, ${amb.location.lng.toFixed(4)}) - Step ${amb.routeIndex}/${amb.route.length}`);
            }
        } else {
            if (amb.status === 'on_call') {
                console.log(`✅ Ambulance ${amb.service_name} arrived at incident! Waiting 10s...`);

                // Update incident status in DB
                if (amb.assignedIncidentId) {
                    db.run("UPDATE incidents SET status = 'Arrived', reached_time = CURRENT_TIMESTAMP WHERE id = ?", [amb.assignedIncidentId]);
                }

                // Stage 2: Wait at scene
                amb.isHalted = true;
                amb.speed = 0;
                amb.haltTimer = 10; // 10 seconds
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
                console.log(`🚑 10s passed. Moving ${amb.service_name} to nearest hospital...`);

                if (hospitals.length > 0) {
                    const localHospitals = hospitals.map(h => ({
                        ...h,
                        dist: calculateDistance(amb.location.lat, amb.location.lng, h.location.lat, h.location.lng)
                    })).sort((a, b) => a.dist - b.dist);

                    const nearestHosp = localHospitals[0];

                    if (nearestHosp && nearestHosp.dist < 20) { // Max 20km for emergency hospital
                        console.log(`🚑 Transporting patient to ${nearestHosp.name} (${nearestHosp.dist.toFixed(1)}km)`);

                        // Update DB with hospital
                        if (amb.assignedIncidentId) {
                            db.run("UPDATE incidents SET hospital = ?, status = 'On Scene' WHERE id = ?", [nearestHosp.name, amb.assignedIncidentId]);
                        }

                        amb.status = 'to_hospital';
                        amb.isHalted = false;
                        amb.speed = 85;
                        amb.routeIndex = 0;
                        amb.route = [];
                        assignNewRoute(amb, nearestHosp.location.lat, nearestHosp.location.lng, true);
                    } else {
                        console.log(`⚠️ No local hospital within 20km. Returning unit to standby.`);
                        amb.status = 'standby';
                        amb.isHalted = true;
                        amb.speed = 0;
                        amb.route = [];
                        amb.showRoute = false;
                        delete amb.assignedIncidentId;
                    }
                } else {
                    console.warn("No hospitals loaded. Returning unit to standby.");
                    amb.status = 'standby';
                    amb.isHalted = true;
                    amb.route = [];
                    amb.showRoute = false;
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
// Store browser's real GPS immediately (called on dashboard load)
app.post('/api/set-user-location', (req, res) => {
    const { lat, lng } = req.body;
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        lastUserLocation = { lat: parsedLat, lng: parsedLng };
        // Persist to DB so geofence survives server restarts
        db.run(
            `INSERT INTO settings (key, value) VALUES ('user_location', ?) 
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            [JSON.stringify(lastUserLocation)],
            (err) => { if (err) console.error('Failed to persist user location:', err.message); }
        );
        console.log(`📍 Browser GPS saved: (${parsedLat.toFixed(5)}, ${parsedLng.toFixed(5)}) — geofence active`);
        res.json({ success: true, location: lastUserLocation });
    } else {
        res.status(400).json({ success: false, error: 'Invalid lat/lng' });
    }
});

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

    // Check Active Incidents Limit (raised to 5)
    const activeCount = await new Promise((resolve) => {
        db.get(
            "SELECT COUNT(*) as count FROM incidents WHERE status IN ('Pending', 'Dispatched', 'Arrived', 'On Scene')",
            [],
            (err, row) => resolve(row ? row.count : 0)
        );
    });

    if (activeCount >= 5) {
        console.warn(`⚠️ Filtered Incident: System busy with ${activeCount} active tasks (limit 5).`);
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
    // AI incidents use lastUserLocation (0km from user) → always pass
    // External/test incidents with wrong coords → rejected
    const GEOFENCE_RADIUS_KM = 40;
    if (lastUserLocation) {
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
    }
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
adminApp.post('/api/admin/hospitals', (req, res) => {
    const { name, latitude, longitude, beds_available } = req.body;
    const newHospital = {
        id: hospitals.length + 1,
        name,
        location: { lat: latitude, lng: longitude },
        beds_available: beds_available || 10
    };
    hospitals.push(newHospital);
    res.json({ success: true, data: newHospital });
});

adminApp.delete('/api/admin/hospitals/:id', (req, res) => {
    hospitals = hospitals.filter(h => h.id != req.params.id);
    res.json({ success: true, message: "Hospital removed from session." });
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
