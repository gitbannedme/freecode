const BACKEND_HTTP = (process.env.NEXT_PUBLIC_BACKEND_URL || "ws://127.0.0.1:47820").replace(/^ws/, "http");

export interface McpServer {
  name: string;
  type: string;
  command: string;
  args: string[];
}

export async function getMcpServers(sessionId: string = "default"): Promise<Record<string, McpServer>> {
  try {
    const response = await fetch(`${BACKEND_HTTP}/api/mcp/servers?session_id=${sessionId}`);
    if (!response.ok) return {};
    const data = await response.json();
    return data.servers || {};
  } catch (err) {
    console.error("Failed to fetch MCP servers:", err);
    return {};
  }
}

export async function addMcpServer(name: string, server: Omit<McpServer, "name">, sessionId: string = "default"): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_HTTP}/api/mcp/servers/${name}?session_id=${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(server),
    });
    return response.ok;
  } catch (err) {
    console.error("Failed to add MCP server:", err);
    return false;
  }
}

export async function removeMcpServer(name: string, sessionId: string = "default"): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_HTTP}/api/mcp/servers/${name}?session_id=${sessionId}`, {
      method: "DELETE",
    });
    return response.ok;
  } catch (err) {
    console.error("Failed to remove MCP server:", err);
    return false;
  }
}
