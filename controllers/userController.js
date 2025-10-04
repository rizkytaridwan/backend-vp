// controllers/userController.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// Mengambil semua user
exports.getAllUsers = async (req, res) => {
    // --- PERBAIKAN DIMULAI DI SINI ---
    // Pastikan page dan limit adalah angka integer yang valid.
    // Jika input tidak valid (misal: "abc"), gunakan nilai default.
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || '';
    // --- SELESAI PERBAIKAN ---

    const offset = (page - 1) * limit;
    const searchQuery = `%${search}%`;

    try {
        // Query untuk mengambil data per halaman
        const [users] = await pool.execute(
            `SELECT u.id, u.telegram_chat_id, u.telegram_username, u.full_name, u.status,
                    r.name as role_name, s.name as store_name
             FROM users u
             LEFT JOIN roles r ON u.role_id = r.id
             LEFT JOIN stores s ON u.store_id = s.id
             WHERE (u.full_name LIKE ? OR u.telegram_username LIKE ?)
             ORDER BY u.created_at DESC
             LIMIT ? OFFSET ?`,
            [searchQuery, searchQuery, limit, offset] // Gunakan limit dan offset yang sudah aman
        );

        // Query untuk menghitung total data yang cocok
        const [[{ total }]] = await pool.execute(
            'SELECT COUNT(id) as total FROM users WHERE (full_name LIKE ? OR telegram_username LIKE ?)',
            [searchQuery, searchQuery]
        );

        res.json({
            users,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Mengupdate user (role, store, status)
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { role_id, store_id, status } = req.body;

    try {
        await pool.execute(
            'UPDATE users SET role_id = ?, store_id = ?, status = ? WHERE id = ?',
            [role_id, store_id, status, id]
        );
        res.json({ msg: 'User berhasil diupdate' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Mengambil semua roles
exports.getRoles = async (req, res) => {
    try {
        const [roles] = await pool.execute('SELECT * FROM roles');
        res.json(roles);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Mengambil semua stores
exports.getStores = async (req, res) => {
    try {
        const [stores] = await pool.execute("SELECT * FROM stores WHERE status = 'active'");
        res.json(stores);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};