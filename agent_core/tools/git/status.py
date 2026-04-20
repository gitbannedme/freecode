import asyncio
import subprocess
from ..base import BaseTool, ToolDefinition


class GitStatusTool(BaseTool):
    def __init__(self, working_dir: str = "."):
        self.working_dir = working_dir

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="git/status",
            description="Get the current git status",
            parameters={"type": "object", "properties": {}, "required": []},
        )

    async def execute(self, **kwargs) -> str:
        try:
            result = await asyncio.to_thread(
                subprocess.run,
                ["git", "status"],
                cwd=self.working_dir,
                capture_output=True,
                text=True,
                timeout=30,
            )
            return result.stdout if result.returncode == 0 else result.stderr or result.stdout
        except subprocess.TimeoutExpired:
            return "Error: git command timed out"
        except Exception as e:
            return f"Error: {e}"
