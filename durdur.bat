@echo off
cd /d "%~dp0"
echo Durduruluyor... > stop_signal.txt
echo Bot ve engeli asma araci kapatiliyor...
taskkill /f /im node.exe
taskkill /f /im goodbyedpi.exe
echo.
echo Islem tamamlandi! Bot ve bypass araci tamamen kapatildi.
timeout /t 3 /nobreak > nul
