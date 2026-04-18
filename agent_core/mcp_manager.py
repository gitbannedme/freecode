"""Manager for MCP servers."""
import json
import asyncio
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.client.sse import sse_client
from typing import Dict, Any, Optional, List
from contextlib import AsyncExitStack
from agent_core.tools.base import BaseTool, ToolDefinition

class McpToolWrapper(BaseTool):
    """Wrapper to expose an MCP tool as a BaseTool."""
    def __init__(self, name: str, description: str, parameters: dict, session: ClientSession):
        self._name = name
        self._description = description
        self._parameters = parameters
        self.session = session

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(self._name, self._description, self._parameters)

    async def execute(self, **kwargs) -> str:
        result = await self.session.call_tool(self._name, arguments=kwargs)
        return str(result)

class McpManager:
    def __init__(self, config_path: str = ".freecode/mcp_servers.json"):
        self.config_path = Path(config_path)
        self.exit_stack = AsyncExitStack()
        self.sessions: Dict[str, ClientSession] = {}
        self.registered_tool_names: List[str] = []

    def load_config(self):
        if not self.config_path.exists():
            return {"servers": {}}
        try:
            with open(self.config_path, "r") as f:
                return json.load(f)
        except Exception:
            return {"servers": {}}

    def list_servers(self):
        return self.load_config().get("servers", {})

    def save_config(self, config):
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, "w") as f:
            json.dump(config, f, indent=2)

    async def add_server(self, name: str, params: dict, tool_registry):
        config = self.load_config()
        if "servers" not in config:
            config["servers"] = {}
        config["servers"][name] = params
        self.save_config(config)
        await self.reload_all(tool_registry)

    async def remove_server(self, name: str, tool_registry):
        config = self.load_config()
        if "servers" in config and name in config["servers"]:
            del config["servers"][name]
            self.save_config(config)
            await self.reload_all(tool_registry)
            return True
        return False

    async def connect_all(self, tool_registry):
        config = self.load_config()
        for name, params in config.get("servers", {}).items():
            try:
                if params["type"] == "stdio":
                    server_params = StdioServerParameters(command=params["command"], args=params.get("args", []))
                    stdio_transport = await self.exit_stack.enter_async_context(stdio_client(server_params))
                    read, write = stdio_transport
                elif params["type"] == "sse":
                    # SSE support would go here
                    continue
                else:
                    continue

                session = await self.exit_stack.enter_async_context(ClientSession(read, write))
                await session.initialize()
                self.sessions[name] = session
                
                # List and register tools
                tools = await session.list_tools()
                for tool in tools.tools:
                    wrapper = McpToolWrapper(tool.name, tool.description or "", tool.inputSchema or {}, session)
                    tool_registry.register(wrapper)
                    self.registered_tool_names.append(tool.name)
            except Exception as e:
                print(f"Failed to connect to MCP server {name}: {e}")

    async def reload_all(self, tool_registry):
        for name in self.registered_tool_names:
            tool_registry.unregister(name)
        self.registered_tool_names = []
        await self.close()
        self.exit_stack = AsyncExitStack()
        self.sessions.clear()
        await self.connect_all(tool_registry)

    async def close(self):
        await self.exit_stack.aclose()
