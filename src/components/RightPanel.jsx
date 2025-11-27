import React from 'react';
import { AlertTriangle, Ambulance, MoreHorizontal } from 'lucide-react';

const RightPanel = () => {
    return (
        <div className="absolute top-20 right-6 z-[1000] flex flex-col gap-4 w-80 pointer-events-none">
            {/* Active Incidents */}
            <div className="bg-darker/90 backdrop-blur-md rounded-xl border border-panel-border overflow-hidden pointer-events-auto shadow-2xl">
                <div className="p-3 border-b border-panel-border flex items-center justify-between">
                    <h3 className="font-semibold text-white text-sm">Active Incidents (5)</h3>
                    <MoreHorizontal className="w-4 h-4 text-slate-400 cursor-pointer" />
                </div>
                <div className="p-2 space-y-2">
                    <div className="bg-panel/50 p-3 rounded-lg border-l-4 border-critical">
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-mono text-slate-400">INC-001 | Main St & 4th Ave</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs mb-2">
                            <span className="bg-critical/20 text-critical px-1.5 py-0.5 rounded">Critical</span>
                            <span className="bg-success/20 text-success px-1.5 py-0.5 rounded">Dispatched</span>
                            <span className="text-slate-400">2m ago</span>
                        </div>
                        <div className="flex justify-end">
                            <button className="text-xs text-info hover:underline">[View]</button>
                        </div>
                    </div>

                    <div className="bg-panel/50 p-3 rounded-lg border-l-4 border-warning">
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-mono text-slate-400">INC-002 | Highway 8 Exit</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs mb-2">
                            <span className="bg-warning/20 text-warning px-1.5 py-0.5 rounded">Minor</span>
                            <span className="bg-warning/20 text-warning px-1.5 py-0.5 rounded">Pending</span>
                            <span className="text-slate-400">5m ago</span>
                        </div>
                        <div className="flex justify-end">
                            <button className="text-xs text-info hover:underline">[View]</button>
                        </div>
                    </div>
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
                            <span className="text-slate-300">Ambulances: 5/8 Available</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden flex">
                            <div className="w-[62%] bg-info h-full"></div>
                        </div>
                        <div className="flex justify-between text-[10px] mt-1 text-slate-500">
                            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-info"></div>Dispatched</div>
                            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>Available</div>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-slate-300">Hospitals: 3 Nearby, 1 Alerted</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden flex">
                            <div className="w-[75%] bg-info h-full"></div>
                            <div className="w-[15%] bg-orange-500 h-full"></div>
                        </div>
                        <div className="space-y-1 mt-2">
                            <div className="flex items-center gap-2 text-[11px] text-orange-400">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                                City General (Alerted)
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-success">
                                <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                                Trauma Center (Available)
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Links */}
            <div className="bg-darker/90 backdrop-blur-md rounded-xl border border-panel-border overflow-hidden pointer-events-auto shadow-2xl">
                <div className="p-3 border-b border-panel-border flex items-center justify-between">
                    <h3 className="font-semibold text-white text-sm">Quick Links</h3>
                    <MoreHorizontal className="w-4 h-4 text-slate-400 cursor-pointer" />
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
                    <button className="w-full py-2 bg-panel hover:bg-slate-700 border border-panel-border rounded text-sm text-slate-300 transition-colors">
                        View All Cams
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
                        <div className="w-2 h-2 rounded-full bg-warning"></div> Yellow: Minor Accident
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <div className="w-2 h-2 rounded-full bg-success"></div> Green: Available Unit
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <div className="w-2 h-2 rounded-full bg-info"></div> Blue: Dispatched Unit
                    </div>
                </div>
            </div>

        </div>
    );
};

export default RightPanel;
