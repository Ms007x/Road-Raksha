import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Ambulance, Phone, Navigation, AlertCircle, CheckCircle, Clock, MapPin, Hospital, User, LogOut, Menu, X, ChevronRight, AlertTriangle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom ambulance icon
const ambulanceIcon = new L.DivIcon({
    className: 'custom-ambulance-marker',
    html: `<div style="background: #ef4444; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 6v8"/>
            <path d="M6 8h4"/>
            <path d="M12 16h4"/>
            <path d="M16 14v4"/>
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <circle cx="7" cy="20" r="2"/>
            <circle cx="17" cy="20" r="2"/>
        </svg>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
});

const incidentIcon = new L.DivIcon({
    className: 'custom-incident-marker',
    html: `<div style="background: #dc2626; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3); animation: pulse 2s infinite;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <line x1="12" x2="12" y1="9" y2="13"/>
            <line x1="12" x2="12.01" y1="17" y2="17"/>
        </svg>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
});

const hospitalIcon = new L.DivIcon({
    className: 'custom-hospital-marker',
    html: `<div style="background: #2563eb; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 6v8"/>
            <path d="M6 8h4"/>
            <path d="M12 16h4"/>
            <path d="M16 14v4"/>
            <path d="M18 22V8a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/>
            <path d="M2 22h20"/>
        </svg>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
});

// Map center updater component
const MapUpdater = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.setView(center, map.getZoom());
        }
    }, [center, map]);
    return null;
};

const DriverPage = () => {
    const [ambulanceId, setAmbulanceId] = useState(localStorage.getItem('driverAmbulanceId') || '');
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('driverAmbulanceId'));
    const [location, setLocation] = useState(null);
    const [status, setStatus] = useState('standby');
    const [assignedIncident, setAssignedIncident] = useState(null);
    const [route, setRoute] = useState([]);
    const [hospitals, setHospitals] = useState([]);
    const [showMenu, setShowMenu] = useState(false);
    const [eta, setEta] = useState(null);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const updateInterval = useRef(null);

    const statusOptions = [
        { value: 'standby', label: 'Standby', color: 'bg-slate-500', icon: Clock },
        { value: 'on_call', label: 'En Route to Incident', color: 'bg-amber-500', icon: Navigation },
        { value: 'at_incident', label: 'At Incident Scene', color: 'bg-red-500', icon: AlertCircle },
        { value: 'to_hospital', label: 'En Route to Hospital', color: 'bg-blue-500', icon: Hospital },
    ];

    // Get current location
    useEffect(() => {
        if (!isLoggedIn) return;

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setLocation(loc);
                setError(null);
            },
            (err) => {
                setError('Unable to access GPS location');
                console.error('GPS error:', err);
            },
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [isLoggedIn]);

    // Fetch assigned incident and update status
    useEffect(() => {
        if (!isLoggedIn || !location) return;

        const fetchStatus = async () => {
            try {
                const res = await fetch(`http://localhost:3000/api/ambulances?lat=${location.lat}&lng=${location.lng}`);
                const data = await res.json();
                
                if (data.success && data.data) {
                    const myAmbulance = data.data.find(a => a.id === ambulanceId || a.service_name === ambulanceId);
                    if (myAmbulance) {
                        setStatus(myAmbulance.status);
                        setLastUpdate(new Date());
                        
                        if (myAmbulance.route && myAmbulance.route.length > 0) {
                            setRoute(myAmbulance.route);
                        }

                        // Fetch incident details if assigned
                        if (myAmbulance.assignedIncidentId) {
                            const incRes = await fetch('http://localhost:3000/api/incidents');
                            const incData = await incRes.json();
                            if (incData.success) {
                                const incident = incData.data.find(i => i.id === myAmbulance.assignedIncidentId);
                                setAssignedIncident(incident);
                                
                                // Calculate ETA
                                if (myAmbulance.speed > 0 && incident) {
                                    const dist = calculateDistance(
                                        location.lat, location.lng,
                                        incident.latitude, incident.longitude
                                    );
                                    const etaMinutes = Math.ceil((dist / myAmbulance.speed) * 60);
                                    setEta(etaMinutes);
                                }
                            }
                        } else {
                            setAssignedIncident(null);
                            setEta(null);
                        }
                    }
                }
            } catch (err) {
                console.error('Status fetch error:', err);
            }
        };

        fetchStatus();
        updateInterval.current = setInterval(fetchStatus, 5000);

        return () => clearInterval(updateInterval.current);
    }, [isLoggedIn, location, ambulanceId]);

    // Fetch nearby hospitals
    useEffect(() => {
        if (!isLoggedIn || !location) return;

        const fetchHospitals = async () => {
            try {
                const res = await fetch('http://localhost:3000/api/hospitals');
                const data = await res.json();
                if (data.success) {
                    // Sort by distance
                    const sorted = data.data.map(h => ({
                        ...h,
                        distance: calculateDistance(location.lat, location.lng, h.lat, h.lng)
                    })).sort((a, b) => a.distance - b.distance);
                    setHospitals(sorted.slice(0, 5));
                }
            } catch (err) {
                console.error('Hospitals fetch error:', err);
            }
        };

        fetchHospitals();
    }, [isLoggedIn, location]);

    const calculateDistance = (lat1, lng1, lat2, lng2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    const handleLogin = () => {
        if (ambulanceId.trim()) {
            localStorage.setItem('driverAmbulanceId', ambulanceId.trim());
            setIsLoggedIn(true);
            setError(null);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('driverAmbulanceId');
        setIsLoggedIn(false);
        setAmbulanceId('');
        setAssignedIncident(null);
        clearInterval(updateInterval.current);
    };

    const updateAmbulanceStatus = async (newStatus) => {
        if (!location) return;
        
        try {
            await fetch(`http://localhost:3000/api/driver/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ambulanceId,
                    status: newStatus,
                    lat: location.lat,
                    lng: location.lng
                })
            });
            setStatus(newStatus);
        } catch (err) {
            console.error('Status update error:', err);
        }
    };

    const navigateTo = (lat, lng, label) => {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
        window.open(url, '_blank');
    };

    const currentStatus = statusOptions.find(s => s.value === status) || statusOptions[0];
    const StatusIcon = currentStatus.icon;

    // Login screen
    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-8 shadow-2xl">
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center">
                            <Ambulance className="w-10 h-10 text-white" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-white text-center mb-2">Driver Login</h1>
                    <p className="text-slate-400 text-center mb-6">Enter your ambulance ID</p>
                    
                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}
                    
                    <input
                        type="text"
                        value={ambulanceId}
                        onChange={(e) => setAmbulanceId(e.target.value)}
                        placeholder="Ambulance ID (e.g., AP-01-1234)"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-red-500 mb-4"
                        onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    />
                    <button
                        onClick={handleLogin}
                        className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-lg transition-colors"
                    >
                        Start Shift
                    </button>
                </div>
            </div>
        );
    }

    // Main driver interface
    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">
            {/* Header */}
            <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-slate-700 rounded-lg">
                        {showMenu ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
                    </button>
                    <div className="flex items-center gap-2">
                        <Ambulance className="w-6 h-6 text-red-500" />
                        <span className="text-white font-semibold">{ambulanceId}</span>
                    </div>
                </div>
                <div className={`px-3 py-1 rounded-full ${currentStatus.color} flex items-center gap-2`}>
                    <StatusIcon className="w-4 h-4 text-white" />
                    <span className="text-white text-sm font-medium">{currentStatus.label}</span>
                </div>
            </header>

            {/* Side Menu */}
            {showMenu && (
                <div className="absolute top-14 left-0 right-0 bg-slate-800 border-b border-slate-700 z-50 p-4 shadow-xl">
                    <div className="space-y-3">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-slate-700 rounded-lg"
                        >
                            <LogOut className="w-5 h-5" />
                            <span>End Shift / Logout</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Map */}
            <div className="flex-1 relative">
                {location && (
                    <MapContainer
                        center={[location.lat, location.lng]}
                        zoom={14}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapUpdater center={[location.lat, location.lng]} />
                        
                        {/* Ambulance marker */}
                        <Marker position={[location.lat, location.lng]} icon={ambulanceIcon}>
                            <Popup>
                                <div className="text-sm">
                                    <p className="font-semibold">Your Ambulance</p>
                                    <p className="text-slate-600">{ambulanceId}</p>
                                    <p className="text-slate-500 text-xs mt-1">
                                        {lastUpdate ? `Updated: ${lastUpdate.toLocaleTimeString()}` : 'Updating...'}
                                    </p>
                                </div>
                            </Popup>
                        </Marker>

                        {/* Incident marker */}
                        {assignedIncident && assignedIncident.latitude && (
                            <Marker 
                                position={[assignedIncident.latitude, assignedIncident.longitude]} 
                                icon={incidentIcon}
                            >
                                <Popup>
                                    <div className="text-sm">
                                        <p className="font-semibold text-red-600">Incident #{assignedIncident.id}</p>
                                        <p className="text-slate-700">{assignedIncident.type}</p>
                                        <p className="text-slate-600 text-xs">{assignedIncident.severity}</p>
                                        {eta && <p className="text-amber-600 font-medium mt-1">ETA: {eta} min</p>}
                                    </div>
                                </Popup>
                            </Marker>
                        )}

                        {/* Route polyline */}
                        {route.length > 0 && (
                            <Polyline 
                                positions={route.map(r => [r.lat, r.lng])} 
                                color="#ef4444" 
                                weight={4}
                                opacity={0.8}
                            />
                        )}

                        {/* Hospital markers */}
                        {hospitals.map(h => (
                            <Marker key={h.id} position={[h.lat, h.lng]} icon={hospitalIcon}>
                                <Popup>
                                    <div className="text-sm">
                                        <p className="font-semibold text-blue-600">{h.name}</p>
                                        <p className="text-slate-600">{h.distance?.toFixed(1)} km away</p>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                )}

                {/* Loading indicator */}
                {!location && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
                            <p className="text-slate-400">Getting your location...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Panel - Incident Details */}
            {assignedIncident && (
                <div className="bg-slate-800 border-t border-slate-700 p-4">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                <h3 className="text-white font-semibold">Active Incident #{assignedIncident.id}</h3>
                            </div>
                            <p className="text-slate-400 text-sm">{assignedIncident.type} • {assignedIncident.severity}</p>
                            {eta && (
                                <p className="text-amber-400 text-sm font-medium mt-1">
                                    ETA: {eta} minutes away
                                </p>
                            )}
                        </div>
                        <button
                            onClick={() => navigateTo(assignedIncident.latitude, assignedIncident.longitude, 'Incident')}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                        >
                            <Navigation className="w-4 h-4" />
                            Navigate
                        </button>
                    </div>
                    <p className="text-slate-400 text-sm mb-3">{assignedIncident.location}</p>
                    
                    {/* Quick Actions */}
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => updateAmbulanceStatus('at_incident')}
                            className="bg-red-500/20 border border-red-500/50 text-red-400 py-2 rounded-lg text-sm font-medium"
                        >
                            Arrived
                        </button>
                        <button
                            onClick={() => updateAmbulanceStatus('to_hospital')}
                            className="bg-blue-500/20 border border-blue-500/50 text-blue-400 py-2 rounded-lg text-sm font-medium"
                        >
                            To Hospital
                        </button>
                        <button
                            onClick={() => updateAmbulanceStatus('standby')}
                            className="bg-green-500/20 border border-green-500/50 text-green-400 py-2 rounded-lg text-sm font-medium"
                        >
                            Complete
                        </button>
                    </div>
                </div>
            )}

            {/* No Incident State */}
            {!assignedIncident && location && (
                <div className="bg-slate-800 border-t border-slate-700 p-4">
                    <div className="text-center py-4">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <h3 className="text-white font-semibold mb-1">No Active Assignment</h3>
                        <p className="text-slate-400 text-sm">You're on standby. Wait for dispatch.</p>
                    </div>
                    
                    {/* Nearby Hospitals */}
                    {hospitals.length > 0 && (
                        <div className="mt-4">
                            <h4 className="text-slate-300 text-sm font-medium mb-2">Nearby Hospitals</h4>
                            <div className="space-y-2">
                                {hospitals.slice(0, 3).map(h => (
                                    <button
                                        key={h.id}
                                        onClick={() => navigateTo(h.lat, h.lng, h.name)}
                                        className="w-full flex items-center justify-between bg-slate-700 hover:bg-slate-600 p-3 rounded-lg transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Hospital className="w-5 h-5 text-blue-400" />
                                            <div className="text-left">
                                                <p className="text-white text-sm font-medium">{h.name}</p>
                                                <p className="text-slate-400 text-xs">{h.distance?.toFixed(1)} km away</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-400" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DriverPage;
