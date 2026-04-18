import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.sessions import sessions, get_or_create_session
from backend.config import WORKING_DIR

router = APIRouter(prefix="/api/mcp")

class McpServerParams(BaseModel):
    type: str = "stdio"
    command: str
    args: list[str] = []

@router.get("/servers")
async def get_mcp_servers(session_id: str = "default"):
    session = sessions.get(session_id)
    if session:
        return {"servers": session.agent.mcp_manager.list_servers()}
    
    try:
        from agent_core.mcp_manager import McpManager
        m = McpManager(config_path=os.path.join(WORKING_DIR, ".freecode", "mcp_servers.json"))
        return {"servers": m.list_servers()}
    except Exception as e:
        return {"servers": {}, "error": str(e)}

@router.post("/servers/{name}")
async def add_mcp_server(name: str, params: McpServerParams, session_id: str = "default"):
    session = get_or_create_session(session_id)
    try:
        await session.agent.mcp_manager.add_server(name, params.dict(), session.agent.tools)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/servers/{name}")
async def remove_mcp_server(name: str, session_id: str = "default"):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        success = await session.agent.mcp_manager.remove_server(name, session.agent.tools)
        if success:
            return {"status": "ok"}
        else:
            raise HTTPException(status_code=404, detail=f"Server {name} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
