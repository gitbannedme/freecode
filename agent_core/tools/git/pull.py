import asyncio
import subprocess
from ..base import BaseTool, ToolDefinition


class GitPullTool(BaseTool):
    def __init__(self, working_dir: str = "."):
        self.working_dir = working_dir

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="git/pull",
            description="Pull changes from remote repository",
            parameters={
                "type": "object",
                "properties": {
                    "remote": {"type": "string", "description": "Remote name", "default": "origin"},
                    "branch": {"type": "string", "description": "Branch name to pull"},
                },
                "required": [],
            },
        )

    async def execute(self, **kwargs) -> str:
        remote = kwargs.get("remote", "origin")
        branch = kwargs.get("branch")
        try:
            cmd = ["git", "pull", remote]
            if branch:
                cmd.append(branch)
            result = await asyncio.to_thread(
                subprocess.run, cmd, cwd=self.working_dir, capture_output=True, text=True, timeout=30
            )
            output = (result.stdout + result.stderr).strip()
            return output or ("Pull successful" if result.returncode == 0 else "Pull failed")
        except subprocess.TimeoutExpired:
            return "Error: git command timed out"
        except Exception as e:
            return f"Error: {e}"
