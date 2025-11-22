"""
WebSocket connection manager for real-time updates
"""

from fastapi import WebSocket
from typing import List, Dict, Any
from datetime import datetime
import json
from loguru import logger


class ConnectionManager:
    """
    Manage WebSocket connections and broadcast messages
    """
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connections_by_type: Dict[str, List[WebSocket]] = {
            'control_center': [],
            'hospital': [],
            'ambulance': []
        }
        
    async def connect(self, websocket: WebSocket, client_type: str = 'control_center'):
        """
        Accept new WebSocket connection
        
        Args:
            websocket: WebSocket connection
            client_type: Type of client (control_center, hospital, ambulance)
        """
        await websocket.accept()
        self.active_connections.append(websocket)
        
        if client_type in self.connections_by_type:
            self.connections_by_type[client_type].append(websocket)
            
        logger.info(f"New {client_type} WebSocket connection. Total: {len(self.active_connections)}")
        
    def disconnect(self, websocket: WebSocket):
        """
        Remove WebSocket connection
        
        Args:
            websocket: WebSocket connection to remove
        """
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            
        # Remove from type-specific lists
        for connections in self.connections_by_type.values():
            if websocket in connections:
                connections.remove(websocket)
                
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")
        
    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        """
        Send message to specific client
        
        Args:
            message: Message data
            websocket: Target WebSocket connection
        """
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            
    async def broadcast(self, message: Dict[str, Any]):
        """
        Broadcast message to all connected clients
        
        Args:
            message: Message data
        """
        disconnected = []
        
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")
                disconnected.append(connection)
                
        # Remove disconnected clients
        for connection in disconnected:
            self.disconnect(connection)
            
    async def broadcast_to_type(self, message: Dict[str, Any], client_type: str):
        """
        Broadcast message to specific client type
        
        Args:
            message: Message data
            client_type: Target client type
        """
        if client_type not in self.connections_by_type:
            return
            
        disconnected = []
        
        for connection in self.connections_by_type[client_type]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to {client_type}: {e}")
                disconnected.append(connection)
                
        # Remove disconnected clients
        for connection in disconnected:
            self.disconnect(connection)
            
    async def notify_accident(self, accident_data: Dict[str, Any]):
        """
        Notify all clients about new accident
        
        Args:
            accident_data: Accident information
        """
        message = {
            'type': 'accident_detected',
            'data': accident_data,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        await self.broadcast(message)
        logger.info(f"Broadcasted accident notification: {accident_data.get('id')}")
        
    async def notify_ambulance_dispatch(self, dispatch_data: Dict[str, Any]):
        """
        Notify about ambulance dispatch
        
        Args:
            dispatch_data: Dispatch information
        """
        # Notify control center
        await self.broadcast_to_type(
            {
                'type': 'ambulance_dispatched',
                'data': dispatch_data,
                'timestamp': datetime.utcnow().isoformat()
            },
            'control_center'
        )
        
        # Notify hospital
        await self.broadcast_to_type(
            {
                'type': 'incoming_patient',
                'data': dispatch_data,
                'timestamp': datetime.utcnow().isoformat()
            },
            'hospital'
        )
        
        # Notify ambulance
        await self.broadcast_to_type(
            {
                'type': 'dispatch_order',
                'data': dispatch_data,
                'timestamp': datetime.utcnow().isoformat()
            },
            'ambulance'
        )
        
        logger.info(f"Broadcasted ambulance dispatch notification")
        
    async def update_metrics(self, metrics_data: Dict[str, Any]):
        """
        Update system metrics
        
        Args:
            metrics_data: Metrics information
        """
        message = {
            'type': 'metrics_update',
            'data': metrics_data,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        await self.broadcast_to_type(message, 'control_center')
