import React, { useState, useEffect } from 'react';

const CCTVFeed = ({ userLocation, latestAccident }) => {
    const [imageError, setImageError] = useState(false);

    // Sync Location with AI Server
    useEffect(() => {
        if (latestAccident) {
            fetch('http://localhost:8000/set_location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat: latestAccident.lat,
                    lng: latestAccident.lng,
                    city: latestAccident.location
                })
            }).catch(err => console.error("Failed to sync location with AI server:", err));
        }
    }, [latestAccident?.id ?? null]);

    const streamUrl = "http://localhost:8000/video_feed";

    return (
        <div className="absolute top-20 left-6 z-[1000] w-96 pointer-events-none">
            <div className="bg-darker/90 backdrop-blur-md rounded-xl border border-panel-border overflow-hidden p-2 pointer-events-auto shadow-2xl">
                <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-xs font-semibold text-slate-300">INCIDENT MONITORING: {latestAccident?.id ? `INC-${latestAccident.id}` : 'LIVE'}</span>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-critical rounded-full animate-pulse"></span>
                            <span className="text-[10px] text-critical font-bold uppercase">{latestAccident?.status || 'Active'}</span>
                        </div>
                    </div>
                </div>

                <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 group">
                    {/* Direct MJPEG Stream from Python Server */}
                    {!imageError ? (
                        <img
                            src={streamUrl}
                            alt="Live Analysis"
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={() => setImageError(true)}
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-400 text-xs flex-col gap-2">
                            <p>Stream Offline</p>
                            <p className="text-[10px] text-slate-500">Check server console</p>
                        </div>
                    )}

                    {/* Overlay Info */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-white font-mono uppercase">{latestAccident?.location || 'Detecting Location...'}</p>
                                <p className="text-[10px] text-slate-400">YOLOv8 Critical Event Detection</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CCTVFeed;
