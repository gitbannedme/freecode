import os
import sys
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

ROOT = Path(__file__).parent.parent

def get_config_path() -> Path:
    if os.name == "nt":
        base = Path(os.environ.get("APPDATA", "~")).resolve()
    else:
        base = Path("~/.config").expanduser().resolve()
    config_dir = base / "FreeCode"
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir / "freecode.json"

CONFIG_PATH = get_config_path()

def get_version() -> str:
    """Read version from tauri.conf.json, fallback to package.json, then '0.0.0'."""
    for candidate in [
        ROOT / "src-tauri" / "tauri.conf.json",
        ROOT / "package.json",
    ]:
        try:
            if candidate.exists():
                return json.loads(candidate.read_text()).get("version", "0.0.0")
        except Exception:
            pass
    return "0.0.0"

def load_config() -> dict:
    try:
        if CONFIG_PATH.exists():
            return json.loads(CONFIG_PATH.read_text())
    except Exception:
        pass
    return {}

def save_config(cfg: dict):
    try:
        CONFIG_PATH.write_text(json.dumps(cfg, indent=2))
    except Exception as e:
        logger.warning(f"Could not save config to {CONFIG_PATH}: {e}")

_cfg = load_config()

# Global configuration defaults
API_KEY = _cfg.get("api_key")
MODEL = _cfg.get("model", "gemma-4-26b-a4b-it")
THINKING = _cfg.get("thinking", True)

def get_default_working_dir() -> str:
    if getattr(sys, "frozen", False):
        return str(Path(sys.executable).parent)
    return _cfg.get("working_dir", ".")

WORKING_DIR = _cfg.get("working_dir") or get_default_working_dir()
PORT = int(os.environ.get("FC_BACKEND_PORT") or _cfg.get("backend_port", 47820))
HOST = os.environ.get("FC_BACKEND_HOST") or _cfg.get("backend_host", "localhost")
FRONTEND_PORT = int(os.environ.get("FC_FRONTEND_PORT") or _cfg.get("frontend_port", 47821))

VERSION = get_version()
