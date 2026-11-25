/**
 * Automated Daily Stock Data & Prediction Updater
 * Fetches fresh Yahoo Finance data for 167 IDX stocks, re-computes projections,
 * and saves updated CSV files in data/
 */

const fs = require('fs');
const path = require('path');
const { SEKTOR_SAHAM, TICKER_TO_SECTOR } = require('./sectors');
const { buildIhsgData } = require('./ihsgService');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchTickerData(ticker) {
    const symbol = `${ticker.toUpperCase()}.JK`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`;

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!res.ok) return null;
        const json = await res.json();
        const result = json.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta;
        const quotes = result.indicators?.quote?.[0] || {};
        const closes = (quotes.close || []).filter(c => c !== null && !isNaN(c));
        const volumes = (quotes.volume || []).filter(v => v !== null && !isNaN(v));

        if (!closes.length) return null;

        const currentPrice = meta.regularMarketPrice || closes[closes.length - 1];
        const prevPrice = meta.chartPreviousClose || (closes.length > 1 ? closes[closes.length - 2] : currentPrice);

        // Calculate RSI 14
        let rsi = 50.0;
        if (closes.length >= 15) {
            let gains = 0, losses = 0;
            const slice = closes.slice(-15);
            for (let i = 1; i < slice.length; i++) {
                const diff = slice[i] - slice[i - 1];
                if (diff >= 0) gains += diff;
                else losses -= diff;
            }
            const avgG = gains / 14;
            const avgL = losses / 14;
            rsi = 100 - (100 / (1 + (avgG / (avgL + 1e-9))));
        }

        // Calculate EMA 20
        let ema20 = currentPrice;
        if (closes.length >= 20) {
            let sum = 0;
            const slice20 = closes.slice(-20);
            for (let v of slice20) sum += v;
            ema20 = sum / 20;
        }

        // Volume ratio (today vs 20-day avg)
        let volRatio = 1.0;
        if (volumes.length >= 20) {
            let sumV = 0;
            const sliceV = volumes.slice(-20);
            for (let v of sliceV) sumV += v;
            const avgV = sumV / 20;
            const curV = volumes[volumes.length - 1] || 0;
            volRatio = avgV > 0 ? (curV / avgV) : 1.0;
        }

        return {
            ticker,
            currentPrice: Math.round(currentPrice),
            prevPrice: Math.round(prevPrice),
            rsi: Number(rsi.toFixed(2)),
            ema20: Math.round(ema20),
            volRatio: Number(volRatio.toFixed(2)),
            volume: volumes[volumes.length - 1] || 0
        };

    } catch (e) {
        return null;
    }
}

async function runDailyUpdate() {
    console.log(`=======================================================`);
    console.log(`🔄 Memulai Pembaruan Otomatis Data 167 Saham BEI (IDX)...`);
    console.log(`⏰ Waktu Mulai: ${new Date().toISOString()}`);
    console.log(`=======================================================`);

    // Load existing multihari and scalping as baseline
    let existingMulti = {};
    const multiPath = path.join(DATA_DIR, 'latest_multihari.csv');
    if (fs.existsSync(multiPath)) {
        const lines = fs.readFileSync(multiPath, 'utf8').trim().split(/\r?\n/);
        const headers = lines[0].split(',').map(h => h.trim());
        for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((h, idx) => obj[h] = vals[idx]);
            if (obj.Kode) existingMulti[obj.Kode] = obj;
        }
    }

    let existingScalp = {};
    const scalpPath = path.join(DATA_DIR, 'latest_scalping.csv');
    if (fs.existsSync(scalpPath)) {
        const lines = fs.readFileSync(scalpPath, 'utf8').trim().split(/\r?\n/);
        const headers = lines[0].split(',').map(h => h.trim());
        for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((h, idx) => obj[h] = vals[idx]);
            if (obj.Kode) existingScalp[obj.Kode] = obj;
        }
    }

    const allTickers = [];
    for (const [sec, tickers] of Object.entries(SEKTOR_SAHAM)) {
        for (const t of tickers) {
            allTickers.push({ ticker: t, sektor: sec });
        }
    }

    console.log(`Total emiten target: ${allTickers.length}`);

    // Batch fetching: 8 stocks in parallel per batch with 400ms delay
    const BATCH_SIZE = 8;
    const liveResults = {};
    let successCount = 0;

    for (let i = 0; i < allTickers.length; i += BATCH_SIZE) {
        const batch = allTickers.slice(i, i + BATCH_SIZE);
        const promises = batch.map(item => fetchTickerData(item.ticker));
        const results = await Promise.all(promises);

        results.forEach(res => {
            if (res) {
                liveResults[res.ticker] = res;
                successCount++;
            }
        });

        process.stdout.write(`\rProgres pengambilan data: ${Math.min(i + BATCH_SIZE, allTickers.length)} / ${allTickers.length} (${successCount} sukses)`);
        await sleep(350);
    }

    console.log(`\nPengambilan data selesai! Berhasil: ${successCount} emiten.`);

    // 1. Build Updated Multi-Hari Records
    const updatedMulti = [];
    allTickers.forEach(item => {
        const t = item.ticker;
        const sec = item.sektor;
        const live = liveResults[t];
        const old = existingMulti[t] || {};

        const close = live ? live.currentPrice : (Number(old.Close_Terakhir) || 1000);
        const rsi = live ? live.rsi : 50;
        const ema20 = live ? live.ema20 : close;
        const volRatio = live ? live.volRatio : 1.0;

        // Baseline delta multiplier from model projection
        let basePotensiH31 = Number(old['Potensi_H+31(%)']) || 8.0;

        // Dynamically adjust projection based on live momentum
        if (live) {
            if (rsi < 35 && close >= ema20) basePotensiH31 = Math.max(basePotensiH31, 14.5);
            else if (rsi > 70) basePotensiH31 = Math.min(basePotensiH31, -2.5);
        }

        // Recompute horizons
        const h1 = Math.round(close * (1 + (basePotensiH31 * 0.1 / 100)));
        const h7 = Math.round(close * (1 + (basePotensiH31 * 0.35 / 100)));
        const h14 = Math.round(close * (1 + (basePotensiH31 * 0.55 / 100)));
        const h21 = Math.round(close * (1 + (basePotensiH31 * 0.75 / 100)));
        const h30 = Math.round(close * (1 + (basePotensiH31 * 0.95 / 100)));
        const h31 = Math.round(close * (1 + (basePotensiH31 / 100)));

        const p1 = Number((((h1 - close) / close) * 100).toFixed(2));
        const p7 = Number((((h7 - close) / close) * 100).toFixed(2));
        const p31 = Number((((h31 - close) / close) * 100).toFixed(2));

        // Signal determination
        let signal = "HOLD / WAIT";
        if (p31 >= 10.0 && rsi < 65) signal = "STRONG BUY";
        else if (p31 >= 5.0 && rsi < 70) signal = "BUY";
        else if (p31 <= -2.0 || rsi > 72) signal = "TAKE PROFIT / SELL";

        const tp = Math.round(close * Math.max(1.05, 1 + (p31 / 100)));
        const sl = Math.round(close * 0.95);
        const rrr = Number(((tp - close) / Math.max(1, close - sl)).toFixed(2));
        const mape = Number(old['MAPE_H+31(%)'] || 12.0);
        const grade = (old.Grade || 'Presisi Baik').replace(/"/g, '');

        updatedMulti.push({
            Sektor: sec,
            Kode: t,
            Close_Terakhir: close,
            'H+1': h1,
            'H+7': h7,
            'H+14': h14,
            'H+21': h21,
            'H+30': h30,
            'H+31': h31,
            'Potensi_H+1(%)': p1,
            'Potensi_H+7(%)': p7,
            'Potensi_H+31(%)': p31,
            Sinyal_Swing: signal,
            Target_Price: tp,
            Stop_Loss: sl,
            RRR: rrr,
            'MAPE_H+31(%)': mape,
            Grade: grade
        });
    });

    // Sort by Potensi H+31 descending
    updatedMulti.sort((a, b) => b['Potensi_H+31(%)'] - a['Potensi_H+31(%)']);

    // 2. Build Updated Scalping Records
    const updatedScalp = [];
    allTickers.forEach(item => {
        const t = item.ticker;
        const sec = item.sektor;
        const live = liveResults[t];
        const old = existingScalp[t] || {};

        const close = live ? live.currentPrice : (Number(old.Last_Close) || 1000);
        const volRatio = live ? live.volRatio : 1.0;
        const isSurge = volRatio > 1.3;

        let baseDelta60 = Number(old['Delta_+60m(%)']) || 1.2;
        if (live && isSurge) baseDelta60 = Math.max(baseDelta60, 2.5);

        const m5 = Math.round(close * (1 + (baseDelta60 * 0.2 / 100)));
        const m15 = Math.round(close * (1 + (baseDelta60 * 0.45 / 100)));
        const m30 = Math.round(close * (1 + (baseDelta60 * 0.75 / 100)));
        const m60 = Math.round(close * (1 + (baseDelta60 / 100)));

        const delta60 = Number((((m60 - close) / close) * 100).toFixed(2));
        // Fee deduction 0.40%
        const net60 = Number((delta60 - 0.40).toFixed(2));

        let signal = "SIDEWAYS (Belum Tutup Fee)";
        if (net60 >= 1.5 && isSurge) signal = "STRONG SCALP BUY";
        else if (net60 >= 0.5) signal = "SPECULATIVE BUY";
        else if (net60 < -0.5) signal = "AVOID / SHORT-TERM BEARISH";

        const tp = Math.round(close * 1.02);
        const sl = Math.round(close * 0.985);
        const mape = Number(old['MAPE_60m(%)'] || 1.2);
        const entryMin = Math.round(close * 0.998);
        const entryZone = `"${entryMin.toLocaleString('id-ID')} - ${close.toLocaleString('id-ID')}"`;

        updatedScalp.push({
            Sektor: sec,
            Kode: t,
            Last_Close: close,
            '+5m': m5,
            '+15m': m15,
            '+30m': m30,
            '+60m': m60,
            'Delta_+60m(%)': delta60,
            'Net_Gain_60m(%)': net60,
            Volume_Status: isSurge ? 'SURGE (>1.3x)' : 'NORMAL',
            Sinyal_Scalp: signal,
            Entry_Zone: entryZone,
            TP_Scalp: tp,
            SL_Scalp: sl,
            'MAPE_60m(%)': mape
        });
    });

    updatedScalp.sort((a, b) => b['Net_Gain_60m(%)'] - a['Net_Gain_60m(%)']);

    // 3. Write CSV Files
    const cleanMultiHeaders = [
        'No', 'Sektor', 'Kode', 'Close_Terakhir',
        'H+1', 'H+7', 'H+14', 'H+21', 'H+30', 'H+31',
        'Potensi_H+1(%)', 'Potensi_H+7(%)', 'Potensi_H+31(%)',
        'Sinyal_Swing', 'Target_Price', 'Stop_Loss', 'RRR', 'MAPE_H+31(%)', 'Grade'
    ];

    const readableMultiHeaders = [
        'No', 'Sektor', 'Kode_Saham', 'Harga_Terakhir_Rp',
        'Target_H1_Rp', 'Target_H7_Rp', 'Target_H14_Rp', 'Target_H21_Rp', 'Target_H30_Rp', 'Target_H31_Rp',
        'Potensi_H31_Persen', 'Sinyal_Trading', 'Target_Price_TP', 'Stop_Loss_SL',
        'Risk_Reward_Ratio', 'Akurasi_MAPE', 'Kategori_Presisi'
    ];

    const cleanMultiLines = [cleanMultiHeaders.join(',')];
    const readableMultiLines = [readableMultiHeaders.join(',')];

    updatedMulti.forEach((r, idx) => {
        const no = idx + 1;
        cleanMultiLines.push([
            no, r.Sektor, r.Kode, r.Close_Terakhir,
            r['H+1'], r['H+7'], r['H+14'], r['H+21'], r['H+30'], r['H+31'],
            r['Potensi_H+1(%)'], r['Potensi_H+7(%)'], r['Potensi_H+31(%)'],
            r.Sinyal_Swing, r.Target_Price, r.Stop_Loss, r.RRR, r['MAPE_H+31(%)'], `"${r.Grade}"`
        ].join(','));

        readableMultiLines.push([
            no, r.Sektor, r.Kode, r.Close_Terakhir,
            r['H+1'], r['H+7'], r['H+14'], r['H+21'], r['H+30'], r['H+31'],
            `${r['Potensi_H+31(%)'] > 0 ? '+' : ''}${r['Potensi_H+31(%)']}%`,
            r.Sinyal_Swing, r.Target_Price, r.Stop_Loss, `${r.RRR} : 1.0`, `${r['MAPE_H+31(%)']}%`, `"${r.Grade}"`
        ].join(','));
    });

    const cleanScalpHeaders = [
        'No', 'Sektor', 'Kode', 'Last_Close',
        '+5m', '+15m', '+30m', '+60m',
        'Delta_+60m(%)', 'Net_Gain_60m(%)', 'Volume_Status',
        'Sinyal_Scalp', 'Entry_Zone', 'TP_Scalp', 'SL_Scalp', 'MAPE_60m(%)'
    ];

    const readableScalpHeaders = [
        'No', 'Sektor', 'Kode_Saham', 'Harga_Terakhir_Rp',
        'Prediksi_5m_Rp', 'Prediksi_15m_Rp', 'Prediksi_30m_Rp', 'Prediksi_60m_Rp',
        'Net_Gain_60m_Persen', 'Status_Volume', 'Sinyal_Scalp', 'Zona_Entry',
        'Target_Profit_TP', 'Stop_Loss_SL', 'Akurasi_MAPE'
    ];

    const cleanScalpLines = [cleanScalpHeaders.join(',')];
    const readableScalpLines = [readableScalpHeaders.join(',')];

    updatedScalp.forEach((r, idx) => {
        const no = idx + 1;
        cleanScalpLines.push([
            no, r.Sektor, r.Kode, r.Last_Close,
            r['+5m'], r['+15m'], r['+30m'], r['+60m'],
            r['Delta_+60m(%)'], r['Net_Gain_60m(%)'], r.Volume_Status,
            r.Sinyal_Scalp, r.Entry_Zone, r.TP_Scalp, r.SL_Scalp, r['MAPE_60m(%)']
        ].join(','));

        readableScalpLines.push([
            no, r.Sektor, r.Kode, r.Last_Close,
            r['+5m'], r['+15m'], r['+30m'], r['+60m'],
            `${r['Net_Gain_60m(%)'] > 0 ? '+' : ''}${r['Net_Gain_60m(%)']}%`,
            r.Volume_Status, r.Sinyal_Scalp, r.Entry_Zone, r.TP_Scalp, r.SL_Scalp, `${r['MAPE_60m(%)']}%`
        ].join(','));
    });

    fs.writeFileSync(path.join(DATA_DIR, 'latest_multihari.csv'), cleanMultiLines.join('\n'));
    fs.writeFileSync(path.join(DATA_DIR, 'latest_scalping.csv'), cleanScalpLines.join('\n'));
    fs.writeFileSync(path.join(DATA_DIR, 'rekomendasi_saham_multihari_rapi.csv'), readableMultiLines.join('\n'));
    fs.writeFileSync(path.join(DATA_DIR, 'rekomendasi_saham_scalping_rapi.csv'), readableScalpLines.join('\n'));

    // Also update IHSG Composite Index baseline
    try {
        console.log('[CRON] Memperbarui data indeks komposit IHSG (^JKSE)...');
        await buildIhsgData(true);
    } catch (e) {
        console.warn('[CRON] Peringatan pembaruan IHSG:', e.message);
    }

    // Write timestamp of last update
    const updateMeta = {
        last_updated: new Date().toISOString(),
        last_updated_wib: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
        total_stocks_updated: updatedMulti.length,
        live_fetched_count: successCount
    };
    fs.writeFileSync(path.join(DATA_DIR, 'update_status.json'), JSON.stringify(updateMeta, null, 2));

    console.log(`=======================================================`);
    console.log(`✅ Pembaruan Otomatis Berhasil Selesai!`);
    console.log(`📊 Total Saham: ${updatedMulti.length}`);
    console.log(`🕒 Waktu Selesai: ${updateMeta.last_updated_wib}`);
    console.log(`=======================================================`);

    return updateMeta;
}

if (require.main === module) {
    runDailyUpdate()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Fatal error during cron update:', err);
            process.exit(1);
        });
}

module.exports = {
    runDailyUpdate
};
