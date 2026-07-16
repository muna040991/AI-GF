@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   Unlucid Mohini - First-time setup
echo ============================================
echo.

REM --- Check Node.js / npm ---
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js does not seem to be installed.
    echo Install it from https://nodejs.org (the LTS version), then run this again.
    pause
    exit /b 1
)
echo [OK] Node.js found.
echo.

REM --- Check Ollama ---
where ollama >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Ollama does not seem to be installed.
    echo Install it from https://ollama.com, then run this again.
    pause
    exit /b 1
)
echo [OK] Ollama found.
echo.

REM --- Pull the chat model ---
echo Downloading the chat model (dolphin-mistral, about 4 GB).
echo This can take a while depending on your internet speed - please be patient.
echo.
call ollama pull dolphin-mistral
if errorlevel 1 (
    echo [ERROR] Could not download dolphin-mistral. Check your internet connection and try again.
    pause
    exit /b 1
)
echo.

REM --- Pull the embedding model (used for long-term memory) ---
echo Downloading the memory model (nomic-embed-text, under 1 GB).
echo.
call ollama pull nomic-embed-text
if errorlevel 1 (
    echo [WARNING] Could not download nomic-embed-text.
    echo Long-term memory will be skipped, but everything else will still work.
)
echo.

REM --- Install app dependencies ---
echo Installing the app itself...
echo.
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed. Scroll up to see what went wrong.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Setup complete!
echo   Double-click start-windows.bat to launch the app.
echo ============================================
pause
