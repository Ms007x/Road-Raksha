FROM python:3.10-slim

WORKDIR /app

# Install system dependencies including FFmpeg and OpenCV requirements
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    ffmpeg \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Download YOLOv8n model
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Copy application code
COPY . .

# Create directories
RUN mkdir -p logs footage

# Run application
CMD ["python", "main.py"]
