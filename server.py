import os
import sys
import glob
import math
import logging
import datetime
import numpy as np
import pandas as pd
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import yfinance as yf

# Suppress verbose yfinance logs
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

app = FastAPI(
    title="IDX Stock Forecasting API & Terminal",
    description="Backend API for 167 IDX Stocks with RNN & Technical Confluence",
    version="2.0.0"
)

# Enable CORS for local development and web frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.join(BASE_DIR, "Stock_RNN_Project")
LOG_DIR = os.path.join(PROJECT_DIR, "logs")
DATA_DAILY_DIR = os.path.join(PROJECT_DIR, "data_daily")
DATA_SCALP_DIR = os.path.join(PROJECT_DIR, "data_scalping")
MODELS_DIR = os.path.join(PROJECT_DIR, "models")
WEB_DIR = os.path.join(BASE_DIR, "web")

SEKTOR_SAHAM = {
    "Perbankan": [
        "BBCA", "BBRI", "BMRI", "BBNI", "BRIS", "BBTN", "BNGA", "BDMN",
        "NISP", "PNBN", "BNLI", "BNII", "MEGA", "BTPN", "BTPS",
        "BJBR", "BJTM", "BEKS", "ARTO", "BBYB", "BBHI", "AGRO", "BANK",
        "AMAR", "BBSI", "BACA", "BABP", "BBKP", "BCIC", "BGTG", "BINA",
        "BKSW", "BMAS", "BNBA", "BBMD", "BSIM", "BSWD", "BVIC", "DNAR",
        "INPC", "MASB", "MAYA", "MCOR", "NOBU", "PNBS", "SDRA", "AGRS"
    ],
    "Makanan": [
        "ICBP", "INDF", "MYOR", "ROTI", "GOOD", "STTP", "SKLT", "SKBM",
        "CEKA", "CAMP", "KEJU", "HOKI", "BUDI", "AISA", "ALTO", "COCO",
        "FOOD", "IKAN", "PSDN", "PMMP", "ENZO", "BOBA", "NASI", "TAYS",
        "GULA", "TRGU", "WAPO", "CMRY", "ULTJ", "CLEO", "ADES", "MLBI",
        "DLTA", "BEER", "WINE", "DMND", "SOUL", "TGUK", "CPIN", "JPFA",
        "MAIN", "WMUU", "BEEF", "CPRO", "DSFI", "CRAB", "PCAR", "SIPD",
        "AMMS", "DEWI", "ISEA", "AGAR"
    ],
    "Perkebunan": [
        "AALI", "LSIP", "TAPG", "DSNG", "SSMS", "SIMP", "SGRO", "STAA",
        "TBLA", "SMAR", "NSSS", "BWPT", "GZCO", "JAWA", "ANJT", "CSRA",
        "FAPA", "MGRO", "PGUN", "PNGO", "PSGO", "UNSP", "JARR", "CBUT",
        "MKTR", "TLDN", "OILS", "PTPS", "PALM", "GOLL", "MAGP", "BISI",
        "ANDI", "FISH"
    ],
    "Mineral": [
        "AMMN", "ANTM", "INCO", "MDKA", "MBMA", "NCKL", "TINS", "BRMS",
        "PSAB", "ARCI", "NICL", "NICE", "DKFT", "IFSH", "CITA", "ZINC",
        "SQMI", "SMGA", "HRUM", "CUAN", "KRAS", "ISSP", "GGRP", "INAI",
        "ALKA", "ALMI", "GDST", "BAJA", "NIKL", "LION", "TBMS", "KBLI",
        "VOKS", "IKBI"
    ]
}

# Reverse lookup ticker -> sector
TICKER_TO_SECTOR = {}
for sec, tickers in SEKTOR_SAHAM.items():
    for t in tickers:
        TICKER_TO_SECTOR[t] = sec


def calculate_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate RSI(14), MACD(12,26,9), EMA(20,50), Bollinger Bands and Volume Spike Ratio."""
    df = df.copy()
    close = df['Close']

    # EMA 20 & EMA 50
    df['EMA_20'] = close.ewm(span=20, adjust=False).mean()
    df['EMA_50'] = close.ewm(span=50, adjust=False).mean()

    # RSI 14
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=14, min_periods=14).mean()
    avg_loss = loss.rolling(window=14, min_periods=14).mean()
    rs = avg_gain / (avg_loss + 1e-9)
    df['RSI_14'] = 100 - (100 / (1 + rs))

    # MACD 12, 26, 9
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    df['MACD'] = ema12 - ema26
    df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
    df['MACD_Hist'] = df['MACD'] - df['MACD_Signal']

    # Bollinger Bands 20, 2
    sma20 = close.rolling(window=20).mean()
    std20 = close.rolling(window=20).std()
    df['BB_Upper'] = sma20 + (2 * std20)
    df['BB_Lower'] = sma20 - (2 * std20)
    df['BB_Middle'] = sma20

    # Volume Spike Ratio (current volume / 20-day average volume)
    if 'Volume' in df.columns:
        vol_sma20 = df['Volume'].rolling(window=20).mean()
        df['Vol_Ratio'] = df['Volume'] / (vol_sma20 + 1e-9)
    else:
        df['Vol_Ratio'] = 1.0

    return df


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "server_time": datetime.datetime.now().isoformat(),
        "total_sectors": len(SEKTOR_SAHAM),
        "total_emiten": sum(len(v) for v in SEKTOR_SAHAM.values())
    }


@app.get("/api/overview")
def get_overview():
    """Returns high-level KPI metrics across all sectors, top picks, and model status."""
    multihari_file = os.path.join(LOG_DIR, "latest_multihari.csv")
    scalp_file = os.path.join(LOG_DIR, "latest_scalping.csv")

    df_multi = pd.read_csv(multihari_file) if os.path.exists(multihari_file) else pd.DataFrame()
    df_scalp = pd.read_csv(scalp_file) if os.path.exists(scalp_file) else pd.DataFrame()

    total_stocks = len(df_multi) if not df_multi.empty else 167

    # Top Swing Pick
    top_swing = {}
    if not df_multi.empty:
        s_pick = df_multi.sort_values(by="Potensi_H+31(%)", ascending=False).iloc[0]
        top_swing = {
            "kode": s_pick["Kode"],
            "sektor": s_pick["Sektor"],
            "potensi": float(s_pick["Potensi_H+31(%)"]),
            "sinyal": s_pick["Sinyal_Swing"],
            "harga": float(s_pick["Close_Terakhir"]),
            "target": float(s_pick["Target_Price"])
        }

    # Top Scalp Pick
    top_scalp = {}
    if not df_scalp.empty:
        sc_pick = df_scalp.sort_values(by="Net_Gain_60m(%)", ascending=False).iloc[0]
        top_scalp = {
            "kode": sc_pick["Kode"],
            "sektor": sc_pick["Sektor"],
            "net_gain": float(sc_pick["Net_Gain_60m(%)"]),
            "sinyal": sc_pick["Sinyal_Scalp"],
            "harga": float(sc_pick["Last_Close"]),
            "tp": float(sc_pick["TP_Scalp"])
        }

    # Sector summary
    sector_summary = []
    if not df_multi.empty:
        grouped = df_multi.groupby("Sektor").agg(
            total_emiten=("Kode", "count"),
            avg_return_h31=("Potensi_H+31(%)", "mean"),
            avg_return_h7=("Potensi_H+7(%)", "mean"),
            avg_mape=("MAPE_H+31(%)", "mean"),
            strong_buys=("Sinyal_Swing", lambda s: (s == "STRONG BUY").sum()),
            buys=("Sinyal_Swing", lambda s: (s == "BUY").sum())
        ).reset_index()

        for _, row in grouped.iterrows():
            sector_summary.append({
                "sektor": row["Sektor"],
                "total_emiten": int(row["total_emiten"]),
                "avg_return_h31": round(float(row["avg_return_h31"]), 2),
                "avg_return_h7": round(float(row["avg_return_h7"]), 2),
                "avg_mape": round(float(row["avg_mape"]), 2),
                "strong_buys": int(row["strong_buys"]),
                "buys": int(row["buys"])
            })

    return {
        "total_emiten": total_stocks,
        "sectors": list(SEKTOR_SAHAM.keys()),
        "top_swing": top_swing,
        "top_scalp": top_scalp,
        "sector_summary": sector_summary
    }


@app.get("/api/stocks")
def get_stocks_list(sektor: Optional[str] = None):
    """Returns list of all available stocks, optionally filtered by sector."""
    stocks = []
    for sec, tickers in SEKTOR_SAHAM.items():
        if sektor and sektor.lower() != "all" and sec.lower() != sektor.lower():
            continue
        for t in tickers:
            stocks.append({"kode": t, "sektor": sec})
    return {"count": len(stocks), "stocks": stocks}


@app.get("/api/predictions/multihari")
def get_multihari_predictions(
    sektor: Optional[str] = Query(None, description="Filter by sector"),
    sinyal: Optional[str] = Query(None, description="Filter by signal (e.g. STRONG BUY, BUY)"),
    search: Optional[str] = Query(None, description="Search ticker"),
    sort_by: str = Query("Potensi_H+31(%)", description="Column to sort by"),
    order: str = Query("desc", description="Sort order: asc or desc")
):
    """Returns 1-31D multi-day predictions across all 167 stocks with filters and sorting."""
    multihari_file = os.path.join(LOG_DIR, "latest_multihari.csv")
    if not os.path.exists(multihari_file):
        raise HTTPException(status_code=404, detail="Multi-hari prediction data not found")

    df = pd.read_csv(multihari_file)

    if sektor and sektor.upper() != "ALL":
        df = df[df["Sektor"].str.upper() == sektor.upper()]

    if sinyal and sinyal.upper() != "ALL":
        df = df[df["Sinyal_Swing"].str.upper() == sinyal.upper()]

    if search:
        df = df[df["Kode"].str.contains(search.upper(), na=False)]

    if sort_by in df.columns:
        ascending = (order.lower() == "asc")
        df = df.sort_values(by=sort_by, ascending=ascending)

    records = df.to_dict(orient="records")
    return {
        "count": len(records),
        "total": len(records),
        "data": records
    }


@app.get("/api/predictions/scalping")
def get_scalping_predictions(
    sektor: Optional[str] = Query(None, description="Filter by sector"),
    sinyal: Optional[str] = Query(None, description="Filter by scalp signal"),
    search: Optional[str] = Query(None, description="Search ticker"),
    sort_by: str = Query("Net_Gain_60m(%)", description="Sort column"),
    order: str = Query("desc", description="Sort order")
):
    """Returns 5m-60m scalping predictions with fee breakeven and volume surge flags."""
    scalp_file = os.path.join(LOG_DIR, "latest_scalping.csv")
    if not os.path.exists(scalp_file):
        raise HTTPException(status_code=404, detail="Scalping prediction data not found")

    df = pd.read_csv(scalp_file)

    if sektor and sektor.upper() != "ALL":
        df = df[df["Sektor"].str.upper() == sektor.upper()]

    if sinyal and sinyal.upper() != "ALL":
        df = df[df["Sinyal_Scalp"].str.upper() == sinyal.upper()]

    if search:
        df = df[df["Kode"].str.contains(search.upper(), na=False)]

    if sort_by in df.columns:
        ascending = (order.lower() == "asc")
        df = df.sort_values(by=sort_by, ascending=ascending)

    records = df.to_dict(orient="records")
    return {
        "count": len(records),
        "data": records
    }


@app.get("/api/stock/{ticker}")
def get_stock_detail(ticker: str):
    """
    Returns deep single-stock analysis:
    - 60-day historical OHLCV
    - Technical indicators (RSI-14, MACD, EMA-20/50, Bollinger Bands, Volume spike)
    - 31-day RNN forecast trajectory
    - Confluence score
    - Actionable trading plan (Entry, TP, SL, RRR)
    """
    ticker = ticker.upper()
    sektor = TICKER_TO_SECTOR.get(ticker)
    if not sektor:
        raise HTTPException(status_code=404, detail=f"Ticker {ticker} not found in IDX 167 universe")

    # Load multi-day record
    multihari_file = os.path.join(LOG_DIR, "latest_multihari.csv")
    df_multi = pd.read_csv(multihari_file) if os.path.exists(multihari_file) else pd.DataFrame()
    row_multi = df_multi[df_multi["Kode"] == ticker] if not df_multi.empty else pd.DataFrame()
    multi_data = row_multi.iloc[0].to_dict() if not row_multi.empty else {}

    # Load scalping record
    scalp_file = os.path.join(LOG_DIR, "latest_scalping.csv")
    df_scalp = pd.read_csv(scalp_file) if os.path.exists(scalp_file) else pd.DataFrame()
    row_scalp = df_scalp[df_scalp["Kode"] == ticker] if not df_scalp.empty else pd.DataFrame()
    scalp_data = row_scalp.iloc[0].to_dict() if not row_scalp.empty else {}

    # Load historical daily data
    filename = f"{sektor}_{ticker}_1d.csv"
    filepath = os.path.join(DATA_DAILY_DIR, filename)

    history_records = []
    latest_indicators = {}
    confluence_score = 50

    if os.path.exists(filepath):
        df_hist = pd.read_csv(filepath, index_col=0, parse_dates=True)
        df_hist = calculate_indicators(df_hist)

        # Slice latest 60 bars for fast responsive chart
        df_chart = df_hist.tail(60).copy()

        for idx, row in df_chart.iterrows():
            date_str = idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx)[:10]
            history_records.append({
                "date": date_str,
                "open": float(row.get("Open", row["Close"])),
                "high": float(row.get("High", row["Close"])),
                "low": float(row.get("Low", row["Close"])),
                "close": float(row["Close"]),
                "volume": int(row.get("Volume", 0)),
                "ema_20": round(float(row["EMA_20"]), 2) if not pd.isna(row["EMA_20"]) else None,
                "ema_50": round(float(row["EMA_50"]), 2) if not pd.isna(row["EMA_50"]) else None,
                "rsi_14": round(float(row["RSI_14"]), 2) if not pd.isna(row["RSI_14"]) else None,
                "macd": round(float(row["MACD"]), 2) if not pd.isna(row["MACD"]) else None,
                "macd_signal": round(float(row["MACD_Signal"]), 2) if not pd.isna(row["MACD_Signal"]) else None,
                "bb_upper": round(float(row["BB_Upper"]), 2) if not pd.isna(row["BB_Upper"]) else None,
                "bb_lower": round(float(row["BB_Lower"]), 2) if not pd.isna(row["BB_Lower"]) else None
            })

        latest_row = df_hist.iloc[-1]
        rsi_val = float(latest_row["RSI_14"]) if not pd.isna(latest_row["RSI_14"]) else 50.0
        macd_val = float(latest_row["MACD"]) if not pd.isna(latest_row["MACD"]) else 0.0
        macd_sig = float(latest_row["MACD_Signal"]) if not pd.isna(latest_row["MACD_Signal"]) else 0.0
        vol_ratio = float(latest_row["Vol_Ratio"]) if not pd.isna(latest_row["Vol_Ratio"]) else 1.0
        close_last = float(latest_row["Close"])
        ema20 = float(latest_row["EMA_20"]) if not pd.isna(latest_row["EMA_20"]) else close_last

        latest_indicators = {
            "rsi_14": round(rsi_val, 2),
            "rsi_status": "Oversold (Bargain)" if rsi_val < 35 else ("Overbought" if rsi_val > 70 else "Neutral / Healthy"),
            "macd_status": "Bullish Crossover" if macd_val > macd_sig else "Bearish / Neutral",
            "trend_ema": "Uptrend" if close_last > ema20 else "Downtrend / Consolidating",
            "volume_surge": vol_ratio > 1.3,
            "vol_ratio": round(vol_ratio, 2)
        }

        # Calculate Confluence Score (0 - 100)
        c_score = 50
        if rsi_val < 45: c_score += 15
        elif rsi_val > 70: c_score -= 15
        if macd_val > macd_sig: c_score += 15
        if close_last > ema20: c_score += 10
        if vol_ratio > 1.3: c_score += 10
        confluence_score = max(5, min(98, c_score))

    # Generate 31-day forecast projection path
    forecast_trajectory = []
    if multi_data:
        close_cur = float(multi_data.get("Close_Terakhir", 1000))
        target_days = [1, 7, 14, 21, 30, 31]
        target_vals = [float(multi_data.get(f"H+{d}", close_cur)) for d in target_days]

        # Interpolate day 1 to 31
        xp = [0] + target_days
        yp = [close_cur] + target_vals
        all_days = np.arange(1, 32)
        interp_curve = np.interp(all_days, xp, yp)

        last_date_str = history_records[-1]["date"] if history_records else datetime.date.today().isoformat()
        last_dt = datetime.datetime.strptime(last_date_str, "%Y-%m-%d")

        # Business days range
        cur_dt = last_dt
        for d_idx, price in enumerate(interp_curve, start=1):
            cur_dt += datetime.timedelta(days=1)
            while cur_dt.weekday() >= 5:  # skip weekends
                cur_dt += datetime.timedelta(days=1)
            is_key_target = d_idx in target_days
            forecast_trajectory.append({
                "day_index": d_idx,
                "date": cur_dt.strftime("%Y-%m-%d"),
                "projected_price": round(float(price), 2),
                "is_target": is_key_target,
                "label": f"H+{d_idx}" if is_key_target else None
            })

    return {
        "kode": ticker,
        "sektor": sektor,
        "multi_data": multi_data,
        "scalp_data": scalp_data,
        "confluence_score": confluence_score,
        "indicators": latest_indicators,
        "history": history_records,
        "forecast_trajectory": forecast_trajectory
    }


@app.post("/api/stock/{ticker}/live-forecast")
def live_forecast_stock(ticker: str):
    """
    Fetches real-time price from Yahoo Finance and computes updated instant projection.
    Provides on-demand live analysis without retraining models.
    """
    ticker = ticker.upper()
    sektor = TICKER_TO_SECTOR.get(ticker)
    if not sektor:
        raise HTTPException(status_code=404, detail="Ticker not registered in 167 universe")

    try:
        yf_ticker = f"{ticker}.JK"
        df_live = yf.download(yf_ticker, period="3mo", interval="1d", progress=False)
        if df_live.empty:
            raise HTTPException(status_code=502, detail=f"Failed to fetch live data for {yf_ticker}")

        if isinstance(df_live.columns, pd.MultiIndex):
            df_live.columns = df_live.columns.get_level_values(0)

        df_live = calculate_indicators(df_live)
        latest_close = float(df_live['Close'].iloc[-1])
        prev_close = float(df_live['Close'].iloc[-2]) if len(df_live) > 1 else latest_close
        pct_change = ((latest_close - prev_close) / prev_close) * 100

        # Technical confluence check
        latest_row = df_live.iloc[-1]
        rsi = float(latest_row['RSI_14']) if not pd.isna(latest_row['RSI_14']) else 50.0
        macd = float(latest_row['MACD']) if not pd.isna(latest_row['MACD']) else 0.0
        macd_sig = float(latest_row['MACD_Signal']) if not pd.isna(latest_row['MACD_Signal']) else 0.0

        # Projections adjusted to live price
        potensi_proj = 8.5
        if rsi < 40 and macd > macd_sig:
            potensi_proj = 14.2
            signal = "STRONG BUY"
        elif rsi > 70:
            potensi_proj = -2.5
            signal = "TAKE PROFIT / SELL"
        elif latest_close > latest_row['EMA_20']:
            potensi_proj = 9.0
            signal = "BUY"
        else:
            potensi_proj = 3.0
            signal = "HOLD / WAIT"

        tp = round(latest_close * (1 + (potensi_proj / 100)), 0)
        sl = round(latest_close * 0.95, 0)
        rrr = round((tp - latest_close) / max(1.0, (latest_close - sl)), 2)

        return {
            "status": "success",
            "kode": ticker,
            "sektor": sektor,
            "live_close": latest_close,
            "pct_change_today": round(pct_change, 2),
            "projected_return_h31": round(potensi_proj, 2),
            "signal": signal,
            "target_price": tp,
            "stop_loss": sl,
            "rrr": rrr,
            "rsi_14": round(rsi, 2),
            "as_of": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S WIB")
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/screener")
def get_screener_insights():
    """Returns top 10 swing picks, top 10 scalp picks, and sector comparative metrics."""
    multihari_file = os.path.join(LOG_DIR, "latest_multihari.csv")
    scalp_file = os.path.join(LOG_DIR, "latest_scalping.csv")

    df_multi = pd.read_csv(multihari_file) if os.path.exists(multihari_file) else pd.DataFrame()
    df_scalp = pd.read_csv(scalp_file) if os.path.exists(scalp_file) else pd.DataFrame()

    top_swing = []
    if not df_multi.empty:
        # Filter high reliability (MAPE <= 18%) and sort by return
        filtered_swing = df_multi[df_multi["MAPE_H+31(%)"] <= 18.0].sort_values(by="Potensi_H+31(%)", ascending=False).head(10)
        top_swing = filtered_swing.to_dict(orient="records")

    top_scalp = []
    if not df_scalp.empty:
        filtered_scalp = df_scalp[df_scalp["Net_Gain_60m(%)"] > 0.3].sort_values(by="Net_Gain_60m(%)", ascending=False).head(10)
        top_scalp = filtered_scalp.to_dict(orient="records")

    return {
        "top_swing_10": top_swing,
        "top_scalp_10": top_scalp
    }


# Mount web directory if exists
if os.path.exists(WEB_DIR):
    app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")

    @app.get("/")
    def serve_frontend():
        return FileResponse(os.path.join(WEB_DIR, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.py:app", host="0.0.0.0", port=8000, reload=False)
