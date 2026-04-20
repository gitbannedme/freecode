import asyncio
import subprocess
from ..base import BaseTool, ToolDefinition


class GitDiffTool(BaseTool):
    def __init__(self, working_dir: str = "."):
        self.working_dir = working_dir

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="git/diff",
            description="Show git diff with optional staging filter and path",
            parameters={
                "type": "object",
                "properties": {
                    "staged": {"type": "boolean", "description": "Show only staged changes", "default": False},
                    "path": {"type": "string", "description": "Specific file or directory path"},
                },
                "required": [],
            },
        )

    async def execute(self, **kwargs) -> str:
        staged = kwargs.get("staged", False)
        path = kwargs.get("path")
        try:
            cmd = ["git", "diff"]
            if staged:
                cmd.append("--staged")
            if path:
                cmd.append(path)
            result = await asyncio.to_thread(
                subprocess.run, cmd, cwd=self.working_dir, capture_output=True, text=True, timeout=30
            )
            return result.stdout if result.returncode == 0 else result.stderr or result.stdout
        except subprocess.TimeoutExpired:
            return "Error: git command timed out"
        except Exception as e:
            return f"Error: {e}"
