import os
import sys
import datetime
import numpy as np
import pandas as pd
import streamlit as st
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import load_model
import yfinance as yf

# ==============================================================================
# KONFIGURASI HALAMAN STREAMLIT
# ==============================================================================
st.set_page_config(
    page_title="IDX Stock Forecasting Terminal (RNN)",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS untuk tampilan Financial Terminal modern & sleek
st.markdown("""
<style>
    .main-header {
        font-size: 2.2rem;
        font-weight: 800;
        background: linear-gradient(90deg, #1f77b4, #00d2ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0px;
    }
    .sub-header {
        color: #888888;
        font-size: 1.05rem;
        margin-bottom: 20px;
    }
    .metric-card {
        background-color: #1e222d;
        border: 1px solid #2e3546;
        border-radius: 10px;
        padding: 15px;
        text-align: center;
    }
    .badge-buy {
        background-color: #00c853;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: bold;
    }
    .badge-strong-buy {
        background-color: #00701a;
        color: #00e676;
        border: 1px solid #00e676;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: bold;
    }
    .badge-sell {
        background-color: #d50000;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: bold;
    }
    .badge-wait {
        background-color: #ffab00;
        color: black;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: bold;
    }
</style>
""", unsafe_allow_html=True)

# ==============================================================================
# DEFINISI DIREKTORI & 167 EMITEN BEI
# ==============================================================================
BASE_DIR = os.path.abspath('Stock_RNN_Project')
DATA_DAILY_DIR = os.path.join(BASE_DIR, 'data_daily')
DATA_SCALP_DIR = os.path.join(BASE_DIR, 'data_scalping')
MODEL_DIR = os.path.join(BASE_DIR, 'models')
LOG_DIR = os.path.join(BASE_DIR, 'logs')
REPORT_DIR = os.path.join(BASE_DIR, 'reports')

SEKTOR_SAHAM = {
    "Perbankan": [
        "BBCA", "BBRI", "BMRI", "BBNI", "BRIS", "BBTN", "BNGA", "BDMN",
        "NISP", "PNBN", "BNLI", "BNII", "MEGA", "BTPN", "BTPS",
        "BJBR", "BJTM", "BEKS", "ARTO", "BBYB", "BBHI", "AGRO", "BANK",
        "AMAR", "BBSI",
        "BACA", "BABP", "BBKP", "BCIC", "BGTG", "BINA", "BKSW", "BMAS",
        "BNBA", "BBMD", "BSIM", "BSWD", "BVIC", "DNAR", "INPC", "MASB",
        "MAYA", "MCOR", "NOBU", "PNBS", "SDRA", "AGRS"
    ],
    "Makanan": [
        "ICBP", "INDF", "MYOR", "ROTI", "GOOD", "STTP", "SKLT", "SKBM",
        "CEKA", "CAMP", "KEJU", "HOKI", "BUDI", "AISA", "ALTO", "COCO",
        "FOOD", "IKAN", "PSDN", "PMMP", "ENZO", "BOBA", "NASI", "TAYS",
        "GULA", "TRGU", "WAPO",
        "CMRY", "ULTJ", "CLEO", "ADES", "MLBI", "DLTA", "BEER", "WINE",
        "DMND", "SOUL", "TGUK",
        "CPIN", "JPFA", "MAIN", "WMUU", "BEEF", "CPRO", "DSFI", "CRAB",
        "PCAR", "SIPD", "AMMS", "DEWI", "ISEA", "AGAR"
    ],
    "Perkebunan": [
        "AALI", "LSIP", "TAPG", "DSNG", "SSMS", "SIMP", "SGRO", "STAA",
        "TBLA", "SMAR",
        "NSSS", "BWPT", "GZCO", "JAWA", "ANJT", "CSRA", "FAPA", "MGRO",
        "PGUN", "PNGO", "PSGO", "UNSP", "JARR", "CBUT", "MKTR", "TLDN",
        "OILS", "PTPS",
        "PALM", "GOLL", "MAGP", "BISI", "ANDI", "FISH"
    ],
    "Mineral": [
        "AMMN", "ANTM", "INCO", "MDKA", "MBMA", "NCKL", "TINS", "BRMS",
        "PSAB", "ARCI", "NICL", "NICE", "DKFT", "IFSH", "CITA", "ZINC",
        "SQMI", "SMGA", "HRUM", "CUAN",
        "KRAS", "ISSP", "GGRP", "INAI", "ALKA", "ALMI", "GDST", "BAJA",
        "NIKL", "LION", "TBMS", "KBLI", "VOKS", "IKBI"
    ]
}

TARGET_HARI = [1, 7, 14, 21, 30, 31]
TARGET_SCALP_INDEX = [0, 2, 5, 11] # +5m, +15m, +30m, +60m

# ==============================================================================
# FUNGSI LOAD DATA & CACHING
# ==============================================================================
@st.cache_data(ttl=300)
def muat_data_multihari():
    file_path = os.path.join(LOG_DIR, 'latest_multihari.csv')
    if os.path.exists(file_path):
        df = pd.read_csv(file_path)
        # Format angka
        return df
    return pd.DataFrame()

@st.cache_data(ttl=300)
def muat_data_scalping():
    file_path = os.path.join(LOG_DIR, 'latest_scalping.csv')
    if os.path.exists(file_path):
        df = pd.read_csv(file_path)
        return df
    return pd.DataFrame()

def format_rupiah(val):
    if pd.isna(val):
        return "-"
    return f"Rp {val:,.0f}"

def format_persen(val):
    if pd.isna(val):
        return "-"
    return f"{val:+.2f}%"

# ==============================================================================
# SIDEBAR
# ==============================================================================
st.sidebar.image("https://raw.githubusercontent.com/feathericons/feather/master/icons/trending-up.svg", width=50)
st.sidebar.title("🎛️ Filter & Navigasi")

mode_halaman = st.sidebar.radio(
    "Pilih Modul Analisis:",
    [
        "📈 Multi-Hari (1 - 31 Hari)",
        "⚡ Scalping Intraday (5 Menit)",
        "🔍 Detail Emiten & Live Forecast",
        "📊 Screener & Performa Sektor"
    ]
)

st.sidebar.markdown("---")
st.sidebar.subheader("Filter Sektor Saham")
pilihan_sektor = st.sidebar.selectbox(
    "Sektor:",
    ["SEMUA SEKTOR", "Perbankan", "Makanan", "Perkebunan", "Mineral"]
)

pencarian_ticker = st.sidebar.text_input("Cari Kode Saham (Ticker):", "").upper()

df_daily = muat_data_multihari()
df_scalp = muat_data_scalping()

# ==============================================================================
# HEADER UTAMA & KPI CARDS
# ==============================================================================
st.markdown('<p class="main-header">📈 IDX Stock Forecasting & Screener Terminal</p>', unsafe_allow_html=True)
st.markdown('<p class="sub-header">Sistem Prediksi Deep Learning RNN Multi-Output untuk 167 Emiten BEI (Perbankan, Makanan, Perkebunan, Mineral)</p>', unsafe_allow_html=True)

# Ringkasan KPI di bagian atas
if not df_daily.empty:
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Total Emiten Teranalisis", f"{len(df_daily)} Saham", "100% Sektor Target")
    with col2:
        top_swing_pick = df_daily.sort_values(by='Potensi_H+31(%)', ascending=False).iloc[0]
        st.metric("Top Swing Pick (H+31)", f"{top_swing_pick['Kode']} ({top_swing_pick['Sektor']})", f"{top_swing_pick['Potensi_H+31(%)']:+.1f}%")
    with col3:
        if not df_scalp.empty:
            top_scalp_pick = df_scalp.sort_values(by='Net_Gain_60m(%)', ascending=False).iloc[0]
            st.metric("Top Scalp Pick (+60m)", f"{top_scalp_pick['Kode']} ({top_scalp_pick['Sektor']})", f"Net {top_scalp_pick['Net_Gain_60m(%)']:+.1f}%")
        else:
            st.metric("Top Scalp Pick", "-", "-")
    with col4:
        sektor_bullish = df_daily.groupby('Sektor')['Potensi_H+31(%)'].mean().idxmax()
        rata_bullish = df_daily.groupby('Sektor')['Potensi_H+31(%)'].mean().max()
        st.metric("Sektor Paling Bullish", f"{sektor_bullish}", f"Rata2 {rata_bullish:+.1f}%")

st.markdown("---")

# ==============================================================================
# MODUL 1: MULTI-HARI (1 - 31 HARI BURSA)
# ==============================================================================
if mode_halaman == "📈 Multi-Hari (1 - 31 Hari)":
    st.header("📈 Proyeksi Multi-Hari (H+1 s.d. H+31 Hari Bursa)")
    st.info("💡 Memproyeksikan harga penutupan di hari ke-1, 7, 14, 21, 30, dan 31 bursa ke depan. Mencakup seluruh emiten dari 4 sektor.")

    if not df_daily.empty:
        # Filter dataframe
        df_tampil = df_daily.copy()
        if pilihan_sektor != "SEMUA SEKTOR":
            df_tampil = df_tampil[df_tampil['Sektor'] == pilihan_sektor]
        if pencarian_ticker:
            df_tampil = df_tampil[df_tampil['Kode'].str.contains(pencarian_ticker)]

        # Filter sinyal
        pilihan_sinyal = st.multiselect(
            "Filter Sinyal Trading:",
            ["STRONG BUY", "BUY", "HOLD / WAIT", "TAKE PROFIT / SELL"],
            default=["STRONG BUY", "BUY", "HOLD / WAIT", "TAKE PROFIT / SELL"]
        )
        if pilihan_sinyal:
            df_tampil = df_tampil[df_tampil['Sinyal_Swing'].isin(pilihan_sinyal)]

        st.write(f"Menampilkan **{len(df_tampil)}** dari total **{len(df_daily)}** emiten yang terdaftar:")

        # Tampilkan Dataframe dengan format rapi
        kolom_tampil = [
            'Sektor', 'Kode', 'Close_Terakhir', 'H+1', 'H+7', 'H+14', 'H+21', 'H+30', 'H+31',
            'Potensi_H+31(%)', 'Sinyal_Swing', 'Target_Price', 'Stop_Loss', 'RRR', 'Grade'
        ]
        
        st.dataframe(
            df_tampil[kolom_tampil].style.format({
                'Close_Terakhir': 'Rp {:,.0f}',
                'H+1': 'Rp {:,.0f}',
                'H+7': 'Rp {:,.0f}',
                'H+14': 'Rp {:,.0f}',
                'H+21': 'Rp {:,.0f}',
                'H+30': 'Rp {:,.0f}',
                'H+31': 'Rp {:,.0f}',
                'Potensi_H+31(%)': '{:+.2f}%',
                'Target_Price': 'Rp {:,.0f}',
                'Stop_Loss': 'Rp {:,.0f}',
                'RRR': '{:.2f}'
            }),
            height=500,
            use_container_width=True
        )

        # Tombol Download CSV
        csv_daily = df_tampil.to_csv(index=False).encode('utf-8')
        st.download_button(
            label="📥 Download Data Multi-Hari (CSV)",
            data=csv_daily,
            file_name=f"prediksi_multihari_{datetime.datetime.now().strftime('%Y%m%d')}.csv",
            mime="text/csv"
        )
    else:
        st.warning("Data hasil prediksi multi-hari belum tersedia. Silakan jalankan notebook terlebih dahulu.")

# ==============================================================================
# MODUL 2: SCALPING INTRADAY (5 MENIT)
# ==============================================================================
elif mode_halaman == "⚡ Scalping Intraday (5 Menit)":
    st.header("⚡ Proyeksi Scalping Intraday 5 Menit (+5m s.d. +60m)")
    st.info("💡 Memproyeksikan pergerakan jangka sangat pendek pada candle 5 menit (+5m, +15m, +30m, +60m). Diperhitungkan batas fee komisi bursa 0.40% untuk menjamin Net Gain nyata.")

    if not df_scalp.empty:
        df_tampil_scalp = df_scalp.copy()
        if pilihan_sektor != "SEMUA SEKTOR":
            df_tampil_scalp = df_tampil_scalp[df_tampil_scalp['Sektor'] == pilihan_sektor]
        if pencarian_ticker:
            df_tampil_scalp = df_tampil_scalp[df_tampil_scalp['Kode'].str.contains(pencarian_ticker)]

        pilihan_sinyal_scalp = st.multiselect(
            "Filter Sinyal Scalping:",
            ["STRONG SCALP BUY", "SPECULATIVE BUY", "SIDEWAYS (Belum Tutup Fee)", "AVOID / SHORT-TERM BEARISH"],
            default=["STRONG SCALP BUY", "SPECULATIVE BUY", "SIDEWAYS (Belum Tutup Fee)", "AVOID / SHORT-TERM BEARISH"]
        )
        if pilihan_sinyal_scalp:
            df_tampil_scalp = df_tampil_scalp[df_tampil_scalp['Sinyal_Scalp'].isin(pilihan_sinyal_scalp)]

        st.write(f"Menampilkan **{len(df_tampil_scalp)}** dari total **{len(df_scalp)}** emiten scalping:")

        kolom_scalp_tampil = [
            'Sektor', 'Kode', 'Last_Close', '+5m', '+15m', '+30m', '+60m',
            'Delta_+60m(%)', 'Net_Gain_60m(%)', 'Volume_Status', 'Sinyal_Scalp', 'Entry_Zone', 'TP_Scalp', 'SL_Scalp', 'MAPE_60m(%)'
        ]

        st.dataframe(
            df_tampil_scalp[kolom_scalp_tampil].style.format({
                'Last_Close': 'Rp {:,.0f}',
                '+5m': 'Rp {:,.0f}',
                '+15m': 'Rp {:,.0f}',
                '+30m': 'Rp {:,.0f}',
                '+60m': 'Rp {:,.0f}',
                'Delta_+60m(%)': '{:+.2f}%',
                'Net_Gain_60m(%)': '{:+.2f}%',
                'TP_Scalp': 'Rp {:,.0f}',
                'SL_Scalp': 'Rp {:,.0f}',
                'MAPE_60m(%)': '{:.2f}%'
            }),
            height=500,
            use_container_width=True
        )

        csv_scalp = df_tampil_scalp.to_csv(index=False).encode('utf-8')
        st.download_button(
            label="📥 Download Data Scalping (CSV)",
            data=csv_scalp,
            file_name=f"prediksi_scalping_{datetime.datetime.now().strftime('%Y%m%d')}.csv",
            mime="text/csv"
        )
    else:
        st.warning("Data hasil scalping belum tersedia.")

# ==============================================================================
# MODUL 3: DETAIL EMITEN & LIVE INTERACTIVE FORECAST
# ==============================================================================
elif mode_halaman == "🔍 Detail Emiten & Live Forecast":
    st.header("🔍 Analisis Detail Emiten & Kurva Proyeksi Interaktif")
    st.write("Pilih salah satu saham dari **167 emiten BEI** untuk memvisualisasikan kurva proyeksi harga, level TP/SL, dan analisis risiko mendalam.")

    # Dropdown seluruh 167 emiten
    daftar_semua_emiten = []
    for s, tickers in SEKTOR_SAHAM.items():
        for t in tickers:
            daftar_semua_emiten.append(f"{t} ({s})")

    pilihan_emiten_str = st.selectbox("Pilih Saham untuk Dianalisis:", daftar_semua_emiten, index=0)
    ticker_terpilih = pilihan_emiten_str.split(" ")[0]
    sektor_terpilih = pilihan_emiten_str.split("(")[1].replace(")", "")
    nama_full = f"{sektor_terpilih}_{ticker_terpilih}"

    # Cari data di df_daily
    row_daily = df_daily[df_daily['Kode'] == ticker_terpilih] if not df_daily.empty else pd.DataFrame()
    row_scalp = df_scalp[df_scalp['Kode'] == ticker_terpilih] if not df_scalp.empty else pd.DataFrame()

    c1, c2, c3, c4 = st.columns(4)
    if not row_daily.empty:
        r = row_daily.iloc[0]
        c1.metric("Harga Penutupan Terakhir", format_rupiah(r['Close_Terakhir']))
        c2.metric("Proyeksi H+31", format_rupiah(r['H+31']), format_persen(r['Potensi_H+31(%)']))
        c3.metric("Sinyal Swing", r['Sinyal_Swing'])
        c4.metric("Target Price (TP) / SL", f"{format_rupiah(r['Target_Price'])}", f"SL: {format_rupiah(r['Stop_Loss'])}")

    # Plot Interaktif Proyeksi Multi-Hari dengan Plotly
    file_daily_csv = os.path.join(DATA_DAILY_DIR, f"{nama_full}_1d.csv")
    if os.path.exists(file_daily_csv) and not row_daily.empty:
        df_hist = pd.read_csv(file_daily_csv, index_col=0, parse_dates=True)
        recent_hist = df_hist.tail(60)

        r = row_daily.iloc[0]
        close_last = r['Close_Terakhir']
        
        # Bangun array proyeksi 31 hari
        target_hari_list = [1, 7, 14, 21, 30, 31]
        target_vals = [r[f'H+{h}'] for h in target_hari_list]
        
        # Interpolasi kurva halus untuk grafik
        sumbu_hari = np.arange(1, 32)
        # Interpolasi linear dari target point
        xp = [0] + target_hari_list
        yp = [close_last] + target_vals
        pred_curve = np.interp(sumbu_hari, xp, yp)

        fig = go.Figure()

        # Garis Histori 60 hari
        fig.add_trace(go.Scatter(
            x=recent_hist.index,
            y=recent_hist['Close'],
            mode='lines',
            name='Harga Historis Aktual',
            line=dict(color='#888888', width=2)
        ))

        # Tanggal proyeksi masa depan
        tgl_terakhir = recent_hist.index[-1]
        tgl_masa_depan = pd.bdate_range(start=tgl_terakhir + pd.Timedelta(days=1), periods=31)

        # Garis Proyeksi RNN
        fig.add_trace(go.Scatter(
            x=tgl_masa_depan,
            y=pred_curve,
            mode='lines',
            name='Proyeksi RNN Multi-Hari',
            line=dict(color='#00d2ff', width=3)
        ))

        # Titik target spesifik: H+1, H+7, H+14, H+21, H+30, H+31
        target_dates = [tgl_masa_depan[h-1] for h in target_hari_list]
        fig.add_trace(go.Scatter(
            x=target_dates,
            y=target_vals,
            mode='markers+text',
            name='Titik Target Proyeksi',
            marker=dict(color='#ff5252', size=10, symbol='diamond'),
            text=[f"H+{h}<br>Rp {v:,.0f}" for h, v in zip(target_hari_list, target_vals)],
            textposition="top center"
        ))

        # Garis Horizontal TP dan SL
        fig.add_hline(y=r['Target_Price'], line_dash="dash", line_color="#00e676", annotation_text=f"Target Price: Rp {r['Target_Price']:,.0f}")
        fig.add_hline(y=r['Stop_Loss'], line_dash="dash", line_color="#ff1744", annotation_text=f"Stop Loss: Rp {r['Stop_Loss']:,.0f}")
        fig.add_hline(y=close_last, line_dash="dot", line_color="#ffffff", annotation_text=f"Current Close: Rp {close_last:,.0f}")

        fig.update_layout(
            title=f"Kurva Proyeksi 31 Hari: {ticker_terpilih} ({sektor_terpilih}) - Sinyal: {r['Sinyal_Swing']}",
            xaxis_title="Timeline Bursa",
            yaxis_title="Harga Saham (Rp)",
            template="plotly_dark",
            height=550,
            hovermode="x unified"
        )

        st.plotly_chart(fig, use_container_width=True)

        # Trading Action Plan Card
        st.subheader("📋 Actionable Trading Plan (Swing Trading)")
        col_plan1, col_plan2, col_plan3, col_plan4 = st.columns(4)
        col_plan1.info(f"**Rekomendasi:**\n### {r['Sinyal_Swing']}")
        col_plan2.success(f"**Target Price:**\n### Rp {r['Target_Price']:,.0f} (+{((r['Target_Price']-close_last)/close_last)*100:.1f}%)")
        col_plan3.error(f"**Stop Loss:**\n### Rp {r['Stop_Loss']:,.0f} (-5.0%)")
        col_plan4.warning(f"**Risk/Reward (RRR):**\n### {r['RRR']} : 1.0")

    else:
        st.info("Pilih emiten yang memiliki rekaman data harian untuk melihat grafik proyeksi interaktif.")

# ==============================================================================
# MODUL 4: SCREENER & PERFORMA SEKTORAL
# ==============================================================================
elif mode_halaman == "📊 Screener & Performa Sektor":
    st.header("📊 Screener Eksekutif & Rangkuman Kinerja Sektor BEI")

    if not df_daily.empty:
        # Perbandingan Rata-rata Sektor
        ringkasan_sektor = df_daily.groupby('Sektor').agg(
            Jumlah_Emiten=('Kode', 'count'),
            Rata2_Potensi_H1=('Potensi_H+1(%)', 'mean'),
            Rata2_Potensi_H7=('Potensi_H+7(%)', 'mean'),
            Rata2_Potensi_H31=('Potensi_H+31(%)', 'mean'),
            Rata2_MAPE_H31=('MAPE_H+31(%)', 'mean')
        ).round(2).reset_index()

        st.subheader("1. Kinerja Komparatif Sektor (Multi-Hari)")
        
        # Bar Chart Performa Sektor dengan Plotly
        fig_sektor = go.Figure()
        fig_sektor.add_trace(go.Bar(
            x=ringkasan_sektor['Sektor'],
            y=ringkasan_sektor['Rata2_Potensi_H31'],
            name='Rata-rata Potensi H+31 (%)',
            marker_color=['#1f77b4', '#2ca02c', '#ff7f0e', '#d62728'],
            text=ringkasan_sektor['Rata2_Potensi_H31'].apply(lambda x: f"{x:+.2f}%"),
            textposition='auto'
        ))
        fig_sektor.update_layout(
            title="Perbandingan Rata-rata Proyeksi Return H+31 per Sektor",
            yaxis_title="Potensi Kenaikan Rata-rata (%)",
            template="plotly_dark",
            height=400
        )
        st.plotly_chart(fig_sektor, use_container_width=True)

        st.table(ringkasan_sektor)

        st.markdown("---")
        st.subheader("2. Top 10 Saham Berpotensi Tertinggi (Swing Trading H+31)")
        top_10_daily = df_daily[df_daily['MAPE_H+31(%)'] <= 18.0].sort_values(by='Potensi_H+31(%)', ascending=False).head(10)
        st.dataframe(
            top_10_daily[['Sektor', 'Kode', 'Close_Terakhir', 'H+1', 'H+7', 'H+14', 'H+21', 'H+30', 'H+31', 'Potensi_H+31(%)', 'Sinyal_Swing', 'Target_Price', 'Stop_Loss', 'RRR']].style.format({
                'Close_Terakhir': 'Rp {:,.0f}',
                'H+1': 'Rp {:,.0f}',
                'H+7': 'Rp {:,.0f}',
                'H+14': 'Rp {:,.0f}',
                'H+21': 'Rp {:,.0f}',
                'H+30': 'Rp {:,.0f}',
                'H+31': 'Rp {:,.0f}',
                'Potensi_H+31(%)': '{:+.2f}%',
                'Target_Price': 'Rp {:,.0f}',
                'Stop_Loss': 'Rp {:,.0f}',
                'RRR': '{:.2f}'
            }),
            use_container_width=True
        )

        if not df_scalp.empty:
            st.markdown("---")
            st.subheader("3. Top 10 Saham Pilihan Scalping Intraday 5 Menit (+60m)")
            top_10_scalp = df_scalp[df_scalp['Net_Gain_60m(%)'] > 0.3].sort_values(by='Net_Gain_60m(%)', ascending=False).head(10)
            st.dataframe(
                top_10_scalp[['Sektor', 'Kode', 'Last_Close', '+5m', '+15m', '+30m', '+60m', 'Net_Gain_60m(%)', 'Volume_Status', 'Sinyal_Scalp', 'TP_Scalp', 'SL_Scalp']].style.format({
                    'Last_Close': 'Rp {:,.0f}',
                    '+5m': 'Rp {:,.0f}',
                    '+15m': 'Rp {:,.0f}',
                    '+30m': 'Rp {:,.0f}',
                    '+60m': 'Rp {:,.0f}',
                    'Net_Gain_60m(%)': '{:+.2f}%',
                    'TP_Scalp': 'Rp {:,.0f}',
                    'SL_Scalp': 'Rp {:,.0f}'
                }),
                use_container_width=True
            )

        st.markdown("---")
        st.subheader("4. 📖 Panduan Disiplin Trading & Money Management")
        st.markdown("""
        1. **Jam Bursa Efek Indonesia (WIB):**
           - **Sesi I:** 09:00 - 12:00 (Jumat: 09:00 - 11:30)
           - **Sesi II:** 13:30 - 15:49 (Jumat: 14:00 - 15:49)
           - *Waktu ideal untuk Scalping:* 09:05 - 10:00 (volatilitas pagi) & 14:30 - 15:30 (penutupan).
        2. **Disiplin Stop Loss (SL):**
           - **Scalping:** Maksimal cut loss 1.0% s/d 1.5% dari harga beli.
           - **Swing:** Maksimal cut loss 3.0% s/d 5.0% atau ikuti garis level SL pada grafik.
        3. **Alokasi Modal (Money Management):**
           - Maksimal 20% total portofolio per saham tunggal.
           - Risiko per trade (Risk per Trade) tidak melebihi 1% - 2% dari total modal.
        """)
