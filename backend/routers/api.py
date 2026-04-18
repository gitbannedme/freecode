from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.config import load_config, save_config, API_KEY, MODEL, WORKING_DIR, THINKING

router = APIRouter(prefix="/api")

@router.get("/health")
async def health():
    return {"status": "ok", "model": MODEL, "working_dir": WORKING_DIR}

@router.get("/config")
async def get_config():
    cfg = load_config()
    return {
        "api_key": cfg.get("api_key", ""),
        "model": cfg.get("model", MODEL),
        "working_dir": cfg.get("working_dir", WORKING_DIR),
        "recent_dirs": cfg.get("recent_dirs", []),
        "thinking": cfg.get("thinking", THINKING),
        "auto_compact": cfg.get("auto_compact", True),
        "compact_threshold": cfg.get("compact_threshold", 80),
    }

class ConfigUpdate(BaseModel):
    api_key: str | None = None
    model: str | None = None
    working_dir: str | None = None
    thinking: bool | None = None
    auto_compact: bool | None = None
    compact_threshold: int | None = None

@router.post("/config")
async def update_config(update: ConfigUpdate):
    try:
        cfg = load_config()
        if update.api_key is not None:
            cfg["api_key"] = update.api_key
            # Note: In a real production app, we'd use a more robust way 
            # to update global state or use a settings object.
            import backend.config
            backend.config.API_KEY = update.api_key
        if update.model is not None:
            cfg["model"] = update.model
        if update.working_dir is not None:
            cfg["working_dir"] = update.working_dir
        if update.thinking is not None:
            cfg["thinking"] = update.thinking
        if update.auto_compact is not None:
            cfg["auto_compact"] = update.auto_compact
        if update.compact_threshold is not None:
            cfg["compact_threshold"] = max(10, min(95, update.compact_threshold))
        save_config(cfg)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
