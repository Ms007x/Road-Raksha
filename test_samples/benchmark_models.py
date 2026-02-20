import cv2
import os
import sys
import glob
from ultralytics import YOLO
import torch

# Monkeypatch torch.load
_old_load = torch.load
def _new_load(*args, **kwargs):
    if 'weights_only' not in kwargs: kwargs['weights_only'] = False
    return _old_load(*args, **kwargs)
torch.load = _new_load

CURRENT_MODEL_PATH = "../MOdel/best.pt"
NEW_MODEL_PATH = "../MOdel/saferoad_best.pt"
USER_TEST_IMAGE = "/Users/madhavsamalla/.gemini/antigravity/brain/dc95e0dd-6ae1-4399-b12e-764b2721b943/uploaded_media_1769415561002.png"
SAMPLE_DIR = "."

def benchmark_model(model_path, model_name):
    print(f"\n🚀 Benchmarking: {model_name}")
    print(f"   Path: {model_path}")
    
    try:
        model = YOLO(model_path)
    except Exception as e:
        print(f"   ❌ Failed to load model: {e}")
        return None

    stats = {
        "user_image_detected": False,
        "user_image_conf": 0.0,
        "total_samples": 0,
        "samples_detected": 0,
        "total_detections": 0,
        "avg_confidence": 0.0
    }

    # 1. Test User Image
    if os.path.exists(USER_TEST_IMAGE):
        results = model(USER_TEST_IMAGE, verbose=False, conf=0.10)
        max_conf = 0.0
        for r in results:
            for box in r.boxes:
                conf = float(box.conf[0])
                if conf > max_conf: max_conf = conf
        
        stats["user_image_conf"] = max_conf
        if max_conf > 0.40: # Production threshold
            stats["user_image_detected"] = True
            print(f"   ✅ USER IMAGE DETECTED! (Conf: {max_conf:.2%})")
        else:
            print(f"   ❌ User Image Missed (Max Conf: {max_conf:.2%})")
    else:
        print("   ⚠️ User image not found for testing")

    # 2. Test Samples
    images = glob.glob(os.path.join(SAMPLE_DIR, "*.jpg"))
    stats["total_samples"] = len(images)
    detected_count = 0
    total_conf = 0.0
    detection_count = 0

    print(f"   Testing {len(images)} sample images...")
    
    for img_path in images:
        results = model(img_path, verbose=False, conf=0.40) # Production threshold
        has_detection = False
        
        for r in results:
            if len(r.boxes) > 0:
                has_detection = True
                for box in r.boxes:
                    total_conf += float(box.conf[0])
                    detection_count += 1
        
        if has_detection:
            detected_count += 1

    stats["samples_detected"] = detected_count
    stats["total_detections"] = detection_count
    if detection_count > 0:
        stats["avg_confidence"] = total_conf / detection_count
    
    print(f"   📊 Accuracy on Samples: {detected_count}/{len(images)} ({detected_count/len(images):.1%})")
    print(f"   🎯 Average Confidence: {stats['avg_confidence']:.1%}")
    
    return stats

def main():
    print("="*60)
    print("🏎️  ROAD RAKSHA - MODEL BENCHMARK")
    print("="*60)

    # Benchmark Current Model
    current_stats = benchmark_model(CURRENT_MODEL_PATH, "CURRENT MODEL")
    
    # Benchmark New Model
    if os.path.exists(NEW_MODEL_PATH):
        new_stats = benchmark_model(NEW_MODEL_PATH, "NEW MODEL (Candidate)")
    else:
        print(f"\n❌ New model not found at {NEW_MODEL_PATH}")
        return

    # Comparison
    print("\n" + "="*60)
    print("🏆 COMPARISON RESULTS")
    print("="*60)
    
    print(f"{'Metric':<25} | {'CURRENT':<15} | {'NEW':<15}")
    print("-" * 61)
    
    # User Image Result
    u_curr = "✅ YES" if current_stats['user_image_detected'] else "❌ NO"
    u_new = "✅ YES" if new_stats['user_image_detected'] else "❌ NO"
    print(f"{'User Image Detected':<25} | {u_curr:<15} | {u_new:<15}")
    
    # User Image Confidence
    uc_curr = f"{current_stats['user_image_conf']:.1%}"
    uc_new = f"{new_stats['user_image_conf']:.1%}"
    print(f"{'User Image Conf':<25} | {uc_curr:<15} | {uc_new:<15}")
    
    # Sample Accuracy
    acc_curr = f"{current_stats['samples_detected']}/{current_stats['total_samples']}"
    acc_new = f"{new_stats['samples_detected']}/{new_stats['total_samples']}"
    print(f"{'Sample Accuracy':<25} | {acc_curr:<15} | {acc_new:<15}")
    
    # Avg Confidence
    avg_curr = f"{current_stats['avg_confidence']:.1%}"
    avg_new = f"{new_stats['avg_confidence']:.1%}"
    print(f"{'Avg Confidence':<25} | {avg_curr:<15} | {avg_new:<15}")
    
    print("-" * 61)
    
    # Recommendation
    score_curr = (1 if current_stats['user_image_detected'] else 0) + (current_stats['samples_detected'] / current_stats['total_samples'])
    score_new = (1 if new_stats['user_image_detected'] else 0) + (new_stats['samples_detected'] / new_stats['total_samples'])
    
    print("\n📣 RECOMMENDATION:")
    if score_new > score_curr:
        print("✅ SWITCH TO NEW MODEL - It performs better!")
    elif score_new < score_curr:
        print("⚠️ KEEP CURRENT MODEL - New model performs worse.")
    else:
        if new_stats['avg_confidence'] > current_stats['avg_confidence']:
             print("✅ SWITCH TO NEW MODEL - Higher confidence.")
        else:
             print("⚠️ KEEP CURRENT MODEL - Similar performance.")

if __name__ == "__main__":
    main()
