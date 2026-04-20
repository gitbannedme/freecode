from pathlib import Path
from ..base import BaseTool, ToolDefinition


class ReadFileTool(BaseTool):
    """Read file contents with line numbers."""

    def __init__(self, working_dir: str = "."):
        self.working_dir = Path(working_dir)

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="filesystem/read",
            description="Read file contents with line numbers",
            parameters={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path to read"}
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
            return f"Error: File not found: {path}"

        if not path.is_file():
            return f"Error: Not a file: {path}"

        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            return f"Error: Cannot read binary file: {path}"

        lines = content.split("\n")
        result = "\n".join(
            f"{i+1:4d} | {line}" for i, line in enumerate(lines)
        )
        return result
