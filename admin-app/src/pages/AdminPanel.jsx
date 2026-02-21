import React, { useState, useEffect } from 'react';
import {
    Trash2, Plus, Save, Edit, RefreshCw, Activity, MapPin,
    Ambulance, AlertTriangle, Video, Map, Download, Send, RotateCcw
} from 'lucide-react';

const ADMIN_API_BASE = 'http://localhost:3001';

const AdminPanel = () => {
    const [activeTab, setActiveTab] = useState('monitor');

    // Data States
    const [systemHealth, setSystemHealth] = useState(null);
    const [ambulances, setAmbulances] = useState([]);
    const [hospitals, setHospitals] = useState([]);
    const [cameras, setCameras] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [geofence, setGeofence] = useState(null);

    const [loading, setLoading] = useState(false);

    // Form & Modal States
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({});

    // Dispatch Modal State
    const [showDispatchModal, setShowDispatchModal] = useState(false);
    const [selectedAmbulance, setSelectedAmbulance] = useState(null);
    const [dispatchIncidentId, setDispatchIncidentId] = useState('');

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Auto-refresh every 10s
        return () => clearInterval(interval);
    }, [activeTab]);

    const fetchData = async () => {
        try {
            if (activeTab === 'monitor') {
                const [healthRes, geoRes] = await Promise.all([
                    fetch(`${ADMIN_API_BASE}/api/admin/system/health`),
                    fetch(`${ADMIN_API_BASE}/api/admin/geofence`)
                ]);
                setSystemHealth(await healthRes.json());
                setGeofence(await geoRes.json());
            } else if (activeTab === 'fleet') {
                const res = await fetch(`${ADMIN_API_BASE}/api/admin/ambulances`);
                const data = await res.json();
                setAmbulances(data.data || []);
            } else if (activeTab === 'hospitals') {
                const res = await fetch(`${ADMIN_API_BASE}/api/admin/hospitals`);
                const data = await res.json();
                setHospitals(data.data || []);
            } else if (activeTab === 'cameras') {
                const res = await fetch(`${ADMIN_API_BASE}/api/admin/cameras`);
                const data = await res.json();
                setCameras(data.data || []);
            } else if (activeTab === 'incidents') {
                const res = await fetch(`${ADMIN_API_BASE}/api/incidents`);
                const data = await res.json();
                setIncidents(data.data || []);
            }
        } catch (error) {
            console.error("Fetch error:", error);
        }
    };

    // --- Actions ---

    const handleDelete = async (type, id) => {
        if (!window.confirm("Delete this item?")) return;
        let endpoint = `/api/admin/${type}/${id}`;
        if (type === 'incidents') endpoint = `/api/admin/incidents/${id}`; // Adjust if needed
        try {
            await fetch(`${ADMIN_API_BASE}${endpoint}`, { method: 'DELETE' });
            fetchData();
        } catch (error) { }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const method = editingItem ? 'PUT' : 'POST';
            const endpoint = `/api/admin/${activeTab}${editingItem ? `/${editingItem.id}` : ''}`;
            const res = await fetch(`${ADMIN_API_BASE}${endpoint}`, {
                method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
            });
            if (res.ok) {
                setShowForm(false);
                fetchData();
            }
        } catch (error) { }
    };

    // Advanced Actions
    const handleRecall = async (id) => {
        if (!window.confirm("Recall this ambulance to standby?")) return;
        try {
            await fetch(`${ADMIN_API_BASE}/api/admin/recall/${id}`, { method: 'POST' });
            fetchData();
        } catch (e) { }
    };

    const handleForceDispatch = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${ADMIN_API_BASE}/api/admin/dispatch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ambulanceId: selectedAmbulance.id, incidentId: dispatchIncidentId })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                setShowDispatchModal(false);
                fetchData();
            } else {
                alert("Error: " + data.error);
            }
        } catch (e) { }
    };

    const handleStatusChange = async (incidentId, newStatus) => {
        try {
            await fetch(`${ADMIN_API_BASE}/api/admin/incidents/${incidentId}/status`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            fetchData();
        } catch (e) { }
    };

    const toggleAmbulanceService = async () => {
        const newState = !systemHealth.servicesEnabled;
        try {
            await fetch(`${ADMIN_API_BASE}/api/set-ambulance-service`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newState })
            });
            fetchData();
        } catch (e) { }
    };

    const handleHospitalRefresh = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${ADMIN_API_BASE}/api/admin/hospitals/refresh`, { method: 'POST' });
            const data = await res.json();
            alert(data.message || data.error);
            fetchData();
        } catch (e) {
        } finally {
            setLoading(false);
        }
    };

    const handleGeofenceUpdate = async (e) => {
        e.preventDefault();
        try {
            await fetch(`${ADMIN_API_BASE}/api/admin/geofence`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            setShowForm(false);
            fetchData();
        } catch (e) { }
    };

    const handleClearAllIncidents = async () => {
        if (!window.confirm("WARNING: Purge all history?")) return;
        await fetch(`${ADMIN_API_BASE}/api/incidents`, { method: 'DELETE' });
        fetchData();
    };

    // --- Renderers ---

    const renderMonitor = () => {
        if (!systemHealth) return <div className="animate-pulse flex space-x-4"><div className="h-32 bg-slate-800/50 rounded-2xl w-full"></div></div>;
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-slate-800/40 backdrop-blur-md border border-white/5 hover:border-indigo-500/30 rounded-2xl p-7 transition-all duration-300 hover:shadow-[0_0_30px_rgba(79,70,229,0.1)] group cursor-default">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-slate-400 text-sm font-semibold tracking-wide uppercase">System Uptime</p>
                            <h3 className="text-3xl font-extrabold text-white mt-2 font-mono tracking-tight group-hover:text-indigo-200 transition-colors">
                                {Math.floor(systemHealth.uptime / 60)}m {Math.floor(systemHealth.uptime % 60)}s
                            </h3>
                        </div>
                        <div className="p-3.5 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all shadow-[0_0_15px_rgba(59,130,246,0)] group-hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]"><Activity size={24} /></div>
                    </div>
                </div>

                <div className="bg-slate-800/40 backdrop-blur-md border border-white/5 hover:border-emerald-500/30 rounded-2xl p-7 transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] group">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-slate-400 text-sm font-semibold tracking-wide uppercase">Auto-Dispatch</p>
                            <h3 className={`text-2xl font-black tracking-widest mt-2 ${systemHealth.servicesEnabled ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`}>
                                {systemHealth.servicesEnabled ? 'ONLINE' : 'OFFLINE'}
                            </h3>
                        </div>
                        <button onClick={toggleAmbulanceService} className="text-xs font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg transition-all active:scale-95 text-slate-300 hover:text-white">Toggle</button>
                    </div>
                </div>

                <div className="bg-slate-800/40 backdrop-blur-md border border-white/5 hover:border-purple-500/30 rounded-2xl p-7 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.1)] group">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-slate-400 text-sm font-semibold tracking-wide uppercase">Geofence Lock</p>
                            <h3 className={`text-2xl font-black tracking-widest mt-2 ${geofence?.active ? 'text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]' : 'text-yellow-400'}`}>
                                {geofence?.active ? 'ACTIVE' : 'WAITING'}
                            </h3>
                            {geofence?.active && <p className="text-xs font-mono text-slate-400 mt-2 bg-black/30 border border-white/5 inline-block px-2.5 py-1 rounded-md">{geofence.center.lat.toFixed(3)}, {geofence.center.lng.toFixed(3)}</p>}
                        </div>
                        <button
                            onClick={() => { setFormData({ lat: geofence?.center?.lat || 0, lng: geofence?.center?.lng || 0 }); setEditingItem('geofence'); setShowForm(true); }}
                            className="p-3.5 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20 hover:scale-110 hover:bg-purple-500/20 transition-all cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0)] hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                        ><MapPin size={24} /></button>
                    </div>
                </div>

                <div className="bg-slate-800/40 backdrop-blur-md border border-white/5 hover:border-amber-500/30 rounded-2xl p-7 transition-all duration-300 hover:shadow-[0_0_30px_rgba(245,158,11,0.1)] group">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-slate-400 text-sm font-semibold tracking-wide uppercase">OSRM Queue</p>
                            <div className="flex items-baseline gap-2 mt-2">
                                <h3 className="text-4xl font-black text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">{systemHealth.activeRouteFetches}</h3>
                                <span className="text-sm text-slate-500 font-bold uppercase tracking-widest">/ 3 max</span>
                            </div>
                        </div>
                        <div className="p-3.5 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20 group-hover:scale-110 group-hover:bg-amber-500/20 transition-all shadow-[0_0_15px_rgba(245,158,11,0)] group-hover:shadow-[0_0_15px_rgba(245,158,11,0.3)]"><Map size={24} /></div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0a0a1a] to-slate-900 text-slate-100 font-sans selection:bg-indigo-500/30">
            {/* Header */}
            <div className="bg-slate-950/50 backdrop-blur-xl border-b border-white/10 px-8 py-5 flex justify-between items-center sticky top-0 z-40 shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 border border-white/10 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        <Activity className="text-white relative z-10" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold bg-gradient-to-r from-white via-indigo-200 to-violet-300 bg-clip-text text-transparent tracking-tight">Nexus Control</h1>
                        <p className="text-xs text-indigo-400/80 font-bold uppercase tracking-widest mt-0.5">System Administration</p>
                    </div>
                </div>
                <div className="flex items-center gap-6 text-sm font-medium">
                    <div className="flex items-center gap-3 px-4 py-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)] backdrop-blur-sm">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)] animate-pulse" />
                        SysOps Port {ADMIN_API_BASE.split(':').pop()}
                    </div>
                </div>
            </div>

            <div className="p-8 max-w-[1600px] mx-auto flex gap-8">
                {/* Sidebar Navigation */}
                <div className="w-64 shrink-0 space-y-3">
                    {[
                        { id: 'monitor', icon: Activity, label: 'System Monitor' },
                        { id: 'fleet', icon: Ambulance, label: 'Fleet Management' },
                        { id: 'incidents', icon: AlertTriangle, label: 'Incidents' },
                        { id: 'hospitals', icon: Plus, label: 'Hospitals' },
                        { id: 'cameras', icon: Video, label: 'CCTV Cameras' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-semibold transition-all duration-300 border relative overflow-hidden group ${activeTab === tab.id
                                ? 'bg-gradient-to-r from-indigo-600/20 to-violet-600/10 text-indigo-300 border-indigo-500/30 shadow-[0_0_30px_rgba(79,70,229,0.15)]'
                                : 'bg-white/[0.02] text-slate-400 border-transparent hover:bg-white/[0.05] hover:text-white'
                                }`}
                        >
                            {activeTab === tab.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,1)]" />}
                            <tab.icon size={20} className={activeTab === tab.id ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0 flex flex-col">
                    <div className="bg-slate-900/40 backdrop-blur-2xl rounded-3xl border border-white/10 overflow-hidden min-h-[750px] shadow-2xl relative flex-1">
                        {/* Decorative glow */}
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

                        {/* Header Area */}
                        <div className="p-8 border-b border-white/5 flex justify-between items-center relative z-10 bg-gradient-to-b from-white/[0.03] to-transparent">
                            <h2 className="text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent capitalize tracking-tight drop-shadow-sm">{activeTab.replace('-', ' ')}</h2>
                            <div className="flex gap-4">
                                {activeTab === 'incidents' && (
                                    <>
                                        <a href={`${ADMIN_API_BASE}/api/admin/incidents/export`} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800/50 hover:bg-slate-800 text-slate-200 border border-white/10 hover:border-white/20 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                                            <Download size={18} /> Export CSV
                                        </a>
                                        <button onClick={() => handleClearAllIncidents()} className="flex items-center gap-2 px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl text-sm font-semibold transition-all shadow-[0_0_15px_rgba(244,63,94,0.1)] hover:shadow-[0_0_20px_rgba(244,63,94,0.2)] hover:-translate-y-0.5">
                                            <Trash2 size={18} /> Purge DB
                                        </button>
                                        <button onClick={() => { setFormData({}); setEditingItem(null); setShowForm(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)] hover:shadow-[0_0_25px_rgba(79,70,229,0.6)] hover:-translate-y-0.5">
                                            <Plus size={18} /> Manual Incident
                                        </button>
                                    </>
                                )}
                                {activeTab === 'hospitals' && (
                                    <button onClick={handleHospitalRefresh} disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)] hover:shadow-[0_0_25px_rgba(79,70,229,0.6)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">
                                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Force Redraw from GPS
                                    </button>
                                )}
                                {['fleet', 'cameras'].includes(activeTab) && (
                                    <button onClick={() => { setFormData({}); setEditingItem(null); setShowForm(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:shadow-[0_0_25px_rgba(16,185,129,0.6)] hover:-translate-y-0.5">
                                        <Plus size={18} /> Add New
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="p-8 relative z-10">
                            {activeTab === 'monitor' && renderMonitor()}

                            {activeTab === 'fleet' && (
                                <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-900/50 backdrop-blur-sm shadow-xl">
                                    <table className="w-full text-left text-sm">
                                        <thead className="text-slate-400 bg-black/20 text-xs uppercase tracking-wider border-b border-white/5">
                                            <tr><th className="p-5 font-semibold">Ambulance</th><th className="p-5 font-semibold">Driver</th><th className="p-5 font-semibold">Status</th><th className="p-5 font-semibold text-right">Actions</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {ambulances.map(amb => (
                                                <tr key={amb.id} className="hover:bg-white/[0.02] transition-colors group">
                                                    <td className="p-5 font-bold text-slate-200">{amb.service_name}</td>
                                                    <td className="p-5 text-slate-300">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-slate-200">{amb.driver_name}</span>
                                                            <span className="text-xs text-indigo-400 mt-0.5">{amb.contact_number}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-5">
                                                        <span className={`px-3 py-1.5 rounded-lg text-xs font-black tracking-widest uppercase ${amb.status === 'on_call' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]' :
                                                            amb.status === 'at_hospital' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]' :
                                                                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                                                            }`}>{amb.status.replace('_', ' ')}</span>
                                                    </td>
                                                    <td className="p-5 text-right flex justify-end items-center gap-3">
                                                        <button onClick={() => { setFormData(amb); setEditingItem(amb); setShowForm(true); }} className="p-2 bg-slate-800/50 hover:bg-slate-700 border border-white/5 text-slate-400 hover:text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50"><Edit size={16} /></button>
                                                        {amb.status === 'standby' ? (
                                                            <button onClick={() => { setSelectedAmbulance(amb); setShowDispatchModal(true); }} className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-400 hover:text-white rounded-lg text-xs font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(79,70,229,0.1)] hover:shadow-[0_0_15px_rgba(79,70,229,0.3)]">DISPATCH</button>
                                                        ) : (
                                                            <button onClick={() => handleRecall(amb.id)} className="px-4 py-2 bg-rose-600/10 hover:bg-rose-600 border border-rose-500/30 text-rose-400 hover:text-white rounded-lg text-xs font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(244,63,94,0.1)] hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]">RECALL</button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {activeTab === 'incidents' && (
                                <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-900/50 backdrop-blur-sm shadow-xl">
                                    <table className="w-full text-left text-sm">
                                        <thead className="text-slate-400 bg-black/20 text-xs uppercase tracking-wider border-b border-white/5">
                                            <tr><th className="p-5 font-semibold">ID</th><th className="p-5 font-semibold">Severity</th><th className="p-5 font-semibold">Location</th><th className="p-5 font-semibold">Status</th><th className="p-5 font-semibold text-right">Manage</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {incidents.map(inc => (
                                                <tr key={inc.id} className="hover:bg-white/[0.02] transition-colors group">
                                                    <td className="p-5 font-mono text-slate-400">#{inc.id}</td>
                                                    <td className="p-5"><span className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest ${inc.severity === 'Critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]'}`}>{inc.severity}</span></td>
                                                    <td className="p-5 max-w-xs truncate text-slate-300 font-medium" title={inc.location}>{inc.location}</td>
                                                    <td className="p-5">
                                                        <select
                                                            value={inc.status}
                                                            onChange={(e) => handleStatusChange(inc.id, e.target.value)}
                                                            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200"
                                                        >
                                                            <option value="Pending">Pending</option>
                                                            <option value="Dispatched">Dispatched</option>
                                                            <option value="Resolved">Resolved</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-5 text-right flex justify-end gap-3">
                                                        <button onClick={() => { setFormData({ ...inc, location: inc.location }); setEditingItem(inc); setShowForm(true); }} className="p-2 bg-slate-800/50 hover:bg-slate-700 border border-white/5 text-slate-400 hover:text-indigo-400 rounded-lg transition-all focus:outline-none"><Edit size={16} /></button>
                                                        <button onClick={() => handleDelete('incidents', inc.id)} className="p-2 bg-slate-800/50 hover:bg-rose-500/20 border border-white/5 text-slate-400 hover:text-rose-400 rounded-lg transition-all focus:outline-none"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Standard Tables */}
                            {['hospitals', 'cameras'].includes(activeTab) && (
                                <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-900/50 backdrop-blur-sm shadow-xl">
                                    <table className="w-full text-left text-sm">
                                        <thead className="text-slate-400 bg-black/20 text-xs uppercase tracking-wider border-b border-white/5">
                                            <tr>
                                                <th className="p-5 font-semibold">Name</th>
                                                {activeTab === 'hospitals' && <th className="p-5 font-semibold">Beds</th>}
                                                {activeTab === 'cameras' && <th className="p-5 font-semibold">URL</th>}
                                                <th className="p-5 font-semibold text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {(activeTab === 'hospitals' ? hospitals : cameras).map(item => (
                                                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                                                    <td className="p-5 font-semibold text-slate-200">{item.name}</td>
                                                    {activeTab === 'hospitals' && <td className="p-5 font-mono text-indigo-300">{item.beds_available || 'N/A'}</td>}
                                                    {activeTab === 'cameras' && <td className="p-5 font-mono text-xs text-slate-400 max-w-[200px] truncate">{item.feed_url}</td>}
                                                    <td className="p-5 text-right flex justify-end gap-3">
                                                        <button onClick={() => { setFormData({ ...item, latitude: item.latitude || item.location?.lat, longitude: item.longitude || item.location?.lng }); setEditingItem(item); setShowForm(true); }} className="p-2 bg-slate-800/50 hover:bg-slate-700 border border-white/5 text-slate-400 hover:text-indigo-400 rounded-lg transition-all"><Edit size={16} /></button>
                                                        <button onClick={() => handleDelete(activeTab, item.id)} className="p-2 bg-slate-800/50 hover:bg-rose-500/20 border border-white/5 text-slate-400 hover:text-rose-400 rounded-lg transition-all"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500" />
                        <h2 className="text-2xl font-extrabold mb-8 tracking-tight text-white">
                            {editingItem === 'geofence' ? 'Set Geofence Center' : `${editingItem ? 'Edit' : 'Add'} ${activeTab.replace(/s$/, '')}`}
                        </h2>
                        <form onSubmit={editingItem === 'geofence' ? handleGeofenceUpdate : handleSave} className="space-y-4">
                            {editingItem === 'geofence' ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs uppercase text-slate-500 mb-1">Target Lat</label><input type="number" step="any" className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.lat || ''} onChange={e => setFormData({ ...formData, lat: e.target.value })} required /></div>
                                    <div><label className="block text-xs uppercase text-slate-500 mb-1">Target Lng</label><input type="number" step="any" className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.lng || ''} onChange={e => setFormData({ ...formData, lng: e.target.value })} required /></div>
                                </div>
                            ) : activeTab === 'incidents' ? (
                                <>
                                    <div><label className="block text-xs uppercase text-slate-500 mb-1">Description</label><input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.location || formData.description || ''} onChange={e => setFormData({ ...formData, location: e.target.value })} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Lat</label><input type="number" step="any" className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.latitude || ''} onChange={e => setFormData({ ...formData, latitude: e.target.value })} required /></div>
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Lng</label><input type="number" step="any" className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.longitude || ''} onChange={e => setFormData({ ...formData, longitude: e.target.value })} required /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs uppercase text-slate-500 mb-1">Severity</label>
                                            <select className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.severity || 'Critical'} onChange={e => setFormData({ ...formData, severity: e.target.value })}>
                                                <option value="Critical">Critical</option>
                                                <option value="Minor">Minor</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs uppercase text-slate-500 mb-1">Status</label>
                                            <select className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.status || 'Pending'} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                                <option value="Pending">Pending</option>
                                                <option value="Dispatched">Dispatched</option>
                                                <option value="Resolved">Resolved</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            ) : activeTab === 'fleet' ? (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Service Name</label><input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.service_name || ''} onChange={e => setFormData({ ...formData, service_name: e.target.value })} required /></div>
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Driver Name</label><input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.driver_name || ''} onChange={e => setFormData({ ...formData, driver_name: e.target.value })} required /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Lat</label><input type="number" step="any" className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.latitude || ''} onChange={e => setFormData({ ...formData, latitude: e.target.value })} required /></div>
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Lng</label><input type="number" step="any" className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.longitude || ''} onChange={e => setFormData({ ...formData, longitude: e.target.value })} required /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Contact</label><input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.contact_number || ''} onChange={e => setFormData({ ...formData, contact_number: e.target.value })} required /></div>
                                        <div>
                                            <label className="block text-xs uppercase text-slate-500 mb-1">Status</label>
                                            <select className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.status || 'standby'} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                                <option value="standby">Standby</option>
                                                <option value="on_call">On Call</option>
                                                <option value="at_hospital">At Hospital</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            ) : activeTab === 'hospitals' ? (
                                <>
                                    <div><label className="block text-xs uppercase text-slate-500 mb-1">Name</label><input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Lat</label><input type="number" step="any" className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.latitude || ''} onChange={e => setFormData({ ...formData, latitude: e.target.value })} required /></div>
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Lng</label><input type="number" step="any" className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.longitude || ''} onChange={e => setFormData({ ...formData, longitude: e.target.value })} required /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Type</label><input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.type || 'Hospital'} onChange={e => setFormData({ ...formData, type: e.target.value })} required /></div>
                                        <div>
                                            <label className="block text-xs uppercase text-slate-500 mb-1">Status</label>
                                            <select className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.status || 'Open'} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                                <option value="Open">Open</option>
                                                <option value="Closed">Closed</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            ) : activeTab === 'cameras' ? (
                                <>
                                    <div><label className="block text-xs uppercase text-slate-500 mb-1">Camera Name</label><input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>
                                    <div><label className="block text-xs uppercase text-slate-500 mb-1">Location Desc</label><input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.location_name || ''} onChange={e => setFormData({ ...formData, location_name: e.target.value })} required /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Lat</label><input type="number" step="any" className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.latitude || ''} onChange={e => setFormData({ ...formData, latitude: e.target.value })} required /></div>
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Lng</label><input type="number" step="any" className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.longitude || ''} onChange={e => setFormData({ ...formData, longitude: e.target.value })} required /></div>
                                    </div>
                                    <div><label className="block text-xs uppercase text-slate-500 mb-1">Stream URL</label><input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500" value={formData.feed_url || ''} onChange={e => setFormData({ ...formData, feed_url: e.target.value })} required /></div>
                                </>
                            ) : (
                                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 rounded-lg text-sm">
                                    Unknown Resource Form
                                </div>
                            )}
                            <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 text-slate-400 hover:text-white font-semibold transition-colors">Cancel</button>
                                <button type="submit" className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] transition-all transform hover:-translate-y-0.5"><Save size={18} /> Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDispatchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-amber-500" />
                        <h2 className="text-2xl font-extrabold mb-2 text-white tracking-tight">Force Dispatch</h2>
                        <p className="text-slate-400 text-sm mb-8">Deploying <strong className="text-indigo-300 font-bold">{selectedAmbulance?.service_name}</strong> to an active incident.</p>

                        <form onSubmit={handleForceDispatch} className="space-y-4">
                            <div>
                                <label className="block text-xs uppercase text-slate-500 mb-1">Select Incident ID</label>
                                <select
                                    className="w-full bg-black/50 border border-white/10 rounded-lg p-3 outline-none focus:border-blue-500"
                                    value={dispatchIncidentId} onChange={e => setDispatchIncidentId(e.target.value)} required
                                >
                                    <option value="">-- Choose Incident --</option>
                                    {incidents.filter(i => i.status !== 'Resolved').map(inc => (
                                        <option key={inc.id} value={inc.id}>#{inc.id} - {inc.severity} ({inc.location})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setShowDispatchModal(false)} className="px-6 py-2.5 text-slate-400 hover:text-white font-semibold transition-colors">Cancel</button>
                                <button type="submit" className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 rounded-xl text-white font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(244,63,94,0.3)] hover:shadow-[0_0_20px_rgba(244,63,94,0.5)] transition-all transform hover:-translate-y-0.5"><Send size={18} /> Dispatch Unit</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
