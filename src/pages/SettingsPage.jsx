import React, { useState, useEffect } from 'react';
import { Monitor, Ambulance } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Toggle = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-0">
        <span className="text-slate-300">{label}</span>
        <button
            onClick={() => onChange(!checked)}
            className={`w-12 h-6 rounded-full relative transition-colors ${checked ? 'bg-primary' : 'bg-slate-700'}`}
        >
            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`}></div>
        </button>
    </div>
);



const SettingsPage = () => {
    // AI Server State
    const [simulationMode, setSimulationMode] = useState(false);

    // Ambulance Service State
    const [ambulanceServicesEnabled, setAmbulanceServicesEnabled] = useState(true);

    useEffect(() => {
        // Fetch initial simulation mode state
        fetch('http://localhost:8000/mode')
            .then(res => res.json())
            .then(data => setSimulationMode(data.simulation))
            .catch(err => console.error("Failed to fetch mode:", err));

        // Fetch initial ambulance service state
        fetch('http://localhost:3000/api/ambulance-service-status')
            .then(res => res.json())
            .then(data => setAmbulanceServicesEnabled(data.enabled))
            .catch(err => console.error("Failed to fetch ambulance service status:", err));
    }, []);

    const handleSimulationToggle = (checked) => {
        setSimulationMode(checked);
        // Sync with server
        fetch('http://localhost:8000/set_mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ simulation: checked })
        }).catch(err => console.error("Failed to set mode:", err));
    };

    const handleAmbulanceServiceToggle = (checked) => {
        setAmbulanceServicesEnabled(checked);
        // Sync with server
        fetch('http://localhost:3000/api/set-ambulance-service', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: checked })
        }).catch(err => console.error("Failed to set ambulance service:", err));
    };

    return (
        <div className="min-h-screen w-full bg-darker flex flex-col font-sans text-white">
            <Header />

            <main className="flex-1 p-6 overflow-auto">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-2xl font-bold text-white mb-8">System Settings</h1>

                    <div className="space-y-6">
                        {/* Camera Configuration Section */}
                        <section className="bg-panel/50 backdrop-blur-sm border border-panel-border rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                                    <Monitor className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-semibold text-white">Camera Configuration</h2>
                            </div>
                            <div className="space-y-1">
                                <Toggle
                                    label="Simulation Mode (Use Test Images)"
                                    checked={simulationMode}
                                    onChange={handleSimulationToggle}
                                />
                                <p className="text-xs text-slate-500 mt-2 px-1">
                                    Override live camera feed with a simulated video loop using sample images. Useful for testing when no camera is available.
                                </p>
                            </div>
                        </section>

                        {/* Services Section */}
                        <section className="bg-panel/50 backdrop-blur-sm border border-panel-border rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-info/10 rounded-lg text-info">
                                    <Ambulance className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-semibold text-white">Services</h2>
                            </div>
                            <div className="space-y-1">
                                <Toggle
                                    label="Enable Ambulance Services"
                                    checked={ambulanceServicesEnabled}
                                    onChange={handleAmbulanceServiceToggle}
                                />
                                <p className="text-xs text-slate-500 mt-2 px-1">
                                    Disable ambulance tracking and routing to conserve GraphHopper API tokens. Ambulances will remain visible at their last known positions.
                                </p>
                            </div>
                        </section>


                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default SettingsPage;
