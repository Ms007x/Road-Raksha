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
# The folder we found with accident images
ACCIDENT_DIR = "../test_samples"

try:
    print(f"Loading model from {MODEL_PATH}...")
    model = YOLO(MODEL_PATH)
    
    # Get all images
    images = glob.glob(os.path.join(ACCIDENT_DIR, "*.jpg"))
    print(f"\n--- Evaluation on 'CCTVAccidentDetection' Repo Data ---")
    print(f"Target Concept: ACCIDENT (Positive Class)")
    print(f"Found {len(images)} sample images.")
    print(f"Using Confidence Threshold: 0.10 (High Sensitivity)\n")

    detected = 0
    missed = 0

    for i, img_path in enumerate(images):
        # Run inference
        results = model(img_path, verbose=False, conf=0.10)
        
        has_accident = False
        max_conf = 0.0
        
        for r in results:
            for box in r.boxes:
                # We only care if it detected 'Accident' (class 0)
                # But our model only HAS class 0, so any box is an accident.
                conf = float(box.conf[0])
                if conf > max_conf:
                    max_conf = conf
                has_accident = True
        
        fname = os.path.basename(img_path)
        if has_accident:
            detected += 1
            # print(f"✅ {fname}: Detected ({max_conf:.2f})")
        else:
            missed += 1
            print(f"❌ {fname}: Missed")

    # --- Negative Samples (Non-Accidents) ---
    NO_ACCIDENT_DIR = "../temp_acc_data/assets"
    neg_images = glob.glob(os.path.join(NO_ACCIDENT_DIR, "noacc*.jpg"))
    
    print(f"\nTarget Concept: NON-ACCIDENT (Negative Class)")
    print(f"Found {len(neg_images)} sample images.")
    
    false_positives = 0
    true_negatives = 0

    for i, img_path in enumerate(neg_images):
        results = model(img_path, verbose=False, conf=0.10) # Same high sensitivity
        
        has_accident = False
        for r in results:
            if len(r.boxes) > 0:
                has_accident = True
        
        fname = os.path.basename(img_path)
        if has_accident:
            false_positives += 1
            print(f"❌ {fname}: False Alarm (Detected Accident)")
        else:
            true_negatives += 1
            # print(f"✅ {fname}: Correctly Ignored")

    
    # Calculate stats for Positive Class
    total = detected + missed
    accuracy = 0
    if total > 0:
        accuracy = (detected / total) * 100

    print(f"\n--- Final Stats ---")
    print(f"Positive Samples (Accidents): {detected}/{total} Detected ({accuracy:.1f}% Recall)")
    if len(neg_images) > 0:
        fp_rate = (false_positives / len(neg_images)) * 100
        print(f"Negative Samples (Normal):    {true_negatives}/{len(neg_images)} Correct ({100-fp_rate:.1f}% Specificity)")
    else:
        print("No negative samples found.")


except Exception as e:
    print(f"Critical Error: {e}")
