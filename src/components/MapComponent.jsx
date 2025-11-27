import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';

// Custom Marker Icons (using colored circles as placeholders for now, or SVGs)
const createCustomIcon = (color) => {
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 0 10px ${color};
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div>
    </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
    });
};

const icons = {
    critical: createCustomIcon('#ef4444'), // Red
    warning: createCustomIcon('#eab308'),  // Yellow
    success: createCustomIcon('#22c55e'),  // Green
    info: createCustomIcon('#3b82f6'),     // Blue
    user: createCustomIcon('#a855f7'),     // Purple for user
};

// Component to handle map recentering
const RecenterAutomatically = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        if (lat && lng) {
            map.flyTo([lat, lng], 14);
        }
    }, [lat, lng, map]);
    return null;
};

const MapComponent = () => {
    const [userLocation, setUserLocation] = useState(null);
    const defaultCenter = [28.6139, 77.2090]; // New Delhi

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setUserLocation([latitude, longitude]);
                },
                (error) => {
                    console.error("Error getting location:", error);
                }
            );
        }
    }, []);

    // Mock Data
    const incidents = [
        { id: 1, pos: [28.62, 77.21], type: 'critical', title: 'Accident #124 - Critical' },
        { id: 2, pos: [28.60, 77.22], type: 'warning', title: 'Accident #125 - Minor' },
        { id: 3, pos: [28.63, 77.20], type: 'warning', title: 'Traffic Congestion' },
    ];

    const units = [
        { id: 'A-01', pos: [28.615, 77.225], type: 'info', title: 'Ambulance A-01 (En Route)' },
        { id: 'A-02', pos: [28.605, 77.205], type: 'success', title: 'Ambulance A-02 (Available)' },
        { id: 'P-01', pos: [28.625, 77.195], type: 'success', title: 'Patrol P-01' },
    ];

    // Route from Ambulance A-01 to Accident #124
    const route = [
        [28.615, 77.225],
        [28.618, 77.220],
        [28.620, 77.215],
        [28.62, 77.21]
    ];

    const [ambulances, setAmbulances] = useState([]);

    // Fetch ambulances periodically
    useEffect(() => {
        if (!userLocation) return;

        const fetchAmbulances = async () => {
            try {
                const response = await fetch(`http://localhost:3000/api/ambulances?lat=${userLocation[0]}&lng=${userLocation[1]}`);
                const data = await response.json();
                if (data.success) {
                    setAmbulances(data.data);
                }
            } catch (error) {
                console.error("Failed to fetch ambulances:", error);
            }
        };

        // Initial fetch
        fetchAmbulances();

        // Poll every 2 seconds
        const interval = setInterval(fetchAmbulances, 2000);
        return () => clearInterval(interval);
    }, [userLocation]);

    const userIcon = icons.user;

    // Custom Emoji Icon for Ambulance
    const ambulanceIcon = new L.DivIcon({
        className: 'bg-transparent',
        html: '<div style="font-size: 24px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🚑</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    return (
        <div className="w-full h-full relative z-0">
            <MapContainer
                center={userLocation || [28.6139, 77.2090]}
                zoom={13}
                className="w-full h-full"
                zoomControl={false}
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                {/* User Location Marker */}
                {userLocation && (
                    <Marker position={userLocation} icon={userIcon}>
                        <Popup className="custom-popup">
                            <div className="p-2">
                                <h3 className="font-bold text-gray-900">You are here</h3>
                                <p className="text-sm text-gray-600">Current Location</p>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Ambulance Markers */}
                {ambulances.map((amb) => (
                    <Marker
                        key={amb.id}
                        position={[amb.location.lat, amb.location.lng]}
                        icon={ambulanceIcon}
                    >
                        <Popup className="custom-popup">
                            <div className="p-2 min-w-[200px]">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-gray-900">{amb.id}</h3>
                                    <span className={`px-2 py-0.5 rounded-full text-xs text-white ${amb.status === 'Available' ? 'bg-green-500' :
                                            amb.status === 'Busy' ? 'bg-red-500' : 'bg-blue-500'
                                        }`}>
                                        {amb.status}
                                    </span>
                                </div>
                                <div className="space-y-1 text-sm text-gray-600">
                                    <p><strong>Driver:</strong> {amb.driverName}</p>
                                    <p><strong>Speed:</strong> {amb.speed} km/h</p>
                                    <p className="text-xs text-gray-400 mt-2">Last updated: {new Date(amb.lastUpdated).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Incidents (retained from original) */}
                {incidents.map(inc => (
                    <Marker key={inc.id} position={inc.pos} icon={icons[inc.type]}>
                        <Popup className="custom-popup">
                            <div className="font-bold text-slate-800">{inc.title}</div>
                        </Popup>
                    </Marker>
                ))}

                {/* Dispatch Route (retained from original) */}
                <Polyline positions={route} color="#3b82f6" weight={4} opacity={0.7} dashArray="10, 10" />

                <RecenterAutomatically lat={userLocation?.[0]} lng={userLocation?.[1]} />
            </MapContainer>
        </div>
    );
};

export default MapComponent;
