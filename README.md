# Prediksi Saham BEI Menggunakan Recurrent Neural Network (RNN) & Modern Web Terminal

Sistem prediksi dan analisis saham Bursa Efek Indonesia (BEI/IDX) berbasis Deep Learning Recurrent Neural Network (RNN) dan **Technical Confluence** yang dirancang untuk **analisis dan trading sehari-hari (*Everyday Use*)**.

Mendukung dua mode proyeksi utama:
1. **Multi-Hari (Swing Trading)**: Memprediksi harga penutupan ke **H+1, H+7, H+14, H+21, H+30, dan H+31**.
2. **Scalping Intraday (5 Menit)**: Memprediksi pergerakan jangka sangat pendek ke **+5m, +15m, +30m, dan +60m** lengkap dengan kalkulasi komisi bursa (*Fee Breakeven 0.40%*) dan deteksi lonjakan volume.

---

## 🌐 1. Modern Web Terminal (FastAPI + GSAP + Lenis + Chart.js)

Antarmuka web modern mandiri dengan kinerja tinggi (60 FPS), smooth scrolling menggunakan **Lenis**, animasi judul word-by-word menggunakan **GSAP ScrollTrigger**, kurva interaktif Chart.js, serta integrasi **Kalkulator Manajemen Risiko & Lot Otomatis**.

### Cara Menjalankan Modern Web Terminal:
- **Cara 1 (Windows 1-Click Launch):** Cukup klik dua kali file [Jalankan_Website.bat](Jalankan_Website.bat).
- **Cara 2 (Terminal / Command Prompt / PowerShell):**
  ```bash
  python server.py
  ```
  Buka browser di alamat: **`http://localhost:8000`** (Dokumentasi API otomatis tersedia di `http://localhost:8000/docs`).

### Fitur Modern Web Terminal:
1. **Interactive Deep Stock Inspector:**
   - Dropdown seluruh 167 saham dari 4 sektor.
   - Grafik interaktif Chart.js (Data aktual 60 hari + Proyeksi RNN 31 hari + Target Milestones + Garis TP & SL).
   - Tombol **"⚡ Cek Real-time Yahoo Finance"**: Mengambil harga terkini langsung dari Yahoo Finance secara on-demand tanpa perlu melatih ulang model.
   - **AI Technical Confluence Score (0 - 100)**: Penggabungan sinyal RNN dengan RSI-14, MACD Crossover, EMA 20/50 Trend, dan Volume Spike Ratio.
2. **Kalkulator Lot Saham & Money Management:**
   - Menghitung batas risiko modal maksimal dalam Rupiah sesuai persentase toleransi risiko (contoh: 2%).
   - Menghitung jumlah lot lembar saham optimal yang aman dibeli.
   - Menghitung potensi keuntungan di Target Price dan Risk-to-Reward Ratio (RRR).
3. **Multi-Hari & Scalping Screener:**
   - Pencarian cepat ticker, filter sektor, filter sinyal beli/jual, dan ekspor CSV 1-klik.
4. **Smooth Scroll & Animasi Modern:**
   - Inersia scroll alami berkat **Lenis**.
   - Animasi entrance judul per kata dan cards menggunakan **GSAP + ScrollTrigger**.

---

## 💡 What Was Missing? & How We Improved It

| Aspek | Masalah / Kelemahan Sistem Lama | Solusi & Peningkatan yang Kami Bangun |
|---|---|---|
| **Model Signal** | **Pure RNN Lag / False Breakout:** RNN murni hanya membaca sekuens harga tanpa mempedulikan momentum atau kejenuhan pasar, rentan memberikan sinyal beli saat saham overbought. | **Hybrid Technical Confluence:** Mengombinasikan RNN dengan RSI(14), MACD, EMA 20/50, dan Volume Spike. Sinyal STRONG BUY hanya aktif jika momentum terkonfirmasi sehat. |
| **Pembaruan Data** | **Data Statis:** Hasil prediksi hanya berupa snapshot saat notebook selesai dijalankan. Cepat usang ketika pasar buka keesokan harinya. | **Live On-Demand Yahoo Finance Sync:** Endpoint API `/api/stock/{ticker}/live-forecast` yang menarik candle terbaru via Yahoo Finance API dan memperbarui proyeksi secara instan. |
| **Manajemen Modal** | **Tidak Ada Panduan Ukuran Posisi:** Memberikan TP dan SL tidak membantu jika trader tidak tahu berapa lot yang boleh dibeli sesuai portofolionya. | **Kalkulator Lot Otomatis:** Fitur kalkulator interaktif terintegrasi yang menghitung alokasi lot dan rupiah maksimal berdasarkan toleransi risiko per trade (1% - 2%). |
| **Batas Regulasi** | **Prediksi Melebihi Batas IDX:** Saham tidur terkadang diproyeksikan melonjak 40% dalam 1 hari yang melanggar batas bursa. | **IDX ARA/ARB & Liquidity Guard:** Membatasi proyeksi sesuai batas Auto Rejection Atas/Bawah BEI dan menyaring saham yang minim antrean likuiditas. |
| **Antarmuka Web** | **Reload Halaman Lambat:** Dashboard lama memuat ulang (*rerun*) seluruh skrip pada setiap klik tombol. | **FastAPI + Asynchronous Frontend:** Navigasi instan tanpa reload, 60 FPS scrolling dengan Lenis, dan animasi responsif dengan GSAP. |

---

## 🎨 Animation & Smooth Scroll Libraries

Pustaka yang digunakan untuk tampilan antarmuka interaktif:

* **GSAP** → [gsap.com](https://gsap.com)
  - Standar animasi web berkinerja tinggi dan timeline ScrollTrigger.
  - *Prompt siap pakai:* `"Pakai GSAP + ScrollTrigger, judul muncul per kata saat discroll"`
* **Motion** → [motion.dev](https://motion.dev)
  - Animasi deklaratif untuk gestures, micro-interactions, dan card hover.
  - *Prompt siap pakai:* `"Pakai Motion untuk animasi masuk card dan hover"`
* **Lenis** → [lenis.dev](https://lenis.dev)
  - Engine smooth scroll ultra-ringan dengan kurva inersia alami.
  - *Prompt siap pakai:* `"Pasang Lenis untuk smooth scroll"`

> 💡 **Tips Penggunaan:** Pilih salah satu antara GSAP atau Motion untuk project skala kecil/menengah, lalu tambahkan Lenis untuk smooth scroll. Tidak perlu memakai semua sekaligus agar bundle tetap efisien.

---

## 🌐 2. Alternatif: Streamlit Web Terminal

Jika Anda ingin antarmuka alternatif berbasis Streamlit:
- **Cara Menjalankan:** Klik ganda [Jalankan_Web_App.bat](Jalankan_Web_App.bat) atau jalankan `streamlit run app.py` (Port: `8501`).

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

## Cara Menjalankan

1. Clone repositori:
   ```bash
   git clone https://github.com/iiiikimii/Prediksi_Saham.git
   cd Prediksi_Saham
   ```
2. Pasang dependensi:
   ```bash
   pip install -r requirements.txt
   ```
3. Menjalankan Website Utama (Modern Web Terminal):
   - Klik ganda [Jalankan_Website.bat](Jalankan_Website.bat) atau jalankan `python server.py`
4. Menjalankan Streamlit Web App:
   - Klik ganda [Jalankan_Web_App.bat](Jalankan_Web_App.bat) atau jalankan `streamlit run app.py`
5. Menjalankan Model Batch Training / Google Colab:
   - Buka dan jalankan [Prediksi_saham.ipynb](Prediksi_saham.ipynb).
