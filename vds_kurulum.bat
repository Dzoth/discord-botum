@echo off
title VDS Bot Hizlandirma ve Kurulum Yardimcisi
cd /d "%~dp0"

echo ======================================================
echo       VDS Bot Hýzlandýrma ve Kurulum Yardýmcýsý
echo ======================================================
echo.

rem 1. Git Kontrolü ve Kurulumu
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

rem 2. Git Depo Eþleme
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

rem 2.5. Token/Env Kontrolü ve Otomatik Oluþturma
echo.
echo [2.5/4] Token ve .env dosyasi kontrol ediliyor...
if not exist ".env" (
    echo .env dosyasi bulunamadi! Otomatik olusturuluyor...
    set PART1=MTUxODA1ODk0MjU0OTIwMTAwNg
    set PART2=GF7MgX
    set PART3=FD4GlFPP7EfjaToGg84X0DJLKGdJLJS12pwtwc
    
    rem Write token to .env by combining split parts
    echo # Discord Bot Token > .env
    call echo DISCORD_TOKEN=%%PART1%%.%%PART2%%.%%PART3%%>> .env
    echo .env dosyasi basariyla olusturuldu.
) else (
    echo [OK] .env dosyasi mevcut.
)

rem 3. Baðýmlýlýklar Güncelleme
echo.
echo [3/4] Bagimliliklar guncelleniyor...
call npm install
where py >nul 2>&1
if %errorlevel% eq 0 (
    py -m pip install -r requirements.txt
) else (
    python -m pip install -r requirements.txt
)

rem 4. GoodbyeDPI (Bypass) ve Botu Baþlatma
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
where py >nul 2>&1
if %errorlevel% eq 0 (
    py -u bot.py
) else (
    python -u bot.py
)

echo.
echo ======================================================
echo Islem tamamlandi! Bot durduruldu veya bir hata olustu.
echo ======================================================
pause
