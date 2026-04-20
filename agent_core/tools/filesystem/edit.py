from pathlib import Path
from ..base import BaseTool, ToolDefinition


class EditFileTool(BaseTool):
    """Edit file by replacing old_string with new_string."""

    def __init__(self, working_dir: str = "."):
        self.working_dir = Path(working_dir)

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="filesystem/edit",
            description="Edit file by replacing old_string with new_string",
            parameters={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path to edit"},
                    "old_string": {"type": "string", "description": "String to find"},
                    "new_string": {"type": "string", "description": "Replacement string"},
                },
                "required": ["path", "old_string", "new_string"],
            },
        )

    def _resolve_path(self, path: str) -> Path:
        p = Path(path)
        return p if p.is_absolute() else self.working_dir / p

    async def execute(self, **kwargs) -> str:
        path = self._resolve_path(kwargs["path"])
        old_string = kwargs["old_string"]
        new_string = kwargs["new_string"]

        if not path.exists():
            return f"Error: File not found: {path}"

        if not path.is_file():
            return f"Error: Not a file: {path}"

        content = path.read_text(encoding="utf-8")
        count = content.count(old_string)

        if count == 0:
            return f"Error: old_string not found in {path}"

        if count > 1:
            return f"Error: old_string appears {count} times in {path}, expected 1"

        new_content = content.replace(old_string, new_string)
        path.write_text(new_content, encoding="utf-8")

        return f"Successfully edited {path}"
