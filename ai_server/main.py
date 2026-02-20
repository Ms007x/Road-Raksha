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
import argparse
import geocoder
import threading
import time
import os
import glob
import requests
from datetime import datetime
import uuid
from pydantic import BaseModel
from deep_sort_realtime.deepsort_tracker import DeepSort

app = FastAPI()

# Global Location Detection
CURRENT_LOCATION = None
try:
    print("🌍 Detecting AI Server location...")
    g = geocoder.ip('me')
    if g.latlng:
        CURRENT_LOCATION = {
            'lat': g.latlng[0],
            'lng': g.latlng[1],
            'city': g.city or "Unknown Location"
        }
        print(f"✅ AI Location Set: {CURRENT_LOCATION['city']} ({CURRENT_LOCATION['lat']}, {CURRENT_LOCATION['lng']})")
    else:
        print("⚠️ Could not detect location via IP. Fallback to None.")
except Exception as e:
    print(f"⚠️ Geolocation failed: {e}")

# Global State
class SystemState:
    simulation_mode = False

state = SystemState()

class ModeUpdateRequest(BaseModel):
    simulation: bool

class LocationUpdateRequest(BaseModel):
    lat: float
    lng: float
    city: str = "Detected City"

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Models
ACCIDENT_MODEL_PATH = "../MOdel/best.mlpackage"
OBJECTS_MODEL_PATH = "yolov8n.mlpackage"

print(f"Loading accident model from {ACCIDENT_MODEL_PATH}...")
try:
    model_accident = YOLO(ACCIDENT_MODEL_PATH, task='detect')
    print("Accident Model loaded successfully!")
except Exception as e:
    print(f"Error loading accident model: {e}")
    model_accident = None

print(f"Loading objects model from {OBJECTS_MODEL_PATH}...")
try:
    model_objects = YOLO(OBJECTS_MODEL_PATH)
    print("Objects Model loaded successfully!")
except Exception as e:
    print(f"Error loading objects model: {e}")
    model_objects = None

RELEVANT_CLASSES = {0, 1, 2, 3, 5, 7, 15, 16, 17, 18, 19, 20, 21, 22, 23}
ALERT_THRESHOLD = 0.85
VISUAL_THRESHOLD = 0.85
PROCESS_EVERY_N_FRAMES = 2
JPEG_QUALITY = 75

class FrameProcessor:
    def __init__(self):
        self.camera = None
        self.tracker = DeepSort(max_age=30, n_init=5)
        self.latest_frame = None
        self.incident_history = []
        self.active_accident_ids = set()
        self.lock = threading.Lock()
        self.stopped = False
        self.frame_count = 0
        self.last_detections = []
        self.sample_images = self._load_samples()
        self.sim_idx = 0
        
    def _load_samples(self):
        samples = []
        samples_dir = "../test_samples"
        if os.path.exists(samples_dir):
            files = sorted(glob.glob(os.path.join(samples_dir, "*.jpg")))
            for f in files:
                img = cv2.imread(f)
                if img is not None:
                    img = cv2.resize(img, (480, 270))
                    samples.append(img)
        return samples

    def get_camera(self):
        if self.camera is None or not self.camera.isOpened():
            print("🎥 Opening camera (ID 0)...")
            self.camera = cv2.VideoCapture(0)
            if self.camera.isOpened():
                print("✅ Camera opened successfully!")
                ret, test_frame = self.camera.read()
                if not ret:
                    print("⚠️ Camera opened but test read failed!")
            else:
                print("❌ Could not open camera 0.")
                self.camera = None
        return self.camera

    def start(self):
        threading.Thread(target=self.run, daemon=True).start()

    def run(self):
        print("🚀 Background Processor Started")
        while not self.stopped:
            frame = None
            is_sim = state.simulation_mode

            # 1. Acquire Frame
            if is_sim:
                if self.sample_images:
                    frame = self.sample_images[self.sim_idx].copy()
                    self.sim_idx = (self.sim_idx + 1) % len(self.sample_images)
                else:
                    frame = np.zeros((270, 480, 3), np.uint8)
                    cv2.putText(frame, "No Samples Found", (50, 135), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            else:
                cam = self.get_camera()
                if cam:
                    success, live_frame = cam.read()
                    if success and live_frame is not None:
                        frame = cv2.resize(live_frame, (480, 270))
                    else:
                        print("❌ Camera read failed")
                        self.camera = None
                
                if frame is None:
                    if self.sample_images:
                        frame = self.sample_images[self.sim_idx].copy()
                        self.sim_idx = (self.sim_idx + 1) % len(self.sample_images)
                        cv2.putText(frame, "CAM FAIL - FALLBACK", (10, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
                    else:
                        frame = np.zeros((270, 480, 3), np.uint8)
                        cv2.putText(frame, "Camera Offline", (100, 135), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

            # 2. Process AI
            try:
                self.frame_count += 1
                if self.frame_count % PROCESS_EVERY_N_FRAMES == 0:
                    detections = []
                    
                    if model_accident:
                        results_acc = model_accident(frame, verbose=False, conf=0.85, device='cpu', imgsz=640)
                        for result in results_acc:
                            for box in result.boxes:
                                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                                conf = float(box.conf[0])
                                detections.append(([x1, y1, x2-x1, y2-y1], conf, "Accident"))
                                if conf >= 0.85:
                                    print(f"🚨 Accident Detected! Confidence: {conf:.2%}")

                    if model_objects:
                        results_obj = model_objects(frame, verbose=False, conf=0.30, device='cpu', imgsz=640)
                        for result in results_obj:
                            for box in result.boxes:
                                cls = int(box.cls[0])
                                if cls in RELEVANT_CLASSES:
                                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                                    conf = float(box.conf[0])
                                    label = result.names[cls]
                                    detections.append(([x1, y1, x2-x1, y2-y1], conf, label.capitalize()))
                    
                    self.last_detections = detections
                else:
                    detections = self.last_detections

                tracks = self.tracker.update_tracks(detections, frame=frame)
                current_ids = set()

                for track in tracks:
                    if not track.is_confirmed(): continue
                    
                    track_id = track.track_id
                    ltrb = track.to_ltrb()
                    x1, y1, x2, y2 = map(int, ltrb)
                    label = track.get_det_class() or "Object"
                    track_conf = getattr(track, 'det_conf', 0.0) or 0.0

                    if label == "Accident":
                        current_ids.add(track_id)
                        if not any(inc['id'] == str(track_id) for inc in self.incident_history):
                            timestamp = datetime.now().strftime("%H:%M:%S")
                            cam_name = "Sim Cam 01" if (is_sim) else "Main Cam 01"
                            new_inc = {"id": str(track_id), "type": "Accident", "timestamp": timestamp, "location": cam_name, "status": "Pending"}
                            self.incident_history.append(new_inc)
                            
                            if track_conf >= ALERT_THRESHOLD:
                                self._report_incident(track_id, track_conf, cam_name)

                    if label == 'Accident' and track_conf < VISUAL_THRESHOLD: continue

                    color = (0, 0, 255) if label == "Accident" else ((255, 0, 0) if label in ["Person", "Children"] else (0, 255, 0))
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    conf_str = f"{track_conf:.0%}" if track_conf else "??"
                    cv2.putText(frame, f"ID:{track_id} {label} {conf_str}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

                self.active_accident_ids = current_ids

            except Exception as e:
                print(f"Error in processor: {e}")

            # Overlay info
            mode_text = "SIMULATION MODE" if is_sim else "LIVE CAMERA"
            mode_color = (0, 255, 255) if is_sim else (0, 255, 0)
            cv2.putText(frame, mode_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, mode_color, 2)

            ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
            if ret:
                with self.lock:
                    self.latest_frame = buffer.tobytes()
            
            time.sleep(0.01) # Small sleep to prevent CPU hogging

    def _report_incident(self, track_id, conf, cam_name):
        # Base location from detected IP or manual set
        base_lat = CURRENT_LOCATION['lat'] if CURRENT_LOCATION else 17.3850
        base_lng = CURRENT_LOCATION['lng'] if CURRENT_LOCATION else 78.4867

        payload = {
            "type": "Accident", "severity": "Critical",
            "location": CURRENT_LOCATION['city'] if CURRENT_LOCATION else cam_name,
            "latitude": float(base_lat),
            "longitude": float(base_lng),
            "confidence": float(conf)
        }

        def _do_report(payload, track_id):
            try:
                resp = requests.post("http://localhost:3000/api/incidents", json=payload, timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
                    print(f"✅ Incident {track_id} SAVED → ID:{data.get('id')} Status:{data.get('status')} Dispatch:{data.get('dispatch','—')}")
                elif resp.status_code == 429:
                    print(f"⚠️ Incident {track_id} REJECTED — System busy (too many active incidents).")
                else:
                    print(f"❌ Incident {track_id} FAILED → HTTP {resp.status_code}: {resp.text[:200]}")
            except Exception as e:
                print(f"❌ Failed to contact backend: {e}")

        threading.Thread(target=_do_report, args=(payload, track_id), daemon=True).start()
        print(f"🚨 REPORTING Incident {track_id} → {payload['location']} ({base_lat:.4f}, {base_lng:.4f})")

processor = FrameProcessor()

@app.on_event("startup")
def startup_event():
    processor.start()

@app.on_event("shutdown")
def shutdown_event():
    processor.stopped = True
    if processor.camera:
        processor.camera.release()

@app.get("/status")
def get_status():
    return {
        "active_count": len(processor.active_accident_ids),
        "history": sorted(processor.incident_history, key=lambda x: x['timestamp'], reverse=True)[:10],
        "location": CURRENT_LOCATION
    }

@app.get("/mode")
def get_mode():
    return {"simulation": state.simulation_mode}

@app.post("/set_mode")
def set_mode(request: ModeUpdateRequest):
    state.simulation_mode = request.simulation
    return {"status": "Updated", "simulation": state.simulation_mode}

@app.post("/set_location")
def set_location(request: LocationUpdateRequest):
    global CURRENT_LOCATION
    CURRENT_LOCATION = {'lat': request.lat, 'lng': request.lng, 'city': request.city}
    return {"status": "Location Updated", "location": CURRENT_LOCATION}

def stream_generator():
    while True:
        if processor.latest_frame:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + processor.latest_frame + b'\r\n')
        time.sleep(0.03) # ~30 FPS

@app.get("/video_feed")
def video_feed():
    return StreamingResponse(stream_generator(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/")
def root():
    return {"status": "AI Server Running", "processor_active": not processor.stopped}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
