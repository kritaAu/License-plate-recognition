"""
License Plate Recognition API — Application Entry Point.

Run with:
    uvicorn main_api:app --reload
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from core.config import ALLOWED_ORIGINS
from core.database import supabase
from core.websocket import manager
from background_matcher import process_unmatched_sessions

from routers import auth, members, events, parking, dashboard, upload_export

logger = logging.getLogger("app")


# ───── Lifespan (replaces deprecated @app.on_event) ─────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background tasks on server startup."""
    try:
        task = asyncio.create_task(process_unmatched_sessions(supabase))
        logger.info("Background matcher started successfully")
    except Exception as e:
        logger.error(f"Failed to start background matcher: {e}")

    yield  # App is running

    # Shutdown: cancel background task if needed
    if task and not task.done():
        task.cancel()


# ───── FastAPI App ─────
app = FastAPI(title="License Plate Recognition API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ───── Include Routers ─────
app.include_router(auth.router)
app.include_router(members.router)
app.include_router(events.router)
app.include_router(parking.router)
app.include_router(dashboard.router)
app.include_router(upload_export.router)


# ───── WebSocket ─────
@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket connection for real-time events."""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            logger.debug(f"[WS] Received from client: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
