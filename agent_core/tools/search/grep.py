import re
import fnmatch
from pathlib import Path
from ..base import BaseTool, ToolDefinition


class GrepSearchTool(BaseTool):
    def __init__(self, working_dir: str = "."):
        self.working_dir = Path(working_dir)

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="search/grep",
            description="Search for a regex pattern in files",
            parameters={
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Regular expression pattern"},
                    "path": {"type": "string", "description": "Path to search in (default: working dir)"},
                    "glob": {"type": "string", "description": "File filter (e.g. '*.py')"},
                },
                "required": ["pattern"],
            },
        )

    async def execute(self, **kwargs) -> str:
        pattern = kwargs.get("pattern", "")
        path = kwargs.get("path", ".")
        glob = kwargs.get("glob")

        search_path = (self.working_dir / path).resolve()
        if not search_path.exists():
            return "(no matches)"

        try:
            regex = re.compile(pattern)
        except re.error as e:
            return f"Error: Invalid regex pattern: {e}"

        files = [search_path] if search_path.is_file() else list(search_path.rglob("*"))
        matches = []

        for file_path in files:
            if not file_path.is_file():
                continue
            if glob and not fnmatch.fnmatch(file_path.name, glob):
                continue
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    for line_num, line in enumerate(f, 1):
                        if regex.search(line):
                            try:
                                rel = file_path.relative_to(self.working_dir)
                            except ValueError:
                                rel = file_path
                            matches.append(f"{rel}:{line_num}: {line.rstrip()}")
            except UnicodeDecodeError:
                continue

        return "\n".join(matches) if matches else "(no matches)"
