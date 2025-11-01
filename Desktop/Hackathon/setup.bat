@echo off
REM Setup script for Windows

echo.
echo ====================================
echo Code Review System - Setup
echo ====================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.8+
    pause
    exit /b 1
)

echo [1/3] Creating virtual environment...
cd backend
python -m venv venv
call venv\Scripts\activate.bat

echo [2/3] Installing dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo [3/3] Checking Ollama...
python -c "import ollama; print('✓ Ollama client installed')" >nul 2>&1
if errorlevel 1 (
    echo WARNING: Ollama not installed. Please download from https://ollama.ai
)

echo.
echo ====================================
echo ✓ Setup complete!
echo ====================================
echo.
echo Next steps:
echo 1. Start Ollama: ollama serve
echo 2. Pull a model: ollama pull mistral
echo 3. In another terminal, run: python main.py
echo.
pause
