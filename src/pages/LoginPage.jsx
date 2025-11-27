import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';

const LoginPage = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        // Mock Authentication
        if (username && password) {
            onLogin();
            navigate('/dashboard');
        }
    };

    return (
        <div className="min-h-screen w-full bg-darker flex items-center justify-center relative overflow-hidden">
            {/* Background Circuit Effect (CSS Radial Gradient approximation) */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-darker to-darker z-0"></div>

            {/* Circuit Lines SVG Background (Optional, using simple CSS lines for now) */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)',
                backgroundSize: '40px 40px'
            }}></div>

            {/* Login Card */}
            <div className="relative z-10 w-full max-w-md p-8 bg-panel/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
                <div className="flex flex-col items-center mb-8">
                    <Shield className="w-12 h-12 text-primary mb-3" />
                    <h1 className="text-2xl font-bold text-white tracking-wide">Road Raksha</h1>
                    <h2 className="text-3xl font-semibold text-white mt-6">Login</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <input
                            type="text"
                            placeholder="Username or Email"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 bg-darker/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-darker/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                    </div>

                    <div className="flex justify-end">
                        <a href="#" className="text-sm text-primary hover:text-blue-400 transition-colors">Forgot Password?</a>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 bg-primary hover:bg-blue-600 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/20 transition-all transform hover:scale-[1.02]"
                    >
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
