import errno
from pathlib import Path
from ..base import BaseTool, ToolDefinition


class DeleteFileTool(BaseTool):
    def __init__(self, working_dir: str = "."):
        self.working_dir = Path(working_dir)

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="filesystem/delete",
            description="Delete a file or empty directory",
            parameters={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Path to delete"}
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

        try:
            if path.is_file():
                path.unlink()
            elif path.is_dir():
                path.rmdir()
            else:
                return f"Error: Unknown path type: {path}"
        except OSError as e:
            if e.errno == errno.ENOTEMPTY:
                return f"Error: Directory not empty: {path}"
            return f"Error: Cannot delete {path}: {e}"

        return f"Successfully deleted {path}"
