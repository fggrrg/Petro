@echo off

REM Install Python NEWEST if not present
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo Python not found. Please install the newest version of Python from python.org.
    pause
    exit /b 1
)

REM Create a Python virtual environment and install pip dependencies
python -m venv .venv
call .venv\Scripts\activate
pip install -r py_dep.txt

REM Install Node.js and npm packages, then start the server
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js not found. Please install Node.js from nodejs.org.
    pause
    exit /b 1
)
npm install
node server.js


node server.js