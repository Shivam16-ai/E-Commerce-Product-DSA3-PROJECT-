@echo off
echo Starting EntiMatch Dev Server...
echo.
echo [INFO] The ampersand (&) in this folder name breaks npm PATH resolution.
echo [INFO] Running via a safe path junction instead...
echo.

REM Create junction if it doesn't exist
IF NOT EXIST "C:\Users\st505\Desktop\entimatch" (
    mklink /J "C:\Users\st505\Desktop\entimatch" "%~dp0"
    echo [OK] Junction created at C:\Users\st505\Desktop\entimatch
)

REM Run dev server from junction path
cd /d "C:\Users\st505\Desktop\entimatch"
npm run dev
