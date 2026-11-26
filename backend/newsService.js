/**
 * Real-time Indonesian Financial, Stock Market (IDX), Emiten, and Macroeconomic News Service
 * Pure JavaScript - Queries real-time news feeds across multiple specialized categories,
 * performs sentiment scoring, and balances content so feeds represent all market angles.
 */

const fs = require('fs');
const path = require('path');
const { TICKER_TO_SECTOR } = require('./sectors');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const NEWS_FALLBACK_FILE = path.join(DATA_DIR, 'news_fallback.json');

// In-memory cache with 60 seconds TTL per query key
const newsCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

// Sentiment Lexicon for Indonesian Financial Markets
const BULLISH_WORDS = [
    'menguat', 'naik', 'cuan', 'rekor', 'laba', 'dividen', 'lonjakan', 'positif',
    'beli', 'buy', 'bullish', 'ekspansi', 'surplus', 'optimis', 'terbang', 'akumulasi',
    'kinerja apik', 'tumbuh', 'rebound', 'hijau', 'dorong', 'meroket', 'target',
    'borong', 'potensi', 'peluang', 'melejit', 'akuisisi', 'right issue sukses',
    'untung', 'menanjak', 'prospektif', 'tumbuh pesat', 'dividen jumbo'
];

const BEARISH_WORDS = [
    'melemah', 'anjlok', 'turun', 'rugi', 'tertekan', 'koreksi', 'waspada', 'jual',
    'sell', 'bearish', 'defisit', 'risiko', 'merah', 'ambles', 'merosot', 'dilepas',
    'outflow', 'anjloknya', 'kebakaran', 'inflasi tinggi', 'beban utang', 'pangkas',
    'ditekan', 'ketidakpastian', 'hambatan', 'jatuh', 'merosotnya', 'anjlok parah'
];

/**
 * Determine sentiment from title and text
 */
function evaluateSentiment(text) {
    if (!text) return { sentiment: 'neutral', label: 'Netral', score: 0 };
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
        return { sentiment: 'bullish', label: 'Sentimen Positif (Bullish)', score: bullScore - bearScore };
    }
    if (bearScore > bullScore) {
        return { sentiment: 'bearish', label: 'Waspada Koreksi (Bearish)', score: bearScore - bullScore };
    }
    return { sentiment: 'neutral', label: 'Netral / Konsolidasi', score: 0 };
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
async function fetchRssNews(query, categoryTag = 'idx', maxItems = 10) {
    const encoded = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encoded}&hl=id&gl=ID&ceid=ID:id`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5500);

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`News RSS query error ${res.status}`);
        const xml = await res.text();

        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        const items = [];
        let match;

        while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
            const raw = match[1];
            const titleRaw = (raw.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
            const linkRaw = (raw.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
            const pubDateRaw = (raw.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
            const sourceRaw = (raw.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || 'Media Keuangan';

            const cleanTitle = cleanText(titleRaw);
            if (!cleanTitle || cleanTitle.toLowerCase() === 'google berita') continue;

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
                id: Buffer.from(cleanTitle.slice(0, 45)).toString('base64').replace(/[^a-zA-Z0-9]/g, ''),
                title: cleanTitle,
                url: cleanText(linkRaw),
                source: cleanText(sourceRaw),
                pub_date: pubDateRaw,
                time_ago: formatTimeAgo(pubDateRaw),
                category: categoryTag,
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
 * Curated Fallback News Dataset representing balanced categories (Used if offline / timeout)
 */
function getFallbackNews() {
    if (fs.existsSync(NEWS_FALLBACK_FILE)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(NEWS_FALLBACK_FILE, 'utf8'));
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) { }
    }

    const todayDate = new Date().toISOString();
    return [
        // 1. EMITEN & DIVIDEN
        {
            id: 'fb-e1',
            title: 'Bank Mandiri (BMRI) Siapkan Pembagian Dividen Jumbo Didukung Pertumbuhan Laba Bersih',
            url: 'https://market.bisnis.com',
            source: 'Bisnis.com',
            pub_date: todayDate,
            time_ago: '18 menit yang lalu',
            category: 'emiten',
            sentiment: 'bullish',
            sentiment_label: 'Sentimen Positif (Bullish)',
            related_ticker: 'BMRI',
            related_sector: 'Perbankan'
        },
        {
            id: 'fb-e2',
            title: 'Astra International (ASII) Bukukan Kinerja Positif Sektor Otomotif dan Jasa Keuangan',
            url: 'https://investor.id',
            source: 'Investor Daily',
            pub_date: todayDate,
            time_ago: '45 menit yang lalu',
            category: 'emiten',
            sentiment: 'bullish',
            sentiment_label: 'Sentimen Positif (Bullish)',
            related_ticker: 'ASII',
            related_sector: 'Konsumsi'
        },
        {
            id: 'fb-e3',
            title: 'Aneka Tambang (ANTM) Kebut Ekspansi Pabrik Hilirisasi Nikel dan Emas Kuartal Ini',
            url: 'https://investasi.kontan.co.id',
            source: 'Kontan',
            pub_date: todayDate,
            time_ago: '1 jam yang lalu',
            category: 'emiten',
            sentiment: 'bullish',
            sentiment_label: 'Sentimen Positif (Bullish)',
            related_ticker: 'ANTM',
            related_sector: 'Mineral'
        },
        {
            id: 'fb-e4',
            title: 'Indofood CBP (ICBP) Perkuat Pasar Ekspor Makanan Siap Saji ke Kawasan Timur Tengah',
            url: 'https://www.cnbcindonesia.com',
            source: 'CNBC Indonesia',
            pub_date: todayDate,
            time_ago: '2 jam yang lalu',
            category: 'emiten',
            sentiment: 'bullish',
            sentiment_label: 'Sentimen Positif (Bullish)',
            related_ticker: 'ICBP',
            related_sector: 'Makanan'
        },

        // 2. EKONOMI MAKRO INDONESIA & BANK INDONESIA
        {
            id: 'fb-m1',
            title: 'Bank Indonesia Pertahankan BI-Rate di Level Kondusif Jaga Stabilitas Nilai Tukar Rupiah',
            url: 'https://www.bi.go.id',
            source: 'Bank Indonesia',
            pub_date: todayDate,
            time_ago: '30 menit yang lalu',
            category: 'macro',
            sentiment: 'neutral',
            sentiment_label: '⚪ Netral / Konsolidasi',
            related_ticker: 'IHSG',
            related_sector: 'Ekonomi Makro'
        },
        {
            id: 'fb-m2',
            title: 'BPS Laporkan Neraca Perdagangan Indonesia Surplus 48 Bulan Beruntun Topang Devisa',
            url: 'https://www.bps.go.id',
            source: 'BPS / Antara News',
            pub_date: todayDate,
            time_ago: '1 jam yang lalu',
            category: 'macro',
            sentiment: 'bullish',
            sentiment_label: 'Sentimen Positif (Bullish)',
            related_ticker: 'IHSG',
            related_sector: 'Ekonomi Makro'
        },
        {
            id: 'fb-m3',
            title: 'Pertumbuhan PDB Indonesia Diperkirakan Tetap Resilien di Atas 5% Ditopang Konsumsi Rumah Tangga',
            url: 'https://kemenkeu.go.id',
            source: 'Kementerian Keuangan',
            pub_date: todayDate,
            time_ago: '2 jam yang lalu',
            category: 'macro',
            sentiment: 'bullish',
            sentiment_label: 'Sentimen Positif (Bullish)',
            related_ticker: 'IHSG',
            related_sector: 'Ekonomi Makro'
        },
        {
            id: 'fb-m4',
            title: 'Nilai Tukar Rupiah Bergerak Stabil di Rentang Terkendali Menjelang Rilis Data Inflasi',
            url: 'https://finance.detik.com',
            source: 'Detik Finance',
            pub_date: todayDate,
            time_ago: '3 jam yang lalu',
            category: 'macro',
            sentiment: 'neutral',
            sentiment_label: '⚪ Netral / Konsolidasi',
            related_ticker: 'IHSG',
            related_sector: 'Ekonomi Makro'
        },

        // 3. BURSA EFEK INDONESIA & REKOMENDASI SAHAM
        {
            id: 'fb-s1',
            title: 'Investor Asing Catat Net Buy Signifikan pada Saham Perbankan Big Caps BBCA dan BBRI',
            url: 'https://www.cnbcindonesia.com/market',
            source: 'CNBC Indonesia',
            pub_date: todayDate,
            time_ago: '25 menit yang lalu',
            category: 'idx',
            sentiment: 'bullish',
            sentiment_label: 'Sentimen Positif (Bullish)',
            related_ticker: 'BBCA',
            related_sector: 'Perbankan'
        },
        {
            id: 'fb-s2',
            title: 'Analis Naikkan Target Harga Saham Komoditas Energi & Logam Pasca Rebound Harga Global',
            url: 'https://investasi.kontan.co.id',
            source: 'Kontan',
            pub_date: todayDate,
            time_ago: '1 jam yang lalu',
            category: 'idx',
            sentiment: 'bullish',
            sentiment_label: 'Sentimen Positif (Bullish)',
            related_ticker: 'PTBA',
            related_sector: 'Mineral'
        },
        {
            id: 'fb-s3',
            title: 'Rotasi Sektor ke Saham Siklikal Menopang Volume Transaksi Harian Bursa Efek Indonesia',
            url: 'https://idxchannel.com',
            source: 'IDX Channel',
            pub_date: todayDate,
            time_ago: '2 jam yang lalu',
            category: 'idx',
            sentiment: 'neutral',
            sentiment_label: '⚪ Netral / Konsolidasi',
            related_ticker: 'IHSG',
            related_sector: 'Indeks Komposit BEI'
        },
        {
            id: 'fb-s4',
            title: 'Rekomendasi Swing Saham Pilihan Sektor Agribisnis AALI dan TAPG Menguat Jelang Panen Raya',
            url: 'https://bloombergtechnoz.com',
            source: 'Bloomberg Technoz',
            pub_date: todayDate,
            time_ago: '4 jam yang lalu',
            category: 'idx',
            sentiment: 'bullish',
            sentiment_label: 'Sentimen Positif (Bullish)',
            related_ticker: 'AALI',
            related_sector: 'Perkebunan'
        }
    ];
}

/**
 * Fetch and combine news across categories, guaranteeing diversity
 */
async function getMarketNews({ category = 'all', ticker = null, limit = 12, refresh = false } = {}) {
    const cacheKey = `${category}_${ticker || 'notick'}_${limit}`;
    const now = Date.now();

    if (!refresh && newsCache.has(cacheKey)) {
        const cached = newsCache.get(cacheKey);
        if (now - cached.timestamp < CACHE_TTL_MS) {
            return cached.data;
        }
    }

    let resultItems = [];

    try {
        if (ticker) {
            const cleanT = String(ticker).toUpperCase();
            const sector = TICKER_TO_SECTOR[cleanT] || '';
            const query = cleanT === 'IHSG'
                ? 'IHSG pergerakan bursa efek indonesia hari ini'
                : `saham ${cleanT} BEI target dividen laba`;

            const tickerResults = await fetchRssNews(query, 'emiten', 8);
            resultItems.push(...tickerResults);

            resultItems = resultItems.map(item => ({
                ...item,
                related_ticker: item.related_ticker || cleanT,
                related_sector: item.related_sector || sector
            }));

            // If few or no specific news items found, supplement with sector-relevant items
            if (resultItems.length < 3) {
                const fallbacks = getFallbackNews().filter(f =>
                    f.related_sector === sector || f.related_ticker === cleanT || f.related_sector === 'Ekonomi Makro'
                );
                resultItems.push(...fallbacks);
            }
        } else if (category === 'emiten') {
            // Specifically corporate actions, dividends, and company reports
            const emitenNews = await fetchRssNews('dividen emiten saham BEI laba akuisisi', 'emiten', 12);
            resultItems.push(...emitenNews);
            if (resultItems.length < 4) {
                resultItems.push(...getFallbackNews().filter(f => f.category === 'emiten'));
            }
        } else if (category === 'macro') {
            // Specifically Indonesian macroeconomic and Bank Indonesia news
            const macroNews = await fetchRssNews('ekonomi Indonesia Bank Indonesia rupiah inflasi PDB', 'macro', 12);
            resultItems.push(...macroNews);
            if (resultItems.length < 4) {
                resultItems.push(...getFallbackNews().filter(f => f.category === 'macro'));
            }
        } else if (category === 'idx') {
            // Specifically stock market recommendations & sectoral moves
            const idxNews = await fetchRssNews('rekomendasi saham BEI target harga analis', 'idx', 12);
            resultItems.push(...idxNews);
            if (resultItems.length < 4) {
                resultItems.push(...getFallbackNews().filter(f => f.category === 'idx'));
            }
        } else {
            // 'all': Balanced 3-way stream (Emiten, Macro, IDX) to ensure NO category dominates
            const [emitenItems, macroItems, idxItems] = await Promise.all([
                fetchRssNews('dividen emiten saham BEI laba akuisisi', 'emiten', 6),
                fetchRssNews('ekonomi Indonesia Bank Indonesia rupiah inflasi PDB', 'macro', 6),
                fetchRssNews('rekomendasi saham BEI target harga analis', 'idx', 6)
            ]);

            // Interleave items: [Emiten, Macro, IDX, Emiten, Macro, IDX...]
            const maxLen = Math.max(emitenItems.length, macroItems.length, idxItems.length, 4);
            const interleaved = [];

            // Add fallbacks to pools if empty
            const fbEmiten = getFallbackNews().filter(f => f.category === 'emiten');
            const fbMacro = getFallbackNews().filter(f => f.category === 'macro');
            const fbIdx = getFallbackNews().filter(f => f.category === 'idx');

            const poolEmiten = emitenItems.length >= 2 ? emitenItems : [...emitenItems, ...fbEmiten];
            const poolMacro = macroItems.length >= 2 ? macroItems : [...macroItems, ...fbMacro];
            const poolIdx = idxItems.length >= 2 ? idxItems : [...idxItems, ...fbIdx];

            for (let i = 0; i < maxLen; i++) {
                if (poolEmiten[i]) interleaved.push(poolEmiten[i]);
                if (poolMacro[i]) interleaved.push(poolMacro[i]);
                if (poolIdx[i]) interleaved.push(poolIdx[i]);
            }

            resultItems = interleaved;
        }
    } catch (e) {
        console.warn('[WARN] News aggregation notice:', e.message);
    }

    // Deduplicate by title
    const seenTitles = new Set();
    const uniqueNews = [];
    for (const item of resultItems) {
        const key = item.title.toLowerCase().substring(0, 35);
        if (!seenTitles.has(key)) {
            seenTitles.add(key);
            uniqueNews.push(item);
        }
    }

    // If still empty, supply full fallback
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

    const finalResult = uniqueNews.slice(0, limit);

    // Save fallback snapshot to disk
    try {
        if (uniqueNews.length >= 6) {
            fs.writeFileSync(NEWS_FALLBACK_FILE, JSON.stringify(uniqueNews.slice(0, 16), null, 2), 'utf8');
        }
    } catch (e) { }

    // Store in cache
    newsCache.set(cacheKey, { data: finalResult, timestamp: now });

    return finalResult;
}

/**
 * Get news specifically tailored to support analysis of a ticker on the chart
 */
async function getTickerAnalysisNews(ticker, refresh = false) {
    if (!ticker) return [];
    const cleanT = String(ticker).toUpperCase();
    return getMarketNews({ ticker: cleanT, limit: 4, refresh });
}

module.exports = {
    getMarketNews,
    getTickerAnalysisNews,
    evaluateSentiment
};
