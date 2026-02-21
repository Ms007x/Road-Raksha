import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { AlertTriangle } from 'lucide-react';

// Haversine distance (km) — used for client-side geofence filtering
const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Invisible label marker placed ~40km north of the geofence centre
const geofenceLabelIcon = new L.DivIcon({
    className: '',
    html: `
        <div style="
            background: rgba(59,130,246,0.18);
            border: 1.5px solid rgba(59,130,246,0.6);
            color: #93c5fd;
            font-family: 'Inter', sans-serif;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            padding: 3px 10px;
            border-radius: 20px;
            white-space: nowrap;
            pointer-events: none;
            user-select: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        ">◯ 40 km Operational Zone
        </div>`,
    iconSize: [190, 28],
    iconAnchor: [95, 14],
});

// Place the zone label on the northern edge of the boundary circle
const GeofenceLabel = ({ lat, lng }) => {
    // 40km north in degrees ≈ 0.3597°
    const labelLat = lat + 0.3597;
    return (
        <Marker
            position={[labelLat, lng]}
            icon={geofenceLabelIcon}
            interactive={false}
            zIndexOffset={-1000}
        />
    );
};

// Fix Leaflet Default Icon Issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// ETA helper: km / 75kmh * 60 = minutes
const calcETA = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return { dist: dist.toFixed(1), mins: Math.max(1, Math.ceil((dist / 75) * 60)) };
};

// Custom Icons Generator
const createAmbulanceIcon = (status, heading, incidentId) => {
    let iconUrl = '/ambulance-marker.png';

    return new L.DivIcon({
        className: 'custom-amb-icon',
        html: `
            <div style="position: relative; transform: rotate(${heading - 90}deg); transition: transform 0.5s;">
                <img src="${iconUrl}" style="
                    width: 45px; 
                    height: 45px; 
                    ${status === 'standby' ? 'filter: grayscale(100%); opacity: 0.7;' : ''}
                    ${status === 'on_call' ? 'filter: drop-shadow(0 0 10px #ef4444);' : ''}
                ">
                
                ${status === 'on_call' ? `
                    <div style="
                        position: absolute; 
                        top: 50%; 
                        left: 50%; 
                        transform: translate(-50%, -50%);
                        width: 50px; 
                        height: 50px; 
                        border: 4px solid #ef4444; 
                        border-radius: 50%; 
                        animation: amb-ping 1s infinite;
                        pointer-events: none;
                    "></div>
                ` : ''}

                ${status === 'on_call' && incidentId ? `
                    <div style="
                        position: absolute;
                        top: -10px;
                        right: -10px;
                        background: #ef4444;
                        color: white;
                        font-family: 'Inter', sans-serif;
                        font-weight: 800;
                        font-size: 11px;
                        padding: 2px 6px;
                        border-radius: 10px;
                        border: 2px solid white;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                        transform: rotate(${- (heading - 90)}deg);
                        z-index: 10;
                        white-space: nowrap;
                    ">
                        INC-${incidentId}
                    </div>
                ` : ''}
            </div>
            <style>
                @keyframes amb-ping {
                    0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
                }
            </style>
        `,
        iconSize: [45, 45],
        iconAnchor: [22, 22],
        popupAnchor: [0, -22],
    });
};

const hospitalIcon = new L.DivIcon({
    className: 'custom-hospital-marker',
    html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
            <div style="
                width: 28px;
                height: 28px;
                background: #334155;
                font-weight: bold;
                color: white;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                border: 2px solid white;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: sans-serif;
                font-size: 14px;
            ">
                <span style="transform: rotate(45deg);">H</span>
            </div>
        </div>
    `,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
});

// Accident Icon with status-based styling
const createAccidentIcon = (severity, status) => {
    // Priority colors for status: Arrived (Green), Dispatched (Yellow), Pending (Red)
    const color = status === 'Arrived' ? '#10b981' : (status === 'Dispatched' ? '#f59e0b' : '#ef4444');

    return new L.DivIcon({
        className: 'custom-accident-marker',
        html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
                <div style="
                    width: 32px;
                    height: 32px;
                    background: #1e293b;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    border: 2px solid white;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <div style="
                        width: 12px;
                        height: 12px;
                        background: ${color};
                        border-radius: 50%;
                        transform: rotate(45deg);
                        box-shadow: 0 0 10px ${color}, 0 0 20px ${color};
                        animation: marker-pulse 1.5s infinite;
                    "></div>
                </div>
            </div>
            <style>
                @keyframes marker-pulse {
                    0% { transform: rotate(45deg) scale(0.8); opacity: 0.8; }
                    50% { transform: rotate(45deg) scale(1.2); opacity: 1; }
                    100% { transform: rotate(45deg) scale(0.8); opacity: 0.8; }
                }
            </style>
        `,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -40],
    });
};


const RecenterMap = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        if (lat && lng) {
            map.flyTo([lat, lng], 13);
        }
    }, [lat, lng, map]);
    return null;
};

const MapClickHandler = ({ onClick }) => {
    useMapEvents({
        click: () => {
            onClick();
        },
    });
    return null;
};

const MapComponent = ({ userLocation, setUserLocation }) => {
    const [ambulances, setAmbulances] = useState([]);
    const [hospitals, setHospitals] = useState([]);
    const [accidents, setAccidents] = useState([]);

    const [selectedAmbulanceId, setSelectedAmbulanceId] = useState(null);

    // Removed internal geolocation as it's now handled by DashboardPage


    // 2. Fetch Data
    const fetchAmbulances = async () => {
        if (!userLocation) return;
        try {
            const { lat, lng } = userLocation;
            const res = await fetch(`http://localhost:3000/api/ambulances?lat=${lat}&lng=${lng}`);
            const data = await res.json();
            if (data.success) {
                setAmbulances(data.data);
            }
        } catch (err) {
            console.error("Failed to fetch ambulances", err);
        }
    };

    // Fetch Accidents with Coordinates
    const fetchAccidents = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/accidents/locations');
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                const latestAccidents = data.data;
                setAccidents(latestAccidents);
            }
        } catch (err) {
            console.error("Failed to fetch accidents", err);
        }
    };




    useEffect(() => {
        // Initial Fetch with Auto-Scrape check
        const init = async () => {
            if (!userLocation) return;

            console.log("📍 Map Initializing for location:", userLocation.lat, userLocation.lng);

            // 1. Fetch existing
            await fetchAmbulances();
            await fetchAccidents(); // Fetch accidents


        };

        if (userLocation) {
            init();
        }

        // Fetch hospitals from backend (auto-loaded from Overpass based on user GPS)
        const fetchHospitals = async () => {
            try {
                const res = await fetch('http://localhost:3000/api/hospitals');
                const data = await res.json();
                if (data.success && data.data.length > 0) {
                    setHospitals(data.data.map(h => ({
                        id: h.id,
                        name: h.name,
                        lat: h.lat,
                        lng: h.lng,
                        type: h.type || 'Hospital'
                    })));
                }
            } catch (err) {
                console.error('Failed to fetch hospitals from backend', err);
            }
        };
        fetchHospitals();
        // Re-poll every 60s so hospitals refresh if user has moved far
        const hospInterval = setInterval(fetchHospitals, 60000);


        // Staggered polling: ambulances every 2s, accidents every 3s, offset so they don't fire together
        const ambInterval = setInterval(() => fetchAmbulances(), 2000);
        const accInterval = setInterval(() => fetchAccidents(), 3000);
        // Offset accident polling by 1s so it never coincides with ambulance poll
        const accDelay = setTimeout(() => fetchAccidents(), 1000);

        return () => {
            clearInterval(ambInterval);
            clearInterval(accInterval);
            clearInterval(hospInterval);
            clearTimeout(accDelay);
        };

    }, [userLocation?.lat, userLocation?.lng]);


    const center = userLocation ? [userLocation.lat, userLocation.lng] : null;

    if (!userLocation) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <h3 className="text-xl font-semibold text-gray-700">Detecting Location...</h3>
                <p className="text-sm text-gray-500 mt-2">Please allow location access to see ambulances nearby.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative">
            {/* Removed: Accident Alert Overlay */}


            <MapContainer
                center={center}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
                zoomControl={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <RecenterMap lat={userLocation?.lat} lng={userLocation?.lng} />
                <MapClickHandler onClick={() => setSelectedAmbulanceId(null)} />

                {/* 40km Geofence Boundary Circle + Zone Label */}
                {userLocation && (
                    <>
                        <Circle
                            center={[userLocation.lat, userLocation.lng]}
                            radius={40000}
                            pathOptions={{
                                color: '#3b82f6',
                                weight: 2,
                                opacity: 0.8,
                                dashArray: '10, 8',
                                fillColor: '#3b82f6',
                                fillOpacity: 0.04,
                            }}
                        />
                        <GeofenceLabel lat={userLocation.lat} lng={userLocation.lng} />
                    </>
                )}

                {/* Ambulance Routes (Show for selected OR dispatched ambulances) */}
                {ambulances.filter(amb => amb.id === selectedAmbulanceId || amb.showRoute).map(amb => amb.route && amb.route.length > 0 && (
                    <React.Fragment key={`route-group-${amb.id}`}>
                        {/* Outer Glow/Shadow Line */}
                        <Polyline
                            positions={[
                                [amb.location.lat, amb.location.lng],
                                ...amb.route.slice((amb.routeIndex || 0) + 1).map(pt => [pt.lat, pt.lng])
                            ]}
                            color="#00d2ff"
                            weight={8}
                            opacity={0.3}
                        />
                        {/* Main Path Line */}
                        <Polyline
                            positions={[
                                [amb.location.lat, amb.location.lng],
                                ...amb.route.slice((amb.routeIndex || 0) + 1).map(pt => [pt.lat, pt.lng])
                            ]}
                            color="#00d2ff"
                            weight={4}
                            opacity={1}
                            lineJoin="round"
                        />
                    </React.Fragment>
                ))}

                {/* Ambulances */}
                {ambulances.map(amb => (
                    <Marker
                        key={amb.id}
                        position={[amb.location.lat, amb.location.lng]}
                        icon={createAmbulanceIcon(amb.status, amb.heading || 0, amb.assignedIncidentId)}
                        eventHandlers={{
                            click: () => {
                                setSelectedAmbulanceId(amb.id);
                            },
                        }}
                    >
                        <Tooltip direction="top" offset={[0, -20]} opacity={1}>
                            <div className="font-bold text-sm">{amb.service_name || "Ambulance"}</div>
                            <div className={`text-xs font-semibold ${amb.status === 'moving' ? 'text-blue-600' :
                                amb.status === 'standby' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                {amb.status.toUpperCase()}
                            </div>
                        </Tooltip>
                        <Popup>
                            <div className="min-w-[200px]">
                                <h3 className="font-bold text-lg mb-1">{amb.service_name}</h3>
                                <div className="text-sm text-gray-600 space-y-1">
                                    <p><strong>Driver:</strong> {amb.driverName}</p>
                                    <p><strong>Contact:</strong> {amb.contact_number}</p>
                                    <p><strong>Location:</strong> {amb.address || "Live Location"}</p>
                                    <div className="flex justify-between items-center mt-2 border-t pt-2">
                                        <span className={`px-2 py-0.5 rounded text-white text-xs ${amb.status === 'moving' ? 'bg-blue-500' :
                                            amb.status === 'standby' ? 'bg-green-500' : 'bg-red-500'
                                            }`}>{amb.status}</span>
                                        <span className="font-mono text-xs">{amb.speed} km/h</span>
                                    </div>
                                    {/* ETA for dispatched ambulances */}
                                    {amb.status === 'on_call' && amb.assignedIncidentId && (() => {
                                        const target = accidents.find(a => String(a.id) === String(amb.assignedIncidentId));
                                        if (!target) return null;
                                        const eta = calcETA(amb.location.lat, amb.location.lng, target.lat, target.lng);
                                        return (
                                            <div className="mt-2 pt-2 border-t bg-red-50 rounded px-2 py-1.5">
                                                <p className="text-xs font-bold text-red-600">🚨 En Route to INC-{amb.assignedIncidentId}</p>
                                                <p className="text-xs text-red-700 font-mono mt-0.5">
                                                    ETA: ~{eta.mins} min &nbsp;·&nbsp; {eta.dist} km
                                                </p>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))

                }

                {/* Accident Markers — filtered to 40km geofence */}
                {accidents
                    .filter(accident => {
                        if (!userLocation) return true; // show everything if no GPS yet
                        return haversineKm(userLocation.lat, userLocation.lng, accident.lat, accident.lng) <= 40;
                    })
                    .map(accident => (
                        <Marker
                            key={accident.id}
                            position={[accident.lat, accident.lng]}
                            icon={createAccidentIcon(accident.severity, accident.status)}
                        >
                            <Tooltip direction="top" offset={[0, -20]} opacity={1}>
                                <div className="font-bold text-sm">🚨 Accident Detected</div>
                                <div className={`text-xs font-semibold ${accident.severity === 'Critical' ? 'text-red-600' :
                                    accident.severity === 'Minor' ? 'text-yellow-600' : 'text-orange-600'
                                    }`}>
                                    {accident.severity.toUpperCase()}
                                </div>
                            </Tooltip>
                            <Popup>
                                <div className="min-w-[250px]">
                                    <h3 className="font-bold text-lg mb-2 text-red-600">🚨 Accident Alert</h3>
                                    <div className="text-sm text-gray-700 space-y-2">
                                        <div className="flex justify-between items-center pb-2 border-b">
                                            <span className="font-semibold">Severity:</span>
                                            <span className={`px-2 py-0.5 rounded text-white text-xs font-bold ${accident.severity === 'Critical' ? 'bg-red-500' :
                                                accident.severity === 'Minor' ? 'bg-yellow-500' : 'bg-orange-500'
                                                }`}>
                                                {accident.severity}
                                            </span>
                                        </div>
                                        <p><strong>Location:</strong> {accident.location}</p>
                                        <p><strong>Status:</strong> <span className={`font-semibold ${accident.status === 'Arrived' ? 'text-green-600' :
                                            accident.status === 'Dispatched' ? 'text-yellow-600' : 'text-red-600'
                                            }`}>{accident.status}</span></p>
                                        <p><strong>Time:</strong> {accident.timestamp}</p>
                                        {accident.confidence && (
                                            <p><strong>AI Confidence:</strong> {(accident.confidence * 100).toFixed(1)}%</p>
                                        )}
                                        <div className="mt-3 pt-2 border-t">
                                            <p className="text-xs text-gray-500">ID: INC-{accident.id}</p>
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                {/* Hospitals (Real Data from OSM) */}
                {hospitals.map(hos => (
                    <Marker
                        key={hos.id}
                        position={[hos.lat, hos.lng]}
                        icon={hospitalIcon}
                    >
                        <Tooltip direction="top" offset={[0, -20]} opacity={1}>
                            <div className="font-bold text-sm">{hos.name}</div>
                            <div className="text-xs text-blue-600">Hospital</div>
                        </Tooltip>
                        <Popup>
                            <strong>{hos.name}</strong><br />
                            Type: {hos.type}
                        </Popup>
                    </Marker>
                ))}

            </MapContainer>
        </div>
    );
};

export default MapComponent;
