const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

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

// Initialize Ambulances
const initializeAmbulances = async (centerLat, centerLng) => {
    ambulances = [];
    for (let i = 1; i <= 10; i++) {
        const id = `AMB${i.toString().padStart(3, '0')}`;

        // Start nearby
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

        // Assign initial route
        assignNewRoute(amb, centerLat, centerLng);
    }
};

const assignNewRoute = async (amb, centerLat, centerLng) => {
    // Pick a random destination within range
    const destLat = parseFloat(centerLat) + getRandom(-0.03, 0.03);
    const destLng = parseFloat(centerLng) + getRandom(-0.03, 0.03);

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
