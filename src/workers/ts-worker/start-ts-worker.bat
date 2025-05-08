@echo off
echo Building and starting TypeScript worker...

REM Byt till den katalog där package.json faktiskt ligger
cd /d "%~dp0"

call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Build failed with error code %ERRORLEVEL%
    pause
    exit /b %ERRORLEVEL%
)

echo Build successful, starting worker...
call npm run start