@echo off
cd /d "%~dp0"
echo Gerekli Python kutuphaneleri yukleniyor...
where py >nul 2>&1
if %errorlevel% eq 0 (
    py -m pip install -r requirements.txt
    echo Bot baslatiliyor...
    py -u bot.py
) else (
    python -m pip install -r requirements.txt
    echo Bot baslatiliyor...
    python -u bot.py
)
pause
