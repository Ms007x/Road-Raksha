import React, { useState, useEffect } from 'react';
import { getAccidents, getSummaryStatistics, createWebSocket } from '../../services/api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function ControlCenterDashboard() {
    const [accidents, setAccidents] = useState([]);
    const [summary, setSummary] = useState(null);
    const [ws, setWs] = useState(null);

    useEffect(() => {
        // Load initial data
        loadData();

        // Setup WebSocket
        const websocket = createWebSocket((message) => {
            if (message.type === 'accident_detected') {
                loadData(); // Reload data on new accident
                showNotification(message.data);
            }
        }, 'control_center');

        setWs(websocket);

        return () => {
            if (websocket) websocket.close();
        };
    }, []);

    const loadData = async () => {
        try {
            const [accidentsRes, summaryRes] = await Promise.all([
                getAccidents({ limit: 10, status: 'detected' }),
                getSummaryStatistics()
            ]);
            setAccidents(accidentsRes.data);
            setSummary(summaryRes.data);
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    const showNotification = (accident) => {
        if (Notification.permission === 'granted') {
            new Notification('🚨 Accident Detected!', {
                body: `Severity: ${accident.severity} at ${accident.location}`,
                icon: '/alert-icon.png'
            });
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
                    <h1 className="text-3xl font-bold text-gray-900">
                        🚧 Road-Raksha Control Center
                    </h1>
                </div>
            </header>

            {/* Summary Cards */}
            <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div className="card">
                        <h3 className="text-sm font-medium text-gray-500">Active Cameras</h3>
                        <p className="text-3xl font-bold text-primary-600">
                            {summary?.active_cameras || 0}
                        </p>
                    </div>
                    <div className="card">
                        <h3 className="text-sm font-medium text-gray-500">Accidents Today</h3>
                        <p className="text-3xl font-bold text-danger-600">
                            {summary?.accidents_today || 0}
                        </p>
                    </div>
                    <div className="card">
                        <h3 className="text-sm font-medium text-gray-500">Active Incidents</h3>
                        <p className="text-3xl font-bold text-orange-600">
                            {summary?.active_incidents || 0}
                        </p>
                    </div>
                    <div className="card">
                        <h3 className="text-sm font-medium text-gray-500">Avg Response Time</h3>
                        <p className="text-3xl font-bold text-green-600">
                            {summary?.avg_response_time_seconds
                                ? `${Math.round(summary.avg_response_time_seconds / 60)}m`
                                : 'N/A'}
                        </p>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Live Accidents */}
                    <div className="card">
                        <h2 className="text-xl font-bold mb-4">🚨 Recent Accidents</h2>
                        <div className="space-y-3">
                            {accidents.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No active accidents</p>
                            ) : (
                                accidents.map((accident) => (
                                    <div
                                        key={accident.id}
                                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-semibold">Accident #{accident.id}</span>
                                            <span className={`badge badge-${accident.severity}`}>
                                                {accident.severity}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            Detected: {new Date(accident.detected_at).toLocaleString()}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            Confidence: {(accident.confidence_score * 100).toFixed(1)}%
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            Status: {accident.status}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Map */}
                    <div className="card">
                        <h2 className="text-xl font-bold mb-4">📍 Accident Locations</h2>
                        <div className="h-96 rounded-lg overflow-hidden">
                            <MapContainer
                                center={[28.6139, 77.2090]}
                                zoom={12}
                                style={{ height: '100%', width: '100%' }}
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                />
                                {accidents.map((accident) => (
                                    <Marker
                                        key={accident.id}
                                        position={[
                                            accident.location.coordinates[1],
                                            accident.location.coordinates[0]
                                        ]}
                                    >
                                        <Popup>
                                            <div>
                                                <strong>Accident #{accident.id}</strong>
                                                <br />
                                                Severity: {accident.severity}
                                                <br />
                                                Time: {new Date(accident.detected_at).toLocaleTimeString()}
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
