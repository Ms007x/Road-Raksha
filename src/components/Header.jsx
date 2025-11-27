import React from 'react';
import { Shield, LayoutDashboard, Bell, BarChart2, Folder, Settings, User, BellRing } from 'lucide-react';

const Header = () => {
    return (
        <header className="h-16 bg-darker/80 backdrop-blur-md flex items-center justify-between px-6 border-b border-panel-border z-50">
            <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-primary fill-primary/20" />
                <h1 className="text-xl font-bold text-white tracking-tight">Road Raksha</h1>
            </div>

            <nav className="hidden md:flex items-center gap-1">
                <button className="flex items-center gap-2 px-4 py-2 text-primary bg-primary/10 rounded-t-lg border-b-2 border-primary transition-all">
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="font-medium text-sm">Dashboard</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                    <Bell className="w-4 h-4" />
                    <span className="font-medium text-sm">Incidents</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                    <BarChart2 className="w-4 h-4" />
                    <span className="font-medium text-sm">Analytics</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                    <Folder className="w-4 h-4" />
                    <span className="font-medium text-sm">Resources</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                    <Settings className="w-4 h-4" />
                    <span className="font-medium text-sm">Settings</span>
                </button>
            </nav>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 px-3 py-1.5 bg-panel rounded-full border border-panel-border">
                    <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-300" />
                    </div>
                    <span className="text-sm text-slate-300 pr-2">Operator: Priya Sharma</span>
                </div>
                <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
                    <BellRing className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-critical rounded-full border-2 border-darker"></span>
                </button>
            </div>
        </header>
    );
};

export default Header;
