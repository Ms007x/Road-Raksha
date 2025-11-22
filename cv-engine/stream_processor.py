"""
Multi-camera RTSP Stream Processor
Handles concurrent video streams with frame skipping and buffering
"""

import cv2
import numpy as np
from typing import Dict, Optional, Callable, List
from threading import Thread, Lock, Event
from queue import Queue, Full
import time
from loguru import logger
from dataclasses import dataclass
from datetime import datetime
import redis
from pathlib import Path


@dataclass
class StreamConfig:
    """Configuration for a single camera stream"""
    camera_id: int
    rtsp_url: str
    fps: int = 30
    skip_frames: int = 2  # Process every Nth frame
    buffer_size: int = 30
    reconnect_delay: int = 5
    max_reconnect_attempts: int = 10


class StreamProcessor:
    """
    Process single RTSP stream with frame skipping and buffering
    """
    
    def __init__(
        self,
        config: StreamConfig,
        frame_callback: Optional[Callable] = None,
        redis_client: Optional[redis.Redis] = None
    ):
        """
        Initialize stream processor
        
        Args:
            config: Stream configuration
            frame_callback: Function to call with each processed frame
            redis_client: Redis client for metrics publishing
        """
        self.config = config
        self.frame_callback = frame_callback
        self.redis_client = redis_client
        
        self.cap: Optional[cv2.VideoCapture] = None
        self.frame_queue = Queue(maxsize=config.buffer_size)
        self.running = Event()
        self.connected = Event()
        
        self.capture_thread: Optional[Thread] = None
        self.process_thread: Optional[Thread] = None
        
        self.frame_count = 0
        self.processed_count = 0
        self.error_count = 0
        self.last_frame_time = None
        
        self.lock = Lock()
        
        logger.info(f"Stream processor initialized for camera {config.camera_id}")
        
    def connect(self) -> bool:
        """
        Connect to RTSP stream
        
        Returns:
            True if connected successfully
        """
        try:
            logger.info(f"Connecting to {self.config.rtsp_url}")
            
            self.cap = cv2.VideoCapture(self.config.rtsp_url)
            
            # Set buffer size to minimum to reduce latency
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            if not self.cap.isOpened():
                logger.error(f"Failed to open stream {self.config.rtsp_url}")
                return False
                
            # Test read
            ret, frame = self.cap.read()
            if not ret or frame is None:
                logger.error(f"Failed to read from stream {self.config.rtsp_url}")
                return False
                
            self.connected.set()
            logger.info(f"Successfully connected to camera {self.config.camera_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error connecting to stream: {e}")
            return False
            
    def disconnect(self):
        """Disconnect from stream"""
        if self.cap:
            self.cap.release()
            self.cap = None
        self.connected.clear()
        logger.info(f"Disconnected from camera {self.config.camera_id}")
        
    def _capture_frames(self):
        """
        Capture frames from stream (runs in separate thread)
        """
        reconnect_attempts = 0
        
        while self.running.is_set():
            if not self.connected.is_set():
                # Try to reconnect
                if reconnect_attempts < self.config.max_reconnect_attempts:
                    logger.info(f"Attempting to reconnect (attempt {reconnect_attempts + 1})")
                    if self.connect():
                        reconnect_attempts = 0
                    else:
                        reconnect_attempts += 1
                        time.sleep(self.config.reconnect_delay)
                        continue
                else:
                    logger.error(f"Max reconnection attempts reached for camera {self.config.camera_id}")
                    break
                    
            try:
                ret, frame = self.cap.read()
                
                if not ret or frame is None:
                    logger.warning(f"Failed to read frame from camera {self.config.camera_id}")
                    self.error_count += 1
                    self.connected.clear()
                    continue
                    
                self.frame_count += 1
                
                # Frame skipping for performance
                if self.frame_count % (self.config.skip_frames + 1) != 0:
                    continue
                    
                # Add to queue (non-blocking)
                try:
                    self.frame_queue.put_nowait({
                        'frame': frame,
                        'timestamp': datetime.now(),
                        'frame_number': self.frame_count,
                        'camera_id': self.config.camera_id
                    })
                except Full:
                    # Queue full, skip frame
                    logger.debug(f"Frame queue full for camera {self.config.camera_id}, skipping frame")
                    
            except Exception as e:
                logger.error(f"Error capturing frame: {e}")
                self.error_count += 1
                time.sleep(0.1)
                
    def _process_frames(self):
        """
        Process frames from queue (runs in separate thread)
        """
        while self.running.is_set():
            try:
                if self.frame_queue.empty():
                    time.sleep(0.01)
                    continue
                    
                frame_data = self.frame_queue.get(timeout=1)
                
                # Update metrics
                self.processed_count += 1
                self.last_frame_time = frame_data['timestamp']
                
                # Calculate FPS
                if self.processed_count > 1:
                    fps = 1.0 / (time.time() - self.last_frame_time.timestamp())
                else:
                    fps = 0
                    
                # Publish metrics to Redis
                if self.redis_client:
                    metrics = {
                        'camera_id': self.config.camera_id,
                        'fps': fps,
                        'queue_size': self.frame_queue.qsize(),
                        'processed_count': self.processed_count,
                        'error_count': self.error_count,
                        'timestamp': datetime.now().isoformat()
                    }
                    self.redis_client.publish(
                        f'camera:{self.config.camera_id}:metrics',
                        str(metrics)
                    )
                    
                # Call callback with frame
                if self.frame_callback:
                    self.frame_callback(frame_data)
                    
            except Exception as e:
                logger.error(f"Error processing frame: {e}")
                
    def start(self):
        """Start stream processing"""
        if self.running.is_set():
            logger.warning(f"Stream processor already running for camera {self.config.camera_id}")
            return
            
        logger.info(f"Starting stream processor for camera {self.config.camera_id}")
        
        # Connect to stream
        if not self.connect():
            logger.error(f"Failed to start stream processor for camera {self.config.camera_id}")
            return
            
        self.running.set()
        
        # Start threads
        self.capture_thread = Thread(target=self._capture_frames, daemon=True)
        self.process_thread = Thread(target=self._process_frames, daemon=True)
        
        self.capture_thread.start()
        self.process_thread.start()
        
        logger.info(f"Stream processor started for camera {self.config.camera_id}")
        
    def stop(self):
        """Stop stream processing"""
        logger.info(f"Stopping stream processor for camera {self.config.camera_id}")
        
        self.running.clear()
        
        # Wait for threads to finish
        if self.capture_thread:
            self.capture_thread.join(timeout=5)
        if self.process_thread:
            self.process_thread.join(timeout=5)
            
        self.disconnect()
        
        logger.info(f"Stream processor stopped for camera {self.config.camera_id}")
        
    def get_stats(self) -> Dict:
        """Get processing statistics"""
        return {
            'camera_id': self.config.camera_id,
            'connected': self.connected.is_set(),
            'frames_captured': self.frame_count,
            'frames_processed': self.processed_count,
            'errors': self.error_count,
            'queue_size': self.frame_queue.qsize(),
            'last_frame_time': self.last_frame_time.isoformat() if self.last_frame_time else None
        }


class MultiStreamManager:
    """
    Manage multiple camera streams concurrently
    """
    
    def __init__(
        self,
        redis_host: str = 'localhost',
        redis_port: int = 6379
    ):
        """
        Initialize multi-stream manager
        
        Args:
            redis_host: Redis server host
            redis_port: Redis server port
        """
        self.processors: Dict[int, StreamProcessor] = {}
        self.redis_client = redis.Redis(
            host=redis_host,
            port=redis_port,
            decode_responses=True
        )
        
        logger.info("Multi-stream manager initialized")
        
    def add_stream(
        self,
        config: StreamConfig,
        frame_callback: Optional[Callable] = None
    ):
        """
        Add a new stream to manage
        
        Args:
            config: Stream configuration
            frame_callback: Function to call with each frame
        """
        if config.camera_id in self.processors:
            logger.warning(f"Stream for camera {config.camera_id} already exists")
            return
            
        processor = StreamProcessor(
            config=config,
            frame_callback=frame_callback,
            redis_client=self.redis_client
        )
        
        self.processors[config.camera_id] = processor
        logger.info(f"Added stream for camera {config.camera_id}")
        
    def remove_stream(self, camera_id: int):
        """
        Remove a stream
        
        Args:
            camera_id: Camera ID to remove
        """
        if camera_id not in self.processors:
            logger.warning(f"Stream for camera {camera_id} not found")
            return
            
        processor = self.processors[camera_id]
        processor.stop()
        del self.processors[camera_id]
        
        logger.info(f"Removed stream for camera {camera_id}")
        
    def start_all(self):
        """Start all streams"""
        logger.info("Starting all streams")
        for processor in self.processors.values():
            processor.start()
            
    def stop_all(self):
        """Stop all streams"""
        logger.info("Stopping all streams")
        for processor in self.processors.values():
            processor.stop()
            
    def get_all_stats(self) -> List[Dict]:
        """Get statistics for all streams"""
        return [p.get_stats() for p in self.processors.values()]


if __name__ == "__main__":
    # Test with a sample stream
    def test_callback(frame_data):
        print(f"Received frame {frame_data['frame_number']} from camera {frame_data['camera_id']}")
        
    config = StreamConfig(
        camera_id=1,
        rtsp_url="rtsp://example.com/stream",
        skip_frames=2
    )
    
    manager = MultiStreamManager()
    manager.add_stream(config, test_callback)
    manager.start_all()
    
    try:
        time.sleep(30)  # Run for 30 seconds
    except KeyboardInterrupt:
        pass
    finally:
        manager.stop_all()
