@echo off
cd /d "%~dp0"

rem Clean up any old stop signal on startup
if exist stop_signal.txt del stop_signal.txt

rem Start GoodbyeDPI in the background if it's not already running
tasklist /FI "IMAGENAME eq goodbyedpi.exe" 2>NUL | find /I /N "goodbyedpi.exe">NUL
if "%ERRORLEVEL%"=="1" (
    start "" /b "goodbyedpi\x86_64\goodbyedpi.exe" -5
)
timeout /t 2 /nobreak > nul

:loop
rem Check if a stop signal has been sent
if exist stop_signal.txt (
    del stop_signal.txt
    exit
)

echo Bot baslatiliyor...
py -u bot.py

rem Wait 5 seconds before checking and restarting
timeout /t 5 /nobreak > nul
goto loop
