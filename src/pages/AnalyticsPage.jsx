import React from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Activity, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

// Mock Data
const incidentsData = [
    { name: '00:00', incidents: 2 },
    { name: '04:00', incidents: 1 },
    { name: '08:00', incidents: 5 },
    { name: '12:00', incidents: 8 },
    { name: '16:00', incidents: 12 },
    { name: '20:00', incidents: 6 },
    { name: '23:59', incidents: 3 },
];

const severityData = [
    { name: 'Critical', value: 35, color: '#ef4444' },
    { name: 'Major', value: 25, color: '#f97316' },
    { name: 'Minor', value: 40, color: '#eab308' },
];

const responseTimeData = [
    { zone: 'North', time: 12 },
    { zone: 'South', time: 8 },
    { zone: 'East', time: 15 },
    { zone: 'West', time: 10 },
    { zone: 'Central', time: 6 },
];

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
                            value="124"
                            subtext="+12% from yesterday"
                            icon={Activity}
                            color="primary"
                        />
                        <StatCard
                            title="Avg Response Time"
                            value="8m 42s"
                            subtext="-30s improvement"
                            icon={Clock}
                            color="info"
                        />
                        <StatCard
                            title="Active Alerts"
                            value="12"
                            subtext="3 Critical"
                            icon={AlertTriangle}
                            color="critical"
                        />
                        <StatCard
                            title="Resolved Cases"
                            value="1,284"
                            subtext="98% clearance rate"
                            icon={CheckCircle}
                            color="success"
                        />
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">

                        {/* Main Chart: Incidents Over Time */}
                        <div className="lg:col-span-2 bg-panel/50 backdrop-blur-sm border border-panel-border rounded-xl p-6 flex flex-col">
                            <h3 className="text-lg font-semibold text-white mb-6">Incidents Overview (24h)</h3>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={incidentsData}>
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
                                            data={severityData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {severityData.map((entry, index) => (
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

                    {/* Bottom Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[350px]">
                        {/* Response Time by Zone */}
                        <div className="bg-panel/50 backdrop-blur-sm border border-panel-border rounded-xl p-6 flex flex-col">
                            <h3 className="text-lg font-semibold text-white mb-6">Avg Response Time by Zone (mins)</h3>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={responseTimeData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                                        <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="zone" type="category" stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={60} />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                        />
                                        <Bar dataKey="time" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Recent Alerts List */}
                        <div className="bg-panel/50 backdrop-blur-sm border border-panel-border rounded-xl p-6 overflow-hidden flex flex-col">
                            <h3 className="text-lg font-semibold text-white mb-4">Recent System Alerts</h3>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                        <div className="mt-1 w-2 h-2 rounded-full bg-critical shrink-0 animate-pulse"></div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">High traffic congestion detected on Highway 8</p>
                                            <p className="text-xs text-slate-500 mt-1">2 minutes ago • Zone North</p>
                                        </div>
                                    </div>
                                ))}
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
