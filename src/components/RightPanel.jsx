import React, { useState, useEffect } from 'react';
import { AlertTriangle, Ambulance, MoreHorizontal, Activity } from 'lucide-react';

const RightPanel = ({ userLocation }) => {
    const [incidents, setIncidents] = useState([]);
    const [ambulances, setAmbulances] = useState([]);
    const [activeCount, setActiveCount] = useState(0);
    const [ambulanceServiceEnabled, setAmbulanceServiceEnabled] = useState(true);

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Incidents from Backend (for dispatch status)
                const incRes = await fetch('http://localhost:3000/api/incidents');
                if (incRes.ok) {
                    const incData = await incRes.json();
                    setIncidents(incData.data || []);
                }

                // 2. Fetch AI active count
                const aiRes = await fetch('http://localhost:8000/status');
                if (aiRes.ok) {
                    const aiData = await aiRes.json();
                    setActiveCount(aiData.active_count || 0);
                }

                // 3. Fetch Ambulance Status
                if (userLocation) {
                    const { lat, lng } = userLocation;
                    const ambRes = await fetch(`http://localhost:3000/api/ambulances?lat=${lat}&lng=${lng}`);
                    if (ambRes.ok) {
                        const ambData = await ambRes.json();
                        setAmbulances(ambData.data || []);
                    }
                }

                // 4. Fetch Ambulance Service Status
                const serviceRes = await fetch('http://localhost:3000/api/ambulance-service-status');
                if (serviceRes.ok) {
                    const serviceData = await serviceRes.json();
                    setAmbulanceServiceEnabled(serviceData.enabled);
                }
            } catch (err) {
                console.error("Failed to fetch dashboard data:", err);
            }
        };

        // Initial fetch
        fetchData();

        // Poll every 1s
        const interval = setInterval(fetchData, 1000);
        return () => clearInterval(interval);
    }, [userLocation]);

    const handleDispatch = async (incidentId) => {
        try {
            const res = await fetch(`http://localhost:3000/api/incidents/${incidentId}/dispatch`, {
                method: 'POST'
            });
            if (res.ok) {
                const data = await res.json();
                alert(`Success: ${data.message} (${data.ambulance})`);
            } else {
                const err = await res.json();
                alert(`Error: ${err.message}`);
            }
        } catch (err) {
            console.error("Dispatch failed:", err);
        }
    };

    const dispatchedCount = ambulances.filter(a => a.status !== 'Available' && a.status !== 'standby').length;
    const availableCount = ambulances.length - dispatchedCount;


    return (
        <div className="absolute top-20 right-6 z-[1000] flex flex-col gap-4 w-80 pointer-events-none">
            {/* Active Incidents */}
            <div className="bg-darker/90 backdrop-blur-md rounded-xl border border-panel-border overflow-hidden pointer-events-auto shadow-2xl">
                <div className="p-3 border-b border-panel-border flex items-center justify-between">
                    <h3 className="font-semibold text-white text-sm">Active Incidents ({activeCount})</h3>
                    {activeCount > 0 && <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-critical opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-critical"></span>
                    </span>}
                </div>
                <div className="p-2 space-y-2 max-h-60 overflow-y-auto">
                    {incidents.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 text-xs italic">
                            No recent incidents detected. System monitoring...
                        </div>
                    ) : (
                        incidents.map((inc, i) => (
                            <div key={i} className={`bg-panel/50 p-3 rounded-lg border-l-4 ${inc.status === 'Pending' ? 'border-critical' : inc.status === 'Dispatched' ? 'border-yellow-500' : 'border-success'} transition-all`}>
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[10px] font-mono text-slate-400">ID: {inc.id} | {inc.location}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${inc.status === 'Pending' ? 'bg-critical/20 text-critical' : inc.status === 'Dispatched' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-success/20 text-success'}`}>
                                        {inc.status}
                                    </span>
                                </div>
                                <div className="text-white text-xs font-medium mb-2">{inc.type} - {inc.severity}</div>
                                <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-400 bg-slate-800 px-1 py-0.5 rounded">
                                            {inc.timestamp}
                                        </span>
                                        <Activity className="w-3 h-3 text-slate-500" />
                                    </div>
                                    {inc.status === 'Pending' && (
                                        <button
                                            onClick={() => handleDispatch(inc.id)}
                                            className="w-full py-1.5 bg-critical/20 hover:bg-critical/30 text-critical text-[10px] font-bold rounded border border-critical/30 transition-colors pointer-events-auto"
                                        >
                                            Dispatch Now
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Emergency Dispatch Status */}
            <div className="bg-darker/90 backdrop-blur-md rounded-xl border border-panel-border overflow-hidden pointer-events-auto shadow-2xl">
                <div className="p-3 border-b border-panel-border flex items-center justify-between">
                    <h3 className="font-semibold text-white text-sm">Emergency Dispatch Status</h3>
                    <MoreHorizontal className="w-4 h-4 text-slate-400 cursor-pointer" />
                </div>
                <div className="p-4 space-y-4">
                    {!ambulanceServiceEnabled && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-3">
                            <div className="flex items-center gap-2 text-yellow-500 text-xs">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="font-medium">Ambulance Services Disabled</span>
                            </div>
                            <p className="text-[10px] text-yellow-500/80 mt-1">Enable in Settings to resume tracking</p>
                        </div>
                    )}
                    <div>
                        <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-slate-300">Ambulances: {availableCount}/{ambulances.length} Available</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden flex">
                            <div className="bg-info h-full transition-all duration-500" style={{ width: `${(dispatchedCount / (ambulances.length || 1)) * 100}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[10px] mt-1 text-slate-500">
                            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-info"></div>Dispatched: {dispatchedCount}</div>
                            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>Available: {availableCount}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Links */}
            <div className="bg-darker/90 backdrop-blur-md rounded-xl border border-panel-border overflow-hidden pointer-events-auto shadow-2xl">
                <div className="p-3 border-b border-panel-border flex items-center justify-between">
                    <h3 className="font-semibold text-white text-sm">Quick Links</h3>
                </div>
                <div className="p-3 space-y-2">
                    <button className="w-full py-2 bg-panel hover:bg-slate-700 border border-panel-border rounded text-sm text-slate-300 transition-colors">
                        Contact Police HQ
                    </button>
                    <button className="w-full py-2 bg-panel hover:bg-slate-700 border border-panel-border rounded text-sm text-slate-300 transition-colors">
                        Broadcast Traffic Alert
                    </button>
                </div>
            </div>


            {/* Legend */}
            <div className="bg-darker/90 backdrop-blur-md rounded-xl border border-panel-border p-3 pointer-events-auto shadow-2xl">
                <h4 className="text-xs font-semibold text-slate-300 mb-2">Legend</h4>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <div className="w-2 h-2 rounded-full bg-critical"></div> Red: Critical Accident
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <div className="w-2 h-2 rounded-full bg-success"></div> Green: Vehicles/Animals
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <div className="w-2 h-2 rounded-full bg-info"></div> Blue: People
                    </div>
                </div>
            </div>

        </div>
    );
};

export default RightPanel;
