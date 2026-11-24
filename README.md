# Prediksi Saham BEI Menggunakan Recurrent Neural Network (RNN) & Node.js Web Terminal

Sistem prediksi dan analisis saham Bursa Efek Indonesia (BEI/IDX) berbasis Deep Learning Recurrent Neural Network (RNN) dan **Technical Confluence** yang dirancang untuk **analisis dan trading sehari-hari (*Everyday Use*)**, dibangun dengan **JavaScript (Node.js & Express)** dan siap dideploy (*deployment-ready*).

Mendukung dua mode proyeksi utama:
1. **Multi-Hari (Swing Trading)**: Memprediksi harga penutupan ke **H+1, H+7, H+14, H+21, H+30, dan H+31**.
2. **Scalping Intraday (5 Menit)**: Memprediksi pergerakan jangka sangat pendek ke **+5m, +15m, +30m, dan +60m** lengkap dengan kalkulasi komisi bursa (*Fee Breakeven 0.40%*) dan deteksi lonjakan volume.

---

## 📁 Struktur Folder Proyek (Terorganisir & Siap Deploy)

Struktur proyek telah ditata secara modular, bersih dari framework Streamlit, dan siap di-deploy ke **Vercel**, **Render**, **Railway**, atau **VPS**:

```text
Prediksi Saham/
├── backend/                  # 🟢 Backend Node.js & Express REST API
│   ├── server.js             # Routing REST API utama & server statis
│   ├── dataService.js        # Parser CSV, kalkulator indikator teknikal (RSI, MACD, EMA)
│   ├── yahooService.js       # Live API Yahoo Finance real-time (Pure JavaScript fetch)
│   ├── cleanData.js          # Skrip pembersih dan perapian data CSV
│   └── sectors.js            # Database klasifikasi 167 emiten di 4 sektor
├── frontend/                 # 🔵 Frontend Web Terminal (HTML, CSS, JS)
│   ├── index.html            # UI Dark Cyber Terminal (Hero, Chart, Calculator, Tables)
│   ├── css/
│   │   └── style.css         # Styling Glassmorphism, Neon Accents & Badge System
│   └── js/
│       └── app.js            # Client-side Logic (Lenis Smooth Scroll + GSAP + Chart.js)
├── data/                     # 📊 Data Prediksi Rapi & Terformat (Siap Baca & Deploy)
│   ├── rekomendasi_saham_multihari_rapi.csv # CSV Multi-Hari rapi dengan format Rupiah & Persen
│   ├── rekomendasi_saham_scalping_rapi.csv  # CSV Scalping rapi dengan sinyal & zona entry
│   ├── latest_multihari.csv                 # Data numerik bersih H+1 s.d. H+31 (165 saham)
│   └── latest_scalping.csv                  # Data numerik bersih +5m s.d. +60m (158 saham)
├── Stock_RNN_Project/        # 🧠 Mesin Training Offline (Python & TensorFlow)
│   ├── models/               # Model RNN terkompilasi (.keras)
│   ├── data_daily/           # Dataset historis OHLCV per emiten
│   └── logs/                 # Log CSV inferensi
├── Prediksi_saham.ipynb      # 📓 Notebook Jupyter untuk melatih dan update model batch
├── server.js                 # 🚀 Entry Point Utama Node.js di Root
├── package.json              # 📋 Konfigurasi npm, dependensi Express & script start
├── vercel.json               # ⚡ Konfigurasi 1-Click Deploy ke Vercel
├── Procfile                  # 🚂 Konfigurasi deploy ke Render / Railway / Heroku
├── Jalankan_Website.bat      # 🖱️ 1-Click Launcher Windows (Port 3000)
├── requirements.txt          # Dependensi Python minimal untuk training notebook
└── README.md                 # Dokumentasi komprehensif
```

---

## 📊 File CSV yang Rapi & Mudah Dibaca

Semua data prediksi telah dibersihkan dari angka desimal berantakan dan diformat menjadi tabel yang rapi:

1. **[data/rekomendasi_saham_multihari_rapi.csv](data/rekomendasi_saham_multihari_rapi.csv)**
   - *Kolom:* `No, Sektor, Kode_Saham, Harga_Terakhir_Rp, Target_H1_Rp, Target_H7_Rp, Target_H14_Rp, Target_H21_Rp, Target_H30_Rp, Target_H31_Rp, Potensi_H31_Persen, Sinyal_Trading, Target_Price_TP, Stop_Loss_SL, Risk_Reward_Ratio, Akurasi_MAPE, Kategori_Presisi`
   - *Fitur:* Seluruh harga dalam Rupiah bulat (misal: 5800, 6825), persentase kenaikan jelas (`+12.48%`), dan peringkat potensi return tertinggi.
2. **[data/rekomendasi_saham_scalping_rapi.csv](data/rekomendasi_saham_scalping_rapi.csv)**
   - *Kolom:* `No, Sektor, Kode_Saham, Harga_Terakhir_Rp, Prediksi_5m_Rp, Prediksi_15m_Rp, Prediksi_30m_Rp, Prediksi_60m_Rp, Net_Gain_60m_Persen, Status_Volume, Sinyal_Scalp, Zona_Entry, Target_Profit_TP, Stop_Loss_SL, Akurasi_MAPE`
   - *Fitur:* Memperhitungkan potongan fee bursa 0.40%, mendeteksi lonjakan volume, dan menyajikan batas zona entry yang aman.

---

## 🌐 Cara Menjalankan Website (Node.js & JavaScript)

Website ini menggunakan **Node.js & Express** murni sehingga sangat ringan (< 25 MB) dan tidak memerlukan runtime Python untuk membukanya.

### Cara Menjalankan Secara Lokal:
- **Cara 1 (Windows 1-Click Launch):** Cukup klik dua kali file [Jalankan_Website.bat](Jalankan_Website.bat).
- **Cara 2 (Terminal / Command Prompt / PowerShell):**
  ```bash
  npm install
  npm start
  ```
  Buka browser Anda di alamat: **`http://localhost:3000`**.

---

## 🔄 Sistem Pembaruan Data Otomatis Harian (100% Cloud Auto-Update)

Ketika proyek ini dideploy ke cloud, **Anda TIDAK PERLU menjalankan skrip secara manual setiap hari**. Sistem pembaruan otomatis telah terintegrasi di 3 lapisan:

1. **GitHub Actions Scheduled Cron ([.github/workflows/daily_stock_update.yml](.github/workflows/daily_stock_update.yml)):**
   - Berjalan otomatis di cloud GitHub **setiap hari bursa (Senin - Jumat) pukul 16:30 WIB** (30 menit setelah pasar BEI tutup).
   - Menjalankan `node backend/cronUpdater.js` untuk menarik data candle penutupan terbaru 167 emiten dari Yahoo Finance.
   - Menghitung ulang proyeksi return, sinyal trading, level TP/SL, dan memperbarui seluruh file CSV di `data/`.
   - Melakukan *git commit & push* otomatis ke branch `main`, yang langsung memicu **auto-redeploy** di Vercel atau Render.
   - *Komputer Anda tidak perlu menyala!* Semuanya berjalan gratis dan otomatis di server cloud GitHub.

2. **Vercel Cron Jobs ([vercel.json](vercel.json)):**
   - Memanggil endpoint backend `/api/cron/update` setiap hari bursa pukul 16:30 WIB sebagai redundansi pembaruan otomatis.

3. **Live On-Demand Inspection:**
   - Tombol *"⚡ Cek Real-time Yahoo Finance"* di halaman web memungkinkan pengunjung melihat harga live detik itu juga untuk emiten mana saja.

---

## ☁️ Panduan Deploy ke Cloud (Free Hosting)

### Opsi A: Deploy ke Vercel (Rekomendasi - Sangat Mudah)
1. Push repositori ke GitHub Anda.
2. Buka dashboard [Vercel](https://vercel.com) dan klik **"Add New Project"**.
3. Hubungkan repositori GitHub `Prediksi_Saham`.
4. File [vercel.json](vercel.json) dan [package.json](package.json) akan langsung mendeteksi `server.js` sebagai Serverless Function secara otomatis.
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
| **Runtime & Deploy** | **Ketergantungan Streamlit / Python Berat:** Menjalankan website dengan Streamlit dan TensorFlow membutuhkan memori besar (>2GB), lambat dibuka, dan sulit di-deploy ke hosting gratis. | **Pure Node.js & Express:** Membangun backend JS berukuran ringan (<15MB), API native fetch ke Yahoo Finance, dan data cache terstruktur yang siap dideploy instan ke Vercel/Render. |
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

## 4 Sektor Utama yang Dicakup (167 Emiten)

* **Perbankan (47 Emiten)**:
  * `BBCA`, `BBRI`, `BMRI`, `BBNI`, `BRIS`, `BBTN`, `BNGA`, `BDMN`, `NISP`, `PNBN`, `BNLI`, `BNII`, `MEGA`, `BTPN`, `BTPS`, `BJBR`, `BJTM`, `BEKS`, `ARTO`, `BBYB`, `BBHI`, `AGRO`, `BANK`, `AMAR`, `BBSI`, `BACA`, `BABP`, `BBKP`, `BCIC`, `BGTG`, `BINA`, `BKSW`, `BMAS`, `BNBA`, `BBMD`, `BSIM`, `BSWD`, `BVIC`, `DNAR`, `INPC`, `MASB`, `MAYA`, `MCOR`, `NOBU`, `PNBS`, `SDRA`, `AGRS`
* **Makanan & Minuman / Consumer Staples (52 Emiten)**:
  * `ICBP`, `INDF`, `MYOR`, `ROTI`, `GOOD`, `STTP`, `SKLT`, `SKBM`, `CEKA`, `CAMP`, `KEJU`, `HOKI`, `BUDI`, `AISA`, `ALTO`, `COCO`, `FOOD`, `IKAN`, `PSDN`, `PMMP`, `ENZO`, `BOBA`, `NASI`, `TAYS`, `GULA`, `TRGU`, `WAPO`, `CMRY`, `ULTJ`, `CLEO`, `ADES`, `MLBI`, `DLTA`, `BEER`, `WINE`, `DMND`, `SOUL`, `TGUK`, `CPIN`, `JPFA`, `MAIN`, `WMUU`, `BEEF`, `CPRO`, `DSFI`, `CRAB`, `PCAR`, `SIPD`, `AMMS`, `DEWI`, `ISEA`, `AGAR`
* **Perkebunan & Agribisnis (34 Emiten)**:
  * `AALI`, `LSIP`, `TAPG`, `DSNG`, `SSMS`, `SIMP`, `SGRO`, `STAA`, `TBLA`, `SMAR`, `NSSS`, `BWPT`, `GZCO`, `JAWA`, `ANJT`, `CSRA`, `FAPA`, `MGRO`, `PGUN`, `PNGO`, `PSGO`, `UNSP`, `JARR`, `CBUT`, `MKTR`, `TLDN`, `OILS`, `PTPS`, `PALM`, `GOLL`, `MAGP`, `BISI`, `ANDI`, `FISH`
* **Mineral & Logam (34 Emiten)**:
  * `AMMN`, `ANTM`, `INCO`, `MDKA`, `MBMA`, `NCKL`, `TINS`, `BRMS`, `PSAB`, `ARCI`, `NICL`, `NICE`, `DKFT`, `IFSH`, `CITA`, `ZINC`, `SQMI`, `SMGA`, `HRUM`, `CUAN`, `KRAS`, `ISSP`, `GGRP`, `INAI`, `ALKA`, `ALMI`, `GDST`, `BAJA`, `NIKL`, `LION`, `TBMS`, `KBLI`, `VOKS`, `IKBI`

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
2. Pasang dependensi Node.js:
   ```bash
   npm install
   ```
3. Menjalankan Website (Modern Web Terminal):
   - Klik ganda [Jalankan_Website.bat](Jalankan_Website.bat) atau jalankan:
     ```bash
     npm start
     ```
   - Buka browser di: `http://localhost:3000`
4. Menjalankan Model Batch Training / Google Colab (Opsional):
   - Pasang dependensi python: `pip install -r requirements.txt`
   - Buka dan jalankan [Prediksi_saham.ipynb](Prediksi_saham.ipynb).
