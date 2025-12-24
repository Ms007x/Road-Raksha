from ultralytics import YOLO
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
# New Dataset Test Path
TEST_DIR = "../accident.v2i.yolov8/test/images"

try:
    print(f"Loading model from {MODEL_PATH}...")
    model = YOLO(MODEL_PATH)
    
    # Get all images
    images = glob.glob(os.path.join(TEST_DIR, "*.jpg")) + glob.glob(os.path.join(TEST_DIR, "*.jpeg"))
    print(f"\n--- Evaluation on 'accident.v2i.yolov8' Dataset (Test Set) ---")
    print(f"Target: Recall (Accident Detection)")
    print(f"Found {len(images)} images.")
    print(f"Using Confidence Threshold: 0.10\n")

    detected = 0
    missed = 0

    for i, img_path in enumerate(images):
        # Run inference
        results = model(img_path, verbose=False, conf=0.10)
        
        has_accident = False
        for r in results:
            if len(r.boxes) > 0:
                has_accident = True
        
        fname = os.path.basename(img_path)
        if has_accident:
            detected += 1
            # print(f"✅ {fname}: Detected")
        else:
            missed += 1
            # Check max confidence of ANY box to see if it was close
            max_conf = 0
            for r in results:
                if len(r.boxes) > 0:
                    max_conf = max(max_conf, float(r.boxes.conf.max()))
            print(f"❌ {fname}: Missed (Max Conf: {max_conf:.2f})")

    total = detected + missed
    if total > 0:
        accuracy = (detected / total) * 100
        print(f"\n--- Results ---")
        print(f"Total Images: {total}")
        print(f"Detected: {detected}")
        print(f"Missed: {missed}")
        print(f"Recall: {accuracy:.1f}%")
    else:
        print("No images found to test.")

except Exception as e:
    print(f"Critical Error: {e}")
