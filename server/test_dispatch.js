#!/usr/bin/env node
/**
 * Test Script: Nearest Ambulance Dispatch
 * Demonstrates automatic ambulance dispatch when accident is detected
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function testNearestAmbulanceDispatch() {
    console.log('🚨 Testing Nearest Ambulance Dispatch Feature\n');
    console.log('='.repeat(60));

    // Step 1: Check available ambulances
    console.log('\n📍 Step 1: Checking available ambulances...\n');
    try {
        const ambResponse = await axios.get(`${API_BASE}/api/ambulances?lat=28.6139&lng=77.2090`);
        const ambulances = ambResponse.data.data;

        console.log(`Total ambulances: ${ambulances.length}`);
        ambulances.forEach((amb, idx) => {
            console.log(`  ${idx + 1}. ${amb.service_name || 'Ambulance ' + amb.id}`);
            console.log(`     Status: ${amb.status}`);
            console.log(`     Location: (${amb.location.lat.toFixed(4)}, ${amb.location.lng.toFixed(4)})`);
            console.log(`     Speed: ${amb.speed} km/h\n`);
        });
    } catch (error) {
        console.error('❌ Failed to fetch ambulances:', error.message);
    }

    // Step 2: Simulate accident detection
    console.log('\n🚨 Step 2: Simulating accident detection...\n');

    const accident = {
        type: 'Accident',
        location: 'Test Accident Location - Main Highway',
        latitude: 28.6200,  // Slightly different location
        longitude: 77.2100,
        confidence: 0.88  // High confidence → Critical severity
    };

    console.log(`Accident Details:`);
    console.log(`  Location: ${accident.location}`);
    console.log(`  Coordinates: (${accident.latitude}, ${accident.longitude})`);
    console.log(`  AI Confidence: ${(accident.confidence * 100).toFixed(1)}%`);
    console.log(`\nSearching for nearest ambulance...\n`);

    try {
        const response = await axios.post(`${API_BASE}/api/incidents`, accident);
        const result = response.data;

        console.log('✅ Incident Created Successfully!\n');
        console.log('='.repeat(60));
        console.log(`\n📋 Incident Information:`);
        console.log(`  ID: INC-${result.id}`);
        console.log(`  Severity: ${result.severity} (auto-calculated from ${(accident.confidence * 100).toFixed(1)}% confidence)`);
        console.log(`  Status: ${result.status}`);

        if (result.ambulance) {
            console.log(`\n🚑 Dispatched Ambulance:`);
            console.log(`  Name: ${result.ambulance.name}`);
            console.log(`  Driver: ${result.ambulance.driver}`);
            console.log(`  Contact: ${result.ambulance.contact}`);
            console.log(`  Distance: ${result.ambulance.distance} km`);
            console.log(`  ETA: ${result.ambulance.eta} minutes`);
            console.log(`  Status: ${result.ambulance.status}`);
            console.log(`\n  ${result.dispatch}`);
        } else {
            console.log(`\n⚠️  ${result.dispatch}`);
        }

        if (result.hospital) {
            console.log(`\n🏥 Nearest Hospital:`);
            console.log(`  Name: ${result.hospital.name}`);
            console.log(`  Distance: ${result.hospital.distance} km`);
            console.log(`  Location: (${result.hospital.lat}, ${result.hospital.lng})`);
        }

        console.log('\n' + '='.repeat(60));

    } catch (error) {
        console.error('❌ Failed to create incident:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }

    // Step 3: Check ambulance status after dispatch
    console.log('\n📍 Step 3: Checking ambulance status after dispatch...\n');
    try {
        const ambResponse = await axios.get(`${API_BASE}/api/ambulances?lat=28.6139&lng=77.2090`);
        const ambulances = ambResponse.data.data;

        const onCallAmbs = ambulances.filter(a => a.status === 'on_call');
        const standbyAmbs = ambulances.filter(a => a.status === 'standby');
        const movingAmbs = ambulances.filter(a => a.status === 'moving');

        console.log(`Ambulance Status Summary:`);
        console.log(`  🔴 On Call (Dispatched): ${onCallAmbs.length}`);
        console.log(`  🟢 Standby (Available): ${standbyAmbs.length}`);
        console.log(`  🔵 Moving: ${movingAmbs.length}`);

        if (onCallAmbs.length > 0) {
            console.log(`\n  Dispatched Ambulances:`);
            onCallAmbs.forEach((amb, idx) => {
                console.log(`    ${idx + 1}. ${amb.service_name || 'Ambulance ' + amb.id} - Speed: ${amb.speed} km/h`);
            });
        }

    } catch (error) {
        console.error('❌ Failed to fetch ambulances:', error.message);
    }
}

// Run the test
console.log('\n🚀 Starting Nearest Ambulance Dispatch Test\n');
testNearestAmbulanceDispatch().then(() => {
    console.log('\n✅ Test completed!\n');
    process.exit(0);
}).catch(err => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
});
