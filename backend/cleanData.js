const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const STOCK_RNN_DIR = path.join(ROOT_DIR, 'Stock_RNN_Project');

// Helper to round rupiah to nearest integer
function roundRp(val) {
    if (val === null || val === undefined || isNaN(val)) return 0;
    return Math.round(Number(val));
}

function roundDec(val, dec = 2) {
    if (val === null || val === undefined || isNaN(val)) return 0;
    return Number(Number(val).toFixed(dec));
}

function parseCsv(content) {
    const lines = content.trim().split(/\r?\n/);
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((h, idx) => obj[h] = vals[idx]);
        rows.push(obj);
    }
    return { headers, rows };
}

// 1. Process Multi-Hari Data
const multiSrc = path.join(DATA_DIR, 'latest_multihari.csv');
const { rows: multiRows } = parseCsv(fs.readFileSync(multiSrc, 'utf8'));

// Sort by Potensi_H+31(%) descending
multiRows.sort((a, b) => Number(b['Potensi_H+31(%)'] || 0) - Number(a['Potensi_H+31(%)'] || 0));

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

multiRows.forEach((r, idx) => {
    const no = idx + 1;
    const close = roundRp(r.Close_Terakhir);
    const h1 = roundRp(r['H+1']);
    const h7 = roundRp(r['H+7']);
    const h14 = roundRp(r['H+14']);
    const h21 = roundRp(r['H+21']);
    const h30 = roundRp(r['H+30']);
    const h31 = roundRp(r['H+31']);
    const p1 = roundDec(r['Potensi_H+1(%)']);
    const p7 = roundDec(r['Potensi_H+7(%)']);
    const p31 = roundDec(r['Potensi_H+31(%)']);
    const tp = roundRp(r.Target_Price);
    const sl = roundRp(r.Stop_Loss);
    const rrr = roundDec(r.RRR);
    const mape = roundDec(r['MAPE_H+31(%)']);
    const grade = (r.Grade || 'Presisi Baik').replace(/"/g, '');

    cleanMultiLines.push([
        no, r.Sektor, r.Kode, close,
        h1, h7, h14, h21, h30, h31,
        p1, p7, p31,
        r.Sinyal_Swing, tp, sl, rrr, mape, `"${grade}"`
    ].join(','));

    readableMultiLines.push([
        no, r.Sektor, r.Kode, close,
        h1, h7, h14, h21, h30, h31,
        `${p31 > 0 ? '+' : ''}${p31}%`,
        r.Sinyal_Swing, tp, sl, `${rrr} : 1.0`, `${mape}%`, `"${grade}"`
    ].join(','));
});

fs.writeFileSync(path.join(DATA_DIR, 'latest_multihari.csv'), cleanMultiLines.join('\n'));
fs.writeFileSync(path.join(DATA_DIR, 'rekomendasi_saham_multihari_rapi.csv'), readableMultiLines.join('\n'));
fs.writeFileSync(path.join(STOCK_RNN_DIR, 'logs', 'latest_multihari.csv'), cleanMultiLines.join('\n'));

// 2. Process Scalping Data
const scalpSrc = path.join(DATA_DIR, 'latest_scalping.csv');
const { rows: scalpRows } = parseCsv(fs.readFileSync(scalpSrc, 'utf8'));

// Sort by Net_Gain_60m(%) descending
scalpRows.sort((a, b) => Number(b['Net_Gain_60m(%)'] || 0) - Number(a['Net_Gain_60m(%)'] || 0));

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

scalpRows.forEach((r, idx) => {
    const no = idx + 1;
    const close = roundRp(r.Last_Close);
    const m5 = roundRp(r['+5m']);
    const m15 = roundRp(r['+15m']);
    const m30 = roundRp(r['+30m']);
    const m60 = roundRp(r['+60m']);
    const d60 = roundDec(r['Delta_+60m(%)']);
    const net60 = roundDec(r['Net_Gain_60m(%)']);
    const tp = roundRp(r.TP_Scalp);
    const sl = roundRp(r.SL_Scalp);
    const mape = roundDec(r['MAPE_60m(%)']);
    const entry = r.Entry_Zone ? `"${r.Entry_Zone.replace(/"/g, '')}"` : `"${close}"`;

    cleanScalpLines.push([
        no, r.Sektor, r.Kode, close,
        m5, m15, m30, m60,
        d60, net60, r.Volume_Status,
        r.Sinyal_Scalp, entry, tp, sl, mape
    ].join(','));

    readableScalpLines.push([
        no, r.Sektor, r.Kode, close,
        m5, m15, m30, m60,
        `${net60 > 0 ? '+' : ''}${net60}%`,
        r.Volume_Status, r.Sinyal_Scalp, entry, tp, sl, `${mape}%`
    ].join(','));
});

fs.writeFileSync(path.join(DATA_DIR, 'latest_scalping.csv'), cleanScalpLines.join('\n'));
fs.writeFileSync(path.join(DATA_DIR, 'rekomendasi_saham_scalping_rapi.csv'), readableScalpLines.join('\n'));
fs.writeFileSync(path.join(STOCK_RNN_DIR, 'logs', 'latest_scalping.csv'), cleanScalpLines.join('\n'));

console.log('Successfully generated clean and readable CSV files:');
console.log(' - data/rekomendasi_saham_multihari_rapi.csv (', multiRows.length, 'stocks )');
console.log(' - data/rekomendasi_saham_scalping_rapi.csv (', scalpRows.length, 'stocks )');
console.log(' - data/latest_multihari.csv (Clean rounded numeric format)');
console.log(' - data/latest_scalping.csv (Clean rounded numeric format)');
