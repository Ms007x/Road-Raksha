import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { RefreshCw, Search } from 'lucide-react';

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

// Custom Icons Generator
const createAmbulanceIcon = (status, heading) => {
    // Determine color based on status
    // Moving: Blue, Standby: Green, On Call: Red
    let iconUrl = '/ambulance-marker.png'; // User Provided Icon

    // We can filter by hue or use different images. For simplicity, we use the same icon but maybe we can rotate it?
    // Or we use different colored icons from a CDN if available.
    // Let's use specific colored markers if possible, or just standard icon with CSS rotation.

    // Status Logic for Color (Visual only via class/filter if SVG, but here PNG)
    // Detailed Ambulance: https://cdn-icons-png.flaticon.com/512/2983/2983636.png

    return new L.DivIcon({
        className: 'custom-amb-icon',
        html: `<div style="transform: rotate(${heading - 90}deg); transition: transform 0.5s;">
                 <img src="${iconUrl}" style="width: 45px; height: 45px; ${status === 'standby' ? 'filter: grayscale(100%);' : ''}">
               </div>`,
        iconSize: [45, 45],
        iconAnchor: [22, 22], // Center rotation
        popupAnchor: [0, -22],
    });
};

const hospitalIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/504/504276.png', // Hospital H Symbol
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
    const [scrapedCity, setScrapedCity] = useState(null);
    const [isScraping, setIsScraping] = useState(false);

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

    // 2. Fetch Data
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

    // Trigger Scrape
    const handleScrape = async () => {
        if (!userLocation) return;
        setIsScraping(true);
        try {
            const res = await fetch('http://localhost:3000/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userLocation)
            });
            const data = await res.json();
            if (data.success) {
                setScrapedCity(data.city);
                await fetchAmbulances(); // Refresh immediately
            }
        } catch (e) {
            console.error("Scrape failed", e);
        } finally {
            setIsScraping(false);
        }
    };

    useEffect(() => {
        // Initial Fetch with Auto-Scrape check
        const init = async () => {
            if (!userLocation) return;

            // 1. Fetch existing
            await fetchAmbulances();

            // 2. If empty, trigger auto-scrape
            const lat = userLocation.lat;
            const lng = userLocation.lng;
            try {
                const res = await fetch(`http://localhost:3000/api/ambulances?lat=${lat}&lng=${lng}`);
                const data = await res.json();
                if (data.success && data.data.length === 0) {
                    console.log("No data found. Triggering Auto-Scrape...");
                    handleScrape();
                }
            } catch (e) { console.error("Auto-scrape check failed", e); }
        };

        if (userLocation) {
            init();
        }

        // Initial Hospital Fetch (same as before)
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
                        beds: "Unknown",
                        type: el.tags.healthcare || "Hospital"
                    }));
                    setHospitals(mappedHospitals);
                }
            } catch (err) {
                console.error("Failed to fetch hospitals from OSM", err);
            }
        };
        fetchHospitals();

        const interval = setInterval(fetchAmbulances, 2000);
        return () => clearInterval(interval);

    }, [userLocation]);


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
            {/* Scrape Control Overlay */}
            <div className="absolute top-4 right-4 z-[1000] bg-white p-2 rounded-lg shadow-md flex flex-col gap-2">
                <button
                    onClick={handleScrape}
                    disabled={isScraping}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-white font-bold transition-all ${isScraping ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                    {isScraping ? <RefreshCw className="animate-spin w-5 h-5" /> : <Search className="w-5 h-5" />}
                    {isScraping ? "Scanning Area..." : "Scan for Ambulances"}
                </button>
                {scrapedCity && <div className="text-xs text-gray-500 text-center">Data source: JustDial ({scrapedCity})</div>}
            </div>

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
                        icon={createAmbulanceIcon(amb.status, amb.heading || 0)}
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
