import React, { useState } from 'react';
import { Search, Filter, ChevronDown } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const mockIncidents = [
    { id: 'INC-001', location: 'Main St & 4th Ave', severity: 'Critical', status: 'Dispatched', time: '10:45 AM' },
    { id: 'INC-002', location: 'Highway 8 Exit', severity: 'Minor', status: 'Pending', time: '10:40 AM' },
    { id: 'INC-003', location: 'Park Ave & Elm St', severity: 'Critical', status: 'Dispatched', time: '10:30 AM' },
    { id: 'INC-004', location: 'Route 50 near Exit 2', severity: 'Minor', status: 'Closed', time: '10:15 AM' },
    { id: 'INC-005', location: 'Route 50 near Exit 2', severity: 'Minor', status: 'Closed', time: '10:15 AM' },
    { id: 'INC-006', location: 'Route 50 near Exit 2', severity: 'Minor', status: 'Closed', time: '10:15 AM' },
    { id: 'INC-007', location: 'Park Ave & Elm St', severity: 'Critical', status: 'Dispatched', time: '10:30 AM' },
    { id: 'INC-008', location: 'Park Ave & Elm St', severity: 'Minor', status: 'Dispatched', time: '10:30 AM' },
    { id: 'INC-009', location: 'Park Ave & Elm St', severity: 'Critical', status: 'Dispatched', time: '10:30 AM' },
];

const IncidentsPage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [severityFilter, setSeverityFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');

    const filteredIncidents = mockIncidents.filter(incident => {
        const matchesSearch = incident.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
            incident.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSeverity = severityFilter === 'All' || incident.severity === severityFilter;
        const matchesStatus = statusFilter === 'All' || incident.status === statusFilter;
        return matchesSearch && matchesSeverity && matchesStatus;
    });

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'Critical': return 'text-critical';
            case 'Minor': return 'text-warning';
            default: return 'text-slate-400';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Dispatched': return 'text-success';
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

                            {/* Filters */}
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

                            <div className="relative">
                                <button className="bg-panel border border-panel-border rounded-lg px-4 py-2 text-sm text-slate-300 flex items-center gap-2 hover:bg-slate-800 transition-colors">
                                    Filter by Date
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                            </div>
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
                                            <td className="px-6 py-4 font-mono text-slate-300">{incident.id}</td>
                                            <td className="px-6 py-4 text-white">{incident.location}</td>
                                            <td className={`px-6 py-4 font-medium ${getSeverityColor(incident.severity)}`}>
                                                {incident.severity} <span className="text-slate-500 font-normal">({incident.severity === 'Critical' ? 'Red' : 'Yellow'})</span>
                                            </td>
                                            <td className={`px-6 py-4 font-medium ${getStatusColor(incident.status)}`}>
                                                {incident.status} <span className="text-slate-500 font-normal">({incident.status === 'Dispatched' ? 'Green' : incident.status === 'Pending' ? 'Blue' : 'Gray'})</span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">{incident.time}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-info hover:text-blue-400 border border-info/30 hover:border-info px-3 py-1 rounded text-xs transition-all">
                                                    [View Details]
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {filteredIncidents.length === 0 && (
                                        <tr>
                                            <td colspan="6" className="px-6 py-8 text-center text-slate-500">
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
        </div>
    );
};

export default IncidentsPage;
