import asyncio
import subprocess
from ..base import BaseTool, ToolDefinition


class GitBranchTool(BaseTool):
    def __init__(self, working_dir: str = "."):
        self.working_dir = working_dir

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="git/branch",
            description="Create, delete, or list git branches",
            parameters={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Branch name to create"},
                    "delete": {"type": "string", "description": "Branch name to delete"},
                },
                "required": [],
            },
        )

    async def execute(self, **kwargs) -> str:
        name = kwargs.get("name")
        delete = kwargs.get("delete")
        try:
            cmd = ["git", "branch"]
            if delete:
                cmd.extend(["-d", delete])
            elif name:
                cmd.append(name)
            result = await asyncio.to_thread(
                subprocess.run, cmd, cwd=self.working_dir, capture_output=True, text=True, timeout=30
            )
            return result.stdout if result.returncode == 0 else result.stderr or result.stdout
        except subprocess.TimeoutExpired:
            return "Error: git command timed out"
        except Exception as e:
            return f"Error: {e}"
