import asyncio
import subprocess
from ..base import BaseTool, ToolDefinition


class GitAddTool(BaseTool):
    def __init__(self, working_dir: str = "."):
        self.working_dir = working_dir

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="git/add",
            description="Stage files for commit",
            parameters={
                "type": "object",
                "properties": {
                    "paths": {"type": "array", "items": {"type": "string"}, "description": "Files or directories to stage"},
                },
                "required": ["paths"],
            },
        )

    async def execute(self, **kwargs) -> str:
        paths = kwargs.get("paths", [])
        try:
            result = await asyncio.to_thread(
                subprocess.run, ["git", "add"] + paths, cwd=self.working_dir, capture_output=True, text=True, timeout=30
            )
            return result.stdout or "Files staged successfully" if result.returncode == 0 else result.stderr or result.stdout
        except subprocess.TimeoutExpired:
            return "Error: git command timed out"
        except Exception as e:
            return f"Error: {e}"
