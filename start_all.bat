@echo off
title Zylo Chat Launcher
echo ========================================================
echo         Starting Zylo Chat (Backend & Frontend)
echo ========================================================
echo.
echo Starting FastAPI Backend on http://localhost:8000 ...
start "Zylo Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --reload --port 8000"

echo Starting Vite Frontend on http://localhost:5173 ...
start "Zylo Frontend (Vite)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo [OK] Both servers launched in separate windows!
