import React from 'react';
import { Truck, Phone, Battery, MapPin, Shield, Activity } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const resources = [
    { id: 'AMB-01', type: 'Ambulance', driver: 'Rahul Singh', status: 'On Mission', battery: '85%', location: 'Sector 4', color: 'critical' },
    { id: 'AMB-02', type: 'Ambulance', driver: 'Vikram Malhotra', status: 'Available', battery: '100%', location: 'Base Station', color: 'success' },
    { id: 'PTR-01', type: 'Patrol Unit', driver: 'Sgt. Kaur', status: 'Patrolling', battery: '60%', location: 'Highway 8', color: 'info' },
    { id: 'PTR-02', type: 'Patrol Unit', driver: 'Ofc. Sharma', status: 'Maintenance', battery: '0%', location: 'Workshop', color: 'warning' },
    { id: 'FIR-01', type: 'Fire Truck', driver: 'Capt. Verma', status: 'Available', battery: '95%', location: 'Station 1', color: 'success' },
    { id: 'DRN-01', type: 'Drone Unit', driver: 'Auto-Pilot', status: 'Airborne', battery: '45%', location: 'Sector 7', color: 'info' },
];

const ResourceCard = ({ resource }) => (
    <div className="bg-panel/50 backdrop-blur-sm border border-panel-border rounded-xl p-6 hover:bg-panel/70 transition-all group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-lg bg-${resource.color}/10 text-${resource.color} group-hover:scale-110 transition-transform`}>
                {resource.type.includes('Ambulance') ? <Activity className="w-6 h-6" /> :
                    resource.type.includes('Patrol') ? <Shield className="w-6 h-6" /> : <Truck className="w-6 h-6" />}
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium bg-${resource.color}/20 text-${resource.color} border border-${resource.color}/20`}>
                {resource.status}
            </span>
        </div>

        <h3 className="text-xl font-bold text-white mb-1">{resource.id}</h3>
        <p className="text-sm text-slate-400 mb-4">{resource.type}</p>

        <div className="space-y-3 mb-6">
            <div className="flex items-center gap-2 text-sm text-slate-300">
                <UserIcon className="w-4 h-4 text-slate-500" />
                <span>{resource.driver}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
                <MapPin className="w-4 h-4 text-slate-500" />
                <span>{resource.location}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
                <Battery className="w-4 h-4 text-slate-500" />
                <span>{resource.battery} Fuel/Charge</span>
            </div>
        </div>

        <button className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white flex items-center justify-center gap-2 transition-colors">
            <Phone className="w-4 h-4" />
            Contact Unit
        </button>
    </div>
);

// Helper icon
const UserIcon = ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const ResourcesPage = () => {
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

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {resources.map(resource => (
                            <ResourceCard key={resource.id} resource={resource} />
                        ))}
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default ResourcesPage;
