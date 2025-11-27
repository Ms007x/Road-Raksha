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

    return (
        <MapContainer
            center={defaultCenter}
            zoom={13}
            scrollWheelZoom={true}
            zoomControl={false}
            className="h-full w-full bg-darker"
        >
            {/* Dark Matter Tiles */}
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            {/* User Location Marker & Recenter Logic */}
            {userLocation && (
                <>
                    <Marker position={userLocation} icon={icons.user}>
                        <Popup className="custom-popup">
                            <div className="font-bold text-slate-800">You are here</div>
                        </Popup>
                    </Marker>
                    <RecenterAutomatically lat={userLocation[0]} lng={userLocation[1]} />
                </>
            )}

            {/* Incidents */}
            {incidents.map(inc => (
                <Marker key={inc.id} position={inc.pos} icon={icons[inc.type]}>
                    <Popup className="custom-popup">
                        <div className="font-bold text-slate-800">{inc.title}</div>
                    </Popup>
                </Marker>
            ))}

            {/* Units */}
            {units.map(unit => (
                <Marker key={unit.id} position={unit.pos} icon={icons[unit.type]}>
                    <Popup className="custom-popup">
                        <div className="font-bold text-slate-800">{unit.title}</div>
                    </Popup>
                </Marker>
            ))}

            {/* Dispatch Route */}
            <Polyline positions={route} color="#3b82f6" weight={4} opacity={0.7} dashArray="10, 10" />

        </MapContainer>
    );
};

export default MapComponent;
