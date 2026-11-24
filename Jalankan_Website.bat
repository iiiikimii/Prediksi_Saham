@echo off
title IDX AI Stock Terminal (Node.js & Express)
echo =====================================================================
echo Membuka IDX AI Stock Terminal (Node.js & JavaScript Web Stack)...
echo Sektor: Perbankan, Makanan, Perkebunan, Mineral (Seluruh 167 Emiten)
echo Animasi & Smooth Scroll: GSAP + ScrollTrigger + Lenis + Chart.js
echo =====================================================================
echo.
cd /d "%~dp0"
start "" http://localhost:3000
node server.js
pause
