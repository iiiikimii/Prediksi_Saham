/**
 * IDX AI Stock Terminal - Frontend Client Logic
 * Powered by Lenis Smooth Scroll, GSAP ScrollTrigger, and Chart.js
 */

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // 1. SETUP LENIS SMOOTH SCROLL & GSAP SYNC
    // -------------------------------------------------------------------------
    let lenis;
    try {
        lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            direction: 'vertical',
            gestureDirection: 'vertical',
            smooth: true,
            mouseMultiplier: 1,
            smoothTouch: false,
            touchMultiplier: 2,
            infinite: false
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);

        // Sync Lenis with GSAP ScrollTrigger
        if (typeof ScrollTrigger !== 'undefined') {
            lenis.on('scroll', ScrollTrigger.update);
            gsap.ticker.add((time) => {
                lenis.raf(time * 1000);
            });
            gsap.ticker.lagSmoothing(0);
        }
    } catch (e) {
        console.warn("Lenis initialization skipped:", e);
    }

    // -------------------------------------------------------------------------
    // 2. GSAP TITLE ANIMATION (WORD-BY-WORD REVEAL) & SCROLL TRIGGERS
    // -------------------------------------------------------------------------
    const heroTitle = document.getElementById('heroTitle');
    if (heroTitle && typeof gsap !== 'undefined') {
        // Split title text into individual words wrapped in spans
        const words = heroTitle.innerText.trim().split(/\s+/);
        heroTitle.innerHTML = words
            .map(word => `<span class="hero-word">${word}</span>`)
            .join(' ');

        // Animate words upward with stagger
        gsap.from(".hero-word", {
            opacity: 0,
            y: 40,
            stagger: 0.08,
            duration: 0.9,
            ease: "power4.out",
            delay: 0.2
        });

        // Animate KPI cards
        gsap.from(".kpi-card", {
            opacity: 0,
            y: 25,
            stagger: 0.1,
            duration: 0.8,
            ease: "power3.out",
            delay: 0.6
        });

        // Section entrance scroll triggers
        if (typeof ScrollTrigger !== 'undefined') {
            gsap.utils.toArray(".section-container").forEach(section => {
                gsap.from(section, {
                    scrollTrigger: {
                        trigger: section,
                        start: "top 85%"
                    },
                    opacity: 0,
                    y: 35,
                    duration: 0.7,
                    ease: "power2.out"
                });
            });
        }
    }

    // -------------------------------------------------------------------------
    // 3. MOTION MICRO-INTERACTIONS (Card Hover Tilt)
    // -------------------------------------------------------------------------
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left - (rect.width / 2);
            const y = e.clientY - rect.top - (rect.height / 2);
            card.style.transform = `perspective(1000px) rotateX(${-y * 0.02}deg) rotateY(${x * 0.02}deg) translateY(-2px)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0) rotateX(0) rotateY(0)';
        });
    });

    // -------------------------------------------------------------------------
    // 4. CHART.JS INSTANCE MANAGEMENT
    // -------------------------------------------------------------------------
    let stockChart = null;
    const ctx = document.getElementById('stockForecastChart').getContext('2d');

    function formatRupiah(val) {
        if (val === null || val === undefined || isNaN(val)) return "-";
        return "Rp " + Math.round(val).toLocaleString('id-ID');
    }

    function formatPercent(val) {
        if (val === null || val === undefined || isNaN(val)) return "-";
        const sign = val > 0 ? "+" : "";
        return `${sign}${val.toFixed(2)}%`;
    }

    function renderStockChart(historyData, forecastData, currentPrice, tp, sl) {
        if (stockChart) {
            stockChart.destroy();
        }

        // Combine labels
        const histLabels = historyData.map(d => d.date);
        const forecastLabels = forecastData.map(d => d.date);
        const allLabels = [...histLabels, ...forecastLabels];

        // Historical data array (null for future)
        const histClose = historyData.map(d => d.close);
        const histSeries = [...histClose, ...new Array(forecastLabels.length).fill(null)];

        // Forecast data array (connect from last hist point)
        const forecastPrices = forecastData.map(d => d.projected_price);
        const forecastSeries = [
            ...new Array(histLabels.length - 1).fill(null),
            histClose[histClose.length - 1],
            ...forecastPrices
        ];

        // Markers for specific target days (H+1, H+7, H+14, H+21, H+30, H+31)
        const targetPointRadius = allLabels.map((label, idx) => {
            if (idx < histLabels.length) return 0;
            const fIdx = idx - histLabels.length;
            return (forecastData[fIdx] && forecastData[fIdx].is_target) ? 6 : 0;
        });

        const targetPointColor = allLabels.map((label, idx) => {
            if (idx < histLabels.length) return '#ffffff';
            const fIdx = idx - histLabels.length;
            if (forecastData[fIdx] && forecastData[fIdx].is_target) {
                return forecastData[fIdx].projected_price >= currentPrice ? '#00e676' : '#ff1744';
            }
            return '#00d2ff';
        });

        // Compute bounds
        const allValues = [...histClose, ...forecastPrices, tp, sl].filter(v => v !== null && !isNaN(v));
        const minVal = Math.floor(Math.min(...allValues) * 0.95);
        const maxVal = Math.ceil(Math.max(...allValues) * 1.05);

        // Chart gradient
        const gradientForecast = ctx.createLinearGradient(0, 0, 0, 400);
        gradientForecast.addColorStop(0, 'rgba(0, 210, 255, 0.25)');
        gradientForecast.addColorStop(1, 'rgba(0, 210, 255, 0.0)');

        stockChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: allLabels,
                datasets: [
                    {
                        label: 'Historis Aktual (60 Hari)',
                        data: histSeries,
                        borderColor: '#94a3b8',
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        tension: 0.1
                    },
                    {
                        label: 'Proyeksi RNN 31 Hari',
                        data: forecastSeries,
                        borderColor: '#00d2ff',
                        borderWidth: 2.5,
                        backgroundColor: gradientForecast,
                        fill: true,
                        pointRadius: targetPointRadius,
                        pointBackgroundColor: targetPointColor,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5,
                        pointHoverRadius: 8,
                        tension: 0.2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#64748b',
                            maxTicksLimit: 10,
                            font: { family: 'Plus Jakarta Sans', size: 11 }
                        }
                    },
                    y: {
                        min: minVal,
                        max: maxVal,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#64748b',
                            font: { family: 'JetBrains Mono', size: 11 },
                            callback: (val) => "Rp " + val.toLocaleString('id-ID')
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(0, 210, 255, 0.3)',
                        borderWidth: 1,
                        padding: 10,
                        bodyFont: { family: 'JetBrains Mono', size: 12 },
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (context.parsed.y !== null) {
                                    return `${label}: Rp ${Math.round(context.parsed.y).toLocaleString('id-ID')}`;
                                }
                                return null;
                            }
                        }
                    }
                }
            }
        });
    }

    // -------------------------------------------------------------------------
    // 5. DATA FETCHING: OVERVIEW & SECTOR COMPARISON
    // -------------------------------------------------------------------------
    async function loadOverview() {
        try {
            const res = await fetch('/api/overview');
            const data = await res.parse ? await res.json() : await res.json();

            // Total Stocks
            document.getElementById('kpiTotal').innerText = `${data.total_emiten} Saham`;

            // Top Swing Pick
            if (data.top_swing && data.top_swing.kode) {
                document.getElementById('kpiTopSwing').innerText = `${data.top_swing.kode} (+${data.top_swing.potensi.toFixed(1)}%)`;
                document.getElementById('kpiTopSwingSub').innerText = `${data.top_swing.sektor} • TP ${formatRupiah(data.top_swing.target)}`;
            }

            // Top Scalp Pick
            if (data.top_scalp && data.top_scalp.kode) {
                document.getElementById('kpiTopScalp').innerText = `${data.top_scalp.kode} (Net +${data.top_scalp.net_gain.toFixed(1)}%)`;
                document.getElementById('kpiTopScalpSub').innerText = `${data.top_scalp.sektor} • TP ${formatRupiah(data.top_scalp.tp)}`;
            }

            // Sector Cards Grid
            const sectorGrid = document.getElementById('sectorCardsGrid');
            sectorGrid.innerHTML = '';

            let highestReturn = -999;
            let strongestSec = '-';

            data.sector_summary.forEach(sec => {
                if (sec.avg_return_h31 > highestReturn) {
                    highestReturn = sec.avg_return_h31;
                    strongestSec = sec.sektor;
                }

                const card = document.createElement('div');
                card.className = 'sector-card card';
                card.innerHTML = `
                    <div class="sector-card-top">
                        <span class="sector-card-name">${sec.sektor}</span>
                        <span class="sector-card-count">${sec.total_emiten} Emiten</span>
                    </div>
                    <div class="sector-metric-row">
                        <span>Rata2 Potensi H+31:</span>
                        <span class="sector-metric-val ${sec.avg_return_h31 >= 0 ? 'text-green' : 'text-red'}">
                            ${sec.avg_return_h31 >= 0 ? '+' : ''}${sec.avg_return_h31}%
                        </span>
                    </div>
                    <div class="sector-metric-row">
                        <span>Rata2 Potensi H+7:</span>
                        <span class="sector-metric-val">${sec.avg_return_h7 >= 0 ? '+' : ''}${sec.avg_return_h7}%</span>
                    </div>
                    <div class="sector-metric-row">
                        <span>Rata-rata MAPE Error:</span>
                        <span class="sector-metric-val">${sec.avg_mape}%</span>
                    </div>
                    <div class="sector-metric-row">
                        <span>Sinyal Beli (Strong/Buy):</span>
                        <span class="sector-metric-val text-cyan">${sec.strong_buys + sec.buys} Saham</span>
                    </div>
                `;
                sectorGrid.appendChild(card);
            });

            document.getElementById('kpiStrongSector').innerText = strongestSec;
            document.getElementById('kpiStrongSectorSub').innerText = `Rata2 Return +${highestReturn.toFixed(1)}%`;

        } catch (e) {
            console.error("Failed to load overview:", e);
        }
    }

    // -------------------------------------------------------------------------
    // 6. POPULATE STOCKS DROPDOWN & SINGLE STOCK INSPECTION
    // -------------------------------------------------------------------------
    async function populateStockSelector() {
        try {
            const res = await fetch('/api/stocks');
            const data = await res.json();
            const selector = document.getElementById('stockSelector');
            selector.innerHTML = '';

            // Group stocks by sector
            const grouped = {};
            data.stocks.forEach(s => {
                if (!grouped[s.sektor]) grouped[s.sektor] = [];
                grouped[s.sektor].push(s.kode);
            });

            for (const [sektor, tickers] of Object.entries(grouped)) {
                const optGroup = document.createElement('optgroup');
                optGroup.label = `${sektor} (${tickers.length} Saham)`;
                tickers.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t;
                    opt.text = `${t} - ${sektor}`;
                    optGroup.appendChild(opt);
                });
                selector.appendChild(optGroup);
            }

            // Default selection: BBCA if exists, else first
            selector.value = "BBCA";
            loadStockDetail("BBCA");

            selector.addEventListener('change', (e) => {
                loadStockDetail(e.target.value);
            });

        } catch (e) {
            console.error("Failed to load stock list:", e);
        }
    }

    async function loadStockDetail(ticker) {
        if (!ticker) return;
        try {
            const res = await fetch(`/api/stock/${ticker}`);
            const data = await res.json();

            // Header info
            document.getElementById('chartTicker').innerText = data.kode;
            document.getElementById('chartSector').innerText = data.sektor;

            const closeLast = data.multi_data ? data.multi_data.Close_Terakhir : (data.history.length ? data.history[data.history.length-1].close : 0);
            document.getElementById('chartPrice').innerText = formatRupiah(closeLast);

            const signal = data.multi_data ? data.multi_data.Sinyal_Swing : "HOLD";
            const signalBadge = document.getElementById('chartSignal');
            signalBadge.innerText = signal;
            signalBadge.className = 'chart-badge';
            if (signal === 'STRONG BUY') signalBadge.classList.add('badge-strong-buy');
            else if (signal === 'BUY') signalBadge.classList.add('badge-buy');
            else if (signal.includes('SELL')) signalBadge.classList.add('badge-sell');
            else signalBadge.classList.add('badge-hold');

            // Confluence Score & Indicators
            const cScore = data.confluence_score || 50;
            document.getElementById('confluenceScore').innerText = cScore;
            
            const meterCircle = document.querySelector('.confluence-meter-circle');
            if (meterCircle) {
                meterCircle.style.background = `conic-gradient(#00d2ff ${cScore}%, rgba(255,255,255,0.1) 0)`;
            }

            if (data.indicators) {
                document.getElementById('valRsi').innerText = `${data.indicators.rsi_14} (${data.indicators.rsi_status})`;
                document.getElementById('valMacd').innerText = data.indicators.macd_status;
                document.getElementById('valEma').innerText = data.indicators.trend_ema;
                document.getElementById('valVol').innerText = data.indicators.volume_surge ? `Surge (${data.indicators.vol_ratio}x Avg)` : `Normal (${data.indicators.vol_ratio}x Avg)`;
            }

            // Action Plan
            const tp = data.multi_data ? data.multi_data.Target_Price : closeLast * 1.08;
            const sl = data.multi_data ? data.multi_data.Stop_Loss : closeLast * 0.95;
            const rrr = data.multi_data ? data.multi_data.RRR : 1.6;

            document.getElementById('planEntry').innerText = formatRupiah(closeLast);
            document.getElementById('planTP').innerText = `${formatRupiah(tp)} (+${(((tp - closeLast)/closeLast)*100).toFixed(1)}%)`;
            document.getElementById('planSL').innerText = `${formatRupiah(sl)} (-5.0%)`;
            document.getElementById('planRRR').innerText = `${rrr} : 1.0`;

            // Sync to Calculator
            document.getElementById('calcEntryPrice').value = closeLast;
            document.getElementById('calcStopLoss').value = sl;
            document.getElementById('calcTargetPrice').value = tp;
            calculatePositionSize();

            // Milestones Row
            const milestonesRow = document.getElementById('milestonesRow');
            milestonesRow.innerHTML = '';
            const keyDays = [1, 7, 14, 21, 30, 31];
            keyDays.forEach(d => {
                const dayVal = data.multi_data ? data.multi_data[`H+${d}`] : null;
                if (dayVal) {
                    const deltaPct = ((dayVal - closeLast) / closeLast) * 100;
                    const item = document.createElement('div');
                    item.className = 'milestone-item';
                    item.innerHTML = `
                        <div class="ms-target">Hari ke-${d}</div>
                        <div class="ms-price">${formatRupiah(dayVal)}</div>
                        <div class="ms-delta ${deltaPct >= 0 ? 'text-green' : 'text-red'}">
                            ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%
                        </div>
                    `;
                    milestonesRow.appendChild(item);
                }
            });

            // Render Chart
            renderStockChart(data.history, data.forecast_trajectory, closeLast, tp, sl);

        } catch (e) {
            console.error(`Failed to load details for ${ticker}:`, e);
        }
    }

    // -------------------------------------------------------------------------
    // 7. REAL-TIME YAHOO FINANCE LIVE ON-DEMAND PREDICTION
    // -------------------------------------------------------------------------
    const btnLiveForecast = document.getElementById('btnLiveForecast');
    if (btnLiveForecast) {
        btnLiveForecast.addEventListener('click', async () => {
            const selector = document.getElementById('stockSelector');
            const ticker = selector.value;
            if (!ticker) return;

            btnLiveForecast.disabled = true;
            btnLiveForecast.innerHTML = '<span class="pulse-dot"></span> Mengambil data Yahoo Finance...';

            try {
                const res = await fetch(`/api/stock/${ticker}/live-forecast`, { method: 'POST' });
                const liveData = await res.json();

                if (liveData.status === 'success') {
                    const liveBanner = document.getElementById('liveBanner');
                    const bannerText = document.getElementById('liveBannerText');
                    liveBanner.classList.remove('hidden');
                    bannerText.innerHTML = `<strong>Live Sync (${liveData.as_of}):</strong> Harga Terkini Rp ${liveData.live_close.toLocaleString('id-ID')} (${liveData.pct_change_today > 0 ? '+' : ''}${liveData.pct_change_today}% hari ini). Proyeksi H+31: <strong>+${liveData.projected_return_h31}%</strong> (Sinyal: ${liveData.signal}).`;

                    // Update UI values
                    document.getElementById('chartPrice').innerText = formatRupiah(liveData.live_close);
                    document.getElementById('planEntry').innerText = formatRupiah(liveData.live_close);
                    document.getElementById('planTP').innerText = formatRupiah(liveData.target_price);
                    document.getElementById('planSL').innerText = formatRupiah(liveData.stop_loss);
                    document.getElementById('planRRR').innerText = `${liveData.rrr} : 1.0`;

                    // Sync to Calculator
                    document.getElementById('calcEntryPrice').value = liveData.live_close;
                    document.getElementById('calcStopLoss').value = liveData.stop_loss;
                    document.getElementById('calcTargetPrice').value = liveData.target_price;
                    calculatePositionSize();
                }
            } catch (e) {
                alert(`Gagal mengambil data live: ${e.message}`);
            } finally {
                btnLiveForecast.disabled = false;
                btnLiveForecast.innerHTML = '<span class="btn-icon">⚡</span> Cek Real-time Yahoo Finance';
            }
        });
    }

    // -------------------------------------------------------------------------
    // 8. INTERACTIVE MONEY MANAGEMENT & LOT CALCULATOR
    // -------------------------------------------------------------------------
    function calculatePositionSize() {
        const capital = parseFloat(document.getElementById('calcCapital').value) || 0;
        const riskPct = parseFloat(document.getElementById('calcRiskPct').value) || 0;
        const entry = parseFloat(document.getElementById('calcEntryPrice').value) || 0;
        const sl = parseFloat(document.getElementById('calcStopLoss').value) || 0;
        const tp = parseFloat(document.getElementById('calcTargetPrice').value) || 0;

        if (capital <= 0 || entry <= 0 || sl >= entry) {
            document.getElementById('resMaxRisk').innerText = "Rp 0";
            document.getElementById('resLots').innerText = "0 Lot";
            document.getElementById('resShares').innerText = "0 Lembar";
            document.getElementById('resTotalBuy').innerText = "Rp 0";
            document.getElementById('resProfit').innerText = "Rp 0";
            return;
        }

        // Max Risk in Rupiah
        const maxRiskRp = capital * (riskPct / 100);
        // Risk per share
        const riskPerShare = entry - sl;
        // Total shares
        const allowedShares = Math.floor(maxRiskRp / riskPerShare);
        // Convert to lots (1 lot = 100 shares in IDX)
        const lots = Math.max(1, Math.floor(allowedShares / 100));
        const actualShares = lots * 100;
        const totalBuyRp = actualShares * entry;
        const capPct = (totalBuyRp / capital) * 100;

        // Profit
        const profitPerShare = Math.max(0, tp - entry);
        const totalProfitRp = actualShares * profitPerShare;
        const actualRiskRp = actualShares * riskPerShare;
        const rrr = actualRiskRp > 0 ? (totalProfitRp / actualRiskRp).toFixed(2) : "0.0";

        document.getElementById('resMaxRisk').innerText = formatRupiah(actualRiskRp);
        document.getElementById('resLots').innerText = `${lots} Lot`;
        document.getElementById('resShares').innerText = `${actualShares.toLocaleString('id-ID')} Lembar Saham`;
        document.getElementById('resTotalBuy').innerText = formatRupiah(totalBuyRp);
        document.getElementById('resCapPct').innerText = `${capPct.toFixed(1)}% dari total modal`;
        document.getElementById('resProfit').innerText = formatRupiah(totalProfitRp);
        document.getElementById('resRRR').innerText = `RRR ${rrr} : 1.0`;
    }

    ['calcCapital', 'calcRiskPct', 'calcEntryPrice', 'calcStopLoss', 'calcTargetPrice'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculatePositionSize);
    });

    // -------------------------------------------------------------------------
    // 9. MULTI-HARI TABLE (167 STOCKS)
    // -------------------------------------------------------------------------
    let currentMultiData = [];

    async function loadMultiHariTable() {
        const sector = document.getElementById('filterSectorMulti').value;
        const signal = document.getElementById('filterSignalMulti').value;
        const search = document.getElementById('searchMulti').value;

        const params = new URLSearchParams();
        if (sector && sector !== 'ALL') params.append('sektor', sector);
        if (signal && signal !== 'ALL') params.append('sinyal', signal);
        if (search) params.append('search', search);

        try {
            const res = await fetch(`/api/predictions/multihari?${params.toString()}`);
            const result = await res.json();
            currentMultiData = result.data || [];

            const tbody = document.getElementById('tbodyMulti');
            tbody.innerHTML = '';

            if (currentMultiData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="15" style="text-align:center; padding: 20px;">Tidak ada data emiten yang cocok dengan filter.</td></tr>';
                return;
            }

            currentMultiData.forEach(row => {
                const tr = document.createElement('tr');
                const p31 = row['Potensi_H+31(%)'];
                const badgeClass = row.Sinyal_Swing === 'STRONG BUY' ? 'badge-strong-buy' :
                                   row.Sinyal_Swing === 'BUY' ? 'badge-buy' :
                                   row.Sinyal_Swing.includes('SELL') ? 'badge-sell' : 'badge-hold';

                tr.innerHTML = `
                    <td>${row.Sektor}</td>
                    <td><strong>${row.Kode}</strong></td>
                    <td>${formatRupiah(row.Close_Terakhir)}</td>
                    <td>${formatRupiah(row['H+1'])}</td>
                    <td>${formatRupiah(row['H+7'])}</td>
                    <td>${formatRupiah(row['H+14'])}</td>
                    <td>${formatRupiah(row['H+21'])}</td>
                    <td>${formatRupiah(row['H+30'])}</td>
                    <td>${formatRupiah(row['H+31'])}</td>
                    <td class="${p31 >= 0 ? 'text-green' : 'text-red'}"><strong>${formatPercent(p31)}</strong></td>
                    <td><span class="badge ${badgeClass}">${row.Sinyal_Swing}</span></td>
                    <td>${formatRupiah(row.Target_Price)}</td>
                    <td>${formatRupiah(row.Stop_Loss)}</td>
                    <td>${row.RRR} : 1.0</td>
                    <td><button class="btn-sm-view" data-ticker="${row.Kode}">Analisis</button></td>
                `;
                tbody.appendChild(tr);
            });

            // Add click listeners to "Analisis" buttons
            tbody.querySelectorAll('.btn-sm-view').forEach(btn => {
                btn.addEventListener('click', () => {
                    const t = btn.getAttribute('data-ticker');
                    document.getElementById('stockSelector').value = t;
                    loadStockDetail(t);
                    document.getElementById('inspector').scrollIntoView({ behavior: 'smooth' });
                });
            });

        } catch (e) {
            console.error("Failed to load multi-hari table:", e);
        }
    }

    // Filter listeners
    ['filterSectorMulti', 'filterSignalMulti'].forEach(id => {
        document.getElementById(id).addEventListener('change', loadMultiHariTable);
    });
    document.getElementById('searchMulti').addEventListener('input', debounce(loadMultiHariTable, 300));

    // CSV Export Multi
    document.getElementById('btnExportMulti').addEventListener('click', () => {
        if (!currentMultiData.length) return;
        exportToCsv(currentMultiData, 'prediksi_multihari_167_emiten.csv');
    });

    // -------------------------------------------------------------------------
    // 10. SCALPING TABLE (5m - 60m)
    // -------------------------------------------------------------------------
    let currentScalpData = [];

    async function loadScalpingTable() {
        const sector = document.getElementById('filterSectorScalp').value;
        const search = document.getElementById('searchScalp').value;

        const params = new URLSearchParams();
        if (sector && sector !== 'ALL') params.append('sektor', sector);
        if (search) params.append('search', search);

        try {
            const res = await fetch(`/api/predictions/scalping?${params.toString()}`);
            const result = await res.json();
            currentScalpData = result.data || [];

            const tbody = document.getElementById('tbodyScalp');
            tbody.innerHTML = '';

            if (currentScalpData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="14" style="text-align:center; padding: 20px;">Tidak ada data scalping yang cocok.</td></tr>';
                return;
            }

            currentScalpData.forEach(row => {
                const tr = document.createElement('tr');
                const net = row['Net_Gain_60m(%)'];
                const isSurge = row.Volume_Status === 'SURGE';

                tr.innerHTML = `
                    <td>${row.Sektor}</td>
                    <td><strong>${row.Kode}</strong></td>
                    <td>${formatRupiah(row.Last_Close)}</td>
                    <td>${formatRupiah(row['+5m'])}</td>
                    <td>${formatRupiah(row['+15m'])}</td>
                    <td>${formatRupiah(row['+30m'])}</td>
                    <td>${formatRupiah(row['+60m'])}</td>
                    <td class="${net > 0 ? 'text-green' : 'text-red'}"><strong>${formatPercent(net)}</strong></td>
                    <td><span class="badge ${isSurge ? 'badge-strong-buy' : 'badge-hold'}">${row.Volume_Status}</span></td>
                    <td><span class="badge badge-buy">${row.Sinyal_Scalp}</span></td>
                    <td>${formatRupiah(row.TP_Scalp)}</td>
                    <td>${formatRupiah(row.SL_Scalp)}</td>
                    <td>${row['MAPE_60m(%)']}%</td>
                    <td><button class="btn-sm-view" data-ticker="${row.Kode}">Analisis</button></td>
                `;
                tbody.appendChild(tr);
            });

            tbody.querySelectorAll('.btn-sm-view').forEach(btn => {
                btn.addEventListener('click', () => {
                    const t = btn.getAttribute('data-ticker');
                    document.getElementById('stockSelector').value = t;
                    loadStockDetail(t);
                    document.getElementById('inspector').scrollIntoView({ behavior: 'smooth' });
                });
            });

        } catch (e) {
            console.error("Failed to load scalping table:", e);
        }
    }

    document.getElementById('filterSectorScalp').addEventListener('change', loadScalpingTable);
    document.getElementById('searchScalp').addEventListener('input', debounce(loadScalpingTable, 300));

    // CSV Export Scalp
    document.getElementById('btnExportScalp').addEventListener('click', () => {
        if (!currentScalpData.length) return;
        exportToCsv(currentScalpData, 'prediksi_scalping_5m_60m.csv');
    });

    // -------------------------------------------------------------------------
    // UTILITY FUNCTIONS
    // -------------------------------------------------------------------------
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function exportToCsv(data, filename) {
        if (!data || !data.length) return;
        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(','),
            ...data.map(row => headers.map(fieldName => JSON.stringify(row[fieldName] ?? '')).join(','))
        ];
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', filename);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // -------------------------------------------------------------------------
    // INITIAL BOOTSTRAP
    // -------------------------------------------------------------------------
    loadOverview();
    populateStockSelector();
    loadMultiHariTable();
    loadScalpingTable();
});
