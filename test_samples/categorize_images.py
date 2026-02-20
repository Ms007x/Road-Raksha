#!/usr/bin/env python3
"""
Road Raksha - Image Categorization Script
Tests sample images with YOLOv8 accident detection model and organizes them into categories.
"""

import os
import sys
import shutil
from pathlib import Path
import cv2
import torch

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
CONFIDENCE_THRESHOLD = 0.40  # Matches VISUAL_THRESHOLD in production
INPUT_DIR = "."
OUTPUT_DIR = "categorized_results"

# Output subdirectories
ACCIDENT_DIR = os.path.join(OUTPUT_DIR, "accident")
NON_ACCIDENT_DIR = os.path.join(OUTPUT_DIR, "non_accident")
ANNOTATED_DIR = os.path.join(OUTPUT_DIR, "annotated")

def setup_directories():
    """Create output directory structure."""
    print("📁 Setting up output directories...")
    
    # Remove existing results if present
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    
    # Create fresh directories
    os.makedirs(ACCIDENT_DIR, exist_ok=True)
    os.makedirs(NON_ACCIDENT_DIR, exist_ok=True)
    os.makedirs(ANNOTATED_DIR, exist_ok=True)
    
    print(f"   ✅ Created: {OUTPUT_DIR}/")
    print(f"   ✅ Created: {ACCIDENT_DIR}/")
    print(f"   ✅ Created: {NON_ACCIDENT_DIR}/")
    print(f"   ✅ Created: {ANNOTATED_DIR}/")

def load_model():
    """Load the YOLOv8 accident detection model."""
    print(f"\n🤖 Loading model from {MODEL_PATH}...")
    try:
        model = YOLO(MODEL_PATH)
        print("   ✅ Model loaded successfully!")
        return model
    except Exception as e:
        print(f"   ❌ Error loading model: {e}")
        sys.exit(1)

def get_image_files():
    """Get all image files from the input directory."""
    extensions = ['.jpg', '.jpeg', '.png', '.webp']
    image_files = []
    
    for ext in extensions:
        image_files.extend(Path(INPUT_DIR).glob(f"*{ext}"))
        image_files.extend(Path(INPUT_DIR).glob(f"*{ext.upper()}"))
    
    # Filter out any images in subdirectories
    image_files = [f for f in image_files if f.parent == Path(INPUT_DIR)]
    
    return sorted(image_files)

def process_images(model, image_files):
    """Process all images and categorize them."""
    results_data = []
    
    print(f"\n🔍 Processing {len(image_files)} images...\n")
    
    for idx, img_path in enumerate(image_files, 1):
        filename = img_path.name
        print(f"[{idx}/{len(image_files)}] Processing: {filename}")
        
        # Read image
        img = cv2.imread(str(img_path))
        if img is None:
            print(f"   ⚠️  Could not read image, skipping...")
            continue
        
        # Run inference
        results = model(img, verbose=False, conf=CONFIDENCE_THRESHOLD, device='cpu')
        
        # Check for detections
        has_accident = False
        detections = []
        
        for result in results:
            if len(result.boxes) > 0:
                has_accident = True
                for box in result.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    conf = float(box.conf[0])
                    detections.append({
                        'bbox': (int(x1), int(y1), int(x2), int(y2)),
                        'confidence': conf
                    })
                    
                    # Draw bounding box on image
                    cv2.rectangle(img, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 2)
                    
                    # Add confidence label
                    label = f"Accident {conf:.2%}"
                    cv2.putText(img, label, (int(x1), int(y1) - 10), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
        
        # Save annotated image
        annotated_path = os.path.join(ANNOTATED_DIR, f"annotated_{filename}")
        cv2.imwrite(annotated_path, img)
        
        # Copy to appropriate category folder
        if has_accident:
            dest_path = os.path.join(ACCIDENT_DIR, filename)
            category = "ACCIDENT"
            max_conf = max([d['confidence'] for d in detections])
            print(f"   🚨 {category} detected! Confidence: {max_conf:.2%} ({len(detections)} detection(s))")
        else:
            dest_path = os.path.join(NON_ACCIDENT_DIR, filename)
            category = "NON-ACCIDENT"
            max_conf = 0.0
            print(f"   ✅ {category} - No detections above threshold")
        
        shutil.copy2(img_path, dest_path)
        
        # Store results
        results_data.append({
            'filename': filename,
            'category': category,
            'detections': len(detections),
            'max_confidence': max_conf,
            'all_confidences': [d['confidence'] for d in detections]
        })
    
    return results_data

def generate_summary(results_data):
    """Generate a markdown summary report."""
    print("\n📊 Generating summary report...")
    
    accident_count = sum(1 for r in results_data if r['category'] == 'ACCIDENT')
    non_accident_count = len(results_data) - accident_count
    total_detections = sum(r['detections'] for r in results_data)
    
    # Calculate average confidence for accidents
    accident_confidences = []
    for r in results_data:
        if r['category'] == 'ACCIDENT':
            accident_confidences.extend(r['all_confidences'])
    
    avg_confidence = sum(accident_confidences) / len(accident_confidences) if accident_confidences else 0
    max_confidence = max(accident_confidences) if accident_confidences else 0
    min_confidence = min(accident_confidences) if accident_confidences else 0
    
    # Generate markdown report
    summary_path = os.path.join(OUTPUT_DIR, "SUMMARY.md")
    
    with open(summary_path, 'w') as f:
        f.write("# 🚨 Road Raksha - Image Categorization Results\n\n")
        f.write(f"**Generated:** {Path(OUTPUT_DIR).absolute()}\n")
        f.write(f"**Model:** YOLOv8 Accident Detection (best.pt)\n")
        f.write(f"**Confidence Threshold:** {CONFIDENCE_THRESHOLD:.0%}\n\n")
        f.write("---\n\n")
        
        # Summary Statistics
        f.write("## 📊 Summary Statistics\n\n")
        f.write("| Metric | Value |\n")
        f.write("|--------|-------|\n")
        f.write(f"| **Total Images Tested** | {len(results_data)} |\n")
        f.write(f"| **Accidents Detected** | {accident_count} ({accident_count/len(results_data)*100:.1f}%) |\n")
        f.write(f"| **Non-Accidents** | {non_accident_count} ({non_accident_count/len(results_data)*100:.1f}%) |\n")
        f.write(f"| **Total Detections** | {total_detections} |\n")
        
        if accident_confidences:
            f.write(f"| **Average Confidence** | {avg_confidence:.2%} |\n")
            f.write(f"| **Highest Confidence** | {max_confidence:.2%} |\n")
            f.write(f"| **Lowest Confidence** | {min_confidence:.2%} |\n")
        
        f.write("\n---\n\n")
        
        # Accident Images
        f.write("## 🚨 Accident Images\n\n")
        accident_results = [r for r in results_data if r['category'] == 'ACCIDENT']
        
        if accident_results:
            f.write("| # | Image | Detections | Max Confidence |\n")
            f.write("|---|-------|------------|----------------|\n")
            
            for idx, r in enumerate(sorted(accident_results, key=lambda x: x['max_confidence'], reverse=True), 1):
                f.write(f"| {idx} | `{r['filename']}` | {r['detections']} | {r['max_confidence']:.2%} |\n")
        else:
            f.write("*No accidents detected.*\n")
        
        f.write("\n---\n\n")
        
        # Non-Accident Images
        f.write("## ✅ Non-Accident Images\n\n")
        non_accident_results = [r for r in results_data if r['category'] == 'NON-ACCIDENT']
        
        if non_accident_results:
            f.write("| # | Image |\n")
            f.write("|---|-------|\n")
            
            for idx, r in enumerate(non_accident_results, 1):
                f.write(f"| {idx} | `{r['filename']}` |\n")
        else:
            f.write("*All images had accident detections.*\n")
        
        f.write("\n---\n\n")
        
        # Detailed Results
        f.write("## 📋 Detailed Results\n\n")
        f.write("| Image | Category | Detections | Confidences |\n")
        f.write("|-------|----------|------------|-------------|\n")
        
        for r in results_data:
            if r['all_confidences']:
                conf_str = ", ".join([f"{c:.2%}" for c in r['all_confidences']])
            else:
                conf_str = "—"
            
            emoji = "🚨" if r['category'] == 'ACCIDENT' else "✅"
            f.write(f"| {emoji} `{r['filename']}` | {r['category']} | {r['detections']} | {conf_str} |\n")
        
        f.write("\n---\n\n")
        
        # Folder Structure
        f.write("## 📂 Output Structure\n\n")
        f.write("```\n")
        f.write("categorized_results/\n")
        f.write(f"├── accident/          ({accident_count} images)\n")
        f.write(f"├── non_accident/      ({non_accident_count} images)\n")
        f.write(f"├── annotated/         ({len(results_data)} images with bounding boxes)\n")
        f.write("└── SUMMARY.md         (this file)\n")
        f.write("```\n\n")
        
        f.write("---\n\n")
        f.write("*Generated by Road Raksha Image Categorization Script*\n")
    
    print(f"   ✅ Summary saved to: {summary_path}")
    
    return summary_path

def main():
    """Main execution function."""
    print("=" * 60)
    print("🚗 Road Raksha - Image Categorization Script")
    print("=" * 60)
    
    # Setup
    setup_directories()
    model = load_model()
    
    # Get images
    image_files = get_image_files()
    if not image_files:
        print("\n❌ No image files found in the current directory!")
        sys.exit(1)
    
    print(f"\n📸 Found {len(image_files)} image(s) to process")
    
    # Process images
    results_data = process_images(model, image_files)
    
    # Generate summary
    summary_path = generate_summary(results_data)
    
    # Final summary
    print("\n" + "=" * 60)
    print("✅ CATEGORIZATION COMPLETE!")
    print("=" * 60)
    
    accident_count = sum(1 for r in results_data if r['category'] == 'ACCIDENT')
    non_accident_count = len(results_data) - accident_count
    
    print(f"\n📊 Results:")
    print(f"   🚨 Accidents:     {accident_count} images")
    print(f"   ✅ Non-Accidents: {non_accident_count} images")
    print(f"\n📁 Output Location: {Path(OUTPUT_DIR).absolute()}")
    print(f"📄 Summary Report:  {Path(summary_path).absolute()}")
    print("\n" + "=" * 60)

if __name__ == "__main__":
    main()
