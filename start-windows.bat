@echo off
echo ============================================
echo   Starting Unlucid Mohini...
echo ============================================
echo.
echo A second window will open showing the app's logs - leave it open.
echo Your browser will open automatically in a few seconds.
echo.
echo The browser will warn "not secure" - this is expected for a
echo locally-generated certificate, click through it (Advanced -^>
echo Proceed). See the README for the phone-testing steps.
echo.

start "Unlucid Mohini Server (keep this open)" cmd /k "npm run dev:https"

timeout /t 6 >nul
start https://localhost:5173

echo.
echo If the browser didn't open by itself, go to https://localhost:5173
echo To stop the app, close the other window (or press Ctrl+C in it).
pause
