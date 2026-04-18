"""FastAPI WebSocket server wrapper for FreeCode."""

import uvicorn
import logging
from backend.main import app
from backend.config import HOST, PORT, MODEL, THINKING, WORKING_DIR
from backend.utils.os_utils import free_port

logger = logging.getLogger(__name__)

def main():
    bind_host = "127.0.0.1" if HOST == "localhost" else HOST
    logger.info(f"Starting FastAPI server on ws://{bind_host}:{PORT}")
    logger.info(f"Model: {MODEL}, Thinking: {THINKING}, WorkingDir: {WORKING_DIR}")
    free_port(PORT)
    uvicorn.run(app, host=bind_host, port=PORT, log_level="warning")

if __name__ == "__main__":
    main()
