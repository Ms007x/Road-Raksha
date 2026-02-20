# 🚀 Road Raksha - Quick Start Scripts

Convenient scripts to start and stop all Road Raksha services with one command.

---

## 📋 Available Scripts

### `./rr-start`
**Starts all Road Raksha services**

Launches:
- ✅ Backend Server (Node.js on port 3000)
- ✅ Frontend Server (Vite on port 5173)
- ✅ AI Server (Python on port 8000) - *optional*

**Usage:**
```bash
./rr-start
```

**What it does:**
1. Checks if ports are already in use
2. Starts backend server in background
3. Starts frontend server in background
4. Optionally starts AI server
5. Shows status of all services

---

### `./rr-stop`
**Stops all Road Raksha services**

Kills:
- 🛑 Backend Server (port 3000)
- 🛑 Frontend Server (port 5173)
- 🛑 AI Server (port 8000)
- 🛑 Any related processes

**Usage:**
```bash
./rr-stop
```

**What it does:**
1. Kills processes on ports 3000, 5173, 8000
2. Cleans up remaining node/vite/python processes
3. Confirms all services stopped

---

## 🎯 Quick Reference

### Start Everything
```bash
./rr-start
```

### Stop Everything
```bash
./rr-stop
```

### Restart Everything
```bash
./rr-stop && ./rr-start
```

### Check What's Running
```bash
lsof -i:3000  # Backend
lsof -i:5173  # Frontend
lsof -i:8000  # AI Server
```

---

## 📊 Service Ports

| Service | Port | URL |
|---------|------|-----|
| Backend (Node.js) | 3000 | http://localhost:3000 |
| Frontend (Vite) | 5173 | http://localhost:5173 |
| AI Server (Python) | 8000 | http://localhost:8000 |

---

## 🔧 Manual Start (if needed)

### Backend
```bash
cd server
node index.js
```

### Frontend
```bash
npm run dev
```

### AI Server
```bash
cd ai_server
python main.py
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill specific port
lsof -ti:3000 | xargs kill -9

# Or use rr-stop to kill all
./rr-stop
```

### Services Not Starting
```bash
# Check if dependencies are installed
npm install
cd ai_server && pip install -r requirements.txt
```

### Permission Denied
```bash
# Make scripts executable
chmod +x rr-start rr-stop
```

---

## 📝 Notes

- Scripts run services in **background mode**
- Logs are saved to respective directories
- Use `./rr-stop` before closing terminal to clean up processes
- AI server is optional and can be started separately

---

*Road Raksha Quick Start Scripts - v1.0*
