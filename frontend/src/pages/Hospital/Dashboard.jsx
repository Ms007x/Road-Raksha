import React, { useState, useEffect } from 'react';
import { getAccidents, createWebSocket } from '../../services/api';

export default function HospitalDashboard() {
    const [incomingAccidents, setIncomingAccidents] = useState([]);

    useEffect(() => {
        loadAccidents();

        const ws = createWebSocket((message) => {
            if (message.type === 'incoming_patient') {
                loadAccidents();
                showNotification(message.data);
            }
        }, 'hospital');

        return () => ws?.close();
    }, []);

    const loadAccidents = async () => {
        try {
            const res = await getAccidents({ status: 'dispatched', limit: 20 });
            setIncomingAccidents(res.data);
        } catch (error) {
            console.error('Error loading accidents:', error);
        }
    };

    const showNotification = (data) => {
        if (Notification.permission === 'granted') {
            new Notification('🏥 Incoming Patient', {
                body: `Severity: ${data.severity}, ETA: ${data.eta} minutes`
            });
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <h1 className="text-3xl font-bold text-gray-900">
                        🏥 Hospital Emergency Dashboard
                    </h1>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="card">
                    <h2 className="text-xl font-bold mb-4">📋 Incoming Patients</h2>
                    <div className="space-y-4">
                        {incomingAccidents.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No incoming patients</p>
                        ) : (
                            incomingAccidents.map((accident) => (
                                <div
                                    key={accident.id}
                                    className="border-l-4 border-danger-500 bg-white p-4 rounded-lg shadow"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-lg">Accident #{accident.id}</h3>
                                            <p className="text-sm text-gray-600">
                                                Detected: {new Date(accident.detected_at).toLocaleString()}
                                            </p>
                                        </div>
                                        <span className={`badge badge-${accident.severity}`}>
                                            {accident.severity}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Confidence</p>
                                            <p className="text-lg">{(accident.confidence_score * 100).toFixed(1)}%</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Ambulance</p>
                                            <p className="text-lg">
                                                {accident.ambulance_id ? `#${accident.ambulance_id}` : 'Dispatching...'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
