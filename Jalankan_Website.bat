@echo off
title IDX AI Stock Terminal (Node.js & Express)
color 0B
echo =====================================================================
echo    IDX AI STOCK FORECASTING & REALISTIC MM TERMINAL (Node.js)
echo    Sektor: Perbankan, Makanan, Perkebunan, Mineral (167 Emiten)
echo    Animasi: GSAP + ScrollTrigger + Lenis + Chart.js
echo =====================================================================
echo.

cd /d "%~dp0"

:: 1. Pastikan dependensi terpasang jika node_modules belum ada
if not exist "node_modules\" (
    echo [INFO] Menyiapkan dependensi npm...
    call npm install
    echo.
)

:: 2. Periksa apakah server sudah aktif di port 3000
powershell -Command "$p = Test-NetConnection -ComputerName localhost -Port 3000 -WarningAction SilentlyContinue; exit ($p.TcpTestSucceeded ? 0 : 1)" >nul 2>&1
if "%errorlevel%"=="0" (
    echo [INFO] Server Node.js sudah aktif di http://localhost:3000!
    echo [INFO] Membuka browser...
    start http://localhost:3000
    goto RUNNING_NOTICE
)

:: 3. Luncurkan browser setelah server dipastikan aktif di port 3000
start "" powershell -NoProfile -Command "for ($i = 0; $i -lt 30; $i++) { Start-Sleep -Milliseconds 500; try { $res = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 1; if ($res.StatusCode -eq 200) { Start-Process 'http://localhost:3000'; break; } } catch {} }"

:: 4. Jalankan server Node.js utama di jendela ini
echo [INFO] Memulai server IDX AI Stock Terminal...
echo [PENTING] JANGAN TUTUP jendela hitam ini agar website tetap dapat diakses!
echo.
node server.js

:RUNNING_NOTICE
echo.
echo =====================================================================
echo [INFO] IDX AI Stock Terminal sedang berjalan.
echo [TIPS] Tekan Ctrl + C di jendela ini jika Anda ingin menghentikan server.
echo =====================================================================
pause

