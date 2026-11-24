# Prediksi Saham BEI Menggunakan Recurrent Neural Network (RNN) & Node.js Web Terminal

Sistem prediksi dan analisis saham Bursa Efek Indonesia (BEI/IDX) berbasis Deep Learning Recurrent Neural Network (RNN) dan **Technical Confluence** yang dirancang untuk **analisis dan trading sehari-hari (*Everyday Use*)**, siap dideploy (*deployment-ready*).

Mendukung dua mode proyeksi utama:
1. **Multi-Hari (Swing Trading)**: Memprediksi harga penutupan ke **H+1, H+7, H+14, H+21, H+30, dan H+31**.
2. **Scalping Intraday (5 Menit)**: Memprediksi pergerakan jangka sangat pendek ke **+5m, +15m, +30m, dan +60m** lengkap dengan kalkulasi komisi bursa (*Fee Breakeven 0.40%*) dan deteksi lonjakan volume.

---

## 📁 Struktur Folder Proyek (Terorganisir & Siap Deploy)

Struktur proyek telah ditata secara modular agar mudah di-deploy ke berbagai platform hosting seperti **Vercel**, **Render**, **Railway**, atau **VPS**:

```text
Prediksi Saham/
├── backend/                  # Backend Node.js & Express API
│   ├── server.js             # Server Express utama & routing API
│   ├── dataService.js        # Parser CSV, kalkulator indikator teknikal (RSI, MACD, EMA) & interpolasi
│   ├── yahooService.js       # Live API Yahoo Finance real-time (Pure JavaScript fetch)
│   └── sectors.js            # Database klasifikasi 167 emiten di 4 sektor
├── frontend/                 # Frontend Modern Web Terminal (Clean Static Web)
│   ├── index.html            # UI Dark Cyber Terminal (Hero, Chart, Calculator, Tables)
│   ├── css/
│   │   └── style.css         # Styling Glassmorphism, Neon Accents & Badge System
│   └── js/
│       └── app.js            # Client-side Logic (Lenis Smooth Scroll + GSAP + Chart.js)
├── data/                     # Data Prediksi Siap Deploy (Mandiri tanpa Python)
│   ├── latest_multihari.csv  # Data hasil prediksi H+1 s.d. H+31 (165 saham)
│   └── latest_scalping.csv   # Data hasil scalping +5m s.d. +60m (158 saham)
├── Stock_RNN_Project/        # Mesin Training Offline (Python & TensorFlow)
│   ├── models/               # Model RNN terkompilasi (.keras)
│   ├── data_daily/           # Dataset historis OHLCV per emiten
│   └── logs/                 # Log hasil inferensi
├── Prediksi_saham.ipynb      # Notebook Jupyter untuk melatih dan update model batch
├── app.py                    # Alternatif antarmuka Streamlit (Python)
├── server.py                 # Alternatif server FastAPI (Python)
├── server.js                 # Entry point utama Node.js (Root)
├── package.json              # Konfigurasi npm, dependensi Express & script start
├── vercel.json               # Konfigurasi deployment Vercel
├── Procfile                  # Konfigurasi deployment Railway / Render / Heroku
├── Jalankan_Website.bat      # 1-Click Launcher Website (Node.js Port 3000)
├── Jalankan_Web_App.bat      # 1-Click Launcher Streamlit (Python Port 8501)
├── requirements.txt          # Dependensi Python untuk notebook/training
└── README.md                 # Dokumentasi komprehensif
```

---

## 🌐 1. Cara Menjalankan Website (Node.js & JavaScript)

Aplikasi web sekarang menggunakan **JavaScript (Node.js & Express)** sehingga dapat berjalan cepat tanpa kendala konfigurasi Python di Windows, serta langsung siap dideploy ke cloud.

### Cara Menjalankan Secara Lokal:
- **Cara 1 (Windows 1-Click Launch):** Cukup klik dua kali file [Jalankan_Website.bat](Jalankan_Website.bat).
- **Cara 2 (Terminal / Command Prompt / PowerShell):**
  ```bash
  npm install
  npm start
  ```
  Buka browser Anda di alamat: **`http://localhost:3000`**.

---

## ☁️ Panduan Deploy ke Cloud (Free Hosting)

### Opsi A: Deploy ke Vercel (Rekomendasi - Sangat Mudah)
1. Push repositori ke GitHub Anda.
2. Buka dashboard [Vercel](https://vercel.com) dan klik **"Add New Project"**.
3. Hubungkan repositori GitHub `Prediksi_Saham`.
4. File [vercel.json](vercel.json) dan [package.json](package.json) yang telah kami siapkan akan langsung mendeteksi `server.js` sebagai Serverless Function secara otomatis.
5. Klik **Deploy**! Website Anda akan langsung online dengan domain gratis `.vercel.app`.

### Opsi B: Deploy ke Render atau Railway
1. Buat akun di [Render](https://render.com) atau [Railway](https://railway.app).
2. Pilih **New Web Service** dan hubungkan repositori `Prediksi_Saham`.
3. Pilih Environment: **Node.js**.
4. Build Command: `npm install`
5. Start Command: `npm start` (atau otomatis membaca [Procfile](Procfile)).
6. Klik **Deploy Web Service**.

---

## 💡 What Was Missing? & How We Improved It

| Aspek | Masalah / Kelemahan Sistem Lama | Solusi & Peningkatan yang Kami Bangun |
|---|---|---|
| **Runtime & Deploy** | **Ketergantungan Python Berat:** Menjalankan website dengan Python memerlukan instalasi TensorFlow/CUDA yang besar (~2GB), menyulitkan hosting gratis. | **Pure Node.js & Express:** Membangun backend JS berukuran ringan (<15MB), API native fetch ke Yahoo Finance, dan data cache terstruktur yang siap dideploy instan. |
| **Model Signal** | **Pure RNN Lag / False Breakout:** RNN murni hanya membaca sekuens harga tanpa mempedulikan momentum atau kejenuhan pasar, rentan memberikan sinyal beli saat saham overbought. | **Hybrid Technical Confluence:** Mengombinasikan RNN dengan RSI(14), MACD, EMA 20/50, dan Volume Spike. Sinyal STRONG BUY hanya aktif jika momentum terkonfirmasi sehat. |
| **Pembaruan Data** | **Data Statis:** Hasil prediksi hanya berupa snapshot saat notebook selesai dijalankan. Cepat usang ketika pasar buka keesokan harinya. | **Live On-Demand Yahoo Finance Sync:** Tombol *"⚡ Cek Real-time Yahoo Finance"* menarik candle terbaru via Yahoo Finance API secara asinkron tanpa perlu restart server. |
| **Manajemen Modal** | **Tidak Ada Panduan Ukuran Posisi:** Memberikan TP dan SL tidak membantu jika trader tidak tahu berapa lot yang boleh dibeli sesuai portofolionya. | **Kalkulator Lot Otomatis:** Fitur kalkulator interaktif terintegrasi yang menghitung alokasi lot dan rupiah maksimal berdasarkan toleransi risiko per trade (1% - 2%). |
| **Antarmuka Web** | **Reload Halaman Lambat:** Dashboard lama memuat ulang (*rerun*) seluruh skrip pada setiap klik tombol. | **Modern Web Terminal:** Navigasi instan tanpa reload, 60 FPS scrolling dengan Lenis, dan animasi responsif dengan GSAP. |

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

## 🌐 2. Alternatif Antarmuka Lainnya

1. **Python Streamlit Terminal:**
   - Jalankan [Jalankan_Web_App.bat](Jalankan_Web_App.bat) atau `streamlit run app.py` (Port: `8501`).
2. **Jupyter Notebook (Model Training):**
   - Buka dan jalankan [Prediksi_saham.ipynb](Prediksi_saham.ipynb) untuk retraining model batch 167 saham.

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
