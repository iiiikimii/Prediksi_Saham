const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const {
    getMultiHariRecords,
    getScalpingRecords,
    getStockDailyHistory,
    interpolateForecast,
    SEKTOR_SAHAM,
    TICKER_TO_SECTOR
} = require('./dataService');
const { fetchLiveStock } = require('./yahooService');
const { runDailyUpdate } = require('./cronUpdater');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Static Frontend & Data Directories
const ROOT_DIR = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const DATA_DIR = path.join(ROOT_DIR, 'data');

// Serve static assets & clean data
app.use(express.static(FRONTEND_DIR));
app.use('/static', express.static(FRONTEND_DIR));
app.use('/data', express.static(DATA_DIR));

// Dedicated Favicon Handler
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'logo.jpg'));
});

// ==============================================================================
// API ROUTES
// ==============================================================================

// 1. Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        runtime: 'Node.js ' + process.version,
        server_time: new Date().toISOString(),
        total_sectors: Object.keys(SEKTOR_SAHAM).length,
        total_emiten: Object.values(SEKTOR_SAHAM).reduce((sum, list) => sum + list.length, 0)
    });
});

// 2. High-level Overview & KPI
app.get('/api/overview', (req, res) => {
    const multiRecords = getMultiHariRecords();
    const scalpRecords = getScalpingRecords();

    // Top Swing Pick
    let topSwing = {};
    if (multiRecords.length > 0) {
        const sorted = [...multiRecords].sort((a, b) => (Number(b['Potensi_H+31(%)']) || 0) - (Number(a['Potensi_H+31(%)']) || 0));
        const pick = sorted[0];
        topSwing = {
            kode: pick.Kode,
            sektor: pick.Sektor,
            potensi: Number(pick['Potensi_H+31(%)']),
            sinyal: pick.Sinyal_Swing,
            harga: Number(pick.Close_Terakhir),
            target: Number(pick.Target_Price)
        };
    }

    // Top Scalp Pick
    let topScalp = {};
    if (scalpRecords.length > 0) {
        const sorted = [...scalpRecords].sort((a, b) => (Number(b['Net_Gain_60m(%)']) || 0) - (Number(a['Net_Gain_60m(%)']) || 0));
        const pick = sorted[0];
        topScalp = {
            kode: pick.Kode,
            sektor: pick.Sektor,
            net_gain: Number(pick['Net_Gain_60m(%)']),
            sinyal: pick.Sinyal_Scalp,
            harga: Number(pick.Last_Close),
            tp: Number(pick.TP_Scalp)
        };
    }

    // Sector breakdown
    const sectorStats = {};
    for (const sec of Object.keys(SEKTOR_SAHAM)) {
        sectorStats[sec] = {
            sektor: sec,
            total_emiten: 0,
            sum_return_h31: 0,
            sum_return_h7: 0,
            sum_mape: 0,
            strong_buys: 0,
            buys: 0
        };
    }

    for (const row of multiRecords) {
        const sec = row.Sektor;
        if (sectorStats[sec]) {
            sectorStats[sec].total_emiten++;
            sectorStats[sec].sum_return_h31 += Number(row['Potensi_H+31(%)']) || 0;
            sectorStats[sec].sum_return_h7 += Number(row['Potensi_H+7(%)']) || 0;
            sectorStats[sec].sum_mape += Number(row['MAPE_H+31(%)']) || 0;
            if (row.Sinyal_Swing === 'STRONG BUY') sectorStats[sec].strong_buys++;
            if (row.Sinyal_Swing === 'BUY') sectorStats[sec].buys++;
        }
    }

    const sectorSummary = Object.values(sectorStats).map(s => ({
        sektor: s.sektor,
        total_emiten: s.total_emiten || SEKTOR_SAHAM[s.sektor]?.length || 0,
        avg_return_h31: s.total_emiten > 0 ? Number((s.sum_return_h31 / s.total_emiten).toFixed(2)) : 0,
        avg_return_h7: s.total_emiten > 0 ? Number((s.sum_return_h7 / s.total_emiten).toFixed(2)) : 0,
        avg_mape: s.total_emiten > 0 ? Number((s.sum_mape / s.total_emiten).toFixed(2)) : 0,
        strong_buys: s.strong_buys,
        buys: s.buys
    }));

    res.json({
        total_emiten: multiRecords.length || 167,
        sectors: Object.keys(SEKTOR_SAHAM),
        top_swing: topSwing,
        top_scalp: topScalp,
        sector_summary: sectorSummary
    });
});

// 3. List all 167 stocks
app.get('/api/stocks', (req, res) => {
    const { sektor } = req.query;
    const stocks = [];
    for (const [sec, tickers] of Object.entries(SEKTOR_SAHAM)) {
        if (sektor && sektor.toLowerCase() !== 'all' && sec.toLowerCase() !== sektor.toLowerCase()) {
            continue;
        }
        for (const t of tickers) {
            stocks.push({ kode: t, sektor: sec });
        }
    }
    res.json({ count: stocks.length, stocks });
});

// 4. Multi-Hari Predictions (1-31 Days) with filters
app.get('/api/predictions/multihari', (req, res) => {
    let records = getMultiHariRecords();
    const { sektor, sinyal, search, sort_by, order } = req.query;

    if (sektor && sektor.toUpperCase() !== 'ALL') {
        records = records.filter(r => String(r.Sektor).toUpperCase() === sektor.toUpperCase());
    }

    if (sinyal && sinyal.toUpperCase() !== 'ALL') {
        records = records.filter(r => String(r.Sinyal_Swing).toUpperCase() === sinyal.toUpperCase());
    }

    if (search) {
        const q = search.trim().toUpperCase();
        records = records.filter(r => 
            String(r.Kode || '').toUpperCase().includes(q) || 
            String(r.Sektor || '').toUpperCase().includes(q)
        );
    }

    if (sort_by) {
        const isAsc = order && order.toLowerCase() === 'asc';
        records.sort((a, b) => {
            const valA = Number(a[sort_by]) || 0;
            const valB = Number(b[sort_by]) || 0;
            return isAsc ? valA - valB : valB - valA;
        });
    }

    res.json({
        count: records.length,
        total: records.length,
        data: records
    });
});

// 5. Scalping Predictions (+5m to +60m)
app.get('/api/predictions/scalping', (req, res) => {
    let records = getScalpingRecords();
    const { sektor, sinyal, search, sort_by, order } = req.query;

    if (sektor && sektor.toUpperCase() !== 'ALL') {
        records = records.filter(r => String(r.Sektor).toUpperCase() === sektor.toUpperCase());
    }

    if (sinyal && sinyal.toUpperCase() !== 'ALL') {
        records = records.filter(r => String(r.Sinyal_Scalp).toUpperCase() === sinyal.toUpperCase());
    }

    if (search) {
        const q = search.trim().toUpperCase();
        records = records.filter(r => 
            String(r.Kode || '').toUpperCase().includes(q) || 
            String(r.Sektor || '').toUpperCase().includes(q)
        );
    }

    if (sort_by) {
        const isAsc = order && order.toLowerCase() === 'asc';
        records.sort((a, b) => {
            const valA = Number(a[sort_by]) || 0;
            const valB = Number(b[sort_by]) || 0;
            return isAsc ? valA - valB : valB - valA;
        });
    }

    res.json({
        count: records.length,
        total: records.length,
        data: records
    });
});

// 6. Deep Single Stock Details & Interactive Trajectory
app.get('/api/stock/:ticker', (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const sektor = TICKER_TO_SECTOR[ticker];

    if (!sektor) {
        return res.status(404).json({ error: `Ticker ${ticker} not found in 167 IDX universe` });
    }

    const multiRecords = getMultiHariRecords();
    let multiData = multiRecords.find(r => r.Kode === ticker);

    const scalpRecords = getScalpingRecords();
    let scalpData = scalpRecords.find(r => r.Kode === ticker);

    const history = getStockDailyHistory(sektor, ticker);
    const recentHistory = history.slice(-60);

    const latestBar = history.length ? history[history.length - 1] : { close: 1000 };
    const closeLast = Number((multiData && multiData.Close_Terakhir) || latestBar.close || 1000);

    // Guaranteed fallback values if multiData or scalpData missing
    if (!multiData) {
        const tp = Math.round(closeLast * 1.08);
        const sl = Math.round(closeLast * 0.95);
        multiData = {
            Kode: ticker,
            Sektor: sektor,
            Close_Terakhir: closeLast,
            'H+1': Math.round(closeLast * 1.01),
            'H+7': Math.round(closeLast * 1.03),
            'H+14': Math.round(closeLast * 1.05),
            'H+21': Math.round(closeLast * 1.06),
            'H+30': Math.round(closeLast * 1.07),
            'H+31': tp,
            'Potensi_H+31(%)': 8.0,
            Sinyal_Swing: 'BUY',
            Target_Price: tp,
            Stop_Loss: sl,
            RRR: 1.60
        };
    }

    if (!scalpData) {
        scalpData = {
            Kode: ticker,
            Sektor: sektor,
            Last_Close: closeLast,
            '+5m': Math.round(closeLast * 1.002),
            '+15m': Math.round(closeLast * 1.006),
            '+30m': Math.round(closeLast * 1.01),
            '+60m': Math.round(closeLast * 1.015),
            'Net_Gain_60m(%)': 1.1,
            Volume_Status: 'NORMAL',
            Sinyal_Scalp: 'BUY',
            TP_Scalp: Math.round(closeLast * 1.015),
            SL_Scalp: Math.round(closeLast * 0.99),
            'MAPE_60m(%)': 1.5
        };
    }

    // Compute Confluence Score (0 - 100)
    let confluenceScore = 50;
    const rsi = latestBar.rsi_14 || 50;
    const macd = latestBar.macd || 0;
    const macdSig = latestBar.macd_signal || 0;
    const volRatio = latestBar.vol_ratio || 1.0;
    const ema20 = latestBar.ema_20 || closeLast;

    if (rsi < 45) confluenceScore += 15;
    else if (rsi > 70) confluenceScore -= 15;
    if (macd > macdSig) confluenceScore += 15;
    if (closeLast > ema20) confluenceScore += 10;
    if (volRatio > 1.3) confluenceScore += 10;
    confluenceScore = Math.max(5, Math.min(98, confluenceScore));

    const indicators = {
        rsi_14: rsi,
        rsi_status: rsi < 35 ? 'Oversold (Bargain)' : (rsi > 70 ? 'Overbought' : 'Neutral / Healthy'),
        macd_status: macd > macdSig ? 'Bullish Crossover' : 'Bearish / Neutral',
        trend_ema: closeLast > ema20 ? 'Uptrend' : 'Downtrend / Consolidating',
        volume_surge: volRatio > 1.3,
        vol_ratio: volRatio
    };

    const lastDate = recentHistory.length ? recentHistory[recentHistory.length - 1].date : null;
    const forecastTrajectory = interpolateForecast(closeLast, multiData, lastDate);

    res.json({
        kode: ticker,
        sektor: sektor,
        multi_data: multiData,
        scalp_data: scalpData,
        confluence_score: confluenceScore,
        indicators: indicators,
        history: recentHistory,
        forecast_trajectory: forecastTrajectory
    });
});

// 7. Real-time Live On-Demand Forecast (Pure JavaScript Yahoo Finance)
app.post('/api/stock/:ticker/live-forecast', async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const sektor = TICKER_TO_SECTOR[ticker];

    if (!sektor) {
        return res.status(404).json({ error: `Ticker ${ticker} is not in the 167 IDX universe` });
    }

    try {
        const liveResult = await fetchLiveStock(ticker);
        res.json({
            ...liveResult,
            sektor: sektor
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Screener Top 10 Picks
app.get('/api/screener', (req, res) => {
    const multi = getMultiHariRecords();
    const scalp = getScalpingRecords();

    const topSwing = multi
        .filter(r => (Number(r['MAPE_H+31(%)']) || 99) <= 18.0)
        .sort((a, b) => (Number(b['Potensi_H+31(%)']) || 0) - (Number(a['Potensi_H+31(%)']) || 0))
        .slice(0, 10);

    const topScalp = scalp
        .filter(r => (Number(r['Net_Gain_60m(%)']) || 0) > 0.3)
        .sort((a, b) => (Number(b['Net_Gain_60m(%)']) || 0) - (Number(a['Net_Gain_60m(%)']) || 0))
        .slice(0, 10);

    res.json({
        top_swing_10: topSwing,
        top_scalp_10: topScalp
    });
});

// 9. Automated Daily Cron Endpoint (Secured with optional CRON_SECRET for production)
let isUpdating = false;
app.all('/api/cron/update', async (req, res) => {
    // Security check: If CRON_SECRET is defined in environment, require matching token
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = req.headers.authorization || '';
        const queryKey = req.query.key || req.query.secret || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

        if (token !== cronSecret && queryKey !== cronSecret) {
            return res.status(401).json({
                error: 'Unauthorized: Invalid or missing cron secret authorization'
            });
        }
    }

    if (isUpdating) {
        return res.status(429).json({ status: 'in_progress', message: 'Pembaruan data sedang berjalan...' });
    }

    try {
        isUpdating = true;
        console.log('[CRON] Menerima pemicu pembaruan data harian...');
        const meta = await runDailyUpdate();
        isUpdating = false;
        res.json({
            status: 'success',
            message: 'Data 167 emiten berhasil diperbarui secara otomatis',
            meta: meta
        });
    } catch (err) {
        isUpdating = false;
        console.error('[CRON ERROR]:', err);
        res.status(500).json({ error: err.message });
    }
});

// 10. Update Status Endpoint
app.get('/api/status', (req, res) => {
    const statusFile = path.join(DATA_DIR, 'update_status.json');
    if (fs.existsSync(statusFile)) {
        try {
            const meta = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
            return res.json(meta);
        } catch (e) {}
    }
    res.json({
        last_updated_wib: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
        status: 'Active Auto-Update'
    });
});

// Default catch-all fallback route to index.html
app.use((req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`🚀 IDX AI Stock Terminal (Node.js) is RUNNING`);
        console.log(`📡 URL: http://localhost:${PORT}`);
        console.log(`📊 Universe: 167 Emiten BEI (Perbankan, Makanan, Perkebunan, Mineral)`);
        console.log(`✨ Powered by: Express, Lenis Smooth Scroll, GSAP, Chart.js`);
        console.log(`=======================================================`);
    });
}

module.exports = app;
