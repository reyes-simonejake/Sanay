@echo off
rem Double-click to start Sanay: the website (http://localhost:5173) and the desktop app.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-sanay.ps1" %*
pause
