@echo off
cd /d "%~dp0"
echo === VDS DIAGNOSTICS START === > debug.log
echo Time: %TIME% >> debug.log

echo [1] Checking py launcher... >> debug.log
where py >> debug.log 2>&1
echo ErrorLevel: %errorlevel% >> debug.log

echo [2] Checking python... >> debug.log
where python >> debug.log 2>&1
echo ErrorLevel: %errorlevel% >> debug.log

echo [3] Testing python version... >> debug.log
py --version >> debug.log 2>&1
python --version >> debug.log 2>&1

echo [4] Testing bot launch via py... >> debug.log
py -u bot.py >> debug.log 2>&1
echo Py Exit Code: %errorlevel% >> debug.log

echo [5] Testing bot launch via python... >> debug.log
python -u bot.py >> debug.log 2>&1
echo Python Exit Code: %errorlevel% >> debug.log

echo === DIAGNOSTICS END === >> debug.log
echo Test complete. Open debug.log to see the details.
pause
