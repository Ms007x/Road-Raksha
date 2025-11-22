import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import { calculateRoute, createWebSocket } from '../../services/api';
import 'leaflet/dist/leaflet.css';

export default function AmbulanceDashboard() {
    const [currentLocation, setCurrentLocation] = useState([28.6139, 77.2090]);
    const [accidentLocation, setAccidentLocation] = useState(null);
    const [hospitalLocation, setHospitalLocation] = useState(null);
    const [route, setRoute] = useState(null);
    const [dispatchInfo, setDispatchInfo] = useState(null);

    useEffect(() => {
        const ws = createWebSocket((message) => {
            if (message.type === 'dispatch_order') {
                handleDispatch(message.data);
            }
        }, 'ambulance');

        return () => ws?.close();
    }, []);

    const handleDispatch = async (data) => {
        setDispatchInfo(data);
        setAccidentLocation([data.accident_location.latitude, data.accident_location.longitude]);

        // Calculate route
        try {
            const routeRes = await calculateRoute(
                { latitude: currentLocation[0], longitude: currentLocation[1] },
                data.accident_location
            );
            setRoute(routeRes.data.geometry.coordinates.map(coord => [coord[1], coord[0]]));
        } catch (error) {
            console.error('Error calculating route:', error);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <h1 className="text-3xl font-bold text-gray-900">
                        🚑 Ambulance Navigation
                    </h1>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-6">
                {dispatchInfo ? (
                    <div className="space-y-6">
                        {/* Dispatch Info */}
                        <div className="card bg-danger-50 border-2 border-danger-500">
                            <h2 className="text-xl font-bold text-danger-900 mb-2">
                                🚨 ACTIVE DISPATCH
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium">Accident ID</p>
                                    <p className="text-lg font-bold">#{dispatchInfo.accident_id}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Severity</p>
                                    <span className={`badge badge-${dispatchInfo.severity}`}>
                                        {dispatchInfo.severity}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Distance</p>
                                    <p className="text-lg font-bold">
                                        {dispatchInfo.distance ? `${(dispatchInfo.distance / 1000).toFixed(1)} km` : 'Calculating...'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">ETA</p>
                                    <p className="text-lg font-bold">
                                        {dispatchInfo.eta ? `${Math.round(dispatchInfo.eta / 60)} min` : 'Calculating...'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Map */}
                        <div className="card">
                            <h2 className="text-xl font-bold mb-4">📍 Navigation</h2>
                            <div className="h-96 rounded-lg overflow-hidden">
                                <MapContainer
                                    center={currentLocation}
                                    zoom={13}
                                    style={{ height: '100%', width: '100%' }}
                                >
                                    <TileLayer
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                    {/* Current location */}
                                    <Marker position={currentLocation}>
                                        <div className="text-2xl">🚑</div>
                                    </Marker>
                                    {/* Accident location */}
                                    {accidentLocation && (
                                        <Marker position={accidentLocation}>
                                            <div className="text-2xl">🚨</div>
                                        </Marker>
                                    )}
                                    {/* Route */}
                                    {route && (
                                        <Polyline positions={route} color="blue" weight={4} />
                                    )}
                                </MapContainer>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="card text-center py-12">
                        <p className="text-gray-500 text-lg">Waiting for dispatch...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
