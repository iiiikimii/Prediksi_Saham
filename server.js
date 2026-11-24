/**
 * Root Server Entry Point for IDX AI Stock Terminal
 * Starts Express HTTP Server on PORT (default: 3000)
 */

const app = require('./backend/server.js');
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 IDX AI Stock Terminal (Node.js) is RUNNING!`);
    console.log(`📡 Local URL: http://localhost:${PORT}`);
    console.log(`📊 Universe: 167 Emiten BEI (Perbankan, Makanan, Perkebunan, Mineral)`);
    console.log(`✨ Features: Lenis Smooth Scroll, GSAP, Chart.js, Lot Calculator`);
    console.log(`=======================================================`);
    console.log(`Tekan Ctrl + C untuk menghentikan server.`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nMematikan server IDX AI Stock Terminal...');
    server.close(() => {
        console.log('Server dihentikan.');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
});

module.exports = app;
