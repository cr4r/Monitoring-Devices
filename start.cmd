@echo off
setlocal enabledelayedexpansion

:: 0. Pindah ke direktori skrip ini
cd /d "%~dp0"

title MonDev - Sistem Monitoring Jaringan

echo ========================================================
echo   MonDev - Sistem Monitoring Device ^& Jaringan
echo ========================================================
echo.

:: 1. Deteksi path Node.js jika belum ada di variabel PATH lingkungan
where node >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "PATH=%ProgramFiles%\nodejs;!PATH!"
    ) else if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
        set "PATH=%ProgramFiles(x86)%\nodejs;!PATH!"
    ) else if exist "%LocalAppData%\Programs\node\node.exe" (
        set "PATH=%LocalAppData%\Programs\node;!PATH!"
    )
)

:: Periksa kembali apakah Node.js siap digunakan
where node >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] Node.js tidak ditemukan di sistem!
    echo Silakan unduh dan pasang Node.js v18+ dari https://nodejs.org
    echo Setelah instalasi selesai, buka kembali file ini.
    echo.
    pause
    exit /b 1
)

:: 2. Salin .env jika belum ada
if not exist ".env" (
    if exist ".env-example" (
        echo [INFO] Berkas .env belum ditemukan. Menyalin dari .env-example...
        copy ".env-example" ".env" >nul
    )
)

:: 3. Periksa dan instal dependensi jika node_modules belum ada
if not exist "node_modules" (
    echo [INFO] Folder node_modules belum ada. Menjalankan npm install...
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Gagal menginstal dependensi npm.
        pause
        exit /b 1
    )
)

:: 4. Periksa apakah database sudah ada
if not exist "server\data\devwatch.db" (
    if not exist "data\devwatch.db" (
        echo [INFO] Database belum ditemukan. Menyemai basis data awal...
        call npm run seed
    )
)

:: 5. Buat bundle produksi jika dist belum ada
if not exist "dist\index.html" (
    echo [INFO] Berkas antarmuka web dist belum dibangun. Menjalankan npm run build...
    call npm run build
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Gagal membangun berkas frontend dist.
        pause
        exit /b 1
    )
)

echo.
echo ========================================================
echo   Menjalankan Server MonDev di http://localhost:3000
echo   Tekan Ctrl+C di jendela ini untuk menghentikan server.
echo ========================================================
echo.

:: 6. Buka browser otomatis setelah jeda singkat (2 detik)
start "" cmd /c "ping 127.0.0.1 -n 3 >nul & start http://localhost:3000"

:: 7. Jalankan server backend utama
node server/index.js

if !ERRORLEVEL! NEQ 0 (
    echo.
    echo [ERROR] Server berhenti dengan kode keluar !ERRORLEVEL!.
    pause
)
