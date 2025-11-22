"""
Video Clip Extractor
Extracts 10-15 second clips around accident detection using FFmpeg
"""

import cv2
import numpy as np
from pathlib import Path
from typing import Optional, Tuple
from datetime import datetime, timedelta
from collections import deque
import ffmpeg
from loguru import logger
import threading
from queue import Queue
import json


class ClipExtractor:
    """
    Extract and save video clips around accident events
    """
    
    def __init__(
        self,
        output_dir: str = "./footage",
        clip_duration: int = 15,
        pre_event_duration: int = 10,
        fps: int = 30,
        codec: str = "libx264",
        quality: str = "medium"
    ):
        """
        Initialize clip extractor
        
        Args:
            output_dir: Directory to save clips
            clip_duration: Total clip duration in seconds
            pre_event_duration: Duration before event to include
            fps: Output video FPS
            codec: Video codec (libx264 for H.264)
            quality: Encoding quality (low, medium, high)
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.clip_duration = clip_duration
        self.pre_event_duration = pre_event_duration
        self.post_event_duration = clip_duration - pre_event_duration
        self.fps = fps
        self.codec = codec
        
        # Quality presets
        self.quality_presets = {
            'low': {'crf': 28, 'preset': 'fast'},
            'medium': {'crf': 23, 'preset': 'medium'},
            'high': {'crf': 18, 'preset': 'slow'}
        }
        self.quality = self.quality_presets.get(quality, self.quality_presets['medium'])
        
        # Frame buffers for each camera (circular buffer)
        self.frame_buffers = {}
        self.buffer_locks = {}
        
        # Save queue for async saving
        self.save_queue = Queue()
        self.save_thread = threading.Thread(target=self._save_worker, daemon=True)
        self.save_thread.start()
        
        logger.info(f"Clip extractor initialized (duration: {clip_duration}s, pre-event: {pre_event_duration}s)")
        
    def add_camera(self, camera_id: int):
        """
        Add a camera to track
        
        Args:
            camera_id: Camera ID
        """
        if camera_id not in self.frame_buffers:
            buffer_size = self.pre_event_duration * self.fps
            self.frame_buffers[camera_id] = deque(maxlen=buffer_size)
            self.buffer_locks[camera_id] = threading.Lock()
            logger.info(f"Added camera {camera_id} to clip extractor (buffer size: {buffer_size} frames)")
            
    def add_frame(self, camera_id: int, frame: np.ndarray, timestamp: datetime):
        """
        Add frame to buffer
        
        Args:
            camera_id: Camera ID
            frame: Video frame
            timestamp: Frame timestamp
        """
        if camera_id not in self.frame_buffers:
            self.add_camera(camera_id)
            
        with self.buffer_locks[camera_id]:
            self.frame_buffers[camera_id].append({
                'frame': frame.copy(),
                'timestamp': timestamp
            })
            
    def extract_clip(
        self,
        camera_id: int,
        event_time: datetime,
        accident_id: int,
        metadata: Optional[dict] = None
    ) -> Optional[str]:
        """
        Extract clip around event time
        
        Args:
            camera_id: Camera ID
            event_time: Time of accident detection
            accident_id: Accident ID for filename
            metadata: Additional metadata to save
            
        Returns:
            Path to saved clip or None if failed
        """
        if camera_id not in self.frame_buffers:
            logger.error(f"Camera {camera_id} not found in buffers")
            return None
            
        logger.info(f"Extracting clip for accident {accident_id} from camera {camera_id}")
        
        # Get frames from buffer
        with self.buffer_locks[camera_id]:
            buffer_frames = list(self.frame_buffers[camera_id])
            
        if not buffer_frames:
            logger.warning(f"No frames in buffer for camera {camera_id}")
            return None
            
        # Filter frames within time range
        start_time = event_time - timedelta(seconds=self.pre_event_duration)
        end_time = event_time + timedelta(seconds=self.post_event_duration)
        
        clip_frames = [
            f for f in buffer_frames
            if start_time <= f['timestamp'] <= end_time
        ]
        
        if not clip_frames:
            logger.warning(f"No frames found in time range for accident {accident_id}")
            return None
            
        # Add to save queue
        self.save_queue.put({
            'frames': clip_frames,
            'camera_id': camera_id,
            'accident_id': accident_id,
            'event_time': event_time,
            'metadata': metadata or {}
        })
        
        # Generate expected filename
        filename = self._generate_filename(camera_id, accident_id, event_time)
        return str(self.output_dir / filename)
        
    def _generate_filename(
        self,
        camera_id: int,
        accident_id: int,
        event_time: datetime
    ) -> str:
        """Generate filename for clip"""
        timestamp = event_time.strftime("%Y%m%d_%H%M%S")
        return f"accident_{accident_id}_camera_{camera_id}_{timestamp}.mp4"
        
    def _save_worker(self):
        """Worker thread to save clips asynchronously"""
        while True:
            try:
                clip_data = self.save_queue.get()
                self._save_clip(clip_data)
                self.save_queue.task_done()
            except Exception as e:
                logger.error(f"Error in save worker: {e}")
                
    def _save_clip(self, clip_data: dict):
        """
        Save clip to disk using FFmpeg
        
        Args:
            clip_data: Dictionary with frames and metadata
        """
        frames = clip_data['frames']
        camera_id = clip_data['camera_id']
        accident_id = clip_data['accident_id']
        event_time = clip_data['event_time']
        metadata = clip_data['metadata']
        
        if not frames:
            return
            
        # Generate filename
        filename = self._generate_filename(camera_id, accident_id, event_time)
        output_path = self.output_dir / filename
        
        try:
            # Get frame dimensions
            height, width = frames[0]['frame'].shape[:2]
            
            # Create FFmpeg process
            process = (
                ffmpeg
                .input('pipe:', format='rawvideo', pix_fmt='bgr24', s=f'{width}x{height}', r=self.fps)
                .output(
                    str(output_path),
                    vcodec=self.codec,
                    pix_fmt='yuv420p',
                    crf=self.quality['crf'],
                    preset=self.quality['preset'],
                    movflags='faststart'  # Enable streaming
                )
                .overwrite_output()
                .run_async(pipe_stdin=True, pipe_stderr=True)
            )
            
            # Write frames
            for frame_data in frames:
                process.stdin.write(frame_data['frame'].tobytes())
                
            # Close and wait
            process.stdin.close()
            process.wait()
            
            # Get file size
            file_size = output_path.stat().st_size
            
            # Save metadata
            metadata_file = output_path.with_suffix('.json')
            full_metadata = {
                'accident_id': accident_id,
                'camera_id': camera_id,
                'event_time': event_time.isoformat(),
                'start_time': frames[0]['timestamp'].isoformat(),
                'end_time': frames[-1]['timestamp'].isoformat(),
                'duration': len(frames) / self.fps,
                'frame_count': len(frames),
                'fps': self.fps,
                'resolution': f'{width}x{height}',
                'file_size': file_size,
                'codec': self.codec,
                **metadata
            }
            
            with open(metadata_file, 'w') as f:
                json.dump(full_metadata, f, indent=2)
                
            logger.info(
                f"Saved clip for accident {accident_id}: {output_path} "
                f"({len(frames)} frames, {file_size / 1024 / 1024:.2f} MB)"
            )
            
            # Generate thumbnail
            self._generate_thumbnail(frames[len(frames) // 2]['frame'], output_path)
            
        except Exception as e:
            logger.error(f"Error saving clip for accident {accident_id}: {e}")
            
    def _generate_thumbnail(self, frame: np.ndarray, video_path: Path):
        """
        Generate thumbnail from frame
        
        Args:
            frame: Video frame
            video_path: Path to video file
        """
        try:
            thumbnail_path = video_path.with_suffix('.jpg')
            
            # Resize frame for thumbnail
            height, width = frame.shape[:2]
            thumbnail_width = 320
            thumbnail_height = int(height * (thumbnail_width / width))
            
            thumbnail = cv2.resize(frame, (thumbnail_width, thumbnail_height))
            
            cv2.imwrite(str(thumbnail_path), thumbnail, [cv2.IMWRITE_JPEG_QUALITY, 85])
            
            logger.debug(f"Generated thumbnail: {thumbnail_path}")
            
        except Exception as e:
            logger.error(f"Error generating thumbnail: {e}")
            
    def get_clip_info(self, clip_path: str) -> Optional[dict]:
        """
        Get information about a saved clip
        
        Args:
            clip_path: Path to clip file
            
        Returns:
            Clip metadata or None if not found
        """
        metadata_path = Path(clip_path).with_suffix('.json')
        
        if not metadata_path.exists():
            return None
            
        try:
            with open(metadata_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading clip metadata: {e}")
            return None


if __name__ == "__main__":
    # Test clip extractor
    extractor = ClipExtractor(output_dir="./test_footage")
    
    # Add camera
    extractor.add_camera(1)
    
    # Simulate adding frames
    for i in range(300):  # 10 seconds at 30 fps
        frame = np.random.randint(0, 255, (720, 1280, 3), dtype=np.uint8)
        timestamp = datetime.now()
        extractor.add_frame(1, frame, timestamp)
        
    # Extract clip
    clip_path = extractor.extract_clip(
        camera_id=1,
        event_time=datetime.now(),
        accident_id=1,
        metadata={'severity': 'high', 'confidence': 0.85}
    )
    
    print(f"Clip saved to: {clip_path}")
