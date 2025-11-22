"""
Routing API endpoints using OSRM
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
import httpx
from loguru import logger

from models.schemas import RouteRequest, RouteResponse

router = APIRouter()

# OSRM server URL (will be running in Docker)
OSRM_URL = "http://osrm:5000"


@router.post("/route", response_model=RouteResponse)
async def calculate_route(request: RouteRequest):
    """Calculate shortest route between two points"""
    try:
        # Format coordinates for OSRM (longitude,latitude)
        start = f"{request.start_location.longitude},{request.start_location.latitude}"
        end = f"{request.end_location.longitude},{request.end_location.latitude}"
        
        # Call OSRM API
        url = f"{OSRM_URL}/route/v1/driving/{start};{end}"
        params = {
            'overview': 'full',
            'geometries': 'geojson',
            'steps': 'true'
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            
        data = response.json()
        
        if data['code'] != 'Ok':
            raise HTTPException(status_code=400, detail="Route calculation failed")
            
        route = data['routes'][0]
        
        return {
            'distance_meters': route['distance'],
            'duration_seconds': int(route['duration']),
            'geometry': route['geometry']
        }
        
    except httpx.HTTPError as e:
        logger.error(f"OSRM request failed: {e}")
        raise HTTPException(status_code=503, detail="Routing service unavailable")
    except Exception as e:
        logger.error(f"Route calculation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/route/multi", response_model=Dict[str, Any])
async def calculate_multi_route(
    waypoints: list[Dict[str, float]]
):
    """Calculate route through multiple waypoints"""
    try:
        # Format coordinates for OSRM
        coords = ";".join([
            f"{wp['longitude']},{wp['latitude']}"
            for wp in waypoints
        ])
        
        url = f"{OSRM_URL}/route/v1/driving/{coords}"
        params = {
            'overview': 'full',
            'geometries': 'geojson',
            'steps': 'true'
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            
        data = response.json()
        
        if data['code'] != 'Ok':
            raise HTTPException(status_code=400, detail="Route calculation failed")
            
        return data
        
    except httpx.HTTPError as e:
        logger.error(f"OSRM request failed: {e}")
        raise HTTPException(status_code=503, detail="Routing service unavailable")
    except Exception as e:
        logger.error(f"Multi-route calculation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
