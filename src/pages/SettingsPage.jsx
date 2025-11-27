import React, { useState } from 'react';
import { Bell, Monitor, Shield, Globe, Save } from 'lucide-react';
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
    const [settings, setSettings] = useState({
        emailAlerts: true,
        smsAlerts: false,
        desktopNotifications: true,
        darkMode: true,
        highContrast: false,
        autoRefresh: true,
        publicAccess: false,
    });

    const handleToggle = (key) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="min-h-screen w-full bg-darker flex flex-col font-sans text-white">
            <Header />

            <main className="flex-1 p-6 overflow-auto">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-2xl font-bold text-white mb-8">System Settings</h1>

                    <div className="space-y-6">
                        {/* Notifications Section */}
                        <section className="bg-panel/50 backdrop-blur-sm border border-panel-border rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <Bell className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-semibold text-white">Notifications</h2>
                            </div>
                            <div className="space-y-1">
                                <Toggle label="Email Alerts" checked={settings.emailAlerts} onChange={() => handleToggle('emailAlerts')} />
                                <Toggle label="SMS Notifications" checked={settings.smsAlerts} onChange={() => handleToggle('smsAlerts')} />
                                <Toggle label="Desktop Push Notifications" checked={settings.desktopNotifications} onChange={() => handleToggle('desktopNotifications')} />
                            </div>
                        </section>

                        {/* Display Section */}
                        <section className="bg-panel/50 backdrop-blur-sm border border-panel-border rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-info/10 rounded-lg text-info">
                                    <Monitor className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-semibold text-white">Display & Interface</h2>
                            </div>
                            <div className="space-y-1">
                                <Toggle label="Dark Mode" checked={settings.darkMode} onChange={() => handleToggle('darkMode')} />
                                <Toggle label="High Contrast Mode" checked={settings.highContrast} onChange={() => handleToggle('highContrast')} />
                                <Toggle label="Auto-Refresh Dashboard" checked={settings.autoRefresh} onChange={() => handleToggle('autoRefresh')} />
                            </div>
                        </section>

                        {/* Security Section */}
                        <section className="bg-panel/50 backdrop-blur-sm border border-panel-border rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-critical/10 rounded-lg text-critical">
                                    <Shield className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-semibold text-white">Privacy & Security</h2>
                            </div>
                            <div className="space-y-1">
                                <Toggle label="Allow Public Access Links" checked={settings.publicAccess} onChange={() => handleToggle('publicAccess')} />
                                <div className="flex items-center justify-between py-4 border-b border-white/5">
                                    <span className="text-slate-300">Change Password</span>
                                    <button className="text-sm text-primary hover:text-blue-400 transition-colors">Update</button>
                                </div>
                                <div className="flex items-center justify-between py-4">
                                    <span className="text-slate-300">Two-Factor Authentication</span>
                                    <span className="text-sm text-success bg-success/10 px-2 py-1 rounded">Enabled</span>
                                </div>
                            </div>
                        </section>

                        <div className="flex justify-end pt-4">
                            <button className="bg-primary hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all">
                                <Save className="w-4 h-4" />
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default SettingsPage;
