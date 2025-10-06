// config/redis.js
const { createClient } = require('redis');

const client = createClient({
    // URL koneksi ke server Redis Anda
    // Contoh: redis://localhost:6379
    url: process.env.REDIS_URL 
});

client.on('error', (err) => console.error('❌ Redis Client Error', err));

(async () => {
    await client.connect();
    console.log('✅ Koneksi ke Redis berhasil.');
})();

module.exports = null; 