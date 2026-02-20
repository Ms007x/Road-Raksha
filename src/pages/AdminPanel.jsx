import React, { useState, useEffect } from 'react';
import { FaTrash, FaPlus, FaSave, FaEdit } from 'react-icons/fa';

const AdminPanel = () => {
    const [activeTab, setActiveTab] = useState('incidents');
    const [ambulances, setAmbulances] = useState([]);
    const [hospitals, setHospitals] = useState([]);
    const [cameras, setCameras] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [ambulanceServiceEnabled, setAmbulanceServiceEnabled] = useState(true);

    const ADMIN_API_BASE = 'http://localhost:3001';

    // Form States
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({});

    // Fetch Data
    useEffect(() => {
        fetchData();
        if (activeTab === 'settings') fetchSettings();
    }, [activeTab]);

    const fetchData = async () => {
        if (activeTab === 'settings') return;
        setLoading(true);
        try {
            if (activeTab === 'ambulances') {
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
            console.error("Failed to fetch data", error);
        }
        setLoading(false);
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch(`${ADMIN_API_BASE}/api/ambulance-service-status`);
            const data = await res.json();
            setAmbulanceServiceEnabled(data.enabled);
        } catch (e) {
            console.error("Failed to fetch settings", e);
        }
    }

    const toggleAmbulanceService = async () => {
        try {
            const newState = !ambulanceServiceEnabled;
            await fetch(`${ADMIN_API_BASE}/api/set-ambulance-service`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newState })
            });
            setAmbulanceServiceEnabled(newState);
        } catch (e) {
            console.error("Toggle failed", e);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this item? This cannot be undone.")) return;

        try {
            let endpoint = null;
            if (activeTab === 'ambulances') endpoint = `/api/admin/ambulances/${id}`;
            else if (activeTab === 'hospitals') endpoint = `/api/admin/hospitals/${id}`;
            else if (activeTab === 'cameras') endpoint = `/api/admin/cameras/${id}`;
            else if (activeTab === 'incidents') endpoint = `/api/admin/incidents/${id}`;

            if (endpoint) {
                await fetch(`${ADMIN_API_BASE}${endpoint}`, { method: 'DELETE' });
                fetchData();
            }
        } catch (error) {
            console.error("Delete failed", error);
        }
    };

    const handleClearAllIncidents = async () => {
        if (!window.confirm("WARNING: This will delete ALL incidents and history. Are you sure?")) return;
        try {
            await fetch(`${ADMIN_API_BASE}/api/incidents`, { method: 'DELETE' });
            alert("All incidents cleared.");
            fetchData(); // Refresh incidents list
        } catch (e) {
            console.error("Clear failed", e);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const method = editingItem ? 'PUT' : 'POST';
            let endpoint = '';

            if (activeTab === 'ambulances') endpoint = editingItem ? `/api/admin/ambulances/${editingItem.id}` : '/api/admin/ambulances';
            else if (activeTab === 'hospitals') endpoint = editingItem ? `/api/admin/hospitals/${editingItem.id}` : '/api/admin/hospitals';
            else if (activeTab === 'cameras') endpoint = editingItem ? `/api/admin/cameras/${editingItem.id}` : '/api/admin/cameras';

            if (!endpoint) return;

            const res = await fetch(`${ADMIN_API_BASE}${endpoint}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setShowForm(false);
                setEditingItem(null);
                setFormData({});
                fetchData();
            }
        } catch (error) {
            console.error("Save failed", error);
        }
    };

    const openForm = (item = null) => {
        setEditingItem(item);
        setFormData(item || getInitialFormData());
        setShowForm(true);
    };

    const getInitialFormData = () => {
        if (activeTab === 'ambulances') return { service_name: '', driver_name: '', contact_number: '', latitude: 17.44, longitude: 78.39, status: 'standby' };
        if (activeTab === 'hospitals') return { name: '', latitude: 17.44, longitude: 78.39, beds_available: 10 };
        if (activeTab === 'cameras') return { name: 'Cam-01', location_name: 'Main Junction', latitude: 17.44, longitude: 78.39, feed_url: 'rtsp://...' };
        return {};
    };

    // --- Render Helpers ---

    const renderTable = (columns, data) => (
        <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-white/5 uppercase text-xs font-bold text-slate-200">
                    <tr>
                        {columns.map(col => <th key={col.key} className="px-6 py-3">{col.label}</th>)}
                        <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {data.length === 0 ? (
                        <tr><td colSpan={columns.length + 1} className="px-6 py-8 text-center text-slate-500">No data found</td></tr>
                    ) : (
                        data.map(item => (
                            <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                {columns.map(col => (
                                    <td key={col.key} className="px-6 py-4">
                                        {/* Handle nested or special rendering if needed */}
                                        {item[col.key]}
                                    </td>
                                ))}
                                <td className="px-6 py-4 text-right space-x-3">
                                    {activeTab !== 'incidents' && (
                                        <button onClick={() => openForm(item)} className="text-blue-400 hover:text-blue-300"><FaEdit /></button>
                                    )}
                                    <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300"><FaTrash /></button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <header className="mb-10 border-b border-white/10 pb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">System Administration</h1>
                        <p className="text-slate-500 mt-2">Full Access Control Panel</p>
                    </div>
                    <div className="px-3 py-1 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-xs font-mono">
                        SECURE ADMIN PORT: 3001
                    </div>
                </header>

                {/* Tabs */}
                <div className="flex space-x-2 mb-8 overflow-x-auto pb-2">
                    {['incidents', 'ambulances', 'hospitals', 'cameras', 'settings'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-2 rounded-full font-medium transition-all whitespace-nowrap ${activeTab === tab
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="bg-slate-900/50 rounded-2xl border border-white/5 p-6 min-h-[500px]">

                    {/* Header Actions for Tables */}
                    {activeTab !== 'settings' && activeTab !== 'incidents' && (
                        <div className="flex justify-end mb-6">
                            <button
                                onClick={() => openForm()}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-lg shadow-green-500/20 transition-all"
                            >
                                <FaPlus /> Add New {activeTab.slice(0, -1)}
                            </button>
                        </div>
                    )}

                    {activeTab === 'incidents' && (
                        <div className="flex justify-end mb-6">
                            <button
                                onClick={handleClearAllIncidents}
                                className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/40 text-red-500 border border-red-500/50 px-5 py-2.5 rounded-lg font-medium transition-all"
                            >
                                <FaTrash /> purge All History
                            </button>
                        </div>
                    )}

                    {loading ? <div className="text-center py-20 text-slate-500">Loading data...</div> : (
                        <>
                            {activeTab === 'incidents' && renderTable([
                                { key: 'id', label: 'ID' },
                                { key: 'severity', label: 'Severity' },
                                { key: 'status', label: 'Status' },
                                { key: 'timestamp', label: 'Time' },
                                { key: 'location', label: 'Location' }
                            ], incidents)}

                            {activeTab === 'ambulances' && renderTable([
                                { key: 'service_name', label: 'Service Name' },
                                { key: 'driver_name', label: 'Driver' },
                                { key: 'contact_number', label: 'Contact' },
                                { key: 'status', label: 'Status' }
                            ], ambulances)}

                            {activeTab === 'hospitals' && renderTable([
                                { key: 'name', label: 'Hospital Name' },
                                { key: 'beds_available', label: 'Beds' },
                                { key: 'latitude', label: 'Lat' },
                                { key: 'longitude', label: 'Lng' }
                            ], hospitals)}

                            {activeTab === 'cameras' && renderTable([
                                { key: 'name', label: 'Camera ID' },
                                { key: 'location_name', label: 'Location' },
                                { key: 'feed_url', label: 'Stream URL' }
                            ], cameras)}

                            {activeTab === 'settings' && (
                                <div className="max-w-2xl mx-auto space-y-8 py-10">
                                    <div className="bg-black/20 p-6 rounded-xl border border-white/5">
                                        <h3 className="text-xl font-bold mb-4 text-white">System Controls</h3>
                                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                                            <div>
                                                <p className="font-bold text-white">Ambulance Auto-Dispatch</p>
                                                <p className="text-sm text-slate-400">Automatically assign nearest ambulance to detected incidents.</p>
                                            </div>
                                            <button
                                                onClick={toggleAmbulanceService}
                                                className={`px-4 py-2 rounded-lg font-bold transition-colors ${ambulanceServiceEnabled ? 'bg-green-500 text-green-950' : 'bg-red-500 text-white'}`}
                                            >
                                                {ambulanceServiceEnabled ? 'ENABLED' : 'DISABLED'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-black/20 p-6 rounded-xl border border-white/5">
                                        <h3 className="text-xl font-bold mb-4 text-red-400">Danger Zone</h3>
                                        <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                                            <div>
                                                <p className="font-bold text-red-200">Reset System Database</p>
                                                <p className="text-sm text-red-400/70">Clears all Incidents, History, and Mock Data.</p>
                                            </div>
                                            <button
                                                onClick={handleClearAllIncidents}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium"
                                            >
                                                Reset All
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Modal Form */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 w-full max-w-lg shadow-2xl">
                            <h2 className="text-2xl font-bold mb-6">{editingItem ? 'Edit' : 'Add'} {activeTab.slice(0, -1)}</h2>
                            <form onSubmit={handleSave} className="space-y-4">
                                {activeTab === 'ambulances' && (
                                    <>
                                        {/* Same fields as before */}
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Service Name</label><input className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.service_name || ''} onChange={e => setFormData({ ...formData, service_name: e.target.value })} required /></div>
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Driver Name</label><input className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.driver_name || ''} onChange={e => setFormData({ ...formData, driver_name: e.target.value })} required /></div>
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Contact</label><input className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.contact_number || ''} onChange={e => setFormData({ ...formData, contact_number: e.target.value })} required /></div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="block text-xs uppercase text-slate-500 mb-1">Lat</label><input type="number" step="any" className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.latitude || ''} onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })} required /></div>
                                            <div><label className="block text-xs uppercase text-slate-500 mb-1">Lng</label><input type="number" step="any" className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.longitude || ''} onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })} required /></div>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'hospitals' && (
                                    <>
                                        {/* Same fields as before */}
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Hospital Name</label><input className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Beds Available</label><input type="number" className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.beds_available || ''} onChange={e => setFormData({ ...formData, beds_available: parseInt(e.target.value) })} required /></div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="block text-xs uppercase text-slate-500 mb-1">Lat</label><input type="number" step="any" className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.latitude || ''} onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })} required /></div>
                                            <div><label className="block text-xs uppercase text-slate-500 mb-1">Lng</label><input type="number" step="any" className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.longitude || ''} onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })} required /></div>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'cameras' && (
                                    <>
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Camera Name/ID</label><input className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></div>
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Location Name</label><input className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.location_name || ''} onChange={e => setFormData({ ...formData, location_name: e.target.value })} required /></div>
                                        <div><label className="block text-xs uppercase text-slate-500 mb-1">Feed URL (RTSP/HTTP)</label><input className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.feed_url || ''} onChange={e => setFormData({ ...formData, feed_url: e.target.value })} required /></div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="block text-xs uppercase text-slate-500 mb-1">Lat</label><input type="number" step="any" className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.latitude || ''} onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })} required /></div>
                                            <div><label className="block text-xs uppercase text-slate-500 mb-1">Lng</label><input type="number" step="any" className="w-full bg-black/40 border border-white/10 rounded p-3 text-white focus:border-blue-500 outline-none" value={formData.longitude || ''} onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })} required /></div>
                                        </div>
                                    </>
                                )}

                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 text-slate-400 hover:text-white">Cancel</button>
                                    <button type="submit" className="px-6 py-2 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-500">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;
