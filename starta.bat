@echo off
chcp 65001 >nul 2>&1
title TystText

:: Kataloger
set "ROOT=%~dp0"
set "DATA=%ROOT%.tysttext\data"
set "PYTHON_DIR=%ROOT%.tysttext\python"
set "FFMPEG_DIR=%ROOT%.tysttext\ffmpeg"

:: Kontrollera att installationen ar klar
if not exist "%PYTHON_DIR%\python.exe" (
    echo.
    echo  FEL: Python hittades inte. Kor installera.bat forst!
    echo.
    pause
    exit /b 1
)

:: PATH - embedded python och ffmpeg forst
set "PATH=%PYTHON_DIR%;%PYTHON_DIR%\Scripts;%FFMPEG_DIR%;%PATH%"

:: Miljoevariabler - launcher.py anvander setdefault sa dessa har hogsta prioritet
set "TYSTTEXT_DATA_DIR=%DATA%"
set "UPLOAD_DIR=%DATA%\uploads"
set "MODELS_DIR=%DATA%\models"
set "DATABASE_URL=sqlite+aiosqlite:///%DATA%\transcription.db"
set "STATIC_DIR=%ROOT%frontend\out"
set "HF_HOME=%DATA%\models\huggingface"
set "TRANSFORMERS_CACHE=%DATA%\models\huggingface"

:: Starta
cd /d "%ROOT%"
"%PYTHON_DIR%\python.exe" launcher.py
