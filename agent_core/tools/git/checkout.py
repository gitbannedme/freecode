import asyncio
import subprocess
from ..base import BaseTool, ToolDefinition


class GitCheckoutTool(BaseTool):
    def __init__(self, working_dir: str = "."):
        self.working_dir = working_dir

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="git/checkout",
            description="Checkout a branch or create and checkout a new branch",
            parameters={
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "Branch or commit to checkout"},
                    "create": {"type": "boolean", "description": "Create new branch", "default": False},
                },
                "required": ["target"],
            },
        )

    async def execute(self, **kwargs) -> str:
        target = kwargs.get("target", "")
        create = kwargs.get("create", False)
        try:
            cmd = ["git", "checkout"]
            if create:
                cmd.append("-b")
            cmd.append(target)
            result = await asyncio.to_thread(
                subprocess.run, cmd, cwd=self.working_dir, capture_output=True, text=True, timeout=30
            )
            return result.stdout if result.returncode == 0 else result.stderr or result.stdout
        except subprocess.TimeoutExpired:
            return "Error: git command timed out"
        except Exception as e:
            return f"Error: {e}"
