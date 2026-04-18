import os
import subprocess
import sys
import shutil
from pathlib import Path

def main():
    root = Path(__file__).parent.parent.resolve()
    backend_dir = root / "backend"
    src_tauri_bin = root / "src-tauri" / "bin"
    
    # Name for the sidecar
    # Tauri expects: name-target_triple.exe
    # We'll just build it as 'server' first
    
    print("--- Preparing Sidecar ---")
    
    if not shutil.which("pyinstaller"):
        print("Installing pyinstaller...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)
        
    print(f"Building backend binary from {backend_dir / 'server.py'}...")
    
    # Build with PyInstaller from the ROOT
    # This ensures agent_core and backend packages are correctly discovered.
    os.chdir(root)
    
    subprocess.run([
        "pyinstaller",
        "--onefile",
        "--name", "server",
        "--clean",
        "--collect-all", "uvicorn",
        "--collect-all", "fastapi",
        "--collect-all", "websockets",
        "--collect-all", "google.genai",
        "--hidden-import", "websockets.legacy",
        "--hidden-import", "websockets.legacy.server",
        "--hidden-import", "websockets.legacy.client",
        "--hidden-import", "google.auth",
        "--hidden-import", "google.auth.transport.requests",
        str(backend_dir / "server.py")
    ], check=True)
    
    # Move to src-tauri/bin
    if not src_tauri_bin.exists():
        src_tauri_bin.mkdir(parents=True)
        
    dist_file = root / "dist" / "server.exe"
    if os.name != "nt":
        dist_file = root / "dist" / "server"
        
    # Get target triple for Tauri
    import platform
    machine = platform.machine().lower()
    if machine == "amd64": machine = "x86_64"
    if machine == "arm64": machine = "aarch64"
    
    system = platform.system().lower()
    if system == "windows":
        triple = f"{machine}-pc-windows-msvc"
    elif system == "darwin":
        triple = f"{machine}-apple-darwin"
    else:
        triple = f"{machine}-unknown-linux-gnu"
        
    target_bin = src_tauri_bin / f"server-{triple}{'.exe' if os.name == 'nt' else ''}"
    
    print(f"Moving binary to {target_bin}")
    if target_bin.exists():
        target_bin.chmod(0o755)
        target_bin.unlink()
    shutil.move(str(dist_file), str(target_bin))
    target_bin.chmod(0o755)

    print("\nSuccess! Sidecar binary is ready.")
    print("You can now run 'npm run tauri dev' from the root.")

if __name__ == "__main__":
    main()
