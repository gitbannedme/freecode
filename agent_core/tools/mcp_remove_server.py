from agent_core.tools.base import BaseTool, ToolDefinition

class RemoveMcpServerTool(BaseTool):
    """Tool to remove an MCP server configuration and hot-reload."""
    
    def __init__(self, mcp_manager, tool_registry):
        self.mcp_manager = mcp_manager
        self.tool_registry = tool_registry

    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="remove_mcp_server",
            description="Remove an MCP server from the configuration and hot-reload to unregister its tools.",
            parameters={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "The unique identifier of the MCP server to remove (e.g. 'sqlite')"}
                },
                "required": ["name"]
            }
        )

    async def execute(self, **kwargs) -> str:
        name = kwargs.get("name")
        if not name:
            return "Error: name is required."
            
        success = await self.mcp_manager.remove_server(name, self.tool_registry)
        if success:
            return f"Successfully removed MCP server '{name}' and hot-reloaded tools."
        else:
            return f"Error: MCP server '{name}' not found in configuration."
