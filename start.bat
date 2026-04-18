@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ========================================
echo   FREECODE - Agentic Coding Assistant
echo ========================================
echo.

set FC_BACKEND_PORT=47820
set FC_FRONTEND_PORT=47821

python --version >nul 2>&1
if errorlevel 1 ( echo [ERROR] Python not found. & pause & exit /b 1 )
node --version >nul 2>&1
if errorlevel 1 ( echo [ERROR] Node.js not found. & pause & exit /b 1 )

if not exist node_modules (
    echo [setup] Installing root dependencies...
    call npm install --silent >nul 2>&1
)

set PYTHON_EXE=python
if exist venv\Scripts\python.exe set PYTHON_EXE=venv\Scripts\python.exe

if not exist venv (
    echo [setup] Creating Python virtual environment...
    python -m venv venv
    set PYTHON_EXE=venv\Scripts\python.exe
)
call venv\Scripts\activate.bat >nul 2>&1

:: Check if all critical dependencies are present
set MISSING_DEPS=0
%PYTHON_EXE% -c "import fastapi, uvicorn, websockets, mcp" >nul 2>&1
if errorlevel 1 set MISSING_DEPS=1

if !MISSING_DEPS!==1 (
    echo [setup] Installing/Updating Python dependencies...
    %PYTHON_EXE% -m pip install -q -r requirements.txt
)

if not exist frontend\node_modules (
    echo [setup] Installing Node dependencies...
    cd frontend && call npm install --silent >nul 2>&1 && cd ..
)

echo NEXT_PUBLIC_BACKEND_URL=ws://localhost:%FC_BACKEND_PORT%> frontend\.env.local
echo NEXT_PUBLIC_FRONTEND_PORT=%FC_FRONTEND_PORT%>> frontend\.env.local

if not exist logs mkdir logs
if not exist src-tauri\bin mkdir src-tauri\bin

set USE_TAURI=1

:: Check Cargo
cargo --version >nul 2>&1
if errorlevel 1 (
    echo [info] Rust not found. Using pywebview mode.
    set USE_TAURI=0
)

:: Try activating MSVC if link.exe is not in PATH
if %USE_TAURI%==1 (
    where link.exe >nul 2>&1
    if errorlevel 1 (
        set "VS_PATH="
        for /f "usebackq tokens=*" %%i in (`"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul`) do set "VS_PATH=%%i"
        if defined VS_PATH (
            set "VCVARS_PATH=!VS_PATH!\VC\Auxiliary\Build\vcvars64.bat"
            if exist "!VCVARS_PATH!" (
                echo [setup] Activating MSVC environment...
                call "!VCVARS_PATH!" >nul 2>&1
            )
        )
    )
)

:: Re-check link.exe
if %USE_TAURI%==1 (
    where link.exe >nul 2>&1
    if errorlevel 1 (
        echo [info] MSVC Tools not found. Using pywebview mode.
        set USE_TAURI=0
    )
)

:: Check SDK
if %USE_TAURI%==1 (
    set "SDK_ROOT="
    for /f "tokens=2*" %%i in ('reg query "HKLM\SOFTWARE\Microsoft\Windows Kits\Installed Roots" /v "KitsRoot10" 2^>nul') do set "SDK_ROOT=%%j"
    if not defined SDK_ROOT (
        for /f "tokens=2*" %%i in ('reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows Kits\Installed Roots" /v "KitsRoot10" 2^>nul') do set "SDK_ROOT=%%j"
    )

    set "SDK_FOUND=0"
    if defined SDK_ROOT (
        if exist "!SDK_ROOT!Lib" set SDK_FOUND=1
    )

    if "!SDK_FOUND!"=="0" (
        echo [info] Windows SDK not found. Using pywebview mode.
        set USE_TAURI=0
    )
)

:: Start App
if %USE_TAURI%==1 (
    set PREPARE_SIDECAR=0
    dir src-tauri\bin\server-* >nul 2>&1
    if errorlevel 1 set PREPARE_SIDECAR=1

    if "!PREPARE_SIDECAR!"=="0" (
        :: Rebuild if server source has changed since last build
        for /f %%h in ('python -c "import hashlib,pathlib; files=[pathlib.Path(p) for p in ['backend/server.py','agent_core/agent.py','agent_core/tools.py']]; data=b''.join(f.read_bytes() for f in files if f.exists()); print(hashlib.md5(data).hexdigest()[:8])"') do set SRC_HASH=%%h
        set HASH_FILE=src-tauri\bin\.sidecar_hash
        set STORED_HASH=
        if exist "!HASH_FILE!" set /p STORED_HASH=<"!HASH_FILE!"
        if not "!SRC_HASH!"=="!STORED_HASH!" set PREPARE_SIDECAR=1
    )

    if "!PREPARE_SIDECAR!"=="1" (
        echo [setup] Building Tauri sidecar binary...
        %PYTHON_EXE% scripts\prepare_sidecar.py
        for /f %%h in ('%PYTHON_EXE% -c "import hashlib,pathlib; files=[pathlib.Path(p) for p in [\"backend/server.py\",\"agent_core/agent.py\",\"agent_core/tools.py\"]]; data=b\"\".join(f.read_bytes() for f in files if f.exists()); print(hashlib.md5(data).hexdigest()[:8])"') do echo %%h>src-tauri\bin\.sidecar_hash
    )

    echo [2/5] Launching via Tauri...
    npx tauri dev
)

if %USE_TAURI%==0 (
    if not exist frontend\out (
        echo [1/5] Building Frontend for Production...
        cd frontend && call npm run build > ..\logs\build.log 2>&1 && cd ..
    ) else (
        echo [1/5] Production Frontend build found.
    )
    echo [2/5] Handing off to PowerShell for process management...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run_services.ps1" -BackendPort %FC_BACKEND_PORT% -FrontendPort %FC_FRONTEND_PORT%
)

echo.
exit
