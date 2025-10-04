// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const pool = require('../config/db'); // Tambahkan ini


module.exports = async function (req, res, next) {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ msg: 'Akses ditolak, tidak ada token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Ambil data user lengkap dari DB agar role selalu up-to-date
        const [users] = await pool.execute('SELECT id, full_name, role_id FROM users WHERE id = ?', [decoded.user.id]);
        if (users.length === 0) {
            return res.status(401).json({ msg: 'User tidak ditemukan' });
        }

        req.user = users[0]; // Sekarang req.user berisi { id, full_name, role_id }
        next();
    } catch (e) {
        res.status(400).json({ msg: 'Token tidak valid' });
    }
};