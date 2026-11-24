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
            y: 25,
            stagger: 0.06,
            duration: 0.7,
            ease: "power3.out",
            clearProps: "opacity,transform"
        });

        // Animate KPI cards
        gsap.from(".kpi-card", {
            y: 15,
            stagger: 0.08,
            duration: 0.6,
            ease: "power2.out",
            clearProps: "all"
        });

        // Section entrance scroll triggers
        if (typeof ScrollTrigger !== 'undefined') {
            gsap.utils.toArray(".section-container").forEach(section => {
                gsap.from(section, {
                    scrollTrigger: {
                        trigger: section,
                        start: "top 90%"
                    },
                    y: 20,
                    duration: 0.6,
                    ease: "power2.out",
                    clearProps: "transform"
                });
            });
        }
    }

    // -------------------------------------------------------------------------
    // 3. MOTION MICRO-INTERACTIONS (Card Hover Tilt for small cards only)
    // -------------------------------------------------------------------------
    document.querySelectorAll('.kpi-card, .sector-card, .improvement-card, .library-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left - (rect.width / 2);
            const y = e.clientY - rect.top - (rect.height / 2);
            card.style.transform = `perspective(1000px) rotateX(${-y * 0.03}deg) rotateY(${x * 0.03}deg) translateY(-2px)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0) rotateX(0) rotateY(0)';
        });
    });

    // Smooth Anchor Navigation with Lenis & Instant Active Color Feedback
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href && href.startsWith('#') && href.length > 1) {
                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();

                    // Instantly set active color on clicked nav link
                    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
                    this.classList.add('active');

                    if (lenis && typeof lenis.scrollTo === 'function') {
                        lenis.scrollTo(target, { offset: -60 });
                    } else {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            }
        });
    });

    // -------------------------------------------------------------------------
    // 4. CHART.JS INSTANCE MANAGEMENT
    // -------------------------------------------------------------------------
    let stockChart = null;
    const ctx = document.getElementById('stockForecastChart').getContext('2d');

    function formatRupiah(val) {
        if (val === null || val === undefined) return "-";
        const num = parseFloat(String(val).replace(/[^\d.-]/g, ''));
        if (isNaN(num)) return "-";
        return "Rp " + Math.round(num).toLocaleString('id-ID');
    }

    function formatPercent(val) {
        if (val === null || val === undefined) return "-";
        const num = parseFloat(String(val).replace(/[%+]/g, ''));
        if (isNaN(num)) return "-";
        const sign = num > 0 ? "+" : "";
        return `${sign}${num.toFixed(2)}%`;
    }

    function renderStockChart(historyData, forecastData, currentPrice, tp, sl) {
        if (stockChart) {
            stockChart.destroy();
        }

        // Defensive fallbacks to ensure zero crashes
        if (!historyData || historyData.length === 0) {
            historyData = [{
                date: new Date().toISOString().substring(0, 10),
                close: currentPrice || 1000
            }];
        }
        if (!forecastData || forecastData.length === 0) {
            forecastData = [{
                date: new Date().toISOString().substring(0, 10),
                projected_price: currentPrice || 1000,
                is_target: false
            }];
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
        const lastHistClose = histClose.length ? histClose[histClose.length - 1] : currentPrice;
        const forecastSeries = [
            ...new Array(Math.max(0, histLabels.length - 1)).fill(null),
            lastHistClose,
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

            // Update Auto-Update & Live Market Status badge
            try {
                const statusRes = await fetch('/api/status');
                const statusData = await statusRes.json();
                const statusEl = document.querySelector('.live-status');
                if (statusEl && statusData.market) {
                    const m = statusData.market;
                    const lastEod = statusData.last_updated_wib ? statusData.last_updated_wib.split(',')[0] : '24/11/2026';

                    if (m.state === 'OPEN') {
                        statusEl.className = 'live-status status-open';
                        statusEl.innerHTML = `<span class="pulse-dot"></span> <strong>Pasar Buka</strong> • Live BEI`;
                        statusEl.title = `Sesi Perdagangan BEI Aktif (09:00 - 16:00 WIB)\n• Pembaruan data harian berikutnya: 16:30 WIB\n• Jam server: ${m.currentTimeWib}`;
                    } else if (m.state === 'PRE_OPEN') {
                        statusEl.className = 'live-status status-preopen';
                        statusEl.innerHTML = `<span class="amber-dot"></span> <strong>Pra-Buka</strong> • Buka 09:00`;
                        statusEl.title = `Sesi Pra-Pembukaan BEI Aktif\n• Perdagangan reguler dimulai pukul 09:00 WIB`;
                    } else if (m.state === 'WEEKEND') {
                        statusEl.className = 'live-status status-closed';
                        statusEl.innerHTML = `<span class="gray-dot"></span> <strong>Libur Akhir Pekan</strong>`;
                        statusEl.title = `Bursa BEI libur di akhir pekan\n• Buka kembali Senin pukul 09:00 WIB\n• Data penutupan terakhir: ${lastEod}`;
                    } else {
                        // Pasar Tutup (Malam / Dini Hari)
                        statusEl.className = 'live-status status-closed';
                        statusEl.innerHTML = `<span class="blue-dot"></span> <strong>Pasar Tutup</strong> • Buka 09:00 WIB`;
                        statusEl.title = `Bursa BEI belum buka (Perdagangan hari ini dimulai pukul 09:00 WIB)\n• Data penutupan terakhir tersedia: ${lastEod}\n• Jadwal auto-update harian: Pukul 16:30 WIB setiap sore setelah bursa tutup`;
                    }
                }
            } catch (e) {}

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
                card.style.cursor = 'pointer';
                card.title = `Klik untuk memfilter daftar saham sektor ${sec.sektor}`;
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

                // Interactive: Click sector card to filter Multi-Hari table immediately
                card.addEventListener('click', () => {
                    const multiFilter = document.getElementById('filterSectorMulti');
                    if (multiFilter) {
                        multiFilter.value = sec.sektor;
                        loadMultiHariTable();
                        const tableEl = document.getElementById('multihari');
                        if (lenis && typeof lenis.scrollTo === 'function') {
                            lenis.scrollTo(tableEl, { offset: -60 });
                        } else if (tableEl) {
                            tableEl.scrollIntoView({ behavior: 'smooth' });
                        }
                    }
                });

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

            // Quick Ticker Chips Interaction
            document.querySelectorAll('.ticker-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const t = chip.getAttribute('data-ticker');
                    if (selector) selector.value = t;
                    const searchInput = document.getElementById('inspectorSearch');
                    if (searchInput) searchInput.value = t;
                    loadStockDetail(t);
                });
            });

            // Instant Inspector Search Input
            const inspectorSearch = document.getElementById('inspectorSearch');
            if (inspectorSearch) {
                inspectorSearch.addEventListener('input', (e) => {
                    const q = e.target.value.trim().toUpperCase();
                    if (!q) return;

                    const allOptions = Array.from(selector.options);
                    // Match exact or startsWith
                    const match = allOptions.find(opt => opt.value === q) || 
                                  allOptions.find(opt => opt.value.startsWith(q));
                    if (match) {
                        selector.value = match.value;
                        loadStockDetail(match.value);
                    }
                });

                inspectorSearch.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const q = e.target.value.trim().toUpperCase();
                        const allOptions = Array.from(selector.options);
                        const match = allOptions.find(opt => opt.value === q) || 
                                      allOptions.find(opt => opt.value.startsWith(q));
                        if (match) {
                            selector.value = match.value;
                            loadStockDetail(match.value);
                        }
                    }
                });
            }

            // Default selection: BBCA if exists, else first
            selector.value = "BBCA";
            if (inspectorSearch) inspectorSearch.value = "BBCA";
            loadStockDetail("BBCA");

            selector.addEventListener('change', (e) => {
                if (inspectorSearch) inspectorSearch.value = e.target.value;
                loadStockDetail(e.target.value);
            });

        } catch (e) {
            console.error("Failed to load stock list:", e);
        }
    }

    async function loadStockDetail(ticker) {
        if (!ticker) return;

        // Synchronize Active Ticker Chip & Search Box
        document.querySelectorAll('.ticker-chip').forEach(chip => {
            if (chip.getAttribute('data-ticker') === ticker) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });

        const inspectorSearch = document.getElementById('inspectorSearch');
        if (inspectorSearch && document.activeElement !== inspectorSearch) {
            inspectorSearch.value = ticker;
        }

        try {
            const res = await fetch(`/api/stock/${ticker}`);
            const data = await res.json();

            if (data.error) {
                console.warn(`Stock ${ticker} notice:`, data.error);
                return;
            }

            // Header info
            document.getElementById('chartTicker').innerText = data.kode || ticker;
            document.getElementById('chartSector').innerText = data.sektor || 'Emiten BEI';

            const closeLast = (data.multi_data && data.multi_data.Close_Terakhir) 
                ? Number(data.multi_data.Close_Terakhir) 
                : (data.history && data.history.length ? Number(data.history[data.history.length - 1].close) : 1000);
            
            document.getElementById('chartPrice').innerText = formatRupiah(closeLast);

            const signal = (data.multi_data && data.multi_data.Sinyal_Swing) ? data.multi_data.Sinyal_Swing : "HOLD";
            const signalBadge = document.getElementById('chartSignal');
            signalBadge.innerText = signal;
            signalBadge.className = 'chart-badge';
            if (signal === 'STRONG BUY') signalBadge.classList.add('badge-strong-buy');
            else if (signal === 'BUY') signalBadge.classList.add('badge-buy');
            else if (String(signal).includes('SELL')) signalBadge.classList.add('badge-sell');
            else signalBadge.classList.add('badge-hold');

            // Confluence Score & Indicators
            const cScore = data.confluence_score || 50;
            document.getElementById('confluenceScore').innerText = cScore;
            
            const meterCircle = document.querySelector('.confluence-meter-circle');
            if (meterCircle) {
                meterCircle.style.background = `conic-gradient(#00d2ff ${cScore}%, rgba(255,255,255,0.1) 0)`;
            }

            if (data.indicators) {
                document.getElementById('valRsi').innerText = `${data.indicators.rsi_14 ?? 50} (${data.indicators.rsi_status || 'Neutral'})`;
                document.getElementById('valMacd').innerText = data.indicators.macd_status || 'Neutral';
                document.getElementById('valEma').innerText = data.indicators.trend_ema || 'Consolidating';
                document.getElementById('valVol').innerText = data.indicators.volume_surge ? `Surge (${data.indicators.vol_ratio || 1.3}x Avg)` : `Normal (${data.indicators.vol_ratio || 1.0}x Avg)`;
            }

            // Action Plan (Zero undefined values)
            const tp = (data.multi_data && data.multi_data.Target_Price) ? Number(data.multi_data.Target_Price) : Math.round(closeLast * 1.08);
            const sl = (data.multi_data && data.multi_data.Stop_Loss) ? Number(data.multi_data.Stop_Loss) : Math.round(closeLast * 0.95);
            const rrrRaw = (data.multi_data && data.multi_data.RRR) ? data.multi_data.RRR : 1.6;
            const rrr = typeof rrrRaw === 'number' ? rrrRaw.toFixed(2) : String(rrrRaw).replace(' : 1.0', '');

            const tpGainPct = closeLast > 0 ? (((tp - closeLast) / closeLast) * 100).toFixed(1) : "0.0";
            const slLossPct = closeLast > 0 ? (((sl - closeLast) / closeLast) * 100).toFixed(1) : "-5.0";

            document.getElementById('planEntry').innerText = formatRupiah(closeLast);
            document.getElementById('planTP').innerText = `${formatRupiah(tp)} (+${tpGainPct}%)`;
            document.getElementById('planSL').innerText = `${formatRupiah(sl)} (${slLossPct}%)`;
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
    // 8. INTERACTIVE MONEY MANAGEMENT & REALISTIC LOT CALCULATOR (IDX BEI)
    // -------------------------------------------------------------------------
    // Preset Risk Buttons
    document.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const risk = parseFloat(btn.getAttribute('data-risk')) || 2.0;
            const riskInput = document.getElementById('calcRiskPct');
            if (riskInput) {
                riskInput.value = risk;
                calculatePositionSize();
            }
        });
    });

    const feeToggle = document.getElementById('calcIncludeFees');
    if (feeToggle) {
        feeToggle.addEventListener('change', calculatePositionSize);
    }

    function calculatePositionSize() {
        const capital = parseFloat(document.getElementById('calcCapital').value) || 0;
        const riskPct = parseFloat(document.getElementById('calcRiskPct').value) || 0;
        const entry = parseFloat(document.getElementById('calcEntryPrice').value) || 0;
        const sl = parseFloat(document.getElementById('calcStopLoss').value) || 0;
        const tp = parseFloat(document.getElementById('calcTargetPrice').value) || 0;
        const includeFees = document.getElementById('calcIncludeFees')?.checked ?? true;

        // Broker Fees (Indonesian Standard: 0.15% Buy, 0.25% Sell incl 0.1% PPh Final)
        const BUY_FEE_RATE = includeFees ? 0.0015 : 0.0000;
        const SELL_FEE_RATE = includeFees ? 0.0025 : 0.0000;

        // Dynamic Input Hints
        const maxRiskBudget = capital * (riskPct / 100);
        const riskSummaryEl = document.getElementById('calcRiskSummary');
        if (riskSummaryEl) riskSummaryEl.innerText = `Batas rugi maksimal: ${formatRupiah(maxRiskBudget)}`;

        const slDelta = entry - sl;
        const slDeltaPct = entry > 0 ? ((sl - entry) / entry) * 100 : 0;
        const slHintEl = document.getElementById('calcSlPctHint');
        if (slHintEl) {
            slHintEl.innerText = entry > 0 ? `Jarak SL: ${slDeltaPct.toFixed(1)}% (-${formatRupiah(slDelta)})` : 'Jarak SL: -';
        }

        const tpDelta = tp - entry;
        const tpDeltaPct = entry > 0 ? ((tp - entry) / entry) * 100 : 0;
        const tpHintEl = document.getElementById('calcTpPctHint');
        if (tpHintEl) {
            tpHintEl.innerText = entry > 0 ? `Potensi TP: +${tpDeltaPct.toFixed(1)}% (+${formatRupiah(tpDelta)})` : 'Potensi TP: -';
        }

        if (capital <= 0 || entry <= 0 || sl >= entry) {
            document.getElementById('resLots').innerText = "0 Lot";
            document.getElementById('resShares').innerText = "0 Lembar";
            document.getElementById('resTotalBuy').innerText = "Total Beli: Rp 0";
            document.getElementById('resCapStatus').innerText = sl >= entry ? "⚠️ Stop Loss harus lebih rendah dari harga Entry" : "⚠️ Periksa input modal dan harga";
            document.getElementById('resCapStatus').className = "res-status text-red";
            document.getElementById('resMaxRisk').innerText = "Rp 0";
            document.getElementById('resRiskExplanation').innerText = "Belum ada posisi yang dihitung.";
            document.getElementById('resRiskPerShare').innerText = "Risiko: Rp 0 / lembar";
            document.getElementById('resProfit').innerText = "Rp 0";
            document.getElementById('resProfitPct').innerText = "Return Bersih: 0.0%";
            document.getElementById('resGrossTP').innerText = "Rp 0";
            document.getElementById('resFeeTP').innerText = "-Rp 0";
            document.getElementById('resEndingCapitalTP').innerText = formatRupiah(capital);
            document.getElementById('resLoss').innerText = "-Rp 0";
            document.getElementById('resLossPct').innerText = "Rugi Bersih: 0.0%";
            document.getElementById('resGrossSL').innerText = "Rp 0";
            document.getElementById('resFeeSL').innerText = "-Rp 0";
            document.getElementById('resEndingCapitalSL').innerText = formatRupiah(capital);
            document.getElementById('resRRR').innerText = "1 : 0.00";
            document.getElementById('resBEP').innerText = formatRupiah(entry);
            return;
        }

        // 1. Position Sizing by Risk Budget
        const riskPerShare = entry - sl;
        const rawAllowedShares = Math.floor(maxRiskBudget / riskPerShare);
        
        // 2. Cash Limit Safety Check (no over-leverage beyond 100% portfolio)
        const maxAffordableShares = Math.floor(capital / entry);
        let actualAllowedShares = Math.min(rawAllowedShares, maxAffordableShares);

        // 3. IDX BEI Rule: 1 Lot = 100 Shares
        let lots = Math.floor(actualAllowedShares / 100);
        if (lots < 1) lots = 1; // Minimum 1 lot order in IDX

        const actualShares = lots * 100;
        const totalBuyGross = actualShares * entry;
        const buyFee = totalBuyGross * BUY_FEE_RATE;
        const totalOutflow = totalBuyGross + buyFee;
        const capPct = (totalBuyGross / capital) * 100;

        // Check if buying 1 lot exceeds capital
        const capStatusEl = document.getElementById('resCapStatus');
        if (totalOutflow > capital) {
            capStatusEl.innerText = `⚠️ Total beli (${formatRupiah(totalOutflow)}) melampaui modal tunai portofolio!`;
            capStatusEl.className = "res-status text-red";
        } else if (rawAllowedShares > maxAffordableShares) {
            capStatusEl.innerText = `⚠️ Dibatasi oleh kas tunai (${capPct.toFixed(1)}% modal) agar tidak over-leverage`;
            capStatusEl.className = "res-status text-gold";
        } else {
            capStatusEl.innerText = `✅ Sesuai batas risiko & kas (${capPct.toFixed(1)}% modal)`;
            capStatusEl.className = "res-status text-green";
        }

        // 4. Scenario: Take Profit (TP)
        const grossTP = actualShares * tp;
        const sellFeeTP = grossTP * SELL_FEE_RATE;
        const totalFeesTP = buyFee + sellFeeTP;
        const netProfitRp = grossTP - totalBuyGross - totalFeesTP;
        const netProfitPct = totalBuyGross > 0 ? (netProfitRp / totalBuyGross) * 100 : 0;
        const endingCapitalTP = capital + netProfitRp;

        // 5. Scenario: Stop Loss (SL)
        const grossSL = actualShares * sl;
        const sellFeeSL = grossSL * SELL_FEE_RATE;
        const totalFeesSL = buyFee + sellFeeSL;
        const netLossRp = (totalBuyGross - grossSL) + totalFeesSL;
        const netLossPctOfCapital = capital > 0 ? (netLossRp / capital) * 100 : 0;
        const endingCapitalSL = Math.max(0, capital - netLossRp);

        // 6. Risk-Reward Ratio (Net of fees)
        const rrr = netLossRp > 0 ? (netProfitRp / netLossRp).toFixed(2) : "0.00";
        const rrrBadge = document.getElementById('resRRRBadge');
        if (rrrBadge) {
            if (rrr >= 2.0) {
                rrrBadge.className = "stat-badge badge-strong-buy";
                rrrBadge.innerText = "Sangat Sehat (≥ 1:2)";
            } else if (rrr >= 1.5) {
                rrrBadge.className = "stat-badge badge-buy";
                rrrBadge.innerText = "Cukup Layak (≥ 1:1.5)";
            } else {
                rrrBadge.className = "stat-badge badge-hold";
                rrrBadge.innerText = "Kurang Disarankan (< 1:1.5)";
            }
        }

        // 7. Break-Even Price (BEP)
        // Price at which: sellPrice * (1 - SELL_FEE_RATE) = entry * (1 + BUY_FEE_RATE)
        const bep = entry * ((1 + BUY_FEE_RATE) / (1 - SELL_FEE_RATE));

        // Render Values to UI
        document.getElementById('resLots').innerText = `${lots} Lot`;
        document.getElementById('resShares').innerText = `${actualShares.toLocaleString('id-ID')} Lembar Saham`;
        document.getElementById('resTotalBuy').innerText = `Total Beli: ${formatRupiah(totalBuyGross)} (${capPct.toFixed(1)}% modal)`;
        
        document.getElementById('resMaxRisk').innerText = formatRupiah(netLossRp);
        document.getElementById('resRiskExplanation').innerText = `Jika kena SL di ${formatRupiah(sl)}, modal Anda HANYA berkurang ${formatRupiah(netLossRp)} (${netLossPctOfCapital.toFixed(2)}%), BUKAN modal seluruhnya!`;
        document.getElementById('resRiskPerShare').innerText = `Risiko: ${formatRupiah(riskPerShare)} / lembar`;

        // Profit Box
        document.getElementById('resProfit').innerText = `+${formatRupiah(netProfitRp)}`;
        document.getElementById('resProfitPct').innerText = `Return Bersih: +${netProfitPct.toFixed(2)}% (setelah fee)`;
        document.getElementById('resGrossTP').innerText = formatRupiah(grossTP);
        document.getElementById('resFeeTP').innerText = `-${formatRupiah(totalFeesTP)}`;
        document.getElementById('resEndingCapitalTP').innerText = formatRupiah(endingCapitalTP);

        // Loss Box
        document.getElementById('resLoss').innerText = `-${formatRupiah(netLossRp)}`;
        document.getElementById('resLossPct').innerText = `Rugi Bersih: -${netLossPctOfCapital.toFixed(2)}% modal (termasuk fee)`;
        document.getElementById('resGrossSL').innerText = formatRupiah(grossSL);
        document.getElementById('resFeeSL').innerText = `-${formatRupiah(totalFeesSL)}`;
        document.getElementById('resEndingCapitalSL').innerText = formatRupiah(endingCapitalSL);

        // Footer Stats
        document.getElementById('resRRR').innerText = `1 : ${rrr}`;
        document.getElementById('resBEP').innerText = formatRupiah(Math.ceil(bep));
    }

    ['calcCapital', 'calcRiskPct', 'calcEntryPrice', 'calcStopLoss', 'calcTargetPrice'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calculatePositionSize);
    });

    // -------------------------------------------------------------------------
    // 9. MULTI-HARI TABLE WITH SCROLLING & STATEFUL PAGINATION (167 STOCKS)
    // -------------------------------------------------------------------------
    let currentMultiData = [];
    let multiCurrentPage = 1;
    let multiPageSize = 25;

    function renderMultiTablePage() {
        const tbody = document.getElementById('tbodyMulti');
        tbody.innerHTML = '';

        const totalRecords = currentMultiData.length;
        document.getElementById('multiTotalCount').innerText = totalRecords;

        if (totalRecords === 0) {
            tbody.innerHTML = '<tr><td colspan="15" style="text-align:center; padding: 25px; color: #94a3b8;">Tidak ada data emiten yang cocok dengan filter pencarian.</td></tr>';
            document.getElementById('multiShowingCount').innerText = '0';
            document.getElementById('multiPageInfo').innerText = '0 / 0';
            document.getElementById('btnMultiPrev').disabled = true;
            document.getElementById('btnMultiNext').disabled = true;
            document.getElementById('btnMultiFirst').disabled = true;
            document.getElementById('btnMultiLast').disabled = true;
            return;
        }

        const effectiveSize = multiPageSize === 'ALL' ? totalRecords : parseInt(multiPageSize, 10);
        const totalPages = Math.ceil(totalRecords / effectiveSize);
        if (multiCurrentPage > totalPages) multiCurrentPage = totalPages;
        if (multiCurrentPage < 1) multiCurrentPage = 1;

        const startIdx = (multiCurrentPage - 1) * effectiveSize;
        const endIdx = Math.min(startIdx + effectiveSize, totalRecords);
        const pageRows = currentMultiData.slice(startIdx, endIdx);

        document.getElementById('multiShowingCount').innerText = `${startIdx + 1} - ${endIdx}`;
        document.getElementById('multiPageInfo').innerText = `${multiCurrentPage} / ${totalPages}`;

        document.getElementById('btnMultiFirst').disabled = multiCurrentPage <= 1;
        document.getElementById('btnMultiPrev').disabled = multiCurrentPage <= 1;
        document.getElementById('btnMultiNext').disabled = multiCurrentPage >= totalPages;
        document.getElementById('btnMultiLast').disabled = multiCurrentPage >= totalPages;

        pageRows.forEach(row => {
            const tr = document.createElement('tr');
            const p31 = row['Potensi_H+31(%)'] ?? 0;
            const sinyal = row.Sinyal_Swing || 'HOLD';
            const badgeClass = sinyal === 'STRONG BUY' ? 'badge-strong-buy' :
                               sinyal === 'BUY' ? 'badge-buy' :
                               String(sinyal).includes('SELL') ? 'badge-sell' : 'badge-hold';
            const rrr = row.RRR !== undefined ? String(row.RRR).replace(' : 1.0', '') : '1.60';

            tr.innerHTML = `
                <td>${row.Sektor || '-'}</td>
                <td><strong>${row.Kode || '-'}</strong></td>
                <td>${formatRupiah(row.Close_Terakhir)}</td>
                <td>${formatRupiah(row['H+1'])}</td>
                <td>${formatRupiah(row['H+7'])}</td>
                <td>${formatRupiah(row['H+14'])}</td>
                <td>${formatRupiah(row['H+21'])}</td>
                <td>${formatRupiah(row['H+30'])}</td>
                <td>${formatRupiah(row['H+31'])}</td>
                <td class="${p31 >= 0 ? 'text-green' : 'text-red'}"><strong>${formatPercent(p31)}</strong></td>
                <td><span class="badge ${badgeClass}">${sinyal}</span></td>
                <td>${formatRupiah(row.Target_Price)}</td>
                <td>${formatRupiah(row.Stop_Loss)}</td>
                <td>${rrr} : 1.0</td>
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
                const inspectorEl = document.getElementById('inspector');
                if (lenis && typeof lenis.scrollTo === 'function') {
                    lenis.scrollTo(inspectorEl, { offset: -60 });
                } else if (inspectorEl) {
                    inspectorEl.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }

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
            multiCurrentPage = 1;
            renderMultiTablePage();
        } catch (e) {
            console.error("Failed to load multi-hari table:", e);
        }
    }

    // Pagination Listeners for Multi-Hari
    document.getElementById('pageSizeMulti')?.addEventListener('change', (e) => {
        multiPageSize = e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10);
        multiCurrentPage = 1;
        renderMultiTablePage();
    });

    document.getElementById('btnMultiFirst')?.addEventListener('click', () => {
        multiCurrentPage = 1;
        renderMultiTablePage();
    });

    document.getElementById('btnMultiPrev')?.addEventListener('click', () => {
        if (multiCurrentPage > 1) {
            multiCurrentPage--;
            renderMultiTablePage();
        }
    });

    document.getElementById('btnMultiNext')?.addEventListener('click', () => {
        multiCurrentPage++;
        renderMultiTablePage();
    });

    document.getElementById('btnMultiLast')?.addEventListener('click', () => {
        const effectiveSize = multiPageSize === 'ALL' ? currentMultiData.length : parseInt(multiPageSize, 10);
        multiCurrentPage = Math.ceil(currentMultiData.length / effectiveSize);
        renderMultiTablePage();
    });

    // Filter listeners
    ['filterSectorMulti', 'filterSignalMulti'].forEach(id => {
        document.getElementById(id).addEventListener('change', loadMultiHariTable);
    });
    document.getElementById('searchMulti').addEventListener('input', debounce(loadMultiHariTable, 300));

    // CSV Export Multi (Clean Readable CSV)
    document.getElementById('btnExportMulti').addEventListener('click', () => {
        window.location.href = '/data/rekomendasi_saham_multihari_rapi.csv';
    });

    // -------------------------------------------------------------------------
    // 10. SCALPING TABLE WITH SCROLLING & STATEFUL PAGINATION (5m - 60m)
    // -------------------------------------------------------------------------
    let currentScalpData = [];
    let scalpCurrentPage = 1;
    let scalpPageSize = 25;

    function renderScalpTablePage() {
        const tbody = document.getElementById('tbodyScalp');
        tbody.innerHTML = '';

        const totalRecords = currentScalpData.length;
        document.getElementById('scalpTotalCount').innerText = totalRecords;

        if (totalRecords === 0) {
            tbody.innerHTML = '<tr><td colspan="14" style="text-align:center; padding: 25px; color: #94a3b8;">Tidak ada data scalping yang cocok.</td></tr>';
            document.getElementById('scalpShowingCount').innerText = '0';
            document.getElementById('scalpPageInfo').innerText = '0 / 0';
            document.getElementById('btnScalpPrev').disabled = true;
            document.getElementById('btnScalpNext').disabled = true;
            document.getElementById('btnScalpFirst').disabled = true;
            document.getElementById('btnScalpLast').disabled = true;
            return;
        }

        const effectiveSize = scalpPageSize === 'ALL' ? totalRecords : parseInt(scalpPageSize, 10);
        const totalPages = Math.ceil(totalRecords / effectiveSize);
        if (scalpCurrentPage > totalPages) scalpCurrentPage = totalPages;
        if (scalpCurrentPage < 1) scalpCurrentPage = 1;

        const startIdx = (scalpCurrentPage - 1) * effectiveSize;
        const endIdx = Math.min(startIdx + effectiveSize, totalRecords);
        const pageRows = currentScalpData.slice(startIdx, endIdx);

        document.getElementById('scalpShowingCount').innerText = `${startIdx + 1} - ${endIdx}`;
        document.getElementById('scalpPageInfo').innerText = `${scalpCurrentPage} / ${totalPages}`;

        document.getElementById('btnScalpFirst').disabled = scalpCurrentPage <= 1;
        document.getElementById('btnScalpPrev').disabled = scalpCurrentPage <= 1;
        document.getElementById('btnScalpNext').disabled = scalpCurrentPage >= totalPages;
        document.getElementById('btnScalpLast').disabled = scalpCurrentPage >= totalPages;

        pageRows.forEach(row => {
            const tr = document.createElement('tr');
            const net = row['Net_Gain_60m(%)'] ?? 0;
            const volStatus = row.Volume_Status || 'NORMAL';
            const isSurge = String(volStatus).toUpperCase().includes('SURGE');
            const sinyal = row.Sinyal_Scalp || 'SCALP BUY';
            const mape = (row['MAPE_60m(%)'] !== undefined && row['MAPE_60m(%)'] !== null) 
                ? `${Number(row['MAPE_60m(%)']).toFixed(2)}%` 
                : '-';

            tr.innerHTML = `
                <td>${row.Sektor || '-'}</td>
                <td><strong>${row.Kode || '-'}</strong></td>
                <td>${formatRupiah(row.Last_Close)}</td>
                <td>${formatRupiah(row['+5m'])}</td>
                <td>${formatRupiah(row['+15m'])}</td>
                <td>${formatRupiah(row['+30m'])}</td>
                <td>${formatRupiah(row['+60m'])}</td>
                <td class="${net > 0 ? 'text-green' : 'text-red'}"><strong>${formatPercent(net)}</strong></td>
                <td><span class="badge ${isSurge ? 'badge-strong-buy' : 'badge-hold'}">${volStatus}</span></td>
                <td><span class="badge badge-buy">${sinyal}</span></td>
                <td>${formatRupiah(row.TP_Scalp)}</td>
                <td>${formatRupiah(row.SL_Scalp)}</td>
                <td>${mape}</td>
                <td><button class="btn-sm-view" data-ticker="${row.Kode}">Analisis</button></td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.btn-sm-view').forEach(btn => {
            btn.addEventListener('click', () => {
                const t = btn.getAttribute('data-ticker');
                document.getElementById('stockSelector').value = t;
                loadStockDetail(t);
                const inspectorEl = document.getElementById('inspector');
                if (lenis && typeof lenis.scrollTo === 'function') {
                    lenis.scrollTo(inspectorEl, { offset: -60 });
                } else if (inspectorEl) {
                    inspectorEl.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }

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
            scalpCurrentPage = 1;
            renderScalpTablePage();
        } catch (e) {
            console.error("Failed to load scalping table:", e);
        }
    }

    // Pagination Listeners for Scalping
    document.getElementById('pageSizeScalp')?.addEventListener('change', (e) => {
        scalpPageSize = e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10);
        scalpCurrentPage = 1;
        renderScalpTablePage();
    });

    document.getElementById('btnScalpFirst')?.addEventListener('click', () => {
        scalpCurrentPage = 1;
        renderScalpTablePage();
    });

    document.getElementById('btnScalpPrev')?.addEventListener('click', () => {
        if (scalpCurrentPage > 1) {
            scalpCurrentPage--;
            renderScalpTablePage();
        }
    });

    document.getElementById('btnScalpNext')?.addEventListener('click', () => {
        scalpCurrentPage++;
        renderScalpTablePage();
    });

    document.getElementById('btnScalpLast')?.addEventListener('click', () => {
        const effectiveSize = scalpPageSize === 'ALL' ? currentScalpData.length : parseInt(scalpPageSize, 10);
        scalpCurrentPage = Math.ceil(currentScalpData.length / effectiveSize);
        renderScalpTablePage();
    });

    document.getElementById('filterSectorScalp').addEventListener('change', loadScalpingTable);
    document.getElementById('searchScalp').addEventListener('input', debounce(loadScalpingTable, 300));

    // CSV Export Scalp (Clean Readable CSV)
    document.getElementById('btnExportScalp').addEventListener('click', () => {
        window.location.href = '/data/rekomendasi_saham_scalping_rapi.csv';
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

    // Active navigation highlight on scroll
    window.addEventListener('scroll', debounce(() => {
        const sections = document.querySelectorAll('section[id]');
        const scrollPosition = window.pageYOffset + 140;

        sections.forEach(sec => {
            const top = sec.offsetTop;
            const height = sec.offsetHeight;
            const id = sec.getAttribute('id');

            if (scrollPosition >= top && scrollPosition < top + height) {
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, 100));

    // -------------------------------------------------------------------------
    // INITIAL BOOTSTRAP
    // -------------------------------------------------------------------------
    loadOverview();
    populateStockSelector();
    loadMultiHariTable();
    loadScalpingTable();
});
