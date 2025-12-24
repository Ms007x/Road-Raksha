import React, { useState, useEffect } from 'react';
import { AlertTriangle, Ambulance, MoreHorizontal, Activity } from 'lucide-react';

const RightPanel = () => {
    const [incidents, setIncidents] = useState([]);
    const [ambulances, setAmbulances] = useState([]);
    const [activeCount, setActiveCount] = useState(0);

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch AI Status
                const aiRes = await fetch('http://localhost:8000/status');
                if (aiRes.ok) {
                    const aiData = await aiRes.json();
                    setIncidents(aiData.history || []);
                    setActiveCount(aiData.active_count || 0);
                }

                // 2. Fetch Ambulance Status
                const ambRes = await fetch('http://localhost:3000/api/ambulances');
                if (ambRes.ok) {
                    const ambData = await ambRes.json();
                    setAmbulances(ambData.data || []);
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
    }, []);

    const dispatchedCount = ambulances.filter(a => a.status !== 'Available').length;
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
                            <div key={i} className={`bg-panel/50 p-3 rounded-lg border-l-4 ${activeCount > 0 && i < activeCount ? 'border-critical' : 'border-slate-600'}`}>
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-mono text-slate-400">ID: {inc.id} | {inc.location}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs mb-2">
                                    <span className={`px-1.5 py-0.5 rounded ${activeCount > 0 && i < activeCount ? 'bg-critical/20 text-critical' : 'bg-slate-700 text-slate-400'}`}>
                                        {activeCount > 0 && i < activeCount ? 'Time: Now' : inc.timestamp}
                                    </span>
                                    <span className="text-slate-400 flex items-center gap-1">
                                        <Activity className="w-3 h-3" /> {inc.type}
                                    </span>
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
                        Dispatch Ambulance
                    </button>
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
