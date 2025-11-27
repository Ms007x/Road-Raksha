import React from 'react';

const Footer = () => {
    return (
        <footer className="h-8 bg-darker/90 backdrop-blur-md border-t border-panel-border flex items-center justify-between px-4 z-50 w-full shrink-0 pointer-events-auto">
            <div className="flex items-center gap-4 text-[10px] text-slate-400">
                <span className="text-success">System Online</span>
                <span>•</span>
                <span>YOLOv8 Model Active</span>
                <span>•</span>
                <span>Last Updated: 10:45:32 AM</span>
            </div>
            <div className="text-[10px] text-slate-500">
                Network Status: <span className="text-slate-300">Stable</span>
            </div>
        </footer>
    );
};

export default Footer;
