import React, { useState, useEffect } from 'react';
import MapComponent from '../components/MapComponent';
import Header from '../components/Header';
import RightPanel from '../components/RightPanel';
import Footer from '../components/Footer';

// ── Dashboard Page ─────────────────────────────────────────────────────────────
const DashboardPage = () => {
    const [userLocation, setUserLocation] = useState(null);

    useEffect(() => {
        if (!navigator.geolocation) return;

        let latestCoords = null;

        const pushLocation = (lat, lng) => {
            fetch('http://localhost:8000/set_location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat, lng, city: 'User Location' })
            }).catch(err => console.error('Failed to sync location with AI server:', err));

            fetch('http://localhost:3000/api/set-user-location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat, lng })
            }).catch(err => console.error('Failed to sync location with backend:', err));
        };

        // Continuous GPS watch — re-centres geofence whenever user moves
        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                latestCoords = { lat: latitude, lng: longitude };
                setUserLocation(latestCoords);
                pushLocation(latitude, longitude);
            },
            (error) => {
                console.error('Geolocation watch error:', error.message);
            },
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
        );

        // 30-second heartbeat so the server's geofence stays fresh
        const heartbeat = setInterval(() => {
            if (latestCoords) pushLocation(latestCoords.lat, latestCoords.lng);
        }, 30000);

        return () => {
            navigator.geolocation.clearWatch(watchId);
            clearInterval(heartbeat);
        };
    }, []);

    return (
        <div className="relative h-screen w-full bg-darker overflow-hidden font-sans text-white selection:bg-primary/30">
            {/* Map */}
            <div className="absolute inset-0 z-0">
                <MapComponent userLocation={userLocation} setUserLocation={setUserLocation} />
            </div>

            {/* Overlay UI */}
            <div className="relative z-10 h-full flex flex-col pointer-events-none">
                <Header />
                <div className="flex-1 relative">
                    <RightPanel userLocation={userLocation} />
                </div>
                <Footer />
            </div>
        </div>
    );
};

export default DashboardPage;
