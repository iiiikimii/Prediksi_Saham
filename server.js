/**
 * Root Server Entry Point for IDX AI Stock Terminal
 * Starts Express HTTP Server on PORT (default: 3000)
 * Includes port fallback and host binding for IPv4/IPv6 resilience
 */

const http = require('http');
const app = require('./backend/server.js');

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = '0.0.0.0'; // Binds to all IPv4 and IPv6 network interfaces

function startServer(portToTry) {
    const server = http.createServer(app);

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`[PERINGATAN] Port ${portToTry} sedang digunakan oleh aplikasi lain.`);
            if (portToTry < DEFAULT_PORT + 10) {
                console.log(`[INFO] Mencoba beralih ke port ${portToTry + 1}...`);
                startServer(portToTry + 1);
            } else {
                console.error(`[ERROR] Tidak dapat menemukan port yang tersedia antara ${DEFAULT_PORT} - ${DEFAULT_PORT + 10}.`);
                process.exit(1);
            }
        } else {
            console.error('[ERROR] Terjadi kesalahan pada server:', err.message);
            process.exit(1);
        }
    });

    server.listen(portToTry, HOST, () => {
        console.log(`=======================================================`);
        console.log(`🚀 IDX AI Stock Terminal (Node.js) AKTIF & SIAP!`);
        console.log(`📡 URL Akses: http://localhost:${portToTry}`);
        console.log(`📡 URL Alternatif: http://127.0.0.1:${portToTry}`);
        console.log(`📊 Universe: 167 Emiten BEI (Perbankan, Makanan, Perkebunan, Mineral)`);
        console.log(`✨ Fitur: Lenis Smooth Scroll, GSAP, Chart.js, Realistic Lot Calculator`);
        console.log(`=======================================================`);
        console.log(`[PENTING] JANGAN TUTUP jendela terminal ini agar website tetap aktif!`);
        console.log(`Tekan Ctrl + C jika ingin menghentikan server.`);
    });

    const cleanup = () => {
        console.log('\nMematikan server IDX AI Stock Terminal...');
        server.close(() => {
            console.log('Server berhasil dimatikan.');
            process.exit(0);
        });
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    return server;
}

if (require.main === module) {
    startServer(DEFAULT_PORT);
}

module.exports = app;

