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

# POINT TO THE NEWLY TRAINED MODEL
MODEL_PATH = "road_raksha_finetune/tune_v2i/weights/best.pt" 
TEST_DIR = "../test_samples"

try:
    print(f"Loading Fine-Tuned Model from {MODEL_PATH}...")
    model = YOLO(MODEL_PATH)
    
    # Get all images
    images = glob.glob(os.path.join(TEST_DIR, "*.jpg")) + glob.glob(os.path.join(TEST_DIR, "*.jpeg"))
    print(f"\n--- Evaluation (Fine-Tuned) on Dataset V2i ---")
    print(f"Target: Recall (Accident Detection)")
    print(f"Found {len(images)} images.")
    # Use same threshold for fair comparison
    print(f"Using Confidence Threshold: 0.10\n")

    detected = 0
    missed = 0

    for i, img_path in enumerate(images):
        results = model(img_path, verbose=False, conf=0.10)
        
        has_accident = False
        for r in results:
            if len(r.boxes) > 0:
                has_accident = True
        
        fname = os.path.basename(img_path)
        if has_accident:
            detected += 1
        else:
            missed += 1
            # print(f"❌ {fname}: Missed")

    total = detected + missed
    if total > 0:
        accuracy = (detected / total) * 100
        print(f"\n--- Results (Fine-Tuned) ---")
        print(f"Total Images: {total}")
        print(f"Detected: {detected}")
        print(f"Missed: {missed}")
        print(f"Recall: {accuracy:.1f}%")
        
        # Comparison logic
        old_recall = 32.1
        diff = accuracy - old_recall
        if diff > 0:
            print(f"Outcome: IMPACT POSITIVE (+{diff:.1f}%)")
        else:
            print(f"Outcome: IMPACT NEGATIVE ({diff:.1f}%)")
            
    else:
        print("No images found to test.")

except Exception as e:
    print(f"Critical Error: {e}")
