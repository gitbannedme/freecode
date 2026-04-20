import asyncio
import subprocess
from ..base import BaseTool, ToolDefinition


class RunCommandTool(BaseTool):
    def __init__(self, working_dir: str = "."):
        self.working_dir = working_dir

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="shell/run",
            description="Execute a shell command and capture its output",
            parameters={
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Shell command to execute"},
                },
                "required": ["command"],
            },
        )

    async def execute(self, **kwargs) -> str:
        command = kwargs.get("command", "")
        try:
            result = await asyncio.to_thread(
                subprocess.run, command, shell=True, capture_output=True, text=True,
                timeout=30, cwd=self.working_dir
            )
            stdout = result.stdout.strip()
            stderr = result.stderr.strip()
            if not stdout and not stderr:
                return "Command executed (no output)"
            parts = []
            if stdout:
                parts.append(f"Stdout:\n{stdout}")
            if stderr:
                parts.append(f"Stderr:\n{stderr}")
            return "\n".join(parts)
        except subprocess.TimeoutExpired:
            return "Error: Command timed out (30s)"
        except Exception as e:
            return f"Error: {e}"
