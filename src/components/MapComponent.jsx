import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

// Custom Icons
const ambulanceIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2983/2983636.png', // Replacement Ambulance Icon
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [1, -34],
});

const hospitalIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/4320/4320350.png', // Replacement Hospital Icon
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [1, -34],
});


const RecenterMap = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        if (lat && lng) {
            map.flyTo([lat, lng], 13);
        }
    }, [lat, lng, map]);
    return null;
};

const MapComponent = () => {
    const [userLocation, setUserLocation] = useState(null);
    const [ambulances, setAmbulances] = useState([]);
    const [hospitals, setHospitals] = useState([]);

    // 1. Get User Location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setUserLocation({ lat: latitude, lng: longitude });
                },
                (error) => console.error(error)
            );
        }
    }, []);

    // 2. Fetch Ambulances (Backend) & Hospitals (Overpass API)
    useEffect(() => {
        const fetchAmbulances = async () => {
            try {
                const lat = userLocation ? userLocation.lat : 28.6139;
                const lng = userLocation ? userLocation.lng : 77.2090;

                const res = await fetch(`http://localhost:3000/api/ambulances?lat=${lat}&lng=${lng}`);
                const data = await res.json();
                if (data.success) {
                    setAmbulances(data.data);
                }
            } catch (err) {
                console.error("Failed to fetch ambulances", err);
            }
        };

        const fetchHospitals = async () => {
            if (!userLocation) return;
            try {
                const query = `
                    [out:json];
                    (
                      node["amenity"="hospital"](around:5000, ${userLocation.lat}, ${userLocation.lng});
                      way["amenity"="hospital"](around:5000, ${userLocation.lat}, ${userLocation.lng});
                      relation["amenity"="hospital"](around:5000, ${userLocation.lat}, ${userLocation.lng});
                    );
                    out center;
                `;
                const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
                const res = await fetch(url);
                const data = await res.json();

                if (data.elements) {
                    const mappedHospitals = data.elements.map(el => ({
                        id: el.id,
                        name: el.tags.name || "Unknown Hospital",
                        lat: el.lat || el.center.lat,
                        lng: el.lon || el.center.lon,
                        beds: "Unknown", // Overpass doesn't usually have this
                        type: el.tags.healthcare || "Hospital"
                    }));
                    setHospitals(mappedHospitals);
                }
            } catch (err) {
                console.error("Failed to fetch hospitals from OSM", err);
            }
        };

        fetchAmbulances();
        // Initial Hospital Fetch
        fetchHospitals();

        const interval = setInterval(fetchAmbulances, 2000);
        return () => clearInterval(interval);

    }, [userLocation]);


    const center = userLocation ? [userLocation.lat, userLocation.lng] : [28.6139, 77.2090];

    return (
        <div className="w-full h-full">
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

                {/* User Marker */}
                {userLocation && (
                    <Marker position={[userLocation.lat, userLocation.lng]}>
                        <Popup>You are here</Popup>
                    </Marker>
                )}

                {/* Ambulances */}
                {ambulances.map(amb => (
                    <Marker
                        key={amb.id}
                        position={[amb.location.lat, amb.location.lng]}
                        icon={ambulanceIcon}
                    >
                        <Tooltip direction="top" offset={[0, -20]} opacity={1}>
                            <div className="font-bold text-sm">{amb.id}</div>
                            <div className={`text-xs ${amb.status === 'Available' ? 'text-green-600' : 'text-red-600'}`}>
                                {amb.status}
                            </div>
                        </Tooltip>
                        <Popup>
                            <strong>{amb.id}</strong><br />
                            Driver: {amb.driverName}<br />
                            Status: {amb.status}<br />
                            Speed: {amb.speed} km/h
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
