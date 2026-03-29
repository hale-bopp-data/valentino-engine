@echo off
REM =============================================================================
REM Valentino Cockpit — Launcher (Windows)
REM Il Sarto Parla + Il Sarto Copia
REM
REM Usage:
REM   cockpit.bat                           Launch with default example page
REM   cockpit.bat my-page.json              Launch with custom page spec
REM   cockpit.bat my-page.json 4000         Custom port
REM   set OPENROUTER_API_KEY=sk-or-... && cockpit.bat   With LLM enabled
REM =============================================================================

setlocal

set SCRIPT_DIR=%~dp0
set SPEC=%1
set PORT=%2

if "%SPEC%"=="" set SPEC=%SCRIPT_DIR%examples\minimal-site\pages\home.json
if "%PORT%"=="" set PORT=3781

REM Check Node
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   Error: Node.js not found. Install Node 20+ from https://nodejs.org
    exit /b 1
)

REM Check spec file
if not exist "%SPEC%" (
    echo   Error: Page spec not found: %SPEC%
    echo.
    echo   Usage: cockpit.bat [spec.json] [port]
    exit /b 1
)

REM LLM status
if defined OPENROUTER_API_KEY (
    echo   LLM: OpenRouter key detected
) else (
    echo   LLM: not configured (set OPENROUTER_API_KEY for smart parsing)
)

echo.

cd /d "%SCRIPT_DIR%"
npx tsx src/cockpit-server.ts "%SPEC%" --port %PORT%
