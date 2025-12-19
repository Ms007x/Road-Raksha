const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');

// Ensure storage directory exists
const storageDir = path.join(__dirname, 'storage');
const videosDir = path.join(storageDir, 'videos');
const dbPath = path.join(storageDir, 'database.sqlite');

fs.ensureDirSync(videosDir);

// Initialize Database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // ============================================
        // EXISTING TABLES (Preserved)
        // ============================================

        // Create Videos Table
        db.run(`CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            original_name TEXT,
            path TEXT NOT NULL,
            size INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create Analysis Logs Table
        db.run(`CREATE TABLE IF NOT EXISTS analysis_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER,
            timestamp TEXT,
            incident_type TEXT,
            confidence REAL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (video_id) REFERENCES videos (id)
        )`);

        // ============================================
        // NEW ENHANCED TABLES
        // ============================================

        // 1. Incidents Table - Track accident/incident events
        db.run(`CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_type TEXT NOT NULL,
            severity TEXT,
            status TEXT DEFAULT 'Reported',
            location_lat REAL,
            location_lng REAL,
            location_address TEXT,
            description TEXT,
            reporter_name TEXT,
            reporter_contact TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME
        )`, (err) => {
            if (err) console.error('Error creating incidents table:', err.message);
            else console.log('✓ Incidents table ready');
        });

        // 2. Incident Videos - Many-to-many relationship
        db.run(`CREATE TABLE IF NOT EXISTS incident_videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id INTEGER NOT NULL,
            video_id INTEGER NOT NULL,
            is_primary INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (incident_id) REFERENCES incidents (id),
            FOREIGN KEY (video_id) REFERENCES videos (id)
        )`, (err) => {
            if (err) console.error('Error creating incident_videos table:', err.message);
            else console.log('✓ Incident_videos table ready');
        });

        // 3. Resources Table - Track emergency fleet (ambulances, patrol units, etc.)
        db.run(`CREATE TABLE IF NOT EXISTS resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resource_id TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL,
            driver_name TEXT,
            status TEXT DEFAULT 'Available',
            battery_level INTEGER DEFAULT 100,
            fuel_level INTEGER DEFAULT 100,
            current_location_lat REAL,
            current_location_lng REAL,
            location_name TEXT,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error('Error creating resources table:', err.message);
            else console.log('✓ Resources table ready');
        });

        // 4. Ambulance Dispatches - Track emergency response assignments
        db.run(`CREATE TABLE IF NOT EXISTS ambulance_dispatches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id INTEGER NOT NULL,
            resource_id TEXT NOT NULL,
            driver_name TEXT,
            status TEXT DEFAULT 'Dispatched',
            dispatch_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            arrival_time DATETIME,
            completion_time DATETIME,
            route_data TEXT,
            notes TEXT,
            FOREIGN KEY (incident_id) REFERENCES incidents (id)
        )`, (err) => {
            if (err) console.error('Error creating ambulance_dispatches table:', err.message);
            else console.log('✓ Ambulance_dispatches table ready');
        });

        // 5. Metrics Table - Store analytics data
        db.run(`CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metric_type TEXT NOT NULL,
            metric_value REAL,
            metadata TEXT,
            recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error('Error creating metrics table:', err.message);
            else console.log('✓ Metrics table ready');
        });

        console.log('🎉 Database schema initialization complete!');
    }
});

module.exports = db;
