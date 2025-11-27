# Accident Detection Model - Training Documentation

## Overview
This directory contains the trained YOLOv8 model for accident detection in the Road-Raksha project. The model is designed to detect accidents from CCTV footage and traffic camera feeds.

## Model Architecture

### Base Model
- **Framework**: YOLOv8 (Ultralytics)
- **Variant**: YOLOv8n (Nano - optimized for speed and efficiency)
- **Pre-trained Weights**: `yolov8n.pt` (COCO pre-trained weights)

### Model Specifications
- **Total Layers**: 129
- **Parameters**: 3,011,238
- **Gradients**: 0 (inference mode)
- **GFLOPs**: 8.2

## Training Configuration

### Training Parameters
The model was trained using the following configuration:

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Base Model** | `yolov8n.pt` | YOLOv8 Nano pre-trained on COCO dataset |
| **Epochs** | 100 | Number of complete passes through the dataset |
| **Device** | CUDA (GPU) | Training accelerated using NVIDIA GPU |
| **AMP** | False | Automatic Mixed Precision disabled |
| **Data Config** | `data.yaml` | Dataset configuration file |

### Training Script
The model was trained using the script located at [`training.py`](file:///Users/ms/Desktop/Road-Raksha/MOdel/training.py):

```python
from ultralytics import YOLO

data_path = "./data.yaml"

# Initialize the model with pre-trained weights
model = YOLO("yolov8n.pt")

# Move model to GPU for faster training
model.to("cuda")

# Train the model
model.train(data=data_path, epochs=100, amp=False)

# Evaluate model performance on validation set
model.val()
```

## Dataset Configuration

The model was trained using a custom dataset specified in `data.yaml`. The configuration should include:
- Training images and annotations
- Validation images and annotations
- Number of classes (accident detection classes)
- Class names and labels

## Model Output

### Trained Model File
- **Filename**: `best.pt`
- **Size**: ~6.24 MB (6,241,646 bytes)
- **Description**: Best performing model weights saved during training

The `best.pt` file contains the model checkpoint with the highest performance metrics during training.

## Training Process

### Hardware Requirements
- **Device**: CUDA-compatible NVIDIA GPU
- **VRAM**: Recommended 4GB+ for YOLOv8n
- **Framework**: PyTorch with CUDA support

### Training Steps
1. **Initialization**: Load pre-trained YOLOv8n weights from COCO dataset
2. **GPU Transfer**: Move model to CUDA device for accelerated training
3. **Training Loop**: Train for 100 epochs on custom accident detection dataset
4. **Validation**: Automatic evaluation on validation set after training
5. **Model Saving**: Best model checkpoint saved as `best.pt`

## Model Performance

### Optimization Settings
- **Mixed Precision Training**: Disabled (`amp=False`)
  - Ensures numerical stability and consistency
  - Trades off some training speed for precision

### Model Benefits
- **Lightweight**: YOLOv8n is optimized for real-time inference
- **Efficient**: Only 3M parameters enable deployment on edge devices
- **Fast**: 8.2 GFLOPs suitable for real-time video processing

## Using the Trained Model

### Loading the Model
```python
from ultralytics import YOLO

# Load the trained model
model = YOLO('best.pt')

# Run inference on an image
results = model('path/to/image.jpg')

# Run inference on a video
results = model('path/to/video.mp4')
```

### Inference Parameters
```python
# Predict with custom confidence threshold
results = model.predict(
    source='image.jpg',
    conf=0.25,        # Confidence threshold
    iou=0.45,         # NMS IoU threshold
    device='cuda',    # Use GPU for inference
    save=True         # Save results to file
)
```

## Model Validation

The model includes an automatic validation step that evaluates:
- **Precision**: Accuracy of positive predictions
- **Recall**: Coverage of actual positive cases
- **mAP (mean Average Precision)**: Overall detection accuracy
- **F1 Score**: Harmonic mean of precision and recall

## Future Improvements

### Potential Enhancements
1. **Increase Training Epochs**: Train beyond 100 epochs for better convergence
2. **Data Augmentation**: Add more augmentation techniques for robustness
3. **Larger Model**: Consider YOLOv8s or YOLOv8m for improved accuracy
4. **Mixed Precision**: Enable AMP for faster training on modern GPUs
5. **Hyperparameter Tuning**: Optimize learning rate, batch size, and image size

## Dependencies

### Required Packages
```bash
pip install ultralytics torch torchvision
```

### CUDA Requirements
- PyTorch with CUDA support
- CUDA-compatible GPU (NVIDIA)
- Appropriate CUDA drivers

## Notes

- The training script is currently commented out in `training.py`
- Training was performed with GPU acceleration (CUDA)
- Model is optimized for real-time accident detection
- Best model checkpoint automatically saved during training

## Directory Structure

```
MOdel/
├── best.pt          # Trained model weights (best checkpoint)
├── training.py      # Training script
└── README.md        # This documentation file
```

## Contact & Support

For questions about model training or modifications:
- Review the Ultralytics YOLOv8 documentation
- Check CUDA/PyTorch compatibility for GPU training
- Ensure dataset is properly configured in `data.yaml`

---

**Last Updated**: November 2025  
**Model Version**: YOLOv8n  
**Task**: Accident Detection from CCTV Footage
