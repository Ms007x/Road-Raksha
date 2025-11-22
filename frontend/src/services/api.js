import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Cameras
export const getCameras = () => api.get('/api/cameras');
export const getCamera = (id) => api.get(`/api/cameras/${id}`);
export const createCamera = (data) => api.post('/api/cameras', data);
export const updateCamera = (id, data) => api.patch(`/api/cameras/${id}`, data);
export const deleteCamera = (id) => api.delete(`/api/cameras/${id}`);

// Accidents
export const getAccidents = (params) => api.get('/api/accidents', { params });
export const getAccident = (id) => api.get(`/api/accidents/${id}`);
export const reportAccident = (data) => api.post('/api/accidents/report', data);
export const updateAccident = (id, data) => api.patch(`/api/accidents/${id}`, data);

// Emergency Services
export const findNearestAmbulance = (location, limit = 5) =>
    api.post('/api/emergency/nearest-ambulance', { location, limit });
export const findNearestHospital = (location, limit = 5) =>
    api.post('/api/emergency/nearest-hospital', { location, limit });

// Routing
export const calculateRoute = (startLocation, endLocation) =>
    api.post('/api/routing/route', { start_location: startLocation, end_location: endLocation });

// Analytics
export const getAccidentStatistics = (days = 30) =>
    api.get('/api/analytics/accident-statistics', { params: { days } });
export const getCameraPerformance = (hours = 24) =>
    api.get('/api/analytics/camera-performance', { params: { hours } });
export const getSummaryStatistics = () => api.get('/api/analytics/summary');

// Footage
export const getFootage = (params) => api.get('/api/footage', { params });
export const downloadFootage = (id) => `${API_BASE_URL}/api/footage/${id}/download`;
export const getThumbnail = (id) => `${API_BASE_URL}/api/footage/${id}/thumbnail`;

// WebSocket
export const createWebSocket = (onMessage, clientType = 'control_center') => {
    const wsUrl = API_BASE_URL.replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/ws`);

    ws.onopen = () => {
        console.log('WebSocket connected');
        ws.send(JSON.stringify({ type: 'register', client_type: clientType }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onMessage(data);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
    };

    return ws;
};

export default api;
