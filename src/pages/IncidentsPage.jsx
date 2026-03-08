import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, Download, CheckCircle, Clock, Truck, MapPin } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

// Haversine distance in km (client-side for ETA)
const calcDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── Timeline Component ────────────────────────────────────────────────────────
const Timeline = ({ incident }) => {
    const steps = [
        {
            label: 'Detected',
            icon: MapPin,
            time: incident.time,
            done: true,
            color: 'text-blue-400',
            border: 'border-blue-400',
            bg: 'bg-blue-400',
        },
        {
            label: 'Dispatched',
            icon: Truck,
            time: incident.dispatched_at,
            done: !!incident.dispatched_at || ['Dispatched', 'Arrived', 'On Scene', 'Closed'].includes(incident.status),
            color: 'text-yellow-400',
            border: 'border-yellow-400',
            bg: 'bg-yellow-400',
        },
        {
            label: 'Arrived',
            icon: CheckCircle,
            time: incident.reachedTime,
            done: !!incident.reachedTime || ['Arrived', 'On Scene', 'Closed'].includes(incident.status),
            color: 'text-green-400',
            border: 'border-green-400',
            bg: 'bg-green-400',
        },
        {
            label: 'Closed',
            icon: Clock,
            time: incident.status === 'Closed' ? (incident.reachedTime || incident.time) : null,
            done: incident.status === 'Closed',
            color: 'text-slate-300',
            border: 'border-slate-400',
            bg: 'bg-slate-400',
        },
    ];

    return (
        <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Incident Timeline</h4>
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-white/10" />
                <div className="space-y-4">
                    {steps.map((step, i) => {
                        const Icon = step.icon;
                        return (
                            <div key={i} className="flex items-start gap-4 relative">
                                {/* Dot */}
                                <div className={`relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${step.done ? `${step.border} ${step.bg}` : 'border-slate-600 bg-slate-800'}`}>
                                    <Icon className={`w-3 h-3 ${step.done ? 'text-white' : 'text-slate-500'}`} />
                                </div>
                                <div className="flex-1 pb-1">
                                    <p className={`text-sm font-semibold ${step.done ? step.color : 'text-slate-500'}`}>
                                        {step.label}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {step.time ? new Date(step.time).toLocaleString() : '—'}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ── ETA Badge ─────────────────────────────────────────────────────────────────
const ETABadge = ({ incident }) => {
    if (incident.status !== 'Dispatched') return null;
    if (!incident.ambulance?.lat || !incident.lat) return null;

    const dist = calcDistance(incident.ambulance.lat, incident.ambulance.lng, incident.lat, incident.lng);
    const speed = 75; // km/h dispatch speed
    const etaMins = Math.max(1, Math.ceil((dist / speed) * 60));

    return (
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
            <Clock className="w-4 h-4 text-yellow-400 shrink-0" />
            <div>
                <p className="text-xs text-yellow-300 font-semibold">Ambulance ETA</p>
                <p className="text-lg font-bold text-yellow-400">{etaMins} min
                    <span className="text-xs text-yellow-500/70 font-normal ml-1">({dist.toFixed(1)} km)</span>
                </p>
            </div>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const IncidentsPage = () => {
    const [incidents, setIncidents] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [severityFilter, setSeverityFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedIncident, setSelectedIncident] = useState(null);

    useEffect(() => {
        const fetchIncidents = async () => {
            try {
                const res = await fetch('http://localhost:3000/api/incidents');
                if (res.ok) {
                    const response = await res.json();
                    if (response.success) {
                        const mapped = response.data.map(inc => ({
                            id: inc.id,
                            displayId: `INC-${inc.id}`,
                            location: inc.location,
                            severity: inc.severity,
                            status: inc.status,
                            time: inc.timestamp,
                            dispatched_at: inc.dispatched_at,
                            hospital: inc.hospital,
                            reachedTime: inc.historical_reached_time,
                            ambulance: (inc.ambulance_name || inc.historical_ambulance_name) ? {
                                name: inc.ambulance_name || inc.historical_ambulance_name,
                                contact: inc.ambulance_contact,
                                status: inc.ambulance_status || 'Closed',
                                lastUpdated: inc.ambulance_updated,
                                lat: inc.ambulance_lat,
                                lng: inc.ambulance_lng,
                            } : null,
                            confidence: inc.confidence,
                            lat: inc.latitude,
                            lng: inc.longitude,
                        }));
                        setIncidents(mapped);
                        // Keep selected incident in sync
                        if (selectedIncident) {
                            const updated = mapped.find(i => i.id === selectedIncident.id);
                            if (updated) setSelectedIncident(updated);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to fetch incidents:", err);
            }
        };

        fetchIncidents();
        const interval = setInterval(fetchIncidents, 2000);
        return () => clearInterval(interval);
    }, []);

    // ── CSV Export ─────────────────────────────────────────────────────────────
    const exportCSV = () => {
        const headers = ['ID', 'Location', 'Severity', 'Status', 'Detected At', 'Dispatched At', 'Arrived At', 'Hospital', 'Ambulance', 'Confidence', 'Latitude', 'Longitude'];
        const rows = filteredIncidents.map(inc => [
            inc.displayId,
            `"${typeof inc.location === 'string' ? inc.location.replace(/"/g, '""') : 'Unknown'}"`,
            inc.severity,
            inc.status,
            inc.time ? new Date(inc.time).toLocaleString() : '',
            inc.dispatched_at ? new Date(inc.dispatched_at).toLocaleString() : '',
            inc.reachedTime ? new Date(inc.reachedTime).toLocaleString() : '',
            `"${inc.hospital || ''}"`,
            `"${inc.ambulance?.name || ''}"`,
            inc.confidence ? (inc.confidence * 100).toFixed(1) + '%' : '',
            inc.lat || '',
            inc.lng || '',
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `road-raksha-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const filteredIncidents = incidents.filter(incident => {
        const locationStr = typeof incident.location === 'string' ? incident.location : 'Unknown';
        const matchesSearch = locationStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
            incident.displayId.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSeverity = severityFilter === 'All' || incident.severity === severityFilter;
        const matchesStatus = statusFilter === 'All' || incident.status === statusFilter;
        return matchesSearch && matchesSeverity && matchesStatus;
    });

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'Critical': return 'text-critical';
            case 'Major': return 'text-warning';
            case 'Minor': return 'text-success';
            default: return 'text-slate-400';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Dispatched': return 'text-success';
            case 'Arrived': return 'text-success';
            case 'On Scene': return 'text-info';
            case 'Pending': return 'text-info';
            case 'Closed': return 'text-slate-500';
            default: return 'text-slate-400';
        }
    };

    return (
        <div className="min-h-screen w-full bg-darker flex flex-col font-sans text-white">
            <Header />

            <main className="flex-1 p-6 overflow-auto">
                <div className="max-w-7xl mx-auto">
                    {/* Page Header & Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h1 className="text-2xl font-bold text-white">Incidents Management</h1>

                        <div className="flex flex-wrap items-center gap-3">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-panel border border-panel-border rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary w-64"
                                />
                            </div>

                            {/* Severity Filter */}
                            <div className="relative">
                                <select
                                    value={severityFilter}
                                    onChange={(e) => setSeverityFilter(e.target.value)}
                                    className="appearance-none bg-panel border border-panel-border rounded-lg pl-4 pr-10 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary cursor-pointer"
                                >
                                    <option value="All">Filter by Severity</option>
                                    <option value="Critical">Critical</option>
                                    <option value="Minor">Minor</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>

                            {/* Status Filter */}
                            <div className="relative">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="appearance-none bg-panel border border-panel-border rounded-lg pl-4 pr-10 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary cursor-pointer"
                                >
                                    <option value="All">Filter by Status</option>
                                    <option value="Dispatched">Dispatched</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Closed">Closed</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>

                            {/* Export CSV */}
                            <button
                                onClick={exportCSV}
                                disabled={filteredIncidents.length === 0}
                                className="flex items-center gap-2 bg-panel border border-panel-border rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Download className="w-4 h-4" />
                                Export CSV
                            </button>
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="bg-panel/50 backdrop-blur-sm border border-panel-border rounded-xl overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="bg-slate-800/50 border-b border-panel-border text-slate-400">
                                        <th className="px-6 py-4 font-semibold">ID</th>
                                        <th className="px-6 py-4 font-semibold">Location</th>
                                        <th className="px-6 py-4 font-semibold">Severity</th>
                                        <th className="px-6 py-4 font-semibold">Status</th>
                                        <th className="px-6 py-4 font-semibold">Time</th>
                                        <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-panel-border">
                                    {filteredIncidents.map((incident) => (
                                        <tr key={incident.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-mono text-slate-300">{incident.displayId}</td>
                                            <td className="px-6 py-4 text-white">{typeof incident.location === 'string' ? incident.location : 'Detected Incident'}</td>
                                            <td className={`px-6 py-4 font-medium ${getSeverityColor(incident.severity)}`}>
                                                {incident.severity} <span className="text-slate-500 font-normal">({incident.severity === 'Critical' ? 'Red' : 'Yellow'})</span>
                                            </td>
                                            <td className={`px-6 py-4 font-medium ${getStatusColor(incident.status)}`}>
                                                {incident.status} <span className="text-slate-500 font-normal">({incident.status === 'Dispatched' ? 'Green' : incident.status === 'Pending' ? 'Blue' : 'Gray'})</span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">{incident.time}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => setSelectedIncident(incident)}
                                                    className="text-info hover:text-blue-400 border border-info/30 hover:border-info px-3 py-1 rounded text-xs transition-all"
                                                >
                                                    [View Details]
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {filteredIncidents.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                                                No incidents found matching your filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />

            {/* ── Incident Details Modal ──────────────────────────────────────── */}
            {selectedIncident && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-panel border border-panel-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
                        {/* Header */}
                        <div className="bg-slate-800/80 px-6 py-5 border-b border-panel-border flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    {selectedIncident.displayId}
                                    <span className={`text-xs px-2 py-0.5 rounded border ${selectedIncident.severity === 'Critical' ? 'border-critical text-critical bg-critical/10' :
                                        selectedIncident.severity === 'Minor' ? 'border-warning text-warning bg-warning/10' :
                                            'border-slate-500 text-slate-400'
                                        }`}>
                                        {selectedIncident.severity}
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">{new Date(selectedIncident.time).toLocaleString()}</p>
                            </div>
                            <button
                                onClick={() => setSelectedIncident(null)}
                                className="text-slate-400 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body — scrollable */}
                        <div className="p-6 space-y-6 overflow-y-auto">

                            {/* ETA Badge */}
                            <ETABadge incident={selectedIncident} />

                            {/* Two-column: Location + Hospital */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Location */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location</h4>
                                    <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                                        <p className="text-sm font-medium text-white">{selectedIncident.location}</p>
                                        <p className="text-xs text-slate-400 mt-1 font-mono">
                                            {selectedIncident.lat?.toFixed(6) || 'N/A'}, {selectedIncident.lng?.toFixed(6) || 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                {/* Hospital */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hospital Destination</h4>
                                    {selectedIncident.hospital ? (
                                        <div className="bg-black/20 rounded-lg p-3 border border-white/5 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-white text-sm">{selectedIncident.hospital}</p>
                                                <p className="text-xs text-green-400 mt-1">
                                                    {selectedIncident.status === 'Closed' ? 'Patient Delivered' : 'Transporting'}
                                                </p>
                                            </div>
                                            <span className="text-2xl">🏥</span>
                                        </div>
                                    ) : (
                                        <div className="bg-black/20 rounded-lg p-3 border border-white/5 text-slate-500 text-sm">TBD</div>
                                    )}
                                </div>
                            </div>

                            {/* Ambulance */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Ambulance Assignment</h4>
                                {selectedIncident.ambulance ? (
                                    <div className={`rounded-lg p-4 border border-white/5 space-y-3 ${selectedIncident.status === 'Closed' ? 'bg-slate-800/50' : 'bg-black/20'}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-lg text-blue-400">{selectedIncident.ambulance.name}</p>
                                                {selectedIncident.ambulance.contact && (
                                                    <p className="text-xs text-slate-400">Driver Contact: {selectedIncident.ambulance.contact}</p>
                                                )}
                                                {selectedIncident.reachedTime ? (
                                                    <p className="text-[10px] text-green-400 mt-1 font-mono">
                                                        REACHED AT: {new Date(selectedIncident.reachedTime).toLocaleTimeString()}
                                                    </p>
                                                ) : (
                                                    <p className="text-[10px] text-slate-500 mt-1">
                                                        Updated: {selectedIncident.ambulance.lastUpdated ? new Date(selectedIncident.ambulance.lastUpdated).toLocaleTimeString() : 'N/A'}
                                                    </p>
                                                )}
                                            </div>
                                            <div className={`px-2 py-1 rounded text-xs font-bold ${selectedIncident.ambulance.status === 'on_call' ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
                                                selectedIncident.ambulance.status === 'moving' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' :
                                                    selectedIncident.ambulance.status === 'Closed' ? 'bg-slate-600/20 text-slate-400 border border-slate-500/30' :
                                                        'bg-green-500/20 text-green-400 border border-green-500/50'
                                                }`}>
                                                {selectedIncident.ambulance.status.toUpperCase().replace('_', ' ')}
                                            </div>
                                        </div>
                                        {selectedIncident.status !== 'Closed' && selectedIncident.ambulance.lat && (
                                            <div className="pt-3 border-t border-white/5">
                                                <p className="text-xs text-slate-500">Current Coordinates</p>
                                                <p className="text-sm font-mono text-slate-300">
                                                    {selectedIncident.ambulance.lat?.toFixed(4)}, {selectedIncident.ambulance.lng?.toFixed(4)}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
                                        <p className="text-yellow-500 text-sm font-medium">No ambulance record found</p>
                                        <p className="text-xs text-yellow-500/60 mt-1">Status: {selectedIncident.status}</p>
                                    </div>
                                )}
                            </div>

                            {/* Timeline */}
                            <div className="border-t border-white/5 pt-6">
                                <Timeline incident={selectedIncident} />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-900/50 px-6 py-4 border-t border-panel-border flex justify-end shrink-0">
                            <button
                                onClick={() => setSelectedIncident(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IncidentsPage;
