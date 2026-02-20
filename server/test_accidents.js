#!/usr/bin/env node
/**
 * Test Script: Add Sample Accidents with Coordinates
 * This script adds test accident data to demonstrate the accident markers feature
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000';

// Sample accident locations around Delhi
const sampleAccidents = [
    {
        type: 'Accident',
        location: 'Main Cam 01',
        latitude: 28.6139,
        longitude: 77.2090,
        confidence: 0.85  // Will be Critical (>0.7)
    },
    {
        type: 'Accident',
        location: 'Highway 8 Junction',
        latitude: 28.6200,
        longitude: 77.2150,
        confidence: 0.55  // Will be Major (0.4-0.7)
    },
    {
        type: 'Accident',
        location: 'City Center',
        latitude: 28.6100,
        longitude: 77.2000,
        confidence: 0.91  // Will be Critical (>0.7)
    },
    {
        type: 'Accident',
        location: 'East Road',
        latitude: 28.6250,
        longitude: 77.2200,
        confidence: 0.35  // Will be Minor (<0.4)
    },
    {
        type: 'Accident',
        location: 'North Avenue',
        latitude: 28.6300,
        longitude: 77.2100,
        confidence: 0.78  // Will be Critical (>0.7)
    }
];

async function addSampleAccidents() {
    console.log('🚨 Adding sample accidents to database...\n');

    for (let i = 0; i < sampleAccidents.length; i++) {
        const accident = sampleAccidents[i];
        try {
            const response = await axios.post(`${API_BASE}/api/incidents`, accident);
            console.log(`✅ Added accident ${i + 1}/${sampleAccidents.length}:`);
            console.log(`   Location: ${accident.location}`);
            console.log(`   Confidence: ${(accident.confidence * 100).toFixed(1)}%`);
            console.log(`   Auto-Severity: ${response.data.severity || 'N/A'}`);
            console.log(`   Coordinates: (${accident.latitude}, ${accident.longitude})`);
            console.log(`   ID: ${response.data.id}\n`);
        } catch (error) {
            console.error(`❌ Failed to add accident ${i + 1}:`, error.message);
        }
    }

    console.log('\n✅ Sample accidents added successfully!');
    console.log('\n📊 Fetching all accidents...\n');

    try {
        const response = await axios.get(`${API_BASE}/api/accidents/locations`);
        console.log(`Total accidents in database: ${response.data.count}`);
        console.log('\nAccident Locations:');
        response.data.data.forEach((acc, idx) => {
            console.log(`${idx + 1}. ${acc.location} - ${acc.severity} (Confidence: ${(acc.confidence * 100).toFixed(1)}%)`);
        });
    } catch (error) {
        console.error('❌ Failed to fetch accidents:', error.message);
    }
}

// Run the script
addSampleAccidents().then(() => {
    console.log('\n🎉 Test data setup complete!');
    console.log('📍 Open your map to see the accident markers!');
    process.exit(0);
}).catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
