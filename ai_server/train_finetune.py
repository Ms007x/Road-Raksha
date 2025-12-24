from ultralytics import YOLO
import torch

# Monkeypatch torch.load to handle old checkpoints if needed
_old_load = torch.load
def _new_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _old_load(*args, **kwargs)
torch.load = _new_load

# Config
MODEL_PATH = "../MOdel/best.pt"
DATA_YAML = "/Users/ms/Desktop/Road-Raksha/accident.v2i.yolov8/data.yaml"
EPOCHS = 50 
IMG_SIZE = 640

def train():
    print(f"Loading '{MODEL_PATH}' for fine-tuning...")
    # Load the pre-trained model
    model = YOLO(MODEL_PATH)
    
    print(f"Starting training on '{DATA_YAML}'...")
    # Train
    results = model.train(
        data=DATA_YAML,
        epochs=EPOCHS,
        imgsz=IMG_SIZE,
        batch=16,
        project="road_raksha_finetune",
        name="tune_v2i",
        exist_ok=True,
        verbose=True
    )
    
    print("Training Complete!")
    print(f"Best model saved to: {results.save_dir}/weights/best.pt")

if __name__ == "__main__":
    train()
