import glob
import os
import random
import shutil

SOURCE_DIR = "../test_data_repo_2/data"
DEST_DIR = "../test_samples"

# Get all images
all_images = glob.glob(os.path.join(SOURCE_DIR, "**", "*.jpg"), recursive=True) + \
             glob.glob(os.path.join(SOURCE_DIR, "**", "*.JPG"), recursive=True)

if not all_images:
    print("No images found to copy.")
    exit(1)

# Pick 10
selected = random.sample(all_images, min(10, len(all_images)))

print(f"Copying {len(selected)} images to {DEST_DIR}...")

for img_path in selected:
    basename = os.path.basename(img_path)
    dest_path = os.path.join(DEST_DIR, basename)
    shutil.copy(img_path, dest_path)
    print(f"Copied: {basename}")
