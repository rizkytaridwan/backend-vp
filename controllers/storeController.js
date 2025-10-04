// admin-dashboard-backend/src/controllers/storeController.js

const pool = require('../config/db');

// GET /api/stores - Mengambil semua toko
exports.getAllStores = async (req, res) => {
    // --- PERBAIKAN DIMULAI DI SINI ---
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || '';
    // --- SELESAI PERBAIKAN ---

    const offset = (page - 1) * limit;
    const searchQuery = `%${search}%`;

    try {
        // Query untuk mengambil data per halaman
        const [stores] = await pool.execute(
            `SELECT * FROM stores 
             WHERE (name LIKE ? OR address LIKE ?)
             ORDER BY name ASC 
             LIMIT ? OFFSET ?`,
            [searchQuery, searchQuery, limit, offset] // Gunakan limit dan offset yang sudah aman
        );

        // Query untuk menghitung total data yang cocok (untuk total halaman)
        const [[{ total }]] = await pool.execute(
            'SELECT COUNT(id) as total FROM stores WHERE (name LIKE ? OR address LIKE ?)',
            [searchQuery, searchQuery]
        );

        res.json({
            stores,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// POST /api/stores - Menambah toko baru
exports.createStore = async (req, res) => {
    const { name, address, phone, status } = req.body;
    if (!name) {
        return res.status(400).json({ msg: 'Nama toko tidak boleh kosong' });
    }
    try {
        const [result] = await pool.execute(
            'INSERT INTO stores (name, address, phone, status) VALUES (?, ?, ?, ?)',
            [name, address || null, phone || null, status || 'active']
        );
        res.status(201).json({ id: result.insertId, name, address, phone, status });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// PUT /api/stores/:id - Mengupdate toko
exports.updateStore = async (req, res) => {
    const { id } = req.params;
    const { name, address, phone, status } = req.body;
    if (!name) {
        return res.status(400).json({ msg: 'Nama toko tidak boleh kosong' });
    }
    try {
        const [result] = await pool.execute(
            'UPDATE stores SET name = ?, address = ?, phone = ?, status = ? WHERE id = ?',
            [name, address || null, phone || null, status || 'active', id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ msg: 'Toko tidak ditemukan' });
        }
        res.json({ msg: 'Toko berhasil diupdate' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// DELETE /api/stores/:id - Menghapus toko
exports.deleteStore = async (req, res) => {
    const { id } = req.params;
    try {
        // Cek dulu apakah ada user yang terhubung ke toko ini
        const [users] = await pool.execute('SELECT id FROM users WHERE store_id = ?', [id]);
        if (users.length > 0) {
            return res.status(400).json({ msg: 'Tidak bisa menghapus toko karena masih ada user yang terhubung. Pindahkan user ke toko lain terlebih dahulu.' });
        }

        const [result] = await pool.execute('DELETE FROM stores WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ msg: 'Toko tidak ditemukan' });
        }
        res.json({ msg: 'Toko berhasil dihapus' });
    } catch (err) {
        // Handle foreign key constraint error dari transaksi
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
             return res.status(400).json({ msg: 'Tidak bisa menghapus toko karena sudah memiliki transaksi. Anda bisa mengubah statusnya menjadi "inactive".' });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};