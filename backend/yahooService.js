/**
 * Real-time Yahoo Finance Client in Pure JavaScript
 * Queries Yahoo Finance Chart API v8 without external python binaries
 * Includes in-memory caching and request timeout for high security & rate-limit resilience
 */

const { getMultiHariRecords } = require('./dataService');

const liveCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

async function fetchLiveStock(ticker) {
    const cleanTicker = String(ticker || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const now = Date.now();

    // Check memory cache first to protect against rate limits and DoS
    if (liveCache.has(cleanTicker)) {
        const cached = liveCache.get(cleanTicker);
        if (now - cached.timestamp < CACHE_TTL_MS) {
            return {
                ...cached.data,
                from_cache: true
            };
        }
    }

    const symbol = `${cleanTicker}.JK`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Yahoo Finance responded with status ${response.status}`);
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result) {
            throw new Error(`No chart data available for ${symbol}`);
        }

        const meta = result.meta;
        const currentPrice = meta.regularMarketPrice || meta.chartPreviousClose;
        const prevClose = meta.chartPreviousClose || currentPrice;
        const pctChange = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0;

        const quotes = result.indicators?.quote?.[0] || {};
        const closes = quotes.close || [];

        // Filter valid close prices
        const validCloses = closes.filter(c => c !== null && !isNaN(c));

        // Quick RSI calculation on last 14 closes
        let rsi = 50.0;
        if (validCloses.length >= 15) {
            let gains = 0, losses = 0;
            const slice = validCloses.slice(-15);
            for (let i = 1; i < slice.length; i++) {
                const diff = slice[i] - slice[i - 1];
                if (diff >= 0) gains += diff;
                else losses -= diff;
            }
            const avgG = gains / 14;
            const avgL = losses / 14;
            rsi = 100 - (100 / (1 + (avgG / (avgL + 1e-9))));
        }

        // Quick EMA 20
        let ema20 = currentPrice;
        if (validCloses.length >= 20) {
            let sum = 0;
            const slice20 = validCloses.slice(-20);
            for (let v of slice20) sum += v;
            ema20 = sum / 20;
        }

        // Project return H+31 based on live momentum
        let projectedReturn = 8.5;
        let signal = "BUY";

        if (rsi < 40 && currentPrice >= ema20) {
            projectedReturn = 14.5;
            signal = "STRONG BUY";
        } else if (rsi > 70) {
            projectedReturn = -2.5;
            signal = "TAKE PROFIT / SELL";
        } else if (currentPrice < ema20) {
            projectedReturn = 3.0;
            signal = "HOLD / WAIT";
        }

        const targetPrice = Math.round(currentPrice * (1 + (projectedReturn / 100)));
        const stopLoss = Math.round(currentPrice * 0.95);
        const rrr = Number(((targetPrice - currentPrice) / Math.max(1, (currentPrice - stopLoss))).toFixed(2));

        const liveData = {
            status: "success",
            kode: cleanTicker,
            live_close: currentPrice,
            pct_change_today: Number(pctChange.toFixed(2)),
            projected_return_h31: Number(projectedReturn.toFixed(2)),
            signal: signal,
            target_price: targetPrice,
            stop_loss: stopLoss,
            rrr: rrr,
            rsi_14: Number(rsi.toFixed(2)),
            as_of: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + " WIB",
            from_cache: false
        };

        // Store in cache
        liveCache.set(cleanTicker, { data: liveData, timestamp: Date.now() });

        return liveData;

    } catch (err) {
        console.warn(`[WARN] Yahoo Finance live fetch notice for ${cleanTicker}:`, err.message);

        // Resilient fallback from local dataset if Yahoo Finance is unreachable or times out
        const multiRecords = getMultiHariRecords();
        const base = multiRecords.find(r => r.Kode === cleanTicker);
        const fallbackClose = Number(base?.Close_Terakhir || 1000);
        const tp = Number(base?.Target_Price || Math.round(fallbackClose * 1.08));
        const sl = Number(base?.Stop_Loss || Math.round(fallbackClose * 0.95));

        return {
            status: "success",
            kode: cleanTicker,
            live_close: fallbackClose,
            pct_change_today: 0.0,
            projected_return_h31: Number(base?.['Potensi_H+31(%)'] || 8.0),
            signal: base?.Sinyal_Swing || "BUY",
            target_price: tp,
            stop_loss: sl,
            rrr: Number(base?.RRR || 1.6),
            rsi_14: 50.0,
            as_of: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + " WIB (Lokal)",
            fallback_mode: true
        };
    }
}

module.exports = {
    fetchLiveStock
};
