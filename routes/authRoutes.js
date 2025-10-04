// authroutes.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { login } = require('../controllers/authController');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 menit
  max: 8,                     // Maksimal 8 percobaan per jendela waktu
  message: { msg: 'Terlalu banyak percobaan login. Silakan coba lagi setelah 15 menit.' },
  standardHeaders: true,      // Mengirim header RateLimit-* standar
  legacyHeaders: false,       // Menonaktifkan header X-RateLimit-* lama
  skipSuccessfulRequests: true // Tidak menghitung percobaan yang berhasil
});

// Terapkan middleware ke route login
router.post('/login', loginLimiter, login);

module.exports = router;