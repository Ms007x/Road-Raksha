# 🚑 Nearest Ambulance Dispatch - Implementation Complete!

**Feature:** Automatic Nearest Ambulance Dispatch on Accident Detection  
**Status:** ✅ Fully Implemented  
**Date:** January 26, 2026

---

## 🎯 Overview

When an accident is detected by the AI model, the system now automatically:
1. **Finds the nearest available ambulance** using real distance calculation
2. **Dispatches it to the accident location** with route planning
3. **Calculates ETA** based on distance and speed
4. **Updates ambulance status** to 'on_call'
5. **Finds nearest hospital** for reference

---

## 🚀 How It Works

### 1. Accident Detection
```python
# From AI model (main.py)
if label == "Accident" and track_conf >= ALERT_THRESHOLD:
    payload = {
        "type": "Accident",
        "location": cam_name,
        "latitude": camera_lat,
        "longitude": camera_lng,
        "confidence": track_conf
    }
    requests.post("http://localhost:3000/api/incidents", json=payload)
```

### 2. Automatic Dispatch Process

**Step 1: Find Nearest Ambulance**
- Searches all ambulances with status: `standby` or `moving`
- Calculates real distance using **Haversine formula**
- Selects closest ambulance

**Step 2: Calculate ETA**
```javascript
distance (km) / speed (km/h) * 60 = ETA (minutes)
```

**Step 3: Dispatch**
- Changes ambulance status to `on_call`
- Sets destination to accident location
- Increases speed to 60-80 km/h (emergency mode)
- Plans route to accident site

**Step 4: Find Nearest Hospital**
- Identifies closest hospital for reference
- Calculates distance to hospital

---

## 📊 Distance Calculation

### Haversine Formula
Calculates the shortest distance between two points on Earth's surface:

```javascript
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
};
```

**Advantages:**
- ✅ Accurate real-world distances
- ✅ Accounts for Earth's curvature
- ✅ Works globally
- ✅ Fast calculation

---

## 🎨 Ambulance Status Flow

```
┌─────────────┐
│   Standby   │ ← Available for dispatch
│   (Green)   │
└──────┬──────┘
       │ Accident detected
       ↓
┌─────────────┐
│  On Call    │ ← Dispatched to accident
│    (Red)    │
└──────┬──────┘
       │ Reaches accident
       ↓
┌─────────────┐
│   Moving    │ ← Transporting to hospital
│   (Blue)    │
└──────┬──────┘
       │ Completes mission
       ↓
┌─────────────┐
│   Standby   │ ← Back to available
│   (Green)   │
└─────────────┘
```

---

## 📝 API Response

### Request
```json
POST /api/incidents
{
  "type": "Accident",
  "location": "Main Highway",
  "latitude": 28.6200,
  "longitude": 77.2100,
  "confidence": 0.88
}
```

### Response
```json
{
  "id": 25,
  "message": "Incident saved",
  "dispatch": "Dispatched Mahesh Ambulance Services - ETA: 12 min (8.5 km away)",
  "status": "Dispatched",
  "severity": "Critical",
  "latitude": 28.62,
  "longitude": 77.21,
  "confidence": 0.88,
  
  "ambulance": {
    "id": "AMB-7",
    "name": "Mahesh Ambulance Services",
    "driver": "Rajesh Kumar",
    "contact": "09845262364",
    "distance": "8.52",
    "eta": 12,
    "status": "on_call"
  },
  
  "hospital": {
    "id": "262439881",
    "name": "Guru Harkrishan Polyclinic",
    "lat": 28.6267693,
    "lng": 77.2092035,
    "distance": "0.76"
  }
}
```

---

## 🧪 Testing

### Test Script
```bash
cd server
node test_dispatch.js
```

### Test Output Example
```
🚨 Testing Nearest Ambulance Dispatch Feature

📍 Step 1: Checking available ambulances...
Total ambulances: 10
  1. Sanjivani Ambulance Service - Status: standby
  2. Mumbai Health Care - Status: moving
  ...

🚨 Step 2: Simulating accident detection...
Accident Details:
  Location: Test Accident Location - Main Highway
  Coordinates: (28.6200, 77.2100)
  AI Confidence: 88.0%

✅ Incident Created Successfully!

📋 Incident Information:
  ID: INC-25
  Severity: Critical (auto-calculated from 88.0% confidence)
  Status: Dispatched

🚑 Dispatched Ambulance:
  Name: Mahesh Ambulance Services
  Driver: Rajesh Kumar
  Contact: 09845262364
  Distance: 8.52 km
  ETA: 12 minutes
  Status: on_call

🏥 Nearest Hospital:
  Name: Guru Harkrishan Polyclinic
  Distance: 0.76 km

📍 Step 3: Checking ambulance status after dispatch...
Ambulance Status Summary:
  🔴 On Call (Dispatched): 1
  🟢 Standby (Available): 6
  🔵 Moving: 3
```

---

## 🎯 Key Features

### 1. **Smart Selection**
- ✅ Only considers available ambulances (`standby` or `moving`)
- ✅ Ignores already dispatched ambulances (`on_call`)
- ✅ Selects based on shortest distance

### 2. **Real Distance Calculation**
- ✅ Uses Haversine formula for accuracy
- ✅ Returns distance in kilometers
- ✅ Works for any location globally

### 3. **ETA Estimation**
- ✅ Calculates based on distance and speed
- ✅ Emergency speed: 60-80 km/h
- ✅ Returns ETA in minutes

### 4. **Status Management**
- ✅ Automatically updates ambulance status
- ✅ Tracks dispatch state
- ✅ Prevents double-dispatch

### 5. **Hospital Integration**
- ✅ Finds nearest hospital
- ✅ Provides distance information
- ✅ Useful for route planning

---

## 🔧 Configuration

### Ambulance Speed Settings

**Emergency Mode (On Call):**
```javascript
nearestAmb.speed = 60 + Math.floor(Math.random() * 20); // 60-80 km/h
```

**Normal Mode (Moving):**
```javascript
speed = Math.floor(Math.random() * 40) + 20; // 20-60 km/h
```

**Standby:**
```javascript
speed = 0; // Stationary
```

### Distance Threshold

To limit dispatch to nearby ambulances only:
```javascript
if (nearestDistance < 50) { // Within 50 km
    // Dispatch ambulance
} else {
    // No ambulances in range
}
```

---

## 📊 Performance Metrics

### Dispatch Success Rate
```sql
SELECT 
  COUNT(CASE WHEN status = 'Dispatched' THEN 1 END) as dispatched,
  COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending,
  COUNT(*) as total
FROM incidents;
```

### Average Response Time
```sql
SELECT 
  AVG(CAST(
    SUBSTR(dispatch, 
      INSTR(dispatch, 'ETA: ') + 5, 
      INSTR(dispatch, ' min') - INSTR(dispatch, 'ETA: ') - 5
    ) AS INTEGER
  )) as avg_eta_minutes
FROM incidents
WHERE status = 'Dispatched';
```

---

## 🗺️ Map Integration

### Display Dispatched Ambulance Route

The ambulance route is automatically calculated and can be displayed on the map:

```javascript
// In MapComponent.jsx
{accidents.map(accident => {
  if (accident.ambulance) {
    return (
      <>
        {/* Accident Marker */}
        <Marker position={[accident.lat, accident.lng]} />
        
        {/* Ambulance Route Line */}
        <Polyline
          positions={ambulance.route}
          color="red"
          weight={3}
          dashArray="10, 10"
        />
      </>
    );
  }
})}
```

---

## 🚨 Edge Cases Handled

### 1. No Ambulances Available
```json
{
  "status": "Pending",
  "dispatch": "No ambulances available",
  "ambulance": null
}
```

### 2. All Ambulances Busy
- System searches for `standby` or `moving` status
- If all are `on_call`, returns "No ambulances available"

### 3. Missing Coordinates
- Falls back to BASE_LAT/BASE_LNG
- Logs warning message

### 4. Invalid Confidence
- Defaults to "Major" severity
- Still dispatches ambulance

---

## 📈 Future Enhancements

### 1. **Route Optimization** 🔜
- Use real road networks (GraphHopper API)
- Avoid traffic congestion
- Multiple waypoints

### 2. **Priority Queue** 🔜
- Handle multiple simultaneous accidents
- Prioritize by severity
- Queue management

### 3. **Ambulance Tracking** 🔜
- Real-time location updates
- Live ETA recalculation
- Route progress tracking

### 4. **Smart Dispatch** 🔜
- Consider ambulance equipment
- Match severity to ambulance type
- Load balancing

### 5. **Notification System** 🔜
- SMS to ambulance driver
- Push notifications
- Alert nearest hospital

---

## ✅ Implementation Checklist

- [x] Haversine distance calculation
- [x] Find nearest available ambulance
- [x] Calculate ETA
- [x] Update ambulance status
- [x] Find nearest hospital
- [x] Return dispatch information
- [x] Handle edge cases
- [x] Create test script
- [x] Add logging
- [x] Document API

---

## 🎉 Summary

**What You Get:**
- ✅ Automatic nearest ambulance dispatch
- ✅ Real distance calculation (Haversine)
- ✅ ETA estimation
- ✅ Status management
- ✅ Hospital integration
- ✅ Comprehensive API response

**How to Use:**
```javascript
// Just detect accident with coordinates
POST /api/incidents
{
  "type": "Accident",
  "location": "Location Name",
  "latitude": 28.6200,
  "longitude": 77.2100,
  "confidence": 0.88
}

// System automatically:
// 1. Finds nearest ambulance
// 2. Calculates distance & ETA
// 3. Dispatches ambulance
// 4. Updates status
// 5. Returns all info
```

**The system now intelligently dispatches the nearest ambulance when an accident is detected!** 🚑

---

*Feature implemented: January 26, 2026*  
*Nearest Ambulance Dispatch: ✅ Production Ready*
