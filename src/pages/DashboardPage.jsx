import React, { useState, useEffect } from 'react';
import MapComponent from '../components/MapComponent';
import Header from '../components/Header';
import RightPanel from '../components/RightPanel';
import CCTVFeed from '../components/CCTVFeed';
import Footer from '../components/Footer';

// ── Manual Report Modal ───────────────────────────────────────────────────────
const ReportModal = ({ userLocation, onClose }) => {
    const [severity, setSeverity] = useState('Critical');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null); // { success, message }

    const handleSubmit = async () => {
        if (!userLocation) {
            setResult({ success: false, message: 'Location not available. Allow GPS access.' });
            return;
        }
        setSubmitting(true);
        setResult(null);
        try {
            const res = await fetch('http://localhost:3000/api/incidents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'Manual Report',
                    location: `Manually Reported (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})`,
                    latitude: userLocation.lat,
                    longitude: userLocation.lng,
                    confidence: severity === 'Critical' ? 0.9 : 0.5,
                }),
            });
            const data = await res.json();
            if (res.ok && !data.error) {
                setResult({ success: true, message: data.dispatch || 'Incident reported successfully.' });
            } else if (res.status === 429) {
                setResult({ success: false, message: 'System is busy (3 active incidents). Try again shortly.' });
            } else {
                setResult({ success: false, message: data.message || data.error || 'Failed to report incident.' });
            }
        } catch (err) {
            setResult({ success: false, message: 'Could not reach server.' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 pointer-events-auto">
            <div className="bg-panel border border-panel-border rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                {/* Header */}
                <div className="bg-red-900/40 border-b border-red-500/20 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🚨</span>
                        <div>
                            <h3 className="text-white font-bold text-lg">Report Incident</h3>
                            <p className="text-red-300 text-xs">Your current location will be used</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded transition-colors">✕</button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Location display */}
                    <div className="bg-black/30 rounded-lg px-4 py-3 border border-white/5">
                        <p className="text-xs text-slate-500 mb-1">📍 Incident Location</p>
                        <p className="text-sm font-mono text-slate-300">
                            {userLocation
                                ? `${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`
                                : 'Detecting location…'}
                        </p>
                    </div>

                    {/* Severity Selector */}
                    <div>
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">Severity Level</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setSeverity('Critical')}
                                className={`py-3 rounded-lg border text-sm font-bold transition-all ${severity === 'Critical'
                                    ? 'bg-red-500/20 border-red-500 text-red-400'
                                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/30'}`}
                            >
                                🔴 Critical
                            </button>
                            <button
                                onClick={() => setSeverity('Minor')}
                                className={`py-3 rounded-lg border text-sm font-bold transition-all ${severity === 'Minor'
                                    ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/30'}`}
                            >
                                🟡 Minor
                            </button>
                        </div>
                    </div>

                    {/* Result message */}
                    {result && (
                        <div className={`rounded-lg px-4 py-3 text-sm border ${result.success
                            ? 'bg-green-500/10 border-green-500/30 text-green-400'
                            : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                            {result.message}
                        </div>
                    )}

                    {/* Submit */}
                    {!result?.success && (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || !userLocation}
                            className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Reporting…</>
                            ) : '🚨 Report Incident'}
                        </button>
                    )}
                    {result?.success && (
                        <button onClick={onClose} className="w-full py-3 bg-green-700 hover:bg-green-600 text-white font-bold rounded-lg transition-colors">
                            ✓ Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Dashboard Page ─────────────────────────────────────────────────────────────
const DashboardPage = () => {
    const [userLocation, setUserLocation] = useState(null);
    const [latestAccident, setLatestAccident] = useState(null);
    const [showReportModal, setShowReportModal] = useState(false);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setUserLocation({ lat: latitude, lng: longitude });

                    // Push real GPS to AI server
                    fetch('http://localhost:8000/set_location', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lat: latitude, lng: longitude, city: "User Location" })
                    }).catch(err => console.error("Failed to sync location with AI server:", err));

                    // Push real GPS to backend server so AI-detected incidents use correct coordinates
                    fetch('http://localhost:3000/api/set-user-location', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lat: latitude, lng: longitude })
                    }).catch(err => console.error("Failed to sync location with backend:", err));
                },
                (error) => {
                    console.error("Geolocation Error:", error.message);
                }
            );
        }
    }, []);

    useEffect(() => {
        const checkAccidents = async () => {
            try {
                const res = await fetch('http://localhost:3000/api/accidents/locations');
                const data = await res.json();
                if (data.success && data.data.length > 0) {
                    const latest = data.data[0];
                    const accidentTime = new Date(latest.timestamp).getTime();
                    const diffInMinutes = (Date.now() - accidentTime) / (1000 * 60);
                    const isActive = ['Pending', 'Dispatched'].includes(latest.status);
                    const isFresh = diffInMinutes < 5;
                    setLatestAccident(isActive && isFresh ? latest : null);
                } else {
                    setLatestAccident(null);
                }
            } catch (err) {
                console.error("Failed to check for accidents:", err);
            }
        };

        checkAccidents();
        const interval = setInterval(checkAccidents, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative h-screen w-full bg-darker overflow-hidden font-sans text-white selection:bg-primary/30">
            {/* Background Map Layer */}
            <div className="absolute inset-0 z-0">
                <MapComponent userLocation={userLocation} setUserLocation={setUserLocation} />
            </div>

            {/* Overlay UI Layer */}
            <div className="relative z-10 h-full flex flex-col pointer-events-none">
                <Header />

                <div className="flex-1 relative">
                    {latestAccident && (
                        <CCTVFeed userLocation={userLocation} latestAccident={latestAccident} />
                    )}
                    <RightPanel userLocation={userLocation} />

                    {/* 🚨 Manual Report Floating Button */}
                    <div className="absolute bottom-6 left-6 pointer-events-auto z-20">
                        <button
                            onClick={() => setShowReportModal(true)}
                            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-3 rounded-full shadow-lg shadow-red-900/50 transition-all hover:scale-105 active:scale-95 border border-red-400/30"
                        >
                            <span className="text-lg">🚨</span>
                            <span className="text-sm">Report Incident</span>
                        </button>
                    </div>
                </div>

                <Footer />
            </div>

            {/* Report Modal */}
            {showReportModal && (
                <ReportModal userLocation={userLocation} onClose={() => setShowReportModal(false)} />
            )}
        </div>
    );
};

export default DashboardPage;
