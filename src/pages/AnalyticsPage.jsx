import React, { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { Activity } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const StatCard = ({ title, value, subtext, icon: Icon, color }) => (
    <div className="bg-panel/50 backdrop-blur-sm border border-panel-border rounded-xl p-6 flex items-start justify-between hover:bg-panel/70 transition-colors">
        <div>
            <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-white mb-2">{value}</h3>
            <p className="text-xs text-slate-500">{subtext}</p>
        </div>
        <div className={`p-3 rounded-lg bg-${color}/10 text-${color}`}>
            <Icon className="w-6 h-6" />
        </div>
    </div>
);

const AnalyticsPage = () => {
    const [stats, setStats] = useState({
        total: 0,
        severityData: [],
        hourlyData: []
    });

    // Fetch from Real Backend
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('http://localhost:3000/api/analytics');
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        setStats({
                            total: data.total,
                            severityData: data.severityData,
                            hourlyData: data.hourlyData
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to fetch analytics:", err);
            }
        };

        fetchStats();
        // Poll every 5s
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);
    return (
        <div className="min-h-screen w-full bg-darker flex flex-col font-sans text-white">
            <Header />

            <main className="flex-1 p-6 overflow-auto">
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-white">System Analytics</h1>
                        <div className="flex gap-2">
                            <span className="text-sm text-slate-400">Last updated: Just now</span>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            title="Total Incidents"
                            value={stats.total}
                            subtext="Recorded in database"
                            icon={Activity}
                            color="primary"
                        />
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">

                        {/* Main Chart: Incidents Over Time */}
                        <div className="lg:col-span-2 bg-panel/50 backdrop-blur-sm border border-panel-border rounded-xl p-6 flex flex-col">
                            <h3 className="text-lg font-semibold text-white mb-6">Incidents Overview (Hourly)</h3>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.hourlyData}>
                                        <defs>
                                            <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Area type="monotone" dataKey="incidents" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorIncidents)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Secondary Chart: Severity Distribution */}
                        <div className="bg-panel/50 backdrop-blur-sm border border-panel-border rounded-xl p-6 flex flex-col">
                            <h3 className="text-lg font-semibold text-white mb-6">Severity Distribution</h3>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.severityData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {stats.severityData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>



                </div>
            </main>

            <Footer />
        </div>
    );
};

export default AnalyticsPage;
