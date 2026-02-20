import React, { useState } from 'react';
import { Camera, MapPin, Activity, Maximize2, Shield, AlertTriangle } from 'lucide-react';

const CCTVCameraFeed = ({ camera }) => {
    const [imageError, setImageError] = useState(false);
    const streamUrl = camera.status === 'Active'
        ? `http://localhost:8000/video_feed?cam=${camera.id}` // Adding param for future multi-cam support
        : null;

    return (
        <div className="bg-panel/40 backdrop-blur-md border border-panel-border rounded-xl overflow-hidden group hover:border-primary/50 transition-all shadow-xl">
            {/* Header: ID and Status */}
            <div className="p-3 bg-panel/60 border-b border-panel-border flex justify-between items-center transition-colors group-hover:bg-panel/80">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${camera.status === 'Active' ? 'bg-success animate-pulse' : 'bg-slate-500'}`}></div>
                    <span className="text-sm font-bold text-white tracking-wider">{camera.id}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10 uppercase">
                        {camera.type}
                    </span>
                </div>
            </div>

            {/* Video Feed Container */}
            <div className="relative aspect-video bg-black group-hover:scale-[1.02] transition-transform duration-500">
                {camera.status === 'Active' && !imageError ? (
                    <img
                        src={streamUrl}
                        alt={`Feed ${camera.id}`}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/50">
                        <Camera className="w-8 h-8 text-slate-700 mb-2" />
                        <span className="text-xs text-slate-500 font-medium">
                            {camera.status === 'Offline' ? 'CAMERA OFFLINE' : 'SIGNAL LOST'}
                        </span>
                    </div>
                )}

                {/* Video Overlays */}
                <div className="absolute top-2 left-2 flex gap-1">
                    <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-mono text-white flex items-center gap-1.5">
                        <div className="w-1 h-1 bg-critical rounded-full"></div>
                        REC
                    </div>
                </div>

                <button className="absolute bottom-2 right-2 p-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary">
                    <Maximize2 className="w-4 h-4" />
                </button>

                {camera.alerts > 0 && (
                    <div className="absolute top-2 right-2">
                        <div className="bg-critical/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 animate-bounce">
                            <AlertTriangle className="w-3 h-3" />
                            {camera.alerts} ALERTS
                        </div>
                    </div>
                )}
            </div>

            {/* Footer: Location and Stats */}
            <div className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                        <p className="text-xs font-semibold text-white leading-tight">{camera.location}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Jagtial City Surveillance Network</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                        <Activity className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] text-slate-400">FPS: 24.5</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Shield className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] text-slate-400">Health: 98%</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CCTVGrid = ({ cameras }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {cameras.map(camera => (
                <CCTVCameraFeed key={camera.id} camera={camera} />
            ))}
        </div>
    );
};

export default CCTVGrid;
