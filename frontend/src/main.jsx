import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

// Import pages (to be created)
import ControlCenter from './pages/ControlCenter/Dashboard'
import Hospital from './pages/Hospital/Dashboard'
import Ambulance from './pages/Ambulance/Dashboard'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/control-center" replace />} />
                <Route path="/control-center" element={<ControlCenter />} />
                <Route path="/hospital" element={<Hospital />} />
                <Route path="/ambulance" element={<Ambulance />} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>,
)
