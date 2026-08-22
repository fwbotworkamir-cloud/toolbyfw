@echo off
REM Refresh the live team dashboard: re-export frozen data, redeploy to CF Pages.
REM Live URL stays https://fw-discover-dash.pages.dev
cd /d "%~dp0"
node src\cli.js export-static || goto :err
call npx wrangler pages deploy web-dash --project-name=fw-discover-dash --commit-dirty=true || goto :err
echo.
echo   Dashboard refreshed: https://fw-discover-dash.pages.dev
goto :eof
:err
echo.
echo   REFRESH FAILED - see error above
exit /b 1
