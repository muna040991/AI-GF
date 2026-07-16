@echo off
setlocal enabledelayedexpansion
echo ============================================
echo   Starting Unlucid Mohini (phone-testing mode)
echo ============================================
echo.

if not exist "node_modules" (
    echo [ERROR] Setup hasn't been run yet ^(or didn't finish^).
    echo Please double-click setup-windows.bat first, wait for it to say
    echo "Setup complete!", then run this again.
    pause
    exit /b 1
)

echo This mode turns on HTTPS so voice input also works from your phone.
echo Your phone must be on the SAME WIFI NETWORK as this computer.
echo.

set "PHONE_IP="
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    if not defined PHONE_IP (
        set "PHONE_IP=%%A"
    )
)
set "PHONE_IP=%PHONE_IP: =%"

if not defined PHONE_IP (
    echo [WARNING] Could not automatically find this computer's network
    echo address. Run "ipconfig" in a command window and look for
    echo "IPv4 Address" yourself - see the README for details.
) else (
    echo Your computer's network address looks like: !PHONE_IP!
)
echo.

start "Unlucid Mohini Server (keep this open)" cmd /k "npm run dev:https"

echo Waiting for the app to finish starting...
set /a attempts=0

:waitloop
set /a attempts+=1
curl -sk -o nul https://localhost:5173
if not errorlevel 1 goto ready
if %attempts% geq 40 goto slowstart
timeout /t 1 >nul
goto waitloop

:ready
start https://localhost:5173
echo.
echo Opened https://localhost:5173 on this computer.
if defined PHONE_IP (
    echo.
    echo On your PHONE's browser, go to:
    echo.
    echo     https://!PHONE_IP!:5173
    echo.
)
echo Your phone's browser will warn "not secure" - this is expected for a
echo locally-generated certificate. Tap Advanced -^> Proceed ^(Android
echo Chrome^) or Show Details -^> visit this website ^(iPhone Safari^).
goto end

:slowstart
echo.
echo The app is taking longer than usual to start.
echo Look at the other window titled "Unlucid Mohini Server (keep this
echo open)" - if it shows an error, that's the real problem to fix.
echo Once it says "ready", open https://localhost:5173 yourself, and
if defined PHONE_IP echo https://!PHONE_IP!:5173 on your phone.

:end
echo.
echo To stop the app, close the other window (or press Ctrl+C in it).
pause
