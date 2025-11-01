@echo off
REM Start AI Code Review Backend
REM This script activates the Python venv and runs the FastAPI server

cd /d "%~dp0"
echo Starting AI Code Review Backend...
echo.

REM Activate virtual environment
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo Error: Failed to activate virtual environment
    pause
    exit /b 1
)

echo.
echo Virtual environment activated.
echo Starting FastAPI server on http://127.0.0.1:8000
echo.
echo Backend is ready! Press Ctrl+C to stop.
echo.

REM Start the backend server
python main.py

pause
