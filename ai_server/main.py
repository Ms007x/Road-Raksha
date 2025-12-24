from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import torch

# Monkeypatch torch.load to support PyTorch 2.6+ with older Ultralytics
# reducing security but allowing the model to load locally
_old_load = torch.load
def _new_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _old_load(*args, **kwargs)
torch.load = _new_load

from ultralytics import YOLO
import cv2
import numpy as np
import threading
import time

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the Accident Model
ACCIDENT_MODEL_PATH = "../MOdel/best.pt"
try:
    print(f"Loading accident model from {ACCIDENT_MODEL_PATH}...")
    model_accident = YOLO(ACCIDENT_MODEL_PATH)
    print("Accident Model loaded successfully!")
except Exception as e:
    print(f"Error loading accident model: {e}")
    model_accident = None

# Load the Standard Model (for People, Bikes, Animals)
OBJECTS_MODEL_PATH = "yolov8n.pt" # Helper model will auto-download
try:
    print(f"Loading objects model from {OBJECTS_MODEL_PATH}...")
    model_objects = YOLO(OBJECTS_MODEL_PATH)
    print("Objects Model loaded successfully!")
except Exception as e:
    print(f"Error loading objects model: {e}")
    model_objects = None

# Tracked classes for standard model (COCO indices)
RELEVANT_CLASSES = {0, 1, 2, 3, 5, 7, 15, 16, 17, 18, 19, 20, 21, 22, 23}

# Global variables for camera
camera = None
lock = threading.Lock()

def get_camera():
    global camera
    if camera is None:
        print("Opening camera (ID 0)...")
        # Try finding a camera
        camera = cv2.VideoCapture(0)
        if not camera.isOpened():
            print("Could not open camera 0.")
            camera = None
    return camera

from deep_sort_realtime.deepsort_tracker import DeepSort

# Initialize DeepSORT Tracker
# max_age: keep track of objects for 30 frames if they disappear
# n_init=5: Object must be detected in 5 consecutive frames to be confirmed (Reduces False Positives)
tracker = DeepSort(max_age=30, n_init=5)

# Incident Logging
from datetime import datetime
import uuid

incident_history = []
active_accident_ids = set()

@app.get("/status")
def get_status():
    # Clean up stale active IDs if tracks are gone (simplified)
    return {
        "active_count": len(active_accident_ids),
        "history": sorted(incident_history, key=lambda x: x['timestamp'], reverse=True)[:10] # send last 10
    }

def generate_frames():
    cam = get_camera()
    if not cam:
        # Yield a blank error frame if no camera
        blank = np.zeros((360, 640, 3), np.uint8)
        cv2.putText(blank, "No Camera Found", (50, 180), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        _, buffer = cv2.imencode('.jpg', blank)
        frame = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        return

    while True:
        success, frame = cam.read()
        if not success:
            print("Failed to read frame")
            time.sleep(1)
            continue
        
        # Resize for performance and consistency
        frame = cv2.resize(frame, (480, 270))

        detections = []
        ALERT_THRESHOLD = 0.40 # Define globally for the frame logic

        # --- 1. Detect Accidents ---
        if model_accident:
            # High Sensitivity (0.10) to catch everything
            results_acc = model_accident(frame, verbose=False, conf=0.10)
            for result in results_acc:
                for box in result.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    w = x2 - x1
                    h = y2 - y1
                    conf = float(box.conf[0])
                    # Force label to "Accident" for this model
                    detections.append(([x1, y1, w, h], conf, "Accident"))

        # --- 2. Detect Objects (People, Bikes, Animals) ---
        if model_objects:
            results_obj = model_objects(frame, verbose=False, conf=0.25)
            for result in results_obj:
                for box in result.boxes:
                    cls = int(box.cls[0])
                    if cls in RELEVANT_CLASSES:
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        w = x2 - x1
                        h = y2 - y1
                        conf = float(box.conf[0])
                        label = result.names[cls]
                        detections.append(([x1, y1, w, h], conf, label.capitalize()))
        
        # --- 3. Update Tracker (DeepSORT) ---
        tracks = tracker.update_tracks(detections, frame=frame)
        
        # Reset active set for this frame (to track what's currently on screen)
        current_frame_accident_ids = set()

        # --- 4. Draw Tracks ---
        for track in tracks:
            if not track.is_confirmed():
                continue
            
            track_id = track.track_id
            ltrb = track.to_ltrb()
            x1, y1, x2, y2 = int(ltrb[0]), int(ltrb[1]), int(ltrb[2]), int(ltrb[3])
            
            label = track.get_det_class() or "Object"
            
            # Incident Logic
            if label == "Accident":
                current_frame_accident_ids.add(track_id)
                # If this is a new confirmed accident (not in our history yet, roughly)
                # We check if we logged this track_id recently?
                # For simplicity, we check if it's already in the global active set or history
                # But DeepSORT IDs persist. So we just check if it's in our known list.
                exists = any(inc['id'] == str(track_id) for inc in incident_history)
                
                # Retrieve the confidence from the track if available
                track_conf = getattr(track, 'det_conf', 0.0)
                if track_conf is None: track_conf = 0.0

                if not exists:
                    # Log locally regardless (for debug)
                    timestamp = datetime.now().strftime("%H:%M:%S")
                    new_inc = {
                        "id": str(track_id),
                        "type": "Accident",
                        "timestamp": timestamp,
                        "location": "Main Cam 01",
                        "status": "Pending"
                    }
                    incident_history.append(new_inc)
                    
                    # ALERT LIMIT: Only Alert if Confidence > 40%
                    # This filters out weak detections (0.1 - 0.39) from triggering the ambulance
                    ALERT_THRESHOLD = 0.40
                    
                    if track_conf >= ALERT_THRESHOLD:
                        # PERSISTENCE: Send to Backend
                        try:
                            import requests
                            payload = {
                                "type": "Accident",
                                "severity": "Critical",
                                "location": "Main Cam 01"
                            }
                            # Run in thread to not block video stream
                            threading.Thread(target=requests.post, args=("http://localhost:3000/api/incidents",), kwargs={"json": payload}).start()
                            print(f"🚨 ALARM! Incident {track_id} (Conf: {track_conf:.2f}) -> Database & Ambulance")
                        except Exception as e:
                            print(f"Failed to save incident: {e}")
                    else:
                        print(f"⚠️ Incident {track_id} detected but ignored (Conf {track_conf:.2f} < {ALERT_THRESHOLD})")
            
            # VISUAL FILTER:
            # If it's an Accident but confidence is low, SKIP DRAWING
            # Use the same ALERT_THRESHOLD for visual filtering
            conf_val = getattr(track, 'det_conf', None)
            if label == 'Accident' and (conf_val is None or conf_val < ALERT_THRESHOLD):
                continue # Don't draw weak accidents

            # Color coding
            if label == "Accident":
                color = (0, 0, 255) # Red
            elif label in ["Person", "Children"]:
                color = (255, 0, 0) # Blue
            else:
                color = (0, 255, 0) # Green (Vehicles/Animals)

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            text = f"ID:{track_id} {label}"
            
            # Try to get confidence from the track
            if conf_val is not None and isinstance(conf_val, float):
                text += f" {int(conf_val*100)}%"

            cv2.putText(frame, text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        # Update global active set
        global active_accident_ids
        active_accident_ids = current_frame_accident_ids

        # Encode to JPEG
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
            
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.get("/")
def root():
    return {"status": "AI Server Running", "mode": "MJPEG Stream"}

@app.get("/video_feed")
def video_feed():
    # Return the Multipart response
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

# Cleanup on shutdown (optional, generally OS handles this)
@app.on_event("shutdown")
def shutdown_event():
    global camera
    if camera and camera.isOpened():
        camera.release()
