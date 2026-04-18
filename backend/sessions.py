import logging
import json
from pathlib import Path
from datetime import datetime
from agent_core import Agent
from agent_core.state import Message
from backend.config import API_KEY, MODEL, WORKING_DIR, THINKING, load_config, save_config

logger = logging.getLogger(__name__)

def sessions_dir(working_dir: str) -> Path:
    return Path(working_dir).resolve() / ".freecode" / "sessions"

def session_path(working_dir: str, session_id: str) -> Path:
    return sessions_dir(working_dir) / f"{session_id}.json"

def save_session_to_disk(session_id: str, working_dir: str, name: str, messages: list, model: str):
    try:
        d = sessions_dir(working_dir)
        d.mkdir(parents=True, exist_ok=True)
        path = d / f"{session_id}.json"
        existing = {}
        if path.exists():
            try:
                existing = json.loads(path.read_text())
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
        path.write_text(json.dumps(existing, indent=2))
    except Exception as e:
        logger.warning(f"Could not save session {session_id}: {e}")

def load_session_from_disk(working_dir: str, session_id: str) -> dict | None:
    try:
        path = session_path(working_dir, session_id)
        if path.exists():
            return json.loads(path.read_text())
    except Exception as e:
        logger.warning(f"Could not load session {session_id}: {e}")
    return None

def list_sessions_from_disk(working_dir: str) -> list:
    try:
        d = sessions_dir(working_dir)
        if not d.exists():
            return []
        sessions_list = []
        for f in sorted(d.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            try:
                data = json.loads(f.read_text())
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

def save_working_dir(path: str):
    try:
        abs_path = str(Path(path).resolve())
        cfg = load_config()
        recents = [abs_path] + [d for d in cfg.get("recent_dirs", []) if d != abs_path]
        cfg["working_dir"] = abs_path
        cfg["recent_dirs"] = recents[:5]
        save_config(cfg)
    except Exception as e:
        logger.warning(f"Could not save working_dir: {e}")

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
        self.active = True
        self.last_seen = datetime.now()
        if working_dir and working_dir != ".":
            save_working_dir(working_dir)
        try:
            async for event in self.agent.process_input(user_input, effort=effort, working_dir=working_dir, model=model):
                yield event
            wdir = working_dir if working_dir and working_dir != "." else str(self.agent.state.working_dir)
            msgs = [{"role": m.role, "content": m.content} for m in self.agent.state.messages]
            name = next((m["content"][:40] for m in msgs if m["role"] == "user"), "Session")
            save_session_to_disk(self.session_id, wdir, name, msgs, model or MODEL)
        finally:
            self.active = False

# Global sessions storage
sessions: dict[str, AgentSession] = {}
MAX_SESSIONS = 20

def get_or_create_session(session_id: str, working_dir: str = None, api_key: str = None) -> AgentSession:
    if session_id in sessions:
        s = sessions[session_id]
        s.last_seen = datetime.now()
        if api_key and api_key != getattr(s.agent.client, "_api_key", None):
            s.agent.update_api_key(api_key)
        return s

    if len(sessions) >= MAX_SESSIONS:
        oldest = min(sessions, key=lambda k: sessions[k].last_seen)
        logger.info(f"Evicting oldest session: {oldest}")
        del sessions[oldest]

    fresh_cfg = load_config()
    resolved_key = api_key or fresh_cfg.get("api_key") or API_KEY
    session = AgentSession(session_id, working_dir=working_dir, api_key=resolved_key)
    if working_dir:
        saved = load_session_from_disk(working_dir, session_id)
        if saved and saved.get("messages"):
            session.agent.state.messages = [
                Message(role=m["role"], content=m["content"])
                for m in saved["messages"]
            ]
            logger.info(f"Restored {len(session.agent.state.messages)} messages for {session_id}")
    sessions[session_id] = session
    logger.info(f"Created session: {session_id} (total: {len(sessions)})")
    return session
