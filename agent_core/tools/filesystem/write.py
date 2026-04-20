from pathlib import Path
from ..base import BaseTool, ToolDefinition


class WriteFileTool(BaseTool):
    """Write content to a file, creating parent directories if needed."""

    def __init__(self, working_dir: str = "."):
        self.working_dir = Path(working_dir)

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="filesystem/write",
            description="Write content to a file",
            parameters={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path to write"},
                    "content": {"type": "string", "description": "Content to write"},
                },
                "required": ["path", "content"],
            },
        )

    def _resolve_path(self, path: str) -> Path:
        p = Path(path)
        return p if p.is_absolute() else self.working_dir / p

    async def execute(self, **kwargs) -> str:
        path = self._resolve_path(kwargs["path"])
        content = kwargs["content"]

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

        return f"Successfully wrote {len(content)} chars to {path}"
