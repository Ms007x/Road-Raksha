import React, { useState, useEffect } from 'react';
import { Truck, Phone, Battery, MapPin, Shield, Activity, Camera, Video, Building2, Stethoscope, Navigation } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CCTVGrid from '../components/CCTVGrid';

// Mock Data for Non-Ambulance Resources
const cctvs = [
    { id: 'CAM-01', location: 'Main Junction (Jagtial)', status: 'Active', type: 'Traffic Cam', alerts: 0 },
    { id: 'CAM-02', location: 'Highway 8 South', status: 'Active', type: 'Speed Cam', alerts: 2 },
    { id: 'CAM-03', location: 'Market Road', status: 'Offline', type: 'Surveillance', alerts: 0 },
    { id: 'CAM-04', location: 'School Zone A', status: 'Active', type: 'Safety Cam', alerts: 0 },
    { id: 'CAM-05', location: 'City Entrance North', status: 'Active', type: 'License Plate Reader', alerts: 1 },
    { id: 'CAM-06', location: 'Public Square', status: 'Active', type: 'Crowd Monitoring', alerts: 5 },
];



const ResourceCard = ({ resource, type }) => {
    let Icon = Activity;
    let colorClass = 'text-primary';
    let bgClass = 'bg-primary/10';
    let borderClass = 'border-primary/20';

    if (type === 'AMBULANCE') {
        Icon = Truck;
        if (resource.status === 'Available' || resource.status === 'standby') {
            colorClass = 'text-success';
            bgClass = 'bg-success/10';
            borderClass = 'border-success/20';
        } else if (resource.status === 'Busy' || resource.status === 'on_call') {
            colorClass = 'text-critical';
            bgClass = 'bg-critical/10';
            borderClass = 'border-critical/20';
        } else {
            colorClass = 'text-warning';
            bgClass = 'bg-warning/10';
            borderClass = 'border-warning/20';
        }
    } else if (type === 'CCTV') {
        Icon = Camera;
        if (resource.status === 'Active') {
            colorClass = 'text-success';
            bgClass = 'bg-success/10';
            borderClass = 'border-success/20';
        } else {
            colorClass = 'text-slate-500';
            bgClass = 'bg-slate-500/10';
            borderClass = 'border-slate-500/20';
        }
    } else if (type === 'HOSPITAL') {
        Icon = Building2;
        if (resource.status === 'Open') {
            colorClass = 'text-success';
            bgClass = 'bg-success/10';
            borderClass = 'border-success/20';
        } else {
            colorClass = 'text-warning';
            bgClass = 'bg-warning/10';
            borderClass = 'border-warning/20';
        }
    }

    return (
        <div className="bg-panel/50 backdrop-blur-sm border border-panel-border rounded-xl p-6 hover:bg-panel/70 transition-all group">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg ${bgClass} ${colorClass} group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${bgClass} ${colorClass} border ${borderClass}`}>
                    {resource.status}
                </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-1">
                {type === 'AMBULANCE' ? resource.service_name : (type === 'HOSPITAL' ? resource.name : resource.id)}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
                {type === 'AMBULANCE' ? resource.driverName : (type === 'HOSPITAL' ? 'Emergency Center' : resource.type)}
            </p>

            <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span>{type === 'AMBULANCE' || type === 'HOSPITAL'
                        ? (resource.location?.lat ? `Lat: ${resource.location.lat.toFixed(4)}` : resource.location)
                        : resource.location}</span>
                </div>

                {type === 'AMBULANCE' && (
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Navigation className="w-4 h-4 text-slate-500" />
                        <span>{resource.speed} km/h</span>
                    </div>
                )}

                {type === 'HOSPITAL' && (
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Activity className="w-4 h-4 text-slate-500" />
                        <span>Beds Available: {resource.beds}</span>
                    </div>
                )}
                {type === 'CCTV' && (
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Video className="w-4 h-4 text-slate-500" />
                        <span>Alerts Today: {resource.alerts}</span>
                    </div>
                )}
            </div>

            <button className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white flex items-center justify-center gap-2 transition-colors">
                <Phone className="w-4 h-4" />
                {type === 'CCTV' ? 'View Feed' : 'Contact'}
            </button>
        </div>
    );
};

const ResourcesPage = () => {
    const [activeTab, setActiveTab] = useState('CCTV');
    const [ambulances, setAmbulances] = useState([]);
    const [hospitals, setHospitals] = useState([]);

    const [userLocation, setUserLocation] = useState(null);
    const [loadingLocation, setLoadingLocation] = useState(true);

    // Get User Location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                    setLoadingLocation(false);
                },
                (error) => {
                    console.error("Location access denied or failed", error);
                    setLoadingLocation(false);
                }
            );
        } else {
            setLoadingLocation(false);
        }
    }, []);

    // Fetch Ambulances
    useEffect(() => {
        const fetchAmbulances = async () => {
            if (!userLocation) return;
            try {
                const res = await fetch(`http://localhost:3000/api/ambulances?lat=${userLocation.lat}&lng=${userLocation.lng}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        setAmbulances(data.data);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch ambulances", err);
            }
        };
        fetchAmbulances();
        const interval = setInterval(fetchAmbulances, 3000);
        return () => clearInterval(interval);
    }, [userLocation]);

    // Fetch Hospitals
    useEffect(() => {
        const fetchHospitals = async () => {
            if (!userLocation) return;
            try {
                const res = await fetch(`http://localhost:3000/api/hospitals?lat=${userLocation.lat}&lng=${userLocation.lng}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        setHospitals(data.data);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch hospitals", err);
            }
        };
        if (activeTab === 'HOSPITALS' && userLocation) {
            fetchHospitals();
        }
    }, [activeTab, userLocation]);

    const tabs = ['CCTV', 'AMBULANCES', 'HOSPITALS'];

    return (
        <div className="min-h-screen w-full bg-darker flex flex-col font-sans text-white">
            <Header />

            <main className="flex-1 p-6 overflow-auto">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-white">Emergency Resources</h1>
                            <p className="text-slate-400 mt-1">Manage CCTV Network, Fleet, and Medical Centers.</p>
                        </div>

                        {/* Tabs */}
                        <div className="flex bg-panel border border-panel-border rounded-lg p-1">
                            {tabs.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab
                                        ? 'bg-primary text-white shadow-lg'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    {/* Content */}
                    {loadingLocation ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                            <p>Detecting Location...</p>
                        </div>
                    ) : (
                        <div>
                            {activeTab === 'CCTV' && (
                                <CCTVGrid cameras={cctvs} />
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {activeTab === 'AMBULANCES' && (
                                    ambulances.length > 0 ? (
                                        ambulances.map(res => <ResourceCard key={res.id} resource={res} type="AMBULANCE" />)
                                    ) : (
                                        <div className="col-span-full text-center text-slate-500 py-10">
                                            No ambulances found nearby. System updating...
                                        </div>
                                    )
                                )}

                                {activeTab === 'HOSPITALS' && (
                                    hospitals.length > 0 ? (
                                        hospitals.map(res => <ResourceCard key={res.id} resource={res} type="HOSPITAL" />)
                                    ) : (
                                        <div className="col-span-full text-center text-slate-500 py-10">
                                            Finding hospitals nearby...
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default ResourcesPage;
