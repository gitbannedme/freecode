from pathlib import Path
from ..base import BaseTool, ToolDefinition


class FindFilesTool(BaseTool):
    """Find files matching a glob pattern."""

    def __init__(self, working_dir: str = "."):
        self.working_dir = Path(working_dir)

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="filesystem/find",
            description="Find files matching a glob pattern",
            parameters={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Starting directory"},
                    "pattern": {"type": "string", "description": "Glob pattern (e.g. '*.py')"},
                },
                "required": ["path", "pattern"],
            },
        )

    def _resolve_path(self, path: str) -> Path:
        p = Path(path)
        return p if p.is_absolute() else self.working_dir / p

    async def execute(self, **kwargs) -> str:
        path = self._resolve_path(kwargs["path"])
        pattern = kwargs["pattern"]

        if not path.exists():
            return f"Error: Path not found: {path}"

        if not path.is_dir():
            return f"Error: Not a directory: {path}"

        matches = sorted(
            str(match.relative_to(path)) for match in path.rglob(pattern)
        )

        if not matches:
            return "(no matches)"

        return "\n".join(matches)
