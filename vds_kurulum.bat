@echo off
title VDS Bot Hizlandirma ve Kurulum Yardimcisi
cd /d "%~dp0"

echo ======================================================
echo       VDS Bot Hizlandirma ve Kurulum Yardimcisi
echo ======================================================
echo.

echo [1/4] Git kontrol ediliyor...
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo Git yuklu degil! winget ile otomatik kuruluyor...
    winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
    if %errorlevel% neq 0 (
        echo Winget ile kurulamadi. Lutfen tarayicidan indirip kurun: https://git-scm.com/download/win
        pause
        exit
    )
    echo Git basariyla kuruldu. Lutfen bu betigi kapatip yeniden calistirin!
    pause
    exit
) else (
    echo [OK] Git yuklu.
)

echo.
echo [2/4] GitHub ile esleme kontrol ediliyor...
if not exist ".git" (
    echo Git deposu baslatiliyor...
    git init
    git remote add origin https://github.com/Dzoth/discord-botum.git
    git fetch --all
    git reset --hard origin/main
) else (
    echo Guncellemeler cekiliyor...
    git pull origin main
)

echo.
echo [3/4] Bagimliliklar guncelleniyor...
call npm install
python -m pip install -r requirements.txt

echo.
echo [4/4] Bot hizlandirilmis modda baslatiliyor...
echo Mod engellemeleri asmak icin GoodbyeDPI otomatik baslatir.
echo.

tasklist | findstr /i "goodbyedpi.exe" >nul
if %errorlevel% neq 0 (
    echo GoodbyeDPI arka planda baslatiliyor...
    start "" run_with_bypass.bat
) else (
    echo GoodbyeDPI zaten aktif.
)

echo Bot calistiriluyor...
start "" run_python_bot.bat

echo.
echo ======================================================
echo Islem tamamlandi! Bot arka planda hizlandirilmis
echo olarak baslatildi. Discord'dan .sysinfo yazabilirsiniz.
echo ======================================================
pause
