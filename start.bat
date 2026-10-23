@echo off
cd /d "%~dp0"
call "%~dp0start.cmd" %*
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Eksekusi program dihentikan dengan kode error %ERRORLEVEL%.
    pause
)
