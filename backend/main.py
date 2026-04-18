import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import api, mcp, websocket
from backend.utils.os_utils import watch_parent
from backend.config import FRONTEND_PORT

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    parent_pid = os.getppid()
    # Use a lambda to get the current connection count from the websocket module
    import asyncio
    monitor = asyncio.create_task(
        watch_parent(parent_pid, FRONTEND_PORT, websocket.get_active_connections)
    )
    yield
    monitor.cancel()

def create_app() -> FastAPI:
    app = FastAPI(title="FreeCode Backend", lifespan=lifespan)
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    app.include_router(api.router)
    app.include_router(mcp.router)
    app.include_router(websocket.router)
    
    return app

app = create_app()
