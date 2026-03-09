@echo off
chcp 65001 >nul 2>&1
title TystText - Installation

echo.
echo   TystText - Installationsscript
echo   ================================
echo.

:: Kor PowerShell-scriptet
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installera.ps1"

echo.
if %ERRORLEVEL% equ 0 (
    echo   Klart! Dubbelklicka starta.bat for att kora TystText.
) else (
    echo   Installationen misslyckades. Se felmeddelandet ovan.
)
echo.
pause
