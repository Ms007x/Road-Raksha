import sys
import cv2
import torch
from ultralytics import YOLO

# Monkeypatch torch.load
_old_load = torch.load
def _new_load(*args, **kwargs):
    if 'weights_only' not in kwargs: kwargs['weights_only'] = False
    return _old_load(*args, **kwargs)
torch.load = _new_load

MODEL_PATH = "../MOdel/best.pt"
IMG_PATH = "/Users/madhavsamalla/.gemini/antigravity/brain/dc95e0dd-6ae1-4399-b12e-764b2721b943/uploaded_media_1769415561002.png"

def test_image():
    print(f"Loading model from {MODEL_PATH}...")
    model = YOLO(MODEL_PATH)
    
    print(f"Testing image: {IMG_PATH}")
    img = cv2.imread(IMG_PATH)
    if img is None:
        print("❌ Could not read image!")
        return

    results = model(img, verbose=False, conf=0.10)
    
    found_accident = False
    print("\n--- Results ---")
    for r in results:
        for box in r.boxes:
            conf = float(box.conf[0])
            print(f"🚨 ACCIDENT DETECTED! Confidence: {conf:.2%}")
            found_accident = True
            
            # Draw box
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            cv2.rectangle(img, (int(x1), int(y1)), (int(x2), int(y2)), (0,0,255), 2)
            cv2.putText(img, f"Accident {conf:.0%}", (int(x1), int(y1)-10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,0,255), 2)

    if not found_accident:
        print("✅ No accident detected (under 40% confidence).")
    else:
        # Save annotated
        out_path = "user_test_result.jpg"
        cv2.imwrite(out_path, img)
        print(f"Saved annotated image to {out_path}")

if __name__ == "__main__":
    test_image()
