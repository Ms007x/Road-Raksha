"""
Main CV Engine Orchestrator
Coordinates accident detection across multiple camera streams
"""

import asyncio
from typing import Dict, Optional
from datetime import datetime
import httpx
from loguru import logger
import sys
from pathlib import Path

from accident_detector import AccidentDetector
from stream_processor import MultiStreamManager, StreamConfig
from clip_extractor import ClipExtractor


class CVEngine:
    """
    Main computer vision engine for Road-Raksha
    Orchestrates multi-camera accident detection
    """
    
    def __init__(
        self,
        backend_url: str = "http://localhost:8000",
        redis_host: str = "localhost",
        redis_port: int = 6379,
        footage_dir: str = "./footage",
        confidence_threshold: float = 0.5
    ):
        """
        Initialize CV engine
        
        Args:
            backend_url: Backend API URL
            redis_host: Redis host
            redis_port: Redis port
            footage_dir: Directory for video clips
            confidence_threshold: Minimum confidence for accident detection
        """
        self.backend_url = backend_url
        
        # Initialize components
        self.detector = AccidentDetector(
            confidence_threshold=confidence_threshold
        )
        
        self.stream_manager = MultiStreamManager(
            redis_host=redis_host,
            redis_port=redis_port
        )
        
        self.clip_extractor = ClipExtractor(
            output_dir=footage_dir
        )
        
        # HTTP client for backend communication
        self.http_client = httpx.AsyncClient(timeout=30.0)
        
        # Active cameras
        self.cameras: Dict[int, dict] = {}
        
        logger.info("CV Engine initialized")
        
    async def load_cameras_from_backend(self):
        """Load camera configurations from backend"""
        try:
            response = await self.http_client.get(f"{self.backend_url}/api/cameras")
            response.raise_for_status()
            
            cameras = response.json()
            logger.info(f"Loaded {len(cameras)} cameras from backend")
            
            for camera in cameras:
                await self.add_camera(camera)
                
        except Exception as e:
            logger.error(f"Error loading cameras from backend: {e}")
            
    async def add_camera(self, camera_config: dict):
        """
        Add a camera to monitor
        
        Args:
            camera_config: Camera configuration from database
        """
        camera_id = camera_config['id']
        
        if camera_id in self.cameras:
            logger.warning(f"Camera {camera_id} already exists")
            return
            
        # Store camera info
        self.cameras[camera_id] = camera_config
        
        # Add to clip extractor
        self.clip_extractor.add_camera(camera_id)
        
        # Create stream config
        stream_config = StreamConfig(
            camera_id=camera_id,
            rtsp_url=camera_config['rtsp_url'],
            fps=camera_config.get('fps', 30),
            skip_frames=2  # Process every 3rd frame
        )
        
        # Add stream with callback
        self.stream_manager.add_stream(
            config=stream_config,
            frame_callback=lambda frame_data: asyncio.create_task(
                self.process_frame(frame_data)
            )
        )
        
        logger.info(f"Added camera {camera_id}: {camera_config['name']}")
        
    async def process_frame(self, frame_data: dict):
        """
        Process a single frame for accident detection
        
        Args:
            frame_data: Frame data from stream processor
        """
        camera_id = frame_data['camera_id']
        frame = frame_data['frame']
        timestamp = frame_data['timestamp']
        
        # Add frame to clip extractor buffer
        self.clip_extractor.add_frame(camera_id, frame, timestamp)
        
        # Detect accidents
        is_accident, confidence, metadata = self.detector.detect_accident(frame)
        
        if is_accident:
            await self.handle_accident_detection(
                camera_id=camera_id,
                timestamp=timestamp,
                confidence=confidence,
                metadata=metadata,
                frame=frame
            )
            
    async def handle_accident_detection(
        self,
        camera_id: int,
        timestamp: datetime,
        confidence: float,
        metadata: dict,
        frame
    ):
        """
        Handle detected accident
        
        Args:
            camera_id: Camera ID
            timestamp: Detection timestamp
            confidence: Detection confidence
            metadata: Detection metadata
            frame: Current frame
        """
        logger.warning(f"Accident detected on camera {camera_id} at {timestamp}")
        
        try:
            # Get camera info
            camera = self.cameras[camera_id]
            
            # Determine severity
            severity = self.detector.get_severity(confidence, metadata)
            
            # Report to backend
            accident_data = {
                'camera_id': camera_id,
                'detected_at': timestamp.isoformat(),
                'severity': severity,
                'confidence_score': confidence,
                'location': {
                    'latitude': camera['location']['coordinates'][1],
                    'longitude': camera['location']['coordinates'][0]
                },
                'metadata': metadata
            }
            
            response = await self.http_client.post(
                f"{self.backend_url}/api/accidents/report",
                json=accident_data
            )
            response.raise_for_status()
            
            accident_response = response.json()
            accident_id = accident_response['id']
            
            logger.info(f"Accident {accident_id} reported to backend")
            
            # Extract video clip
            clip_path = self.clip_extractor.extract_clip(
                camera_id=camera_id,
                event_time=timestamp,
                accident_id=accident_id,
                metadata={
                    'severity': severity,
                    'confidence': confidence,
                    **metadata
                }
            )
            
            # Update accident with footage path
            if clip_path:
                await self.http_client.post(
                    f"{self.backend_url}/api/footage",
                    json={
                        'accident_id': accident_id,
                        'camera_id': camera_id,
                        'file_path': clip_path,
                        'start_time': (timestamp - self.clip_extractor.pre_event_duration).isoformat(),
                        'end_time': (timestamp + self.clip_extractor.post_event_duration).isoformat()
                    }
                )
                
                logger.info(f"Footage saved for accident {accident_id}: {clip_path}")
                
        except Exception as e:
            logger.error(f"Error handling accident detection: {e}")
            
    async def start(self):
        """Start the CV engine"""
        logger.info("Starting CV Engine")
        
        # Load cameras from backend
        await self.load_cameras_from_backend()
        
        # Start all streams
        self.stream_manager.start_all()
        
        logger.info("CV Engine started successfully")
        
    async def stop(self):
        """Stop the CV engine"""
        logger.info("Stopping CV Engine")
        
        # Stop all streams
        self.stream_manager.stop_all()
        
        # Close HTTP client
        await self.http_client.aclose()
        
        logger.info("CV Engine stopped")
        
    def get_stats(self) -> dict:
        """Get engine statistics"""
        return {
            'cameras': len(self.cameras),
            'stream_stats': self.stream_manager.get_all_stats()
        }


async def main():
    """Main entry point"""
    # Configure logging
    logger.remove()
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
        level="INFO"
    )
    logger.add(
        "logs/cv_engine_{time}.log",
        rotation="1 day",
        retention="30 days",
        level="DEBUG"
    )
    
    # Create logs directory
    Path("logs").mkdir(exist_ok=True)
    
    # Initialize engine
    engine = CVEngine(
        backend_url="http://localhost:8000",
        redis_host="localhost",
        redis_port=6379,
        footage_dir="./footage",
        confidence_threshold=0.5
    )
    
    try:
        await engine.start()
        
        # Keep running
        logger.info("CV Engine running. Press Ctrl+C to stop.")
        while True:
            await asyncio.sleep(10)
            
            # Log stats periodically
            stats = engine.get_stats()
            logger.info(f"Engine stats: {stats}")
            
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
    finally:
        await engine.stop()


if __name__ == "__main__":
    asyncio.run(main())
