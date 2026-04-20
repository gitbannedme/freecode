"""Session state management."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from pathlib import Path
import json


@dataclass
class Message:
    role: str  # "user" | "model" | "tool"
    content: str
    tool_call: dict = None  # {name, args}
    tool_result: dict = None # {name, result}
    timestamp: float = field(default_factory=lambda: datetime.now().timestamp())


@dataclass
class Task:
    id: str
    type: str  # "tool_call" | "compaction" | "user_input"
    status: str  # "pending" | "running" | "completed" | "failed"
    data: dict = field(default_factory=dict)
    timestamp: float = field(default_factory=lambda: datetime.now().timestamp())


class SessionState:
    """Tracks conversation history, tasks, and working state."""

    def __init__(self, working_dir: str = ".", token_limit: int = 100000):
        self.working_dir = Path(working_dir).resolve()
        self.token_limit = token_limit
        self.messages: list[Message] = []
        self.tasks: list[Task] = []
        self.token_count = 0
        self.created_at = datetime.now().timestamp()
        self.file_modifications: dict[str, float] = {}  # path -> timestamp

    def add_message(self, role: str, content: str, tool_call: dict = None, tool_result: dict = None) -> Message:
        msg = Message(role=role, content=content, tool_call=tool_call, tool_result=tool_result)
        self.messages.append(msg)
        return msg

    def add_task(self, task_id: str, task_type: str, data: dict = None) -> Task:
        task = Task(id=task_id, type=task_type, status="pending", data=data or {})
        self.tasks.append(task)
        return task

    def update_task_status(self, task_id: str, status: str):
        for task in self.tasks:
            if task.id == task_id:
                task.status = status
                break

    def track_file_modification(self, path: str):
        """Track when a file was modified (for UI sync)."""
        self.file_modifications[str(Path(path).resolve())] = datetime.now().timestamp()

    def token_usage(self) -> tuple[int, int]:
        """Return (estimated_tokens_used, token_limit)."""
        total_chars = sum(len(m.content) for m in self.messages)
        estimated = total_chars // 4
        return estimated, self.token_limit

    def context_pct(self) -> float:
        used, limit = self.token_usage()
        return min(round(used / limit * 100, 1), 100.0) if limit else 0.0

    def should_compact(self) -> bool:
        """Check if context needs compaction (rough token estimate)."""
        if len(self.messages) < 10:
            return False
        used, limit = self.token_usage()
        return used > limit * 0.8


    def to_dict(self) -> dict:
        """Serialize state for API response."""
        return {
            "working_dir": str(self.working_dir),
            "token_limit": self.token_limit,
            "messages": [
                {
                    "role": m.role, 
                    "content": m.content, 
                    "tool_call": m.tool_call,
                    "tool_result": m.tool_result,
                    "timestamp": m.timestamp
                }
                for m in self.messages
            ],
            "tasks": [
                {
                    "id": t.id,
                    "type": t.type,
                    "status": t.status,
                    "data": t.data,
                    "timestamp": t.timestamp,
                }
                for t in self.tasks
            ],
            "file_modifications": self.file_modifications,
        }
