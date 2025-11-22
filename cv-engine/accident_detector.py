"""
Accident Detection Model using YOLOv8n
Optimized for real-time inference with CPU/GPU fallback
"""

import torch
from ultralytics import YOLO
import cv2
import numpy as np
from pathlib import Path
from typing import List, Tuple, Optional, Dict
from loguru import logger
import time


class AccidentDetector:
    """
    YOLOv8n-based accident detection with custom training support
    """
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        confidence_threshold: float = 0.5,
        device: str = "auto",
        img_size: int = 640
    ):
        """
        Initialize accident detector
        
        Args:
            model_path: Path to custom trained model, None for pretrained
            confidence_threshold: Minimum confidence for detections
            device: 'cpu', 'cuda', or 'auto' for automatic selection
            img_size: Input image size for inference
        """
        self.confidence_threshold = confidence_threshold
        self.img_size = img_size
        
        # Auto-detect device
        if device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
            
        logger.info(f"Using device: {self.device}")
        
        # Load model
        if model_path and Path(model_path).exists():
            logger.info(f"Loading custom model from {model_path}")
            self.model = YOLO(model_path)
        else:
            logger.info("Loading YOLOv8n pretrained model")
            self.model = YOLO("yolov8n.pt")
            
        # Move model to device
        self.model.to(self.device)
        
        # Accident-related class IDs from COCO dataset
        # We'll use vehicle classes and person class for accident detection
        self.vehicle_classes = [2, 3, 5, 7]  # car, motorcycle, bus, truck
        self.person_class = 0
        
        # Accident detection parameters
        self.accident_indicators = {
            'vehicle_overlap_threshold': 0.3,  # IoU threshold for collision
            'person_near_vehicle_distance': 50,  # pixels
            'abnormal_vehicle_angle': 45,  # degrees from horizontal
            'minimum_vehicles': 2  # minimum vehicles for accident
        }
        
        logger.info("Accident detector initialized successfully")
        
    def detect_objects(self, frame: np.ndarray) -> List[Dict]:
        """
        Detect objects in frame using YOLO
        
        Args:
            frame: Input frame (BGR format)
            
        Returns:
            List of detections with bbox, class, confidence
        """
        start_time = time.time()
        
        # Run inference
        results = self.model(
            frame,
            imgsz=self.img_size,
            conf=self.confidence_threshold,
            verbose=False
        )
        
        inference_time = (time.time() - start_time) * 1000  # ms
        
        detections = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                detection = {
                    'bbox': box.xyxy[0].cpu().numpy().tolist(),  # [x1, y1, x2, y2]
                    'confidence': float(box.conf[0]),
                    'class_id': int(box.cls[0]),
                    'class_name': result.names[int(box.cls[0])]
                }
                detections.append(detection)
                
        logger.debug(f"Detected {len(detections)} objects in {inference_time:.2f}ms")
        
        return detections, inference_time
    
    def calculate_iou(self, box1: List[float], box2: List[float]) -> float:
        """
        Calculate Intersection over Union between two bounding boxes
        
        Args:
            box1, box2: Bounding boxes in [x1, y1, x2, y2] format
            
        Returns:
            IoU value between 0 and 1
        """
        x1 = max(box1[0], box2[0])
        y1 = max(box1[1], box2[1])
        x2 = min(box1[2], box2[2])
        y2 = min(box1[3], box2[3])
        
        intersection = max(0, x2 - x1) * max(0, y2 - y1)
        
        area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
        area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
        
        union = area1 + area2 - intersection
        
        return intersection / union if union > 0 else 0
    
    def calculate_distance(self, box1: List[float], box2: List[float]) -> float:
        """
        Calculate distance between centers of two bounding boxes
        
        Args:
            box1, box2: Bounding boxes in [x1, y1, x2, y2] format
            
        Returns:
            Euclidean distance between centers
        """
        center1 = [(box1[0] + box1[2]) / 2, (box1[1] + box1[3]) / 2]
        center2 = [(box2[0] + box2[2]) / 2, (box2[1] + box2[3]) / 2]
        
        return np.sqrt((center1[0] - center2[0])**2 + (center1[1] - center2[1])**2)
    
    def detect_accident(
        self,
        frame: np.ndarray,
        detections: Optional[List[Dict]] = None
    ) -> Tuple[bool, float, Dict]:
        """
        Detect if an accident occurred in the frame
        
        Args:
            frame: Input frame
            detections: Pre-computed detections (optional)
            
        Returns:
            (is_accident, confidence, metadata)
        """
        if detections is None:
            detections, inference_time = self.detect_objects(frame)
        else:
            inference_time = 0
            
        # Filter vehicles and persons
        vehicles = [d for d in detections if d['class_id'] in self.vehicle_classes]
        persons = [d for d in detections if d['class_id'] == self.person_class]
        
        # Accident indicators
        accident_score = 0.0
        indicators = []
        
        # Check 1: Multiple vehicles overlapping (collision)
        if len(vehicles) >= self.accident_indicators['minimum_vehicles']:
            for i, v1 in enumerate(vehicles):
                for v2 in vehicles[i+1:]:
                    iou = self.calculate_iou(v1['bbox'], v2['bbox'])
                    if iou > self.accident_indicators['vehicle_overlap_threshold']:
                        accident_score += 0.4
                        indicators.append(f"Vehicle collision detected (IoU: {iou:.2f})")
                        
        # Check 2: Person near vehicles (pedestrian accident)
        for person in persons:
            for vehicle in vehicles:
                distance = self.calculate_distance(person['bbox'], vehicle['bbox'])
                if distance < self.accident_indicators['person_near_vehicle_distance']:
                    accident_score += 0.3
                    indicators.append(f"Person near vehicle (distance: {distance:.1f}px)")
                    
        # Check 3: Abnormal vehicle positions (overturned, etc.)
        # This is a simplified check - in production, use orientation estimation
        for vehicle in vehicles:
            bbox = vehicle['bbox']
            width = bbox[2] - bbox[0]
            height = bbox[3] - bbox[1]
            aspect_ratio = width / height if height > 0 else 0
            
            # Unusual aspect ratio might indicate overturned vehicle
            if aspect_ratio > 3 or aspect_ratio < 0.3:
                accident_score += 0.2
                indicators.append(f"Abnormal vehicle orientation (AR: {aspect_ratio:.2f})")
                
        # Normalize score
        accident_score = min(accident_score, 1.0)
        
        # Determine if accident occurred
        is_accident = accident_score >= 0.5
        
        metadata = {
            'accident_score': accident_score,
            'indicators': indicators,
            'vehicle_count': len(vehicles),
            'person_count': len(persons),
            'inference_time_ms': inference_time
        }
        
        if is_accident:
            logger.warning(f"ACCIDENT DETECTED! Score: {accident_score:.2f}, Indicators: {indicators}")
        
        return is_accident, accident_score, metadata
    
    def draw_detections(
        self,
        frame: np.ndarray,
        detections: List[Dict],
        is_accident: bool = False
    ) -> np.ndarray:
        """
        Draw bounding boxes and labels on frame
        
        Args:
            frame: Input frame
            detections: List of detections
            is_accident: Whether accident was detected
            
        Returns:
            Annotated frame
        """
        annotated = frame.copy()
        
        # Draw accident warning if detected
        if is_accident:
            cv2.putText(
                annotated,
                "ACCIDENT DETECTED!",
                (10, 50),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.5,
                (0, 0, 255),
                3
            )
            
        # Draw detections
        for det in detections:
            bbox = [int(x) for x in det['bbox']]
            class_name = det['class_name']
            confidence = det['confidence']
            
            # Color based on class
            if det['class_id'] in self.vehicle_classes:
                color = (0, 255, 0) if not is_accident else (0, 0, 255)
            elif det['class_id'] == self.person_class:
                color = (255, 0, 0)
            else:
                color = (128, 128, 128)
                
            # Draw box
            cv2.rectangle(annotated, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, 2)
            
            # Draw label
            label = f"{class_name}: {confidence:.2f}"
            cv2.putText(
                annotated,
                label,
                (bbox[0], bbox[1] - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                2
            )
            
        return annotated
    
    def get_severity(self, accident_score: float, metadata: Dict) -> str:
        """
        Estimate accident severity based on score and metadata
        
        Args:
            accident_score: Accident confidence score
            metadata: Detection metadata
            
        Returns:
            Severity level: 'low', 'medium', 'high', 'critical'
        """
        vehicle_count = metadata.get('vehicle_count', 0)
        person_count = metadata.get('person_count', 0)
        
        # Critical: High score + multiple vehicles + persons involved
        if accident_score >= 0.8 and vehicle_count >= 3 and person_count >= 1:
            return 'critical'
        
        # High: High score + multiple vehicles or persons
        elif accident_score >= 0.7 and (vehicle_count >= 2 or person_count >= 1):
            return 'high'
        
        # Medium: Moderate score
        elif accident_score >= 0.6:
            return 'medium'
        
        # Low: Lower score
        else:
            return 'low'


if __name__ == "__main__":
    # Test the detector
    detector = AccidentDetector(confidence_threshold=0.4)
    
    # Test with a sample image
    test_image = np.zeros((640, 640, 3), dtype=np.uint8)
    is_accident, score, metadata = detector.detect_accident(test_image)
    
    print(f"Accident detected: {is_accident}")
    print(f"Confidence: {score:.2f}")
    print(f"Metadata: {metadata}")
