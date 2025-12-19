const db = require('./db');

console.log('🌱 Starting database seeding...');

// Wait for database to initialize
setTimeout(() => {
    // Seed Resources (Emergency Fleet)
    const resources = [
        { id: 'AMB-01', type: 'Ambulance', driver: 'Rahul Singh', status: 'On Mission', battery: 85, fuel: 80, lat: 28.6139, lng: 77.2090, location: 'Sector 4' },
        { id: 'AMB-02', type: 'Ambulance', driver: 'Vikram Malhotra', status: 'Available', battery: 100, fuel: 95, lat: 28.5355, lng: 77.3910, location: 'Base Station' },
        { id: 'AMB-03', type: 'Ambulance', driver: 'Amit Kumar', status: 'Available', battery: 90, fuel: 88, lat: 28.7041, lng: 77.1025, location: 'Station 2' },
        { id: 'PTR-01', type: 'Patrol Unit', driver: 'Sgt. Kaur', status: 'Patrolling', battery: 60, fuel: 65, lat: 28.4595, lng: 77.0266, location: 'Highway 8' },
        { id: 'PTR-02', type: 'Patrol Unit', driver: 'Ofc. Sharma', status: 'Maintenance', battery: 0, fuel: 20, lat: 28.6692, lng: 77.4538, location: 'Workshop' },
        { id: 'FIR-01', type: 'Fire Truck', driver: 'Capt. Verma', status: 'Available', battery: 95, fuel: 92, lat: 28.5244, lng: 77.1855, location: 'Station 1' },
        { id: 'DRN-01', type: 'Drone Unit', driver: 'Auto-Pilot', status: 'Airborne', battery: 45, fuel: 50, lat: 28.6304, lng: 77.2177, location: 'Sector 7' },
    ];

    let completed = 0;
    const total = resources.length;

    resources.forEach((resource) => {
        const sql = `INSERT OR IGNORE INTO resources 
            (resource_id, type, driver_name, status, battery_level, fuel_level, current_location_lat, current_location_lng, location_name) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        db.run(sql, [
            resource.id,
            resource.type,
            resource.driver,
            resource.status,
            resource.battery,
            resource.fuel,
            resource.lat,
            resource.lng,
            resource.location
        ], function (err) {
            if (err) {
                console.error(`❌ Error inserting ${resource.id}:`, err.message);
            } else if (this.changes > 0) {
                console.log(`✓ Inserted resource: ${resource.id} (${resource.type})`);
            } else {
                console.log(`⊙ Resource ${resource.id} already exists, skipped`);
            }

            completed++;
            if (completed === total) {
                console.log('🎉 Seeding complete!');
                console.log(`📊 ${total} resources processed`);
                db.close();
            }
        });
    });

    // Seed some sample metrics
    const metrics = [
        { type: 'avg_response_time', value: 8.5 },
        { type: 'detection_accuracy', value: 0.92 },
        { type: 'total_incidents_today', value: 12 },
        { type: 'active_ambulances', value: 5 },
    ];

    metrics.forEach((metric) => {
        const sql = `INSERT INTO metrics (metric_type, metric_value) VALUES (?, ?)`;
        db.run(sql, [metric.type, metric.value], (err) => {
            if (err) console.error('Error inserting metric:', err.message);
        });
    });

}, 1000);
