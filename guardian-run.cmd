@echo off
REM Self-healing guardian: checks master loop + dashboard every 10 min forever.
REM Started from Startup folder (survives reboot); revives loop after sleep/crash.
:loop
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\ccode\discover-analyzer\guardian.ps1"
timeout /t 600 /nobreak >nul
goto loop
