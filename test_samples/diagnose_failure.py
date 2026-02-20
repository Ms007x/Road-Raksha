import cv2
from ultralytics import YOLO
import torch

# Monkeypatch
_old_load = torch.load
def _new_load(*args, **kwargs):
    if 'weights_only' not in kwargs: kwargs['weights_only'] = False
    return _old_load(*args, **kwargs)
torch.load = _new_load

ACCIDENT_MODEL = "../MOdel/best.pt"
STANDARD_MODEL = "yolov8n.pt" # Standard model
IMG_PATH = "/Users/madhavsamalla/.gemini/antigravity/brain/dc95e0dd-6ae1-4399-b12e-764b2721b943/uploaded_media_1769415561002.png"

def diagnose():
    print("🔍 DIAGNOSTIC REPORT\n")
    
    # 1. Check Accident Model Classes
    print(f"1️⃣  Checking Accident Model ({ACCIDENT_MODEL})...")
    try:
        model_acc = YOLO(ACCIDENT_MODEL)
        print(f"   Classes: {model_acc.names}")
        
        # Test original
        res = model_acc(IMG_PATH, verbose=False, conf=0.10)
        print(f"   Original Detections: {len(res[0].boxes)}")
        
        # Test resized (640x640)
        img = cv2.imread(IMG_PATH)
        img_resized = cv2.resize(img, (640, 640))
        res_resized = model_acc(img_resized, verbose=False, conf=0.10)
        print(f"   Resized (640x640) Detections: {len(res_resized[0].boxes)}")
        
    except Exception as e:
        print(f"   Error: {e}")

    # 2. Check Standard Model (Object Detection)
    print(f"\n2️⃣  Checking Standard Model (yolov8n.pt)...")
    try:
        model_std = YOLO(STANDARD_MODEL)
        # Check for Car (class 2) or Truck (class 7)
        res_std = model_std(IMG_PATH, verbose=False, conf=0.25)
        
        vehicles = 0
        for box in res_std[0].boxes:
            cls = int(box.cls[0])
            name = model_std.names[cls]
            if name in ['car', 'truck', 'bus', 'motorcycle']:
                print(f"   Found: {name} ({float(box.conf[0]):.2%})")
                vehicles += 1
        
        if vehicles == 0:
            print("   ⚠️  Standard model did NOT detect any vehicles.")
            print("   (This suggests an image clarity/format issue)")
        else:
            print(f"   ✅ Standard model detected {vehicles} vehicles.")
            print("   (This confirms the image is readable, but the Accident Model missed the damage)")

    except Exception as e:
        print(f"   Error: {e}")

if __name__ == "__main__":
    diagnose()
