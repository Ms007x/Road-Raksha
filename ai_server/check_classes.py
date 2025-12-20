from ultralytics import YOLO
import torch

# Monkeypatch torch.load
_old_load = torch.load
def _new_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _old_load(*args, **kwargs)
torch.load = _new_load

MODEL_PATH = "../MOdel/best.pt"

try:
    print(f"Loading model from {MODEL_PATH}...")
    model = YOLO(MODEL_PATH)
    print("\n--- Model Classes ---")
    print(model.names)
    print("---------------------\n")
except Exception as e:
    print(f"Error: {e}")
