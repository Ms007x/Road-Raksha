# Road Raksha - Setup & Run Guide

## 1. Prerequisites
Ensure you have **Node.js** installed.
- Check with: `node -v` (Should be v18+)
- Check with: `npm -v` (Should be v9+)

## 2. Installation
You need to install dependencies for both the main project (frontend) and the server (backend).

### Auto-Install (Recommended)
Run this command in the root folder:
```bash
npm install && cd server && npm install && cd ..
```

### Manual Install
1. **Frontend**:
   ```bash
   npm install
   ```
2. **Backend**:
   ```bash
   cd server
   npm install
   cd ..
   ```

## 3. Running the Project
You can run the entire system (Frontend + Backend) with a single command.

### Single Command (Recommended)
```bash
npm start
```
This will:
- Start the **Backend Server** on port 3000 (http://localhost:3000)
- Start the **Frontend Dashboard** on port 5173 (http://localhost:5173)

### Manual Run (Separate Terminals)
If you prefer running them separately:
1. **Terminal 1 (Backend)**:
   ```bash
   cd server
   node index.js
   ```
2. **Terminal 2 (Frontend)**:
   ```bash
   npm run dev
   ```

## 4. Troubleshooting
- **Port In Use**: If you see "EADDRINUSE", it means the port is taken. Kill the process or restart your computer.
- **Map Not Loading**: Ensure you have an internet connection for the map tiles.
- **Ambulances Not Moving**: Ensure the backend server is running.
