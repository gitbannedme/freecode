"""WebSocket server for agent backend."""

import asyncio
import json
import os
import sys
import logging
from pathlib import Path
from datetime import datetime

import websockets



# Add parent to path so we can import agent_core
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_core import Agent
from backend.message_types import MessageType, ClientMessage, ServerMessage

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import json as _json
_ROOT = Path(__file__).parent.parent

def _get_config_path() -> Path:
    """Get freecode.json path from user config directory."""
    if os.name == "nt":
        base = Path(os.environ.get("APPDATA", "~")).resolve()
    else:
        base = Path("~/.config").expanduser().resolve()
    
    config_dir = base / "FreeCode"
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir / "freecode.json"

_CONFIG_PATH = _get_config_path()


# ── Session persistence ───────────────────────────────────────────────────────

def _sessions_dir(working_dir: str) -> Path:
    return Path(working_dir).resolve() / ".freecode" / "sessions"

def _session_path(working_dir: str, session_id: str) -> Path:
    return _sessions_dir(working_dir) / f"{session_id}.json"

def save_session_to_disk(session_id: str, working_dir: str, name: str, messages: list, model: str):
    try:
        d = _sessions_dir(working_dir)
        d.mkdir(parents=True, exist_ok=True)
        path = d / f"{session_id}.json"
        existing = {}
        if path.exists():
            try:
                existing = _json.loads(path.read_text())
            except Exception:
                pass
        existing.update({
            "id": session_id,
            "name": name,
            "working_dir": str(Path(working_dir).resolve()),
            "model": model,
            "messages": messages,
            "updated_at": datetime.now().isoformat(),
        })
        if "created_at" not in existing:
            existing["created_at"] = existing["updated_at"]
        path.write_text(_json.dumps(existing, indent=2))
    except Exception as e:
        logger.warning(f"Could not save session {session_id}: {e}")

def load_session_from_disk(working_dir: str, session_id: str) -> dict | None:
    try:
        path = _session_path(working_dir, session_id)
        if path.exists():
            return _json.loads(path.read_text())
    except Exception as e:
        logger.warning(f"Could not load session {session_id}: {e}")
    return None

def list_sessions_from_disk(working_dir: str) -> list:
    try:
        d = _sessions_dir(working_dir)
        if not d.exists():
            return []
        sessions_list = []
        for f in sorted(d.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            try:
                data = _json.loads(f.read_text())
                sessions_list.append({
                    "id": data.get("id"),
                    "name": data.get("name", "Session"),
                    "updated_at": data.get("updated_at"),
                    "working_dir": data.get("working_dir"),
                    "model": data.get("model"),
                })
            except Exception:
                pass
        return sessions_list
    except Exception as e:
        logger.warning(f"Could not list sessions for {working_dir}: {e}")
        return []


def _save_working_dir(path: str):
    try:
        abs_path = str(Path(path).resolve())
        try:
            cfg = _json.loads(_CONFIG_PATH.read_text())
        except (FileNotFoundError, _json.JSONDecodeError):
            cfg = {}
        recents = [abs_path] + [d for d in cfg.get("recent_dirs", []) if d != abs_path]
        cfg["working_dir"] = abs_path
        cfg["recent_dirs"] = recents[:5]
        _CONFIG_PATH.write_text(_json.dumps(cfg, indent=2))
    except Exception as e:
        logger.warning(f"Could not save working_dir to freecode.json: {e}")


def _load_config() -> dict:
    try:
        if _CONFIG_PATH.exists():
            return _json.loads(_CONFIG_PATH.read_text())
    except Exception:
        pass
    return {}

def _save_api_key(api_key: str):
    try:
        try:
            cfg = _json.loads(_CONFIG_PATH.read_text())
        except (FileNotFoundError, _json.JSONDecodeError):
            cfg = {}
        cfg["api_key"] = api_key
        _CONFIG_PATH.write_text(_json.dumps(cfg, indent=2))
        global API_KEY
        API_KEY = api_key
    except Exception as e:
        logger.warning(f"Could not save api_key to freecode.json: {e}")

_cfg = _load_config()
API_KEY = _cfg.get("api_key")
MODEL = _cfg.get("model", "gemma-4-26b-a4b-it")
THINKING = _cfg.get("thinking", True)

# When running as a bundled sidecar (PyInstaller), sys.frozen is set.
# Use the install directory as the default working directory so users
# don't need to pick a folder during onboarding.
def _default_working_dir() -> str:
    if getattr(sys, "frozen", False):
        # Bundled exe: use the directory it was installed to
        return str(Path(sys.executable).parent)
    # Dev mode: use config or current directory
    return _cfg.get("working_dir", ".")

WORKING_DIR = _cfg.get("working_dir") or _default_working_dir()
PORT = int(os.environ.get("FC_BACKEND_PORT") or _cfg.get("backend_port", 47820))
HOST = os.environ.get("FC_BACKEND_HOST") or _cfg.get("backend_host", "localhost")


async def pick_directory_async():
    """Open a native folder picker dialog and return the path. Supports Windows (PS) and Linux (Zenity/KDialog)."""
    if (os.name == "nt"):
        # Windows PowerShell implementation using Shell.Application (more reliable than WinForms in subprocess)
        ps_cmd = """
        $App = New-Object -ComObject Shell.Application
        $Folder = $App.BrowseForFolder(0, 'Select folder for FreeCode', 16 + 64, 0)
        if ($Folder) { $Folder.Self.Path }
        """
        try:
            proc = await asyncio.create_subprocess_exec(
                "powershell", "-NoProfile", "-Command", ps_cmd,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await proc.communicate()
            return stdout.decode().strip()
        except Exception as e:
            logger.error(f"Windows folder picker failed: {e}")
            return ""
    else:
        # Linux / Posix implementation
        # 1. Try zenity (GNOME)
        try:
            proc = await asyncio.create_subprocess_exec(
                "zenity", "--file-selection", "--directory", "--title=Select folder for FreeCode",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await proc.communicate()
            if proc.returncode == 0:
                return stdout.decode().strip()
        except FileNotFoundError:
            pass

        # 2. Try kdialog (KDE)
        try:
            proc = await asyncio.create_subprocess_exec(
                "kdialog", "--getexistingdirectory", ".", "--title", "Select folder for FreeCode",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await proc.communicate()
            if proc.returncode == 0:
                return stdout.decode().strip()
        except FileNotFoundError:
            pass

        return ""


class AgentSession:
    """Manages a single agent session with its own conversation history."""

    def __init__(self, session_id: str, working_dir: str = None, api_key: str = None):
        self.session_id = session_id
        self.agent = Agent(
            api_key=api_key or API_KEY,
            model=MODEL,
            working_dir=working_dir or WORKING_DIR,
            enable_thinking=THINKING,
        )
        self.active = False
        self.created_at = datetime.now()
        self.last_seen = datetime.now()

    async def process_input(self, user_input: str, effort: str = "MEDIUM", working_dir: str = ".", model: str = None):
        """Process user input and yield events, saving session to disk after each response."""
        self.active = True
        self.last_seen = datetime.now()
        if working_dir and working_dir != ".":
            _save_working_dir(working_dir)
        try:
            async for event in self.agent.process_input(user_input, effort=effort, working_dir=working_dir, model=model):
                yield event
            # Persist session history to project directory after response
            wdir = working_dir if working_dir and working_dir != "." else str(self.agent.state.working_dir)
            msgs = [{"role": m.role, "content": m.content} for m in self.agent.state.messages]
            name = next((m["content"][:40] for m in msgs if m["role"] == "user"), "Session")
            save_session_to_disk(self.session_id, wdir, name, msgs, model or MODEL)
        finally:
            self.active = False

    async def shutdown(self):
        """Cleanup session on exit."""
        logger.info(f"Shutting down session {self.session_id}...")
        # Add any necessary cleanup logic here if needed in the future


# Global sessions — keyed by session_id (UUID from client)
sessions: dict[str, AgentSession] = {}
MAX_SESSIONS = 20


def _get_or_create_session(session_id: str, working_dir: str = None) -> AgentSession:
    """Return existing session or create a new one. Evicts oldest if cap exceeded."""
    if session_id in sessions:
        sessions[session_id].last_seen = datetime.now()
        return sessions[session_id]

    if len(sessions) >= MAX_SESSIONS:
        oldest = min(sessions, key=lambda k: sessions[k].last_seen)
        logger.info(f"Evicting oldest session: {oldest}")
        del sessions[oldest]

    fresh_cfg = _load_config()
    fresh_api_key = fresh_cfg.get("api_key") or API_KEY
    session = AgentSession(session_id, working_dir=working_dir, api_key=fresh_api_key)
    # Restore history from disk if available
    if working_dir:
        saved = load_session_from_disk(working_dir, session_id)
        if saved and saved.get("messages"):
            from agent_core.state import Message
            session.agent.state.messages = [
                Message(role=m["role"], content=m["content"])
                for m in saved["messages"]
            ]
            logger.info(f"Restored {len(session.agent.state.messages)} messages for {session_id}")
    sessions[session_id] = session
    logger.info(f"Created session: {session_id} (total: {len(sessions)})")
    return session


async def handle_client(websocket):
    """Handle a single WebSocket client connection."""
    session_id = None
    session = None

    try:
        # Announce we're alive and provide recent dirs from config
        recents = []
        try:
            if _CONFIG_PATH.exists():
                cfg = json.loads(_CONFIG_PATH.read_text())
                recents = cfg.get("recent_dirs", [])
        except Exception:
            pass

        # Always provide the current root and frontend directories as convenient defaults
        cwd = os.getcwd()
        for default_dir in [cwd, os.path.join(cwd, "frontend")]:
            if default_dir not in recents:
                recents.append(default_dir)

        await websocket.send(json.dumps({
            "type": "hello", 
            "server": "freecode-backend",
            "recent_dirs": recents
        }))

        async for raw_message in websocket:
            try:
                data = json.loads(raw_message)

                # Handle lightweight messages before session creation
                if data.get("type") == "pick_folder":
                    path = await pick_directory_async()
                    await websocket.send(json.dumps({"type": "folder_picked", "path": path or ""}))
                    continue

                msg = ClientMessage.from_json(data)

                # Resolve session from client-provided session_id
                client_session_id = data.get("session_id") or "default"
                if session is None or session_id != client_session_id:
                    session_id = client_session_id
                    working_dir_hint = data.get("working_dir") or WORKING_DIR
                    session = _get_or_create_session(session_id, working_dir=working_dir_hint)

                    # Acknowledge session
                    await websocket.send(json.dumps({
                        "type": "session",
                        "session_id": session_id,
                        "messages": [{"role": m.role, "content": m.content} for m in session.agent.state.messages]
                    }))

                if msg.type == MessageType.USER_INPUT:
                    if not msg.text:
                        await send_error(websocket, "user_input requires 'text' field")
                        continue

                    # Internal init ping — just registers session + working dir, no response needed
                    if msg.text == "__init__":
                        logger.info(f"[{session_id}] Session initialized, working_dir={session.agent.state.working_dir}")
                        if data.get("api_key"):
                            _save_api_key(data["api_key"])
                            session.agent.client.api_key = data["api_key"]
                        continue

                    logger.info(f"[{session_id}] User input: {msg.text[:60]}...")

                    effort = msg.effort or "MEDIUM"
                    working_dir = msg.working_dir or str(session.agent.state.working_dir)
                    model = msg.model or MODEL
                    async for event in session.process_input(msg.text, effort=effort, working_dir=working_dir, model=model):
                        server_msg = _event_to_server_message(event)
                        await websocket.send(json.dumps(server_msg.to_json()))

                elif msg.type == MessageType.CANCEL:
                    if session and session.active:
                        logger.info(f"[{session_id}] Cancel requested")
                        await send_system(websocket, "Cancellation not yet implemented")

                elif msg.type == MessageType.PICK_FOLDER:
                    logger.info(f"[{session_id}] Settings folder picker requested")
                    path = await pick_directory_async()
                    await websocket.send(json.dumps({"type": "folder_picked", "path": path or ""}))

                elif msg.type == MessageType.PICK_DIR:
                    logger.info(f"[{session_id}] Directory picker requested")
                    path = await pick_directory_async()
                    if path and session:
                        session.agent.state.working_dir = Path(path).resolve()
                        _save_working_dir(path)
                        await send_system(websocket, f"Working directory: {path}")
                    else:
                        await send_system(websocket, "No folder selected")

                elif msg.type == MessageType.LIST_SESSIONS:
                    wdir = data.get("working_dir") or (str(session.agent.state.working_dir) if session else ".")
                    sess_list = list_sessions_from_disk(wdir)
                    await websocket.send(json.dumps({"type": "sessions_list", "sessions": sess_list, "working_dir": wdir}))

                elif msg.type == MessageType.PING:
                    await websocket.send(json.dumps(ServerMessage(type=MessageType.SYSTEM, message="pong").to_json()))

                else:
                    await send_error(websocket, f"Unknown message type: {msg.type}")

            except json.JSONDecodeError:
                await send_error(websocket, "Invalid JSON")
            except ValueError as e:
                await send_error(websocket, str(e))
            except Exception as e:
                logger.exception(f"Error processing message: {e}")
                await send_error(websocket, f"Internal error: {e}")

    except websockets.exceptions.ConnectionClosed:
        logger.info(f"[{session_id}] Client disconnected")
    except Exception as e:
        logger.exception(f"WebSocket error: {e}")


async def send_system(websocket, message: str):
    msg = ServerMessage(type=MessageType.SYSTEM, message=message)
    await websocket.send(json.dumps(msg.to_json()))


async def send_error(websocket, error: str):
    msg = ServerMessage(type=MessageType.ERROR, error=error)
    await websocket.send(json.dumps(msg.to_json()))


def _event_to_server_message(event: dict) -> ServerMessage:
    """Convert an agent event dict to a ServerMessage."""
    event_type = event.get("type")

    if event_type == "thinking":
        return ServerMessage(type=MessageType.THINKING, chunk=event.get("chunk"))
    elif event_type == "tool_call":
        return ServerMessage(type=MessageType.TOOL_CALL, tool_name=event.get("name"), tool_args=event.get("args"))
    elif event_type == "tool_result":
        return ServerMessage(type=MessageType.TOOL_RESULT, tool_name=event.get("name"), result=event.get("result"))
    elif event_type == "response":
        return ServerMessage(type=MessageType.RESPONSE, chunk=event.get("chunk"))
    elif event_type == "system":
        return ServerMessage(type=MessageType.SYSTEM, message=event.get("message"))
    elif event_type == "done":
        return ServerMessage(
            type=MessageType.DONE,
            context_pct=event.get("context_pct"),
            tokens_used=event.get("tokens_used"),
            token_limit=event.get("token_limit"),
        )
    elif event_type == "error":
        return ServerMessage(type=MessageType.ERROR, error=event.get("error"))
    else:
        return ServerMessage(type=MessageType.ERROR, error=f"Unknown event type: {event_type}")


async def main():
    """Start WebSocket server."""
    logger.info(f"Starting server on ws://{HOST}:{PORT}")
    logger.info(f"Model: {MODEL}, Thinking: {THINKING}, WorkingDir: {WORKING_DIR}")

    # Setup parent process monitor to avoid dangling server
    parent_pid = os.getppid()
    
    async def watch_parent():
        """Monitor parent process and exit if it dies."""
        logger.info(f"Monitoring parent process {parent_pid}...")
        while True:
            await asyncio.sleep(2)
            try:
                # On Windows/Unix, os.kill(pid, 0) checks if process exists
                os.kill(parent_pid, 0)
            except (OSError, ProcessLookupError, AttributeError):
                logger.info("Parent process gone, shutting down backend...")
                # Gracefully close all active sessions
                for session in sessions.values():
                    logger.info(f"Closing session {session.session_id}")
                # Use os._exit to bypass any hanging loops or blocked tasks
                os._exit(0)
            except Exception:
                pass

    # Start the server and the monitor
    bind_host = "127.0.0.1" if HOST == "localhost" else HOST
    
    server_task = websockets.serve(handle_client, bind_host, PORT)
    monitor_task = asyncio.create_task(watch_parent())

    async with server_task:
        logger.info(f"Server listening on {bind_host}:{PORT}")
        try:
            await asyncio.Future()  # Wait forever
        except asyncio.CancelledError:
            pass
        finally:
            monitor_task.cancel()



if __name__ == "__main__":
    asyncio.run(main())
