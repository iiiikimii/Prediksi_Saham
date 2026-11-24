@echo off
title IDX AI Stock Terminal (FastAPI & Modern Web Frontend)
echo =====================================================================
echo Membuka IDX AI Stock Terminal (Web-Based Prediction Tool)...
echo Sektor: Perbankan, Makanan, Perkebunan, Mineral (Seluruh 167 Emiten)
echo Animasi & Smooth Scroll: GSAP + ScrollTrigger + Lenis + Chart.js
echo =====================================================================
echo.
cd /d "%~dp0"
start "" http://localhost:8000
python server.py
pause
