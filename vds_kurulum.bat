@echo off
title VDS Bot Hizlandirma ve Kurulum Yardimcisi
chcp 65001 >nul
cd /d "%~dp0"

echo ======================================================
echo       VDS Bot Hızlandırma ve Kurulum Yardımcısı
echo ======================================================
echo.

rem 1. Git Kontrolü ve Kurulumu
echo [1/4] Git kontrol ediliyor...
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo Git yüklü değil! winget ile otomatik kuruluyor...
    winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
    if %errorlevel% neq 0 (
        echo Winget ile kurulamadı. Lütfen tarayıcıdan indirip kurun: https://git-scm.com/download/win
        pause
        exit
    )
    echo Git başarıyla kuruldu. Lütfen bu betiği kapatıp yeniden çalıştırın!
    pause
    exit
) else (
    echo [OK] Git yüklü.
)

rem 2. Git Depo Eşleme
echo.
echo [2/4] GitHub ile eşleme kontrol ediliyor...
if not exist ".git" (
    echo Git deposu başlatılıyor...
    git init
    git remote add origin https://github.com/Dzoth/discord-botum.git
    git fetch --all
    git reset --hard origin/main
) else (
    echo Güncellemeler çekiliyor...
    git pull origin main
)

rem 3. Node Modülleri Kontrolü
echo.
echo [3/4] Bağımlılıklar güncelleniyor...
call npm install
py -m pip install -r requirements.txt

rem 4. GoodbyeDPI (Bypass) ve Botu Başlatma
echo.
echo [4/4] Bot hızlandırılmış modda başlatılıyor...
echo (Bu mod engellemeleri aşmak için GoodbyeDPI'ı otomatik başlatır)
echo.

tasklist | findstr /i "goodbyedpi.exe" >nul
if %errorlevel% neq 0 (
    echo GoodbyeDPI arka planda başlatılıyor...
    start "" run_with_bypass.bat
) else (
    echo GoodbyeDPI zaten aktif.
)

echo Bot çalıştırılıyor...
start "" run_python_bot.bat

echo.
echo ======================================================
echo İşlem tamamlandı! Bot arka planda hızlandırılmış
echo olarak başlatıldı. Discord'dan .sysinfo yazabilirsiniz.
echo ======================================================
pause
