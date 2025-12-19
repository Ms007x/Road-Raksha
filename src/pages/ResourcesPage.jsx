import React, { useState, useEffect } from 'react';
import { Truck, Phone, Battery, MapPin, Shield, Activity } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const ResourceCard = ({ resource }) => {
    // Helper to determine status color
    const getStatusColor = (status) => {
        const statusLower = status?.toLowerCase() || '';
        if (statusLower === 'available') return 'success';
        if (statusLower === 'on mission' || statusLower === 'airborne' || statusLower === 'patrolling') return 'info';
        if (statusLower === 'maintenance') return 'warning';
        return 'critical';
    };

    const color = getStatusColor(resource.status);

    return (
        <div className="bg-panel/50 backdrop-blur-sm border border-panel-border rounded-xl p-6 hover:bg-panel/70 transition-all group">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg bg-${color}/10 text-${color} group-hover:scale-110 transition-transform`}>
                    {resource.type.includes('Ambulance') ? <Activity className="w-6 h-6" /> :
                        resource.type.includes('Patrol') ? <Shield className="w-6 h-6" /> : <Truck className="w-6 h-6" />}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium bg-${color}/20 text-${color} border border-${color}/20`}>
                    {resource.status}
                </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-1">{resource.resource_id}</h3>
            <p className="text-sm text-slate-400 mb-4">{resource.type}</p>

            <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <UserIcon className="w-4 h-4 text-slate-500" />
                    <span>{resource.driver_name || 'Unassigned'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span>{resource.location_name || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Battery className="w-4 h-4 text-slate-500" />
                    <span>{resource.battery_level || resource.fuel_level}% Fuel/Charge</span>
                </div>
            </div>

            <button className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white flex items-center justify-center gap-2 transition-colors">
                <Phone className="w-4 h-4" />
                Contact Unit
            </button>
        </div>
    );
};

// Helper icon
const UserIcon = ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const ResourcesPage = () => {
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch resources from database
    useEffect(() => {
        const fetchResources = async () => {
            try {
                const res = await fetch('http://localhost:3000/api/resources');
                const data = await res.json();
                if (data.success) {
                    setResources(data.data);
                }
            } catch (err) {
                console.error('Failed to fetch resources:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchResources();

        // Refresh every 10 seconds for real-time updates
        const interval = setInterval(fetchResources, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen w-full bg-darker flex flex-col font-sans text-white">
            <Header />

            <main className="flex-1 p-6 overflow-auto">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-white">Fleet Resources</h1>
                            <p className="text-slate-400 mt-1">Manage and track all emergency response units.</p>
                        </div>
                        <button className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                            + Add New Unit
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-center py-12 text-slate-400">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                            Loading resources...
                        </div>
                    ) : resources.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            No resources found. Run seed script to populate data.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {resources.map(resource => (
                                <ResourceCard key={resource.resource_id} resource={resource} />
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default ResourcesPage;
