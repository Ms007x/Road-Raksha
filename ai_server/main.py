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
tracker = DeepSort(max_age=30)

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
        
        # Resize to smaller resolution for speed (480x270 is 1/2 of 960x540)
        # 640x360 -> 480x270 is ~45% less pixels
        frame = cv2.resize(frame, (480, 270))

        # Skip frames to improve FPS
        # Only create detections every 3 frames
        # (For a smoother view, we might just display the raw frame in between, 
        # but DeepSORT needs detections to update. Making it run every frame is heavy).
        # Optimization: We will run inference every frame but on the small image.
        
        detections = []

        # --- 1. Detect Accidents ---
        if model_accident:
            results_acc = model_accident(frame, verbose=False, conf=0.15)
            for result in results_acc:
                for box in result.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    w = x2 - x1
                    h = y2 - y1
                    conf = float(box.conf[0])
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

        # --- 4. Draw Tracks ---
        for track in tracks:
            if not track.is_confirmed():
                continue
            
            track_id = track.track_id
            ltrb = track.to_ltrb()
            x1, y1, x2, y2 = int(ltrb[0]), int(ltrb[1]), int(ltrb[2]), int(ltrb[3])
            
            label = track.get_det_class() or "Object"
            
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
            conf_val = getattr(track, 'det_conf', None)
            if conf_val is not None and isinstance(conf_val, float):
                text += f" {int(conf_val*100)}%"

            cv2.putText(frame, text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

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
