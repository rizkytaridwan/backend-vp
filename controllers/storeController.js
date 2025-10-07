const pool = require('../config/db');

// GET /api/stores - Mengambil semua toko dengan informasi regional
exports.getAllStores = async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;
    const searchQuery = `%${search}%`;

    try {
        const sql = `SELECT s.*, r.name as region_name 
             FROM stores s
             LEFT JOIN regions r ON s.region_id = r.id
             WHERE (s.name LIKE ? OR s.address LIKE ?)
             ORDER BY s.name ASC`;
        
        // PERBAIKAN: Terapkan LIMIT dan OFFSET langsung ke string
        const finalSql = `${sql} LIMIT ${limit} OFFSET ${offset}`;
        const queryParams = [searchQuery, searchQuery];

        const [stores] = await pool.execute(finalSql, queryParams);

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
        console.error("!!! ERROR in getAllStores:", err);
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};

// POST /api/stores - Menambah toko baru dengan region_id
exports.createStore = async (req, res) => {
    const { name, address, phone, status, region_id } = req.body;
    if (!name) {
        return res.status(400).json({ msg: 'Nama toko tidak boleh kosong' });
    }
    try {
        const [result] = await pool.execute(
            'INSERT INTO stores (name, address, phone, status, region_id) VALUES (?, ?, ?, ?, ?)',
            [name, address || null, phone || null, status || 'active', region_id || null]
        );
        res.status(201).json({ id: result.insertId, name, address, phone, status, region_id });
    } catch (err) {
        // Penanganan error jika nama toko sudah ada
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ msg: 'Nama toko sudah ada. Silakan gunakan nama lain.' });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// PUT /api/stores/:id - Mengupdate toko dengan region_id
exports.updateStore = async (req, res) => {
    const { id } = req.params;
    const { name, address, phone, status, region_id } = req.body;
    if (!name) {
        return res.status(400).json({ msg: 'Nama toko tidak boleh kosong' });
    }
    try {
        const [result] = await pool.execute(
            'UPDATE stores SET name = ?, address = ?, phone = ?, status = ?, region_id = ? WHERE id = ?',
            [name, address || null, phone || null, status || 'active', region_id || null, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ msg: 'Toko tidak ditemukan' });
        }
        res.json({ msg: 'Toko berhasil diupdate' });
    } catch (err) {
        // Penanganan error jika nama toko sudah ada
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ msg: 'Nama toko sudah ada. Silakan gunakan nama lain.' });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// DELETE /api/stores/:id - Menghapus toko
exports.deleteStore = async (req, res) => {
    const { id } = req.params;
    try {
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
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
             return res.status(400).json({ msg: 'Tidak bisa menghapus toko karena sudah memiliki transaksi. Anda bisa mengubah statusnya menjadi "inactive".' });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
