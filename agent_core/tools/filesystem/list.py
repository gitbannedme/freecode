from pathlib import Path
from ..base import BaseTool, ToolDefinition


class ListDirectoryTool(BaseTool):
    """List directory contents."""

    def __init__(self, working_dir: str = "."):
        self.working_dir = Path(working_dir)

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="filesystem/list",
            description="List directory contents",
            parameters={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path to list"}
                },
                "required": ["path"],
            },
        )

    def _resolve_path(self, path: str) -> Path:
        p = Path(path)
        return p if p.is_absolute() else self.working_dir / p

    async def execute(self, **kwargs) -> str:
        path = self._resolve_path(kwargs["path"])

        if not path.exists():
            return f"Error: Path not found: {path}"

        if not path.is_dir():
            return f"Error: Not a directory: {path}"

        entries = sorted([entry.name for entry in path.iterdir()])

        if not entries:
            return "(empty directory)"

        return "\n".join(entries)
