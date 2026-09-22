@echo off
title OUTR Academic Portal Launcher
color 1F
echo ============================================================
echo        ODISHA UNIVERSITY OF TECHNOLOGY AND RESEARCH
echo                   ACADEMIC ERP PORTAL
echo ============================================================
echo.

cd /d "C:\Users\ASUS\Desktop\PPD_LAb"

:: Check if port 5000 is already active
netstat -ano | findstr :5000 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [OK] OUTR Server is already running on http://localhost:5000!
) else (
    echo [*] Starting OUTR Backend Server...
    start "OUTR Backend Server" /min "C:\Program Files\Python314\python.exe" "C:\Users\ASUS\Desktop\PPD_LAb\backend\app.py"
    timeout /t 2 /nobreak >nul
)

echo [*] Opening OUTR Portal in your web browser...
start "" "http://localhost:5000"
echo.
echo ============================================================
echo [SUCCESS] Portal opened at http://localhost:5000
echo.
echo Login Credentials:
echo   - Student:  ID: 23110278           Pass: 23110278
echo   - Faculty:  ID: sanjukta@outr.com  Pass: faculty123
echo   - Admin:    ID: admin              Pass: admin123
echo ============================================================
echo.
timeout /t 6
