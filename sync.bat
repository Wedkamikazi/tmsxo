@echo off
title Treasury Management System - Auto Sync
echo.
echo ============================================
echo   Treasury Management System - Auto Sync
echo ============================================
echo.
powershell.exe -ExecutionPolicy Bypass -File "%~dp0auto-sync.ps1"
echo.
echo Press any key to close...
pause >nul 