import React, { useState } from 'react';

const CCTVFeed = () => {
    const [imageError, setImageError] = useState(false);
    // Use timestamp to force refresh on mount if needed, though usually not required for MJPEG
    const streamUrl = "http://localhost:8000/video_feed";

    return (
        <div className="absolute top-20 left-6 z-[1000] w-96 pointer-events-none">
            <div className="bg-darker/90 backdrop-blur-md rounded-xl border border-panel-border overflow-hidden p-2 pointer-events-auto shadow-2xl">
                <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-xs font-semibold text-slate-300">Live Camera Feed</span>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-critical rounded-full animate-pulse"></span>
                            <span className="text-[10px] text-critical font-bold">LIVE PROCESSING</span>
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
                                <p className="text-[10px] text-white font-mono">CAM-LIVE | Server Capture</p>
                                <p className="text-[10px] text-slate-400">YOLOv8n Direct Inference</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CCTVFeed;
