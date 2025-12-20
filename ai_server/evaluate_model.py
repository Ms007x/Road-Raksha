from ultralytics import YOLO
import cv2
import glob
import os
import torch

# Monkeypatch torch.load
_old_load = torch.load
def _new_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _old_load(*args, **kwargs)
torch.load = _new_load

MODEL_PATH = "../MOdel/best.pt"
IMAGE_DIR = "../test_samples"

print(f"Loading model from {MODEL_PATH}...")
try:
    model = YOLO(MODEL_PATH)
except Exception as e:
    print(f"CRITICAL ERROR: Failed to load model: {e}")
    exit(1)

# Get all images from test_samples
all_images = glob.glob(os.path.join(IMAGE_DIR, "*.jpg")) + \
             glob.glob(os.path.join(IMAGE_DIR, "*.JPG"))

print(f"Testing on {len(all_images)} recovered random images with conf=0.15...\n")

detections_count = 0

for img_path in all_images:
    filename = os.path.basename(img_path)
    # Run with production confidence threshold
    res = model(img_path, verbose=False, conf=0.15)[0]
    
    boxes = res.boxes
    if len(boxes) > 0:
        detections_count += 1
        print(f"✅ {filename}: DETECTED")
        for box in boxes:
            cls = int(box.cls[0])
            conf = float(box.conf[0])
            label = res.names[cls]
            print(f"   - {label}: {conf:.2f}")
    else:
        print(f"❌ {filename}: No detection")

print(f"\nSummary: {detections_count}/{len(all_images)} images had detections.")
