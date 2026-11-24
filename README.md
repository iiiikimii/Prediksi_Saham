# Prediksi Saham BEI Menggunakan Recurrent Neural Network (RNN)

Sistem prediksi dan analisis saham Bursa Efek Indonesia (BEI/IDX) berbasis Deep Learning Recurrent Neural Network (RNN) yang dirancang untuk **analisis dan trading sehari-hari (*Everyday Use*)**.

Mendukung dua mode proyeksi utama:
1. **Multi-Hari (Swing Trading)**: Memprediksi harga penutupan ke **H+1, H+7, H+14, H+21, H+30, dan H+31**.
2. **Scalping Intraday (5 Menit)**: Memprediksi pergerakan jangka sangat pendek ke **+5m, +15m, +30m, dan +60m** lengkap dengan kalkulasi komisi bursa (*Fee Breakeven*) dan deteksi lonjakan volume.

---

## 4 Sektor Utama yang Dicakup (167 Emiten)

* **Perbankan (47 Emiten)**:
  * *KBMI 4 & Bank Besar*: `BBCA`, `BBRI`, `BMRI`, `BBNI`, `BRIS`, `BBTN`, `BNGA`, `BDMN`, `NISP`, `PNBN`, `BNLI`, `BNII`, `MEGA`, `BTPN`, `BTPS`
  * *BPD & Bank Digital*: `BJBR`, `BJTM`, `BEKS`, `ARTO`, `BBYB`, `BBHI`, `AGRO`, `BANK`, `AMAR`, `BBSI`
  * *Swasta Komersial*: `BACA`, `BABP`, `BBKP`, `BCIC`, `BGTG`, `BINA`, `BKSW`, `BMAS`, `BNBA`, `BBMD`, `BSIM`, `BSWD`, `BVIC`, `DNAR`, `INPC`, `MASB`, `MAYA`, `MCOR`, `NOBU`, `PNBS`, `SDRA`, `AGRS`
* **Makanan & Minuman / Consumer Staples (52 Emiten)**:
  * *Olahan & Kemasan*: `ICBP`, `INDF`, `MYOR`, `ROTI`, `GOOD`, `STTP`, `SKLT`, `SKBM`, `CEKA`, `CAMP`, `KEJU`, `HOKI`, `BUDI`, `AISA`, `ALTO`, `COCO`, `FOOD`, `IKAN`, `PSDN`, `PMMP`, `ENZO`, `BOBA`, `NASI`, `TAYS`, `GULA`, `TRGU`, `WAPO`
  * *Minuman & Dairy*: `CMRY`, `ULTJ`, `CLEO`, `ADES`, `MLBI`, `DLTA`, `BEER`, `WINE`, `DMND`, `SOUL`, `TGUK`
  * *Poultry & Seafood*: `CPIN`, `JPFA`, `MAIN`, `WMUU`, `BEEF`, `CPRO`, `DSFI`, `CRAB`, `PCAR`, `SIPD`, `AMMS`, `DEWI`, `ISEA`, `AGAR`
* **Perkebunan & Agribisnis (34 Emiten)**:
  * *CPO Blue Chip*: `AALI`, `LSIP`, `TAPG`, `DSNG`, `SSMS`, `SIMP`, `SGRO`, `STAA`, `TBLA`, `SMAR`
  * *Mid-Cap CPO & Hilirisasi*: `NSSS`, `BWPT`, `GZCO`, `JAWA`, `ANJT`, `CSRA`, `FAPA`, `MGRO`, `PGUN`, `PNGO`, `PSGO`, `UNSP`, `JARR`, `CBUT`, `MKTR`, `TLDN`, `OILS`, `PTPS`
  * *Agribisnis & Benih*: `PALM`, `GOLL`, `MAGP`, `BISI`, `ANDI`, `FISH`
* **Mineral & Logam (34 Emiten)**:
  * *Emas, Tembaga, Nikel, Timah, Bauksit*: `AMMN`, `ANTM`, `INCO`, `MDKA`, `MBMA`, `NCKL`, `TINS`, `BRMS`, `PSAB`, `ARCI`, `NICL`, `NICE`, `DKFT`, `IFSH`, `CITA`, `ZINC`, `SQMI`, `SMGA`, `HRUM`, `CUAN`
  * *Smelter Logam Dasar & Fabrikasi*: `KRAS`, `ISSP`, `GGRP`, `INAI`, `ALKA`, `ALMI`, `GDST`, `BAJA`, `NIKL`, `LION`, `TBMS`, `KBLI`, `VOKS`, `IKBI`

---

## Fitur Utama

- **Dual-Environment**: Kompatibel untuk dijalankan di **Google Colab** maupun **Mesin Lokal (VS Code / Jupyter Notebook)**.
- **Everyday Operational Mode**:
  - `MODE_RUN = "TOP_LIQUID"`: Scan kilat saham-saham paling likuid (~2-3 menit).
  - `MODE_RUN = "CUSTOM"`: Analisis cepat watchlist saham pilihan.
  - `MODE_RUN = "SCAN_ALL"`: Pemindaian menyeluruh 167 emiten.
- **Model Caching (`RETRAIN_MODEL = False`)**: Muat model yang telah dilatih untuk inferensi instan dalam hitungan detik.
- **Actionable Trading Plan**: Setiap emiten dilengkapi sinyal (`STRONG BUY`, `BUY`, `HOLD`, `SELL`), Target Price (TP), Stop Loss (SL), dan Risk-Reward Ratio (RRR).
- **Auto-Export & Visualisasi**: Grafik resolusi tinggi otomatis tersimpan ke folder `reports/`, serta ringkasan rekomendasi diekspor ke file CSV.

---

## Cara Menjalankan

1. Clone repositori ini:
   ```bash
   git clone https://github.com/iiiikimii/Prediksi_Saham.git
   cd Prediksi_Saham
   ```
2. Pasang dependensi yang diperlukan:
   ```bash
   pip install -r requirements.txt
   # atau: pip install pandas yfinance scikit-learn tensorflow matplotlib numpy ipykernel
   ```
3. Buka dan jalankan [Prediksi_saham.ipynb](Prediksi_saham.ipynb).
