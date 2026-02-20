# 🎯 Accident Detection Threshold Tuning Guide

## Problem: False Positives (Detecting Accidents in Photos)

Your AI model is detecting accidents in static photos or non-accident scenes. This is a **false positive** problem.

---

## ✅ Solution Applied

I've increased the confidence thresholds to reduce false positives:

### Changes Made

```python
# Before (Too Sensitive)
conf=0.25                    # Model confidence threshold
ALERT_THRESHOLD = 0.40       # Database alert threshold
VISUAL_THRESHOLD = 0.15      # Visual display threshold

# After (More Accurate)
conf=0.50                    # Higher model confidence
ALERT_THRESHOLD = 0.50       # Only high-confidence alerts
VISUAL_THRESHOLD = 0.30      # Show only confident detections
```

---

## 🎚️ Threshold Explanation

### 1. **Model Confidence (`conf`)**
- **What it does:** Filters detections at the model level
- **Current:** `0.50` (50%)
- **Range:** 0.0 to 1.0
- **Effect:** Only detections with 50%+ confidence are considered

### 2. **ALERT_THRESHOLD**
- **What it does:** Determines if accident is sent to database
- **Current:** `0.50` (50%)
- **Effect:** Only accidents with 50%+ confidence trigger alerts

### 3. **VISUAL_THRESHOLD**
- **What it does:** Determines if detection is drawn on video
- **Current:** `0.30` (30%)
- **Effect:** Only shows detections with 30%+ confidence

---

## 🔧 How to Tune Thresholds

### If Still Getting False Positives:

**Increase thresholds:**
```python
# In ai_server/main.py, line ~212
results_acc = model_accident(frame, verbose=False, conf=0.60, device='cpu', imgsz=320)

# Line ~206
ALERT_THRESHOLD = 0.60
VISUAL_THRESHOLD = 0.40
```

### If Missing Real Accidents:

**Decrease thresholds:**
```python
# In ai_server/main.py, line ~212
results_acc = model_accident(frame, verbose=False, conf=0.40, device='cpu', imgsz=320)

# Line ~206
ALERT_THRESHOLD = 0.45
VISUAL_THRESHOLD = 0.25
```

---

## 📊 Recommended Threshold Settings

### Conservative (Fewer False Positives)
```python
conf = 0.60
ALERT_THRESHOLD = 0.60
VISUAL_THRESHOLD = 0.40
```
**Use when:** You want to be very sure before alerting
**Trade-off:** Might miss some real accidents

### Balanced (Current Setting)
```python
conf = 0.50
ALERT_THRESHOLD = 0.50
VISUAL_THRESHOLD = 0.30
```
**Use when:** You want a good balance
**Trade-off:** Moderate false positives and false negatives

### Aggressive (Catch More Accidents)
```python
conf = 0.35
ALERT_THRESHOLD = 0.40
VISUAL_THRESHOLD = 0.20
```
**Use when:** You don't want to miss any accidents
**Trade-off:** More false positives

---

## 🧪 Testing Your Thresholds

### 1. Test with Known Accident Videos
```bash
# Place test videos in ai_server/samples/
# Run AI server and check if accidents are detected
```

### 2. Test with Non-Accident Scenes
```bash
# Point camera at normal scenes (your photo, desk, etc.)
# Should NOT trigger accident alerts
```

### 3. Monitor Database
```bash
# Check how many incidents are being logged
sqlite3 server/road_raksha.db "SELECT COUNT(*) FROM incidents WHERE type='Accident';"
```

---

## 📈 Performance vs Accuracy

| Threshold | False Positives | False Negatives | Best For |
|-----------|----------------|-----------------|----------|
| 0.30 | High | Low | Testing, Development |
| 0.40 | Medium | Medium | General Use |
| **0.50** | **Low** | **Medium** | **Production (Current)** |
| 0.60 | Very Low | High | Critical Systems |
| 0.70 | Minimal | Very High | High-Stakes Only |

---

## 🎯 Current Configuration

**File:** `ai_server/main.py`

**Line ~212:**
```python
results_acc = model_accident(frame, verbose=False, conf=0.50, device='cpu', imgsz=320)
```

**Line ~206:**
```python
ALERT_THRESHOLD = 0.50  # Higher threshold to reduce false positives
VISUAL_THRESHOLD = 0.30  # Show only higher confidence detections
```

---

## 🔍 How to Check Current Behavior

### 1. Watch the Video Feed
- Green boxes = Objects (people, vehicles)
- Red boxes = Accidents
- If you see red boxes on your photo, thresholds are too low

### 2. Check Console Output
```bash
# Look for these messages in AI server logs
🚨 ALARM! Incident XXX -> Database
```

### 3. Check Database
```bash
cd server
sqlite3 road_raksha.db "SELECT * FROM incidents ORDER BY timestamp DESC LIMIT 10;"
```

---

## ✅ Quick Fix Steps

1. **Stop the AI server:**
   ```bash
   ./rr-stop
   ```

2. **Edit thresholds** in `ai_server/main.py` (already done)

3. **Restart services:**
   ```bash
   ./rr-start
   ```

4. **Test with your photo** - should NOT detect accidents now

5. **Test with real accident video** - should still detect

---

## 🎓 Understanding Confidence Scores

### What is Confidence?
- **0.0 - 0.3:** Very uncertain, likely false positive
- **0.3 - 0.5:** Moderate confidence, needs verification
- **0.5 - 0.7:** Good confidence, likely correct
- **0.7 - 1.0:** High confidence, very likely correct

### Current Settings:
- **Model:** Only considers detections ≥ 50% confidence
- **Alerts:** Only sends to database if ≥ 50% confidence
- **Visual:** Shows detections ≥ 30% confidence (for monitoring)

---

## 🚨 Restart Required

After changing thresholds, you must restart the AI server:

```bash
./rr-stop
./rr-start
```

Then select "y" when prompted to start the AI server.

---

*Threshold Tuning Guide - January 26, 2026*
