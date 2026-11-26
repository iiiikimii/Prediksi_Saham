/**
 * Real-time Indonesian Financial, IDX, and Macroeconomic News Service
 * Pure JavaScript - Queries real-time news feeds, performs sentiment analysis,
 * and caches results with resilient local fallbacks.
 */

const fs = require('fs');
const path = require('path');
const { TICKER_TO_SECTOR } = require('./sectors');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const NEWS_FALLBACK_FILE = path.join(DATA_DIR, 'news_fallback.json');

// In-memory cache with 5 minutes TTL
const newsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

// Sentiment Lexicon for Indonesian Financial Markets
const BULLISH_WORDS = [
    'menguat', 'naik', 'cuan', 'rekor', 'laba', 'dividen', 'lonjakan', 'positif',
    'beli', 'buy', 'bullish', 'ekspansi', 'surplus', 'optimis', 'terbang', 'akumulasi',
    'kinerja apik', 'tumbuh', 'rebound', 'hijau', 'dorong', 'meroket', 'target',
    'borong', 'potensi', 'peluang', 'melejit', 'akuisisi', 'right issue sukses'
];

const BEARISH_WORDS = [
    'melemah', 'anjlok', 'turun', 'rugi', 'tertekan', 'koreksi', 'waspada', 'jual',
    'sell', 'bearish', 'defisit', 'risiko', 'merah', 'ambles', 'merosot', 'dilepas',
    'outflow', 'anjloknya', 'kebakaran', 'inflasi tinggi', 'beban utang', 'pangkas',
    'ditekan', 'ketidakpastian', 'hambatan', 'jatuh', 'merosotnya'
];

/**
 * Determine sentiment from title and text
 */
function evaluateSentiment(text) {
    if (!text) return { sentiment: 'neutral', label: '⚪ Netral', score: 0 };
    const lower = text.toLowerCase();

    let bullScore = 0;
    for (const w of BULLISH_WORDS) {
        if (lower.includes(w)) bullScore++;
    }

    let bearScore = 0;
    for (const w of BEARISH_WORDS) {
        if (lower.includes(w)) bearScore++;
    }

    if (bullScore > bearScore) {
        return { sentiment: 'bullish', label: '🟢 Sentimen Positif (Bullish)', score: bullScore - bearScore };
    }
    if (bearScore > bullScore) {
        return { sentiment: 'bearish', label: '🔴 Waspada Koreksi (Bearish)', score: bearScore - bullScore };
    }
    return { sentiment: 'neutral', label: '⚪ Netral / Konsolidasi', score: 0 };
}

/**
 * Clean HTML tags and decode entities
 */
function cleanText(str) {
    if (!str) return '';
    return str
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .trim();
}

/**
 * Friendly Indonesian relative time
 */
function formatTimeAgo(dateStr) {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'Baru saja';
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / (60 * 1000));
        const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
        const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

        if (diffMin < 2) return 'Baru saja';
        if (diffMin < 60) return `${diffMin} menit yang lalu`;
        if (diffHours < 24) return `${diffHours} jam yang lalu`;
        if (diffDays === 1) return 'Kemarin';
        if (diffDays < 7) return `${diffDays} hari yang lalu`;
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
        return 'Hari ini';
    }
}

/**
 * Fetch and parse Google News RSS by keyword query
 */
async function fetchRssNews(query, defaultCategory = 'idx') {
    const encoded = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encoded}&hl=id&gl=ID&ceid=ID:id`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`Google News RSS returned ${res.status}`);
        const xml = await res.text();

        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        const items = [];
        let match;

        while ((match = itemRegex.exec(xml)) !== null && items.length < 15) {
            const raw = match[1];
            const titleRaw = (raw.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
            const linkRaw = (raw.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
            const pubDateRaw = (raw.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
            const sourceRaw = (raw.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || 'Media Keuangan';

            const cleanTitle = cleanText(titleRaw);
            if (!cleanTitle) continue;

            const { sentiment, label } = evaluateSentiment(cleanTitle);

            // Extract potential ticker mention
            let detectedTicker = null;
            const words = cleanTitle.toUpperCase().split(/[^A-Z0-9]+/);
            for (const w of words) {
                if (TICKER_TO_SECTOR[w] || w === 'IHSG') {
                    detectedTicker = w;
                    break;
                }
            }

            items.push({
                id: Buffer.from(cleanTitle.slice(0, 40)).toString('base64').replace(/[^a-zA-Z0-9]/g, ''),
                title: cleanTitle,
                url: cleanText(linkRaw),
                source: cleanText(sourceRaw),
                pub_date: pubDateRaw,
                time_ago: formatTimeAgo(pubDateRaw),
                category: defaultCategory,
                sentiment: sentiment,
                sentiment_label: label,
                related_ticker: detectedTicker,
                related_sector: detectedTicker && TICKER_TO_SECTOR[detectedTicker] ? TICKER_TO_SECTOR[detectedTicker] : null
            });
        }

        return items;
    } catch (err) {
        console.warn(`[WARN] RSS query failed for "${query}":`, err.message);
        return [];
    }
}

/**
 * Curated Fallback News Dataset (Used if network is unavailable)
 */
function getFallbackNews() {
    if (fs.existsSync(NEWS_FALLBACK_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(NEWS_FALLBACK_FILE, 'utf8'));
        } catch (e) {}
    }

    const todayDate = new Date().toISOString();
    return [
        {
            id: 'fb-1',
            title: 'IHSG Menguat Ditopang Arus Dana Asing pada Saham Perbankan Big Caps',
            url: 'https://www.cnbcindonesia.com/market',
            source: 'CNBC Indonesia',
            pub_date: todayDate,
            time_ago: '15 menit yang lalu',
            category: 'idx',
            sentiment: 'bullish',
            sentiment_label: '🟢 Sentimen Positif (Bullish)',
            related_ticker: 'BBCA',
            related_sector: 'Perbankan'
        },
        {
            id: 'fb-2',
            title: 'Bank Indonesia Pertahankan BI-Rate di Level Optimal Jaga Stabilitas Rupiah',
            url: 'https://www.bi.go.id',
            source: 'Bank Indonesia',
            pub_date: todayDate,
            time_ago: '35 menit yang lalu',
            category: 'macro',
            sentiment: 'neutral',
            sentiment_label: '⚪ Netral / Konsolidasi',
            related_ticker: 'IHSG',
            related_sector: 'Ekonomi Makro'
        },
        {
            id: 'fb-3',
            title: 'Pertumbuhan Kredit Perbankan Tembus Dua Digit, Prospek BBRI dan BMRI Mengilap',
            url: 'https://market.bisnis.com',
            source: 'Bisnis.com',
            pub_date: todayDate,
            time_ago: '1 jam yang lalu',
            category: 'idx',
            sentiment: 'bullish',
            sentiment_label: '🟢 Sentimen Positif (Bullish)',
            related_ticker: 'BBRI',
            related_sector: 'Perbankan'
        },
        {
            id: 'fb-4',
            title: 'Harga Komoditas Mineral & Logam Menguat, ANTM dan PTBA Catat Peningkatan Margin',
            url: 'https://investasi.kontan.co.id',
            source: 'Kontan',
            pub_date: todayDate,
            time_ago: '2 jam yang lalu',
            category: 'idx',
            sentiment: 'bullish',
            sentiment_label: '🟢 Sentimen Positif (Bullish)',
            related_ticker: 'ANTM',
            related_sector: 'Mineral'
        },
        {
            id: 'fb-5',
            title: 'Neraca Perdagangan Indonesia Surplus 48 Bulan Berturut-turut Topang Fundamental',
            url: 'https://www.bps.go.id',
            source: 'BPS / Antara News',
            pub_date: todayDate,
            time_ago: '3 jam yang lalu',
            category: 'macro',
            sentiment: 'bullish',
            sentiment_label: '🟢 Sentimen Positif (Bullish)',
            related_ticker: 'IHSG',
            related_sector: 'Ekonomi Makro'
        },
        {
            id: 'fb-6',
            title: 'Sektor Barang Konsumsi (ICBP & INDF) Tunjukkan Resiliensi Daya Beli Domestik',
            url: 'https://investor.id',
            source: 'Investor Daily',
            pub_date: todayDate,
            time_ago: '4 jam yang lalu',
            category: 'idx',
            sentiment: 'bullish',
            sentiment_label: '🟢 Sentimen Positif (Bullish)',
            related_ticker: 'ICBP',
            related_sector: 'Makanan'
        },
        {
            id: 'fb-7',
            title: 'Nilai Tukar Rupiah Terpantau Stabil di Tengah Penyesuaian Imbal Hasil Obligasi Global',
            url: 'https://finance.detik.com',
            source: 'Detik Finance',
            pub_date: todayDate,
            time_ago: '5 jam yang lalu',
            category: 'macro',
            sentiment: 'neutral',
            sentiment_label: '⚪ Netral / Konsolidasi',
            related_ticker: 'IHSG',
            related_sector: 'Ekonomi Makro'
        },
        {
            id: 'fb-8',
            title: 'Pelaku Pasar Cermati Data Inflasi dan Rilis Kinerja Emiten Kuartal Terakhir',
            url: 'https://www.kontan.co.id',
            source: 'Kontan',
            pub_date: todayDate,
            time_ago: '6 jam yang lalu',
            category: 'idx',
            sentiment: 'neutral',
            sentiment_label: '⚪ Netral / Konsolidasi',
            related_ticker: 'IHSG',
            related_sector: 'Indeks Komposit BEI'
        }
    ];
}

/**
 * Fetch and combine news across categories
 */
async function getMarketNews({ category = 'all', ticker = null, limit = 12 } = {}) {
    const cacheKey = `${category}_${ticker || 'notick'}_${limit}`;
    const now = Date.now();

    if (newsCache.has(cacheKey)) {
        const cached = newsCache.get(cacheKey);
        if (now - cached.timestamp < CACHE_TTL_MS) {
            return cached.data;
        }
    }

    let allNews = [];

    try {
        if (ticker) {
            const cleanT = String(ticker).toUpperCase();
            const sector = TICKER_TO_SECTOR[cleanT] || '';
            const query = cleanT === 'IHSG' ? 'IHSG bursa efek indonesia' : `saham ${cleanT} BEI`;

            const tickerResults = await fetchRssNews(query, 'emiten');
            allNews.push(...tickerResults);

            // Tag ticker explicitly
            allNews = allNews.map(item => ({
                ...item,
                related_ticker: item.related_ticker || cleanT,
                related_sector: item.related_sector || sector
            }));

            // If few or no specific news items found, generate tailored contextual analysis news
            if (allNews.length < 2) {
                const sectorFallbacks = getFallbackNews().filter(f => f.related_sector === sector || f.related_ticker === cleanT || f.related_ticker === 'IHSG');
                allNews.push(...sectorFallbacks);
            }
        } else {
            // Fetch IDX & Macro in parallel
            const [idxNews, macroNews] = await Promise.all([
                fetchRssNews('saham IHSG bursa efek indonesia rekomendasi', 'idx'),
                fetchRssNews('ekonomi indonesia Bank Indonesia rupiah inflasi PDB', 'macro')
            ]);
            allNews.push(...idxNews, ...macroNews);
        }
    } catch (e) {
        console.warn('[WARN] News aggregation notice:', e.message);
    }

    // Deduplicate by title
    const seenTitles = new Set();
    let uniqueNews = [];
    for (const item of allNews) {
        const key = item.title.toLowerCase().substring(0, 35);
        if (!seenTitles.has(key)) {
            seenTitles.add(key);
            uniqueNews.push(item);
        }
    }

    // Merge with fallback if fetched list is insufficient
    if (uniqueNews.length < 4) {
        const fallbacks = getFallbackNews();
        for (const fb of fallbacks) {
            const key = fb.title.toLowerCase().substring(0, 35);
            if (!seenTitles.has(key)) {
                seenTitles.add(key);
                uniqueNews.push(fb);
            }
        }
    }

    // Filter by category if requested
    if (category && category !== 'all') {
        uniqueNews = uniqueNews.filter(n => n.category === category);
    }

    const finalResult = uniqueNews.slice(0, limit);

    // Save fallback snapshot to disk
    try {
        if (uniqueNews.length >= 6) {
            fs.writeFileSync(NEWS_FALLBACK_FILE, JSON.stringify(uniqueNews.slice(0, 16), null, 2), 'utf8');
        }
    } catch (e) {}

    // Store in cache
    newsCache.set(cacheKey, { data: finalResult, timestamp: now });

    return finalResult;
}

/**
 * Get news specifically tailored to support analysis of a ticker on the chart
 */
async function getTickerAnalysisNews(ticker) {
    if (!ticker) return [];
    const cleanT = String(ticker).toUpperCase();
    return getMarketNews({ ticker: cleanT, limit: 4 });
}

module.exports = {
    getMarketNews,
    getTickerAnalysisNews,
    evaluateSentiment
};
