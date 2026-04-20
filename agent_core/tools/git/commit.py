import asyncio
import subprocess
from ..base import BaseTool, ToolDefinition


class GitCommitTool(BaseTool):
    def __init__(self, working_dir: str = "."):
        self.working_dir = working_dir

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="git/commit",
            description="Create a commit with a message",
            parameters={
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "Commit message"},
                },
                "required": ["message"],
            },
        )

    async def execute(self, **kwargs) -> str:
        message = kwargs.get("message", "")
        try:
            result = await asyncio.to_thread(
                subprocess.run,
                ["git", "commit", "-m", message],
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
