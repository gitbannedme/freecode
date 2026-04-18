import os
import sys
import asyncio
import logging
import subprocess
import time
from pathlib import Path

logger = logging.getLogger(__name__)

async def pick_directory_async():
    """Open a native folder picker dialog and return the path (30s timeout)."""
    try:
        return await asyncio.wait_for(_pick_directory_inner(), timeout=30)
    except asyncio.TimeoutError:
        logger.warning("Folder picker timed out after 30s")
        return ""
    except Exception as e:
        logger.error(f"Folder picker error: {e}")
        return ""

async def _pick_directory_inner() -> str:
    if os.name == "nt":
        ps_cmd = """
        $App = New-Object -ComObject Shell.Application
        $Folder = $App.BrowseForFolder(0, 'Select folder for FreeCode', 16 + 64, 0)
        if ($Folder) { $Folder.Self.Path }
        """
        try:
            proc = await asyncio.create_subprocess_exec(
                "powershell", "-NoProfile", "-Command", ps_cmd,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await proc.communicate()
            return stdout.decode().strip()
        except Exception as e:
            logger.error(f"Windows folder picker failed: {e}")
            return ""
    else:
        try:
            proc = await asyncio.create_subprocess_exec(
                "zenity", "--file-selection", "--directory", "--title=Select folder for FreeCode",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await proc.communicate()
            if proc.returncode == 0:
                return stdout.decode().strip()
        except FileNotFoundError:
            pass
        try:
            proc = await asyncio.create_subprocess_exec(
                "kdialog", "--getexistingdirectory", ".", "--title", "Select folder for FreeCode",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await proc.communicate()
            if proc.returncode == 0:
                return stdout.decode().strip()
        except FileNotFoundError:
            pass
        return ""

def free_port(port: int):
    """Kill any process on port before we try to bind it."""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(("127.0.0.1", port)) != 0:
            return  # nothing listening, we're good
    logger.info(f"Port {port} in use — killing existing process...")
    try:
        if os.name == "nt":
            result = subprocess.run(
                ["netstat", "-ano"], capture_output=True, text=True
            )
            for line in result.stdout.splitlines():
                if f":{port} " in line and "LISTENING" in line:
                    pid = line.strip().split()[-1]
                    subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)
                    logger.info(f"Killed PID {pid}")
        else:
            subprocess.run(f"fuser -k {port}/tcp", shell=True, capture_output=True)
    except Exception as e:
        logger.warning(f"free_port failed: {e}")
    time.sleep(0.5)

async def watch_parent(parent_pid: int, frontend_port: int, get_active_connections):
    """Monitor parent process and frontend port to trigger auto-shutdown."""
    parent_lost_at = None
    logger.info(f"Monitoring parent process {parent_pid} with 30s grace period...")
    
    while True:
        await asyncio.sleep(5)
        
        # 1. If we have active websocket connections, stay alive
        if get_active_connections() > 0:
            if parent_lost_at:
                logger.info("Connection received. Resetting shutdown timer.")
            parent_lost_at = None
            continue

        # 2. Check if the frontend port is listening
        frontend_up = False
        try:
            import socket
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.2)
                if s.connect_ex(("127.0.0.1", frontend_port)) == 0:
                    frontend_up = True
            if not frontend_up:
                with socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as s:
                    s.settimeout(0.2)
                    if s.connect_ex(("::1", frontend_port)) == 0:
                        frontend_up = True
        except:
            pass
        
        if not frontend_up and os.name == "nt":
            try:
                output = subprocess.check_output(["tasklist", "/FI", "IMAGENAME eq freecode.exe"], text=True)
                if "freecode.exe" in output.lower():
                    frontend_up = True
            except:
                pass

        if frontend_up:
            if parent_lost_at:
                logger.info("Frontend detected. Resetting shutdown timer.")
            parent_lost_at = None
            continue

        # 3. Check if parent process is alive
        parent_alive = True
        try:
            os.kill(parent_pid, 0)
        except (ProcessLookupError, PermissionError, OSError):
            parent_alive = False
        
        if parent_alive:
            parent_lost_at = None
            continue
        
        if parent_lost_at is None:
            parent_lost_at = asyncio.get_event_loop().time()
            logger.info("Parent/Frontend not reachable. Starting 30s shutdown timer...")
        
        elapsed = asyncio.get_event_loop().time() - parent_lost_at
        if elapsed > 30:
            logger.info(f"Orphaned for {int(elapsed)}s with no activity. Shutting down backend...")
            os._exit(0)
