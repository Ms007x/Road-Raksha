"""
Main FastAPI application
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from loguru import logger
import sys
from pathlib import Path

from database import init_db
from api import cameras, accidents, emergency, routing, analytics, footage
from websocket import ConnectionManager


# Configure logging
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan> - <level>{message}</level>",
    level="INFO"
)
logger.add(
    "logs/backend_{time}.log",
    rotation="1 day",
    retention="30 days",
    level="DEBUG"
)

# Create logs directory
Path("logs").mkdir(exist_ok=True)

# WebSocket connection manager
manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup/shutdown events
    """
    # Startup
    logger.info("Starting Road-Raksha Backend")
    init_db()
    logger.info("Database initialized")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Road-Raksha Backend")


# Create FastAPI app
app = FastAPI(
    title="Road-Raksha API",
    description="Accident Detection and Emergency Response System",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for footage
Path("./footage").mkdir(exist_ok=True)
app.mount("/footage", StaticFiles(directory="./footage"), name="footage")

# Include routers
app.include_router(cameras.router, prefix="/api/cameras", tags=["Cameras"])
app.include_router(accidents.router, prefix="/api/accidents", tags=["Accidents"])
app.include_router(emergency.router, prefix="/api/emergency", tags=["Emergency"])
app.include_router(routing.router, prefix="/api/routing", tags=["Routing"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(footage.router, prefix="/api/footage", tags=["Footage"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Road-Raksha API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time updates
    """
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            logger.debug(f"Received WebSocket message: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("WebSocket client disconnected")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
