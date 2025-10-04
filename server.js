require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db'); // Kita akan buat file ini

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Cek Koneksi DB
pool.getConnection()
    .then(conn => {
        console.log('✅ Koneksi ke database MySQL berhasil.');
        conn.release();
    })
    .catch(err => {
        console.error('❌ Gagal terhubung ke database MySQL:', err.message);
        process.exit(1);
    });

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/stores', require('./routes/storeRoutes'));


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server API berjalan di port ${PORT}`));