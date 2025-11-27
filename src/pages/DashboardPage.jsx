import React from 'react';
import MapComponent from '../components/MapComponent';
import Header from '../components/Header';
import RightPanel from '../components/RightPanel';
import CCTVFeed from '../components/CCTVFeed';
import Footer from '../components/Footer';

const DashboardPage = () => {
    return (
        <div className="relative h-screen w-full bg-darker overflow-hidden font-sans text-white selection:bg-primary/30">
            {/* Background Map Layer */}
            <div className="absolute inset-0 z-0">
                <MapComponent />
            </div>

            {/* Overlay UI Layer */}
            <div className="relative z-10 h-full flex flex-col pointer-events-none">
                <Header />

                <div className="flex-1 relative">
                    {/* Widgets are absolutely positioned within this container */}
                    <CCTVFeed />
                    <RightPanel />
                </div>

                <Footer />
            </div>
        </div>
    );
};

export default DashboardPage;
