#!/usr/bin/env python3
"""
Model Testing Script for Road Raksha Accident Detection
Tests the trained YOLO model on sample images and provides detailed metrics
"""

import torch
import os
import glob
import cv2
import numpy as np
from pathlib import Path

# Monkeypatch torch.load to support PyTorch 2.6+ with older Ultralytics
_old_load = torch.load
def _new_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _old_load(*args, **kwargs)
torch.load = _new_load

from ultralytics import YOLO

# Configuration
MODEL_PATH = "../MOdel/best.pt"
TEST_SAMPLES_DIR = "../test_samples"
OUTPUT_DIR = "../test_results"
CONFIDENCE_THRESHOLDS = [0.10, 0.25, 0.40, 0.50, 0.75]

def create_output_dir():
    """Create output directory for results"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"✅ Output directory created: {OUTPUT_DIR}")

def load_model():
    """Load the trained YOLO model"""
    print(f"\n🔄 Loading model from {MODEL_PATH}...")
    try:
        model = YOLO(MODEL_PATH)
        print("✅ Model loaded successfully!")
        return model
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        return None

def get_test_images():
    """Get all test images from the test samples directory"""
    image_paths = sorted(glob.glob(os.path.join(TEST_SAMPLES_DIR, "*.jpg")))
    print(f"\n📁 Found {len(image_paths)} test images")
    return image_paths

def test_single_image(model, image_path, conf_threshold=0.25):
    """Test model on a single image and return results"""
    img = cv2.imread(image_path)
    if img is None:
        return None
    
    # Run inference
    results = model(img, verbose=False, conf=conf_threshold, device='cpu')
    
    detections = []
    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            conf = float(box.conf[0])
            cls = int(box.cls[0])
            class_name = result.names[cls]
            
            detections.append({
                'bbox': [int(x1), int(y1), int(x2), int(y2)],
                'confidence': conf,
                'class': class_name
            })
    
    return {
        'image': img,
        'detections': detections,
        'has_accident': len(detections) > 0
    }

def draw_detections(img, detections, filename):
    """Draw bounding boxes on image and save"""
    img_copy = img.copy()
    
    for det in detections:
        x1, y1, x2, y2 = det['bbox']
        conf = det['confidence']
        
        # Draw bounding box
        cv2.rectangle(img_copy, (x1, y1), (x2, y2), (0, 0, 255), 2)
        
        # Draw label with confidence
        label = f"Accident {conf:.2f}"
        label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.rectangle(img_copy, (x1, y1 - label_size[1] - 10), 
                     (x1 + label_size[0], y1), (0, 0, 255), -1)
        cv2.putText(img_copy, label, (x1, y1 - 5), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    
    # Save annotated image
    output_path = os.path.join(OUTPUT_DIR, f"annotated_{filename}")
    cv2.imwrite(output_path, img_copy)
    return output_path

def calculate_metrics(results, conf_threshold):
    """Calculate performance metrics"""
    total_images = len(results)
    images_with_detections = sum(1 for r in results if r['has_accident'])
    images_without_detections = total_images - images_with_detections
    
    total_detections = sum(len(r['detections']) for r in results)
    avg_confidence = 0
    max_confidence = 0
    min_confidence = 1.0
    
    if total_detections > 0:
        all_confidences = [det['confidence'] for r in results for det in r['detections']]
        avg_confidence = np.mean(all_confidences)
        max_confidence = np.max(all_confidences)
        min_confidence = np.min(all_confidences)
    
    return {
        'total_images': total_images,
        'images_with_accidents': images_with_detections,
        'images_without_accidents': images_without_detections,
        'total_detections': total_detections,
        'avg_confidence': avg_confidence,
        'max_confidence': max_confidence,
        'min_confidence': min_confidence,
        'detection_rate': (images_with_detections / total_images * 100) if total_images > 0 else 0
    }

def print_detailed_results(image_paths, results, conf_threshold):
    """Print detailed results for each image"""
    print(f"\n{'='*80}")
    print(f"DETAILED RESULTS (Confidence Threshold: {conf_threshold})")
    print(f"{'='*80}\n")
    
    for i, (img_path, result) in enumerate(zip(image_paths, results), 1):
        filename = os.path.basename(img_path)
        print(f"{i}. {filename}")
        
        if result['has_accident']:
            print(f"   ✅ ACCIDENT DETECTED ({len(result['detections'])} detection(s))")
            for j, det in enumerate(result['detections'], 1):
                print(f"      Detection {j}: Confidence = {det['confidence']:.4f} ({det['confidence']*100:.2f}%)")
        else:
            print(f"   ❌ NO ACCIDENT DETECTED")
        print()

def print_summary(metrics, conf_threshold):
    """Print summary statistics"""
    print(f"\n{'='*80}")
    print(f"SUMMARY STATISTICS (Confidence Threshold: {conf_threshold})")
    print(f"{'='*80}\n")
    
    print(f"Total Test Images:           {metrics['total_images']}")
    print(f"Images with Accidents:       {metrics['images_with_accidents']} ({metrics['detection_rate']:.1f}%)")
    print(f"Images without Accidents:    {metrics['images_without_accidents']} ({100-metrics['detection_rate']:.1f}%)")
    print(f"Total Detections:            {metrics['total_detections']}")
    
    if metrics['total_detections'] > 0:
        print(f"\nConfidence Scores:")
        print(f"  Average:                   {metrics['avg_confidence']:.4f} ({metrics['avg_confidence']*100:.2f}%)")
        print(f"  Maximum:                   {metrics['max_confidence']:.4f} ({metrics['max_confidence']*100:.2f}%)")
        print(f"  Minimum:                   {metrics['min_confidence']:.4f} ({metrics['min_confidence']*100:.2f}%)")
    
    print(f"\n{'='*80}\n")

def test_multiple_thresholds(model, image_paths):
    """Test model with multiple confidence thresholds"""
    print(f"\n{'#'*80}")
    print(f"TESTING WITH MULTIPLE CONFIDENCE THRESHOLDS")
    print(f"{'#'*80}\n")
    
    threshold_results = {}
    
    for threshold in CONFIDENCE_THRESHOLDS:
        print(f"\n🔍 Testing with confidence threshold: {threshold}")
        results = []
        
        for img_path in image_paths:
            result = test_single_image(model, img_path, conf_threshold=threshold)
            if result:
                results.append(result)
        
        metrics = calculate_metrics(results, threshold)
        threshold_results[threshold] = metrics
        
        print(f"   Detections: {metrics['images_with_accidents']}/{metrics['total_images']} images")
        if metrics['total_detections'] > 0:
            print(f"   Avg Confidence: {metrics['avg_confidence']:.4f}")
    
    # Print comparison table
    print(f"\n{'='*80}")
    print(f"THRESHOLD COMPARISON TABLE")
    print(f"{'='*80}\n")
    print(f"{'Threshold':<12} {'Detections':<15} {'Detection Rate':<18} {'Avg Confidence':<15}")
    print(f"{'-'*80}")
    
    for threshold in CONFIDENCE_THRESHOLDS:
        metrics = threshold_results[threshold]
        det_str = f"{metrics['images_with_accidents']}/{metrics['total_images']}"
        rate_str = f"{metrics['detection_rate']:.1f}%"
        conf_str = f"{metrics['avg_confidence']:.4f}" if metrics['total_detections'] > 0 else "N/A"
        print(f"{threshold:<12.2f} {det_str:<15} {rate_str:<18} {conf_str:<15}")
    
    print(f"\n{'='*80}\n")

def main():
    """Main testing function"""
    print("\n" + "="*80)
    print("ROAD RAKSHA - ACCIDENT DETECTION MODEL TESTING")
    print("="*80)
    
    # Create output directory
    create_output_dir()
    
    # Load model
    model = load_model()
    if model is None:
        print("❌ Failed to load model. Exiting.")
        return
    
    # Get test images
    image_paths = get_test_images()
    if not image_paths:
        print("❌ No test images found. Exiting.")
        return
    
    # Test with default threshold (0.25)
    DEFAULT_THRESHOLD = 0.25
    print(f"\n{'#'*80}")
    print(f"PRIMARY TEST (Confidence Threshold: {DEFAULT_THRESHOLD})")
    print(f"{'#'*80}")
    
    results = []
    for img_path in image_paths:
        filename = os.path.basename(img_path)
        print(f"🔍 Testing: {filename}...", end=" ")
        
        result = test_single_image(model, img_path, conf_threshold=DEFAULT_THRESHOLD)
        if result:
            results.append(result)
            
            # Draw and save annotated image
            if result['has_accident']:
                output_path = draw_detections(result['image'], result['detections'], filename)
                print(f"✅ Accident detected! Saved to {os.path.basename(output_path)}")
            else:
                print("❌ No accident detected")
    
    # Calculate and print metrics
    metrics = calculate_metrics(results, DEFAULT_THRESHOLD)
    print_detailed_results(image_paths, results, DEFAULT_THRESHOLD)
    print_summary(metrics, DEFAULT_THRESHOLD)
    
    # Test with multiple thresholds
    test_multiple_thresholds(model, image_paths)
    
    print(f"\n✅ Testing complete! Annotated images saved to: {OUTPUT_DIR}")
    print(f"\n{'='*80}\n")

if __name__ == "__main__":
    main()
