@echo off
title OUTR Backend Server
cd /d "%~dp0"
echo ================================================================
echo  Starting OUTR Academic Evaluation & Result Analytics Server...
echo ================================================================
"C:\Program Files\Python314\python.exe" backend\app.py
pause
