@echo off
REM Quick Status Check Script
REM Tests all components and reports what works

echo.
echo ============================================================
echo   HACKATHON PROJECT STATUS CHECK
echo ============================================================
echo.

cd /d "%~dp0backend"

echo [1/5] Checking Virtual Environment...
if exist "venv\Scripts\activate.bat" (
    echo     [OK] Virtual environment found
) else (
    echo     [FAIL] Virtual environment missing
    pause
    exit /b 1
)

echo.
echo [2/5] Activating venv and checking dependencies...
call venv\Scripts\activate.bat
python -c "import ollama; import fastapi; print('     [OK] Dependencies installed')" 2>nul
if errorlevel 1 (
    echo     [FAIL] Dependencies missing - run: pip install -r requirements.txt
    pause
    exit /b 1
)

echo.
echo [3/5] Checking if backend is running...
curl -s http://localhost:8000/ >nul 2>&1
if errorlevel 1 (
    echo     [WARN] Backend not running on port 8000
    echo     [ACTION] Start backend with: cd backend ^& python main.py
    set BACKEND_RUNNING=0
) else (
    echo     [OK] Backend is running
    set BACKEND_RUNNING=1
)

echo.
echo [4/5] Checking Ollama model...
python -c "import ollama; c = ollama.Client(); c.list(); print('     [OK] Ollama is running')" 2>nul
if errorlevel 1 (
    echo     [WARN] Ollama not running or model not available
    echo     [ACTION] Start Ollama and run: ollama pull qwen2.5-coder:7b-instruct
)

echo.
echo [5/5] Testing CLI (if backend running)...
if %BACKEND_RUNNING%==1 (
    echo     Testing code review...
    python cli.py --file ..\examples\example.py --language python --model qwen2.5-coder:7b-instruct >test_output.txt 2>&1
    if errorlevel 1 (
        echo     [WARN] CLI test failed - check test_output.txt
    ) else (
        echo     [OK] CLI works!
    )
) else (
    echo     [SKIP] Backend not running, skipping CLI test
)

echo.
echo ============================================================
echo   STATUS SUMMARY
echo ============================================================
echo.
echo What to test next:
echo   1. VS Code Extension: Open example.py, F1 ^> "Code Review: Review Current File"
echo   2. WebView: Check if panel opens and shows findings
echo   3. Backend Terminal: Check for comprehensive formatted output
echo   4. Auto-fix: Try generating and applying fixes
echo.
echo High-value features to implement (30 min left):
echo   - Git diff review (1000 pts) - 10 min
echo   - Pre-commit hook (500 pts) - 5 min
echo   - Show output in VS Code OUTPUT panel (better UX)
echo.
echo ============================================================
echo.

pause
