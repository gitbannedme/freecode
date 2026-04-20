import json
import logging
import os
from fastapi import APIRouter, WebSocket
from starlette.websockets import WebSocketDisconnect

from backend.message_types import MessageType, ClientMessage, ServerMessage
from backend.sessions import get_or_create_session, sessions, list_sessions_from_disk
from backend.config import CONFIG_PATH, WORKING_DIR, MODEL, VERSION
from backend.utils.os_utils import pick_directory_async
from backend.utils.mapping import event_to_server_message

logger = logging.getLogger(__name__)
router = APIRouter()

# Global count of active websocket connections
_ACTIVE_CONNECTIONS = 0

def get_active_connections():
    return _ACTIVE_CONNECTIONS

@router.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    global _ACTIVE_CONNECTIONS
    await websocket.accept()
    _ACTIVE_CONNECTIONS += 1
    session_id = None
    session = None

    try:
        recents = []
        try:
            if CONFIG_PATH.exists():
                cfg = json.loads(CONFIG_PATH.read_text())
                recents = cfg.get("recent_dirs", [])
        except Exception:
            pass

        cwd = os.getcwd()
        for default_dir in [cwd, os.path.join(cwd, "frontend")]:
            if default_dir not in recents:
                recents.append(default_dir)

        await websocket.send_text(json.dumps({
            "type": "hello",
            "server": "freecode-backend",
            "version": VERSION,
            "recent_dirs": recents,
        }))

        while True:
            try:
                raw_message = await websocket.receive_text()
            except WebSocketDisconnect:
                logger.info(f"[{session_id}] Client disconnected")
                break

            try:
                data = json.loads(raw_message)

                if data.get("type") == "pick_folder":
                    path = await pick_directory_async()
                    await websocket.send_text(json.dumps({"type": "folder_picked", "path": path or ""}))
                    continue

                msg = ClientMessage.from_json(data)

                incoming_api_key = data.get("api_key")
                if incoming_api_key:
                    from backend.config import save_config, load_config
                    cfg = load_config()
                    cfg["api_key"] = incoming_api_key
                    save_config(cfg)
                    import backend.config
                    backend.config.API_KEY = incoming_api_key

                client_session_id = data.get("session_id") or "default"
                if session is None or session_id != client_session_id:
                    session_id = client_session_id
                    working_dir_hint = data.get("working_dir") or WORKING_DIR
                    session = get_or_create_session(
                        session_id,
                        working_dir=working_dir_hint,
                        api_key=incoming_api_key,
                    )
                    await websocket.send_text(json.dumps({
                        "type": "session",
                        "session_id": session_id,
                        "messages": [{"role": m.role, "content": m.content} for m in session.agent.state.messages],
                    }))
                elif incoming_api_key:
                    session.agent.update_api_key(incoming_api_key)

                if msg.type == MessageType.USER_INPUT:
                    if not msg.text:
                        await _send_error(websocket, "user_input requires 'text' field")
                        continue

                    if msg.text == "__init__":
                        logger.info(f"[{session_id}] Session initialized")
                        continue

                    from backend.config import API_KEY as CURRENT_API_KEY
                    if not CURRENT_API_KEY:
                        await _send_error(websocket, "No API key configured. Open settings to add your Gemini API key.")
                        continue

                    if session.active:
                        await _send_error(websocket, "Session is busy — wait for the current response to finish.")
                        continue

                    logger.info(f"[{session_id}] User input: {msg.text[:60]}...")
                    effort = msg.effort or "MEDIUM"
                    working_dir = msg.working_dir or str(session.agent.state.working_dir)
                    model = msg.model or MODEL
                    async for event in session.process_input(msg.text, effort=effort, working_dir=working_dir, model=model, context_files=msg.context_files):
                        server_msg = event_to_server_message(event)
                        if server_msg is not None:
                            await websocket.send_text(json.dumps(server_msg.to_json()))

                elif msg.type == MessageType.CANCEL:
                    if session and session.active:
                        logger.info(f"[{session_id}] Cancel requested")
                        await _send_system(websocket, "Cancellation not yet implemented")

                elif msg.type == MessageType.PICK_FOLDER:
                    path = await pick_directory_async()
                    await websocket.send_text(json.dumps({"type": "folder_picked", "path": path or ""}))

                elif msg.type == MessageType.PICK_DIR:
                    path = await pick_directory_async()
                    if path and session:
                        from pathlib import Path
                        session.agent.state.working_dir = Path(path).resolve()
                        from backend.sessions import save_working_dir
                        save_working_dir(path)
                        await _send_system(websocket, f"Working directory: {path}")
                    else:
                        await _send_system(websocket, "No folder selected")

                elif msg.type == MessageType.LIST_SESSIONS:
                    wdir = data.get("working_dir") or (str(session.agent.state.working_dir) if session else ".")
                    sess_list = list_sessions_from_disk(wdir)
                    await websocket.send_text(json.dumps({
                        "type": "sessions_list",
                        "sessions": sess_list,
                        "working_dir": wdir,
                    }))

                elif msg.type == MessageType.PING:
                    await websocket.send_text(json.dumps(ServerMessage(type=MessageType.SYSTEM, message="pong").to_json()))

                else:
                    await _send_error(websocket, f"Unknown message type: {msg.type}")

            except json.JSONDecodeError:
                await _send_error(websocket, "Invalid JSON")
            except ValueError as e:
                await _send_error(websocket, str(e))
            except Exception as e:
                logger.exception(f"Error processing message: {e}")
                await _send_error(websocket, f"Internal error: {e}")

    except Exception as e:
        logger.exception(f"WebSocket handler error: {e}")
    finally:
        _ACTIVE_CONNECTIONS -= 1

async def _send_system(websocket: WebSocket, message: str):
    msg = ServerMessage(type=MessageType.SYSTEM, message=message)
    await websocket.send_text(json.dumps(msg.to_json()))

async def _send_error(websocket: WebSocket, error: str):
    msg = ServerMessage(type=MessageType.ERROR, error=error)
    await websocket.send_text(json.dumps(msg.to_json()))
