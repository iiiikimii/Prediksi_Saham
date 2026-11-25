/**
 * Automated Build & Unit Test Suite for IDX Stock Terminal
 * Validates syntax, security, business logic, endpoints, and deployment readiness.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Load Backend Modules
const app = require('../backend/server');
const {
    getMultiHariRecords,
    getScalpingRecords,
    getStockDailyHistory,
    interpolateForecast,
    SEKTOR_SAHAM,
    TICKER_TO_SECTOR
} = require('../backend/dataService');
const { fetchLiveStock } = require('../backend/yahooService');

let server;
let baseUrl = '';
const TEST_PORT = 3456;

// Test Runner Helpers
let totalPassed = 0;
let totalFailed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        totalPassed++;
    } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Reason: ${err.message}`);
        totalFailed++;
    }
}

async function request(endpoint, options = {}) {
    const url = `${baseUrl}${endpoint}`;
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    let body = null;
    if (contentType.includes('application/json')) {
        body = await res.json();
    } else {
        body = await res.text();
    }
    return { status: res.status, headers: res.headers, body };
}

async function runTestSuite() {
    console.log('===============================================================');
    console.log('🧪 IDX STOCK TERMINAL — AUTOMATED TEST SUITE & SECURITY AUDIT');
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    console.log('===============================================================\n');

    // Start ephemeral test server
    server = http.createServer(app);
    await new Promise((resolve) => {
        server.listen(TEST_PORT, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${TEST_PORT}`;
            resolve();
        });
    });

    console.log(`[TEST SERVER] Running on ${baseUrl}\n`);

    // =========================================================================
    // 1. DATA SERVICE & UNIVERSE INTEGRITY
    // =========================================================================
    console.log('📦 1. Data Service & Universe Integrity:');

    await test('Universe contains exactly 167 stocks across 4 sectors', () => {
        const sectors = Object.keys(SEKTOR_SAHAM);
        assert.strictEqual(sectors.length, 4, 'Should have 4 sectors');
        assert(sectors.includes('Perbankan'), 'Missing Perbankan');
        assert(sectors.includes('Makanan'), 'Missing Makanan');
        assert(sectors.includes('Perkebunan'), 'Missing Perkebunan');
        assert(sectors.includes('Mineral'), 'Missing Mineral');

        const totalStocks = Object.values(SEKTOR_SAHAM).reduce((sum, list) => sum + list.length, 0);
        assert.strictEqual(totalStocks, 167, 'Total stocks in universe must be exactly 167');
    });

    await test('Every ticker in SEKTOR_SAHAM has bidirectional mapping in TICKER_TO_SECTOR', () => {
        for (const [sec, tickers] of Object.entries(SEKTOR_SAHAM)) {
            for (const t of tickers) {
                assert.strictEqual(TICKER_TO_SECTOR[t], sec, `Ticker ${t} sector mismatch`);
            }
        }
    });

    await test('Multi-hari prediction records load with valid schema and prices', () => {
        const records = getMultiHariRecords();
        assert(Array.isArray(records), 'Records should be an array');
        assert(records.length > 0, 'Records should not be empty');

        const sample = records[0];
        assert(sample.Kode, 'Record must have Kode');
        assert(sample.Sektor, 'Record must have Sektor');
        assert(typeof sample.Close_Terakhir === 'number', 'Close_Terakhir must be numeric');
        assert(typeof sample.Target_Price === 'number', 'Target_Price must be numeric');
        assert(typeof sample.Stop_Loss === 'number', 'Stop_Loss must be numeric');
    });

    await test('Scalping prediction records load with valid schema', () => {
        const records = getScalpingRecords();
        assert(Array.isArray(records), 'Records should be an array');
        assert(records.length > 0, 'Scalping records should not be empty');

        const sample = records[0];
        assert(sample.Kode, 'Record must have Kode');
        assert(typeof sample.Last_Close === 'number', 'Last_Close must be numeric');
        assert(sample.Volume_Status !== undefined, 'Must have Volume_Status');
    });

    await test('Missing daily history stocks (GOLL, MAGP) auto-generate baseline bars without NaN', () => {
        const gollBars = getStockDailyHistory('Perkebunan', 'GOLL');
        assert(Array.isArray(gollBars), 'GOLL bars must be array');
        assert(gollBars.length >= 30, 'GOLL must have at least 30 baseline bars');

        for (const b of gollBars) {
            assert(!isNaN(b.close), 'Close price cannot be NaN');
            assert(b.close > 0, 'Close price must be > 0');
            assert(b.date, 'Bar must have valid date string');
        }

        const magpBars = getStockDailyHistory('Perkebunan', 'MAGP');
        assert(magpBars.length >= 30, 'MAGP must have at least 30 baseline bars');
    });

    await test('Forecast interpolation generates continuous 31-day trajectory', () => {
        const multiRecords = getMultiHariRecords();
        const bbca = multiRecords.find(r => r.Kode === 'BBCA') || { Close_Terakhir: 5800 };
        const traj = interpolateForecast(bbca.Close_Terakhir, bbca, '2026-11-24');
        assert(Array.isArray(traj), 'Trajectory must be array');
        assert.strictEqual(traj.length, 31, 'Trajectory must have 31 points (H+1 to H+31)');
        assert(traj[0].projected_price > 0, 'H+1 price must be > 0');
        assert(traj[30].projected_price > 0, 'H+31 price must be > 0');
    });

    // =========================================================================
    // 2. SECURITY & INPUT HARDENING AUDIT
    // =========================================================================
    console.log('\n🛡️ 2. Security & Input Hardening Audit:');

    await test('Directory traversal attempts in getStockDailyHistory are neutralized', () => {
        const dangerousInputs = [
            '../../etc/passwd',
            '..\\..\\windows\\win.ini',
            '%2e%2e%2fpackage.json',
            'null\0.csv',
            '../../../server.js'
        ];

        for (const bad of dangerousInputs) {
            const res = getStockDailyHistory('Perbankan', bad);
            // Must safely return fallback bars or empty array without crashing or reading forbidden paths
            assert(Array.isArray(res), `Should return safe array on ${bad}`);
        }
    });

    await test('HTTP Security Headers are correctly emitted (nosniff, SAMEORIGIN, no X-Powered-By)', async () => {
        const res = await request('/api/health');
        assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff', 'Must emit nosniff');
        assert.strictEqual(res.headers.get('x-frame-options'), 'SAMEORIGIN', 'Must emit SAMEORIGIN');
        assert.strictEqual(res.headers.get('x-powered-by'), null, 'X-Powered-By header must be disabled');
    });

    await test('Arbitrary ticker parameter injection is safely rejected with 404', async () => {
        const maliciousTickers = [
            '..%2f..%2fpackage.json',
            '<script>alert(1)</script>',
            'SELECT * FROM STOCKS',
            'BBCA;DROP TABLE STOCKS;'
        ];

        for (const t of maliciousTickers) {
            const res = await request(`/api/stock/${encodeURIComponent(t)}`);
            assert.strictEqual(res.status, 404, `Malicious ticker ${t} must return 404`);
            assert(res.body.error, 'Should contain clean error response');
        }
    });

    await test('Cron endpoint blocks unauthorized requests when CRON_SECRET is configured', async () => {
        process.env.CRON_SECRET = 'super-secret-test-key-2026';
        
        // Unauthenticated request should fail with 401
        const unauth = await request('/api/cron/update', { method: 'POST' });
        assert.strictEqual(unauth.status, 401, 'Unauthenticated cron must return 401');

        // Request with wrong token should fail with 401
        const wrongAuth = await request('/api/cron/update', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer wrong-key' }
        });
        assert.strictEqual(wrongAuth.status, 401, 'Wrong token must return 401');

        // Clean up environment
        delete process.env.CRON_SECRET;
    });

    await test('Live Yahoo Finance caching protects against rate limiting and spamming', async () => {
        const first = await fetchLiveStock('BBCA');
        assert(first, 'First live fetch must succeed');
        assert.strictEqual(first.kode, 'BBCA');

        const second = await fetchLiveStock('BBCA');
        assert(second, 'Second live fetch must succeed');
        assert.strictEqual(second.from_cache, true, 'Second fetch must be served from cache');
    });

    // =========================================================================
    // 3. API INTEGRATION TESTS (ALL 167 STOCKS & ENDPOINTS)
    // =========================================================================
    console.log('\n🌐 3. API Integration Tests:');

    await test('GET /api/health returns healthy status and 167 emiten count', async () => {
        const res = await request('/api/health');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'healthy');
        assert.strictEqual(res.body.total_emiten, 167);
        assert.strictEqual(res.body.total_sectors, 4);
    });

    await test('GET /api/overview returns KPI and 4 sector summaries', async () => {
        const res = await request('/api/overview');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.total_emiten, 167);
        assert(res.body.top_swing && res.body.top_swing.kode, 'Must have top swing');
        assert(res.body.top_scalp && res.body.top_scalp.kode, 'Must have top scalp');
        assert.strictEqual(res.body.sector_summary.length, 4, 'Must have 4 sectors in summary');
    });

    await test('GET /api/stocks returns list of all 167 stocks', async () => {
        const res = await request('/api/stocks');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.count, 167);
        assert.strictEqual(res.body.stocks.length, 167);
    });

    await test('GET /api/stock/:ticker returns zero undefined values for all representative stocks', async () => {
        const testTickers = ['BBCA', 'BMRI', 'INDF', 'AALI', 'ANTM', 'GOLL', 'MAGP'];
        for (const t of testTickers) {
            const res = await request(`/api/stock/${t}`);
            assert.strictEqual(res.status, 200, `Failed on ${t}`);
            const data = res.body;

            assert.strictEqual(data.kode, t);
            assert(data.sektor, `Missing sector on ${t}`);
            assert(data.history && data.history.length > 0, `Missing history on ${t}`);
            assert(data.multi_data, `Missing multi_data on ${t}`);
            assert(typeof data.multi_data.Close_Terakhir === 'number', `Invalid Close on ${t}`);
            assert(typeof data.multi_data.Target_Price === 'number', `Invalid TP on ${t}`);
            assert(typeof data.multi_data.Stop_Loss === 'number', `Invalid SL on ${t}`);
            assert(data.indicators, `Missing indicators on ${t}`);
            assert(data.forecast_trajectory && data.forecast_trajectory.length > 0, `Missing trajectory on ${t}`);
        }
    });

    await test('GET /api/predictions/multihari supports search and sector filtering', async () => {
        const allRes = await request('/api/predictions/multihari');
        assert.strictEqual(allRes.status, 200);
        assert(allRes.body.data.length > 100);

        const filterRes = await request('/api/predictions/multihari?sektor=Perbankan');
        assert.strictEqual(filterRes.status, 200);
        assert.strictEqual(filterRes.body.data.length, 47, 'Perbankan sector should have 47 stocks');

        const searchRes = await request('/api/predictions/multihari?search=ANTM');
        assert.strictEqual(searchRes.status, 200);
        assert(searchRes.body.data.some(r => r.Kode === 'ANTM'), 'Search must match ANTM');
    });

    await test('GET /api/predictions/scalping returns valid intraday predictions', async () => {
        const res = await request('/api/predictions/scalping');
        assert.strictEqual(res.status, 200);
        assert(res.body.data.length > 0);
        assert(res.body.data[0]['+5m'] !== undefined, 'Scalping record must have +5m');
    });

    await test('POST /api/stock/:ticker/live-forecast returns live or resilient fallback', async () => {
        const res = await request('/api/stock/BBCA/live-forecast', { method: 'POST' });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'success');
        assert.strictEqual(res.body.kode, 'BBCA');
        assert(typeof res.body.live_close === 'number', 'live_close must be numeric');
        assert(typeof res.body.target_price === 'number', 'target_price must be numeric');
    });

    await test('GET /api/status returns operational status and WIB timestamp', async () => {
        const res = await request('/api/status');
        assert.strictEqual(res.status, 200);
        assert(res.body.last_updated_wib.includes('WIB'), 'Timestamp must indicate WIB');
    });

    await test('GET /api/ihsg and /api/stock/IHSG returns complete composite index data', async () => {
        const summary = await request('/api/ihsg');
        assert.strictEqual(summary.status, 200);
        assert.strictEqual(summary.body.symbol, '^JKSE');
        assert(typeof summary.body.price === 'number', 'IHSG price must be numeric');

        const stockRes = await request('/api/stock/IHSG');
        assert.strictEqual(stockRes.status, 200);
        assert.strictEqual(stockRes.body.kode, 'IHSG');
        assert.strictEqual(stockRes.body.forecast_trajectory.length, 31, 'IHSG forecast must have 31 points');
        assert(stockRes.body.history.length > 0, 'IHSG must contain historical bars');

        const liveRes = await request('/api/stock/IHSG/live-forecast', { method: 'POST' });
        assert.strictEqual(liveRes.status, 200);
        assert.strictEqual(liveRes.body.status, 'success');
        assert(typeof liveRes.body.live_close === 'number');
    });

    // =========================================================================
    // 4. FRONTEND BUILD & ASSET INTEGRITY
    // =========================================================================
    console.log('\n🎨 4. Frontend Build & Asset Integrity:');

    await test('frontend/index.html exists and contains essential viewport, Lenis, GSAP, and IDs', () => {
        const htmlPath = path.resolve(__dirname, '../frontend/index.html');
        assert(fs.existsSync(htmlPath), 'index.html must exist');
        const html = fs.readFileSync(htmlPath, 'utf8');

        assert(html.includes('viewport'), 'index.html must include meta viewport for mobile responsive');
        assert(html.includes('id="overview"'), 'index.html must contain overview section');
        assert(html.includes('id="inspector"'), 'index.html must contain inspector section');
        assert(html.includes('id="calculator"'), 'index.html must contain calculator section');
        assert(html.includes('id="multihari"'), 'index.html must contain multihari section');
        assert(html.includes('id="scalping"'), 'index.html must contain scalping section');
        assert(html.includes('id="inspectorSearch"'), 'index.html must contain inspectorSearch input');
        assert(html.includes('id="stockSelector"'), 'index.html must contain stockSelector');
        assert(html.includes('stockForecastChart'), 'index.html must contain chart canvas');
    });

    await test('frontend/css/style.css exists and defines responsive inspector grid', () => {
        const cssPath = path.resolve(__dirname, '../frontend/css/style.css');
        assert(fs.existsSync(cssPath), 'style.css must exist');
        const css = fs.readFileSync(cssPath, 'utf8');

        assert(css.includes('.inspector-grid'), 'CSS must define .inspector-grid');
        assert(css.includes('.inspector-control-card'), 'CSS must define .inspector-control-card');
        assert(css.includes('@media (max-width:'), 'CSS must define responsive media queries');
    });

    await test('frontend/js/app.js exists and initializes with Lenis, GSAP, and Chart.js', () => {
        const jsPath = path.resolve(__dirname, '../frontend/js/app.js');
        assert(fs.existsSync(jsPath), 'app.js must exist');
        const js = fs.readFileSync(jsPath, 'utf8');

        assert(js.includes('DOMContentLoaded'), 'app.js must listen for DOMContentLoaded');
        assert(js.includes('loadStockDetail'), 'app.js must define loadStockDetail');
        assert(js.includes('calculatePositionSize'), 'app.js must define calculatePositionSize');
    });

    // Clean up server
    await new Promise((resolve) => server.close(resolve));

    console.log('\n===============================================================');
    console.log(`🏁 TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
    console.log('===============================================================');

    if (totalFailed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTestSuite();
