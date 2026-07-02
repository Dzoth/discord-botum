@echo off
cd /d "%~dp0"

rem Yonetici yetkisi kontrolu
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo =======================================================
    echo HATA: Bu programi YONETICI olarak calistirmeniz gerekir!
    echo =======================================================
    echo Lutfen bu dosyaya sag tiklayip "Yonetici olarak calistir" deyin.
    echo.
    pause
    exit
)

rem GoodbyeDPI klasoru yoksa indir ve kur
if not exist "goodbyedpi" (
    echo GoodbyeDPI indiriliyor...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/ValdikSS/GoodbyeDPI/releases/download/0.2.3rc3/goodbyedpi-0.2.3rc3-2.zip' -OutFile 'goodbyedpi.zip'"
    echo Dosyalar ayiklaniyor...
    powershell -Command "Expand-Archive -Path 'goodbyedpi.zip' -DestinationPath 'goodbyedpi_temp' -Force"
    move goodbyedpi_temp\goodbyedpi-* goodbyedpi >nul
    rmdir /s /q goodbyedpi_temp
    del goodbyedpi.zip
)

rem Arka planda engeli asma aracini baslat
echo Bypass araci baslatiliyor...
start "GoodbyeDPI-Bypass" /min "goodbyedpi\x86_64\goodbyedpi.exe" -5

rem 2 saniye bekle
timeout /t 2 /nobreak > nul

rem Kutuphaneleri yukle ve botu calistir
echo Node.js modulleri yukleniyor...
call npm install
echo Bot baslatiliyor...
node index.js

rem Kapanirken bypass aracini da kapat
taskkill /fi "windowtitle eq GoodbyeDPI-Bypass*" /f > nul 2>&1
pause
