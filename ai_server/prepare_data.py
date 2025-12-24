import os
import glob
import yaml

DATASET_ROOT = "/Users/ms/Desktop/Road-Raksha/accident.v2i.yolov8"
DIRS = ['train', 'valid', 'test']

# 1. Update Labels
for d in DIRS:
    label_dir = os.path.join(DATASET_ROOT, d, 'labels')
    print(f"Processing {label_dir}...")
    
    txt_files = glob.glob(os.path.join(label_dir, "*.txt"))
    for txt_file in txt_files:
        with open(txt_file, 'r') as f:
            lines = f.readlines()
        
        new_lines = []
        for line in lines:
            parts = line.strip().split()
            if not parts: continue
            
            cls_id = int(parts[0])
            
            # MAPPING LOGIC
            # Original: ['0', 'accident', 'not_accident'] -> Indicies: 0, 1, 2
            # Target: ['Accident'] -> Index: 0
            
            if cls_id == 1:
                # Keep 'accident', map to 0
                parts[0] = '0'
                new_lines.append(" ".join(parts) + "\n")
            # else: Drop class 0 ('0') and class 2 ('not_accident') -> Background
            
        with open(txt_file, 'w') as f:
            f.writelines(new_lines)

print("✅ Labels updated successfully.")

# 2. Update data.yaml
yaml_path = os.path.join(DATASET_ROOT, "data.yaml")
new_yaml = {
    'train': os.path.join(DATASET_ROOT, 'train/images'),
    'val': os.path.join(DATASET_ROOT, 'valid/images'),
    'test': os.path.join(DATASET_ROOT, 'test/images'),
    'nc': 1,
    'names': ['Accident']
}

with open(yaml_path, 'w') as f:
    yaml.dump(new_yaml, f)

print("✅ data.yaml updated with absolute paths and single class.")
