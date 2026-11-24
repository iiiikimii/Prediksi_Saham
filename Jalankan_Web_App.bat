@echo off
title IDX Stock Forecasting Web Terminal
echo =====================================================================
echo Membuka IDX Stock Forecasting Terminal (Web-Based Prediction Tool)...
echo Sektor: Perbankan, Makanan, Perkebunan, Mineral (Seluruh 167 Emiten)
echo =====================================================================
echo.
cd /d "%~dp0"
python -m streamlit run app.py
pause
