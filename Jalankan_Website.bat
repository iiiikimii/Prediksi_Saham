@echo off
title IDX AI Stock Terminal (Node.js & Express)
echo =====================================================================
echo Memulai IDX AI Stock Terminal (Node.js & JavaScript Web Stack)...
echo Sektor: Perbankan, Makanan, Perkebunan, Mineral (Seluruh 167 Emiten)
echo Animasi & Smooth Scroll: GSAP + ScrollTrigger + Lenis + Chart.js
echo =====================================================================
echo.
cd /d "%~dp0"

:: Pastikan dependensi terpasang jika node_modules belum ada
if not exist "node_modules\" (
    echo [INFO] Menginstal dependensi npm...
    call npm install
)

:: Buka browser dengan jeda 2 detik agar server siap
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: Jalankan server Node.js
echo [INFO] Menjalankan server pada http://localhost:3000 ...
node server.js
if errorlevel 1 (
    echo.
    echo [ERROR] Server berhenti dengan kode kesalahan.
    pause
)
