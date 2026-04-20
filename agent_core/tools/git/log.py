import asyncio
import subprocess
from ..base import BaseTool, ToolDefinition


class GitLogTool(BaseTool):
    def __init__(self, working_dir: str = "."):
        self.working_dir = working_dir

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="git/log",
            description="Show git commit log",
            parameters={
                "type": "object",
                "properties": {
                    "n": {"type": "integer", "description": "Number of commits to show (default 10, min 1)", "default": 10},
                    "oneline": {"type": "boolean", "description": "Show in oneline format", "default": True},
                },
                "required": [],
            },
        )

    async def execute(self, **kwargs) -> str:
        n = max(1, kwargs.get("n", 10))
        oneline = kwargs.get("oneline", True)
        try:
            cmd = ["git", "log", "-n", str(n)]
            if oneline:
                cmd.append("--oneline")
            result = await asyncio.to_thread(
                subprocess.run, cmd, cwd=self.working_dir, capture_output=True, text=True, timeout=30
            )
            return result.stdout if result.returncode == 0 else result.stderr or result.stdout
        except subprocess.TimeoutExpired:
            return "Error: git command timed out"
        except Exception as e:
            return f"Error: {e}"
