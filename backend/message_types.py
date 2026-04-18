"""WebSocket message protocol types."""

from enum import Enum
from dataclasses import dataclass
from typing import Any, Optional


class MessageType(str, Enum):
    """Message types sent between client and server."""

    # Client → Server
    USER_INPUT = "user_input"
    CANCEL = "cancel"
    PING = "ping"
    PICK_DIR = "pick_dir"
    PICK_FOLDER = "pick_folder"
    LIST_SESSIONS = "list_sessions"

    # Server → Client
    THINKING = "thinking"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    RESPONSE = "response"
    SYSTEM = "system"
    CLEAR = "clear"
    DONE = "done"
    ERROR = "error"
    FOLDER_PICKED = "folder_picked"
    CONFIG_CHANGED = "config_changed"


@dataclass
class ClientMessage:
    type: MessageType
    text: Optional[str] = None
    session_id: Optional[str] = None
    effort: Optional[str] = None  # MINIMAL | LOW | MEDIUM | HIGH
    working_dir: Optional[str] = None
    model: Optional[str] = None
    context_files: Optional[list[str]] = None

    @classmethod
    def from_json(cls, data: dict) -> "ClientMessage":
        return cls(
            type=MessageType(data.get("type")),
            text=data.get("text"),
            session_id=data.get("session_id"),
            effort=data.get("effort"),
            working_dir=data.get("working_dir"),
            model=data.get("model"),
            context_files=data.get("context_files"),
        )


@dataclass
class ServerMessage:
    type: MessageType
    chunk: Optional[str] = None
    tool_name: Optional[str] = None
    tool_args: Optional[dict] = None
    result: Optional[str] = None
    error: Optional[str] = None
    message: Optional[str] = None
    timestamp: float = 0.0
    context_pct: Optional[float] = None
    tokens_used: Optional[int] = None
    token_limit: Optional[int] = None

    def to_json(self) -> dict:
        data = {"type": self.type.value}
        if self.chunk is not None:
            data["chunk"] = self.chunk
        if self.tool_name is not None:
            data["tool_name"] = self.tool_name
        if self.tool_args is not None:
            data["tool_args"] = self.tool_args
        if self.result is not None:
            data["result"] = self.result
        if self.error is not None:
            data["error"] = self.error
        if self.message is not None:
            data["message"] = self.message
        if self.timestamp:
            data["timestamp"] = self.timestamp
        if self.context_pct is not None:
            data["context_pct"] = self.context_pct
        if self.tokens_used is not None:
            data["tokens_used"] = self.tokens_used
        if self.token_limit is not None:
            data["token_limit"] = self.token_limit
        return data
