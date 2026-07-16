@echo off
echo ============================================
echo   Starting Unlucid Mohini...
echo ============================================
echo.

if not exist "node_modules" (
    echo [ERROR] Setup hasn't been run yet ^(or didn't finish^).
    echo Please double-click setup-windows.bat first, wait for it to say
    echo "Setup complete!", then run this again.
    pause
    exit /b 1
)

echo A second window will open showing the app's logs - leave it open
echo while you use the app. This window will open your browser
echo automatically once the app is actually ready (this can take a
echo little while the first time).
echo.

start "Unlucid Mohini Server (keep this open)" cmd /k "npm run dev"

echo Waiting for the app to finish starting...
set /a attempts=0

:waitloop
set /a attempts+=1
curl -s -o nul http://localhost:5173
if not errorlevel 1 goto ready
if %attempts% geq 40 goto slowstart
timeout /t 1 >nul
goto waitloop

:ready
start http://localhost:5173
echo.
echo Opened http://localhost:5173 in your browser.
goto end

:slowstart
echo.
echo The app is taking longer than usual to start.
echo Look at the other window titled "Unlucid Mohini Server (keep this
echo open)" - if it shows an error, that's the real problem to fix.
echo Once it says "ready", open http://localhost:5173 yourself.

:end
echo.
echo Want to try it from your phone too? See the README's "Testing on
echo your phone" section - it needs one extra step (a different script).
echo.
echo To stop the app, close the other window (or press Ctrl+C in it).
pause
