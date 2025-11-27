import React from 'react';

const CCTVFeed = () => {
    return (
        <div className="absolute top-20 left-6 z-[1000] w-80 pointer-events-none">
            <div className="bg-darker/90 backdrop-blur-md rounded-xl border border-panel-border overflow-hidden p-2 pointer-events-auto shadow-2xl">
                <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-xs font-semibold text-slate-300">CCTV Feed</span>
                    <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-critical rounded-full animate-pulse"></span>
                        <span className="text-[10px] text-critical font-bold">LIVE</span>
                    </div>
                </div>

                <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 group">
                    {/* Mock CCTV Image/Video Placeholder */}
                    <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                        <span className="text-slate-600 text-xs">Camera 04 Feed</span>
                    </div>

                    {/* Simulated YOLO Bounding Box */}
                    <div className="absolute top-1/4 left-1/4 w-1/3 h-1/3 border-2 border-critical rounded-sm">
                        <div className="absolute -top-5 left-0 bg-critical text-white text-[10px] px-1 py-0.5 font-bold">
                            ACCIDENT 94%
                        </div>
                    </div>

                    {/* Overlay Info */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-[10px] text-white font-mono">CAM-04 | Sector 12 Junction</p>
                        <p className="text-[10px] text-slate-400">YOLOv8 Detection: Vehicle Collision</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CCTVFeed;
